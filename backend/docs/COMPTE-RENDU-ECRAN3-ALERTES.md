# Compte rendu — écran 3 : boîte d'alertes

Date : 2026-10-27 · Branche de travail : écran 3 (après écran 2, après le ZIP du 2026-10-27)

---

## 1. Ce qui était demandé

Une boîte d'alertes avec :

- une **liste filtrable** ;
- **marquer lue** et **marquer traitée** ;
- la **source** (mesure / prévision / capteur silencieux) ;
- la **valeur observée et la plage** ;
- un **lien depuis le tableau de bord** ;
- sur **web et mobile** ;
- avec les mêmes garde-fous qu'aux écrans précédents : pas de libellé recopié en
  dur quand l'API le fournit, pas de type qui masque un objet, test de scan
  structurel **avec contre-épreuve**.

---

## 2. Le défaut trouvé en lisant le code existant

`alerts.service.js` renvoyait les **lignes Prisma brutes**. Les écrans recevaient
donc `sourceType: 'MEASUREMENT'`, `severity: 'WARNING'`, `status: 'NEW'`.

Le panneau de capteurs (les deux clients) avait contourné cela en **recopiant
trois phrases françaises** :

```tsx
{alert.sourceType === 'SENSOR_SILENCE'
  ? 'Capteur muet : aucune donnée transmise — une absence, pas une mauvaise mesure.'
  : alert.sourceType === 'FORECAST'
    ? `Franchissement anticipé…`
    : 'Franchissement constaté sur mesure.'}
```

Ce code est juste pour les trois sources connues et **muet pour toute autre
valeur**. Une source ajoutée au moteur n'aurait produit aucune erreur : l'écran
n'aurait rien dit de l'origine de l'alerte — alors que c'est précisément cette
origine qui décide de l'action. Une mesure hors seuil, une prévision et un
capteur muet n'appellent pas la même réponse.

Deux défauts voisins trouvés au passage :

1. **`alertApi.list` annonçait un filtre `severity` que l'API ne connaît pas.**
   `listAlertsQuery` accepte `plotId`, `recommendationId`, `sourceType`,
   `status`, `open` — pas `severity`. Un filtre annoncé qui ne fait rien est
   pire qu'un filtre absent : l'utilisateur croit avoir réduit sa liste.
   **Corrigé sur les deux clients.**
2. **Le détail ne portait pas la plage.** L'alerte ne stocke que le seuil
   franchi (`referenceValue`), pas la plage dont il dérive. Sans la plage, un
   écran peut dire « seuil 6,8 franchi », pas « pH 7,4 pour une plage
   5,5 – 6,8 » — et donc pas si la valeur est un peu ou très hors bornes.

---

## 3. Ce qui a été fait

### 3.1 Les libellés passent par l'API

`backend/src/modules/alerts/alertLabels.js` (nouveau) :

| Export | Rôle |
| --- | --- |
| `SOURCE_TYPE_LABELS` | `MEASUREMENT → « Mesure »`, `FORECAST → « Prévision »`, `SENSOR_SILENCE → « Capteur silencieux »` |
| `SEVERITY_LABELS` | `INFO → « Information »`, `WARNING → « Avertissement »`, `CRITICAL → « Critique »` |
| `STATUS_LABELS` | `NEW → « Nouvelle »`, `READ → « Lue »`, `HANDLED → « Traitée »` |
| `parameterLabel()` | **réutilise `RANGE_LABELS`** déjà exporté de `agronomicRanges.js` |
| `parameterUnit()` | unité, `h` pour `sensorSilence` |
| `formatRange()` | `« 5.5 – 6.8 pH »`, `« ≥ 12 % »`, ou **`null`** si inconnue |
| `describeAlert()` | enrichissement **additif** |
| `describeAlertFilters()` | valeurs de filtre **avec leur libellé** |

Deux points de conception :

- **`parameterLabel` ne recopie pas `RANGE_LABELS`** : une seconde table
  divergerait de celle que l'agriculteur voit sur l'écran de recommandations, et
  la même grandeur aurait deux noms.
