## 4. Inventaire des routes

### 4.1 Routes frontend web (React Router) — 171 routes

> Source : `apps/web/src/App.tsx` (routes + imports paresseux). Les pages
> `PublicAbout`, `PublicServices`, `PublicServiceDetail` et leurs routes
> `/a-propos`, `/services`, `/services/:serviceId` ont été ajoutées par le
> projet (documentées dans `docs/PAGES-PROJET.md`).

| Route | Composant |
|---|---|
| `/` | PublicHome |
| `/services` | PublicServices |
| `/a-propos` | PublicAbout |
| `/services/:serviceId` | PublicServiceDetail |
| `/public/farmers` | PublicFarmers |
| `/public/farms/:slug` | PublicFarmProfile |
| `/public/lots/:code` | PublicLotProfile |
| `/public/map` | PublicMapPage |
| `/public/cooperatives` | PublicCooperatives |
| `/public/cooperatives/:slug` | PublicCooperativeProfile |
| `/public/projects` | PublicProjects |
| `/public/projects/:id` | PublicProjectProfile |
| `/public/tenders` | PublicTenders |
| `/public/data` | PublicDataCatalog |
| `/public/agriculture/:countryCode` | PublicAgricultureCountry |
| `/public/country-language` | PublicCountryLanguageSelector |
| `/public/legal` | PublicLegal |
| `/auth/login` | AuthLogin |
| `/auth/register` | AuthRegister |
| `/auth/forgot` | AuthForgot |
| `/auth/reset` | AuthReset |
| `/auth/verify-email` | AuthVerifyEmail |
| `/auth/mfa` | AuthMfa |
| `/auth/verify-phone` | AuthVerifyPhone |
| `/admin` | Admin |
| `/admin/dashboard` | AdminDashboard |
| `/admin/farmers` | AdminFarmers |
| `/admin/farms` | AdminFarms |
| `/admin/plots` | AdminPlots |
| `/admin/productions` | AdminProductions |
| `/admin/users` | AdminUsers |
| `/admin/users/:id` | AdminUserDetail |
| `/admin/roles` | AdminRoles |
| `/admin/orders` | AdminOrders |
| `/admin/marketplace` | AdminMarketplace |
| `/admin/prices` | AdminPrices |
| `/admin/countries` | AdminCountries |
| `/admin/countries/:code` | AdminCountryDetail |
| `/admin/crops` | AdminCrops |
| `/admin/cooperatives` | AdminCooperatives |
| `/admin/projects` | AdminProjects |
| `/admin/investors` | AdminInvestors |
| `/admin/verifications` | AdminVerifications |
| `/admin/moderation` | AdminModeration |
| `/admin/reports` | AdminReports |
| `/admin/audit` | AdminAuditLog |
| `/admin/settings` | AdminSettings |
| `/admin/monitoring` | AdminMonitoring |
| `/admin/jobs` | AdminJobs |
| `/admin/security` | AdminSecurity |
| `/admin/operations` | AdminOperations |
| `/admin/notifications` | AdminNotifications |
| `/admin/sync` | AdminSync |
| `/admin/devices` | AdminDevices |
| `/admin/lots` | AdminLots |
| `/admin/producers` | AdminProducers |
| `/admin/messages` | AdminMessages |
| `/admin/api-clients` | AdminApiClients |
| `/admin/ai-usage` | AdminAiUsage |
| `/admin/data-products` | AdminDataProducts |
| `/admin/partners` | AdminPartners |
| `/admin/compliance` | AdminCompliance |
| `/admin/agronomic-ranges` | AdminAgronomicRanges |
| `/admin/rules` | AdminRules |
| `/agent/consent` | AgentConsent |
| `/agent/registration` | AgentRegistration |
| `/ai/assistant` | AiAssistant |
| `/ai/analyses` | AiAnalyses |
| `/ai/analyses/:id` | AiAnalysisDetail |
| `/ai/documents` | AiDocuments |
| `/app` | AppDashboard |
| `/app/farms` | AppFarms |
| `/app/farms/:id` | AppFarmDetail |
| `/app/plots` | AppPlots |
| `/app/plots/:id` | AppPlotDetail |
| `/app/productions` | AppProductions |
| `/app/soil` | AppSoil |
| `/app/inventory` | AppInventory |
| `/app/orders` | AppOrders |
| `/app/orders/:id` | AppOrderDetail |
| `/app/messages` | AppMessages |
| `/app/messages/:id` | AppConversation |
| `/app/notifications` | AppNotifications |
| `/app/sms-consent` | AppSmsConsent |
| `/app/season-feedback` | AppSeasonFeedback |
| `/app/profile` | AppProfile |
| `/app/verification` | AppVerification |
| `/app/agent` | AppAgent |
| `/app/cooperative` | AppCooperative |
| `/app/cooperative/offers` | AppCooperativeOffers |
| `/app/cooperative/orders` | AppCooperativeOrders |
| `/app/invoices` | AppInvoices |
| `/app/transport` | AppTransport |
| `/developers` | DevelopersHome |
| `/developers/keys` | DevelopersKeys |
| `/developers/usage` | DevelopersUsage |
| `/developers/docs` | DevelopersDocs |
| `/farmer` | FarmerHome |
| `/farmer/profile` | FarmerProfile |
| `/farmer/public-profile` | FarmerPublicProfile |
| `/farmer/settings` | FarmerSettings |
| `/farmer/alerts` | FarmerAlerts |
| `/farmer/farms` | FarmerFarms |
| `/farmer/farms/create` | FarmerFarmCreate |
| `/farmer/farms/:id` | FarmerFarmDetail |
| `/farmer/plots` | FarmerPlots |
| `/farmer/plots/create` | FarmerPlotCreate |
| `/farmer/plots/:id` | FarmerPlotDetail |
| `/farmer/plots/:id/soil` | FarmerPlotSoil |
| `/farmer/plots/:id/recommendations` | FarmerPlotRecommendations |
| `/farmer/plots/:id/rotation` | FarmerPlotRotation |
| `/farmer/plots/:id/plan` | FarmerPlotPlan |
| `/farmer/plots/:id/precision-report` | FarmerPlotPrecisionReport |
| `/farmer/plots/:id/zones` | FarmerPlotZones |
| `/farmer/plots/:id/sensors` | FarmerPlotSensors |
| `/farmer/plots/:id/satellite` | FarmerPlotSatellite |
| `/farmer/productions` | FarmerProductions |
| `/farmer/soil` | FarmerSoil |
| `/farmer/lots` | FarmerLots |
| `/farmer/lots/:id` | FarmerLotDetail |
| `/farmer/export` | FarmerExport |
| `/farmer/export/:id` | FarmerExportDetail |
| `/farmer/export/:id/documents` | FarmerExportDocuments |
| `/farmer/projects` | FarmerProjects |
| `/farmer/projects/create` | FarmerProjectCreate |
| `/farmer/projects/:id` | FarmerProjectDetail |
| `/farmer/projects/:id/dataroom` | FarmerProjectDataRoom |
| `/farmer/projects/:id/reports` | FarmerProjectReports |
| `/farmer/projects/:id/access` | FarmerProjectAccessLog |
| `/farmer/certifications` | FarmerCertifications |
| `/farmer/devices` | FarmerDevices |
| `/farmer/surveys` | FarmerSurveys |
| `/farmer/sync` | FarmerSyncStatus |
| `/farmer/verification` | FarmerVerification |
| `/farmer/conflicts` | FarmerConflictResolution |
| `/farmer/gallery` | FarmerGallery |
| `/insights` | InsightsHome |
| `/insights/:region` | InsightsRegion |
| `/international/tenders` | InternationalTenders |
| `/international/orders` | InternationalOrders |
| `/international/documents` | InternationalDocuments |
| `/investment` | InvestmentHome |
| `/investment/profile` | InvestmentProfile |
| `/investment/projects` | InvestmentFollowedProjects |
| `/investment/projects/:id` | InvestmentProjectDetail |
| `/investment/requests` | InvestmentRequests |
| `/market` | MarketPublic |
| `/market/listings` | MarketPublic |
| `/market/listings/:id` | MarketListingDetail |
| `/market/listings/new` | MarketNewListing |
| `/market/requests` | MarketRequests |
| `/market/requests/new` | MarketNewRequest |
| `/market/requests/:id/matches` | MarketRequestMatches |
| `/market/reviews` | MarketReviews |
| `/market/transporters` | MarketTransporters |
| `/market/app` | MarketApp |
| `/organization` | OrganizationHome |
| `/organization/overview` | OrganizationOverview |
| `/organization/profile` | OrganizationProfile |
| `/organization/members` | OrganizationMembers |
| `/organization/invitations` | OrganizationInvitations |
| `/organization/import` | OrganizationMemberImport |
| `/organization/farms` | OrganizationFarms |
| `/organization/production` | OrganizationProductionSummary |
| `/organization/verification` | OrganizationVerification |
| `/reviewer/missions` | ReviewerMissions |
| `/reviewer/missions/:id` | ReviewerChecklist |
| `/prices` | Prices |
| `/crop-prices` | CropPrices |
| `/weather` | Weather |
| `*` | AppNotFound |

