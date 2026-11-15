# Inventaire du backend — AGRIKONNECT AFRICA

Inventaire établi à partir du code source réel (`backend/`), état de la copie de travail au 14/11/2026 (commit `7b8fda2` + modifications non committées). Les tableaux marqués *(généré)* sont produits par extraction automatique depuis le code, sans recopie manuelle.

---

## 1. Identification

| Élément | Valeur | Source |
|---|---|---|
| Nom | AGRIKONNECT AFRICA — API | `package.json`, `src/app.js` |
| Version applicative annoncée | `0.1.0` (package) · `5.0.0` (racine `/` et `/docs`) · `1.0.0` (`/health`) | `package.json`, `app.js`, `routes/index.js` — **trois numéros incohérents** |
| Périmètre fonctionnel | V1 FARM · V2 MARKET · V3 INTELLIGENCE · V4 INVEST · V5 GLOBAL + gouvernance « V6 » Super Admin | `README.md`, `permissions.js` |
| Préfixe API | `/api/v1` | `config/env.js:443` |
| Port | 4000 (défaut) | `env.js:18` |
| Contrat OpenAPI | `src/docs/openapi.json` (21 179 lignes, généré par `scripts/generate-openapi.mjs`), servi sur `/api/v1/docs/openapi.json` | `app.js` |

## 2. Arborescence

```
backend/
├── src/
│   ├── app.js (189)            server.js (136)
│   ├── config/                 env.js (450) · hardware.js (1093) · messagingConfig.js (252)
│   │                           satellite.js (138) · supabase.js (28) · prisma.js (16)
│   ├── middleware/             auth · tenant · authorize · validate · rateLimit · idempotency
│   │                           apiKey · settingsEffects
│   ├── shared/                 permissions · audit · geo · crypto · money · units · ids · slug
│   │                           pagination · matching · orderStateMachine · multipart · fileMagic
│   │                           fileParsers · dataMode · quietHours · quota · resource · pdf
│   │                           senderId · links · events · conversations · transaction
│   │                           errors/ApiError · http/(response, errorHandler, logger, requestId,
│   │                           notFound, asyncHandler) · startup/degradedServices
│   ├── integrations/           email · sms · twilio · twilioErrors · twilioSignature · satellite
│   │                           geospatial · storage · s3
│   ├── realtime/               index.js (Socket.IO) · bus.js
│   ├── jobs/                   index.js (planificateur)
│   ├── modules/                54 dossiers de domaine (§6)
│   ├── routes/index.js         agrégation des routeurs (§5)
│   └── docs/openapi.json
├── prisma/                     schema.prisma (3098) · seed.js (280) · 21 migrations
├── geoai/                      moteur Python (server, engine, soil, spectral, imagery, fusion,
│                               subsurface, interpolation, forecast, sensors, geometry, config)
├── tests/                      65 fichiers + e2e/ (36) — harness Postgres embarqué
├── scripts/                    contrôles (env, perms, champs, migrations, montages, traçabilité…)
├── docs/                       ~25 documents (API, déploiement, géospatial, NFR, traçabilité…)
├── storage/ · tmp/             stockage local des dépôts géospatiaux / temporaire
└── *.sql, *.mjs                scripts ponctuels (bootstrap super admin, index complémentaires,
                                correctifs de baseline)
```

## 3. Configuration

### 3.1 Variables d'environnement validées (`src/config/env.js`, schéma Zod)

| Groupe | Variables |
|---|---|
| Socle | `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ORIGIN`, `PUBLIC_WEB_URL`, `REALTIME_ENABLED`, `JOBS_ENABLED` |
| Base / Supabase | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (optionnelle), `SUPABASE_BUCKET_MEDIA`, `SUPABASE_BUCKET_PRIVATE` |
| Stockage géospatial | `GEOSPATIAL_STORAGE_DRIVER` (`local`/`object`/`s3`), `GEOSPATIAL_STORAGE_DIR`, `GEOSPATIAL_BUCKET`, `GEOSPATIAL_MULTIPART_MAX_BYTES`, `GEOSPATIAL_JSON_MAX_BYTES`, `GEOSPATIAL_ORG_QUOTA_BYTES`, `S3_*` |
| SMS | `SMS_PROVIDER`, `SMS_WEBHOOK_URL`, `SMS_API_KEY`, `SMS_SENDER`, `TWILIO_*` (8), `SMS_DAILY_LIMIT_*`, `SMS_ALERT_PURPOSE`, `SMS_QUIET_*`, `SMS_DEFAULT_TIMEZONE` |
| E-mail | `EMAIL_PROVIDER`, `EMAIL_WEBHOOK_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`, `RESEND_API_BASE_URL`, `SENDGRID_API_BASE_URL`, `EMAIL_REQUEST_TIMEOUT_MS`, `EMAIL_VERIFIED_DOMAINS` |
| Règles métier | `OTP_TTL_MINUTES`, `OTP_MAX_SENDS_PER_HOUR`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `ACCESS_TOKEN_TTL_MINUTES`, `SIGNED_URL_TTL_SECONDS`, `PUBLIC_COORD_DECIMALS`, `ORDER_RESPONSE_DAYS`, `DISPUTE_SLA_DAYS`, `AGGREGATE_MIN_GROUP_SIZE`, `NOTIFICATION_RETENTION_DAYS`, `ALERT_RENOTIFY_HOURS`, `DATAROOM_ACCESS_TTL_DAYS`, `ALERT_ESCALATION_*` |
| Moteur GeoAI | `GEOAI_URL`, `GEOAI_TIMEOUT_MS`, `GEOAI_TOKEN`, `GEOAI_RETRIES` |
| IA / agronomie | `AGRONOMIC_DATASET`, `RECOMMENDATION_ENGINE_VERSION`, `ANOMALY_DETECTION_ENABLED`, `SIMULATION_ENABLED` |
| Satellite | `SATELLITE_PROVIDER`, `SATELLITE_API_URL`, `SATELLITE_API_KEY`, `SATELLITE_ACQUISITION_ENABLED`, `SATELLITE_REFRESH_HOURS`, `SATELLITE_CLOUD_REJECT_PCT` |
| IoT | `LORAWAN_MQTT_URL`, `LORAWAN_MQTT_USERNAME`, `LORAWAN_MQTT_PASSWORD` (déclarées, aucun client MQTT dans les dépendances) |

### 3.2 Variables lues **hors schéma** (non validées)

`MFA_ENCRYPTION_KEY`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `API_DAILY_QUOTA`, `AI_DAILY_QUOTA_PER_USER`, `AI_DAILY_QUOTA_PER_ORG`, `LISTING_EXPIRY_MINUTES`, et relecture directe de `GEOAI_*` dans `integrations/geospatial.js`.

