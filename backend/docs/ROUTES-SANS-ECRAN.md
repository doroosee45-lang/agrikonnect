# Routes sans écran client — classement par usage réel

**Source :** `backend/scripts/check-frontend-contract.mjs --verbose`, exécuté le 26/10/2026.
**380 routes backend · 274 appels clients distincts · 106 routes sans appel client.**

---

## 0. Méthode, et une précision sur le mot « écran »

Les deux clients (web et mobile) concentrent tous leurs appels dans un fichier
`endpoints.ts`. Une route absente de ces fichiers n'a donc **aucun wrapper**, et
par conséquent aucun écran possible. Les 106 routes ci-dessous sont dans ce cas.

J'ai vérifié le cas inverse aussi : **44 wrappers web** (43 utilisés par un
écran, 1 orphelin) et **44 wrappers mobile** (44 utilisés).

> **Un seul wrapper orphelin côté web : `reviewApi`** — avis et réputation
> (`POST /orders/:id/reviews`, `POST /reviews/:id/response`, `/report`,
> `/moderate`, `GET /organizations/:id/reputation`). Le wrapper existe, aucun
> écran ne l'appelle. Ces 5 routes **ne sont pas** dans les 106, puisqu'elles
> ont un appel client.

**Donc : 106 routes sans wrapper + 5 routes avec wrapper mais sans écran = 111
routes inaccessibles depuis une interface.**

État des lieux vérifié, à ne pas supposer :

| Zone | Écran existant ? |
|---|---|
| Recommandations | **oui** — `farmer/Plots/Recommendations.tsx` (web) + `farmer/plots/[id]/recommendations.tsx` (mobile) |
| Plages agronomiques (`CropAgronomicRange`) | **oui** — `admin/AgronomicRanges.tsx` + `admin/agronomic-ranges.tsx` |
| Alertes | **non, pas d'écran dédié.** `alertApi` et `anomalyApi` ne sont appelés **que** depuis l'écran Capteurs (`Plots/Sensors.tsx` / `plots/[id]/sensors.tsx`) |
| Dépôt géospatial (livré cette semaine) | **non** |

---

## 1. Priorité 1 — Recommandations : moteur et règle de combinaison

L'écran de recommandations existe, mais **rien n'expose le moteur** : ni sa
version, ni sa règle de combinaison. C'est exactement ce que demande l'étape B.

| Route | Permission | Usage |
|---|---|---|
| `GET /recommendations/engine` | `recommendation.read` | **Règle de combinaison + version du moteur.** Agronome et agriculteur |
| `GET /ai/models` | `models.read` | Liste des versions du moteur. Agronome |
| `GET /ai/models/:id` | `models.read` | Détail d'une version. Agronome |
| `POST /ai/models` | `models.write` | Enregistrer une version. Agronome |
| `POST /ai/models/:id/promote` | `models.promote` | Promouvoir une version en production. Agronome |
| `POST /ai/models/:id/retire` | `models.write` | Retirer une version. Agronome |

**6 routes.**

> `GET /recommendations/engine` renvoie déjà la règle de combinaison et la
> liste des versions publiées (`describeEngine`, `ENGINE_VERSIONS`) — la donnée
> est prête, seul l'écran manque.

## 2. Priorité 2 — Alertes

**Aucune route d'alerte n'est orpheline** : toutes ont un wrapper. Le manque est
ailleurs — il n'y a **pas d'écran d'alertes**. Les alertes de seuil et les
anomalies capteur sont enfouies dans l'écran Capteurs.

L'étape B (« écrans des alertes ») est donc un **écran à créer**, pas un
raccordement de route.

## 3. Priorité 3 — Plages agronomiques : gouvernance des règles

Attention à ne pas confondre deux choses :

- **`/agronomic-ranges`** (modèle `CropAgronomicRange`) — l'écran
  `AgronomicRanges.tsx` existe et les appelle. Rien à faire côté routes.
- **`/admin/rulesets`** (gouvernance des règles agronomiques, SOIL-04,
  activation par zone) — **aucun écran**. C'est un sujet distinct, côté
  agronome.

| Route | Permission | Usage |
|---|---|---|
| `GET /admin/rulesets` | `rules.read` | Liste des jeux de règles. Agronome |
| `POST /admin/rulesets` | `rules.write` | Créer un jeu de règles. Agronome |
| `POST /admin/rulesets/:id/validate` | `rules.validate` | **Valider** un jeu de règles. Agronome |
| `POST /admin/rulesets/:id/retire` | `rules.validate` | Retirer. Agronome |