- **Une valeur d'enum inconnue retombe sur le code**, pas sur `undefined`. Si un
  jour `DRONE` arrive sans libellé, l'écran affichera `DRONE` — laid mais
  honnête, alors que `undefined` masquerait l'information.

`describeAlert` est **additif** : tous les champs d'origine sont conservés,
rien n'est renommé. Un appelant existant qui lit `alert.status` continue de
fonctionner. Un test le vérifie champ par champ.

### 3.2 Branchement dans le service

Les **quatre** sorties d'alertes passent désormais par `describeAlert` :
`list`, `get`, `markRead`, `markHandled`.

- **`list` ne joint pas la plage** : cela ferait N+1 requêtes (une
  recommandation par alerte) pour un écran de liste. La liste porte déjà le
  seuil franchi.
- **`get` joint la plage** depuis `CropRecommendation.thresholds[parameter]` de
  la recommandation liée — **pas un recalcul**. Afficher une plage différente de
  celle qui a déclenché l'alerte serait trompeur.
- `range` vaut **`null`** quand la recommandation ne porte pas de seuil pour
  cette grandeur. C'est une information, pas un échec.
- `range.status` conserve `PROVISIONAL` / `VALIDATED` : **une alerte fondée sur
  une plage provisoire doit pouvoir le dire.** Tant que le formulaire agronome
  n'est pas rempli, aucune plage n'est validée, donc toutes les alertes affichent
  « provisoire ».

### 3.3 Nouvelle route `GET /alerts/meta`

Un écran qui construit ses filtres a besoin de **nommer** les valeurs de l'enum.
Sans cette route il devrait recopier `MEASUREMENT → « Mesure »` — exactement le
défaut qu'on vient de supprimer. La réponse :

```json
{ "sourceTypes": [{"value":"MEASUREMENT","label":"Mesure"}, …],
  "severities": […], "statuses": […] }
```

⚠ **Déclarée avant `/:id`.** Express teste les routes dans l'ordre : placée
après, `/alerts/meta` serait avalée par `/alerts/:id` avec `id = 'meta'` et
renverrait 404. Un test structurel vérifie cet ordre de déclaration.

### 3.4 Les écrans

| Fichier | Rôle |
| --- | --- |
| `apps/web/src/pages/farmer/Alerts.tsx` | **nouveau** — boîte d'alertes web |
| `apps/Mobile/src/app/farmer/alerts.tsx` | **nouveau** — miroir mobile |
| `apps/web/src/pages/farmer/index.tsx` | compteur « Alertes non traitées » + module |
| `apps/Mobile/src/app/farmer/index.tsx` | action rapide avec le compteur |
| `apps/web/src/pages/farmer/Plots/Sensors.tsx` | libellés de l'API au lieu des codes |
| `apps/Mobile/src/app/farmer/plots/[id]/sensors.tsx` | idem |
| `apps/web/src/App.tsx` | route `/farmer/alerts` |

Filtres : **état** (Toutes / Non traitées / Nouvelle / Lue / Traitée) et
**source** (Toutes / Mesure / Prévision / Capteur silencieux). Les options
viennent de `/alerts/meta`.

**Un seul sélecteur d'état, délibérément.** `open` et `status` sont exclusifs
côté API (`listAlertsQuery` renvoie 422 sinon). Deux sélecteurs laisseraient
croire que les deux filtres s'appliquent alors que l'un est rejeté. « Non
traitées » n'est pas un quatrième statut : c'est `open=true`, qui couvre NEW et
READ.

Chaque carte affiche : la grandeur nommée, la gravité et le statut nommés, la
source, **la valeur observée face au seuil**, **la plage de référence** avec son
statut provisoire/validé, l'écart au seuil, les canaux déjà utilisés, et les
actions.

### 3.5 Types étendus

