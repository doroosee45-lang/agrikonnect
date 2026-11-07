# Matrice de traçabilité — CDC v2.0 → code

> Généré par `npm run docs:traceability` à partir de `scripts/check-traceability.mjs`.
> Le script échoue si une famille d’exigences n’a **ni** module, **ni** route, **ni** permission, **ni** test.

## V1

| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |
|---|---|---|---|---|---|---|
| **AUTH** | AUTH-01 → AUTH-07 | Inscription, connexion, OTP, jetons, réinitialisation | 16 | 0 | 2 | ✅ |
| **PROF** | PROF-01 → PROF-04 | Profil utilisateur et préférences | 5 | 0 | 2 | ✅ |
| **FARM** | FARM-01 → FARM-04 | Exploitations agricoles | 6 | 3 | 2 | ✅ |
| **PLOT** | PLOT-01 → PLOT-05 | Parcelles et historique cultural | 8 | 3 | 4 | ✅ |
| **CROP** | CROP-01 → CROP-03 | Référentiel des cultures | 4 | 2 | 2 | ✅ |
| **PROD** | PROD-01 → PROD-04 | Productions et rendements | 6 | 2 | 2 | ✅ |
| **COOP** | COOP-01 → COOP-05 | Coopératives et consentement des membres | 12 | 3 | 2 | ✅ |
| **PUB** | PUB-01 → PUB-06 | Profils publics et annuaire | 6 | 0 | 3 | ✅ |
| **MAP** | MAP-01 → MAP-04 | Cartographie publique (bbox, arrondi des coordonnées) | 6 | 0 | 2 | ✅ |
| **VER** | VER-01 → VER-05 | Vérification des exploitations | 2 | 3 | 2 | ✅ |
| **SOIL** | SOIL-01 → SOIL-03 | Socle Soil S1 (relevés, sans recommandation automatique) | 21 | 3 | 3 | ✅ |

## V2

| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |
|---|---|---|---|---|---|---|
| **MKT** | MKT-01 → MKT-06 | Annonces marketplace et modération | 9 | 4 | 3 | ✅ |
| **REQ** | REQ-01 → REQ-05 | Demandes d'achat et matching explicable | 5 | 2 | 2 | ✅ |
| **OFF** | OFF-01 → OFF-04 | Offres chiffrées et datées | 3 | 2 | 2 | ✅ |
| **ORD** | ORD-01 → ORD-05 | Commandes, machine à états, journal | 9 | 3 | 2 | ✅ |
| **STK** | STK-01 → STK-02 | Stock dérivé du journal de mouvements | 4 | 2 | 2 | ✅ |
| **TRA** | TRA-01 → TRA-03 | Transport, suivi et preuve de livraison | 6 | 2 | 2 | ✅ |
| **MSG** | MSG-01 → MSG-04 | Messagerie rattachée à un objet métier | 7 | 3 | 1 | ✅ |
| **NOTIF** | NOTIF-01 → NOTIF-04 | Notifications et préférences par canal | 5 | 2 | 3 | ✅ |
| **BIL** | BIL-01 → BIL-04 | Facturation déclarative, numérotation, devises | 5 | 2 | 4 | ✅ |
| **REV** | REV-01 → REV-03 | Avis et réputation après livraison | 5 | 3 | 1 | ✅ |
| **DISP** | DISP-01 → DISP-02 | Litiges et décision de modération | 9 | 2 | 2 | ✅ |
| **MOD** | MOD-01 → MOD-02 | Modération (annonces, avis, messages) | 9 | 1 | 2 | ✅ |
| **SOIL2** | SOIL2-01 → SOIL2-06 | S2 — règles agronomiques, compatibilité, rotation, plan | 21 | 3 | 1 | ✅ |
| **COOPG** | COOPG-01 | COOP-10 — offre groupée et répartition traçable | 12 | 3 | 1 | ✅ |

## V3

| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |
|---|---|---|---|---|---|---|
| **SYNC** | SYNC-01 → SYNC-05 | Synchronisation hors-ligne idempotente | 4 | 1 | 3 | ✅ |
| **SOIL3** | SOIL3-01 → SOIL3-05 | S3 — fusion des sources, profil de sol, rendement | 21 | 3 | 1 | ✅ |
| **USSD** | USSD-01 | USSD-01 — canal vocal/texte pas à pas | 3 | 1 | 1 | ✅ |
| **WA** | WA-01 | WA-01 — webhook WhatsApp signé | 3 | 1 | 1 | ✅ |
| **AI** | AI-01 → AI-06 | Analyses IA encadrées (consentement, avertissement, escalade) | 8 | 3 | 3 | ✅ |
| **WEA** | WEA-01 → WEA-03 | Météo datée et sourcée | 4 | 1 | 2 | ✅ |
| **PRI** | PRI-01 → PRI-03 | Prix de marché datés et sourcés | 4 | 2 | 2 | ✅ |
| **TRACE** | TRACE-01 → TRACE-05 | Traçabilité des lots et vue publique QR | 7 | 2 | 5 | ✅ |
| **CERT** | CERT-01 → CERT-04 | Certifications vérifiées, avec échéance | 6 | 3 | 3 | ✅ |
| **IOT** | IOT-01 → IOT-04 | Objets connectés, clés révocables, seuils | 6 | 2 | 3 | ✅ |
| **GEO** | GEO-01 → GEO-04 | Satellite, drone, laboratoire rattachés à la parcelle | 7 | 2 | 3 | ✅ |

## V4

| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |
|---|---|---|---|---|---|---|
| **PRJ** | PRJ-01 → PRJ-05 | Projets avec provenance par champ | 6 | 3 | 3 | ✅ |
| **DR** | DR-01 → DR-04 | Data room fermée par défaut, journal d'accès | 6 | 4 | 3 | ✅ |
| **DD** | DD-01 → DD-04 | Due diligence et professionnels | 4 | 2 | 2 | ✅ |
| **RPT** | RPT-01 → RPT-03 | Rapports d'avancement et d'impact | 3 | 2 | 2 | ✅ |
| **FUND** | FUND-01 → FUND-03 | Demandes de financement avec consentement | 4 | 2 | 2 | ✅ |
| **INV** | INV-01 → INV-03 | Profils investisseurs vérifiés et MFA | 11 | 3 | 3 | ✅ |
| **INVH** | INVH-01 → INVH-02 | INV-02/03 — exploration, suivi, matching sans score | 11 | 3 | 1 | ✅ |
| **MFA** | MFA-01 | NFR-01 — MFA TOTP obligatoire | 16 | 0 | 1 | ✅ |
| **PREC** | PREC-01 → PREC-03 | Zones de gestion et rapports de précision versionnés | 6 | 2 | 2 | ✅ |

## V5

| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |
|---|---|---|---|---|---|---|
| **TND** | TND-01 → TND-04 | Appels d'offres et réponses | 6 | 3 | 1 | ✅ |
| **EXP** | EXP-01 → EXP-04 | Ordres d'export (Incoterms, documents, devises) | 5 | 2 | 2 | ✅ |
| **API** | API-01 → API-04 | Clients API, clés hachées, quota et journal | 6 | 2 | 4 | ✅ |
| **DATA** | DATA-01 → DATA-04 | Produits de données, k-anonymat, contrats | 6 | 1 | 2 | ✅ |
| **INS** | INS-01 → INS-03 | Observatoire pays (agrégats sourcés) | 4 | 1 | 2 | ✅ |
| **SOIL5** | SOIL5-01 → SOIL5-02 | S5 — statistiques de sol agrégées, k-anonymat ≥ 10 | 6 | 3 | 1 | ✅ |
| **GLB** | GLB-01 → GLB-03 | Référentiels globaux (pays, devises, taux) | 6 | 2 | 2 | ✅ |
| **FX** | FX-01 → FX-02 | Taux de change datés et sourcés | 6 | 2 | 2 | ✅ |

---

**Couverture : 196/196 exigences** (familles complètes).

## Détail des routes par famille

### AUTH — Inscription, connexion, OTP, jetons, réinitialisation

