# Audit des points d'écriture — les 8 modèles géospatiaux

**Périmètre** : backend RDC uniquement. Date : 2026-10-22.

Un modèle sans point d'écriture est une table vide : le schéma promet une
capacité que le code ne fournit pas. Cet audit liste, pour chacun des 8 modèles
ajoutés pour la mission géospatiale, **le code qui l'écrit** et **celui qui le
lit**.

## 1. Méthode

Deux recherches, parce qu'une seule donne un résultat faux :

```bash
# Écritures — le client Prisma ET le client de transaction
grep -rnE "(prisma|tx)\.<modele>\.(create|createMany|update|updateMany|upsert|delete|deleteMany)" src

# Lectures
grep -rnE "prisma\.<modele>\.(find|count|aggregate|groupBy)" src
```

**Le piège** : chercher seulement `prisma.<modele>.update` donne **1** écriture
pour `CropRecommendation` et laisse croire que le statut d'une recommandation
n'est jamais modifié. En réalité `decideRecommendation` opère dans une
transaction et passe par `tx.cropRecommendation.update` (ligne 863). Toute
recherche d'écritures qui ignore le client de transaction sous-estime le
résultat.

**La recherche doit porter sur le fichier entier, pas ligne par ligne.** Un appel
Prisma s'écrit couramment sur plusieurs lignes :

```js
await prisma
  .sensorAnomaly
  .upsert({ … });
```

Un `grep -n` ligne par ligne ne le voit pas. `scripts/check-model-writes.mjs` a
été corrigé sur ce point : il rapportait 1 écriture pour `SensorAnomaly` au lieu
de 2. Un audit qui sous-estime est pire qu'aucun audit — il donne une fausse
assurance.

## 2. Résultat

| Modèle | Écritures | Lectures | Fichiers |
| --- | --- | --- | --- |
| `CropRecommendation` | **3** | 4 | `recommendation.service.js` · `alerts.service.js` |
| `ThresholdAlert` | **7** | 6 | `alerts.service.js` |
| `SoilPrediction` | **1** | 3 | `forecast.service.js` · `alerts` · `recommendation` |
| `InterpolatedMap` | **1** | 2 | `interpolation.service.js` |
| `AiModelVersion` | **4** | 4 | `modelVersions.service.js` · `forecast` · `interpolation` |
| `SensorAnomaly` | **2** | 5 | `anomalies.service.js` |
| `SeasonFeedback` | **3** | **7** | `src/modules/seasons/seasons.service.js` |
| `GeospatialImport` | **0** | **0** | — |

### Détail des six modèles vivants