`DescribedAlert extends ThresholdAlert` (additif) + `AlertRange` +
`AlertFilterMeta` + `AlertFilterOption`, sur les deux clients. `AlertList.items`
est désormais `DescribedAlert[]`.

`range` est typé **`AlertRange | null`**, pas `AlertRange` : un type qui masque
l'absence ferait afficher « undefined » au lieu de « non disponible ». C'est la
même famille que le défaut de l'écran 2 (`notEvaluated` déclaré `string[]` alors
que l'API renvoyait des objets — ça compilait, et l'écran affichait
`[object Object]`).

---

## 4. Tests

`backend/tests/alertLabels.test.mjs` — **15 tests**, deux volets :

**Comportemental (9)** — les fonctions pures sont réellement exécutées :
libellés distincts et non vides ; repli sur le code pour un enum inconnu ;
`parameterLabel` identique à `RANGE_LABELS` pour chaque clé ; `formatRange` sur
cinq formes dont `null` ; enrichissement additif vérifié champ par champ ;
`range === null` sans plage ; `predictive` distingue une prévision d'une mesure
absente ; `describeAlertFilters` gelé.

**Structurel (6)** — le source des **quatre** surfaces d'affichage est lu
(commentaires retirés) :

1. aucun libellé recopié (table `CODE: 'libellé'`, ternaire code → français,
   table importée dans le client) ;
2. aucun code d'enum affiché tel quel (`{alert.severity}`…) ;
3. les cinq champs de libellé sont lus sur les deux clients, et les deux boîtes
   d'alertes lisent `range`, `observedLabel` et distinguent `PROVISIONAL` ;
4. `open` et `status` ne sont jamais envoyés ensemble ;
5. types client : `DescribedAlert`, `range: AlertRange | null`, plus de filtre
   `severity`, `/alerts/meta` appelé ;
6. les quatre sorties du service passent par `describeAlert` **et** `/meta` est
   déclarée avant `/:id`.

### Contre-épreuve

Chaque garde-fou a été **cassé volontairement**, le test exécuté, puis le fichier
restauré (identité vérifiée par `diff`) :

| Défaut réintroduit | Le test répond |
| --- | --- |
| ternaire `SENSOR_SILENCE → « Capteur silencieux »` (web) | `ternaire source vers français` |
| `label={alert.severity}` (mobile) | `affiche alert.severity brut` + `pastille label={alert.severity}` + champ manquant `severityLabel` |
| `severity?: AlertSeverity` dans `alertApi` (web) | échec du test types client |
| `/meta` déclaré après `/:id` | échec du test d'ordre de déclaration |

Restauré : **15/15**.

**Une exclusion assumée, documentée dans le test** : les **cartes de tons**
(`{ WARNING: 'warning' }`, `status === 'HANDLED' ? 'paper' : 'white'`) ne sont
pas des libellés mais de la mise en forme. Le motif les exclut en exigeant que la
valeur mappée soit l'un des jetons de thème des deux clients — un libellé
français (« Avertissement ») n'est jamais dans ce vocabulaire fermé. Les motifs
ont d'abord produit trois faux positifs sur ces cartes ; ils ont été précisés,
pas assouplis.

### Recettes de bout en bout

`tests/e2e/alerts.e2e.test.mjs` passe de 13 à **17 tests** :