- `POST /auth/register`
- `GET /auth/mfa/status`
- `POST /auth/mfa/setup`
- `POST /auth/mfa/confirm`
- `POST /auth/mfa/verify`
- `POST /auth/mfa/disable`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/logout`
- `POST /auth/verify-phone`
- `POST /auth/send-otp`
- `POST /auth/sync-profile`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### PROF — Profil utilisateur et préférences

- `GET /me`
- `PATCH /me`
- `GET /me/permissions`
- `POST /me/password`
- `DELETE /me`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### FARM — Exploitations agricoles

- `GET /farms`
- `POST /farms`
- `GET /farms/:id`
- `PATCH /farms/:id`
- `PATCH /farms/:id/publish`
- `DELETE /farms/:id`

Tests : `tests/families.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### PLOT — Parcelles et historique cultural

- `GET /plots`
- `POST /plots`
- `GET /plots/:id`
- `PATCH /plots/:id`
- `DELETE /plots/:id`
- `GET /plots/:id/crop-history`
- `POST /plots/:id/crop-history`
- `PATCH /plots/:id/crop-history/:historyId`

Tests : `tests/families-v1.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v1.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### CROP — Référentiel des cultures

- `GET /crops`
- `GET /crops/:id`
- `POST /crops`
- `PATCH /crops/:id`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### PROD — Productions et rendements

- `GET /productions/stats`
- `GET /productions`
- `POST /productions`
- `GET /productions/:id`
- `PATCH /productions/:id`
- `DELETE /productions/:id`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### COOP — Coopératives et consentement des membres

- `GET /cooperatives/current`
- `PATCH /cooperatives/current`
- `GET /cooperatives/:id/members`
- `POST /cooperatives/:id/members`
- `POST /cooperatives/:id/members/import`
- `PATCH /cooperatives/:id/members/:memberId`
- `GET /cooperatives/:id/overview`
- `POST /cooperatives/:id/group-offers/preview`
- `GET /cooperatives/:id/group-offers`
- `POST /cooperatives/:id/group-offers`
- `POST /cooperatives/:id/group-offers/:offerId/confirm`
- `POST /cooperatives/:id/group-offers/:offerId/cancel`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### PUB — Profils publics et annuaire

- `GET /public/map`
- `GET /public/farms`
- `GET /public/farms/:slug`
- `POST /public/farms/:slug/contact`
- `GET /public/farms/:slug/qr.:format`
- `GET /public/soil-stats`

Tests : `tests/families-v1.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### MAP — Cartographie publique (bbox, arrondi des coordonnées)

- `GET /public/map`
- `GET /public/farms`
- `GET /public/farms/:slug`
- `POST /public/farms/:slug/contact`
- `GET /public/farms/:slug/qr.:format`
- `GET /public/soil-stats`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### VER — Vérification des exploitations

- `POST /verifications`
- `GET /verifications/me`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### SOIL — Socle Soil S1 (relevés, sans recommandation automatique)

- `GET /plots/rulesets`
- `POST /plots/rulesets`
- `POST /plots/rulesets/:id/validate`
- `POST /plots/rulesets/:id/retire`
- `GET /plots/feature-flags`
- `PUT /plots/feature-flags`
- `GET /plots/:id/soil-assessments`
- `GET /plots/:id/soil-profile`
- `POST /plots/:id/soil-assessments`
- `PATCH /plots/:id/soil-assessments/:assessmentId`
- `DELETE /plots/:id/soil-assessments/:assessmentId`
- `GET /plots/:id/suitability`
- `POST /plots/:id/suitability`
- `GET /plots/:id/suitability/:suitabilityId`
- `GET /plots/:id/rotation-plans`
- `POST /plots/:id/rotation-plans`
- `PATCH /plots/:id/rotation-plans/:planId`
- `GET /plots/:id/farming-plans`
- `POST /plots/:id/farming-plans`
- `GET /plots/:id/yield-estimates`
- `POST /plots/:id/yield-estimates`

