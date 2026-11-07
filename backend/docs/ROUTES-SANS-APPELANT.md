# Routes sans appelant client — classement et décision

Le contrat frontend/backend compte **385 routes** côté serveur et **277 appels clients** distincts, sans aucun appel client visant une route inexistante. **108 routes** ne sont appelées ni par le web ni par le mobile.

**Aucune n'a été supprimée.** Une route sans écran n'est pas une route inutile : elle peut servir au back-office, à un fournisseur externe, à l'exploitation, ou à un écran pas encore écrit. Ce document statue sur chacune, avec la preuve qui fonde la décision.

## Méthode

Trois sources croisées, aucune lecture au jugé :

1. **La déclaration réelle** de la route dans son fichier (`src/modules/**/**.routes.js`) : présence d'`authenticate`, de `resolveTenant`, et la permission passée à `authorize(…)`. Plusieurs routeurs partagent le même préfixe (`/admin` est monté deux fois) et le chemin est souvent sur une ligne distincte de `router.get(` : l'analyseur traite donc le texte entier et s'arrête à la déclaration suivante, pour ne pas attribuer à une route les middlewares de sa voisine.
2. **La couverture de test** : recherche du chemin littéral dans `tests/**`.
3. **Le comportement réel** : les 385 routes ont été interrogées **sans jeton** sur le serveur démarré (`tests/e2e/anonyme.probe.mjs`), et la carte des statuts est figée dans `tests/e2e/fixtures/surface-anonyme.json`.

> Une première version de l'analyseur classait `POST /crops` et `PUT /countries/fx-rates` en « points d'entrée non protégés ». C'était **faux** : ces routes portent `authenticate` route par route, et `authorize` renvoie de toute façon 403 à un anonyme puisque, sans utilisateur, la liste de rôles est vide. L'erreur venait d'une fenêtre d'analyse trop large. La sonde anonyme a tranché.

## Résultat

| Catégorie | Routes |
| --- | ---: |
| Back-office (permission exigée) | 78 |
| Point d’entrée externe (webhook fournisseur ou public) | 13 |
| Métier sans écran client | 12 |
| Opération / documentation | 3 |
| Protégée par permission seule (pas d’`authenticate`) | 2 |
| **Total** | **108** |

Couvertes par au moins une recette : **28** sur 108.

## Décision par catégorie

### Back-office (permission exigée) — 78 routes

**Décision : Conserver — back-office, réservé par permission.**

