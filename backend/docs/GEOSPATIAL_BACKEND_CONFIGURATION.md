# Configuration du matériel — backend RDC

**Fichier unique : `src/config/hardware.js`** (1086 lignes, version `1.0.0`,
révisé le `2026-10-22`).

Ce fichier est la **seule source de vérité** de la configuration matérielle.
Aucun paramètre matériel ne doit être défini ailleurs dans le code : les autres
modules l'importent. Il est validé par un schéma zod au chargement, exactement
comme le schéma d'environnement (`src/config/env.js`) : une configuration
invalide arrête le processus au démarrage.

---

## 1. Ce qui vit où

| Emplacement | Contenu | Exemple |
|---|---|---|
| `src/config/hardware.js` | **Catalogue des types** de matériel et réglages de fonctionnement | modèle de sonde, grandeurs mesurées, décodeur, intervalle d'envoi, bornes plausibles, plan de fréquence |
| Base de données | **Appareils réels** | DevEUI → `IotDevice.serialNumber`, parcelle → `IotDevice.plotId`, profondeur → `SensorReading.depthCm`, position GPS → `SensorReading.position` |
| `.env` | **Secrets** et choix de déploiement | `LORAWAN_MQTT_PASSWORD`, `SMS_API_KEY`, `SMS_PROVIDER`, `SATELLITE_PROVIDER`,
`SATELLITE_API_KEY`, `SATELLITE_CLOUD_REJECT_PCT` |

Un appareil se déclare par l'API (`POST /api/v1/iot/devices`), jamais en
éditant ce fichier. Ajouter un **type** de capteur se fait ici ; ajouter un
**exemplaire** de capteur se fait en base.

Le fichier ne contient aucun secret : il porte uniquement le **nom** des
variables d'environnement qui les contiennent
(`loraWan.mqtt.passwordEnvVar = 'LORAWAN_MQTT_PASSWORD'`). Un test vérifie
cette propriété (`tests/hardware.test.mjs`).

---

## 2. Règle : aucune valeur inventée

Le matériel du déploiement RDC n'est pas arrêté. Toute valeur inconnue est
`null`, avec une provenance qui dit ce qui manque et qui doit confirmer :

```js
sendInterval: {
  value: null,
  unit: 'minutes',
  source: 'à confirmer — intervalle annoncé par le fabricant (fiche technique).',
}
```

Renseigner une valeur plausible « pour que ça tourne » produirait l'effet
inverse de celui recherché : un décodeur, un intervalle ou une plage de mesure
inventés donnent au système l'apparence d'être configuré alors qu'il ne
correspond à aucun équipement réel.

**59 valeurs sont actuellement à confirmer.** La liste s'obtient par
`pendingConfirmations()` (ligne 1069).

Seules sont renseignées :

- les valeurs **définitionnelles** — une échelle de pH va de 0 à 14, une
  conductivité ne peut pas être négative, une humidité volumique est une
  fraction de 0 à 100 % ;
- les **réglages déjà en vigueur** dans le système, repris tels quels avec leur
  provenance (ex. le seuil de capteur silencieux, 24 h, anciennement
  `IOT_SILENCE_HOURS`).

---

## 3. Sections du fichier

Les numéros de ligne correspondent à la version actuelle de
`src/config/hardware.js`.

### 3.1 Version et révision — lignes 46 et 49

```
HARDWARE_CONFIG_VERSION   = '1.0.0'    (ligne 46)
HARDWARE_CONFIG_REVISED_AT = '2026-10-22' (ligne 49)
```

À incrémenter à chaque changement de matériel. Le serveur les journalise au
démarrage.

### 3.2 Mode — ligne 444

```js
mode: 'SIMULATION'
```

| Valeur | Signification |
|---|---|
| `SIMULATION` | Aucun matériel physique connecté. Les données générées sont **toujours marquées `SIMULATED` en base** (`src/shared/dataMode.js`). Réservé au développement et aux tests. |
| `REAL` | Du matériel physique est connecté. Le démarrage exige les champs obligatoires (voir §5). |

**Refus au démarrage en production** : `SIMULATION` + `NODE_ENV=production`
arrête le serveur (garde ligne 958, appelée par `src/server.js` avant
`app.listen`). Aucune variable d'environnement ne peut rouvrir cette porte.