Tests : `tests/families.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### MKT — Annonces marketplace et modération

- `GET /listings`
- `POST /listings`
- `GET /listings/:id`
- `PATCH /listings/:id`
- `PATCH /listings/:id/status`
- `POST /listings/:id/contact`
- `POST /listings/:id/photos`
- `PATCH /listings/:id/moderate`
- `DELETE /listings/:id`

Tests : `tests/jobs.integration.test.mjs`, `tests/listings.integration.test.mjs`, `tests/req-v2.integration.test.mjs`

### REQ — Demandes d'achat et matching explicable

- `GET /purchase-requests`
- `POST /purchase-requests`
- `GET /purchase-requests/:id`
- `PATCH /purchase-requests/:id`
- `GET /purchase-requests/:id/matches`

Tests : `tests/logic.test.mjs`, `tests/req-v2.integration.test.mjs`

### OFF — Offres chiffrées et datées

- `POST /market/purchase-requests/:id/offers`
- `GET /market/purchase-requests/:id/offers`
- `PATCH /market/offers/:offerId`

Tests : `tests/families.integration.test.mjs`, `tests/req-v2.integration.test.mjs`

### ORD — Commandes, machine à états, journal

- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `GET /orders/:id/events`
- `PATCH /orders/:id/status`
- `PATCH /orders/:id/payment`
- `POST /orders/:id/disputes`
- `GET /orders/admin/disputes`
- `PATCH /orders/admin/disputes/:id`

Tests : `tests/jobs.integration.test.mjs`, `tests/orders.integration.test.mjs`

### STK — Stock dérivé du journal de mouvements

- `GET /inventory`
- `POST /inventory`
- `GET /inventory/:id/movements`
- `POST /inventory/movements`

Tests : `tests/families.integration.test.mjs`, `tests/req-v2.integration.test.mjs`

### TRA — Transport, suivi et preuve de livraison

- `GET /transport/requests`
- `POST /transport/requests`
- `POST /transport/requests/:id/offers`
- `POST /transport/offers/:id/accept`
- `POST /transport/requests/:id/proof-of-delivery`
- `PATCH /transport/requests/:id/status`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-v2.integration.test.mjs`

### MSG — Messagerie rattachée à un objet métier

- `POST /messaging/conversations`
- `GET /messaging/conversations`
- `GET /messaging/conversations/:id/messages`
- `POST /messaging/conversations/:id/messages`
- `POST /messaging/conversations/:id/archive`
- `POST /messaging/conversations/:id/block`
- `POST /messaging/messages/:id/report`

Tests : `tests/messaging.integration.test.mjs`

### NOTIF — Notifications et préférences par canal

- `GET /notifications`
- `POST /notifications/read-all`
- `POST /notifications/:id/read`
- `GET /notifications/preferences`
- `PUT /notifications/preferences`

Tests : `tests/families-v1.integration.test.mjs`, `tests/jobs.integration.test.mjs`, `tests/req-v2.integration.test.mjs`

### BIL — Facturation déclarative, numérotation, devises

- `GET /billing`
- `POST /billing`
- `GET /billing/:id`
- `POST /billing/:id/settlement`
- `GET /billing/:id/pdf`

Tests : `tests/intelligence.integration.test.mjs`, `tests/logic.test.mjs`, `tests/req-extra.integration.test.mjs`, `tests/req-v1.integration.test.mjs`

### REV — Avis et réputation après livraison

- `POST /reviews/orders/:orderId/reviews`
- `POST /reviews/reviews/:id/response`
- `POST /reviews/reviews/:id/report`
- `POST /reviews/reviews/:id/moderate`
- `GET /reviews/organizations/:organizationId/reputation`

Tests : `tests/reviews.integration.test.mjs`

### DISP — Litiges et décision de modération

- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `GET /orders/:id/events`
- `PATCH /orders/:id/status`
- `PATCH /orders/:id/payment`
- `POST /orders/:id/disputes`
- `GET /orders/admin/disputes`
- `PATCH /orders/admin/disputes/:id`

Tests : `tests/jobs.integration.test.mjs`, `tests/orders.integration.test.mjs`

### MOD — Modération (annonces, avis, messages)

- `GET /listings`
- `POST /listings`
- `GET /listings/:id`
- `PATCH /listings/:id`
- `PATCH /listings/:id/status`
- `POST /listings/:id/contact`
- `POST /listings/:id/photos`
- `PATCH /listings/:id/moderate`
- `DELETE /listings/:id`

