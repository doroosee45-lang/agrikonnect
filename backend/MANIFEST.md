# MANIFEST — AGRIKONNECT AFRICA · backend

Archive générée le **2026-10-21** · **258 fichiers** · 45 modules métier · 87 modèles Prisma · 5 migrations SQL · 11 modules Python (`geoai/`) · 21 suites de tests Node · 9 scripts de contrôle.

Chaque ligne de l'inventaire (§7) correspond à un fichier réellement présent dans le dépôt livré.

## 1. Contenu par zone

| Zone | Fichiers | Rôle |
|---|---|---|
| `.env.example` | 1 | Modèle de configuration — 46 variables, aucun secret livré |
| `.gitignore` | 1 | Exclusions Git |
| `README.md` | 1 | Point d'entrée : architecture, installation, preuves |
| `docs` | 8 | Documentation : API, déploiement, exigences, traçabilité, acceptance, géospatial, inventaire CDC, NFR |
| `geoai` | 19 | Moteur Python de détection du sol (numpy/scipy/Pillow) + ses 70 tests |
| `package-lock.json` | 1 | Verrouillage des versions |
| `package.json` | 1 | Dépendances et scripts (`npm run verify`) |
| `prisma` | 8 | Schéma (87 modèles), 5 migrations SQL, seed |
| `scripts` | 9 | Contrôles automatisés : conformité CDC, champs, configuration, permissions, exigences, traçabilité, montages, OpenAPI, fumée HTTP |
| `src` | 185 | API Express : modules métier, middleware, intégrations, tâches planifiées |
| `tests` | 24 | Suites unitaires, d'intégration et e2e (329 tests Node) |

## 2. Modules métier (`src/modules/`)

- `admin` · `ai` · `apiclients` · `auth`
- `billing` · `certifications` · `channels` · `cooperatives`
- `countries` · `crops` · `dashboard` · `dataproducts`
- `dataroom` · `duediligence` · `exports` · `farms`
- `funding` · `geodata` · `geospatial` · `insights`
- `investdashboard` · `investors` · `iot` · `market`
- `media` · `messaging` · `notifications` · `organizations`
- `plots` · `precision` · `prices` · `productions`
- `projects` · `public` · `publicapi` · `reporting`
- `reports` · `soil` · `sync` · `tenders`
- `traceability` · `transport` · `users` · `verification`
- `weather`

## 3. Scripts de contrôle (`scripts/`)

- `scripts/check-cdc.mjs`
- `scripts/check-env.mjs`
- `scripts/check-fields.mjs`
- `scripts/check-mounts.mjs`
- `scripts/check-perms.mjs`
- `scripts/check-requirements.mjs`
- `scripts/check-traceability.mjs`
- `scripts/generate-openapi.mjs`
- `scripts/smoke-http.mjs`

## 4. Documentation (`docs/`)

- `docs/ACCEPTANCE.md`
- `docs/API.md`
- `docs/CDC-INVENTAIRE.md`
- `docs/DEPLOYMENT.md`
- `docs/GEOSPATIAL.md`
- `docs/NFR.md`
- `docs/REQUIREMENTS.md`
- `docs/TRACEABILITY.md`

## 5. Moteur géospatial Python (`geoai/`)

- `geoai/__init__.py` — 27 lignes
- `geoai/config.py` — 117 lignes
- `geoai/engine.py` — 213 lignes
- `geoai/fusion.py` — 161 lignes
- `geoai/geometry.py` — 133 lignes
- `geoai/imagery.py` — 244 lignes
- `geoai/sensors.py` — 180 lignes
- `geoai/server.py` — 172 lignes
- `geoai/soil.py` — 263 lignes
- `geoai/spectral.py` — 275 lignes
- `geoai/subsurface.py` — 218 lignes
- `geoai/tests/` — 6 fichiers, 70 tests
- `geoai/requirements.txt`, `geoai/README.md`

## 6. Preuves exécutées avant livraison (`npm run verify`, exit 0)