- la liste porte les libellés, **cohérents avec les codes** (un libellé
  décoratif qui dirait autre chose que le code serait pire qu'un code brut) ;
- le détail porte la plage, et **son statut est `PROVISIONAL`** — si une plage
  est un jour validée, cette assertion échouera : c'est le signal attendu ;
- marquer lue puis traitée renvoie l'alerte enrichie ;
- `/alerts/meta` expose les valeurs avec leurs libellés.

Un premier essai utilisait le jeton agronome pour clôturer une alerte et a
échoué en **404** : l'agronome est dans une **autre organisation**, et `findOwned`
renvoie 404 — c'est l'isolation tenant qui fonctionne, pas un défaut. Le test
utilise le jeton de l'agriculteur et le dit dans un commentaire.

---

## 5. Comptes

| | |
| --- | --- |
| `npm test` (tout) | **1064 / 1064** |
| e2e seuls (`node --test tests/e2e/`) | **224 / 224** |
| **unitaires purs** | **840 / 840** |

**840 unitaires purs + 224 e2e = 1064.** (`npm test` globbe `tests/`, donc il
inclut les e2e ; le compte e2e est mesuré séparément sur `tests/e2e/`.)
| `tsc` web | **0 erreur** |
| `tsc` mobile | **0 erreur** |
| OpenAPI | 304 chemins · 377 opérations · 45 tags |
| Contrat | 381 routes · 277 appels clients · **0 appel sans route** · 104 routes sans appel client |

Ajoutés à cette étape : **19 tests** (15 garde-fous + 4 e2e), de 1045 à 1064.

---

## 6. Ce qui n'a été vu à l'écran **par personne**

Les écrans web et mobile sont **vérifiés par compilation uniquement**. Aucun
navigateur ni simulateur ne les a pilotés. Concrètement, personne n'a vu :

- le rendu réel des cartes d'alerte, ni leur **alignement et retour à la ligne
  sur petit écran** ;
- le **comportement des filtres** en interaction réelle (le passage d'un état à
  l'autre, la réinitialisation de la page) ;
- le **compteur d'alertes non traitées** sur les deux tableaux de bord ;
- la **lisibilité des pastilles** gravité/statut sur leurs fonds colorés — les
  contrastes sont **calculés**, pas mesurés à l'écran ;
- le rendu de la mention **« provisoire »** sur une plage ;
- le **vide** : l'état « Aucune alerte pour ce filtre » et son action ;
- la **pagination** avec plus de 20 alertes ;
- le retour visuel des boutons pendant la mutation ;
- le miroir mobile **en situation réelle** (Reanimated, défilement, gestes) ;
- l'accessibilité : les `accessibilityRole`/`accessibilityState` des filtres
  mobiles ne sont pas exercés par un lecteur d'écran.

Autres écarts connus, non liés à cet écran :

- **aucune plage agronomique n'est validée** — le formulaire agronome n'a pas été
  rempli. Toutes les alertes affichent donc « provisoire ». C'est conforme à la
  consigne, mais cela veut dire que **la branche « validée » n'a jamais été
  affichée** ;
- `demarrer-local.sh` n'a jamais été lancé de bout en bout (seul `--diagnostic` a
  tourné) ;
- le corps de l'e-mail n'est pas vérifiable ici (composé par le mailer GoTrue,
  hors dépôt) ;
- MFA avec une vraie application d'authentification non vérifié ;
- la course sur le quota n'est pas corrigée ;
- `client_max_body_size 2m` dans la configuration nginx documentée casserait le
  dépôt géospatial en production (plafond applicatif : 64 Mo).

---

## 7. Fichiers touchés

**Backend** — `src/modules/alerts/alertLabels.js` (nouveau) ·
`src/modules/alerts/alerts.service.js` · `src/modules/alerts/alerts.routes.js` ·
`src/docs/openapi.json` (régénéré) · `tests/alertLabels.test.mjs` (nouveau) ·
`tests/e2e/alerts.e2e.test.mjs` · `package.json` (quatre recettes e2e ajoutées à
la liste explicite de `test:e2e`).

**Web** — `src/pages/farmer/Alerts.tsx` (nouveau) · `src/pages/farmer/index.tsx` ·
`src/pages/farmer/Plots/Sensors.tsx` · `src/services/endpoints.ts` ·
`src/services/types.ts` · `src/services/query.ts` · `src/App.tsx`.

**Mobile** — `src/app/farmer/alerts.tsx` (nouveau) · `src/app/farmer/index.tsx` ·
`src/app/farmer/plots/[id]/sensors.tsx` · `src/services/api/endpoints.ts` ·
`src/services/api/types.ts` · `src/services/query.ts`.
