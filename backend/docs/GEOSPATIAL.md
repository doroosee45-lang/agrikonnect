# Géospatial & pédologie — architecture et règles

Ce document décrit la partie **intelligence du sol** du backend : comment les
données de terrain, de capteurs, de satellite, de drone et de caméra sont
transformées en un diagnostic traçable, et pourquoi le calcul est fait en Python.

---

## 1. Pourquoi deux langages

| Besoin | Où | Pourquoi |
|---|---|---|
| Données, droits, audit, API | **Node/Express + Prisma** | Le backend est seul propriétaire des données et applique les 4 couches d'autorisation (CDC A.2) |
| Calcul matriciel, indices spectraux, statistiques robustes | **Python (`geoai/`)** | numpy/scipy/Pillow : un indice NDVI sur 10⁶ pixels ou une régression log‑linéaire de la matière organique n'ont pas leur place en JavaScript |

Le moteur Python **ne lit pas la base** et **ne connaît aucun utilisateur** : il
reçoit un JSON, renvoie un résultat. Le backend lui transmet uniquement les
données de la parcelle demandée, après vérification du tenant.

```
Client ──HTTP──▶ API Node ──(Prisma)──▶ PostgreSQL/Supabase
                    │
                    └──HTTP interne──▶ geoai (Python) ──▶ diagnostic JSON
                                          │
                    API Node ◀────────────┘
                    │
                    └──▶ soil_diagnostics (append-only) + audit
```

---

## 2. Chaîne de traitement

1. **Collecte** (`geospatial.service.js`)
   - analyses de sol (`soil_assessments` + `soil_parameters`) ;
   - mesures des capteurs de la parcelle (`iot_devices` → `sensor_readings`) ;
   - observations satellite (`satellite_observations`, série NDVI) ;
   - scènes brutes, imagerie et valeurs déclarées fournies dans la requête.
2. **Normalisation** : les paramètres sont convertis en prélèvements
   (`{depthCm, sand, silt, clay, ph, organicMatter, ec, moisture, source, measuredAt}`).
   Une classe de texture déclarée est convertie en granulométrie **représentative**
   et marquée `declared` — ce n'est jamais présenté comme une mesure.
3. **Calcul Python** (`engine.analyze_plot`) : sol → sous‑sol → satellite →
   capteurs → imagerie → fusion.
4. **Persistance** : le résultat est stocké tel quel avec la **version du moteur**
   et la **version de méthode** ; un diagnostic passé reste auditable même
   après évolution des algorithmes.
5. **Audit** : action `soil.diagnostic.compute` avec parcelle, versions,
   confiance et sources utilisées.

---

## 3. Règles de provenance et de priorité (CDC §6.5)

Ordre imposé : **laboratoire > capteur > satellite > drone > caméra > déclaré**.

- Une valeur retenue porte `source`, `measuredAt`, `confidence`, un `interval`
  et la liste de ses **alternatives** (avec leur poids).
- Deux sources qui divergent au‑delà d'une tolérance par paramètre produisent un
  **conflit explicite** (`conflicts[]`) : on ne moyenne pas en silence, la source
  prioritaire est retenue et l'écart reste affiché.
- Pour les grandeurs **dynamiques** (humidité, EC, température), la fraîcheur
  peut primer : une analyse de laboratoire de 4 ans ne bat pas une sonde du jour.
  La source déclassée apparaît dans `alternatives[]` avec `demoted: true`.
- Les grandeurs **stationnaires** (texture, pH, matière organique) ne vieillissent
  pas : la source la plus fiable reste prioritaire.

---

## 4. Ce que le moteur refuse de faire