| Contrôle | Résultat |
|---|---|
| `npm run check` (import complet de l'app) | OK |
| `npm run check:fields` | 184 fichiers · 87 modèles · 0 problème |
| `npm run check:env` | 46 variables · 0 écart |
| `npm run check:perms` | 114/114 permissions |
| `npm run check:trace` | 53 familles · 196/196 |
| `npm run check:req` | 220/220 exigences cataloguées |
| `npm run check:cdc` | 199/199 identifiants du cahier des charges · 0 écart |
| `npm run test:geoai` | 70/70 (moteur Python) |
| `npm test` | 329/329 |
| `npm run test:e2e` | 31/31 (PostgreSQL embarqué) |
| `npm run check:mounts` | 319 routes · 0 collision · 0 écart |
| `npm run smoke` | 315 opérations appelées · 0 route fantôme |
| `npm run docs:openapi` | 252 chemins · 315 opérations · 45 tags |

## 7. Inventaire complet

```
.env.example
.gitignore
README.md
docs/ACCEPTANCE.md
docs/API.md
docs/CDC-INVENTAIRE.md
docs/DEPLOYMENT.md
docs/GEOSPATIAL.md
docs/NFR.md
docs/REQUIREMENTS.md
docs/TRACEABILITY.md
geoai/README.md
geoai/__init__.py
geoai/config.py
geoai/engine.py
geoai/fusion.py
geoai/geometry.py
geoai/imagery.py
geoai/requirements.txt
geoai/sensors.py
geoai/server.py
geoai/soil.py
geoai/spectral.py
geoai/subsurface.py
geoai/tests/__init__.py
geoai/tests/test_engine_server.py
geoai/tests/test_field.py
geoai/tests/test_imagery_fusion.py
geoai/tests/test_soil.py
geoai/tests/test_spectral.py
package-lock.json
package.json
prisma/migrations/20260918000000_init/migration.sql
prisma/migrations/20261020000000_mfa_enabled/migration.sql
prisma/migrations/20261021000000_lot_recall/migration.sql
prisma/migrations/20261021010000_soil_diagnostics/migration.sql
prisma/migrations/20261021020000_country_hosting/migration.sql
prisma/migrations/migration_lock.toml
prisma/schema.prisma
prisma/seed.js
scripts/check-cdc.mjs
scripts/check-env.mjs
scripts/check-fields.mjs
scripts/check-mounts.mjs
scripts/check-perms.mjs
scripts/check-requirements.mjs
scripts/check-traceability.mjs
scripts/generate-openapi.mjs
scripts/smoke-http.mjs
src/app.js
src/config/env.js
src/config/prisma.js
src/config/supabase.js
src/docs/openapi.json
src/integrations/email.js
src/integrations/geospatial.js
src/integrations/sms.js
src/jobs/index.js
src/middleware/apiKey.js
src/middleware/auth.js
src/middleware/authorize.js
src/middleware/idempotency.js
src/middleware/rateLimit.js
src/middleware/tenant.js
src/middleware/validate.js
src/modules/admin/admin.controller.js
src/modules/admin/admin.routes.js
src/modules/admin/admin.schema.js
src/modules/admin/admin.service.js
src/modules/ai/ai.routes.js
src/modules/ai/ai.service.js
src/modules/apiclients/apiclients.routes.js
src/modules/apiclients/apiclients.service.js
src/modules/auth/auth.controller.js
src/modules/auth/auth.routes.js
src/modules/auth/auth.schema.js
src/modules/auth/auth.service.js
src/modules/auth/mfa.service.js
src/modules/billing/billing.routes.js
src/modules/billing/billing.service.js
src/modules/certifications/certifications.routes.js
src/modules/certifications/certifications.service.js
src/modules/channels/channels.routes.js
src/modules/channels/channels.service.js
src/modules/channels/whatsapp.signature.js
src/modules/cooperatives/cooperatives.controller.js
src/modules/cooperatives/cooperatives.routes.js
src/modules/cooperatives/cooperatives.schema.js
src/modules/cooperatives/cooperatives.service.js
src/modules/cooperatives/groupoffers.service.js
src/modules/countries/countries.routes.js
src/modules/countries/fx.service.js
src/modules/crops/crops.controller.js
src/modules/crops/crops.routes.js
src/modules/crops/crops.schema.js
src/modules/crops/crops.service.js
src/modules/dashboard/dashboard.controller.js
src/modules/dashboard/dashboard.routes.js
src/modules/dashboard/dashboard.service.js
src/modules/dataproducts/dataproducts.routes.js
src/modules/dataproducts/dataproducts.service.js
src/modules/dataroom/dataroom.routes.js
src/modules/dataroom/dataroom.service.js
src/modules/duediligence/duediligence.routes.js
src/modules/duediligence/duediligence.service.js
src/modules/exports/exports.routes.js
src/modules/exports/exports.service.js
src/modules/farms/farms.controller.js
src/modules/farms/farms.routes.js
src/modules/farms/farms.schema.js
src/modules/farms/farms.service.js
src/modules/funding/funding.routes.js
src/modules/funding/funding.service.js
src/modules/geodata/geodata.routes.js
src/modules/geodata/geodata.service.js
src/modules/geospatial/geospatial.routes.js
src/modules/geospatial/geospatial.service.js
src/modules/insights/insights.routes.js
src/modules/insights/insights.service.js
src/modules/investdashboard/dashboard.routes.js
src/modules/investdashboard/dashboard.service.js
src/modules/investors/hub.routes.js
src/modules/investors/hub.service.js
src/modules/investors/investors.routes.js
src/modules/investors/investors.service.js
src/modules/iot/iot.routes.js
src/modules/iot/iot.service.js
src/modules/market/inventory/inventory.routes.js
src/modules/market/inventory/inventory.service.js
src/modules/market/listings/listings.routes.js
src/modules/market/listings/listings.schema.js
src/modules/market/listings/listings.service.js
src/modules/market/offers/offers.routes.js
src/modules/market/offers/offers.service.js
src/modules/market/orders/orders.routes.js
src/modules/market/orders/orders.service.js
src/modules/market/requests/requests.routes.js
src/modules/market/requests/requests.schema.js
src/modules/market/requests/requests.service.js
src/modules/market/reviews/reviews.routes.js
src/modules/market/reviews/reviews.service.js
src/modules/media/media.controller.js
src/modules/media/media.routes.js
src/modules/media/media.schema.js
src/modules/media/media.service.js
src/modules/messaging/messaging.routes.js
src/modules/messaging/messaging.service.js
src/modules/notifications/notifications.routes.js
src/modules/notifications/notifications.service.js
src/modules/organizations/organizations.controller.js
src/modules/organizations/organizations.routes.js
src/modules/organizations/organizations.schema.js
src/modules/organizations/organizations.service.js
src/modules/plots/plots.controller.js
src/modules/plots/plots.routes.js
src/modules/plots/plots.schema.js
src/modules/plots/plots.service.js
src/modules/precision/precision.routes.js
src/modules/precision/precision.service.js
src/modules/prices/prices.routes.js
src/modules/prices/prices.service.js
src/modules/productions/productions.controller.js
src/modules/productions/productions.routes.js
src/modules/productions/productions.schema.js
src/modules/productions/productions.service.js
src/modules/projects/projects.routes.js
src/modules/projects/projects.service.js
src/modules/public/public.controller.js
src/modules/public/public.routes.js
src/modules/public/public.schema.js
src/modules/public/public.service.js
src/modules/publicapi/publicapi.routes.js
src/modules/publicapi/publicapi.service.js
src/modules/reporting/reporting.routes.js
src/modules/reporting/reporting.service.js
src/modules/reports/reports.controller.js
src/modules/reports/reports.routes.js
src/modules/reports/reports.schema.js
src/modules/reports/reports.service.js
src/modules/soil/intelligence.schema.js
src/modules/soil/intelligence.service.js
src/modules/soil/rulesets.routes.js
src/modules/soil/soil.controller.js
src/modules/soil/soil.routes.js
src/modules/soil/soil.schema.js
src/modules/soil/soil.service.js
src/modules/sync/sync.routes.js
src/modules/sync/sync.service.js
src/modules/tenders/tenders.routes.js
src/modules/tenders/tenders.service.js
src/modules/traceability/public.routes.js
src/modules/traceability/traceability.routes.js
src/modules/traceability/traceability.service.js
src/modules/transport/transport.routes.js
src/modules/transport/transport.schema.js
src/modules/transport/transport.service.js
src/modules/users/users.controller.js
src/modules/users/users.routes.js
src/modules/users/users.schema.js
src/modules/users/users.service.js
src/modules/verification/verification.controller.js
src/modules/verification/verification.routes.js
src/modules/verification/verification.schema.js
src/modules/verification/verification.service.js
src/modules/weather/weather.routes.js
src/modules/weather/weather.service.js
src/realtime/bus.js
src/realtime/index.js
src/routes/index.js
src/server.js
src/shared/audit.js
src/shared/conversations.js
src/shared/crypto.js
src/shared/errors/ApiError.js
src/shared/events.js
src/shared/geo.js
src/shared/http/asyncHandler.js
src/shared/http/errorHandler.js
src/shared/http/logger.js
src/shared/http/notFound.js
src/shared/http/requestId.js
src/shared/http/response.js
src/shared/ids.js
src/shared/matching.js
src/shared/money.js
src/shared/orderStateMachine.js
src/shared/pagination.js
src/shared/pdf.js
src/shared/permissions.js
src/shared/quota.js
src/shared/resource.js
src/shared/slug.js
src/shared/transaction.js
src/shared/units.js
tests/e2e/channels.e2e.test.mjs
tests/e2e/intelligence.e2e.test.mjs
tests/e2e/journeys.e2e.test.mjs
tests/e2e/support/fake-gotrue.mjs
tests/e2e/support/harness.mjs
tests/families-v1.integration.test.mjs
tests/families.integration.test.mjs
tests/geospatial.integration.test.mjs
tests/helpers/fakePrisma.mjs
tests/intelligence.integration.test.mjs
tests/jobs.integration.test.mjs
tests/listings.integration.test.mjs
tests/logic.test.mjs
tests/messaging.integration.test.mjs
tests/orderStateMachine.test.mjs
tests/orders.integration.test.mjs
tests/policies.integration.test.mjs
tests/req-extra.integration.test.mjs
tests/req-v1.integration.test.mjs
tests/req-v2.integration.test.mjs
tests/req-v3.integration.test.mjs
tests/req-v4.integration.test.mjs
tests/req-v5.integration.test.mjs
tests/reviews.integration.test.mjs
```