| Route | Permission | Statut anonyme | Recette |
| --- | --- | ---: | --- |
| `DELETE /media/:id` | `media.delete` | 401 | — |
| `GET /admin/channels/messages` | `channels.read` | 401 | — |
| `GET /admin/export/farms` | `admin.users` | 401 | — |
| `GET /admin/feature-flags` | `rules.read` | 401 | intelligence.e2e.test.mjs |
| `GET /admin/reports` | `reports.review` | 401 | — |
| `GET /admin/rulesets` | `rules.read` | 401 | intelligence.e2e.test.mjs |
| `GET /ai/models` | `models.read` | 401 | — |
| `GET /ai/models/:id` | `models.read` | 401 | — |
| `GET /billing` | `invoices.read` | 401 | — |
| `GET /billing/:id` | `invoices.read` | 401 | — |
| `GET /billing/:id/pdf` | `invoices.read` | 401 | — |
| `GET /data` | `data.read` | 401 | — |
| `GET /data/:id/aggregates` | `data.read` | 401 | — |
| `GET /geodata/plots/:plotId/drones` | `geodata.read` | 401 | — |
| `GET /geodata/plots/:plotId/lab-results` | `lab.read` | 401 | — |
| `GET /geodata/plots/:plotId/observations` | `geodata.read` | 401 | — |
| `GET /geodata/plots/:plotId/satellite` | `geodata.read` | 401 | — |
| `GET /geospatial/imports` | `geospatial.read` | 401 | geospatialQuota.e2e.test.mjs |
| `GET /geospatial/imports/:id` | `geospatial.read` | 401 | geospatialUpload.e2e.test.mjs |
| `GET /geospatial/imports/processing` | `geospatial.read` | 401 | geospatialUpload.e2e.test.mjs |
| `GET /geospatial/interpolations/:plotId` | `geospatial.read` | 401 | — |
| `GET /geospatial/interpolations/map/:id` | `geospatial.read` | 401 | — |
| `GET /plots/:plotId/forecasts` | `forecast.read` | 401 | — |
| `GET /precision/precision-reports/:id/pdf` | `precision.read` | 401 | — |
| `GET /productions/:id` | `productions.read` | 401 | — |
| `GET /recommendations/engine` | `recommendation.read` | 401 | scoringEngine.e2e.test.mjs |
| `GET /sms/batches` | `sms.read` | 401 | smsVerification.e2e.test.mjs |
| `GET /sms/messages` | `sms.read` | 401 | smsTwilio.e2e.test.mjs |
| `GET /sms/messages/:id` | `sms.read` | 401 | — |
| `PATCH /admin/reports/:id` | `reports.review` | 401 | — |
| `PATCH /countries/:code` | `countries.write` | 401 | — |
| `PATCH /crops/:id` | `crops.write` | 401 | — |
| `PATCH /data/:id/status` | `dataproducts.manage` | 401 | — |
| `PATCH /investors/:userId/verify` | `investors.verify` | 401 | — |
| `PATCH /listings/:id/moderate` | `listings.moderate` | 401 | — |
| `PATCH /plots/:id/crop-history/:historyId` | `history.write` | 401 | — |
| `PATCH /projects/:id` | `projects.write` | 401 | — |
| `PATCH /projects/:id/review` | `projects.review` | 401 | — |
| `POST /admin/rulesets` | `rules.write` | 401 | intelligence.e2e.test.mjs |
| `POST /admin/rulesets/:id/retire` | `rules.validate` | 401 | — |
| `POST /admin/rulesets/:id/validate` | `rules.validate` | 401 | — |
| `POST /ai/models` | `models.write` | 401 | — |
| `POST /ai/models/:id/promote` | `models.promote` | 401 | — |
| `POST /ai/models/:id/retire` | `models.write` | 401 | — |
| `POST /billing` | `invoices.write` | 401 | — |
| `POST /billing/:id/settlement` | `invoices.write` | 401 | — |
| `POST /crops` | `crops.write` | 401 | — |
| `POST /data` | `dataproducts.manage` | 401 | — |
| `POST /data/:id/aggregates` | `dataproducts.manage` | 401 | — |
| `POST /data/contracts` | `dataproducts.manage` | 401 | — |
| `POST /geodata/drones` | `geodata.write` | 401 | — |
| `POST /geodata/lab-results` | `lab.write` | 401 | — |
| `POST /geodata/satellite` | `geodata.write` | 401 | — |
| `POST /geospatial/fusion` | `geospatial.write` | 401 | — |
| `POST /geospatial/imagery` | `geospatial.write` | 401 | — |
| `POST /geospatial/imports` | `geospatial.write` | 401 | geospatialQuota.e2e.test.mjs |
| `POST /geospatial/imports/:id/process` | `geospatial.write` | 401 | — |
| `POST /geospatial/imports/process-pending` | `geospatial.write` | 401 | geospatialUpload.e2e.test.mjs |
| `POST /geospatial/imports/upload` | `geospatial.write` | 401 | geospatialUpload.e2e.test.mjs |
| `POST /geospatial/interpolations/:plotId/:parameter` | `geospatial.write` | 401 | — |
| `POST /geospatial/interpolations/:plotId/:parameter/evaluate` | `geospatial.read` | 401 | — |
| `POST /geospatial/sensors/quality` | `geospatial.write` | 401 | — |
| `POST /geospatial/spectral` | `geospatial.write` | 401 | — |
| `POST /geospatial/spectral/phenology` | `geospatial.write` | 401 | — |
| `POST /geospatial/subsurface` | `geospatial.write` | 401 | — |
| `POST /geospatial/texture` | `geospatial.read` | 401 | — |
| `POST /lots` | `lots.write` | 401 | journeys.e2e.test.mjs |
| `POST /orders` | `orders.write` | 401 | journeys.e2e.test.mjs |
| `POST /plots/:plotId/forecasts/:parameter` | `forecast.write` | 401 | — |
| `POST /plots/:plotId/forecasts/:parameter/backtest` | `forecast.read` | 401 | — |
| `POST /projects/:id/submit` | `projects.write` | 401 | — |
| `POST /reports` | `reports.create` | 401 | — |
| `POST /sms/test-send` | `sms.send` | 401 | smsTwilio.e2e.test.mjs |
| `POST /tenders` | `tenders.write` | 401 | channels.e2e.test.mjs |
| `POST /tenders/:id/award` | `tenders.write` | 401 | — |
| `POST /tenders/:id/close` | `tenders.write` | 401 | — |
| `POST /weather` | `weather.read` | 401 | — |
| `PUT /admin/feature-flags` | `flags.write` | 401 | intelligence.e2e.test.mjs |