### 3.3 Variables présentes dans `.env.example` mais non utilisées par le backend

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CONTACT_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM` (le code utilise `EMAIL_API_KEY` / `EMAIL_FROM`). ⚠️ Plusieurs contiennent des **secrets réels** (constat C-01, valeurs non reproduites).

### 3.4 Fichiers de configuration

| Fichier | Rôle | Observation |
|---|---|---|
| `backend/.env` | Configuration locale | Ignoré par git (`backend/.gitignore:2`) ; pointe vers une base Supabase distante |
| `backend/.env.example` | Modèle | **Suivi par git, contient des secrets** (C-01) |
| `src/config/hardware.js` | Configuration matériel/capteurs (1 093 l.), garde de démarrage `SIMULATION` interdit en production | |
| `src/config/messagingConfig.js` | Vérification de cohérence SMS/e-mail au démarrage | |
| `prisma/migrations/migration_lock.toml` | Fournisseur `postgresql` | |

## 4. Middlewares

| Middleware | Fichier | Rôle | Remarques |
|---|---|---|---|
| `helmet` | `app.js` | En-têtes de sécurité | Configuration par défaut |
| `cors` | `app.js:44-55` | Liste blanche `CORS_ORIGIN` | `*` accepté ; refus → 500 (F-11) |
| `requestId` | `shared/http/requestId.js` | `X-Request-Id` | Placé avant les parseurs |
| Parseur JSON bifurqué | `app.js` | 1 Mo global ; 100 Mo pour `/geospatial/imports` après limite + auth ; aucun parseur pour `/geospatial/imports/upload` | Bon design |
| `rejectOperators` | `middleware/validate.js:34-48` | Rejette les clés `$…` et `\0` | |
| `globalLimiter` / `authLimiter` / `writeLimiter` / `publicRateLimit` | `middleware/rateLimit.js` | 300/15 min · 10/15 min · 30/min · 60/15 min (production) | Store mémoire (M-08) |
| `settingsEffects` | `middleware/settingsEffects.js` | Modules désactivés, mode maintenance | Contournable (M-03) |
| `authenticate` / `optionalAuth` / `requireVerified` | `middleware/auth.js` | JWT Supabase → `req.user` | `requireVerified` jamais utilisé (H-07) |
| `resolveTenant` / `assertOwnership` | `middleware/tenant.js` | Organisation active, isolation | Union des rôles (H-03) |
| `authorize` / `requireRole` / `requireAdmin` / `requireMfa` / `requireSuperAdmin` | `middleware/authorize.js` | RBAC | `requireMfa` sur drapeau (C-03) ; `requireRole`/`requireAdmin` non utilisés dans les routes |
| `validate(schema, source)` | `middleware/validate.js` | Zod, remplace l'entrée par la version nettoyée | |
| `idempotency(scope)` | `middleware/idempotency.js` | Rejeu des réponses | Non lié à l'utilisateur (M-01) |
| `apiKeyAuth(scope)` | `middleware/apiKey.js` | API publique de données | Quota contournable (M-14) |
| `notFound` / `errorHandler` | `shared/http/*` | 404 / normalisation des erreurs (Zod, Prisma, taille) | Pile d'appel exposée en `development` uniquement |

## 5. Montage des routes *(généré depuis `src/routes/index.js`)*

Ordre de montage significatif : plusieurs routeurs partagent un préfixe (`/plots` ×5, `/` ×4, `/admin` ×5, `/public` ×2) ; le premier routeur dont une route correspond répond.

| Préfixe monté | Routeur | Fichier source |
|---|---|---|
| `/api/v1/public` | publicRoutes | `backend/src/modules/public/public.routes.js` |
| `/api/v1/public/blog-posts` | publicBlogRoutes | `backend/src/modules/blog/blog.routes.js` |
| `/api/v1/public` | publicLotsRoutes | `backend/src/modules/traceability/public.routes.js` |
| `/api/v1/countries` | countriesRoutes | `backend/src/modules/countries/countries.routes.js` |
| `/api/v1/public-api/v1` | publicApiRoutes | `backend/src/modules/publicapi/publicapi.routes.js` |
| `/api/v1/auth` | authRoutes | `backend/src/modules/auth/auth.routes.js` |
| `/api/v1/me` | usersRoutes | `backend/src/modules/users/users.routes.js` |
| `/api/v1/organizations` | organizationsRoutes | `backend/src/modules/organizations/organizations.routes.js` |
| `/api/v1/crops` | cropsRoutes | `backend/src/modules/crops/crops.routes.js` |
| `/api/v1/farms` | farmsRoutes | `backend/src/modules/farms/farms.routes.js` |
| `/api/v1/plots` | plotsRoutes | `backend/src/modules/plots/plots.routes.js` |
| `/api/v1/plots` | soilRoutes | `backend/src/modules/soil/soil.routes.js` |
| `/api/v1/plots` | geospatialPlotsRoutes | `backend/src/modules/geospatial/geospatial.routes.js` |
| `/api/v1/plots` | recommendationPlotsRoutes | `backend/src/modules/recommendation/recommendation.routes.js` |
| `/api/v1/recommendations` | recommendationRoutes | `backend/src/modules/recommendation/recommendation.routes.js` |
| `/api/v1/agronomic-ranges` | agronomicRangesRoutes | `backend/src/modules/recommendation/agronomicRanges.routes.js` |
| `/api/v1/sms` | smsDeliveryRoutes | `backend/src/modules/smsDelivery/smsDelivery.routes.js` |
| `/api/v1/webhooks/twilio` | twilioWebhookRouter | `backend/src/modules/smsDelivery/smsDelivery.routes.js` |
| `/api/v1/alerts` | alertsRoutes | `backend/src/modules/alerts/alerts.routes.js` |
| `/api/v1/plots` | forecastRoutes | `backend/src/modules/forecast/forecast.routes.js` |
| `/api/v1/ai/models` | modelVersionsRoutes | `backend/src/modules/ai/modelVersions.routes.js` |
| `/api/v1/productions` | productionsRoutes | `backend/src/modules/productions/productions.routes.js` |
| `/api/v1/seasons` | seasonsRoutes | `backend/src/modules/seasons/seasons.routes.js` |
| `/api/v1/geospatial/imports` | geospatialImportRoutes | `backend/src/modules/geospatialImport/geospatialImport.routes.js` |
| `/api/v1/cooperatives` | cooperativesRoutes | `backend/src/modules/cooperatives/cooperatives.routes.js` |
| `/api/v1/media` | mediaRoutes | `backend/src/modules/media/media.routes.js` |
| `/api/v1/dashboard` | dashboardRoutes | `backend/src/modules/dashboard/dashboard.routes.js` |
| `/api/v1/geospatial/interpolations` | interpolationRoutes | `backend/src/modules/geospatial/interpolation.routes.js` |
| `/api/v1/satellite` | satelliteRoutes | `backend/src/modules/satellite/acquisition.routes.js` |
| `/api/v1/anomalies` | anomalyRoutes | `backend/src/modules/anomalies/anomalies.routes.js` |
| `/api/v1/geospatial` | geospatialRoutes | `backend/src/modules/geospatial/geospatial.routes.js` |
| `/api/v1/verifications` | verificationRoutes | `backend/src/modules/verification/verification.routes.js` |
| `/api/v1/reports` | reportsRoutes | `backend/src/modules/reports/reports.routes.js` |
| `/api/v1/listings` | listingsRoutes | `backend/src/modules/market/listings/listings.routes.js` |
| `/api/v1/purchase-requests` | requestsRoutes | `backend/src/modules/market/requests/requests.routes.js` |
| `/api/v1/market` | offersRoutes | `backend/src/modules/market/offers/offers.routes.js` |
| `/api/v1/orders` | ordersRoutes | `backend/src/modules/market/orders/orders.routes.js` |
| `/api/v1/inventory` | inventoryRoutes | `backend/src/modules/market/inventory/inventory.routes.js` |
| `/api/v1/` | reviewsRoutes | `backend/src/modules/market/reviews/reviews.routes.js` |
| `/api/v1/transport` | transportRoutes | `backend/src/modules/transport/transport.routes.js` |
| `/api/v1/messaging` | messagingRoutes | `backend/src/modules/messaging/messaging.routes.js` |
| `/api/v1/notifications` | notificationsRoutes | `backend/src/modules/notifications/notifications.routes.js` |
| `/api/v1/billing` | billingRoutes | `backend/src/modules/billing/billing.routes.js` |
| `/api/v1/sync` | syncRoutes | `backend/src/modules/sync/sync.routes.js` |
| `/api/v1/ai` | aiRoutes | `backend/src/modules/ai/ai.routes.js` |
| `/api/v1/weather` | weatherRoutes | `backend/src/modules/weather/weather.routes.js` |
| `/api/v1/prices` | pricesRoutes | `backend/src/modules/prices/prices.routes.js` |
| `/api/v1/lots` | traceabilityRoutes | `backend/src/modules/traceability/traceability.routes.js` |
| `/api/v1/certifications` | certificationsRoutes | `backend/src/modules/certifications/certifications.routes.js` |
| `/api/v1/iot` | iotRoutes | `backend/src/modules/iot/iot.routes.js` |
| `/api/v1/geodata` | geodataRoutes | `backend/src/modules/geodata/geodata.routes.js` |
| `/api/v1/projects` | projectsRoutes | `backend/src/modules/projects/projects.routes.js` |
| `/api/v1/dataroom` | dataroomRoutes | `backend/src/modules/dataroom/dataroom.routes.js` |
| `/api/v1/` | dueDiligenceRoutes | `backend/src/modules/duediligence/duediligence.routes.js` |
| `/api/v1/` | reportingRoutes | `backend/src/modules/reporting/reporting.routes.js` |
| `/api/v1/funding` | fundingRoutes | `backend/src/modules/funding/funding.routes.js` |
| `/api/v1/investors` | investorsRoutes | `backend/src/modules/investors/investors.routes.js` |
| `/api/v1/precision` | precisionRoutes | `backend/src/modules/precision/precision.routes.js` |
| `/api/v1/invest` | investDashboardRoutes | `backend/src/modules/investdashboard/dashboard.routes.js` |
| `/api/v1/tenders` | tendersRoutes | `backend/src/modules/tenders/tenders.routes.js` |
| `/api/v1/exports` | exportsRoutes | `backend/src/modules/exports/exports.routes.js` |
| `/api/v1/api-clients` | apiClientsRoutes | `backend/src/modules/apiclients/apiclients.routes.js` |
| `/api/v1/data` | dataProductsRoutes | `backend/src/modules/dataproducts/dataproducts.routes.js` |
| `/api/v1/insights` | insightsRoutes | `backend/src/modules/insights/insights.routes.js` |
| `/api/v1/admin/verifications` | adminVerificationRoutes | `backend/src/modules/verification/verification.routes.js` |
| `/api/v1/admin` | rulesetRoutes | `backend/src/modules/soil/rulesets.routes.js` |
| `/api/v1/admin/channels` | adminChannelRoutes | `backend/src/modules/channels/channels.routes.js` |
| `/api/v1/channels` | channelsWebhookRoutes | `backend/src/modules/channels/channels.routes.js` |
| `/api/v1/investment` | investmentHubRoutes | `backend/src/modules/investors/hub.routes.js` |
| `/api/v1/admin/reports` | adminReportRoutes | `backend/src/modules/reports/reports.routes.js` |
| `/api/v1/admin` | adminRoutes | `backend/src/modules/admin/admin.routes.js` |
| `/api/v1/admin/blog-posts` | adminBlogRoutes | `backend/src/modules/blog/blog.routes.js` |
| `/api/v1/` | dataAliasRouter | `backend/src/modules/publicapi/publicapi.routes.js` |

Route hors routeur : `GET /api/v1/health` (`routes/index.js`), `GET /api/v1/docs`, `GET /api/v1/docs/openapi.json`, `GET /` (`app.js`). Temps réel : Socket.IO sur le chemin `/realtime`.

## 6. Modules, routes et permissions *(généré)*

54 dossiers de modules. Nombre de déclarations de routes et permissions RBAC effectivement utilisées par module :

| Module | Routes | Permissions utilisées |
|---|:-:|---|
| `admin` | 37 | admin.jobs, admin.users, admin.dashboard, admin.audit, admin.settings |
| `ai` | 13 | ai.write, ai.read, ai.review, models.read, models.write, models.promote |
| `alerts` | 5 | alerts.read, alerts.write |
| `anomalies` | 6 | anomaly.read, anomaly.write, anomaly.review |
| `apiclients` | 6 | apiclients.read, apiclients.manage |
| `auth` | 16 | — |
| `billing` | 5 | invoices.read, invoices.write |
| `blog` | 6 | admin.content |
| `certifications` | 6 | certifications.read, certifications.write, certifications.verify |
| `channels` | 4 | channels.read |
| `cooperatives` | 12 | cooperatives.read, cooperatives.write, cooperatives.members |
| `countries` | 6 | countries.read, countries.write, fx.read, fx.write |
| `crops` | 4 | crops.read, crops.write |
| `dashboard` | 1 | — |
| `dataproducts` | 6 | data.read, dataproducts.manage |
| `dataroom` | 6 | dataroom.read, dataroom.write, dataroom.request, dataroom.decide |
| `duediligence` | 4 | duediligence.read, duediligence.write |
| `exports` | 5 | export.read, export.write |
| `farms` | 6 | farms.read, farms.write, farms.delete |
| `forecast` | 3 | forecast.write, forecast.read |
| `funding` | 4 | funding.read, funding.write |
| `geodata` | 7 | geodata.read, geodata.write, lab.read, lab.write |
| `geospatial` | 17 | geospatial.write, geospatial.read |
| `geospatialImport` | 7 | geospatial.write, geospatial.read |
| `insights` | 4 | insights.read |
| `investdashboard` | 1 | projects.read |
| `investors` | 11 | investors.read, investors.write, projects.write, investors.verify |
| `iot` | 6 | iot.read, iot.write |
| `market/inventory` | 4 | inventory.read, inventory.write |
| `market/listings` | 9 | listings.read, listings.write, messages.write, listings.media, listings.moderate |
| `market/offers` | 3 | offers.write, offers.read |
| `market/orders` | 9 | orders.write, orders.read, orders.review, disputes.review |
| `market/requests` | 5 | requests.read, requests.write |
| `market/reviews` | 5 | reviews.write, reviews.moderate, reviews.read |
| `media` | 4 | media.upload, media.delete |
| `messaging` | 7 | messages.write, messages.read, messages.moderate |
| `notifications` | 5 | notifications.read, notifications.write |
| `organizations` | 4 | — |
| `plots` | 8 | plots.read, plots.write, plots.delete, history.read, history.write |
| `precision` | 6 | precision.read, precision.write |
| `prices` | 4 | prices.read, prices.write |
| `productions` | 6 | productions.read, productions.write |
| `projects` | 6 | projects.read, projects.write, projects.review |
| `public` | 6 | — |
| `publicapi` | 13 | — |
| `recommendation` | 15 | ranges.read, ranges.write, ranges.validate, recommendation.write, recommendation.read |
| `reporting` | 3 | reporting.read, reporting.write |
| `reports` | 3 | reports.create, reports.review |
| `satellite` | 3 | satellite.read, satellite.write |
| `seasons` | 7 | seasons.read, seasons.write |
| `smsDelivery` | 9 | sms.consent, sms.read, sms.send |
| `soil` | 21 | rules.read, rules.write, rules.validate, flags.write, soil.read, soil.write, soil.recommend |
| `sync` | 4 | sync.write |
| `tenders` | 6 | tenders.read, tenders.write, tenders.respond |
| `traceability` | 7 | lots.read, lots.write |
| `transport` | 6 | transport.read, transport.write |
| `users` | 5 | — |
| `verification` | 4 | verifications.create, verifications.read, verifications.review |
| `weather` | 4 | weather.read |

Les modules sans permission (`auth`, `users`, `organizations`, `public`, `publicapi`, `dashboard`) reposent respectivement sur : routes publiques/limiteur, soi-même, appartenance (H-02), public, clé d'API, tenant.

## 7. Contrôleurs, services, schémas *(généré)*

Fichiers JavaScript de chaque dossier de module, avec leur nombre de lignes. Le motif `*.controller.js` n'existe que dans 17 dossiers ; ailleurs les handlers sont écrits directement dans `*.routes.js`.

| Dossier | Fichiers (lignes) |
|---|---|
| `modules/admin` | `admin.controller.js` (85), `admin.monitoring.controller.js` (37), `admin.monitoring.routes.js` (51), `admin.monitoring.schema.js` (19), `admin.monitoring.service.js` (253), `admin.notifications.routes.js` (33), `admin.notifications.schema.js` (44), `admin.notifications.service.js` (137), `admin.operations.routes.js` (52), `admin.operations.schema.js` (44), `admin.operations.service.js` (154), `admin.routes.js` (163), `admin.schema.js` (136), `admin.security.controller.js` (25), `admin.security.routes.js` (43), `admin.security.schema.js` (112), `admin.security.service.js` (333), `admin.service.js` (881), `admin.settings.controller.js` (33), `admin.settings.routes.js` (80), `admin.settings.schema.js` (255), `admin.settings.service.js` (355) |
| `modules/ai` | `ai.routes.js` (87), `ai.service.js` (536), `modelVersions.routes.js` (118), `modelVersions.service.js` (243) |
| `modules/alerts` | `alertEscalation.service.js` (186), `alertLabels.js` (172), `alerts.routes.js` (96), `alerts.schema.js` (31), `alerts.service.js` (1036) |
| `modules/anomalies` | `anomalies.routes.js` (108), `anomalies.schema.js` (32), `anomalies.service.js` (475) |
| `modules/apiclients` | `apiclients.routes.js` (56), `apiclients.service.js` (169) |
| `modules/auth` | `auth.controller.js` (59), `auth.routes.js` (50), `auth.schema.js` (93), `auth.service.js` (655), `mfa.service.js` (348) |
| `modules/billing` | `billing.routes.js` (74), `billing.service.js` (251) |
| `modules/blog` | `blog.routes.js` (127), `blog.service.js` (164) |
| `modules/certifications` | `certifications.routes.js` (64), `certifications.service.js` (166) |
| `modules/channels` | `channels.routes.js` (73), `channels.service.js` (327), `whatsapp.signature.js` (15) |
| `modules/cooperatives` | `cooperatives.controller.js` (57), `cooperatives.routes.js` (90), `cooperatives.schema.js` (67), `cooperatives.service.js` (393), `groupoffers.service.js` (286) |
| `modules/countries` | `countries.routes.js` (131), `fx.service.js` (180) |
| `modules/crops` | `crops.controller.js` (17), `crops.routes.js` (49), `crops.schema.js` (33), `crops.service.js` (117) |
| `modules/dashboard` | `dashboard.controller.js` (4), `dashboard.routes.js` (11), `dashboard.service.js` (118) |
| `modules/dataproducts` | `dataproducts.routes.js` (58), `dataproducts.service.js` (274) |
| `modules/dataroom` | `dataroom.routes.js` (68), `dataroom.service.js` (292) |
| `modules/duediligence` | `duediligence.routes.js` (45), `duediligence.service.js` (161) |
| `modules/exports` | `exports.routes.js` (68), `exports.service.js` (204) |
| `modules/farms` | `farms.controller.js` (31), `farms.routes.js` (38), `farms.schema.js` (53), `farms.service.js` (301) |
| `modules/forecast` | `forecast.routes.js` (86), `forecast.schema.js` (42), `forecast.service.js` (260) |
| `modules/funding` | `funding.routes.js` (45), `funding.service.js` (179) |
| `modules/geodata` | `geodata.routes.js` (71), `geodata.service.js` (210) |
| `modules/geospatial` | `geospatial.routes.js` (274), `geospatial.service.js` (347), `interpolation.routes.js` (92), `interpolation.schema.js` (45), `interpolation.service.js` (332) |
| `modules/geospatialImport` | `geospatialImport.controller.js` (114), `geospatialImport.routes.js` (89), `geospatialImport.schema.js` (46), `geospatialImport.service.js` (534), `geospatialProcessing.service.js` (199) |
| `modules/insights` | `insights.routes.js` (50), `insights.service.js` (327) |
| `modules/investdashboard` | `dashboard.routes.js` (15), `dashboard.service.js` (78) |
| `modules/investors` | `hub.routes.js` (99), `hub.service.js` (378), `investors.routes.js` (45), `investors.service.js` (118) |
| `modules/iot` | `iot.routes.js` (77), `iot.service.js` (265) |
| `modules/market/inventory` | `inventory.routes.js` (51), `inventory.service.js` (160) |
| `modules/market/listings` | `listings.routes.js` (73), `listings.schema.js` (56), `listings.service.js` (459) |
| `modules/market/offers` | `offers.routes.js` (71), `offers.service.js` (164) |
| `modules/market/orders` | `orders.routes.js` (123), `orders.service.js` (596) |
| `modules/market/requests` | `requests.routes.js` (34), `requests.schema.js` (36), `requests.service.js` (224) |
| `modules/market/reviews` | `reviews.routes.js` (49), `reviews.service.js` (127) |
| `modules/media` | `media.controller.js` (13), `media.routes.js` (34), `media.schema.js` (36), `media.service.js` (152) |
| `modules/messaging` | `messaging.routes.js` (77), `messaging.service.js` (364) |
| `modules/notifications` | `notifications.routes.js` (54), `notifications.service.js` (85) |
| `modules/organizations` | `organizations.controller.js` (12), `organizations.routes.js` (23), `organizations.schema.js` (22), `organizations.service.js` (138) |
| `modules/plots` | `plots.controller.js` (37), `plots.routes.js` (54), `plots.schema.js` (57), `plots.service.js` (357) |
| `modules/precision` | `precision.routes.js` (59), `precision.service.js` (274) |
| `modules/prices` | `prices.routes.js` (55), `prices.service.js` (162) |
| `modules/productions` | `productions.controller.js` (24), `productions.routes.js` (47), `productions.schema.js` (37), `productions.service.js` (276) |
| `modules/projects` | `projects.routes.js` (92), `projects.service.js` (317) |
| `modules/public` | `public.controller.js` (16), `public.routes.js` (82), `public.schema.js` (34), `public.service.js` (403) |
| `modules/publicapi` | `publicapi.routes.js` (69), `publicapi.service.js` (316) |
| `modules/recommendation` | `agronomicRanges.js` (236), `agronomicRanges.routes.js` (274), `agronomicRanges.service.js` (712), `agronomicRangesCsv.js` (377), `cropCalendars.js` (230), `engineVersions.js` (196), `forecastAdjustment.js` (287), `recommendation.routes.js` (179), `recommendation.service.js` (1151) |
| `modules/reporting` | `reporting.routes.js` (59), `reporting.service.js` (134) |
| `modules/reports` | `reports.controller.js` (15), `reports.routes.js` (42), `reports.schema.js` (32), `reports.service.js` (78) |
| `modules/satellite` | `acquisition.routes.js` (59), `acquisition.schema.js` (41), `acquisition.service.js` (343) |
| `modules/seasons` | `seasons.controller.js` (29), `seasons.routes.js` (69), `seasons.schema.js` (171), `seasons.service.js` (427) |
| `modules/smsDelivery` | `smsDelivery.routes.js` (385), `smsDelivery.service.js` (714) |
| `modules/soil` | `intelligence.schema.js` (133), `intelligence.service.js` (867), `rulesets.routes.js` (73), `soil.controller.js` (24), `soil.routes.js` (157), `soil.schema.js` (71), `soil.service.js` (248) |
| `modules/sync` | `sync.routes.js` (49), `sync.service.js` (388) |
| `modules/tenders` | `tenders.routes.js` (67), `tenders.service.js` (163) |
| `modules/traceability` | `public.routes.js` (18), `traceability.routes.js` (68), `traceability.service.js` (286) |
| `modules/transport` | `transport.routes.js` (65), `transport.schema.js` (15), `transport.service.js` (262) |
| `modules/users` | `users.controller.js` (17), `users.routes.js` (26), `users.schema.js` (20), `users.service.js` (157) |
| `modules/verification` | `verification.controller.js` (19), `verification.routes.js` (44), `verification.schema.js` (26), `verification.service.js` (229) |
| `modules/weather` | `weather.routes.js` (39), `weather.service.js` (181) |

Fichiers notables hors convention : `modules/auth/auth.schema.js.bak` (copie de sauvegarde versionnée), `modules/channels/whatsapp.signature.js`, `modules/recommendation/{agronomicRanges,agronomicRangesCsv,cropCalendars,engineVersions,forecastAdjustment}.js` (logique pure), `modules/alerts/alertLabels.js`.

## 8. Modèle de données (`prisma/schema.prisma`)

### 8.1 Synthèse

| Indicateur | Valeur |
|---|---|
| Modèles | **102** |
| Enums | **68** |
| Directives `@@index` | 143 |
| Modèles portant `organizationId` (tenant) | 47 |
| Migrations | 21 (`20260918000000_init` → `20261031010000_blog_posts`, ce dernier dossier non committé) |
| Validation | `prisma validate` : schéma valide |
| RLS | Aucune (C-02) |

### 8.2 Modèles par domaine

| Domaine | Modèles |
|---|---|
| Identité & tenant | Profile, Organization, Membership, ResourceUsage, MfaSecret, OtpCode, Token, IdempotencyKey, AuditLog, Setting, SettingRevision, ZoneFeatureFlag |
| Référentiels | Country, Crop, FxRate, CropAgronomicRange, AgronomicRuleSet, CropSuitability |
| V1 FARM | Farm, FarmCrop, Plot, PlotCropHistory, Production, Cooperative, CooperativeMember, GroupOffer, Media, Document, Verification, VerificationDocument, Report, SeasonFeedback, RotationPlan, FarmingPlan, YieldEstimate |
| Sol & géospatial | SoilAssessment, SoilParameter, SoilDiagnostic, SoilPrediction, InterpolatedMap, SensorAnomaly, SatelliteObservation, DroneSurvey, LabResult, GeospatialImport, ManagementZone, PrecisionReport |
| Recommandation & alertes | CropRecommendation, ThresholdAlert, AiAnalysis, AiModelVersion |
| V2 MARKET | Listing, PurchaseRequest, Offer, Order, OrderEvent, InventoryItem, InventoryMovement, TransportRequest, TransportOffer, Conversation, Message, Notification, NotificationPreference, Invoice, Review, Dispute |
| Messagerie SMS / canaux | SmsConsent, SmsMessage, SmsBatchLog, ChannelSession, ChannelMessage |
| V3 INTELLIGENCE | SyncOperation, WeatherData, MarketPrice, TraceabilityLot, LotEvent, Certification, IotDevice, SensorReading |
| V4 INVEST | Project, ProjectDocument, ProjectFollow, ProjectContactRequest, InvestorProfile, DataRoomAccessRequest, DataRoomAccessLog, DueDiligenceItem, ProgressReport, ImpactReport, FundingRequest |
| V5 GLOBAL | Tender, TenderResponse, ExportOrder, ExportDocument, ApiClient, ApiKey, ApiUsage, DataProduct, DataContract, Aggregate |
| Contenu | BlogPost |

### 8.3 Enums

Role, OrgType, Source, Visibility, VerificationLevel, VerificationStatus, MembershipStatus, PlotStatus, GeometryType, CropStatus, MediaKind, Confidentiality, ReportStatus, CountryStatus, Confidence, OtpPurpose, TokenPurpose, ListingType, ListingStatus, PurchaseRequestStatus, OfferStatus, OrderStatus, PaymentStatus, InventoryMovementType, ShipmentStatus, ConversationStatus, NotificationChannel, SmsDeliveryStatus, SmsConsentStatus, SmsSkipReason, InvoiceType, ReviewStatus, DisputeStatus, AiAnalysisType, AiAnalysisStatus, LotStatus, LotEventType, CertificationStatus, DeviceStatus, PriceSourceType, ProjectStatus, DataRoomRequestStatus, DueDiligenceStatus, FundingRequestStatus, GroupOfferStatus, ContactRequestStatus, TenderStatus, ExportOrderStatus, ApiKeyStatus, DataProductStatus, RuleSetStatus, SuitabilityLevel, RotationPlanStatus, ChannelType, RecommendationStatus, AlertSeverity, AlertStatus, AnomalyReason, AnomalyStatus, ModelKind, ModelStatus, ImportKind, ImportStatus, DataMode, AlertSourceType, RangeStatus, RangeSourceType, BlogPostStatus.

### 8.4 Observations

- Montants, prix, taux et quantités en `Float` (F-12).
- `InventoryMovement` et `LotEvent` sans `updatedAt`/`version` (rend `GET /sync/pull` par défaut inopérant, F-02).
- `OrgType` = INDIVIDUAL/COOPERATIVE/COMPANY : pas de type laboratoire alors que le code le teste (F-03).
- Géométries en `Json` (pas de type spatial) — voir `AUDIT_GEOSPATIAL.md`.

## 9. Intégrations externes

| Intégration | Fichier | Fournisseurs | Défaut | Authentification |
|---|---|---|---|---|
| Supabase Auth / Storage | `config/supabase.js` | Supabase | — | clé anon + clé service_role |
| SMS | `integrations/sms.js`, `twilio.js` | console, Twilio, Africa's Talking, webhook | `console` | jeton fournisseur |
| E-mail | `integrations/email.js` | console, Resend, SendGrid, webhook | `console` | clé API |
| Satellite | `integrations/satellite.js` | simulated, Sentinel Hub, Earth Engine, webhook | `simulated` | clé API |
| Moteur géospatial | `integrations/geospatial.js` | GeoAI Python | `http://127.0.0.1:8100` | jeton optionnel (M-09) |
| Stockage | `integrations/storage.js`, `s3.js` | disque local, Supabase Storage, S3 compatible | `local` | clés S3 / service_role |
| Webhooks entrants | `smsDelivery.routes.js`, `channels.routes.js` | Twilio (statut), WhatsApp, USSD | — | HMAC Twilio obligatoire ; HMAC WhatsApp optionnel ; USSD aucune |

## 10. Tâches planifiées (`src/jobs/index.js`)

Exécutées par `setInterval` dans chaque instance, sérialisées par `pg_try_advisory_lock`, pilotables via `/admin/jobs` (pause/reprise réservées au SUPER_ADMIN).

| Tâche (description du code) | Intervalle |
|---|---|
| Expiration des annonces dépassées | `LISTING_EXPIRY_MINUTES` |
| Annulation des commandes PENDING sans réponse | 15 min |
| Expiration des accès data room | 1 h |
| Révocation des clés d'API expirées | 1 h |
| Alerte modérateurs sur litiges hors SLA | 6 h |
| Purge des notifications lues (rétention) | 24 h |
| Signalement des capteurs silencieux | 6 h |
| Comparaison mesures/prévisions aux seuils des recommandations, alerte et proposition de recalcul | 1 h |
| Acquisition satellite pour les parcelles sans sonde | `SATELLITE_REFRESH_HOURS` |
| Détection des valeurs aberrantes et capteurs figés | 6 h |
| Escalade des alertes non traitées vers l'encadrement | 15 min |

## 11. Temps réel

`src/realtime/index.js` + `bus.js` : Socket.IO, chemin `/realtime`, authentification par jeton Supabase (`handshake.auth.token`), rooms `user:`, `org:`, `conversation:` ; événements `ready`, `typing`, `conversation:join|leave`, `ping:app` ; émissions métier (`order:new`, `order:updated`, `order:disputed`, …) via `emitToOrganizations`. Pas d'adaptateur multi-instance.

## 12. Moteur Python `geoai/`

| Fichier | Lignes | Rôle |
|---|:-:|---|
| `server.py` | 242 | Serveur HTTP (`/health`, `/v1/meta`, routes POST de calcul), jeton optionnel, corps ≤ 12 Mo |
| `engine.py` | 213 | Orchestration du diagnostic |
| `soil.py` | 263 | Classification texturale, indicateurs pédologiques |
| `spectral.py` | 275 | Indices spectraux, phénologie NDVI |
| `imagery.py` | 244 | Analyse d'images (Pillow) |
| `fusion.py` | 161 | Fusion d'observations multi-sources |
| `subsurface.py` | 218 | Profils de sous-sol (GPR) |
| `interpolation.py` | 656 | Krigeage ordinaire, variogramme, validation croisée, `MAX_CELLS=20 000` |
| `forecast.py` | 366 | Prévision des paramètres du sol |
| `sensors.py` | 230 | Qualité des séries capteurs |
| `geometry.py` | 133 | Centroïde, surface, masque de polygone |
| `config.py` | 117 | Seuils et constantes |
| `tests/` | ~1 450 | 7 fichiers `unittest` |

## 13. Scripts npm (`backend/package.json`)

| Script | Rôle |
|---|---|
| `dev` / `start` | Démarrage (`node --watch` / `node`) |
| `seed` | Référentiels (pays CD/CG, cultures, paramètres) |
| `prisma:*`, `db:push` | Génération, migrations, studio |
| `check`, `check:fields`, `check:env`, `check:perms`, `check:trace`, `check:req`, `check:cdc`, `check:migrations`, `check:mounts`, `check:models` | Contrôles statiques de cohérence |
| `test`, `test:dbless`, `test:unit`, `test:e2e`, `test:geoai` | Suites de tests (Postgres embarqué pour l'intégration) |
| `smoke`, `contre-epreuves` | Tests HTTP de fumée |
| `verify` | Enchaîne tous les contrôles et tests |
| `docs:openapi`, `docs:traceability`, `docs:requirements` | Génération documentaire |
| `geoai` | Démarre le moteur Python |
| `sms:verifier-config`, `email:verifier-config` | Diagnostic des fournisseurs |

## 14. Tests

- 65 fichiers à la racine de `backend/tests/` (unitaires/intégration + utilitaires) et 36 fichiers dans `tests/e2e/` (34 scénarios listés dans `package.json`), harness Postgres embarqué (`tests/harness.mjs`, dépendance `embedded-postgres`).
- Exécutés pendant l'audit (sans base de données) : `tests/logic.test.mjs`, `tests/orderStateMachine.test.mjs` → **30 tests, 30 réussis, 0 échec**.
- Non exécutés : suites d'intégration/E2E (démarrage d'un Postgres embarqué), `test:geoai` (Python).
- Aucun test ne couvre les failles C-03, C-04, H-02, H-03, H-04, H-06 (sinon elles auraient été détectées) — à ajouter selon le plan de correction.

## 15. Racine du dépôt (hors backend, pour mémoire)

Environ 50 scripts `fix-*.mjs` / `fix-tranche*.mjs`, des sondes (`probe-mounts.mjs`, `sonde-env.mjs`, `maj-cle.mjs`), des journaux (`test-run.log`, `anomalies-seule.log`, `sortie-surface.txt`), `openapi-sonde.json` (346 Ko) et plusieurs rapports Markdown antérieurs. Ces artefacts n'appartiennent pas au produit (F-15). Note : pendant l'audit (14/11/2026 à 13:12), les rapports et scripts `fix-*.mjs` ont été déplacés de la racine vers `flux/` et `docs/` par une action extérieure à l'audit ; git les voit comme supprimés à la racine et non suivis dans les nouveaux dossiers.

---

## Annexe — Inventaire exhaustif des déclarations de routes *(généré)*

415 déclarations. La colonne « Gardes » liste les gardes posées **sur la route elle-même** ; la plupart des routeurs appliquent en plus `authenticate` + `resolveTenant` au niveau du routeur (§5). Le chemin complet = préfixe de montage (§5) + chemin local.

| Fichier:ligne | Routeur | Méthode | Chemin local | Gardes au niveau de la route |
|---|---|---|---|---|
| `modules/admin/admin.monitoring.routes.js:21` | jobsRouter | GET | `/` | authorize(admin.jobs) |
| `modules/admin/admin.monitoring.routes.js:23` | jobsRouter | POST | `/:name/run` | authorize(admin.jobs) |
| `modules/admin/admin.monitoring.routes.js:32` | jobsRouter | POST | `/:name/pause` | requireSuperAdmin |
| `modules/admin/admin.monitoring.routes.js:39` | jobsRouter | POST | `/:name/resume` | requireSuperAdmin |
| `modules/admin/admin.monitoring.routes.js:49` | monitoringRouter | GET | `/services` | authorize(admin.jobs) |
| `modules/admin/admin.monitoring.routes.js:51` | monitoringRouter | GET | `/health` | authorize(admin.jobs) |
| `modules/admin/admin.notifications.routes.js:19` | adminNotificationsRouter | POST | `/broadcast` | authorize(admin.users) |
| `modules/admin/admin.notifications.routes.js:28` | adminNotificationsRouter | GET | `/history` | authorize(admin.users) |
| `modules/admin/admin.operations.routes.js:20` | operationsRouter | GET | `/:entity` | authorize(admin.users) |
| `modules/admin/admin.operations.routes.js:32` | operationsRouter | GET | `/:entity/:id` | authorize(admin.users) |
| `modules/admin/admin.operations.routes.js:43` | operationsRouter | POST | `/:entity/:id/moderate` | authorize(admin.users) |
| `modules/admin/admin.routes.js:19` | router | GET | `/dashboard` | authorize(admin.dashboard) |
| `modules/admin/admin.routes.js:27` | router | GET | `/dashboard/export` | authorize(admin.users) |
| `modules/admin/admin.routes.js:34` | router | GET | `/users` | authorize(admin.users) |
| `modules/admin/admin.routes.js:42` | router | GET | `/users/:id` | authorize(admin.users) |
| `modules/admin/admin.routes.js:49` | router | PATCH | `/users/:id/status` | authorize(admin.users) |
| `modules/admin/admin.routes.js:58` | router | POST | `/users/:id/unlock` | authorize(admin.users) |
| `modules/admin/admin.routes.js:65` | router | POST | `/users/:id/force-logout` | authorize(admin.users) |
| `modules/admin/admin.routes.js:72` | router | POST | `/users/:id/verify-email` | authorize(admin.users) |
| `modules/admin/admin.routes.js:79` | router | POST | `/users/:id/verify-phone` | authorize(admin.users) |
| `modules/admin/admin.routes.js:88` | router | GET | `/roles` | authorize(admin.users) |
| `modules/admin/admin.routes.js:96` | router | POST | `/users/:id/roles` | requireSuperAdmin |
| `modules/admin/admin.routes.js:103` | router | DELETE | `/users/:id/roles/:role` | requireSuperAdmin |
| `modules/admin/admin.routes.js:109` | router | DELETE | `/users/:id` | requireSuperAdmin |
| `modules/admin/admin.routes.js:116` | router | GET | `/users/:id/export` | requireSuperAdmin |
| `modules/admin/admin.routes.js:123` | router | GET | `/audit` | authorize(admin.audit) |
| `modules/admin/admin.routes.js:161` | router | GET | `/export/farms` | authorize(admin.users) |
| `modules/admin/admin.security.routes.js:20` | auditExportRouter | GET | `/export` | authorize(admin.audit) |
| `modules/admin/admin.security.routes.js:30` | securityRouter | GET | `/overview` | authorize(admin.audit) |
| `modules/admin/admin.security.routes.js:36` | securityRouter | GET | `/policy` | requireSuperAdmin |
| `modules/admin/admin.security.routes.js:38` | securityRouter | PUT | `/policy` | requireSuperAdmin |
| `modules/admin/admin.settings.routes.js:37` | settingsRouter | GET | `/` | authorize(admin.settings) |
| `modules/admin/admin.settings.routes.js:43` | settingsRouter | PUT | `/` | authorize(admin.settings) |
| `modules/admin/admin.settings.routes.js:50` | settingsRouter | GET | `/history` | authorize(admin.settings) |
| `modules/admin/admin.settings.routes.js:57` | settingsRouter | POST | `/:key/reset` | requireSuperAdmin |
| `modules/admin/admin.settings.routes.js:68` | flagsRouter | GET | `/` | requireSuperAdmin |
| `modules/admin/admin.settings.routes.js:75` | flagsRouter | PUT | `/` | requireSuperAdmin |
| `modules/ai/ai.routes.js:45` | router | POST | `/analyses` | authorize(ai.write) idempotency('ai.analyze') |
| `modules/ai/ai.routes.js:49` | router | POST | `/copilot` | authorize(ai.write) |
| `modules/ai/ai.routes.js:55` | router | POST | `/documents` | authorize(ai.write) idempotency('ai.document') |
| `modules/ai/ai.routes.js:60` | router | GET | `/analyses` | authorize(ai.read) |
| `modules/ai/ai.routes.js:67` | router | GET | `/analyses/:id` | authorize(ai.read) |
| `modules/ai/ai.routes.js:71` | router | POST | `/analyses/:id/escalate` | authorize(ai.write) |
| `modules/ai/ai.routes.js:76` | router | POST | `/analyses/:id/review` | authorize(ai.review) |
| `modules/ai/ai.routes.js:83` | router | POST | `/analyses/:id/feedback` | authorize(ai.write) |
| `modules/ai/modelVersions.routes.js:68` | router | GET | `/` | authorize(models.read) |
| `modules/ai/modelVersions.routes.js:76` | router | POST | `/` | authorize(models.write) |
| `modules/ai/modelVersions.routes.js:86` | router | GET | `/:id` | authorize(models.read) |
| `modules/ai/modelVersions.routes.js:99` | router | POST | `/:id/promote` | authorize(models.promote) |
| `modules/ai/modelVersions.routes.js:109` | router | POST | `/:id/retire` | authorize(models.write) |
| `modules/alerts/alerts.routes.js:28` | router | GET | `/` | authorize(alerts.read) |
| `modules/alerts/alerts.routes.js:57` | router | GET | `/meta` | authorize(alerts.read) |
| `modules/alerts/alerts.routes.js:64` | router | GET | `/:id` | authorize(alerts.read) |
| `modules/alerts/alerts.routes.js:72` | router | POST | `/:id/read` | authorize(alerts.read) |
| `modules/alerts/alerts.routes.js:87` | router | POST | `/:id/handled` | authorize(alerts.write) |
| `modules/anomalies/anomalies.routes.js:33` | router | GET | `/settings` | authorize(anomaly.read) |
| `modules/anomalies/anomalies.routes.js:40` | router | GET | `/` | authorize(anomaly.read) |
| `modules/anomalies/anomalies.routes.js:58` | router | GET | `/:anomalyId` | authorize(anomaly.read) |
| `modules/anomalies/anomalies.routes.js:66` | router | POST | `/devices/:deviceId/detect` | authorize(anomaly.write) |
| `modules/anomalies/anomalies.routes.js:80` | router | POST | `/plots/:plotId/detect` | authorize(anomaly.write) |
| `modules/anomalies/anomalies.routes.js:95` | router | POST | `/:anomalyId/review` | authorize(anomaly.review) |
| `modules/apiclients/apiclients.routes.js:30` | router | GET | `/clients` | authorize(apiclients.read) |
| `modules/apiclients/apiclients.routes.js:33` | router | POST | `/clients` | authorize(apiclients.manage) |
| `modules/apiclients/apiclients.routes.js:39` | router | PATCH | `/clients/:id/purpose` | authorize(apiclients.manage) |
| `modules/apiclients/apiclients.routes.js:44` | router | POST | `/clients/:id/keys` | authorize(apiclients.manage) |
| `modules/apiclients/apiclients.routes.js:48` | router | DELETE | `/keys/:id` | authorize(apiclients.manage) |
| `modules/apiclients/apiclients.routes.js:53` | router | GET | `/clients/:id/usage` | authorize(apiclients.read) |
| `modules/auth/auth.routes.js:15` | router | POST | `/register` | authLimiter |
| `modules/auth/auth.routes.js:17` | router | GET | `/mfa/status` | authenticate |
| `modules/auth/auth.routes.js:20` | router | POST | `/mfa/setup` | authenticate |
| `modules/auth/auth.routes.js:23` | router | POST | `/mfa/confirm` | authenticate |
| `modules/auth/auth.routes.js:31` | router | POST | `/mfa/verify` | authenticate |
| `modules/auth/auth.routes.js:34` | router | POST | `/mfa/disable` | authenticate |
| `modules/auth/auth.routes.js:37` | router | POST | `/login` | authLimiter |
| `modules/auth/auth.routes.js:38` | router | POST | `/refresh` | authLimiter |
| `modules/auth/auth.routes.js:39` | router | POST | `/verify-email` | authLimiter |
| `modules/auth/auth.routes.js:40` | router | POST | `/resend-verification` | authLimiter |
| `modules/auth/auth.routes.js:41` | router | POST | `/forgot-password` | authLimiter |
| `modules/auth/auth.routes.js:42` | router | POST | `/reset-password` | authLimiter |
| `modules/auth/auth.routes.js:45` | router | POST | `/logout` | authenticate |
| `modules/auth/auth.routes.js:46` | router | POST | `/verify-phone` | authenticate |
| `modules/auth/auth.routes.js:47` | router | POST | `/send-otp` | authenticate |
| `modules/auth/auth.routes.js:48` | router | POST | `/sync-profile` | authenticate |
| `modules/billing/billing.routes.js:48` | router | GET | `/` | authorize(invoices.read) |
| `modules/billing/billing.routes.js:53` | router | POST | `/` | authorize(invoices.write) |
| `modules/billing/billing.routes.js:56` | router | GET | `/:id` | authorize(invoices.read) |
| `modules/billing/billing.routes.js:59` | router | POST | `/:id/settlement` | authorize(invoices.write) |
| `modules/billing/billing.routes.js:64` | router | GET | `/:id/pdf` | authorize(invoices.read) |
| `modules/blog/blog.routes.js:58` | publicBlogRoutes | GET | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/blog/blog.routes.js:71` | publicBlogRoutes | GET | `/:slug` | — (garde éventuelle au niveau du routeur) |
| `modules/blog/blog.routes.js:81` | adminBlogRoutes | GET | `/` | authorize(admin.content) |
| `modules/blog/blog.routes.js:95` | adminBlogRoutes | POST | `/` | authorize(admin.content) |
| `modules/blog/blog.routes.js:106` | adminBlogRoutes | PATCH | `/:id` | authorize(admin.content) |
| `modules/blog/blog.routes.js:118` | adminBlogRoutes | DELETE | `/:id` | authorize(admin.content) |
| `modules/certifications/certifications.routes.js:38` | router | GET | `/` | authorize(certifications.read) |
| `modules/certifications/certifications.routes.js:43` | router | POST | `/` | authorize(certifications.write) |
| `modules/certifications/certifications.routes.js:48` | router | GET | `/organization/:organizationId` | authorize(certifications.read) |
| `modules/certifications/certifications.routes.js:51` | router | GET | `/:id` | authorize(certifications.read) |
| `modules/certifications/certifications.routes.js:55` | router | PATCH | `/:id/verify` | authorize(certifications.verify) |
| `modules/certifications/certifications.routes.js:59` | router | DELETE | `/:id` | authorize(certifications.write) |
| `modules/channels/channels.routes.js:27` | router | POST | `/ussd` | — (garde éventuelle au niveau du routeur) |
| `modules/channels/channels.routes.js:33` | router | GET | `/whatsapp/webhook` | — (garde éventuelle au niveau du routeur) |
| `modules/channels/channels.routes.js:41` | router | POST | `/whatsapp/webhook` | — (garde éventuelle au niveau du routeur) |
| `modules/channels/channels.routes.js:59` | adminRouter | GET | `/messages` | authorize(channels.read) |
| `modules/cooperatives/cooperatives.routes.js:15` | router | GET | `/current` | authorize(cooperatives.read) |
| `modules/cooperatives/cooperatives.routes.js:16` | router | PATCH | `/current` | authorize(cooperatives.write) |
| `modules/cooperatives/cooperatives.routes.js:19` | router | GET | `/:id/members` | authorize(cooperatives.members) |
| `modules/cooperatives/cooperatives.routes.js:26` | router | POST | `/:id/members` | authorize(cooperatives.members) |
| `modules/cooperatives/cooperatives.routes.js:33` | router | POST | `/:id/members/import` | authorize(cooperatives.members) |
| `modules/cooperatives/cooperatives.routes.js:40` | router | PATCH | `/:id/members/:memberId` | authorize(cooperatives.members) |
| `modules/cooperatives/cooperatives.routes.js:47` | router | GET | `/:id/overview` | authorize(cooperatives.read) |
| `modules/cooperatives/cooperatives.routes.js:55` | router | POST | `/:id/group-offers/preview` | authorize(cooperatives.write) |
| `modules/cooperatives/cooperatives.routes.js:62` | router | GET | `/:id/group-offers` | authorize(cooperatives.read) |
| `modules/cooperatives/cooperatives.routes.js:69` | router | POST | `/:id/group-offers` | authorize(cooperatives.write) |
| `modules/cooperatives/cooperatives.routes.js:76` | router | POST | `/:id/group-offers/:offerId/confirm` | authorize(cooperatives.write) |
| `modules/cooperatives/cooperatives.routes.js:82` | router | POST | `/:id/group-offers/:offerId/cancel` | authorize(cooperatives.write) |
| `modules/countries/countries.routes.js:35` | router | GET | `/` | authorize(countries.read) |
| `modules/countries/countries.routes.js:48` | router | GET | `/:code` | authorize(countries.read) |
| `modules/countries/countries.routes.js:63` | router | PATCH | `/:code` | authenticate authorize(countries.write) |
| `modules/countries/countries.routes.js:98` | router | GET | `/fx-rates` | authorize(fx.read) |
| `modules/countries/countries.routes.js:105` | router | GET | `/fx-rates/pairs` | authorize(fx.read) |
| `modules/countries/countries.routes.js:112` | router | PUT | `/fx-rates` | authorize(fx.write) |
| `modules/crops/crops.routes.js:19` | router | GET | `/` | authorize(crops.read) |
| `modules/crops/crops.routes.js:20` | router | GET | `/:id` | authorize(crops.read) |
| `modules/crops/crops.routes.js:30` | router | POST | `/` | authenticate authorize(crops.write) |
| `modules/crops/crops.routes.js:39` | router | PATCH | `/:id` | authenticate authorize(crops.write) |
| `modules/dashboard/dashboard.routes.js:9` | router | GET | `/` | authenticate |
| `modules/dataproducts/dataproducts.routes.js:25` | router | GET | `/` | authorize(data.read) |
| `modules/dataproducts/dataproducts.routes.js:28` | router | POST | `/` | authorize(dataproducts.manage) |
| `modules/dataproducts/dataproducts.routes.js:31` | router | PATCH | `/:id/status` | authorize(dataproducts.manage) |
| `modules/dataproducts/dataproducts.routes.js:36` | router | POST | `/:id/aggregates` | authorize(dataproducts.manage) |
| `modules/dataproducts/dataproducts.routes.js:45` | router | GET | `/:id/aggregates` | authorize(data.read) |
| `modules/dataproducts/dataproducts.routes.js:49` | router | POST | `/contracts` | authorize(dataproducts.manage) |
| `modules/dataroom/dataroom.routes.js:46` | router | GET | `/projects/:projectId/documents` | authorize(dataroom.read) |
| `modules/dataroom/dataroom.routes.js:49` | router | POST | `/projects/:projectId/documents` | authorize(dataroom.write) |
| `modules/dataroom/dataroom.routes.js:53` | router | POST | `/projects/:projectId/access-requests` | authorize(dataroom.request) |
| `modules/dataroom/dataroom.routes.js:57` | router | PATCH | `/access-requests/:id` | authorize(dataroom.decide) |
| `modules/dataroom/dataroom.routes.js:61` | router | GET | `/documents/:id` | authorize(dataroom.read) |
| `modules/dataroom/dataroom.routes.js:65` | router | GET | `/projects/:projectId/access-log` | authorize(dataroom.write) |
| `modules/duediligence/duediligence.routes.js:29` | router | GET | `/projects/:projectId/due-diligence` | authorize(duediligence.read) |
| `modules/duediligence/duediligence.routes.js:33` | router | POST | `/projects/:projectId/due-diligence/checklist` | authorize(duediligence.write) |
| `modules/duediligence/duediligence.routes.js:37` | router | PATCH | `/due-diligence/:id` | authorize(duediligence.write) |
| `modules/duediligence/duediligence.routes.js:41` | router | POST | `/due-diligence/:id/evidence` | authorize(duediligence.write) |
| `modules/exports/exports.routes.js:46` | router | GET | `/` | authorize(export.read) |
| `modules/exports/exports.routes.js:51` | router | POST | `/` | authorize(export.write) |
| `modules/exports/exports.routes.js:54` | router | GET | `/:id` | authorize(export.read) |
| `modules/exports/exports.routes.js:57` | router | POST | `/:id/documents` | authorize(export.write) |
| `modules/exports/exports.routes.js:61` | router | PATCH | `/:id/status` | authorize(export.write) |
| `modules/farms/farms.routes.js:14` | router | GET | `/` | authorize(farms.read) |
| `modules/farms/farms.routes.js:15` | router | POST | `/` | authorize(farms.write) |
| `modules/farms/farms.routes.js:16` | router | GET | `/:id` | authorize(farms.read) |
| `modules/farms/farms.routes.js:17` | router | PATCH | `/:id` | authorize(farms.write) |
| `modules/farms/farms.routes.js:24` | router | PATCH | `/:id/publish` | authorize(farms.write) |
| `modules/farms/farms.routes.js:31` | router | DELETE | `/:id` | authorize(farms.delete) |
| `modules/forecast/forecast.routes.js:33` | router | POST | `/:plotId/forecasts/:parameter` | authorize(forecast.write) |
| `modules/forecast/forecast.routes.js:62` | router | POST | `/:plotId/forecasts/:parameter/backtest` | authorize(forecast.read) |
| `modules/forecast/forecast.routes.js:76` | router | GET | `/:plotId/forecasts` | authorize(forecast.read) |
| `modules/funding/funding.routes.js:26` | router | GET | `/projects/:projectId/funding-requests` | authorize(funding.read) |
| `modules/funding/funding.routes.js:30` | router | POST | `/projects/:projectId/funding-requests/consent` | authorize(funding.write) |
| `modules/funding/funding.routes.js:37` | router | POST | `/funding-requests/:id/transmit` | authorize(funding.write) |
| `modules/funding/funding.routes.js:41` | router | PATCH | `/funding-requests/:id/follow-up` | authorize(funding.write) |
| `modules/geodata/geodata.routes.js:47` | router | GET | `/plots/:plotId/observations` | authorize(geodata.read) |
| `modules/geodata/geodata.routes.js:51` | router | GET | `/plots/:plotId/satellite` | authorize(geodata.read) |
| `modules/geodata/geodata.routes.js:54` | router | POST | `/satellite` | authorize(geodata.write) |
| `modules/geodata/geodata.routes.js:58` | router | GET | `/plots/:plotId/drones` | authorize(geodata.read) |
| `modules/geodata/geodata.routes.js:61` | router | POST | `/drones` | authorize(geodata.write) |
| `modules/geodata/geodata.routes.js:65` | router | GET | `/plots/:plotId/lab-results` | authorize(lab.read) |
| `modules/geodata/geodata.routes.js:68` | router | POST | `/lab-results` | authorize(lab.write) |
| `modules/geospatialImport/geospatialImport.routes.js:21` | router | POST | `/` | authorize(geospatial.write) |
| `modules/geospatialImport/geospatialImport.routes.js:36` | router | POST | `/upload` | authorize(geospatial.write) |
| `modules/geospatialImport/geospatialImport.routes.js:46` | router | POST | `/process-pending` | authorize(geospatial.write) |
| `modules/geospatialImport/geospatialImport.routes.js:52` | router | GET | `/processing` | authorize(geospatial.read) |
| `modules/geospatialImport/geospatialImport.routes.js:64` | router | POST | `/:id/process` | authorize(geospatial.write) |
| `modules/geospatialImport/geospatialImport.routes.js:75` | router | GET | `/` | authorize(geospatial.read) |
| `modules/geospatialImport/geospatialImport.routes.js:82` | router | GET | `/:id` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:162` | plotsRouter | POST | `/:plotId/soil-diagnosis` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:174` | plotsRouter | GET | `/:plotId/soil-diagnosis` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:182` | plotsRouter | GET | `/:plotId/soil-diagnosis/latest` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:193` | router | GET | `/health` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:199` | router | GET | `/methods` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:215` | router | GET | `/soil-diagnostics/:id` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:223` | router | POST | `/texture` | authorize(geospatial.read) |
| `modules/geospatial/geospatial.routes.js:230` | router | POST | `/spectral` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:237` | router | POST | `/imagery` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:244` | router | POST | `/sensors/quality` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:251` | router | POST | `/fusion` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:259` | router | POST | `/subsurface` | authorize(geospatial.write) |
| `modules/geospatial/geospatial.routes.js:267` | router | POST | `/spectral/phenology` | authorize(geospatial.write) |
| `modules/geospatial/interpolation.routes.js:35` | router | POST | `/:plotId/:parameter` | authorize(geospatial.write) |
| `modules/geospatial/interpolation.routes.js:63` | router | POST | `/:plotId/:parameter/evaluate` | authorize(geospatial.read) |
| `modules/geospatial/interpolation.routes.js:74` | router | GET | `/:plotId` | authorize(geospatial.read) |
| `modules/geospatial/interpolation.routes.js:85` | router | GET | `/map/:id` | authorize(geospatial.read) |
| `modules/insights/insights.routes.js:26` | router | GET | `/overview` | authorize(insights.read) |
| `modules/insights/insights.routes.js:33` | router | GET | `/crops` | authorize(insights.read) |
| `modules/insights/insights.routes.js:40` | router | GET | `/activity` | authorize(insights.read) |
| `modules/insights/insights.routes.js:48` | router | GET | `/disclosure-policy` | — (garde éventuelle au niveau du routeur) |
| `modules/investdashboard/dashboard.routes.js:12` | router | GET | `/` | authorize(projects.read) |
| `modules/investors/hub.routes.js:27` | router | GET | `/projects` | authorize(investors.read) |
| `modules/investors/hub.routes.js:34` | router | GET | `/followed` | authorize(investors.read) |
| `modules/investors/hub.routes.js:40` | router | POST | `/projects/:id/follow` | authorize(investors.write) |
| `modules/investors/hub.routes.js:48` | router | DELETE | `/projects/:id/follow` | authorize(investors.write) |
| `modules/investors/hub.routes.js:56` | router | GET | `/matches` | authorize(investors.read) |
| `modules/investors/hub.routes.js:63` | router | POST | `/projects/:id/contact` | authorize(investors.write) |
| `modules/investors/hub.routes.js:74` | router | POST | `/projects/:id/contacts/:requestId/decide` | authorize(projects.write) |
| `modules/investors/hub.routes.js:85` | router | GET | `/contact-requests` | authorize(investors.read) |
| `modules/investors/investors.routes.js:32` | router | GET | `/me` | authorize(investors.read) |
| `modules/investors/investors.routes.js:35` | router | PUT | `/me` | authorize(investors.write) |
| `modules/investors/investors.routes.js:41` | router | PATCH | `/:userId/verify` | authorize(investors.verify) |
| `modules/iot/iot.routes.js:56` | router | POST | `/ingest` | — (garde éventuelle au niveau du routeur) |
| `modules/iot/iot.routes.js:61` | router | GET | `/devices` | authorize(iot.read) |
| `modules/iot/iot.routes.js:64` | router | POST | `/devices` | authorize(iot.write) |
| `modules/iot/iot.routes.js:67` | router | POST | `/devices/:id/rotate-key` | authorize(iot.write) |
| `modules/iot/iot.routes.js:70` | router | POST | `/devices/:id/revoke` | authorize(iot.write) |
| `modules/iot/iot.routes.js:74` | router | GET | `/devices/:id/readings` | authorize(iot.read) |
| `modules/market/inventory/inventory.routes.js:37` | router | GET | `/` | authorize(inventory.read) |
| `modules/market/inventory/inventory.routes.js:40` | router | POST | `/` | authorize(inventory.write) |
| `modules/market/inventory/inventory.routes.js:43` | router | GET | `/:id/movements` | authorize(inventory.read) |
| `modules/market/inventory/inventory.routes.js:47` | router | POST | `/movements` | authorize(inventory.write) idempotency('inventory.movement') |
| `modules/market/listings/listings.routes.js:17` | router | GET | `/` | authorize(listings.read) |
| `modules/market/listings/listings.routes.js:24` | router | POST | `/` | authorize(listings.write) |
| `modules/market/listings/listings.routes.js:27` | router | GET | `/:id` | authorize(listings.read) |
| `modules/market/listings/listings.routes.js:30` | router | PATCH | `/:id` | authorize(listings.write) |
| `modules/market/listings/listings.routes.js:35` | router | PATCH | `/:id/status` | authorize(listings.write) |
| `modules/market/listings/listings.routes.js:45` | router | POST | `/:id/contact` | authorize(messages.write) |
| `modules/market/listings/listings.routes.js:58` | router | POST | `/:id/photos` | authorize(listings.media) |
| `modules/market/listings/listings.routes.js:64` | router | PATCH | `/:id/moderate` | authorize(listings.moderate) |
| `modules/market/listings/listings.routes.js:68` | router | DELETE | `/:id` | authorize(listings.write) |
| `modules/market/offers/offers.routes.js:42` | router | POST | `/purchase-requests/:id/offers` | authorize(offers.write) |
| `modules/market/offers/offers.routes.js:53` | router | GET | `/purchase-requests/:id/offers` | authorize(offers.read) |
| `modules/market/offers/offers.routes.js:60` | router | PATCH | `/offers/:offerId` | authorize(offers.write) |
| `modules/market/orders/orders.routes.js:72` | router | POST | `/` | authorize(orders.write) idempotency('orders.create') |
| `modules/market/orders/orders.routes.js:83` | router | GET | `/` | authorize(orders.read) |
| `modules/market/orders/orders.routes.js:88` | router | GET | `/:id` | authorize(orders.read) |
| `modules/market/orders/orders.routes.js:92` | router | GET | `/:id/events` | authorize(orders.read) |
| `modules/market/orders/orders.routes.js:96` | router | PATCH | `/:id/status` | authorize(orders.write) |
| `modules/market/orders/orders.routes.js:101` | router | PATCH | `/:id/payment` | authorize(orders.write) |
| `modules/market/orders/orders.routes.js:106` | router | POST | `/:id/disputes` | authorize(orders.write) |
| `modules/market/orders/orders.routes.js:111` | router | GET | `/admin/disputes` | authorize(orders.review, disputes.read) |
| `modules/market/orders/orders.routes.js:119` | router | PATCH | `/admin/disputes/:id` | authorize(disputes.review) |
| `modules/market/requests/requests.routes.js:14` | router | GET | `/` | authorize(requests.read) |
| `modules/market/requests/requests.routes.js:19` | router | POST | `/` | authorize(requests.write) |
| `modules/market/requests/requests.routes.js:22` | router | GET | `/:id` | authorize(requests.read) |
| `modules/market/requests/requests.routes.js:25` | router | PATCH | `/:id` | authorize(requests.write) |
| `modules/market/requests/requests.routes.js:30` | router | GET | `/:id/matches` | authorize(requests.read) |
| `modules/market/reviews/reviews.routes.js:27` | router | POST | `/orders/:orderId/reviews` | authorize(reviews.write) |
| `modules/market/reviews/reviews.routes.js:31` | router | POST | `/reviews/:id/response` | authorize(reviews.write) |
| `modules/market/reviews/reviews.routes.js:35` | router | POST | `/reviews/:id/report` | authorize(reviews.write) |
| `modules/market/reviews/reviews.routes.js:39` | router | POST | `/reviews/:id/moderate` | authorize(reviews.moderate) |
| `modules/market/reviews/reviews.routes.js:46` | router | GET | `/organizations/:organizationId/reputation` | authorize(reviews.read) |
| `modules/media/media.routes.js:14` | router | POST | `/upload-url` | authorize(media.upload) |
| `modules/media/media.routes.js:20` | router | POST | `/:id/confirm` | authorize(media.upload) |
| `modules/media/media.routes.js:26` | router | GET | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/media/media.routes.js:27` | router | DELETE | `/:id` | authorize(media.delete) |
| `modules/messaging/messaging.routes.js:38` | router | POST | `/conversations` | authorize(messages.write) |
| `modules/messaging/messaging.routes.js:45` | router | GET | `/conversations` | authorize(messages.read) |
| `modules/messaging/messaging.routes.js:52` | router | GET | `/conversations/:id/messages` | authorize(messages.read) |
| `modules/messaging/messaging.routes.js:60` | router | POST | `/conversations/:id/messages` | authorize(messages.write) |
| `modules/messaging/messaging.routes.js:64` | router | POST | `/conversations/:id/archive` | authorize(messages.write) |
| `modules/messaging/messaging.routes.js:68` | router | POST | `/conversations/:id/block` | authorize(messages.moderate) |
| `modules/messaging/messaging.routes.js:73` | router | POST | `/messages/:id/report` | authorize(messages.write) |
| `modules/notifications/notifications.routes.js:34` | router | GET | `/` | authorize(notifications.read) |
| `modules/notifications/notifications.routes.js:41` | router | POST | `/read-all` | authorize(notifications.write) |
| `modules/notifications/notifications.routes.js:44` | router | POST | `/:id/read` | authorize(notifications.write) |
| `modules/notifications/notifications.routes.js:48` | router | GET | `/preferences` | authorize(notifications.read) |
| `modules/notifications/notifications.routes.js:51` | router | PUT | `/preferences` | authorize(notifications.write) |
| `modules/organizations/organizations.routes.js:13` | router | GET | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/organizations/organizations.routes.js:14` | router | POST | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/organizations/organizations.routes.js:15` | router | GET | `/:id` | — (garde éventuelle au niveau du routeur) |
| `modules/organizations/organizations.routes.js:16` | router | PATCH | `/:id` | — (garde éventuelle au niveau du routeur) |
| `modules/plots/plots.routes.js:14` | router | GET | `/` | authorize(plots.read) |
| `modules/plots/plots.routes.js:15` | router | POST | `/` | authorize(plots.write) |
| `modules/plots/plots.routes.js:17` | router | GET | `/:id` | authorize(plots.read) |
| `modules/plots/plots.routes.js:18` | router | PATCH | `/:id` | authorize(plots.write) |
| `modules/plots/plots.routes.js:25` | router | DELETE | `/:id` | authorize(plots.delete) |
| `modules/plots/plots.routes.js:33` | router | GET | `/:id/crop-history` | authorize(history.read) |
| `modules/plots/plots.routes.js:39` | router | POST | `/:id/crop-history` | authorize(history.write) |
| `modules/plots/plots.routes.js:46` | router | PATCH | `/:id/crop-history/:historyId` | authorize(history.write) |
| `modules/precision/precision.routes.js:30` | router | GET | `/plots/:plotId/management-zones` | authorize(precision.read) |
| `modules/precision/precision.routes.js:33` | router | POST | `/plots/:plotId/management-zones` | authorize(precision.write) |
| `modules/precision/precision.routes.js:37` | router | GET | `/plots/:plotId/precision-reports` | authorize(precision.read) |
| `modules/precision/precision.routes.js:40` | router | POST | `/plots/:plotId/precision-reports` | authorize(precision.write) |
| `modules/precision/precision.routes.js:45` | router | PATCH | `/precision-reports/:id/validate` | authorize(precision.read) |
| `modules/precision/precision.routes.js:49` | router | GET | `/precision-reports/:id/pdf` | authorize(precision.read) |
| `modules/prices/prices.routes.js:42` | router | GET | `/` | authorize(prices.read) |
| `modules/prices/prices.routes.js:45` | router | GET | `/series` | authorize(prices.read) |
| `modules/prices/prices.routes.js:49` | router | POST | `/` | authorize(prices.write) |
| `modules/prices/prices.routes.js:52` | router | GET | `/stale-markets` | authorize(prices.write) |
| `modules/productions/productions.routes.js:14` | router | GET | `/stats` | authorize(productions.read) |
| `modules/productions/productions.routes.js:15` | router | GET | `/` | authorize(productions.read) |
| `modules/productions/productions.routes.js:21` | router | POST | `/` | authorize(productions.write) |
| `modules/productions/productions.routes.js:27` | router | GET | `/:id` | authorize(productions.read) |
| `modules/productions/productions.routes.js:33` | router | PATCH | `/:id` | authorize(productions.write) |
| `modules/productions/productions.routes.js:40` | router | DELETE | `/:id` | authorize(productions.write) |
| `modules/projects/projects.routes.js:66` | router | GET | `/` | authorize(projects.read) |
| `modules/projects/projects.routes.js:73` | router | POST | `/` | authorize(projects.write) |
| `modules/projects/projects.routes.js:78` | router | GET | `/:id` | authorize(projects.read) |
| `modules/projects/projects.routes.js:81` | router | PATCH | `/:id` | authorize(projects.write) |
| `modules/projects/projects.routes.js:85` | router | POST | `/:id/submit` | authorize(projects.write) |
| `modules/projects/projects.routes.js:88` | router | PATCH | `/:id/review` | authorize(projects.review) |
| `modules/public/public.routes.js:16` | router | GET | `/map` | — (garde éventuelle au niveau du routeur) |
| `modules/public/public.routes.js:22` | router | GET | `/farms` | — (garde éventuelle au niveau du routeur) |
| `modules/public/public.routes.js:28` | router | GET | `/farms/:slug` | — (garde éventuelle au niveau du routeur) |
| `modules/public/public.routes.js:34` | router | POST | `/farms/:slug/contact` | — (garde éventuelle au niveau du routeur) |
| `modules/public/public.routes.js:43` | router | GET | `/farms/:slug/qr.:format` | — (garde éventuelle au niveau du routeur) |
| `modules/public/public.routes.js:70` | router | GET | `/soil-stats` | — (garde éventuelle au niveau du routeur) |
| `modules/publicapi/publicapi.routes.js:22` | router | GET | `/products` | apiKeyAuth('data:read') |
| `modules/publicapi/publicapi.routes.js:25` | router | GET | `/products/:id/aggregates` | apiKeyAuth('aggregates:read') |
| `modules/publicapi/publicapi.routes.js:28` | router | GET | `/prices` | apiKeyAuth('prices:read') |
| `modules/publicapi/publicapi.routes.js:33` | router | GET | `/agriculture` | apiKeyAuth('aggregates:read') |
| `modules/publicapi/publicapi.routes.js:36` | router | GET | `/regions` | apiKeyAuth('aggregates:read') |
| `modules/publicapi/publicapi.routes.js:39` | router | GET | `/crops` | apiKeyAuth('data:read') |
| `modules/publicapi/publicapi.routes.js:42` | router | GET | `/market-prices` | apiKeyAuth('prices:read') |
| `modules/publicapi/publicapi.routes.js:45` | router | GET | `/projects` | apiKeyAuth('data:read') |
| `modules/publicapi/publicapi.routes.js:48` | router | GET | `/farmers` | apiKeyAuth('data:read') |
| `modules/publicapi/publicapi.routes.js:57` | dataAliasRouter | GET | `/agriculture` | apiKeyAuth('aggregates:read') |
| `modules/publicapi/publicapi.routes.js:60` | dataAliasRouter | GET | `/regions` | apiKeyAuth('aggregates:read') |
| `modules/publicapi/publicapi.routes.js:63` | dataAliasRouter | GET | `/market-prices` | apiKeyAuth('prices:read') |
| `modules/publicapi/publicapi.routes.js:66` | dataAliasRouter | GET | `/farmers` | apiKeyAuth('data:read') |
| `modules/recommendation/agronomicRanges.routes.js:134` | router | GET | `/` | authorize(ranges.read) |
| `modules/recommendation/agronomicRanges.routes.js:144` | router | GET | `/meta` | authorize(ranges.read) |
| `modules/recommendation/agronomicRanges.routes.js:173` | router | GET | `/import/template` | authorize(ranges.read) |
| `modules/recommendation/agronomicRanges.routes.js:203` | router | POST | `/import` | authorize(ranges.write) |
| `modules/recommendation/agronomicRanges.routes.js:215` | router | GET | `/:id` | authorize(ranges.read) |
| `modules/recommendation/agronomicRanges.routes.js:223` | router | POST | `/` | authorize(ranges.write) |
| `modules/recommendation/agronomicRanges.routes.js:234` | router | PATCH | `/:id` | authorize(ranges.write) |
| `modules/recommendation/agronomicRanges.routes.js:252` | router | POST | `/:id/validate` | authorize(ranges.validate) |
| `modules/recommendation/agronomicRanges.routes.js:265` | router | POST | `/:id/retire` | authorize(ranges.write) |
| `modules/recommendation/recommendation.routes.js:77` | plotsRouter | POST | `/:plotId/recommendations` | authorize(recommendation.write) |
| `modules/recommendation/recommendation.routes.js:90` | plotsRouter | GET | `/:plotId/recommendations` | authorize(recommendation.read) |
| `modules/recommendation/recommendation.routes.js:112` | router | GET | `/engine` | authorize(recommendation.read) |
| `modules/recommendation/recommendation.routes.js:139` | router | GET | `/:id` | authorize(recommendation.read) |
| `modules/recommendation/recommendation.routes.js:152` | router | GET | `/:id/explanation` | authorize(recommendation.read) |
| `modules/recommendation/recommendation.routes.js:167` | router | POST | `/:id/decision` | authorize(recommendation.write) |
| `modules/reporting/reporting.routes.js:44` | router | GET | `/projects/:projectId/reports` | authorize(reporting.read) |
| `modules/reporting/reporting.routes.js:48` | router | POST | `/projects/:projectId/progress-reports` | authorize(reporting.write) |
| `modules/reporting/reporting.routes.js:53` | router | POST | `/projects/:projectId/impact-reports` | authorize(reporting.write) |
| `modules/reports/reports.routes.js:13` | router | POST | `/` | authenticate authorize(reports.create) |
| `modules/reports/reports.routes.js:29` | adminRouter | GET | `/` | authorize(reports.review) |
| `modules/reports/reports.routes.js:36` | adminRouter | PATCH | `/:id` | authorize(reports.review) |
| `modules/satellite/acquisition.routes.js:27` | router | GET | `/settings` | authorize(satellite.read) |
| `modules/satellite/acquisition.routes.js:34` | router | POST | `/plots/:plotId/acquire` | authorize(satellite.write) |
| `modules/satellite/acquisition.routes.js:49` | router | GET | `/plots/:plotId/observations` | authorize(satellite.read) |
| `modules/seasons/seasons.routes.js:18` | router | GET | `/stats` | authorize(seasons.read) |
| `modules/seasons/seasons.routes.js:25` | router | GET | `/` | authorize(seasons.read) |
| `modules/seasons/seasons.routes.js:32` | router | POST | `/` | authorize(seasons.write) |
| `modules/seasons/seasons.routes.js:39` | router | GET | `/:id` | authorize(seasons.read) |
| `modules/seasons/seasons.routes.js:47` | router | GET | `/:id/compare` | authorize(seasons.read) |
| `modules/seasons/seasons.routes.js:54` | router | PATCH | `/:id` | authorize(seasons.write) |
| `modules/seasons/seasons.routes.js:62` | router | DELETE | `/:id` | authorize(seasons.write) |
| `modules/smsDelivery/smsDelivery.routes.js:80` | router | GET | `/consent` | authorize(sms.consent) |
| `modules/smsDelivery/smsDelivery.routes.js:103` | router | POST | `/consent` | authorize(sms.consent) |
| `modules/smsDelivery/smsDelivery.routes.js:124` | router | DELETE | `/consent` | authorize(sms.consent) |
| `modules/smsDelivery/smsDelivery.routes.js:146` | router | GET | `/settings` | — (garde éventuelle au niveau du routeur) |
| `modules/smsDelivery/smsDelivery.routes.js:172` | router | GET | `/messages` | authorize(sms.read) |
| `modules/smsDelivery/smsDelivery.routes.js:192` | router | GET | `/messages/:id` | authorize(sms.read) |
| `modules/smsDelivery/smsDelivery.routes.js:203` | router | GET | `/batches` | authorize(sms.read) |
| `modules/smsDelivery/smsDelivery.routes.js:220` | router | POST | `/test-send` | authorize(sms.send) |
| `modules/smsDelivery/smsDelivery.routes.js:283` | twilioWebhookRouter | POST | `/status` | — (garde éventuelle au niveau du routeur) |
| `modules/soil/rulesets.routes.js:19` | router | GET | `/rulesets` | authorize(rules.read) |
| `modules/soil/rulesets.routes.js:26` | router | POST | `/rulesets` | authorize(rules.write) |
| `modules/soil/rulesets.routes.js:37` | router | POST | `/rulesets/:id/validate` | authorize(rules.validate) |
| `modules/soil/rulesets.routes.js:48` | router | POST | `/rulesets/:id/retire` | authorize(rules.validate) |
| `modules/soil/rulesets.routes.js:57` | router | GET | `/feature-flags` | authorize(rules.read) |
| `modules/soil/rulesets.routes.js:64` | router | PUT | `/feature-flags` | authorize(flags.write) |
| `modules/soil/soil.routes.js:21` | router | GET | `/:id/soil-assessments` | authorize(soil.read) |
| `modules/soil/soil.routes.js:28` | router | GET | `/:id/soil-profile` | authorize(soil.read) |
| `modules/soil/soil.routes.js:35` | router | POST | `/:id/soil-assessments` | authorize(soil.write) |
| `modules/soil/soil.routes.js:43` | router | PATCH | `/:id/soil-assessments/:assessmentId` | authorize(soil.write) |
| `modules/soil/soil.routes.js:51` | router | DELETE | `/:id/soil-assessments/:assessmentId` | authorize(soil.write) |
| `modules/soil/soil.routes.js:60` | router | GET | `/:id/suitability` | authorize(soil.read) |
| `modules/soil/soil.routes.js:67` | router | POST | `/:id/suitability` | authorize(soil.recommend) |
| `modules/soil/soil.routes.js:79` | router | GET | `/:id/suitability/:suitabilityId` | authorize(soil.read) |
| `modules/soil/soil.routes.js:88` | router | GET | `/:id/rotation-plans` | authorize(soil.read) |
| `modules/soil/soil.routes.js:95` | router | POST | `/:id/rotation-plans` | authorize(soil.recommend) |
| `modules/soil/soil.routes.js:107` | router | PATCH | `/:id/rotation-plans/:planId` | authorize(soil.recommend) |
| `modules/soil/soil.routes.js:119` | router | GET | `/:id/farming-plans` | authorize(soil.read) |
| `modules/soil/soil.routes.js:126` | router | POST | `/:id/farming-plans` | authorize(soil.recommend) |
| `modules/soil/soil.routes.js:138` | router | GET | `/:id/yield-estimates` | authorize(soil.read) |
| `modules/soil/soil.routes.js:145` | router | POST | `/:id/yield-estimates` | authorize(soil.recommend) |
| `modules/sync/sync.routes.js:37` | router | GET | `/collections` | authorize(sync.write) |
| `modules/sync/sync.routes.js:40` | router | POST | `/push` | authorize(sync.write) |
| `modules/sync/sync.routes.js:43` | router | GET | `/pull` | authorize(sync.write) |
| `modules/sync/sync.routes.js:46` | router | GET | `/conflicts` | authorize(sync.write) |
| `modules/tenders/tenders.routes.js:45` | router | GET | `/` | authorize(tenders.read) |
| `modules/tenders/tenders.routes.js:50` | router | POST | `/` | authorize(tenders.write) |
| `modules/tenders/tenders.routes.js:53` | router | GET | `/:id` | authorize(tenders.read) |
| `modules/tenders/tenders.routes.js:56` | router | POST | `/:id/responses` | authorize(tenders.respond) |
| `modules/tenders/tenders.routes.js:60` | router | POST | `/:id/award` | authorize(tenders.write) |
| `modules/tenders/tenders.routes.js:64` | router | POST | `/:id/close` | authorize(tenders.write) |
| `modules/traceability/public.routes.js:13` | router | GET | `/lots/:code` | publicRateLimit |
| `modules/traceability/traceability.routes.js:42` | router | GET | `/` | authorize(lots.read) |
| `modules/traceability/traceability.routes.js:47` | router | POST | `/` | authorize(lots.write) |
| `modules/traceability/traceability.routes.js:50` | router | GET | `/:id` | authorize(lots.read) |
| `modules/traceability/traceability.routes.js:54` | router | POST | `/:id/events` | authorize(lots.write) |
| `modules/traceability/traceability.routes.js:60` | router | PUT | `/:id/public-fields` | authorize(lots.write) |
| `modules/traceability/traceability.routes.js:64` | router | POST | `/:id/recall` | authorize(lots.write) |
| `modules/transport/transport.routes.js:43` | router | GET | `/requests` | authorize(transport.read) |
| `modules/transport/transport.routes.js:46` | router | POST | `/requests` | authorize(transport.write) |
| `modules/transport/transport.routes.js:49` | router | POST | `/requests/:id/offers` | authorize(transport.write) |
| `modules/transport/transport.routes.js:53` | router | POST | `/offers/:id/accept` | authorize(transport.write) |
| `modules/transport/transport.routes.js:57` | router | POST | `/requests/:id/proof-of-delivery` | authorize(transport.write) |
| `modules/transport/transport.routes.js:61` | router | PATCH | `/requests/:id/status` | authorize(transport.write) |
| `modules/users/users.routes.js:20` | router | GET | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/users/users.routes.js:21` | router | PATCH | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/users/users.routes.js:22` | router | GET | `/permissions` | — (garde éventuelle au niveau du routeur) |
| `modules/users/users.routes.js:23` | router | POST | `/password` | — (garde éventuelle au niveau du routeur) |
| `modules/users/users.routes.js:24` | router | DELETE | `/` | — (garde éventuelle au niveau du routeur) |
| `modules/verification/verification.routes.js:15` | router | POST | `/` | authorize(verifications.create) |
| `modules/verification/verification.routes.js:22` | router | GET | `/me` | authorize(verifications.read) |
| `modules/verification/verification.routes.js:31` | adminRouter | GET | `/` | authorize(verifications.review) |
| `modules/verification/verification.routes.js:38` | adminRouter | PATCH | `/:id` | authorize(verifications.review) |
| `modules/weather/weather.routes.js:27` | router | GET | `/plots/:plotId` | authorize(weather.read) |
| `modules/weather/weather.routes.js:30` | router | GET | `/plots/:plotId/history` | authorize(weather.read) |
| `modules/weather/weather.routes.js:33` | router | GET | `/plots/:plotId/alerts` | authorize(weather.read) |
| `modules/weather/weather.routes.js:36` | router | POST | `/` | authorize(weather.read) |
