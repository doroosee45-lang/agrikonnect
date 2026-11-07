# Retours de saison — rendement réellement obtenu

**Module :** `src/modules/seasons/` · **Routes :** `/api/v1/seasons*` ·
**Tests :** `tests/seasons.test.mjs` (unitaires) · `tests/e2e/seasons.e2e.test.mjs` (e2e)

Ce module enregistre le rendement **réellement obtenu** par un agriculteur, par opposition au
rendement **recommandé** par le moteur agronomique. Les deux sont volontairement séparés : le
rapprochement se fait à la lecture (`/seasons/:id/compare`), jamais par écrasement.

---

## 1. Le rendement par hectare n'est pas stocké

`yieldPerHa` est **calculé à la lecture**, pas écrit en base :

```js
export const yieldPerHectare = (actualYieldKg, areaHa) => { … }
```

Deux raisons :

1. Une valeur stockée devient fausse dès qu'une correction modifie les kilos ou la surface, et
   rien ne garantit que les deux bougent ensemble.
2. **Sans surface, un rendement à l'hectare n'existe pas.** Le calcul renvoie `null`, jamais une
   estimation. Diviser par une surface par défaut produirait un chiffre faux mais plausible —
   exactement le travers que ce module doit éviter.

---

## 2. `stats` : les kilos sans surface sont séparés

`GET /api/v1/seasons/stats?groupBy=crop|plot|season|year`

### La règle

**`totalYieldKg` ne couvre que les retours qui portent une surface.** Les kilos des retours
**sans** surface vont dans **`yieldKgWithoutArea`**.

C'est la conséquence directe de la règle précédente : si un rendement à l'hectare n'existe pas
sans surface, alors additionner ces kilos au numérateur d'un rendement **sans pouvoir rien
ajouter au dénominateur** produirait un chiffre gonflé. Les deux totaux sont donc séparés, au
niveau de chaque groupe **et** au niveau racine.

### Les champs

| Champ | Niveau | Sens |
| -- | -- | -- |
| `feedbackCount` | groupe | Nombre de retours du groupe, **tous** compris. |
| `totalYieldKg` | groupe | Somme des kilos **des retours avec surface**. C'est le numérateur de `yieldPerHa`. |
| `totalAreaHa` | groupe | Somme des surfaces, en hectares. |
| `yieldPerHa` | groupe | `totalYieldKg / totalAreaHa`, arrondi à 2 décimales. **`null` si aucune surface n'est connue** — jamais estimé. |
| `withoutArea` | groupe | Nombre de retours **sans** surface dans le groupe. |
| `yieldKgWithoutArea` | groupe | Somme des kilos de ces retours sans surface. Réels, mais exclus de tout rendement. |
| `feedbackCount` | racine | Nombre total de retours de la requête. |
| `withoutAreaCount` | racine | Nombre total de retours sans surface. |
| `yieldKgWithoutArea` | racine | Somme totale des kilos sans surface. |

### Pourquoi `yieldKgWithoutArea` existe plutôt que de simplement ignorer ces kilos

Ces kilos sont **réels** : un agriculteur a déclaré une récolte. Les jeter ferait perdre une
information vraie. Les mélanger au rendement produirait un chiffre faux. Les compter à part est
la seule option qui ne ment dans aucun des deux sens.

Un écran qui affiche un rendement doit donc afficher aussi la couverture : « 1 800 kg/ha sur
2 retours sur 3 » n'est pas la même information que « 1 800 kg/ha ».

### Cas chiffré de référence

Trois retours dans un même groupe :

| Retour | Kilos | Surface | |
| -- | -- | -- | -- |
| 1 | 3 000 | 2,0 ha | avec surface |
| 2 | 1 500 | 0,5 ha | avec surface |
| 3 | 9 000 | — | sans surface |

| Champ | Valeur | Calcul |
| -- | -- | -- |
| `feedbackCount` | 3 | les trois retours comptent |
| `totalAreaHa` | 2,5 | 2,0 + 0,5 |
| `totalYieldKg` | **4 500** | 3 000 + 1 500 — **les 9 000 n'y sont pas** |
| `yieldPerHa` | **1 800,00** | 4 500 / 2,5 |
| `withoutArea` | 1 | |
| `yieldKgWithoutArea` | **9 000** | |

Ce cas est un test exécutable : `tests/e2e/seasons.e2e.test.mjs`, *« les kilos sans surface sont
exclus du rendement par hectare (cas chiffré) »*. Il porte aussi un `assert.notEqual(yieldPerHa,
5400)` : **5 400 est la valeur que produisait le défaut corrigé** (`13 500 / 2,5`), donc une
régression échoue sur cette ligne précise.

### Comment déclarer un retour sans surface

En **omettant** `areaHa`, pas en passant `null`. Le schéma fait :

```js
areaHa: z.coerce.number().positive('Surface positive requise').max(1e6).optional(),
```

`z.coerce.number()` convertit `null` en `0`, qui échoue ensuite à `.positive()` : la requête est
refusée en **422**. C'est l'omission qui produit une ligne sans surface, avec `areaHa = null` en
base.

---

## 3. Ce que le module refuse

| Refus | Pourquoi |
| -- | -- |
| Source `satellite`, `estimated`, `derived` à l'écriture | Le module enregistre une **déclaration**. Une valeur calculée n'est pas un retour d'expérience. |
| Rattachement à une recommandation d'**une autre parcelle** | Le rapprochement comparerait deux choses sans rapport. |
| Accès à un retour d'une autre organisation | **404**, pas 403 : on ne révèle pas l'existence de la ligne. |
| `areaHa` négatif, nul ou `null` explicite | 422 « Surface positive requise ». |

---

## 4. Rapprochement avec la recommandation

`GET /api/v1/seasons/:id/compare` rend l'écart entre le rendement déclaré et le rendement
recommandé, **sans verdict**. Le module ne dit pas si l'écart est bon ou mauvais : c'est une
lecture, pas un jugement. Un écart peut venir du climat, du sol, de la date de semis — rien dans
cette ligne ne permet de trancher.

---

## 5. Couverture de test

| Niveau | Fichier | Ce qui est couvert |
| -- | -- | -- |
| Unitaires | `tests/seasons.test.mjs` | calcul du rendement, `null` sans surface, refus de source calculée, validations |
| e2e | `tests/e2e/seasons.e2e.test.mjs` | écriture en base PostgreSQL réelle, isolation par organisation (404), rattachement refusé, **cas chiffré du §2**, versionnage des corrections |
| Contrat | `tests/openapiNotes.test.mjs` | la note sémantique de `/seasons/stats` est bien dans `openapi.json` |

### Ce qui n'est pas vérifié

- **Aucun écran n'est piloté.** La saisie du rendement est testée par l'API uniquement. Les
  écrans web et mobile sont vérifiés **par compilation**, pas par rendu.
- **Le regroupement par année n'a pas de cas chiffré dédié.** Seul `groupBy=plot` en a un ; les
  autres partagent le même code d'agrégation, mais ne sont pas couverts par un cas exact.