### Point d’entrée externe (webhook fournisseur ou public) — 13 routes

**Décision : Conserver — l'appelant est le fournisseur, pas un client.**

| Route | Permission | Statut anonyme | Recette |
| --- | --- | ---: | --- |
| `GET /channels/whatsapp/webhook` | `—` | 403 | — |
| `GET /public-api/v1/agriculture` | `—` | 401 | — |
| `GET /public-api/v1/crops` | `—` | 401 | — |
| `GET /public-api/v1/farmers` | `—` | 401 | journeys.e2e.test.mjs |
| `GET /public-api/v1/market-prices` | `—` | 401 | — |
| `GET /public-api/v1/prices` | `—` | 401 | req-v5.integration.test.mjs |
| `GET /public-api/v1/products` | `—` | 401 | req-v5.integration.test.mjs |
| `GET /public-api/v1/products/:id/aggregates` | `—` | 401 | — |
| `GET /public-api/v1/projects` | `—` | 401 | — |
| `GET /public-api/v1/regions` | `—` | 401 | — |
| `GET /public/farms/:slug/qr.:format` | `—` | 422 | channels.e2e.test.mjs |
| `POST /channels/ussd` | `—` | 422 | channels.e2e.test.mjs |
| `POST /webhooks/twilio/status` | `—` | 403 | smsTwilio.e2e.test.mjs |

### Métier sans écran client — 12 routes

**Décision : Conserver — API métier, aucun écran ne l’appelle encore.**

| Route | Permission | Statut anonyme | Recette |
| --- | --- | ---: | --- |
| `DELETE /me` | `—` | 401 | journeys.e2e.test.mjs |
| `GET /agriculture` | `—` | 401 | — |
| `GET /farmers` | `—` | 401 | journeys.e2e.test.mjs |
| `GET /market-prices` | `—` | 401 | — |
| `GET /projects/:projectId/due-diligence` | `—` | 401 | — |
| `GET /regions` | `—` | 401 | — |
| `GET /sms/settings` | `—` | 401 | smsTwilio.e2e.test.mjs |
| `PATCH /due-diligence/:id` | `—` | 401 | — |
| `POST /channels/whatsapp/webhook` | `—` | 403 | — |
| `POST /due-diligence/:id/evidence` | `—` | 401 | — |
| `POST /iot/ingest` | `—` | 422 | satellite.e2e.test.mjs |
| `POST /projects/:projectId/due-diligence/checklist` | `—` | 401 | — |

### Opération / documentation — 3 routes

**Décision : Conserver — exploitation et documentation.**