| Modèle | Emplacements exacts |
| --- | --- |
| `CropRecommendation` | `create` `recommendation.service.js:707` · `updateMany` `:852` (ancienne recommandation → `SUPERSEDED`) · `update` `:863` (décision de l'agriculteur) |
| `ThresholdAlert` | `create` `alerts.service.js:438` · `update` `:391`, `:423`, `:485`, `:686`, `:865`, `:876` |
| `SoilPrediction` | `create` `forecast.service.js:146` — rien d'écrit quand la prévision est insuffisante |
| `InterpolatedMap` | `create` `interpolation.service.js:175` — rien d'écrit sans support spatial réel |
| `AiModelVersion` | `create` `modelVersions.service.js:110` · `updateMany` `:178` (précédent → `RETIRED`) · `update` `:187` et `:211` |
| `SensorAnomaly` | `upsert` `anomalies.service.js:210` (détection) et `:419` (revue par l'agronome) |

## 3. Les modèles qui restaient sans point d'écriture

`SensorAnomaly` a été câblée — voir §3.1. Les deux autres n'existent toujours que
comme modèles Prisma et comme tables.

### 3.1 `SensorAnomaly` — ✅ traitée

Câblée par l'étape « anomalies de mesure » : détection persistée, exclusion du
calcul, revue par un agronome, dédoublonnage par épisode, job planifié.

| Élément | État |
| --- | --- |
| Calcul | ✅ `geoai/sensors.py` (écart médian absolu, valeur collée, trous) |
| Persistance | ✅ `upsert` `anomalies.service.js:210` |
| Détection planifiée | ✅ job `sensors.detectAnomalies` (6 h) |
| Revue par un agronome | ✅ `POST /anomalies/:id/review` — `upsert` `:419` |
| Exclusion du calcul | ✅ état du sol, carte interpolée, prévision |
| Taux de fausse alerte | ✅ mesurés sur séries synthétiques |

Détail, contrats et réserves : `docs/GEOSPATIAL.md` §14.

### 3.2 `SeasonFeedback` — rendement réel constaté

Champs : `actualYieldKg`, `areaHa`, `season`, `year`, lien vers
`CropRecommendation`.

C'est la **vérité terrain** qui manque à la boucle d'apprentissage : sans
rendement constaté, aucune comparaison entre le moteur de règles et un modèle
appris n'est possible, et `AiModelVersion.beatsBaseline` ne peut porter que sur
des métriques statistiques (MAE, F1), jamais sur le résultat agricole.

> **Résolu.** Le module `src/modules/seasons/` écrit désormais ce rendement
> (3 points d'écriture : création, correction, archivage logique), avec ses
> routes `/seasons`, ses validations et ses tests. Le modèle a quitté la liste
> `ACCEPTED_WITHOUT_WRITE` de `scripts/check-model-writes.mjs` — ce contrôle
> refuse une exception devenue obsolète, ce qui est précisément ce qu'il doit
> faire.
>
> Ce qui reste vrai : **le rapprochement avec la recommandation ne produit aucun
> verdict.** Le score mesure une adéquation, pas un rendement attendu, donc un
> rendement faible sur une culture bien classée n'invalide rien. Voir
> `compareWithRecommendation` dans `src/modules/seasons/seasons.service.js`.

### 3.3 `GeospatialImport` — dépôt asynchrone de fichiers

Champs : `kind` (`GPR`, `DRONE_IMAGE`, `SATELLITE`, `LAB_FILE`), `status`
(`RECEIVED` → `PROCESSING` → `COMPLETED` / `ERROR`), `storageKey`, `checksum`,
`errorMessage`, `result`.

**Le backend n'a aucune capacité de dépôt de fichier** : ni `multer`, ni gestion
`multipart`, ni bibliothèque de lecture géospatiale dans `package.json`.

À ne pas confondre avec `POST /geodata/drones`, qui existe et écrit dans
`DroneSurvey` : c'est une **déclaration de relevé** par un opérateur, pas un
fichier traité.

C'est l'écart le plus lourd, parce que le GPR est l'une des deux seules sources
de vérité **sous-sol** avec les sondes — le cœur de l'objectif produit.

## 4. Pourquoi les contrôles automatiques ne le signalent pas

`npm run verify` est vert, y compris `check-cdc`. Ce script vérifie que chaque
famille du CDC a **un module, des routes, une permission et une preuve de test**.
Ces trois modèles n'étant rattachés à aucune famille exigeant un modèle précis,
rien ne les réclame. Un modèle Prisma orphelin est invisible pour tous les
contrôles existants.

## 5. Prochaine étape proposée

**Câbler `SensorAnomaly`** — détection planifiée, persistance, revue.

Pourquoi celle-là plutôt que les deux autres :

| Critère | `SensorAnomaly` | `GeospatialImport` | `SeasonFeedback` |
| --- | --- | --- | --- |
| Calcul déjà écrit et testé | ✅ `geoai/sensors.py` | ❌ à écrire | ❌ (saisie) |
| Wrapper Node déjà présent | ✅ `sensorQuality` | ❌ | ❌ |
| Nouvelle dépendance | aucune | `multer` + stockage | aucune |
| Protège la qualité des recommandations **dès maintenant** | ✅ | plus tard | à la récolte |
| Exigence de test du CDC déjà formulée | ✅ taux de fausse alerte | non | non |

Le travail restant est du **câblage**, pas de la modélisation : le moteur sait
déjà distinguer une valeur aberrante d'une valeur collée, et la route existe.

Contenu proposé de l'étape :

1. `src/modules/anomalies/anomalies.{service,schema,routes}.js` — détection par
   sonde, écriture de `SensorAnomaly`, dédoublonnage par épisode comme pour
   `ThresholdAlert`.
2. Job `sensors.detectAnomalies` dans `src/jobs/index.js`.
3. Routes de lecture et de revue (`anomaly.read`, `anomaly.review`).
4. **Ne pas double-employer** : une anomalie de silence de capteur reste dans
   `ThresholdAlert` (décision déjà prise), `SensorAnomaly` couvre les valeurs
   aberrantes et collées.
5. Tests : taux de fausse alerte mesuré sur des séries synthétiques, et cas réel
   de bout en bout.
6. Migration si des champs manquent, OpenAPI, documentation.