### 4.2 Routes API backend — 413 routes montées / 409 opérations documentées

> Vérifié le 2026-11-02 par `npm run check:mounts` : **413 routes montées ·
> 409 opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans
> implémentation · 0 implémentation sans contrat**.
> Le détail de chaque opération (paramètres, schémas de requête/réponse, codes
> d'erreur) est dans `backend/docs/openapi.json` (généré par
> `npm run docs:openapi`). Les préfixes de montage : `/api/v1` pour tout,
> sauf rappels externes (webhooks Twilio, channels) montés sur leurs chemins
> publics dédiés. Authentification : `authenticate` (JWT) sauf routes
> publiques (`/public…`, `/auth…`, webhooks).

```
# ── admin (37)
GET    /
POST   /:name/run
POST   /:name/pause
POST   /:name/resume
GET    /services
GET    /health
POST   /broadcast
GET    /history
GET    /:entity
GET    /:entity/:id
POST   /:entity/:id/moderate
GET    /dashboard
GET    /dashboard/export
GET    /users
GET    /users/:id
PATCH  /users/:id/status
POST   /users/:id/unlock
POST   /users/:id/force-logout
POST   /users/:id/verify-email
POST   /users/:id/verify-phone
GET    /roles
POST   /users/:id/roles
DELETE /users/:id/roles/:role
DELETE /users/:id
GET    /users/:id/export
GET    /audit
GET    /export/farms
GET    /export
GET    /overview
GET    /policy
PUT    /policy
GET    /
PUT    /
GET    /history
POST   /:key/reset
GET    /
PUT    /
# ── ai (13)
POST   /analyses
POST   /copilot
POST   /documents
GET    /analyses
GET    /analyses/:id
POST   /analyses/:id/escalate
POST   /analyses/:id/review
POST   /analyses/:id/feedback
GET    /
POST   /
GET    /:id
POST   /:id/promote
POST   /:id/retire
# ── alerts (5)
GET    /
GET    /meta
GET    /:id
POST   /:id/read
POST   /:id/handled
# ── anomalies (6)
GET    /settings
GET    /
GET    /:anomalyId
POST   /devices/:deviceId/detect
POST   /plots/:plotId/detect
POST   /:anomalyId/review
# ── apiclients (6)
GET    /clients
POST   /clients
PATCH  /clients/:id/purpose
POST   /clients/:id/keys
DELETE /keys/:id
GET    /clients/:id/usage
# ── auth (16)
POST   /register
GET    /mfa/status
POST   /mfa/setup
POST   /mfa/confirm
POST   /mfa/verify
POST   /mfa/disable
POST   /login
POST   /refresh
POST   /verify-email
POST   /resend-verification
POST   /forgot-password
POST   /reset-password
POST   /logout
POST   /verify-phone
POST   /send-otp
POST   /sync-profile
# ── billing (5)
GET    /
POST   /
GET    /:id
POST   /:id/settlement
GET    /:id/pdf
# ── certifications (6)
GET    /
POST   /
GET    /organization/:organizationId
GET    /:id
PATCH  /:id/verify
DELETE /:id
# ── channels (4)
POST   /ussd
GET    /whatsapp/webhook
POST   /whatsapp/webhook
GET    /messages
# ── cooperatives (12)
GET    /current
PATCH  /current
GET    /:id/members
POST   /:id/members
POST   /:id/members/import
PATCH  /:id/members/:memberId
GET    /:id/overview
POST   /:id/group-offers/preview
GET    /:id/group-offers
POST   /:id/group-offers
POST   /:id/group-offers/:offerId/confirm
POST   /:id/group-offers/:offerId/cancel
# ── countries (6)
GET    /
GET    /:code
PATCH  /:code
GET    /fx-rates
GET    /fx-rates/pairs
PUT    /fx-rates
# ── crops (4)
GET    /
GET    /:id
POST   /
PATCH  /:id
# ── dashboard (1)
GET    /
# ── dataproducts (6)
GET    /
POST   /
PATCH  /:id/status
POST   /:id/aggregates
GET    /:id/aggregates
POST   /contracts
# ── dataroom (6)
GET    /projects/:projectId/documents
POST   /projects/:projectId/documents
POST   /projects/:projectId/access-requests
PATCH  /access-requests/:id
GET    /documents/:id
GET    /projects/:projectId/access-log
# ── duediligence (4)
GET    /projects/:projectId/due-diligence
POST   /projects/:projectId/due-diligence/checklist
PATCH  /due-diligence/:id
POST   /due-diligence/:id/evidence
# ── exports (5)
GET    /
POST   /
GET    /:id
POST   /:id/documents
PATCH  /:id/status
# ── farms (6)
GET    /
POST   /
GET    /:id
PATCH  /:id
PATCH  /:id/publish
DELETE /:id
# ── forecast (3)
POST   /:plotId/forecasts/:parameter
POST   /:plotId/forecasts/:parameter/backtest
GET    /:plotId/forecasts
# ── funding (4)
GET    /projects/:projectId/funding-requests
POST   /projects/:projectId/funding-requests/consent
POST   /funding-requests/:id/transmit
PATCH  /funding-requests/:id/follow-up
# ── geodata (7)
GET    /plots/:plotId/observations
GET    /plots/:plotId/satellite
POST   /satellite
GET    /plots/:plotId/drones
POST   /drones
GET    /plots/:plotId/lab-results
POST   /lab-results
# ── geospatial (17)
POST   /:plotId/soil-diagnosis
GET    /:plotId/soil-diagnosis
GET    /:plotId/soil-diagnosis/latest
GET    /health
GET    /methods
GET    /soil-diagnostics/:id
POST   /texture
POST   /spectral
POST   /imagery
POST   /sensors/quality
POST   /fusion
POST   /subsurface
POST   /spectral/phenology
POST   /:plotId/:parameter
POST   /:plotId/:parameter/evaluate
GET    /:plotId
GET    /map/:id
# ── geospatialImport (7)
POST   /
POST   /upload
POST   /process-pending
GET    /processing
POST   /:id/process
GET    /
GET    /:id
# ── insights (4)
GET    /overview
GET    /crops
GET    /activity
GET    /disclosure-policy
# ── investdashboard (1)
GET    /
# ── investors (11)
GET    /projects
GET    /followed
POST   /projects/:id/follow
DELETE /projects/:id/follow
GET    /matches
POST   /projects/:id/contact
POST   /projects/:id/contacts/:requestId/decide
GET    /contact-requests
GET    /me
PUT    /me
PATCH  /:userId/verify
# ── iot (6)
POST   /ingest
GET    /devices
POST   /devices
POST   /devices/:id/rotate-key
POST   /devices/:id/revoke
GET    /devices/:id/readings
# ── market (35)
GET    /
POST   /
GET    /:id/movements
POST   /movements
GET    /
POST   /
GET    /:id
PATCH  /:id
PATCH  /:id/status
POST   /:id/contact
POST   /:id/photos
PATCH  /:id/moderate
DELETE /:id
POST   /purchase-requests/:id/offers
GET    /purchase-requests/:id/offers
PATCH  /offers/:offerId
POST   /
GET    /
GET    /:id
GET    /:id/events
PATCH  /:id/status
PATCH  /:id/payment
POST   /:id/disputes
GET    /admin/disputes
PATCH  /admin/disputes/:id
GET    /
POST   /
GET    /:id
PATCH  /:id
GET    /:id/matches
POST   /orders/:orderId/reviews
POST   /reviews/:id/response
POST   /reviews/:id/report
POST   /reviews/:id/moderate
GET    /organizations/:organizationId/reputation
# ── media (4)
POST   /upload-url
POST   /:id/confirm
GET    /
DELETE /:id
# ── messaging (7)
POST   /conversations
GET    /conversations
GET    /conversations/:id/messages
POST   /conversations/:id/messages
POST   /conversations/:id/archive
POST   /conversations/:id/block
POST   /messages/:id/report
# ── notifications (5)
GET    /
POST   /read-all
POST   /:id/read
GET    /preferences
PUT    /preferences
# ── organizations (4)
GET    /
POST   /
GET    /:id
PATCH  /:id
# ── plots (8)
GET    /
POST   /
GET    /:id
PATCH  /:id
DELETE /:id
GET    /:id/crop-history
POST   /:id/crop-history
PATCH  /:id/crop-history/:historyId
# ── precision (6)
GET    /plots/:plotId/management-zones
POST   /plots/:plotId/management-zones
GET    /plots/:plotId/precision-reports
POST   /plots/:plotId/precision-reports
PATCH  /precision-reports/:id/validate
GET    /precision-reports/:id/pdf
# ── prices (4)
GET    /
GET    /series
POST   /
GET    /stale-markets
# ── productions (6)
GET    /stats
GET    /
POST   /
GET    /:id
PATCH  /:id
DELETE /:id
# ── projects (6)
GET    /
POST   /
GET    /:id
PATCH  /:id
POST   /:id/submit
PATCH  /:id/review
# ── public (6)
GET    /map
GET    /farms
GET    /farms/:slug
POST   /farms/:slug/contact
GET    /farms/:slug/qr.:format
GET    /soil-stats
# ── publicapi (13)
GET    /products
GET    /products/:id/aggregates
GET    /prices
GET    /agriculture
GET    /regions
GET    /crops
GET    /market-prices
GET    /projects
GET    /farmers
GET    /agriculture
GET    /regions
GET    /market-prices
GET    /farmers
# ── recommendation (15)
GET    /
GET    /meta
GET    /import/template
POST   /import
GET    /:id
POST   /
PATCH  /:id
POST   /:id/validate
POST   /:id/retire
POST   /:plotId/recommendations
GET    /:plotId/recommendations
GET    /engine
GET    /:id
GET    /:id/explanation
POST   /:id/decision
# ── reporting (3)
GET    /projects/:projectId/reports
POST   /projects/:projectId/progress-reports
POST   /projects/:projectId/impact-reports
# ── reports (3)
POST   /
GET    /
PATCH  /:id
# ── satellite (3)
GET    /settings
POST   /plots/:plotId/acquire
GET    /plots/:plotId/observations
# ── seasons (7)
GET    /stats
GET    /
POST   /
GET    /:id
GET    /:id/compare
PATCH  /:id
DELETE /:id
# ── smsDelivery (9)
GET    /consent
POST   /consent
DELETE /consent
GET    /settings
GET    /messages
GET    /messages/:id
GET    /batches
POST   /test-send
POST   /status
# ── soil (21)
GET    /rulesets
POST   /rulesets
POST   /rulesets/:id/validate
POST   /rulesets/:id/retire
GET    /feature-flags
PUT    /feature-flags
GET    /:id/soil-assessments
GET    /:id/soil-profile
POST   /:id/soil-assessments
PATCH  /:id/soil-assessments/:assessmentId
DELETE /:id/soil-assessments/:assessmentId
GET    /:id/suitability
POST   /:id/suitability
GET    /:id/suitability/:suitabilityId
GET    /:id/rotation-plans
POST   /:id/rotation-plans
PATCH  /:id/rotation-plans/:planId
GET    /:id/farming-plans
POST   /:id/farming-plans
GET    /:id/yield-estimates
POST   /:id/yield-estimates
# ── sync (4)
GET    /collections
POST   /push
GET    /pull
GET    /conflicts
# ── tenders (6)
GET    /
POST   /
GET    /:id
POST   /:id/responses
POST   /:id/award
POST   /:id/close
# ── traceability (7)
GET    /lots/:code
GET    /
POST   /
GET    /:id
POST   /:id/events
PUT    /:id/public-fields
POST   /:id/recall
# ── transport (6)
GET    /requests
POST   /requests
POST   /requests/:id/offers
POST   /offers/:id/accept
POST   /requests/:id/proof-of-delivery
PATCH  /requests/:id/status
# ── users (5)
GET    /
PATCH  /
GET    /permissions
POST   /password
DELETE /
# ── verification (4)
POST   /
GET    /me
GET    /
PATCH  /:id
# ── weather (4)
GET    /plots/:plotId
GET    /plots/:plotId/history
GET    /plots/:plotId/alerts
POST   /
```