| Situation | Réponse |
|---|---|
| Aucune donnée sur la parcelle | `422` — « Aucune donnée exploitable… ne remplit jamais un vide » |
| Roche non atteinte | `depthToBedrock.valueCm = null`, `confident: false`, `searchedDepthCm` |
| Moins de 4 points NDVI | phénologie `available: false` + raison |
| Bande spectrale absente | indice `available: false` + raison |
| Série de capteur < 4 points | dérive non estimée (pas d'extrapolation) |
| Moteur Python indisponible | `503` avec la marche à suivre — **jamais** un diagnostic de substitution |
| Demande de recommandation sans jeu de règles validé | `recommendations: []` + avertissement |

Chaque diagnostic renvoie :

```json
{
  "disclaimer": "Diagnostic indicatif… ne constitue pas une certification.",
  "confidence": { "score": 0.78, "level": "élevée", "missing": [] },
  "caveats": ["…"]
}
```

---

## 5. Contrat d'API exposé par le backend

| Méthode | Chemin | Permission | Rôle |
|---|---|---|---|
| POST | `/plots/:plotId/soil-diagnosis` | `geospatial.write` | Calcule et conserve un diagnostic |
| GET | `/plots/:plotId/soil-diagnosis` | `geospatial.read` | Historique (id, versions, confiance, sources) |
| GET | `/plots/:plotId/soil-diagnosis/latest` | `geospatial.read` | Dernier diagnostic complet |
| GET | `/geospatial/soil-diagnostics/:id` | `geospatial.read` | Diagnostic par identifiant |
| GET | `/geospatial/health` | `geospatial.read` | Disponibilité du moteur + version de méthode |
| GET | `/geospatial/methods` | `geospatial.read` | Seuils et méthodes (`/v1/meta` du moteur) |
| POST | `/geospatial/texture` | `geospatial.read` | Texture USDA à la demande |
| POST | `/geospatial/spectral` | `geospatial.write` | Indices d'une scène fournie |
| POST | `/geospatial/imagery` | `geospatial.write` | Photo de parcelle ou produit drone |
| POST | `/geospatial/sensors/quality` | `geospatial.write` | Contrôle qualité d'une série |
| POST | `/geospatial/fusion` | `geospatial.write` | Fusion d'observations multi‑sources |

Exemple minimal :

```bash
curl -X POST http://localhost:4000/api/v1/plots/$PLOT/soil-diagnosis \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"slopePct": 9, "rainfallMm": 1250,
       "imagery": {"camera": {"base64": "…"}},
       "declared": {"ph": 6.1}}'
```

---

## 6. Exploitation

| Variable | Défaut | Rôle |
|---|---|---|
| `GEOAI_URL` | `http://127.0.0.1:8100` | URL du moteur (réseau privé) |
| `GEOAI_TIMEOUT_MS` | `20000` | Délai maximal par appel |
| `GEOAI_TOKEN` | — | Jeton partagé (en‑tête `X-GeoAI-Token`) |
| `GEOAI_RETRIES` | `1` | Reprises sur erreur réseau (jamais sur `422`) |

Le moteur est sans état : il peut être répliqué derrière un load balancer. Sa
sonde `GET /health` est relayée par `GET /geospatial/health` pour la supervision.

---

## 7. Preuves

- **70 tests Python** : `python3 -m unittest discover -s geoai/tests -t .`
  (texture USDA sur 11 points de référence, horizons, dérive/aberration capteur,
  indices spectraux, phénologie, imagerie, fusion, HTTP, orchestrateur).
- **9 tests Node** : `npm test` — contrat du client (422/500/503), mapping des
  analyses, persistance + audit, isolation tenant, et **bout en bout avec le vrai
  moteur Python** (texture réellement calculée, horizons segmentés, NDVI ≈ 0,60).

---

## 8. Référentiel agronomique : gouvernance des plages

Le moteur de recommandation compare l'état du sol à des **plages favorables par
culture** (pH, humidité, conductivité électrique, profondeur racinaire,
température de l'air). Ces plages ne sont **pas codées dans le moteur** : elles
vivent en base, dans `crop_agronomic_ranges`.

### 8.1 Pourquoi la base et non le code

Une fourchette saisie « de mémoire » dans un fichier source n'a ni source
citable ni validateur, et elle survit silencieusement à tout changement de
référentiel. En base, chaque plage porte sa provenance, son statut, et — une
fois validée — le nom de l'agronome et la date.

### 8.2 Règles d'écriture

| Règle | Effet |
|---|---|
| Aucune provenance | Création refusée (`422`). Une plage exige `sourceReference` **ou** `sourceNote`. |
| Borne hors limites physiques | Refusée (`422`) : un pH à 42 est un import corrompu, pas une donnée. |
| Unité incohérente | Refusée (`422`) : l'unité attendue est imposée par paramètre. |
| Bornes inversées | Refusées (`422`). |
| Statut `VALIDATED` sans validateur | Refusé (`422`) : « validée » sans nom ne voudrait rien dire. |
| Validation sans source citable | Refusée (`409`). |
| Modification d'une plage validée | La validation est **annulée** : elle portait sur les anciennes bornes. |
| Paramètre d'une plage | Ne se modifie pas : on crée une plage et on retire l'ancienne. |
| Ligne importée | Arrive toujours en `PROVISIONAL`, **même si le fichier annonce `VALIDATED`** : un fichier est une saisie, pas une validation. Le validateur annoncé est conservé en note. |
| Ligne sans valeurs idéales | Ignorée et comptée à part (`skippedEmpty`), jamais traitée comme une erreur. |

Les bornes physiques sont dans `PHYSICAL_BOUNDS`
(`src/modules/recommendation/agronomicRanges.js`) et valent pour **tout**
appelant — route HTTP comme import CSV — parce qu'elles sont vérifiées dans le
service, pas dans le schéma de route.

> Le format d'import (15 colonnes du tableau « Plages agronomiques »), les
> libellés de paramètre acceptés, la canonicalisation de la zone et le détail
> des résultats ligne à ligne sont décrits dans **`docs/AGRONOMIC-RANGES.md`**.
> Il n'existe plus de script d'import dédié : l'import passe par
> `POST /agronomic-ranges/import`.

### 8.3 Clés de paramètre : le vocabulaire existant, pas un vocabulaire inventé

`RANGE_KEYS` reprend les clés de `SOIL_PARAMETER_KEYS`
(`src/modules/soil/soil.schema.js`), que `fuseProfile()` conserve telles
quelles :

| `RANGE_KEYS` | Clé réelle | Unité | Remarque |
|---|---|---|---|
| `PH` | `ph` | pH | |
| `SOIL_MOISTURE` | `moisture` | % | sonde d'abord, puis Sentinel-1 |
| `SALINITY` | `ec` | dS/m | **critère éliminatoire** |
| `ROOT_DEPTH` | `depthCm` | cm | |
| `AIR_TEMPERATURE` | `airTemperatureC` | °C | métrique de **sonde**, pas d'analyse de sol |

Une clé inventée (par exemple `salinityDsm` au lieu de `ec`) produirait un
référentiel que le moteur ne saurait jamais rapprocher des mesures réelles :
les données existent en base, le critère remonte « non évalué », et tout semble
fonctionner. Un contrôle au chargement du module lève une exception si
`RANGE_KEYS` s'écarte du vocabulaire des analyses de sol.

`airTemperatureC` est la seule exception assumée : la température de l'**air**
vient de la station météo de l'exploitation (`SensorReading.metric`), jamais
d'une analyse pédologique.

#### Comportement à l'exécution

La distinction n'est pas seulement documentaire, elle est appliquée par le
moteur (`src/modules/recommendation/recommendation.service.js`) :

| Situation | Comportement du moteur |
|---|---|
| Une lecture `SensorReading.metric = 'airTemperatureC'` existe | le critère de température est évalué **contre cette température de l'air** |
| Seules des mesures de sol existent (`ph`, `ec`, `moisture`, `depthCm`) | le critère remonte `notEvaluated` avec `cause: 'NO_MEASUREMENT'` — **aucune température de sol n'est substituée** |
| Aucune station météo n'est déployée | la culture n'est pas pénalisée : le critère sort du dénominateur et figure sous « Non évalué » |

`buildSoilState` indexe l'état par `reading.metric` tel quel : il n'existe donc
aucun chemin par lequel une sonde enterrée pourrait satisfaire le critère
« température de l'air ». Réciproquement, aucune clé de température de sol
n'existe dans le système — la sonde `soil-temperature-ec-probe` ne déclare que
`ec` et `depthCm` (`src/config/hardware.js`, `sensorTypes`).

**Libellés et mise en garde.** L'explication destinée à l'agriculteur nomme les
grandeurs via `RANGE_LABELS` (« température de l'air », « pH du sol »…) et
n'expose jamais les clés techniques. Quand le critère air participe au
classement, la constante exportée `AIR_VS_SOIL_CAVEAT` est ajoutée au texte :
« La température évaluée est celle de l'air, relevée par la station météo : ce
n'est pas une température de sol, et les deux diffèrent de plusieurs degrés. »

**Aucune humidité volumique déduite d'un référentiel générique.** Un
référentiel climatique généraliste donne des **précipitations**, pas une
humidité du sol. Un cumul de pluie en millimètres n'est pas un pourcentage
d'humidité volumique : aucun rapprochement n'est fait, et le paramètre
`moisture` reste non évalué tant qu'aucune mesure réelle (sonde ou radar
Sentinel-1) ne l'alimente. Convertir l'un en l'autre serait une fabrication.

**Limite connue.** `IotDevice` ne porte pas encore de type de capteur : rien en
base n'interdit à un appareil d'écrire une métrique qui n'est pas la sienne.
L'interdiction est aujourd'hui portée par `sensorTypes` dans
`src/config/hardware.js` (déclaratif) et par l'appariement strict du moteur,
pas par une contrainte d'ingestion. Ajouter une colonne `sensorType` à
`IotDevice` puis valider chaque lecture contre `sensorTypeBySlug(...).metrics`
fermerait ce point ; cela demande une migration et n'a pas été fait.

### 8.4 Lots de référentiel

`AGRONOMIC_DATASET` (défaut `production`) désigne le lot que lit le moteur. Les
tests utilisent `test` : mêmes tables, mais un lot d'essai ne peut pas
influencer la production, et rien de tel n'entre dans `prisma/seed.js`.

### 8.5 Ce que cela change pour la sortie du moteur

- Une culture dont aucun critère n'est évaluable n'est **pas** classée : le
  statut est `INSUFFICIENT_DATA`, avec le motif.
- Un critère sans plage remonte en `notEvaluated` avec `cause: 'NO_REFERENCE'` ;
  une mesure manquante, avec `cause: 'NO_MEASUREMENT'`. La distinction dit si la
  lacune vient du référentiel ou de la parcelle.
- La couverture mesure les **mesures manquantes**, pas l'étendue du
  référentiel : sinon un référentiel partiel rendrait tout classement
  impossible, même sur une parcelle parfaitement documentée.
- Le classement exige `coverage ≥ 0,6` **et** au moins 2 critères évalués.
- Tant que le calendrier ou une plage utilisée est `PROVISIONAL`, la réponse
  porte `indicative: true` et `indicativeReasons` nomme la cause.

### 8.6 API

| Méthode | Route | Permission |
|---|---|---|
| `GET` | `/agronomic-ranges` | `ranges.read` |
| `GET` | `/agronomic-ranges/meta` | `ranges.read` |
| `GET` | `/agronomic-ranges/:id` | `ranges.read` |
| `POST` | `/agronomic-ranges` | `ranges.write` |
| `PATCH` | `/agronomic-ranges/:id` | `ranges.write` |
| `POST` | `/agronomic-ranges/:id/validate` | `ranges.validate` |
| `POST` | `/agronomic-ranges/:id/retire` | `ranges.write` |

Lecture large — le producteur doit pouvoir vérifier sur quelle base une
recommandation a été calculée. Écriture et validation réservées à l'agronome et
aux administrateurs : valider une plage fait sortir les recommandations du
régime « indicatif », c'est un acte engageant. Toute écriture est auditée.

### 8.7 Preuves

- **56 tests unitaires** (`tests/recommendation.test.mjs`) : calendriers,
  règles d'usage du référentiel, notation, satellite, CRUD et validation,
  cloisonnement par lot et par organisation.
- **7 tests de bout en bout sur base réelle**
  (`tests/e2e/agronomicRanges.e2e.test.mjs`) : plages écrites via l'API,
  refus sans provenance et hors bornes physiques, **classement réellement
  produit**, seuils dérivés, explication dont chaque chiffre provient des
  données, invisibilité du lot `production` pour le lot actif, audit des trois
  écritures.

## 9. Surveillance des recommandations (job d'alertes)

Une recommandation n'est pas un verdict : les conditions changent. Le job
`recommendations.monitor` (horaire) compare l'état réel de la parcelle aux seuils
que la recommandation porte, et agit.

### 9.1 Ce que le job fait, dans l'ordre

| Étape | Règle appliquée |
|---|---|
| 1. Balayage | Toutes les recommandations `ACTIVE`, tous tenants, 500 par passage |
| 2. Mesures | L'état du sol est reconstruit par **`buildSoilState`**, la même fonction que celle du calcul : seuils et observations proviennent donc de la même logique de fusion |
| 3. Prévisions | `SoilPrediction` par paramètre, **seulement si `beatsBaseline === true`** |
| 4. Alerte | Une ligne `threshold_alerts` par paramètre et par épisode |
| 5. Notification | Email obligatoire, SMS canal principal, in-app toujours |
| 6. Remplacement | Nouvelle proposition sur la période restante, statut `PENDING` |

### 9.2 Trois sources d'alerte, une seule boîte

`AlertSourceType` distingue l'origine, mais l'agriculteur n'a qu'une boîte :

- `MEASUREMENT` — une mesure réelle est sortie de la plage ;
- `FORECAST` — une prévision **prouvée** annonce un franchissement à venir
  (`predictive: true`, `predictedBreachAt` renseigné) ;
- `SENSOR_SILENCE` — un capteur n'a rien transmis depuis le seuil de silence.
  La « valeur de référence » est le seuil (24 h), l'observation le nombre
  d'heures de silence : la structure *observé vs référence* reste cohérente.

### 9.3 Anti-spam : épisode et re-notification

L'épisode est **la période de la recommandation suivie** : la clé
`paramètre:identifiant-de-recommandation` est unique par organisation
(`@@unique([organizationId, episodeKey])`). Un second franchissement du même
paramètre met à jour l'alerte existante au lieu d'en créer une seconde.

La re-notification est espacée de `ALERT_RENOTIFY_HOURS` (24 h par défaut,
**provisoire**) : tant que l'alerte reste ouverte, l'agriculteur est rappelé au
plus une fois par jour. `ALERT_RENOTIFY_HOURS=0` coupe la relance — l'alerte
reste visible dans l'application. Une alerte passée en `HANDLED` ne re-notifie
plus et n'est pas rouverte par le job.

### 9.4 Rien n'est remplacé sans acceptation

La proposition de remplacement est créée avec le statut **`PENDING`** :
l'ancienne recommandation reste `ACTIVE` tant que l'agriculteur n'a pas accepté.
C'est `POST /recommendations/:id/decision` qui tranche — et lui seul peut passer
l'ancienne en `SUPERSEDED`. Un refus laisse l'ancienne active et la proposition
`REJECTED` ; une décision ne se rejoue pas (409).

### 9.5 Garde-fous contre les fausses alertes

| Garde-fou | Effet |
|---|---|
| Borne `null` non testée | Une plage sans maximum ne déclenche jamais de dépassement inventé |
| `observed` nul écarté **avant** conversion | `Number(null)` vaut `0` : sans cette garde, une mesure absente déclenchait « en dessous du minimum » |
| `beatsBaseline === true` exigé | `null` (non évalué) et `false` (battue) interdisent tous deux l'alerte préventive |
| Seuil absent = critère absent | Un critère non évaluable ne produit aucun seuil, donc aucune comparaison possible |
| Prévision seule ne remplace rien | Elle avertit ; seul un franchissement **constaté** déclenche un recalcul |
| Données simulées étiquetées | Message préfixé `[SIMULÉ]`, et **aucun envoi en production** (`env.simulationAllowed`) |

### 9.6 API

Aucune route ne crée d'alerte : elles naissent du job. Une création manuelle
permettrait de fabriquer une alerte sans mesure derrière.

| Route | Permission | Rôle |
|---|---|---|
| `GET /alerts` | `alerts.read` | Boîte d'alertes, filtres `plotId`, `recommendationId`, `sourceType`, `status`, `open` |
| `GET /alerts/:id` | `alerts.read` | Détail, proposition de remplacement incluse |
| `POST /alerts/:id/read` | `alerts.read` | Marquage lu, idempotent |
| `POST /alerts/:id/handled` | `alerts.write` | Clôture de l'épisode : coupe la re-notification, audité |

`open` et `status` sont exclusifs (422 s'ils sont fournis ensemble) : le premier
sélectionne « tout sauf `HANDLED` », le second un statut précis.

Déclenchement manuel : `POST /admin/jobs/recommendations.monitor/run`.

### 9.7 Réglages

| Réglage | Où | Valeur |
|---|---|---|
| Délai de re-notification | `ALERT_RENOTIFY_HOURS` (`.env`) | 24 h — **provisoire** |
| Seuil de capteur silencieux | `hardware.maintenance.silentSensorThreshold.value` | 24 h |
| Canaux d'envoi | `hardware.sms` + `SMS_PROVIDER` | webhook en recette |

### 9.8 Preuves

- **24 tests unitaires** (`tests/alerts.test.mjs`) : comparaison aux seuils,
  bornes absentes, mesures non numériques, sévérité fondée sur le caractère
  éliminatoire, exploitation d'une prévision, clés d'épisode, délai de
  re-notification, période restante, rédaction des messages en français.
- **13 tests de bout en bout sur base réelle**
  (`tests/e2e/alerts.e2e.test.mjs`) : aucune alerte tant que les mesures
  restent conformes ; franchissement → alerte persistée, **SMS en français et
  email réellement capturés** par le récepteur du harnais ; second passage sans
  duplication ni renvoi ; prévision battue par la persistance ignorée puis
  exploitée une fois prouvée ; refus laissant l'ancienne active ; non-empilement
  des propositions ; acceptation passant l'ancienne en `SUPERSEDED` avec une
  seule active à la fois ; capteur muet dans la même table ; alerte traitée ne
  re-notifiant plus ; filtres et refus 422 ; isolement multi-tenant en 404 ;
  absence de toute route de création manuelle.


## 10. Prévision des paramètres du sol et gouvernance des modèles

Le volet préventif du job d'alertes (§9) compare les **prévisions** aux seuils de
chaque recommandation. Jusqu'à cette étape, la table `soil_predictions` restait
vide : le code était en place, mais aucune prévision n'était produite, donc
aucune alerte préventive ne pouvait se déclencher. Cette étape ferme la boucle.

### 10.1 Répartition Python / Node

Le calcul vit en Python, la donnée et la persistance en Node — la même
répartition que pour le diagnostic de sol.

| Rôle | Emplacement |
| --- | --- |
| Méthode, découpage, métriques | `geoai/forecast.py` (366 lignes, stdlib) |
| Lecture des mesures réelles, persistance, multi-tenant | `src/modules/forecast/forecast.service.js` |
| Décision de promotion d'un modèle | `src/modules/ai/modelVersions.service.js` |

### 10.2 La méthode, et sa référence

Une régression linéaire amortie, évaluée contre la **persistance** (prédire la
dernière valeur observée) sur un **découpage chronologique** : les 70 % les plus
anciens servent à l'ajustement, les 30 % les plus récents au test. Aucun tirage
aléatoire, aucune donnée future dans l'ajustement.

Seuils publiés par le moteur dans `GET /v1/meta` (`thresholds.forecast`) :

| Seuil | Valeur | Effet |
| --- | --- | --- |
| `minPoints` | 12 | moins de mesures → refus |
| `minSpanDays` | 7.0 | série trop courte en temps → refus |
| `testFraction` | 0.3 | part réservée au test |
| `minTestPoints` | 4 | jeu de test trop petit → refus |
| `intervalZ` | 1.96 | demi-largeur de l'intervalle à 95 % |
| `dampingHorizonDays` | 30.0 | au-delà, la pente est amortie |

Le test d'intégration vérifie que **le seuil publié est le seuil appliqué** :
`minPoints - 1` observations sont refusées. Un moteur qui documenterait des
seuils différents de ceux qu'il applique serait pire qu'un moteur muet.

### 10.3 Pas de donnée suffisante, pas de prévision

Le moteur répond `sufficient: false` avec un motif, et `values: []`. Node ne
persiste alors **aucune ligne** dans `soil_predictions` : une ligne vide
laisserait croire qu'une prévision existe. La route répond **200**, pas une
erreur — « nous n'avons pas assez de données réelles » est une réponse.

La série envoyée au moteur exclut `mode: 'SIMULATED'`. Une prévision fondée sur
des valeurs générées serait présentée à l'agriculteur comme une anticipation du
réel.

`low` et `high` valent `null` quand l'incertitude n'est pas quantifiable
(série sans bruit) : un intervalle de largeur nulle affirmerait une certitude
inexistante.

### 10.4 `beatsBaseline` : calculé, jamais déclaré

Le champ `beatsBaseline` de `AiModelVersion` n'est **pas** un champ du corps de
requête. Il est calculé par `compareAgainstBaseline(kind, metrics,
baselineMetrics)` à partir des métriques du modèle et de celles du moteur à
règles sur le même découpage. Un appelant ne peut donc pas déclarer son modèle
meilleur qu'il ne l'est.

La métrique de décision est fixée par famille, pas choisie au moment de la
promotion :

| `kind` | Métrique | Sens |
| --- | --- | --- |
| `FORECAST`, `INTERPOLATION`, `GPR` | `mae` | plus bas = meilleur |
| `ANOMALY` | `f1` | plus haut = meilleur |
| `RECOMMENDATION` | `precisionAtK` | plus haut = meilleur |
| `ZONES` | `silhouette` | plus haut = meilleur |

Règles de promotion :

- **strictement** meilleur. À égalité, la méthode apprise n'apporte rien et ne
  justifie pas sa complexité : elle n'est pas promue ;
- comparaison **impossible** (métrique absente du modèle ou de la référence)
  → `beatsBaseline: null` → promotion refusée. L'absence de preuve n'est pas
  une preuve ;
- une seule version en `PRODUCTION` par `kind` et par périmètre ; la précédente
  passe en `RETIRED`, jamais supprimée — métriques et historique restent
  consultables.

### 10.5 Ce qui alimente réellement les alertes

`alerts.service.js` n'exploite une prévision que si `beatsBaseline === true`
(`false` **et** `null` refusent tous les deux), et écarte un franchissement déjà
passé (`breach.at <= now`), qui relève du volet mesure et non du préventif.
Une prévision seule ne remplace jamais la recommandation : elle avertit.

### 10.6 API

Prévision, sous `/api/v1/plots` :

| Méthode et chemin | Permission | Rôle |
| --- | --- | --- |
| `POST /plots/:plotId/forecasts/:parameter` | `forecast.write` | calcule et persiste |
| `POST /plots/:plotId/forecasts/:parameter/backtest` | `forecast.read` | évalue sans écrire |
| `GET /plots/:plotId/forecasts` | `forecast.read` | prévisions enregistrées |

Treize paramètres prévisibles : `ph`, `organicMatter`, `n`, `p`, `k`, `ec`,
`moisture`, `erosionRisk`, `sand`, `silt`, `clay`, `depthCm`, `airTemperatureC`.
La **texture est exclue** : c'est une classe, pas une grandeur numérique, et la
prévoir n'aurait pas de sens. Un autre paramètre → 422.

Gouvernance des modèles, sous `/api/v1/ai/models` :

| Méthode et chemin | Permission | Rôle |
| --- | --- | --- |
| `GET /ai/models` | `models.read` | versions du tenant et partagées |
| `POST /ai/models` | `models.write` | enregistrement, toujours `TESTING` |
| `GET /ai/models/:id` | `models.read` | détail et comparaison |
| `POST /ai/models/:id/promote` | `models.promote` | promotion (409 sans preuve) |
| `POST /ai/models/:id/retire` | `models.write` | sortie du service |

`models.promote` est réservée aux rôles d'administration : c'est l'acte qui met
un modèle appris face aux agriculteurs.

### 10.7 Preuves

- **30 tests Python** (`geoai/tests/test_forecast.py`) — la suite du moteur
  passe de 70 à **100 tests** : refus en dessous de chaque seuil, découpage
  chronologique vérifié par la position des points, absence de fuite de données
  futures (une rupture injectée dans le seul tiers de test ne change pas la
  pente ajustée), intervalles qui s'élargissent avec l'horizon, série constante
  et bruit pur **non** promouvables, points corrompus exclus mais comptés.
- **18 tests de contrat Node⇄Python** (`tests/forecast.integration.test.mjs`),
  dont **4 lancent le vrai moteur Python** et vérifient que sa réponse a
  exactement la forme que le service Node consomme. Un double en mémoire
  prouverait seulement que Node est cohérent avec lui-même. Y sont prouvés :
  la persistance effective d'une ligne `soil_prediction` avec son `mae`, son
  `baselineMae` et `beatsBaseline` ; l'absence totale d'écriture quand les
  données sont insuffisantes ; le refus de promotion sans preuve **et** quand
  la comparaison est impossible ; l'unicité d'une version en production ;
  l'isolement multi-tenant en 404.
- **7 tests de bout en bout sur base réelle et moteur Python réel**
  (`tests/e2e/forecastPipeline.e2e.test.mjs`, câblé dans `npm run test:e2e`) :
  40 mesures réelles de sonde → prévision persistée → **alerte préventive
  datée** émise par le job → **SMS en français** annonçant l'échéance ; la même
  prévision privée de sa preuve ne déclenche plus rien ; parcelle sans
  historique → refus explicite, rien en base ; texture → 422 ; backtest sans
  écriture ; parcelle d'une autre organisation → 404.

  Les dates de cette recette sont **relatives à l'instant d'exécution**. À dates
  fixes, elle deviendrait obsolète en silence : le job écarte un franchissement
  déjà passé, et la recette passerait au vert sans plus rien prouver.


## 11. La prévision entre dans le choix de la culture

Jusqu'à cette étape, la prévision alimentait les alertes mais **pas** le
classement : `recommendation.service.js` ne contenait aucune référence à une
prévision. Or une recommandation porte sur une période — 60 jours — alors que
l'état du sol est une photographie du jour du calcul. Noter une culture sur la
seule valeur du jour revient à ignorer ce qui va se passer pendant le cycle.

Le CDC le demande explicitement : noter les cultures sur des plages idéales
**ajustées par la prévision**.

### 11.1 Trois règles

**1. La prévision ne peut que durcir un critère, jamais l'assouplir.**
Si le sol est mauvais aujourd'hui et prévu bon dans trois semaines, la culture
n'est pas recommandable : on sème maintenant. Inversement, si la valeur du jour
est conforme mais que la trajectoire prévue sort de la plage pendant le cycle,
le critère échoue.

**2. On n'écarte pas une culture sur un écart plus petit que l'erreur déclarée
du modèle.** Si la valeur prévue dépasse la borne de moins que le MAE, le
franchissement est dans le bruit : le critère reste satisfait et est signalé
« à surveiller » (`watch.cause = 'WITHIN_MODEL_ERROR'`). Sans MAE du tout, même
refus de durcir — impossible de distinguer le signal du bruit. Éliminer sur du
bruit serait plus nuisible que se tromper.

**3. Une couverture partielle est dite, pas masquée.** Une prévision de 21 jours
sur une période de 60 porte `coverageRatio: 0.35` et l'explication l'énonce.

### 11.2 L'élimination reste fondée sur la mesure

Un critère éliminatoire (salinité) **constaté** au-delà de la limite écarte la
culture. Un franchissement seulement **prévu** ne l'écarte pas : le critère est
non satisfait, le score en pâtit, l'avertissement est explicite — mais la
culture reste classable. Écarter définitivement une culture sur une prévision,
avec son erreur déclarée, serait plus nuisible qu'utile.

### 11.3 Ce qui ne change pas

Les `thresholds` persistés restent les **plages agronomiques**, pas les
projections. Le job d'alertes compare des mesures à la plage, et la prévision à
part (§9.5). Confondre les deux ferait comparer une mesure réelle à une
projection.

### 11.4 Surface exposée

Aucune route nouvelle. Les champs ajoutés :

| Emplacement | Champ |
| --- | --- |
| `criteria[]` | `forecastAdjusted`, `downgradedByForecast`, `watch`, `projection` |
| `explanation` | `forecast: { applied, periodDays, parameters[], skipped[], notice }` |
| `decomposition` | `forecast` (mêmes données, persistées avec la recommandation) |
| `sources[]` | `'forecast'` quand une prévision a durci un critère |

`scoreCrop(cropEntry, rangesEntry, state, projections = {})` : le quatrième
paramètre est facultatif, l'arité déclarée reste 3. Sans lui, la notation porte
sur la seule mesure — comportement inchangé pour les appelants existants.

### 11.5 Un défaut trouvé en route : la fraîcheur de l'état du sol

En écrivant la preuve de bout en bout, la valeur d'humidité retenue était **45 %
alors que la dernière mesure était 25,5 %** — soit la mesure la plus ancienne.

`buildSoilState` trie les lectures par date décroissante, puis remplace la
valeur en place dès qu'arrive une provenance de priorité `<=`. À priorité égale,
chaque itération écrasait donc la précédente, et la boucle terminait sur la
mesure la plus ancienne. Le commentaire du code annonçait « la mesure la plus
fraîche prime » ; le code faisait l'inverse. Le classement **et** les seuils
d'alerte reposaient sur une photographie périmée.

Correction : comparaison stricte (`<`). La liste étant triée du plus récent au
plus ancien, la valeur en place est toujours plus fraîche que le candidat ; une
provenance strictement meilleure (laboratoire avant sonde) l'emporte toujours.

### 11.6 Preuves

- **27 tests du module pur** (`tests/forecastAdjustment.test.mjs`) : chaque
  garde-fou isolément — prévision non prouvée refusée, points passés et
  hors période écartés, couverture identique dans les deux sens de pente,
  mesure absente qui reste non évaluable, franchissement robuste par le bas et
  par le haut, franchissement dans l'erreur du modèle signalé sans durcissement,
  absence de MAE, mesure déjà hors plage que la prévision ne rattrape pas,
  élimination jamais déclenchée par une prévision mais toujours par une mesure.
- **2 tests de régression sur la fraîcheur** (`tests/recommendation.test.mjs`) :
  à provenance égale la plus récente prime ; une provenance plus fiable
  l'emporte même plus ancienne.
- **3 tests de bout en bout** (`tests/e2e/forecastPipeline.e2e.test.mjs`) formant
  une paire contrastée sur le même sol et la même période : sans prévision
  prouvée, `forecast.applied` est faux et l'explication dit que le classement
  repose sur les seules mesures du jour ; avec, le critère d'humidité est durci,
  le score du maïs passe de 1 à 0,5, la couverture partielle est énoncée, et les
  `thresholds` restent la plage agronomique.

## 12. Cartes interpolées avec incertitude (phase 6)

La phase 6 exige : à partir d'au moins trois sondes, une carte interpolée **avec
son incertitude**, toute valeur aberrante signalée **avec son motif**, et chaque
nombre de l'explication présent dans les données du moteur.

Jusqu'à cette étape, le modèle `interpolated_maps` existait mais **rien ne
l'écrivait** : la table était vide, comme `soil_predictions` l'était avant
l'étape 10. Aucune carte ne pouvait être produite.

### 12.1 Pourquoi le krigeage

| Méthode | Pondération | Incertitude |
| --- | --- | --- |
| IDW | inventée (`1/d^p`), non fondée sur les données | aucune crédible |
| Moyenne mobile | arbitraire | aucune |
| **Krigeage ordinaire** | issue d'un variogramme ajusté **sur les mesures** | variance de krigeage |

Le krigeage est retenu parce que l'incertitude annoncée sort des données, et non
d'une convention. `geoai/interpolation.py` (656 lignes, stdlib) implémente le
variogramme empirique, l'ajustement d'un modèle exponentiel par recherche sur
grille, et la résolution du système de krigeage par élimination de Gauss.

Conventions numériques explicites, parce qu'elles changent les résultats :
`gamma(0) = 0` et diagonale nulle (le pépite représente l'erreur de mesure) ;
variance ramenée à 0 si l'algèbre la rend négative, avec comptage dans
`clampedCells` ; points confondus à moins de 1 m **moyennés** et déclarés — deux
valeurs différentes au même endroit rendraient le système singulier.

### 12.2 Seuils, publiés par `GET /v1/meta`

| Seuil | Valeur | Effet |
| --- | --- | --- |
| `minPoints` | 3 | moins de mesures → refus |
| `minDistinctLocations` | 3 | trois sondes au même endroit n'interpolent rien |
| `minSpreadM` | 5.0 | nuage trop concentré → refus |
| `minSeparationM` | 1.0 | en deçà, deux points sont confondus |
| `minVariogramPairs` | 3 | trop peu de paires pour ajuster |
| `outlierZ` | 2.5 | résidu standardisé au-delà → aberration |
| `maxCells` | 20 000 | plafond : la grille s'épaissit, ne se tronque pas |

Le test d'intégration vérifie que **le seuil publié est le seuil appliqué** :
`minPoints - 1` sondes sont refusées, `minPoints` exactement passent.

### 12.3 Trois règles côté Node

**1. Pas de carte sans support spatial réel.** Le moteur refuse en dessous de ses
seuils ; Node ne persiste alors **rien**. La route répond **200** avec le motif —
« moins de trois sondes » est une réponse, pas une erreur.

**2. Une sonde n'est pas une série.** Un capteur remonte des centaines de mesures
dans le temps ; une carte se construit sur un échantillon spatial. On retient la
mesure la plus **récente** de chaque sonde, et le nombre de mesures écartées est
déclaré (`diagnostics.ingestion.seriesReadingsDropped`). C'est la même leçon que
le défaut de fraîcheur corrigé au §11.5.

**3. Un horizon par carte.** Un pH à 10 cm et un pH à 60 cm ne décrivent pas le
même sol. Sans profondeur demandée, la profondeur dominante est retenue et ce qui
a été écarté est compté (`excludedForDepth`).

### 12.4 Valeurs aberrantes : signalées, avec un motif vérifiable

Une mesure est aberrante si son résidu de validation croisée dépasse `outlierZ`
fois l'incertitude locale **du point retiré**. Le seuil est standardisé, pas
absolu : sur un sol naturellement hétérogène, un seuil fixe en valeur absolue
signalerait comme aberrante toute mesure légitime.

Le motif cite la mesure, la prédiction des voisines, la marge, l'incertitude
locale et le seuil. Deux tests — Python et de bout en bout — **extraient chaque
nombre du motif** et vérifient qu'il correspond à un champ rendu. Un motif qui
inventerait un nombre échoue.

L'aberration **qualifie** la carte, elle ne l'invalide pas : la carte reste
produite, et l'erreur « laisser une sonde dehors » traduit l'impact réel de la
mesure douteuse.

### 12.5 Validation croisée « laisser une sonde dehors »

Chaque mesure est retirée à son tour et prédite depuis les autres. C'est la seule
évaluation honnête disponible : il n'y a pas de vérité terrain indépendante, et
réutiliser la mesure dans son propre ajustement mesurerait la capacité du modèle
à se recopier.

Un test le verrouille : sur un champ où une valeur aberrante est injectée, une
fuite donnerait une erreur exactement nulle pour ce point. L'erreur mesurée est
supérieure à 1, ce qui distingue les deux cas.

Le krigeage ordinaire est non biaisé : l'erreur moyenne est nulle à `1e-6` près
sur un champ régulier. C'est vérifié, pas supposé.

### 12.6 API

Montées sous `/api/v1/geospatial/interpolations`, **avant** le montage général de
`/geospatial` : Express résout les préfixes dans l'ordre de déclaration.

| Méthode et chemin | Permission | Rôle |
| --- | --- | --- |
| `POST /:plotId/:parameter` | `geospatial.write` | calcule et persiste |
| `POST /:plotId/:parameter/evaluate` | `geospatial.read` | qualifie sans produire de carte |
| `GET /:plotId` | `geospatial.read` | cartes enregistrées, **sans la grille** |
| `GET /map/:id` | `geospatial.read` | carte complète, grille incluse |

La liste ne transporte pas la grille : elle peut compter des milliers de
cellules. Cette restriction (`select`) n'est vérifiable que contre le vrai
Prisma — `fakePrisma` ignore `select` — et son test vit donc dans la recette de
bout en bout.

Migration `20261022010000_interpolated_maps` : deux colonnes facultatives,
`outliers` et `diagnostics`. Le modèle existant portait déjà `values`,
`uncertainty`, `sondes_used` et `leave_one_out_mae`.

### 12.7 Preuves

- **28 tests Python** (`geoai/tests/test_interpolation.py`) — la suite du moteur
  passe de 100 à **128 tests** : refus en dessous de chaque seuil, trois sondes
  suffisent (la borne basse est testée, pas seulement le cas confortable), points
  rejetés comptés et motivés, points confondus moyennés et déclarés, incertitude
  nulle sur les sondes et positive entre elles, **aucun dépassement au-delà des
  valeurs mesurées**, variogramme ajusté sur les données, champ constant traité,
  aberration signalée avec motif, hétérogénéité naturelle non signalée, et
  vérification nombre par nombre du motif.
- **15 tests de contrat Node⇄Python** (`tests/interpolation.integration.test.mjs`),
  dont **8 lancent le vrai moteur** : forme exacte de la réponse, refus à deux
  sondes, aberration motivée, seuils publiés réellement appliqués, une mesure par
  sonde (la plus récente), exclusion des mesures simulées et non géolocalisées,
  un horizon par carte, persistance effective avec diagnostic complet, et absence
  totale d'écriture quand les sondes sont insuffisantes.
- **7 tests de bout en bout sur base réelle et moteur Python réel**
  (`tests/e2e/interpolation.e2e.test.mjs`, câblé dans `npm run test:e2e`) : neuf
  mesures **ingérées par l'API IoT réelle** — seule façon de prouver que le champ
  `position` traverse le pipeline — produisent une carte persistée avec grille,
  incertitude par cellule, erreur de validation croisée et diagnostic ; une sonde
  aberrante est signalée avec un motif dont chaque nombre est vérifié ; deux
  sondes → refus et rien en base ; texture → 422 ; évaluation sans écriture ;
  liste sans grille ; parcelle d'une autre organisation → 404.

### 12.8 Un défaut trouvé en route : le champ constant

Sur un sol uniforme — toutes les sondes à la même valeur — le variogramme a un
palier nul, toute la matrice de krigeage est nulle, le système admet une infinité
de solutions, et le moteur **refusait de répondre**. Or un champ constant est le
cas le plus simple à interpoler.

Correction : dans ce cas la solution de variance minimale est déterminée, c'est
la moyenne arithmétique de variance nulle. Le moteur la rend et le signale par
`variogram.constant = true`.

---

## 13. Acquisition satellite programmée

Le CDC demande « satellite via Sentinel Hub / Earth Engine **sur une
planification** ». Jusqu'à cette étape, la table `satellite_observations` était
alimentée uniquement par une saisie manuelle (`geodata.recordSatellite`, où
l'appelant fournit lui-même la valeur). Cinq modules la lisent ; rien ne la
remplissait. Aucun client Sentinel Hub ou Earth Engine n'existait.

### 13.1 Trois règles non négociables

| Règle | Implémentation |
| --- | --- |
| **Le radar d'abord** | `src/config/satellite.js` place `sentinel-1` en tête ; `resolveMoistureSource()` le retourne par défaut |
| **Une scène optique nuageuse est refusée, pas dégradée** | `resolveMoistureSource({cloudCoverPct})` renvoie `rejectedSource` ; la scène n'est pas conservée |
| **Le satellite ne complète que les zones sans sonde** | le job écarte les parcelles ayant des mesures réelles d'humidité (`PROBE_COVERED`) |

La deuxième règle mérite d'être explicite : conserver une scène à 85 % de nuages
en lui accolant une confiance réduite produirait un nombre plausible et faux.
Elle est écartée, avec son motif :

```
Scène optique sentinel-2 refusée : 85 % de couverture nuageuse (seuil 40 %).
Bascule sur sentinel-1 (radar).
```

Le seuil vient de `SATELLITE_CLOUD_REJECT_PCT` et n'a **aucun effet sur le
radar**, qui traverse les nuages — c'est précisément pourquoi Sentinel-1 est la
source principale en Équateur et Bandundu.

### 13.2 Interface fournisseur

`src/integrations/satellite.js` reproduit le motif de `src/integrations/sms.js` :
une table de fournisseurs, un choix par variable d'environnement, une liste
déclarée dans `src/config/hardware.js`.

| `SATELLITE_PROVIDER` | Comportement |
| --- | --- |
| `simulated` | scène déterministe, `mode: 'SIMULATED'`, **refusé en production** |
| `sentinelhub` | appel réel ; échoue si `SATELLITE_API_URL`/`SATELLITE_API_KEY` absents |
| `earthengine` | idem, autre fournisseur |
| `webhook` | passerelle générique, sans compte cloud |

Deux garde-fous vérifiés par les tests :

- **un fournisseur réel non configuré échoue bruyamment** — il ne retombe jamais
  sur une valeur fabriquée ;
- **le mode simulé est marqué et refusé en production**, par la même garde que
  les mesures de capteur (`assertDataModeAllowed`).

Les réglages sont lus **à l'appel** (`process.env` en priorité), et non figés à
l'import : sans cela, aucun test ne pourrait changer de fournisseur sans
recharger l'application. C'est le motif déjà utilisé par
`src/integrations/geospatial.js` pour `GEOAI_URL`.

`satelliteSettings()` expose la configuration **sans secret** : seule la présence
est signalée (`apiUrlConfigured`, `apiKeyConfigured`), jamais la valeur.

### 13.3 Surface exposée

| Méthode | Route | Permission | Réponse |
| --- | --- | --- | --- |
| `GET` | `/api/v1/satellite/settings` | `satellite.read` | fournisseur actif, sources, activation |
| `POST` | `/api/v1/satellite/plots/:plotId/acquire` | `satellite.write` | `201` scène acquise, `200` si refusée |
| `GET` | `/api/v1/satellite/plots/:plotId/observations` | `satellite.read` | scènes, toutes marquées `measuresSubsurface: false` |

**Un refus est un `200`, pas une erreur.** « Pas de scène exploitable » est une
réponse informative : le client doit pouvoir distinguer « le fournisseur a
échoué » de « la scène existe mais n'est pas exploitable » (`rejected: true`).

La confiance écrite est **plafonnée par la déclaration du matériel**
(`confidence: 'low'`) : une source de surface ne peut pas prétendre à la
fiabilité d'une sonde, quel que soit ce que renvoie le fournisseur.

`SatelliteObservation` ne porte pas d'`organizationId` : la garde de tenant
passe par la parcelle, et une parcelle d'une autre organisation répond `404`,
pas `403`, pour ne pas révéler son existence.

### 13.4 Le job

`satellite.acquire` dans `src/jobs/index.js`, cadence
`SATELLITE_REFRESH_HOURS` (24 h par défaut).

**Cadence de sondage ≠ période de revisite.** Interroger l'API chaque jour est
normal quand un produit Sentinel-1 n'apparaît que tous les 6 à 12 jours ;
`sceneLookbackDays` (12 jours) borne la fenêtre de recherche pour ne pas remonter
une scène ancienne comme si elle était fraîche.

Le job renvoie un compte-rendu complet : `acquired`, `skipped` (avec
`PROBE_COVERED` ou `SCENE_REJECTED`), `failed` (avec le motif). **Aucun échec
n'est avalé** : les détails sont restitués, pas seulement les compteurs.

Désactivé par défaut (`SATELLITE_ACQUISITION_ENABLED=false`) : sans identifiants
fournisseur, un job qui tournerait à vide ne produirait que du bruit.

### 13.5 Points de configuration

Tous dans `src/config/hardware.js`, section `satellite` (lignes 675 à 716), avec
leurs variables d'environnement dans `src/config/env.js`. Le détail
ligne par ligne est dans `docs/GEOSPATIAL_BACKEND_CONFIGURATION.md` §3.8.

Les valeurs **non déterminées restent `null`** et figurent dans
`pendingConfirmations()` (61 valeurs au total) : `requestTimeout.value`,
`retryDelay.value`, `refreshInterval.value`. Inventer un délai de reprise sans
connaître le quota du fournisseur produirait un blocage ou une exclusion de
compte.

Le schéma zod **refuse une liste `providers` ne contenant que `simulated`** : une
telle configuration rendrait le passage en réel impossible, et le dirait au
démarrage.

### 13.6 Ce qui est vérifié

| Suite | Cas | Ce qu'elle couvre |
| --- | --- | --- |
| `tests/satellite.test.mjs` | 19 | emprise, fournisseurs, garde production, refus, job, tenant |
| `tests/e2e/satellite.e2e.test.mjs` | 12 | trajet HTTP réel, **vrai serveur webhook**, permissions, isolation, **job d'alertes** |
| `tests/recommendation.test.mjs` | +2 | exclusion des scènes `SIMULATED` du calcul |

La recette de bout en bout démarre un serveur HTTP local qui joue le fournisseur :
c'est la preuve que le passage du mode simulé au mode réel ne demande **aucun
changement de code**, seulement des identifiants. Elle vérifie que l'emprise
envoyée au fournisseur vient bien de la géométrie de la parcelle
(`[18.25, 0.048, 18.26, 0.052]`), et que la scène nuageuse refusée n'apparaît
pas dans la table.

#### Le mode `SIMULATED` est ignoré par le calcul et par la surveillance

Deux tests appariés, en base réelle pour la surveillance : **la même valeur**
numérique ne déclenche aucune alerte en `SIMULATED` et en déclenche une en
`REAL`. Le test est construit pour qu'une régression soit visible — retirer le
filtre `mode: { not: 'SIMULATED' }` fait échouer les deux, ce qui a été vérifié.

L'écriture de ce test a révélé un **défaut réel, corrigé** :
`fillMoistureFromSatellite` était appelée dans `createRecommendation` *après*
`buildSoilState`, alors que le job d'alertes appelle `buildSoilState` en
affirmant construire « le même état que le calcul ». L'affirmation était fausse :
la surveillance ignorait **toute** scène satellite, réelle comprise — donc toute
parcelle sans sonde, précisément celles que le satellite est censé couvrir. Le
comblement est désormais **dans** `buildSoilState`, et les deux appelants
partagent exactement la même logique, filtre `SIMULATED` inclus.

Conséquence à connaître : une parcelle sans sonde dont la seule humidité vient
d'une scène **réelle** est maintenant surveillée. Une scène **simulée** ne l'est
toujours pas, et l'exclusion est énoncée dans le motif plutôt que masquée
derrière « aucune observation ».

### 13.7 D'où vient la valeur `S1_SOIL_MOISTURE`

**Le backend ne calcule aucun index.** Il nomme l'index qu'il demande et le
fournisseur renvoie la valeur : `src/integrations/satellite.js` retient
`payload?.index ?? requested.index`, et aucune occurrence de `S1_SOIL_MOISTURE`
n'apparaît dans `geoai/`. Le nom n'existe dans `src/` qu'à deux endroits — la
liste `hardware.satellite.moistureIndexes` (ligne 653) et le choix de l'index par
défaut (`acquisition.service.js:41`).

Trois conséquences à ne pas perdre de vue :

| Point | État |
| --- | --- |
| **C'est un produit dérivé du fournisseur** | issu de la rétrodiffusion radar Sentinel-1, pas une mesure directe d'humidité |
| **C'est une estimation de surface** | la profondeur effective dépend du produit fournisseur — **à confirmer**, jamais extrapolable au sous-sol |
| **Aucune calibration sur sondes n'existe** | la valeur est brute, telle que le fournisseur la livre |

**La calibration sur les sondes reste à faire.** Tant qu'elle n'est pas établie,
la valeur entre dans l'état du sol avec `confidence: 'low'`, un `caveat`
rappelant qu'elle ne décrit pas le sous-sol, et ne remplace jamais une mesure de
sonde (`fillMoistureFromSatellite` s'interrompt dès qu'une sonde a parlé). Un
écart systématique entre scènes et sondes — biais de calibration du fournisseur —
n'est donc pas détecté aujourd'hui : c'est le premier travail à mener dès que
trois sondes ou plus seront installées sur une même parcelle.

### 13.8 Ce qui reste ouvert

- **Seul le fournisseur `webhook` est réellement testé.** La recette
  `tests/e2e/satellite.e2e.test.mjs` démarre un serveur HTTP local et vérifie
  l'appel, l'emprise envoyée et la persistance. C'est une preuve de
  l'**interface**, pas de la conformité à une API tierce.
- **`sentinelhub` et `earthengine` demandent un adaptateur.** Chacun appelle
  l'URL configurée avec un contrat générique `{mission, sourceId, index, bbox,
  from, to}` et attend `{value, observedAt, index, cloudCoverPct}` en retour. Ni
  l'API statistique de Sentinel Hub (requêtes `evalscript`, jetons OAuth,
  pagination des tuiles) ni Earth Engine (service account, `image.reduceRegion`)
  ne répondent sous cette forme : il faut écrire, pour chacun, un adaptateur qui
  traduise la requête et normalise la réponse. **Aucun de ces deux chemins n'a
  été exécuté contre l'API réelle** — aucun identifiant n'était disponible.
- **`SATELLITE_REFRESH_HOURS` pilote le sondage, pas l'archivage.** Aucune
  politique de purge des scènes anciennes n'existe.
- **Aucune calibration des scènes sur les sondes** (voir §13.7).

---

## 14. Anomalies de mesure : détection, exclusion et revue

Le calcul existait déjà dans le moteur (`geoai/sensors.py` : écart absolu médian
robuste, capteur figé, trous de transmission) et une route le rendait à la
demande. **Le résultat était renvoyé au client puis jeté** : le modèle
`SensorAnomaly` n'avait aucun point d'écriture.

### 14.1 La règle centrale : signalée = écartée

Une mesure signalée comme anomalie est **écartée du calcul** — état du sol, carte
interpolée, prévision — jusqu'à ce qu'un agronome la réhabilite.

L'exclusion passe par un point unique, `excludedReadingIds(plotId)` dans
`src/modules/anomalies/anomalies.service.js`, appelé par les trois consommateurs.
Trois copies de cette requête finiraient par diverger.

| Consommateur | Emplacement |
| --- | --- |
| État du sol | `buildSoilState` (`recommendation.service.js`) — donc aussi le job d'alertes, qui appelle la même fonction |
| Carte interpolée | `interpolation.service.js` |
| Prévision | `buildSeries` (`forecast.service.js`) |

Le filtrage se fait dans le `where`, pas après le `take` : exclure après coup
réduirait la fenêtre effectivement analysée sans le dire.

**Les statuts qui écartent sont `NEW` et `CONFIRMED`.** Une anomalie non revue
écarte donc la mesure : tant qu'un seuil provisoire n'a pas été contredit par un
humain, on préfère perdre une mesure douteuse que fonder une recommandation
dessus.

### 14.2 La revue par l'agronome

| Décision | Effet |
| --- | --- |
| `CONFIRMED` | la mesure **reste écartée** |
| `DISMISSED` | la mesure **réintègre le calcul immédiatement**, sans autre action |

Le rejet est le correctif prévu pour les faux positifs d'un seuil provisoire. La
réponse l'indique explicitement (`readingExcluded: false`) : l'effet d'un rejet ne
doit pas rester implicite.

La revue est réservée à `AGRONOMIST` et aux administrateurs (`anomaly.review`) :
rejeter une anomalie modifie l'état du sol qui fonde les recommandations.

**Une anomalie déjà revue n'est jamais rouverte** par un nouveau passage du job —
réinitialiser le statut annulerait la décision de l'agronome.

### 14.3 Dédoublonnage par épisode

Comme pour `ThresholdAlert` : une colonne `episode_key` avec
`@@unique([organizationId, episodeKey])`, ajoutée par la migration
`20261022020000_sensor_anomaly_episode`.

Une anomalie **par mesure**, quel que soit le nombre de motifs : les motifs
s'accumulent dans `details.reasons`, et l'agronome statue sur la mesure, pas sur
chaque motif. Le capteur figé prime sur l'aberration statistique — une valeur
figée explique mécaniquement un écart.

La contrainte porte sur `(organization_id, episode_key)` et non sur `reading_id` :
celui-ci est facultatif, et **PostgreSQL traite deux NULL comme distincts** — un
unique sur une colonne nullable ne dédoublonnerait rien.

### 14.4 Seuils provisoires

Tous les seuils vivent dans `src/config/hardware.js` (section `anomalies`, lignes
791 à 830), marqués `PROVISOIRE`, et sont transmis au moteur à chaque appel.
`geoai/config.py` ne sert que de repli.

Ils sont **opérationnels mais provisoires** — distincts des 61 valeurs en attente,
toutes `null` : une valeur `null` bloque le passage en mode réel, une valeur
provisoire fonctionne et doit être recalée. `provisionalThresholds()` les recense.

### 14.5 Taux mesurés — et ce qu'ils ne prouvent pas

`tests/anomalies.integration.test.mjs` mesure, sur **40 séries synthétiques**
(générateur déterministe, bruit de ±0,8 % autour de 24 %) :

| Indicateur | Valeur mesurée |
| --- | --- |
| Détection d'un pic franc (24 → 96) | **100 %** |
| Fausses alertes sur série propre | **2,5 %** |

Seuils appliqués : `madZLimit = 3.5`.

⚠️ **Ces taux ne remplacent pas une mesure sur données réelles.** Une série
synthétique reproduit le bruit que l'on a supposé. Elle ne connaît ni
l'encrassement progressif d'une sonde, ni les coupures de couverture réseau, ni
la dérive de calibration, ni les valeurs physiquement plausibles mais fausses. Les
bornes assertées (détection ≥ 90 %, fausses alertes ≤ 10 %) sont volontairement
larges : elles attrapent un détecteur cassé, pas un réglage à affiner.

### 14.6 Un piège évité : les indices du moteur

`quality()` filtrait les mesures non numériques **puis triait par date** : les
`outlierIndices` renvoyés ne correspondaient donc pas à la liste envoyée. Les
reconstruire côté Node aurait signalé les mauvaises mesures — silencieusement.

Le moteur renvoie maintenant `outlierReadingIds` et `stuckReadingIds`. Un test
fixe le comportement sur une entrée délibérément hostile : mélangée, avec une
valeur non numérique et une mesure non datée.

### 14.7 Surface exposée

| Méthode | Route | Permission |
| --- | --- | --- |
| `GET` | `/api/v1/anomalies/settings` | `anomaly.read` |
| `GET` | `/api/v1/anomalies` | `anomaly.read` |
| `GET` | `/api/v1/anomalies/:anomalyId` | `anomaly.read` |
| `POST` | `/api/v1/anomalies/devices/:deviceId/detect` | `anomaly.write` |
| `POST` | `/api/v1/anomalies/plots/:plotId/detect` | `anomaly.write` |
| `POST` | `/api/v1/anomalies/:anomalyId/review` | `anomaly.review` |

Une détection sans assez de mesures est un **200** portant `detected: false` et
son motif : un MAD sur cinq points n'a pas de sens statistique, et signaler au
hasard serait pire que se taire.

Job `sensors.detectAnomalies` (6 h), désactivé par défaut
(`ANOMALY_DETECTION_ENABLED`).

**Un capteur silencieux reste dans `ThresholdAlert`** : c'est l'absence de
mesure, pas une mesure mauvaise.

### 14.8 Ce qui est vérifié

| Suite | Cas | Ce qu'elle couvre |
| --- | --- | --- |
| `tests/anomalies.test.mjs` | 11 | exclusion par statut, revue, traçabilité, isolement, seuils provisoires |
| `tests/anomalies.integration.test.mjs` | 9 | moteur réel, seuils appliqués, identifiants, **taux mesurés**, dédoublonnage |
| `tests/e2e/anomalies.e2e.test.mjs` | 8 | exclusion réelle de l'état du sol, de la carte et de la prévision, puis réhabilitation |

La recette de bout en bout est la preuve décisive : elle ingère un pic de 96 %
par la vraie route, vérifie qu'il n'entre ni dans la recommandation, ni dans la
grille interpolée, ni dans la prévision — **puis** qu'un rejet de l'agronome le
fait revenir dans l'état du sol.

### 14.9 Ce qui reste ouvert

- **Les seuils ne sont pas recalés.** Aucune donnée réelle du pilote n'existe
  encore.
- **Aucun lien entre anomalie et alerte.** Une sonde dont les mesures sont toutes
  écartées peut devenir silencieuse de fait sans que `ThresholdAlert` le voie :
  le silence est mesuré sur la dernière remontée, pas sur la dernière mesure
  utilisable.
- **`OUT_OF_RANGE`, `IMPOSSIBLE_JUMP` et `SILENT` ne sont pas produits.** Seuls
  `STATISTICAL_OUTLIER` et `FROZEN_VALUE` le sont, parce que ce sont les deux
  défauts que le moteur détecte. Les bornes physiques existent
  (`hardware.plausibility`) mais ne sont pas confrontées aux mesures.