**4 routes.** Le test navigateur demandé porte sur l'écran existant
`AgronomicRanges.tsx`, pas sur celles-ci.

---

## 4. Agriculteur — parcelle et données de terrain

Le bloc le plus volumineux. Un agriculteur qui dépose un relevé géoradar ne peut
aujourd'hui **ni le déposer, ni le voir** depuis une interface.

### 4.1 Dépôt et données géospatiales de la parcelle — 11 routes

| Route | Usage |
|---|---|
| `POST /geospatial/imports` | **Déposer** un relevé GPR ou une image drone |
| `GET /geospatial/imports` | Lister ses dépôts |
| `GET /geospatial/imports/:id` | Détail d'un dépôt |
| `POST /geodata/drones` | Saisir un vol drone |
| `POST /geodata/lab-results` | Saisir un résultat de laboratoire |
| `POST /geodata/satellite` | Saisir une donnée satellite |
| `GET /geodata/plots/:plotId/drones` | Voir les vols d'une parcelle |
| `GET /geodata/plots/:plotId/lab-results` | Voir les analyses |
| `GET /geodata/plots/:plotId/observations` | Voir les observations |
| `GET /geodata/plots/:plotId/satellite` | Voir les données satellite |
| `POST /weather` | Saisir la météo observée |

### 4.2 Prévisions — 3 routes

| Route | Usage |
|---|---|
| `GET /plots/:plotId/forecasts` | Voir les prévisions d'une parcelle |
| `POST /plots/:plotId/forecasts/:parameter` | Lancer une prévision |
| `POST /plots/:plotId/forecasts/:parameter/backtest` | Rejouer une prévision sur le passé |

### 4.3 Saisie et historique — 8 routes

| Route | Usage |
|---|---|
| `POST /data` | Déclarer une donnée |
| `GET /data` | Lister ses données |
| `GET /data/:id/aggregates` | Agrégats d'une donnée |
| `POST /data/:id/aggregates` | Produire des agrégats |
| `PATCH /data/:id/status` | Corriger le statut d'une donnée |
| `POST /data/contracts` | Contrat de donnée |
| `PATCH /plots/:id/crop-history/:historyId` | **Corriger un historique de culture** |
| `POST /iot/ingest` | Ingestion capteur |

### 4.4 Commercial — 7 routes

| Route | Usage |
|---|---|
| `POST /orders` | Passer une commande |
| `POST /lots` | Créer un lot |
| `POST /tenders` | Publier un appel d'offres |
| `POST /tenders/:id/award` | Attribuer |
| `POST /tenders/:id/close` | Clôturer |
| `GET /market-prices` | Prix du marché |
| `GET /productions/:id` | Détail d'une production |

### 4.5 Notifications — 4 routes

| Route | Usage |
|---|---|
| `GET /sms/messages` | Historique des SMS reçus |
| `GET /sms/messages/:id` | Détail d'un SMS |
| `GET /sms/batches` | Campagnes |
| `GET /sms/settings` | Préférences de notification |

### 4.6 Compte — 4 routes

| Route | Usage |
|---|---|
| `POST /auth/verify-email` | **Vérifier son adresse e-mail** |
| `POST /auth/mfa/verify` | **Valider un second facteur** |
| `DELETE /me` | Supprimer son compte |
| `DELETE /media/:id` | Supprimer un média |

> `POST /auth/verify-email` et `POST /auth/mfa/verify` sans écran signifient
> qu'un utilisateur recevant un code par e-mail ou par MFA **n'a aucun endroit
> où le saisir**. À signaler comme anomalie fonctionnelle, pas comme simple
> écran manquant.

**Sous-total agriculteur : 37 routes.**

---

## 5. Agronome — analyse et production de connaissance

### 5.1 Analyses géospatiales — 11 routes

| Route | Usage |
|---|---|
| `POST /geospatial/texture` | Texture du sol |
| `POST /geospatial/subsurface` | Subsurface |
| `POST /geospatial/spectral` | Analyse spectrale |
| `POST /geospatial/spectral/phenology` | Phénologie |
| `POST /geospatial/sensors/quality` | Qualité capteur |
| `POST /geospatial/imagery` | Traitement d'imagerie |
| `POST /geospatial/fusion` | Fusion de sources |
| `POST /geospatial/interpolations/:plotId/:parameter` | Interpoler un paramètre |
| `POST /geospatial/interpolations/:plotId/:parameter/evaluate` | Évaluer l'interpolation |
| `GET /geospatial/interpolations/:plotId` + `/map/:id` | Voir les cartes (2 routes) |