| Route | Permission | Statut anonyme | Recette |
| --- | --- | ---: | --- |
| `GET /` | `—` | 200 | webLinks.test.mjs |
| `GET /docs` | `—` | 200 | — |
| `GET /docs/openapi.json` | `—` | 200 | — |

### Protégée par permission seule (pas d’`authenticate`) — 2 routes

**Décision : Conserver — lecture publique par conception, écriture refusée.**

| Route | Permission | Statut anonyme | Recette |
| --- | --- | ---: | --- |
| `GET /countries/fx-rates/pairs` | `fx.read` | 200 | — |
| `PUT /countries/fx-rates` | `fx.write` | 403 | — |

## Ce que la sonde anonyme établit

| Statut obtenu sans jeton | Routes | Signification |
| ---: | ---: | --- |
| 200 | 11 | public, par conception |
| 401 | 355 | jeton exigé |
| 403 | 4 | permission refusée à l'anonyme |
| 404 | 5 | ressource absente (paramètre factice) |
| 422 | 10 | validation avant authentification |
| **Total** | **385** | |

Les **11** réponses 2xx sont :

- `GET /`
- `GET /countries`
- `GET /countries/fx-rates/pairs`
- `GET /crops`
- `GET /docs`
- `GET /docs/openapi.json`
- `GET /health`
- `GET /public/farms`
- `GET /public/map`
- `GET /public/soil-stats`
- `POST /auth/resend-verification`

Les référentiels (`/countries`, `/countries/fx-rates/pairs`, `/crops`) sont publics **par conception** : leur permission est `EVERYONE` dans `src/shared/permissions.js`. `POST /auth/resend-verification` répond 200 même pour une adresse inconnue, volontairement, pour ne pas révéler quels comptes existent.

Les 422 sont des endpoints publics dont la validation s'exécute avant l'authentification (`/auth/*`, `/public/farms/:slug/contact`, `/iot/ingest`, `/channels/ussd`) : aucune donnée n'est exposée, seul le motif de refus diffère d'un 401.

**Aucun 5xx.** Un premier run en affichait 11 : c'était un défaut de la sonde, pas de l'application. Le routeur était importé avant `startHarness()`, donc `config/env.js` était évalué avant que la base embarquée n'existe et Prisma visait le port 6543. L'import a été déplacé après le démarrage.

## Garde-fou

`tests/e2e/surfacePublique.e2e.test.mjs` rejoue cette sonde à chaque exécution et compare la carte complète des 385 statuts à la référence. Une route ajoutée sans `authenticate`, ou une permission élargie par erreur, fait échouer la suite.

Contre-épreuves menées pour vérifier que la suite mord réellement :

- ajout d'une route publique `GET /crops/contre-epreuve` → **échec** (`référence absente → observé 404`) ;
- remplacement de `authorize('fx.write')` par `authorize('fx.read')` sur `PUT /countries/fx-rates` → **échec** (`attendu 403, obtenu 422`).

Une troisième tentative n'a **pas** mordu, et c'est elle qui a fait durcir la suite : retirer `authenticate` de `POST /crops` laisse `resolveTenant`, qui renvoie lui aussi 401 — la mutation est donc sans effet HTTP observable. Un test qui ne cherche que les 2xx ne l'aurait de toute façon pas vue ; d'où le contrôle exhaustif route par route.

## À faire côté produit

Les **12 routes métier sans écran** sont les seules qui appellent une décision produit : soit un écran les consomme, soit elles restent de l'API pour intégration. Elles ne sont ni supprimées ni masquées.

Parmi elles, **8** n'ont aucune recette : `GET /agriculture`, `GET /market-prices`, `GET /projects/:projectId/due-diligence`, `GET /regions`, `PATCH /due-diligence/:id`, `POST /channels/whatsapp/webhook`, `POST /due-diligence/:id/evidence`, `POST /projects/:projectId/due-diligence/checklist`. Ce sont les premières à couvrir.