Tests : `tests/listings.integration.test.mjs`, `tests/reviews.integration.test.mjs`

### SOIL2 — S2 — règles agronomiques, compatibilité, rotation, plan

- `GET /admin/rulesets`
- `POST /admin/rulesets`
- `POST /admin/rulesets/:id/validate`
- `POST /admin/rulesets/:id/retire`
- `GET /admin/feature-flags`
- `PUT /admin/feature-flags`
- `GET /admin/:id/soil-assessments`
- `GET /admin/:id/soil-profile`
- `POST /admin/:id/soil-assessments`
- `PATCH /admin/:id/soil-assessments/:assessmentId`
- `DELETE /admin/:id/soil-assessments/:assessmentId`
- `GET /admin/:id/suitability`
- `POST /admin/:id/suitability`
- `GET /admin/:id/suitability/:suitabilityId`
- `GET /admin/:id/rotation-plans`
- `POST /admin/:id/rotation-plans`
- `PATCH /admin/:id/rotation-plans/:planId`
- `GET /admin/:id/farming-plans`
- `POST /admin/:id/farming-plans`
- `GET /admin/:id/yield-estimates`
- `POST /admin/:id/yield-estimates`

Tests : `tests/intelligence.integration.test.mjs`

### COOPG — COOP-10 — offre groupée et répartition traçable

- `GET /cooperatives/current`
- `PATCH /cooperatives/current`
- `GET /cooperatives/:id/members`
- `POST /cooperatives/:id/members`
- `POST /cooperatives/:id/members/import`
- `PATCH /cooperatives/:id/members/:memberId`
- `GET /cooperatives/:id/overview`
- `POST /cooperatives/:id/group-offers/preview`
- `GET /cooperatives/:id/group-offers`
- `POST /cooperatives/:id/group-offers`
- `POST /cooperatives/:id/group-offers/:offerId/confirm`
- `POST /cooperatives/:id/group-offers/:offerId/cancel`

Tests : `tests/intelligence.integration.test.mjs`

### SYNC — Synchronisation hors-ligne idempotente

- `GET /sync/collections`
- `POST /sync/push`
- `GET /sync/pull`
- `GET /sync/conflicts`

Tests : `tests/families.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### SOIL3 — S3 — fusion des sources, profil de sol, rendement

- `GET /plots/rulesets`
- `POST /plots/rulesets`
- `POST /plots/rulesets/:id/validate`
- `POST /plots/rulesets/:id/retire`
- `GET /plots/feature-flags`
- `PUT /plots/feature-flags`
- `GET /plots/:id/soil-assessments`
- `GET /plots/:id/soil-profile`
- `POST /plots/:id/soil-assessments`
- `PATCH /plots/:id/soil-assessments/:assessmentId`
- `DELETE /plots/:id/soil-assessments/:assessmentId`
- `GET /plots/:id/suitability`
- `POST /plots/:id/suitability`
- `GET /plots/:id/suitability/:suitabilityId`
- `GET /plots/:id/rotation-plans`
- `POST /plots/:id/rotation-plans`
- `PATCH /plots/:id/rotation-plans/:planId`
- `GET /plots/:id/farming-plans`
- `POST /plots/:id/farming-plans`
- `GET /plots/:id/yield-estimates`
- `POST /plots/:id/yield-estimates`

Tests : `tests/intelligence.integration.test.mjs`

### USSD — USSD-01 — canal vocal/texte pas à pas

- `POST /channels/ussd`
- `GET /channels/whatsapp/webhook`
- `POST /channels/whatsapp/webhook`

Tests : `tests/intelligence.integration.test.mjs`

### WA — WA-01 — webhook WhatsApp signé

- `POST /channels/ussd`
- `GET /channels/whatsapp/webhook`
- `POST /channels/whatsapp/webhook`

Tests : `tests/intelligence.integration.test.mjs`

### AI — Analyses IA encadrées (consentement, avertissement, escalade)

- `POST /ai/analyses`
- `POST /ai/copilot`
- `POST /ai/documents`
- `GET /ai/analyses`
- `GET /ai/analyses/:id`
- `POST /ai/analyses/:id/escalate`
- `POST /ai/analyses/:id/review`
- `POST /ai/analyses/:id/feedback`

Tests : `tests/policies.integration.test.mjs`, `tests/req-extra.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### WEA — Météo datée et sourcée