### 5.2 Rapports — 4 routes

`GET /admin/reports` · `PATCH /admin/reports/:id` · `POST /reports` ·
`GET /precision/precision-reports/:id/pdf`

**Sous-total agronome : 15 routes.**

---

## 6. Ni agriculteur ni agronome — 44 routes

Ces routes ont un destinataire réel, mais ce n'est ni l'agriculteur ni
l'agronome. **Je recommande de ne pas les traiter** dans la suite.

| Groupe | Nb | Destinataire |
|---|---|---|
| `GET /public-api/v1/*` (agriculture, crops, farmers, market-prices, prices, products, products/:id/aggregates, projects, regions) | 9 | Consommateurs d'API publique |
| `GET|POST /billing`, `/billing/:id`, `/billing/:id/pdf`, `/billing/:id/settlement` | 5 | Finance / investisseur |
| `GET|PATCH /projects/*`, `/projects/:id/submit`, `/projects/:id/review`, `/projects/:projectId/due-diligence`, `/due-diligence/:id`, `/due-diligence/:id/evidence`, `/due-diligence/:id/checklist` | 8 | Investisseur |
| `GET /admin/feature-flags`, `PUT /admin/feature-flags`, `GET /admin/export/farms`, `GET /admin/channels/messages`, `POST /sms/test-send`, `GET /sms/settings`†, `PATCH /investors/:userId/verify`, `PATCH /listings/:id/moderate` | 8 | Administration |
| `POST /countries/:code`†, `PUT /countries/fx-rates`, `GET /countries/fx-rates/pairs`, `POST /crops`, `PATCH /crops/:id` | 5 | Référentiels |
| `POST /channels/whatsapp/webhook`, `GET /channels/whatsapp/webhook`, `POST /channels/ussd`, `POST /webhooks/twilio/status` | 4 | Machine à machine |
| `GET /`, `GET /docs`, `GET /docs/openapi.json`, `GET /agriculture`, `GET /regions`, `GET /farmers`, `GET /public/farms/:slug/qr.:format` | 7 | Public / technique |

† classé aussi plus haut selon l'usage dominant.

---

## 7. Synthèse et proposition

| Priorité | Routes | Écrans à créer |
|---|---|---|
| **1. Recommandations** | 6 | Compléter l'écran existant (score gradué, version du moteur, règle de combinaison, rappel « adéquation, pas rendement », statut indicatif) |
| **2. Alertes** | 0 orpheline | **Écran à créer** — web + mobile |
| **3. Plages agronomiques** | 4 (`/admin/rulesets`) | Test navigateur sur l'écran existant ; `/admin/rulesets` est un sujet distinct |
| **4. Agriculteur** | 37 | Dépôt géospatial, données de parcelle, prévisions, saisie, commercial, notifications, compte |
| **5. Agronome** | 15 | Analyses géospatiales + rapports |
| 6. Hors périmètre proposé | 44 | — |
| **Total** | **106** | Vérifié par script : sans doublon, sans oubli |

**Mon avis sur l'ordre.** Votre séquence recommandations → alertes → plages
agronomiques est la bonne pour la valeur métier. J'ajouterais une remarque :

- **`POST /auth/verify-email` et `POST /auth/mfa/verify` sans écran** ne sont pas
  un confort manquant mais une **impasse fonctionnelle** : un code envoyé n'a
  nulle part où être saisi. À traiter tôt, indépendamment des priorités.
- **Le dépôt géospatial** vient d'être livré côté API sans aucun écran. Le
  raccorder est court et donne immédiatement un retour visible sur le travail de
  cette semaine.

## 8. Ce que ce classement ne dit pas

- **Aucun écran n'a été piloté.** L'existence d'un fichier d'écran ne prouve pas
  qu'il s'affiche : les écrans web et mobile restent **vérifiés à la
  compilation uniquement**, tant qu'un navigateur ne les a pas conduits.
- Le classement « agriculteur / agronome » est déduit des permissions et du
  domaine métier, **pas d'un usage observé** : aucune télémétrie d'usage n'est
  disponible dans ce dépôt.
- « Sans appel client » est mesuré sur `endpoints.ts`. Un appel construit
  dynamiquement ailleurs échapperait au décompte — je n'en ai pas trouvé, mais
  la mesure porte sur ce fichier.