Relation avec `SIMULATION_ENABLED` (`.env`) : cette variable autorise ou non
l'**écriture** de données marquées `SIMULATED` ; le `mode` décrit la **flotte**.
Les deux sont nécessaires : un environnement peut avoir du matériel réel et
refuser toute écriture simulée.

### 3.3 Réseau LoRaWAN — lignes 446 à 473

| Paramètre | Ligne | Valeur actuelle | Attendu |
|---|---|---|---|
| `networkServer` | 447 | `'ChirpStack'` | — |
| `networkServerVersion` | 448 | `null` | version déployée |
| `mqtt.urlEnvVar` | 450 | `'LORAWAN_MQTT_URL'` | — (nom de variable) |
| `mqtt.usernameEnvVar` | 451 | `'LORAWAN_MQTT_USERNAME'` | — |
| `mqtt.passwordEnvVar` | 452 | `'LORAWAN_MQTT_PASSWORD'` | — |
| `mqtt.port` | 453 | `null` | port du broker |
| `mqtt.qos` | 454 | `0` | 0, 1 ou 2 |
| `topics.uplink` | 457 | `application/{applicationId}/device/{devEui}/event/up` | à revérifier |
| `topics.downlink` | 458 | `application/{applicationId}/device/{devEui}/command/down` | à revérifier |
| `topics.status` | 459 | `application/{applicationId}/device/{devEui}/event/status` | à revérifier |
| `frequencyPlan` | 469 | **`null` — aucune valeur par défaut** | attribution ARPTC |
| `frequencyPlanSource` | 470 | « à confirmer — attribution de l'ARPTC » | — |
| `deviceClass` | 471 | `null` | `A`, `B` ou `C` |

**Le plan de fréquence n'a volontairement aucune valeur par défaut** : il dépend
de l'attribution du régulateur national (ARPTC, RDC). Le renseigner sans
confirmation exposerait à émettre hors bande autorisée.

Les gabarits de topics suivent la convention **ChirpStack v4**. La v3 nomme les
événements différemment (`/rx` au lieu de `/event/up`) : la provenance
(`topics.conventionSource`, ligne 460) le rappelle.

### 3.4 Passerelles — lignes 475 à 493

Tableau. Chaque entrée porte `slug`, `label`, `model`, `manufacturer`,
`datasheet`, `role` et `silenceBeforeAlert`.

| Paramètre | Ligne | Valeur actuelle | Attendu |
|---|---|---|---|
| `gateways[0].slug` | 477 | `'field-gateway'` | — |
| `gateways[0].model` | 479 | `null` | modèle retenu |
| `gateways[0].datasheet` | 481 | `null` | référence de la fiche |
| `gateways[0].role` | 482 | « Couverture radio d'un périmètre agricole et relais des uplinks » | — |
| `gateways[0].silenceBeforeAlert.value` | 485 | `null` | seuil > périodicité de heartbeat |

Le seuil de silence d'une passerelle doit être **supérieur** à sa périodicité de
heartbeat, sinon chaque cycle produit une fausse alerte. C'est pourquoi il ne
peut pas être fixé avant le choix du modèle.

### 3.5 Catalogue des types de capteurs — lignes 495 à 572

Quatre types :

| Entrée | Ligne du `slug` | Grandeurs | Confiance | `source` en base |
|---|---|---|---|---|
| `soil-moisture-probe` | 428 | `moisture` (%) | `high` | `measured_sensor` |
| `soil-temperature-ec-probe` | 446 | `ec` (dS/m), `depthCm` (cm) | `high` | `measured_sensor` |
| `soil-ph-probe` | 465 | `ph` (pH) | `high` | `measured_sensor` |
| `weather-station` | 481 | `airTemperatureC` (°C) | `high` | `measured_sensor` |

Le tableau `sensorTypes` commence ligne 495 ; chaque entrée porte `model`,
`manufacturer`, `datasheet`, `decoder`, `sendInterval`, `metrics`, `confidence`
et `source`.