- `GET /weather/plots/:plotId`
- `GET /weather/plots/:plotId/history`
- `GET /weather/plots/:plotId/alerts`
- `POST /weather`

Tests : `tests/families.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### PRI — Prix de marché datés et sourcés

- `GET /prices`
- `GET /prices/series`
- `POST /prices`
- `GET /prices/stale-markets`

Tests : `tests/families.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### TRACE — Traçabilité des lots et vue publique QR

- `GET /lots/lots/:code`
- `GET /lots`
- `POST /lots`
- `GET /lots/:id`
- `POST /lots/:id/events`
- `PUT /lots/:id/public-fields`
- `POST /lots/:id/recall`

Tests : `tests/families-v1.integration.test.mjs`, `tests/families.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v1.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### CERT — Certifications vérifiées, avec échéance

- `GET /certifications`
- `POST /certifications`
- `GET /certifications/organization/:organizationId`
- `GET /certifications/:id`
- `PATCH /certifications/:id/verify`
- `DELETE /certifications/:id`

Tests : `tests/families.integration.test.mjs`, `tests/req-extra.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### IOT — Objets connectés, clés révocables, seuils

- `POST /iot/ingest`
- `GET /iot/devices`
- `POST /iot/devices`
- `POST /iot/devices/:id/rotate-key`
- `POST /iot/devices/:id/revoke`
- `GET /iot/devices/:id/readings`

Tests : `tests/families-v1.integration.test.mjs`, `tests/jobs.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### GEO — Satellite, drone, laboratoire rattachés à la parcelle

- `GET /geodata/plots/:plotId/observations`
- `GET /geodata/plots/:plotId/satellite`
- `POST /geodata/satellite`
- `GET /geodata/plots/:plotId/drones`
- `POST /geodata/drones`
- `GET /geodata/plots/:plotId/lab-results`
- `POST /geodata/lab-results`

Tests : `tests/families.integration.test.mjs`, `tests/geospatial.integration.test.mjs`, `tests/req-v3.integration.test.mjs`

### PRJ — Projets avec provenance par champ

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/submit`
- `PATCH /projects/:id/review`

Tests : `tests/families.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### DR — Data room fermée par défaut, journal d'accès

- `GET /dataroom/projects/:projectId/documents`
- `POST /dataroom/projects/:projectId/documents`
- `POST /dataroom/projects/:projectId/access-requests`
- `PATCH /dataroom/access-requests/:id`
- `GET /dataroom/documents/:id`
- `GET /dataroom/projects/:projectId/access-log`

Tests : `tests/jobs.integration.test.mjs`, `tests/policies.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### DD — Due diligence et professionnels

- `GET /projects/projects/:projectId/due-diligence`
- `POST /projects/projects/:projectId/due-diligence/checklist`
- `PATCH /projects/due-diligence/:id`
- `POST /projects/due-diligence/:id/evidence`

Tests : `tests/families.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### RPT — Rapports d'avancement et d'impact

- `GET /projects/projects/:projectId/reports`
- `POST /projects/projects/:projectId/progress-reports`
- `POST /projects/projects/:projectId/impact-reports`

Tests : `tests/families.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### FUND — Demandes de financement avec consentement

- `GET /funding/projects/:projectId/funding-requests`
- `POST /funding/projects/:projectId/funding-requests/consent`
- `POST /funding/funding-requests/:id/transmit`
- `PATCH /funding/funding-requests/:id/follow-up`

Tests : `tests/families.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### INV — Profils investisseurs vérifiés et MFA

- `GET /investors/projects`
- `GET /investors/followed`
- `POST /investors/projects/:id/follow`
- `DELETE /investors/projects/:id/follow`
- `GET /investors/matches`
- `POST /investors/projects/:id/contact`
- `POST /investors/projects/:id/contacts/:requestId/decide`
- `GET /investors/contact-requests`
- `GET /investors/me`
- `PUT /investors/me`
- `PATCH /investors/:userId/verify`

Tests : `tests/families-v1.integration.test.mjs`, `tests/intelligence.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### INVH — INV-02/03 — exploration, suivi, matching sans score

