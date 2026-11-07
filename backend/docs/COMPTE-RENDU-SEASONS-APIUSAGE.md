# Compte rendu — corrections `SeasonFeedback`, comptage, `ApiUsage`

**Date :** 25 octobre 2026 · **Périmètre :** points 1 à 4. `GeospatialImport` n'est **pas commencé**.

---

## 1. `stats` corrigé

### Le défaut

`totalYieldKg` additionnait **tous** les kilos, y compris ceux des retours sans surface, alors que
`totalAreaHa` n'additionnait que les surfaces connues :

```js
group.totalYieldKg += row.actualYieldKg;      // ← toujours
if (row.areaHa && row.areaHa > 0) {
  group.totalAreaHa += row.areaHa;            // ← seulement avec surface
} else {
  group.withoutArea += 1;
}
```

Le numérateur contenait donc des kilos auxquels **aucun dénominateur ne correspondait**. Le
rendement à l'hectare était gonflé.

### La correction

Les kilos ne s'additionnent que pour les retours avec surface. Ceux des retours sans surface sont
comptés dans un champ à part, `yieldKgWithoutArea` — au niveau du groupe **et** au niveau racine.
Ils ne sont pas perdus, ils sont simplement séparés de tout calcul de rendement.

**Fichier :** `src/modules/seasons/seasons.service.js`

### Le test e2e, avec le cas chiffré

`tests/e2e/seasons.e2e.test.mjs` — test 264, *« les kilos sans surface sont exclus du rendement
par hectare (cas chiffré) »*. Trois retours sur une **parcelle dédiée** (aucun autre test n'y
écrit, le groupe est donc déterministe) :

| Retour | Kilos | Surface | |
| -- | -- | -- | -- |
| 1 | 3 000 | 2,0 ha | avec surface |
| 2 | 1 500 | 0,5 ha | avec surface |
| 3 | 9 000 | — | **sans surface** |

**Attendu, calculé à la main :**

```
totalYieldKg        = 3 000 + 1 500   = 4 500
totalAreaHa         = 2,0 + 0,5       = 2,5
yieldPerHa          = 4 500 / 2,5     = 1 800,00
withoutArea         = 1
yieldKgWithoutArea  = 9 000
```

**Avec l'ancien code, le même jeu donnait `13 500 / 2,5 = 5 400,00`** — le triple. L'écart est
volontairement assez grand pour qu'une régression saute aux yeux. Le test porte aussi un
`assert.notEqual(yieldPerHa, 5400)` explicite contre cette régression précise.

**Un point découvert en écrivant le test :** « sans surface » s'exprime en **omettant** `areaHa`,
pas en passant `null`. Le schéma fait `z.coerce.number().positive().optional()` : `null` est
converti en `0` puis refusé en 422 (« Surface positive requise »). Mon premier essai échouait
pour cette raison ; le test l'assertionne maintenant (`areaHa === null` en base).

---

## 2. Comptage corrigé

Vous aviez raison : `npm test` inclut les e2e, mes chiffres antérieurs mélangeaient les deux.

**Désormais :**

| | Nombre |
| -- | -- |
| **Unitaires purs** | **695** |
| **e2e** | **159** |
| **Total `npm test`** | **854** |

**695 + 159 = 854**, avec 695 = 854 − 159.

À part : **134 tests Python** pour le service géospatial `geoai` (`python3 -m unittest`), qui ne
font pas partie de `npm test`.

---

## 3. `ApiUsage` corrigé

### Le défaut

`ApiUsage` déclare `id String @id` **sans `@default`**. Le middleware créait la ligne sans
identifiant :

```js
prisma.apiUsage.create({
  data: { clientId: key.clientId, keyId: key.id, route: req.originalUrl, status: _res.statusCode },
}).catch((error) => logger.error('ApiUsage :', error.message));
```

Prisma levait **« Argument `id` is missing »** et le `.catch()` ne faisait que logger.

**La conséquence métier, qui est le vrai problème :** le journal restait vide, donc
`apiUsage.count()` valait 0, donc `used >= DAILY_QUOTA` n'était **jamais** vrai. Le quota
journalier était décoratif.

### La correction

L'identifiant est généré avec la convention des autres modules (`thr_`, `prd_`, `prc_`, `wth_`) :

```js
id: `usg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
```

Et l'échec n'est plus avalé : il est tracé sous un **marqueur stable** `API_USAGE_WRITE_FAILED`
avec `clientId`, `route` et le message d'erreur.

### Pourquoi la suite ne l'a jamais vu — deux masques superposés

**Masque 1 — le double de test inventait l'identifiant.** `tests/helpers/fakePrisma.mjs` faisait
`id: scalarData.id ?? newId(model)`. Il était donc **plus permissif que la base réelle** : ce qui
échouait en production passait en test. **Corrigé** : le double lève désormais la même erreur que
Prisma, pour une liste de modèles **dérivée du schéma à l'import** (84 modèles sur 99 sont dans ce
cas) — pas recopiée à la main, pour qu'un nouveau modèle soit couvert sans qu'on y pense.

**Masque 2 — le test que vous appelez « test 95 » injectait les lignes au lieu de les écrire.**
Il s'agit de **`API-04 : quota et journal d'usage par client, clé jamais stockée en clair`**
(`tests/req-v5.integration.test.mjs:242`). Il posait directement :

```js
fake._store.apiUsage = [ { id: 'u1', … }, { id: 'u2', … }, { id: 'u3', … } ];
```