**Les clés de grandeur reprennent le vocabulaire réel du système**
(`SOIL_PARAMETER_KEYS`, `src/modules/soil/soil.schema.js`) : `moisture`, `ec`,
`ph`, `depthCm`. Une clé inventée (par exemple `salinityDsm` au lieu de `ec`)
produirait des mesures que le moteur de recommandation ne saurait jamais
apparier à ses plages. Un test le vérifie.

Seule exception : `airTemperatureC`, qui est une métrique de sonde
(`SensorReading.metric`, champ libre) et non un paramètre d'analyse de sol.

**Bornes plausibles** (définies ligne 398, appliquées par `isPlausible`,
ligne 1017) :

| Grandeur | min | max | Provenance |
|---|---|---|---|
| `ph` | 0 | 14 | définition de l'échelle pH |
| `ec` | 0 | **`null`** | min définitionnel ; max = plage de mesure du capteur |
| `moisture` | 0 | 100 | fraction du volume de pores |
| `airTemperatureC` | `null` | `null` | plage de service du capteur |
| `depthCm` | 0 | `null` | longueur de la sonde installée |

Ces bornes servent à écarter une mesure manifestement fausse (sonde hors
service, décodage erroné) **avant** qu'elle n'entre dans une recommandation.
Elles ne remplacent pas les plages agronomiques, plus étroites.

Sans borne connue, `isPlausible` renvoie `{ plausible: true, checked: false }` :
l'absence de référentiel ne vaut pas condamnation.

### 3.6 Drones et caméras — lignes 574 à 614

| Paramètre | Ligne | Valeur actuelle |
|---|---|---|
| `model` | 575 | `null` |
| `manufacturer` | 576 | `null` |
| `datasheet` | 577 | `null` |
| `sensors` | 578 | tableau des capteurs embarqués |
| `sensors[0].slug` (multispectral) | 580 | `bandsNm: null`, résolution `null` |
| `sensors[1].slug` (thermique) | 590 | `bandsNm: null`, résolution `null` |
| `acceptedImageFormats` | 604 | `image/jpeg`, `image/png`, `image/tiff` |
| `maxUpload` | 605 | `value: null` (Mo) |
| `source` | 612 | `photo_interpreted` |
| `confidence` | 613 | `medium` |

Les formats acceptés ne sont pas une hypothèse : ce sont ceux que la chaîne de
traitement sait lire (`geoai/imagery.py`, via Pillow).

### 3.7 GPR — lignes 616 à 653

| Paramètre | Ligne | Valeur actuelle |
|---|---|---|
| `model` | 617 | `null` |
| `manufacturer` | 618 | `null` |
| `datasheet` | 619 | `null` |
| `fileFormat` | 621 | `'SEG-Y'` |
| `processing` | 622 | paramètres attendus du prestataire |
| `processing.centerFrequency` | 623 | `value: null` (MHz) |
| `processing.maxDepth` | 628 | `value: null` (m) |
| `processing.traceSpacing` | 633 | `value: null` (cm) |
| `processing.assumedVelocity` | 638 | `value: null` (m/ns) |
| `maxFileSize` | 646 | `value: null` (Mo) |
| `source` | 651 | `measured_gpr` |
| `confidence` | 652 | `high` |

`assumedVelocity` mérite une attention particulière : sans calibration terrain,
les profondeurs déduites d'un profil SEG-Y sont indicatives. La provenance le
rappelle.

### 3.8 Satellite — lignes 655 à 759

| Paramètre | Ligne | Valeur actuelle |
|---|---|---|
| `sources` | 663 | tableau, l'ordre EST la priorité |
| `sources[0].id` | 665 | `sentinel-1`, radar SAR bande C, `cloudInsensitive: true`, rôle `principal` |
| `sources[1].id` | 678 | `sentinel-2`, optique multispectral, rôle `complément` |
| `primaryMoistureSource` | 690 | `'sentinel-1'` |
| `moistureIndexes` | 695 | `S1_SOIL_MOISTURE`, `SOIL_MOISTURE` |
| `refreshInterval` | 696 | `value: null` (heures) — **à confirmer** |
| `cloudRejectThresholdEnvVar` | 706 | `'SATELLITE_CLOUD_REJECT_PCT'` |

#### Acquisition programmée — lignes 717 à 758