- `GET /investment/projects`
- `GET /investment/followed`
- `POST /investment/projects/:id/follow`
- `DELETE /investment/projects/:id/follow`
- `GET /investment/matches`
- `POST /investment/projects/:id/contact`
- `POST /investment/projects/:id/contacts/:requestId/decide`
- `GET /investment/contact-requests`
- `GET /investment/me`
- `PUT /investment/me`
- `PATCH /investment/:userId/verify`

Tests : `tests/intelligence.integration.test.mjs`

### MFA — NFR-01 — MFA TOTP obligatoire

- `POST /auth/register`
- `GET /auth/mfa/status`
- `POST /auth/mfa/setup`
- `POST /auth/mfa/confirm`
- `POST /auth/mfa/verify`
- `POST /auth/mfa/disable`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/logout`
- `POST /auth/verify-phone`
- `POST /auth/send-otp`
- `POST /auth/sync-profile`

Tests : `tests/intelligence.integration.test.mjs`

### PREC — Zones de gestion et rapports de précision versionnés

- `GET /precision/plots/:plotId/management-zones`
- `POST /precision/plots/:plotId/management-zones`
- `GET /precision/plots/:plotId/precision-reports`
- `POST /precision/plots/:plotId/precision-reports`
- `PATCH /precision/precision-reports/:id/validate`
- `GET /precision/precision-reports/:id/pdf`

Tests : `tests/families.integration.test.mjs`, `tests/req-v4.integration.test.mjs`

### TND — Appels d'offres et réponses

- `GET /tenders`
- `POST /tenders`
- `GET /tenders/:id`
- `POST /tenders/:id/responses`
- `POST /tenders/:id/award`
- `POST /tenders/:id/close`

Tests : `tests/families.integration.test.mjs`

### EXP — Ordres d'export (Incoterms, documents, devises)

- `GET /exports`
- `POST /exports`
- `GET /exports/:id`
- `POST /exports/:id/documents`
- `PATCH /exports/:id/status`

Tests : `tests/families.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### API — Clients API, clés hachées, quota et journal

- `GET /api-clients/clients`
- `POST /api-clients/clients`
- `PATCH /api-clients/clients/:id/purpose`
- `POST /api-clients/clients/:id/keys`
- `DELETE /api-clients/keys/:id`
- `GET /api-clients/clients/:id/usage`

Tests : `tests/intelligence.integration.test.mjs`, `tests/jobs.integration.test.mjs`, `tests/policies.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### DATA — Produits de données, k-anonymat, contrats

- `GET /data`
- `POST /data`
- `PATCH /data/:id/status`
- `POST /data/:id/aggregates`
- `GET /data/:id/aggregates`
- `POST /data/contracts`

Tests : `tests/policies.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### INS — Observatoire pays (agrégats sourcés)

- `GET /insights/overview`
- `GET /insights/crops`
- `GET /insights/activity`
- `GET /insights/disclosure-policy`

Tests : `tests/families.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### SOIL5 — S5 — statistiques de sol agrégées, k-anonymat ≥ 10

- `GET /public/map`
- `GET /public/farms`
- `GET /public/farms/:slug`
- `POST /public/farms/:slug/contact`
- `GET /public/farms/:slug/qr.:format`
- `GET /public/soil-stats`

Tests : `tests/intelligence.integration.test.mjs`

### GLB — Référentiels globaux (pays, devises, taux)

- `GET /countries`
- `GET /countries/:code`
- `PATCH /countries/:code`
- `GET /countries/fx-rates`
- `GET /countries/fx-rates/pairs`
- `PUT /countries/fx-rates`

Tests : `tests/families.integration.test.mjs`, `tests/req-v5.integration.test.mjs`

### FX — Taux de change datés et sourcés

- `GET /countries`
- `GET /countries/:code`
- `PATCH /countries/:code`
- `GET /countries/fx-rates`
- `GET /countries/fx-rates/pairs`
- `PUT /countries/fx-rates`

Tests : `tests/families-v1.integration.test.mjs`, `tests/req-extra.integration.test.mjs`