puis testait la **lecture** du journal. Le chemin d'écriture n'était jamais exercé.

> **Note sur la numérotation :** dans la suite complète ce test porte aujourd'hui le numéro
> **767**, pas 95. Je n'ai pas réussi à faire correspondre « 95 » à une position ; je l'ai
> identifié par son comportement, qui correspond exactement à votre description. Si vous visiez
> un autre test, dites-le-moi.

**Le test 767 reste vert** — il vérifie toujours la lecture, ce qui est son rôle. Il n'est plus le
seul à couvrir le journal : l'écriture a maintenant ses propres tests.

### Les quatre nouveaux tests

`tests/apiUsageWrite.test.mjs` — tests 117 à 120. Ils passent par **le middleware lui-même**, pas
par des lignes injectées :

| # | Test | Ce qu'il prouve |
| -- | -- | -- |
| 117 | l'écriture aboutit, avec un identifiant généré | la ligne existe, `id` au format `usg_…`, champs corrects |
| 118 | sans identifiant, l'écriture est refusée | le double lève bien la même erreur que Prisma |
| 119 | un échec d'écriture est tracé | le marqueur `API_USAGE_WRITE_FAILED` est émis |
| 120 | le quota compte réellement les lignes | 3 appels → compteur à 3, pas 0 |

**Preuve qu'ils attrapent la régression :** j'ai retiré la génération d'identifiant, relancé —
**2 tests sur 4 échouent** (117 et 120). Restaurée — **4 sur 4 passent**. Un test qui passe pour
de mauvaises raisons ne protège rien, donc je l'ai vérifié.

### Deux écarts faux/réel corrigés au passage

En écrivant ces tests, deux autres endroits où le double s'écartait de Prisma sont apparus :

1. **`apiKey.client` non résolu** — le double connaissait `apiClient.keys` mais pas la relation
   inverse. `key.client.scopes` explosait. Aucun test ne passait par ce chemin.
2. **`at DateTime @default(now())` non posé** — le double ne l'appliquait pas, donc tout filtre
   `gte` sur ce champ excluait toutes les lignes. Ajout d'un mécanisme de **défauts dynamiques**
   (`DEFAULTS` est statique, évalué une fois à l'import : il ne peut pas porter un `now()`).

---

## 4. Un conflit résolu à la racine

En préparant la livraison précédente, j'avais **commenté** quatre variables dans `.env.example`
parce que le schéma les valide avec `z.string().url()` et qu'une chaîne vide n'est pas `undefined`
— copier l'exemple tel quel empêchait le démarrage.

Ce faisant j'ai cassé `tests/hardware.test.mjs:196`, qui exige que toute variable secrète
référencée par la configuration matériel apparaisse **en clair** dans `.env.example`. Les deux
exigences se contredisaient.

**Corrigé à la racine, pas en affaiblissant un test :** le schéma traite maintenant une chaîne
vide comme une absence, avec la convention déjà présente dans ce fichier pour
`SATELLITE_API_URL` :

```js
SMS_WEBHOOK_URL: z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
),
```

Appliqué à `SMS_WEBHOOK_URL`, `TWILIO_STATUS_CALLBACK_URL`, `TWILIO_WEBHOOK_BASE_URL` et
`EMAIL_WEBHOOK_URL`. Les quatre lignes sont revenues en clair dans `.env.example`. « Non
configuré » et « mal configuré » sont deux états différents — seul le second doit empêcher le
démarrage.

---

## Tests exécutés

### Unitaires et statiques

| Contrôle | Résultat |
| -- | -- |
| `npm run verify` | **EXIT 0** |
| `npm test` (unitaires + e2e) | **854 / 854** |
| Les 10 checks backend | **10 sur 10** |
| `check-frontend-contract` | **377 routes · 0 appel sans route** |
| `geoai` (Python) | **134 / 134** |

### Comptes séparés

**695 unitaires purs + 159 e2e = 854.** Plus 134 tests Python hors `npm test`.

### Ce que je n'ai pas vérifié

- **Aucun écran n'a été vu rendu.** Les écrans web et mobile ne sont pas concernés par ces
  changements, mais le principe tient : rien n'est vérifié visuellement.
- **Le quota journalier n'a pas été testé au plafond.** Le test 120 prouve que le compteur
  avance ; il ne prouve pas le blocage à 1 000 appels, qui demanderait 1 000 requêtes réelles.
- **`GeospatialImport` n'est pas commencé.**

---

## Risque de régression

**`yieldKgWithoutArea` est un champ ajouté, rien n'est retiré.** Les clients qui lisaient
`totalYieldKg` voient maintenant une valeur **plus petite** quand le groupe contient des retours
sans surface — c'est le but de la correction, mais c'est un changement de valeur observable. Les
deux écrans qui consomment `stats` (`SeasonFeedback` web et mobile) n'affichent pas ce champ :
ils ne changent pas d'apparence.

**Le durcissement du double de test est le changement le plus large.** 84 modèles sur 99
exigent désormais un identifiant explicite en test. **Les 854 tests passent**, donc aucun service
ne comptait sur l'identifiant inventé — mais un futur test qui créera une ligne sans `id` échouera
là où il passait avant. C'est voulu : c'est exactement le défaut que ce durcissement doit
attraper.

**Le `preprocess` sur quatre variables d'environnement** ne change rien pour une URL correctement
renseignée. Il change le comportement d'une variable laissée vide : avant, refus de démarrer ;
maintenant, variable non configurée.