| Paramètre | Ligne | Valeur actuelle | Valeur future |
|---|---|---|---|
| `providers` | 717 | `['sentinelhub', 'earthengine', 'webhook', 'simulated']` | idem (ordre = préférence) |
| `providerEnvVar` | 718 | `'SATELLITE_PROVIDER'` | idem |
| `apiUrlEnvVar` | 719 | `'SATELLITE_API_URL'` | idem |
| `apiKeyEnvVar` | 720 | `'SATELLITE_API_KEY'` | idem |
| `enabledEnvVar` | 721 | `'SATELLITE_ACQUISITION_ENABLED'` | idem |
| `refreshIntervalEnvVar` | 730 | `'SATELLITE_REFRESH_HOURS'` | idem |
| `sceneLookbackDays.value` | 733 | `12` jours | à ajuster sur la revisite réelle |
| `requestTimeout.value` | 748 | `null` (aucun délai) | **à confirmer** selon le fournisseur |
| `maxAttempts` | 753 | `2` | idem |
| `retryDelay.value` | 755 | `null` (pas d'attente) | **à confirmer** selon le quota |

**Le schéma zod refuse une liste `providers` qui ne contiendrait que
`simulated`** (`.refine()` sur `providers`) : cela rendrait impossible tout
passage en réel, et la configuration le dirait au démarrage plutôt qu'en
exploitation.

**Le fournisseur se change sans réécrire le backend.** `SATELLITE_PROVIDER`
sélectionne une entrée de `src/integrations/satellite.js`, exactement comme
`SMS_PROVIDER` le fait pour les SMS. Les secrets (`SATELLITE_API_URL`,
`SATELLITE_API_KEY`) vivent dans l'environnement : ce fichier ne porte que le
**nom** des variables, jamais leur valeur.

**Cadence de sondage ≠ période de revisite.** `SATELLITE_REFRESH_HOURS` pilote le
job `satellite.acquire` : interroger l'API chaque jour est normal quand un
produit Sentinel-1 n'apparaît que tous les 6 à 12 jours. `sceneLookbackDays`
borne la fenêtre de recherche en amont, pour ne pas remonter une scène ancienne
comme si elle était fraîche.

**Vérification** : `node scripts/check-hardware-doc.mjs` (références de ligne),
`node --test tests/hardware.test.mjs` (contraintes du schéma),
`node --test tests/satellite.test.mjs` (interface fournisseur).

**Sentinel-1 est la source principale d'humidité** : Équateur et Bandundu sont
des zones à couverture nuageuse persistante, et le radar traverse les nuages.

**Le seuil de nuages n'est pas dupliqué ici.** Il est validé par le schéma
d'environnement (`SATELLITE_CLOUD_REJECT_PCT`, `src/config/env.js`) ; ce fichier
ne porte que le nom de la variable. Deux copies d'un même seuil finissent
toujours par diverger.

Chaque source porte `measuresSubsurface: false` — contrainte imposée par le
schéma (`z.literal(false)`) : **aucun satellite ne mesure le sous-sol**. La
vérité sous-sol vient des sondes et du GPR.

Les index d'humidité sont filtrés explicitement : `SatelliteObservation.value`
n'a de sens que par rapport à `index`, dont la valeur par défaut est `NDVI`. Un
NDVI (0–1) lu comme un pourcentage d'humidité donnerait un chiffre plausible et
faux.

**`S1_SOIL_MOISTURE` n'est pas calculé par le backend.** Ce fichier ne fait que
nommer l'index demandé ; la valeur est produite par le fournisseur, à partir de
la rétrodiffusion radar Sentinel-1. C'est donc :

- un **produit dérivé**, pas une mesure directe d'humidité ;
- une **estimation de surface**, dont la profondeur effective dépend du produit
  fournisseur et reste **à confirmer** — jamais extrapolable au sous-sol ;
- une valeur **non calibrée sur les sondes** : aucun biais systématique
  fournisseur n'est détecté à ce jour.

Jusqu'à calibration, elle entre dans l'état du sol en `confidence: 'low'` et ne
remplace jamais une mesure de sonde.

### 3.9 SMS — lignes 761 à 789

| Paramètre | Ligne | Valeur actuelle |
|---|---|---|
| `providers` | 767 | `console`, `twilio`, `africastalking`, `webhook` |
| `providerEnvVar` | 768 | `'SMS_PROVIDER'` |
| `secretEnvVars` | 769 | `SMS_API_KEY`, `SMS_WEBHOOK_URL` |
| `requestTimeout` | 770 | `value: null` (ms) |
| `maxAttempts` | 776 | `3` |
| `retryDelay` | 777 | `value: null` (ms) |
| `alertFreshness` | 782 | `value: null` (minutes) |

Le **fournisseur actif** et les **clés d'API** restent dans `.env`. Ajouter un
agrégateur local se fait dans `src/integrations/sms.js`, derrière l'interface
`sendSms()`, sans toucher au code métier.

Tant que `requestTimeout` et `retryDelay` sont `null`, aucun délai inventé n'est
appliqué : les tentatives s'enchaînent sans attente. Passer en mode `REAL` exige
de les renseigner.

### 3.10 Maintenance — lignes 832 à 852

| Paramètre | Ligne | Valeur actuelle | Provenance |
|---|---|---|---|
| `phCalibrationInterval` | 833 | `value: null` (jours) | fiche technique de la sonde pH |
| `silentSensorThreshold` | 844 | **`value: 24`** (heures) | réglage existant (`IOT_SILENCE_HOURS`), repris tel quel |
| `batteryAlertLevel` | 849 | `value: null` (%) | courbe de décharge du matériel |

`silentSensorThreshold` est le seul réglage repris d'une configuration
antérieure. Il était auparavant lu dans `process.env` par le job et **recodé en
dur** (`24 * 3600 * 1000`) dans `iot.service.js` : deux sources pour une même
règle. Ce fichier est désormais la seule, et la variable `IOT_SILENCE_HOURS` a
été retirée de `.env.example` et du schéma d'environnement.

### 3.11 Anomalies de mesure — lignes 791 à 830

| Paramètre | Ligne | Valeur actuelle | Valeur future |
|---|---|---|---|
| `enabledEnvVar` | 792 | `'ANOMALY_DETECTION_ENABLED'` | idem |
| `madZLimit.value` | 794 | `3.5` × MAD | **à recaler** sur les séries du pilote |
| `stuckMinPoints.value` | 801 | `5` points | **à recaler** sur la périodicité réelle |
| `stuckEpsilon.value` | 807 | `0.000001` | **à recaler** sur la résolution du capteur |
| `gapFactor.value` | 813 | `2.5` × | **à recaler** sur la régularité observée |
| `lookbackDays.value` | 819 | `14` jours | à ajuster selon la fréquence de remontée |
| `minReadings.value` | 825 | `8` mesures | à confirmer sur les premières séries |

**Ces seuils sont opérationnels mais provisoires** — ce qui les distingue des
61 valeurs en attente (`pendingConfirmations()`), toutes `null`. Une valeur
`null` bloque le passage en mode réel ; une valeur provisoire fonctionne et doit
être **recalée sur les données réelles du pilote**. Un accesseur dédié les
recense :

```bash
node -e "import('./src/config/hardware.js').then(m =>
  console.log(m.provisionalThresholds().map(p => p.path + ' = ' + p.value).join('\n')))"
```

**Ce fichier est la seule source de vérité des seuils.** Ils sont transmis au
moteur Python à chaque appel ; les valeurs de `geoai/config.py` ne servent que de
repli quand rien n'est fourni. Deux copies d'un seuil finissent toujours par
diverger, et un verdict statistique non reproductible n'est pas contestable.

**Vérification** : `node --test tests/anomalies.integration.test.mjs` mesure les
taux de détection et de fausse alerte sur séries synthétiques et vérifie que les
seuils fournis sont bien ceux appliqués.

⚠️ **Ces taux ne remplacent pas une mesure sur données réelles.** Une série
synthétique reproduit le bruit que l'on a supposé ; elle ne connaît ni
l'encrassement progressif d'une sonde, ni les coupures de couverture réseau, ni
la dérive de calibration.

---

## 4. Modules qui lisent ce fichier

| Module | Ce qu'il y lit |
|---|---|
| `src/server.js` | `assertHardwareConfigReady({ isProd: env.isProd })` au démarrage, **avant** `app.listen` |
| `src/jobs/index.js` | `hardware.maintenance.silentSensorThreshold.value` (job `iot.markSilent`) |
| `src/modules/iot/iot.service.js` | le même seuil, pour le drapeau `silent` de la liste des appareils |
| `src/config/satellite.js` | `hardware.satellite.sources`, `hardware.satellite.moistureIndexes` |
| `src/integrations/sms.js` | `hardware.sms.requestTimeout`, `maxAttempts`, `retryDelay` |

Un test (`tests/hardware.test.mjs`) vérifie qu'aucun de ces modules ne contient
de valeur matérielle en dur.

---

## 5. Garde de démarrage

`assertHardwareConfigReady({ isProd, config, requiredPaths })` — ligne 958.

Fonction pure : le contexte est passé explicitement, comme
`assertDataModeAllowed` dans `src/shared/dataMode.js`, pour être testable sans
modifier l'environnement du processus.

Deux arrêts :

1. **`isProd` + `mode: 'SIMULATION'`** → `Error`. Aucune donnée générée ne doit
   entrer en base de production.
2. **`mode: 'REAL'` + champs obligatoires manquants** → `Error` listant les
   chemins complets (`loraWan.frequencyPlan`, `sensorTypes[2].decoder`…).

La liste des champs obligatoires est `REQUIRED_IN_REAL_MODE` (ligne 885) :
25 chemins couvrant le réseau, les passerelles, les capteurs, les drones, le
GPR, le satellite, le SMS et la maintenance.

Un chemin de la forme `sensorTypes[].model` est contrôlé **pour chaque élément**
du tableau, et le message nomme l'élément fautif (`sensorTypes[1].model`).

---

## 6. Procédure de changement de matériel

### 6.1 Remplacer un modèle de capteur

1. Ouvrir `src/config/hardware.js`, section `sensorTypes` (ligne 495).
2. Renseigner `model`, `manufacturer` et `datasheet` d'après la fiche technique.
   **Ne rien inventer** : si la fiche ne donne pas une valeur, elle reste `null`.
3. Renseigner `decoder` (nom du décodeur déployé dans ChirpStack) et
   `sendInterval.value`.
4. Vérifier `metrics` : les clés doivent rester dans le vocabulaire des analyses
   de sol (`moisture`, `ec`, `ph`, `depthCm`) ou être une métrique de sonde
   explicite. Ajouter une grandeur impose de l'ajouter à `SOIL_PARAMETER_KEYS`
   dans `src/modules/soil/soil.schema.js`.
5. Renseigner les bornes plausibles **d'après la plage de mesure de la fiche**,
   avec la référence en `source`.
6. Incrémenter `HARDWARE_CONFIG_VERSION` (ligne 46) et mettre à jour
   `HARDWARE_CONFIG_REVISED_AT` (ligne 49).
7. Vérifier : `npm test -- tests/hardware.test.mjs`, puis `npm run verify`.

Les **exemplaires** de capteurs (DevEUI, parcelle, profondeur) se déclarent par
l'API, pas ici.

### 6.2 Ajouter un type de capteur

1. Ajouter une entrée dans `sensorTypes` (ligne 495) avec tous les champs.
2. Si la grandeur mesurée est nouvelle : l'ajouter à `SOIL_PARAMETER_KEYS`, puis
   créer les plages agronomiques correspondantes (table
   `crop_agronomic_ranges`, via `POST /api/v1/agronomic-ranges`).
3. Déployer le décodeur correspondant dans ChirpStack.
4. Même vérification qu'en 6.1.

### 6.3 Changer de passerelle ou de serveur réseau

1. Renseigner `gateways[]` (ligne 475) : `model`, `datasheet`,
   `silenceBeforeAlert.value` — ce seuil doit dépasser la périodicité de
   heartbeat du modèle.
2. Si le serveur réseau change : `loraWan.networkServer`,
   `networkServerVersion`, et revérifier `topics` (la convention diffère entre
   ChirpStack v3 et v4).
3. Mettre à jour les secrets MQTT dans `.env`
   (`LORAWAN_MQTT_URL`, `LORAWAN_MQTT_USERNAME`, `LORAWAN_MQTT_PASSWORD`).

### 6.4 Passer du mode simulation au mode réel

1. Obtenir l'attribution de fréquence auprès de l'ARPTC et renseigner
   `loraWan.frequencyPlan` (ligne 469).
2. Renseigner **tous** les champs de `REQUIRED_IN_REAL_MODE` (ligne 885).
   La liste de ce qui manque s'obtient en lançant le serveur : le message
   d'arrêt les énumère.
3. Positionner `mode: 'REAL'` (ligne 444).
4. Renseigner les secrets MQTT dans `.env`.
5. Vérifier : `npm run verify`, puis démarrer et lire la ligne de journalisation
   `Configuration matériel v… — mode REAL, 0 valeur(s) à confirmer.`
6. Incrémenter la version et la date de révision.

Tant que des champs manquent, le serveur **refuse de démarrer** en mode `REAL`.
C'est voulu : un serveur qui écoute avec une configuration incomplète
accepterait des mesures qu'il ne sait pas interpréter.

### 6.5 Changer de fournisseur SMS

1. Implémenter le fournisseur dans `src/integrations/sms.js`, derrière
   `sendSms()`.
2. Ajouter son nom à `sms.providers` (ligne 768) et ses secrets à
   `sms.secretEnvVars` (ligne 771).
3. Ajouter les variables correspondantes, vides, dans `.env.example` et dans le
   schéma `src/config/env.js`.
4. Renseigner `requestTimeout` et `retryDelay` d'après le SLA et les limites de
   débit du fournisseur.
5. Sélectionner le fournisseur via `SMS_PROVIDER` dans `.env`.

---

## 7. Vérification

| Contrôle | Commande | Ce qu'il prouve |
|---|---|---|
| Schéma valide | `npm test -- tests/hardware.test.mjs` | le fichier est accepté par zod, toutes les sections présentes, objet figé |
| Simulation refusée en production | idem | la garde lève une erreur, **et** un processus lancé avec `isProd: true` sort avec le code 1 |
| Champ manquant en mode réel | idem | l'erreur nomme les chemins complets manquants |
| Secrets absents | idem | tout champ de secret ne porte qu'un nom de variable, présent dans `.env.example` ; aucune valeur du fichier ne ressemble à une clé |
| Valeurs non inventées | idem | plan de fréquence `null`, réglages `null` porteurs de « à confirmer », bornes sourcées |
| Source unique | idem | aucun seuil en dur dans `jobs/index.js` ni `iot.service.js`, aucune description satellite recopiée |
| Numéros de ligne de ce document | `node scripts/check-hardware-doc.mjs` | les 64 références de ligne citées ici pointent sur le paramètre annoncé dans `hardware.js` |
| Cohérence globale | `npm run verify` | 439 tests unitaires, 38 e2e, 70 geoai, contrat OpenAPI, permissions, environnement |

---

## 8. Ce qui reste à confirmer

61 valeurs. Pour les lister :

```bash
node -e "import('./src/config/hardware.js').then(m =>
  console.log(m.pendingConfirmations().map(p => p.path).join('\n')))"
```

Les blocages majeurs avant un passage en mode réel :

| Champ | Qui confirme |
|---|---|
| `loraWan.frequencyPlan` | ARPTC (régulateur RDC) |
| `loraWan.deviceClass`, `topics` | version de ChirpStack déployée |
| `sensorTypes[].model`, `datasheet`, `decoder`, `sendInterval` | fournisseur du matériel |
| `gateways[].model`, `silenceBeforeAlert` | fournisseur + périodicité de heartbeat |
| bornes hautes (`ec`, `airTemperatureC`, `depthCm`) | plage de mesure de la fiche technique |
| `drones.*`, `gpr.*` | prestataire de relevé |
| `sms.requestTimeout`, `retryDelay` | SLA de la passerelle SMS |
| `sms.alertFreshness`, `maintenance.phCalibrationInterval` | agronome + fabricant |
| `satellite.refreshInterval`, `requestTimeout`, `retryDelay` | contrat du fournisseur (Sentinel Hub ou passerelle locale) |
| `satellite.sceneLookbackDays` (`12` jours) | période de revisite réelle observée sur zone |
