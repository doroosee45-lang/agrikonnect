---

## 5. Composants et modules

### 5.1 Modules backend — 53 modules (`backend/src/modules/`)

| Module | Rôle | Module | Rôle |
|---|---|---|---|
| admin | **Super Admin** : dashboard, comptes, rôles, **paramètres globaux & feature flags (M3)**, **supervision (M5)**, **audit avancé & sécurité (M6)**, jobs, audit | ai | Analyses IA, versions de modèles, assistant |
| alerts | Alertes (escalade, re-notification, libellés GSM) | anomalies | Détection d'anomalies agronomiques |
| apiclients | Clients API, clés, quotas, usage | auth | Inscription, connexion, OTP, MFA, jetons |
| billing | Facturation, litiges | certifications | Certifications de lots |
| channels | Sessions/messages multi-canaux (webhooks) | cooperatives | Coopératives et membres |
| countries | Fiches pays (compliance, hébergement) | crops | Cultures |
| dashboard | Indicateurs | dataproducts | Produits de données, contrats |
| dataroom | Data room (accès, journaux) | duediligence | Due diligence investisseurs |
| exports | Commandes d'export, documents | farms | Exploitations |
| forecast | Prévisions | funding | Demandes de financement |
| geodata | Données géospatiales | geospatial | Géospatial (parcelles, interpolation, S3) |
| geospatialImport | Import de fichiers géospatiaux | insights | Indicateurs par pays/région |
| investdashboard | Tableau de bord investisseur | investors | Investisseurs, hub |
| iot | Capteurs et dispositifs | market | **35 routes** : listings, demandes, offres, commandes, inventaire, avis |
| media | Médias et fichiers | messaging | Messagerie |
| notifications | Notifications et préférences | organizations | Organisations |
| plots | Parcelles | precision | Agriculture de précision (zones, rapports) |
| prices | Prix de marché | productions | Productions |
| projects | Projets d'investissement | public | API publique du site |
| publicapi | API publique versionnée + alias données | recommendation | **Recommandations agronomiques, plages** |
| reporting | Rapports investisseurs | reports | Rapports et exports |
| satellite | Acquisitions satellite | seasons | Campagnes |
| smsDelivery | Envoi SMS (Twilio), consentements, lots | soil | Sol, diagnostics, règles, feature flags |
| sync | Synchronisation hors-ligne | tenders | Appels d'offres |
| traceability | Lots et traçabilité (QR public) | transport | Transport |
| users | Profils utilisateurs | verification | Vérifications (documents) |
| weather | Météo | | |

### 5.2 Middlewares (`backend/src/middleware/`)

| Fichier | Rôle |
|---|---|
| `auth.js` | `authenticate` — vérification du JWT Supabase, chargement du profil |
| `tenant.js` | `resolveTenant` — rôles effectifs (personnels + par organisation) |
| `authorize.js` | `authorize('permission')`, `requireMfa`, `requireSuperAdmin` (palier 2) |
| `validate.js` | Validation Zod (corps, requête, paramètres) |
| `rateLimit.js` | Limitation de débit (global + dépôts) |
| `idempotency.js` | Idempotence des mutations (table `idempotency_keys`) |
| `apiKey.js` | Authentification par clé d'API (public-api) |
| `settingsEffects.js` | Effets réels des paramètres (M3) : `403 module_disabled` par module, `403 maintenance_mode` sur les mutations hors `/auth`,`/admin`,`/webhooks`,`/health` — cache 15 s invalidé par les écritures |

### 5.3 Bibliothèque partagée (`backend/src/shared/`)

`audit.js` (journal immuable) · `permissions.js` (matrice PERMISSIONS/GOVERNANCE_ROLES) · `crypto.js` · `dataMode.js` · `events.js` · `fileMagic.js`/`fileParsers.js` · `geo.js` · `ids.js` · `links.js` · `matching.js` · `money.js` · `multipart.js` · `orderStateMachine.js` · `pagination.js` · `pdf.js` · `quietHours.js` · `quota.js` · `resource.js` · `senderId.js` · `slug.js` · `startup/` · `transaction.js` · `units.js` · `http/` (asyncHandler, réponse, logger) · `errors/` (ApiError, codes).

### 5.4 Web — composants et services

- **20 composants** dans `apps/web/src/components/` : kit UI (`ui/` : Button, Card, Input, Chip, Table…), layout (`layout/AppLayout`), Hero Carousel (pages publiques), pages communes (`components/pages/NotFound`).
- **Services** (`src/services/`) : `http.ts` (axios + intercepteurs + `RequestError`),
  `endpoints.ts` (couche `adminApi`…), `query.ts` (clés React Query),
  `session.ts`, `realtime.ts` (socket.io), `types.ts`.
- **État** : `store/auth.ts` (Zustand), React Query pour le reste.

### 5.5 Mobile — composants et services

- **40 composants** (`src/components/`) : kit UI, `app/AppHeader`, `public-site/`
  (PublicShell, sections d'accueil, ServicesSection…).
- **lib/** : `config.ts`, `faq.ts`, `format.ts`, `phone.ts`, `platform.ts`,
  `secure-storage.ts`, `service-catalog.ts` (SERVICE_CATALOG), `ulid.ts`.
- **services/** : `api/` (client fetch + `endpoints.ts`), `query.ts`, `realtime.ts`.
- **store/** : `auth.ts` · **hooks/** : `useMouvementReducit.ts`, `usePublicData.ts`.

---

## 6. Base de données

**PostgreSQL** (projet Supabase `tvjyyevozihshzidqtbx`) via **Prisma 5.22**.
**101 modèles**, **19 migrations** (`prisma/migrations/` + `migration_lock.toml`, la dernière
`20261031000000_admin_governance` crée `settings_revisions`).
Contrôle de dérive : `npm run check:migrations` (échoue en cas de drift).

### 6.1 Modèles par domaine

| Domaine | Modèles |
|---|---|
| Identité & org. | `Profile`, `Organization`, `Membership`, `Country`, `MfaSecret`, `Token`, `OtpCode` |
| Agricole | `Farm`, `FarmCrop`, `Plot`, `PlotCropHistory`, `Production`, `Crop`, `SeasonFeedback` |
| Sol & conseil | `SoilAssessment`, `SoilParameter`, `SoilDiagnostic`, `SoilPrediction`, `CropRecommendation`, `CropAgronomicRange`, `AgronomicRuleSet`, `CropSuitability`, `RotationPlan`, `FarmingPlan`, `YieldEstimate` |
| Marché | `Listing`, `PurchaseRequest`, `Offer`, `Order`, `OrderEvent`, `InventoryItem`, `InventoryMovement`, `Review`, `Dispute`, `MarketPrice` |
| Transport | `TransportRequest`, `TransportOffer` |
| Coop. & projets | `Cooperative`, `CooperativeMember`, `Project`, `ProjectDocument`, `ProjectFollow`, `ProjectContactRequest`, `GroupOffer`, `DataRoomAccessRequest`, `DataRoomAccessLog`, `DueDiligenceItem`, `ProgressReport`, `ImpactReport`, `FundingRequest`, `InvestorProfile` |
| Invest. & export | `Tender`, `TenderResponse`, `ExportOrder`, `ExportDocument` |
| Traçabilité | `TraceabilityLot`, `LotEvent`, `Certification`, `LabResult` |
| Données & IA | `AiAnalysis`, `AiModelVersion`, `DataProduct`, `DataContract`, `Aggregate`, `WeatherData`, `SatelliteObservation`, `DroneSurvey`, `SensorAnomaly`, `ThresholdAlert`, `InterpolatedMap`, `GeospatialImport`, `ManagementZone`, `PrecisionReport` |
| IoT | `IotDevice`, `SensorReading` |
| Messagerie | `Conversation`, `Message`, `Notification`, `NotificationPreference`, `ChannelSession`, `ChannelMessage`, `SmsConsent`, `SmsMessage`, `SmsBatchLog` |
| Médias | `Media`, `Document`, `Verification`, `VerificationDocument`, `Report` |
| Plateforme | `Setting`, `SettingRevision`, `AuditLog`, `IdempotencyKey`, `ApiUsage`, `ResourceUsage`, `ApiClient`, `ApiKey`, `SyncOperation`, `FxRate`, `ZoneFeatureFlag` |

### 6.2 Modèles clés (champs principaux)

- **`Profile`** : id (UUID), email, phone, firstName/lastName, countryCode,
  status (`ACTIVE|SUSPENDED|DELETED`), mfaEnabled, lastLoginAt, failedLoginAttempts,
  lockedUntil → lié à Supabase Auth par l'UUID.
- **`Membership`** : profile ↔ organization, `roles Role[]` (rôles par organisation).
- **`AuditLog`** : actorId, action, resource, resourceId, oldValue/newValue (Json),
  ip/userAgent, createdAt — **insertion seule**.
- **`Setting`** : key (PK), value (Json), updatedBy, updatedAt.
- **`SettingRevision`** (M3) : key, previousValue, newValue, changedBy, createdAt —
  journal immuable des changements de paramètres.
- **`Order`** + **`OrderEvent`** : machine à états (`shared/orderStateMachine.js`).
- **`ZoneFeatureFlag`** : key, scope, scopeValue, enabled, reason, updatedBy.

### 6.3 Mécanismes de gestion des données

- **Soft delete** : `status = 'DELETED'` (jamais de suppression physique des
  comptes) ; suppression logique admin = auditée.
- **Multi-tenant** : `Membership.roles` + `resolveTenant` (rôles effectifs).
- **Audit immuable** : toute mutation sensible → `audit_logs`.
- **Idempotence** : `Idempotency-Key` → `idempotency_keys`.
- **Chiffrement** : secrets (clés fournisseurs, MFA) via `shared/crypto.js`.
- **Auth** : Supabase Auth (GoTrue) — l'API vérifie les JWT ; mots de passe,
  OTP, MFA TOTP (+ codes de secours) gérés côté Supabase/app.

---

## 7. Configurations techniques

### 7.1 Dépendances principales

| Côté | Dépendances |
|---|---|
| Backend | express 4.22, zod 3.25, @prisma/client 5.22, @supabase/supabase-js, helmet, cors, express-rate-limit, morgan, socket.io, ws, pdfkit, qrcode · dev : prisma, embedded-postgres |
| Web | react 19.3, react-router-dom 7.18, @tanstack/react-query 5.104, zustand, axios, framer-motion, socket.io-client, vitest · build : vite 8.3 |
| Mobile | expo ~58, expo-router, react-native-reanimated, expo-secure-store, @tanstack/react-query, zustand, axios, zod, socket.io-client |

### 7.2 Variables d'environnement (noms — **aucune valeur dans ce document**)

| Catégorie | Variables |
|---|---|
| Base | `DATABASE_URL`, `DIRECT_URL` |
| Serveur | `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGIN`, `LOG_LEVEL`, `PUBLIC_WEB_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Auth | `ACCESS_TOKEN_TTL_MINUTES`, `OTP_TTL_MINUTES`, `OTP_MAX_SENDS_PER_HOUR`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES` |
| SMS (Twilio) | `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SENDER_ID`, `TWILIO_FALLBACK_FROM`, `SMS_QUIET_*`, `TWILIO_STATUS_CALLBACK_URL`, `TWILIO_WEBHOOK_BASE_URL` |
| E-mail | `EMAIL_PROVIDER`, `EMAIL_API_KEY`/`RESEND_API_KEY`/`SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_VERIFIED_DOMAINS`, `EMAIL_REQUEST_TIMEOUT_MS`, `EMAIL_WEBHOOK_URL` |
| Stockage | `GEOSPATIAL_STORAGE_DRIVER` (local/S3), `GEOSPATIAL_STORAGE_DIR`, `GEOSPATIAL_BUCKET`, `S3_*` (endpoint, region, keys, path_style), quotas `GEOSPATIAL_*_MAX_BYTES` |
| Satellite | `SATELLITE_PROVIDER`, `SATELLITE_API_URL`, `SATELLITE_API_KEY`, `SATELLITE_ACQUISITION_ENABLED`, `SATELLITE_CLOUD_REJECT_PCT`, `SATELLITE_REFRESH_HOURS` |
| GeoAI | `GEOAI_URL`, `GEOAI_TOKEN`, `GEOAI_TIMEOUT_MS`, `GEOAI_RETRIES` |
| IoT | `LORAWAN_MQTT_URL`, `LORAWAN_MQTT_USERNAME`, `LORAWAN_MQTT_PASSWORD` |
| Alertes | `ALERT_ESCALATION_*`, `ALERT_RENOTIFY_HOURS` |
| Divers | `JOBS_ENABLED`, `REALTIME_ENABLED`, `ANOMALY_DETECTION_ENABLED`, `RECOMMENDATION_ENGINE_VERSION`, `AGGREGATE_MIN_GROUP_SIZE`, `NOTIFICATION_RETENTION_DAYS`, `ORDER_RESPONSE_DAYS`, `DISPUTE_SLA_DAYS`, `DATAROOM_ACCESS_TTL_DAYS`, `PUBLIC_COORD_DECIMALS`, `AGRONOMIC_DATASET` |

Fichiers de lecture : `backend/src/config/{env,prisma,supabase,satellite,hardware,messagingConfig}.js`.
`.env` **jamais** dans le dépôt (contrôlé par `scripts/verifier-livraison.py`).

### 7.3 Authentification et autorisations

- **Auth** : Supabase Auth (JWT) ; le backend vérifie le token (`authenticate`).
  MFA TOTP + codes de secours (`MfaSecret`), OTP SMS/e-mail, verrouillage après
  échecs (`LOGIN_MAX_ATTEMPTS`/`LOGIN_LOCK_MINUTES`).
- **Permissions** : matrice dans `shared/permissions.js` (`PERMISSIONS`,
  `ROLE_PERMISSIONS`, `GOVERNANCE_ROLES`). Extensions Super Admin :
  `admin.roles`, `admin.security`, `admin.flags`, `admin.maintenance`.
- **Palier 2** (`requireSuperAdmin`) : rôle `SUPER_ADMIN` **et** session MFA —
  nomination/révocation de rôles, suppression de compte, export de portabilité,
  (M3) `security.*`, `integrations.*`, reset de paramètre, feature flags.
- **Contrôle** : `npm run check:perms` (dernier passage : 136/140 permissions
  exercées, 0 manquante, 4 inutilisées = les extensions palier 2 en cours de
  câblage par jalons).

### 7.4 Sécurité

helmet, CORS restreint (`CORS_ORIGIN`), rate limiting global + par dépôt,
validation Zod systématique, signatures de webhooks Twilio
(`X-Twilio-Signature`, HMAC-SHA1), refus des opérateurs de requêtes
(`rejectOperators`), détection de type de fichier (`fileMagic`), chiffrement
des secrets (`crypto.js`), audit immuable, aucun secret dans les journaux.

### 7.5 Services externes

| Service | Usage | Configuration requise |
|---|---|---|
| Supabase | Base PostgreSQL + Auth | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*` |
| Twilio | SMS (OTP, alertes) | `TWILIO_*` (compte réel non testé — §8) |
| Resend / SendGrid | E-mails | `EMAIL_*` |
| Fournisseur satellite | Imagerie | `SATELLITE_*` |
| Moteur GeoAI | Géospatial/IA | `GEOAI_*` |
| LoRaWAN MQTT | Capteurs | `LORAWAN_*` |
| S3 | Fichiers volumineux | `S3_*` (pilote local disponible) |

---

## 8. État des configurations

| État | Éléments |
|---|---|
| ✅ **Configuré et fonctionnel** | Base PostgreSQL (Supabase) + 19 migrations appliquées · Auth Supabase (JWT, rôles) · API complète (413 routes / 409 opérations, 0 écart de contrat) · **Supervision (M5)** : services dégradés évalués en direct (cause + marche à suivre), santé technique, jobs listés, run manuel audité (`admin.job.run`) avec verrou anti double-exécution · **Audit avancé & sécurité (M6)** : recherche (acteur, dates, gravité), export CSV/JSON audité (`admin.audit.export`), vue sécurité (verrous, MFA gouvernance, clés, sessions), politique `security.*` en palier 2 · **Modération unifiée & annonces ciblées (M4+M7)** : décisions motivées déléguées aux services métier (listings/avis/vérifications), notification de l'acteur concerné, broadcast ciblé rôle et/ou pays, historique et taux de délivrance SMS · **Paramétrage global & feature flags (M3)** : sections documentées, secrets chiffrés AES-256-GCM et masqués, révisions (`SettingRevision`), reset et flags par pays en palier 2 · Audit · Idempotence · Rate limiting · Jobs · Temps réel (Socket.IO) · Stockage local des fichiers · Tests backend complets · Build web · Typecheck web+mobile · Pilote SMS **console** (`SMS_PROVIDER=console`, journalise sans envoyer) |
| 🟡 **Partiellement configuré** | Twilio : code d'envoi, webhooks et signature implémentés ; `SMS_PROVIDER=console` faute d'identifiants complets — **aucun SMS réel jamais envoyé/testé** · S3 : pilote implémenté, jamais exercé contre du stockage réel · E-mail : code Resend/SendGrid prêt, `EMAIL_PROVIDER` non renseigné · MFA : implémenté et testé en unitaire, jamais validé avec une vraie application d'authentification · Satellite/GeoAI/IoT : clients implémentés, dépendent de `SATELLITE_*`/`GEOAI_*`/`LORAWAN_*` |
| ⬜ **À configurer (au déploiement)** | Rotation des identifiants (mots de passe Postgres + clés `anon`/`service_role` + `backend/.env`) — **due**, connexion actuelle fonctionnelle · `CORS_ORIGIN` de production · `PUBLIC_WEB_URL` · Webhooks Twilio (URL publiques + `TWILIO_WEBHOOK_BASE_URL`) · DNS/HTTPS · Sauvegardes |
| ❌ **Non implémenté / exclu** | Tests de rendu navigateur (Playwright/Cypress) — aucun navigateur dans l'environnement · Tests mobiles sur simulateur (B6 : compile-verified only) · Écran « dépôt géospatial » (exclu par le cahier des charges) · Validation des plages agronomiques par un expert (formulaire non rempli — les recommandations restent indicatives) |

---

## 9. Tests et qualité

### 9.1 Derniers résultats exécutés (réels)

| Contrôle | Résultat | Date/lieu |
|---|---|---|
| `npm test` (backend, unitaires + e2e) | **1353/1353, 0 échec** | 2026-11-02 atelier + machine user (1283 M1-M3 antérieurs + 23 M3 + 29 M5/M6 + 18 M4/M7 ; concurrence bornée à 2) |
| dont unitaires M2 (`adminUsers.test.mjs`) | 23/23 | idem |
| dont e2e M2 (`adminUsers.e2e.test.mjs`) | 14/14 | idem |
| dont unitaires M3 (`adminSettings.test.mjs`) | 15/15 | 2026-11-02 atelier |
| dont e2e M3 (`adminSettings.e2e.test.mjs`) | 8/8 (AC-M3 `module_disabled`, maintenance, palier 2, secrets, flags) | 2026-11-02 atelier |
| dont unitaires M5 (`adminMonitoring.test.mjs`) | 8/8 (AC-M5, RG-M5-1 direct, RG-M5-2 verrou/audit) | 2026-11-02 atelier + machine user |
| dont unitaires M6 (`adminSecurity.test.mjs`) | 11/11 (AC-M6, RG-S1 MFA, RG-S2 insertion seule, RG-S3 aucun secret) | idem |
| dont e2e M5 (`adminMonitoring.e2e.test.mjs`) | 5/5 (écran = rapport de démarrage, run manuel réel de `notifications.purge`, palier 2, audit) | idem |
| dont e2e M6 (`adminSecurity.e2e.test.mjs`) | 5/5 (verrouillage → vue sécurité → déverrouillage → audit, RG-S1, export, politique) | idem |
| `npm run check:mounts` | 413 routes / 409 op. / 0 collision / 0 écart | 2026-11-02 atelier + machine user (post-I6)
| `npm run docs:openapi` | 333 chemins / 409 opérations / 45 tags | 2026-11-02 atelier + machine user |
| `npm run check:trace` | 53 familles · 196/196 · aucun écart | 2026-11-01 |
| `npm run check:perms` | 136/140 · manquantes 0 · 4 inutilisées (normales) | 2026-11-01 |
| `npm run contre-epreuves` | **5/5** (fautes réintroduites détectées) | 2026-11-01 |
| Web `tsc --noEmit` + `npm run build` | ✓ (build 6,95 s, 753 modules) | 2026-11-02 |
| Mobile `tsc --noEmit` | 0 erreur | 2026-11-02 |

### 9.2 Organisation des tests (`backend/tests/`, 90 fichiers)

- **Unitaires purs** : logique métier (auth, MFA, market, orders, alerts,
  recommendation, sms, quota, file parsers…).
- **E2E (`tests/e2e/`)** : harness HTTP réel (base **PostgreSQL embarquée**,
  faux GoTrue, fournisseur SMS simulé) — 14 tests M2 (401/403, mfa_required,
  RG-G1/G2/G3/G5, historique) + 8 tests M3 (AC-M3 `module_disabled`, maintenance
  RG-M3-4, plages RG-M3-1, secrets RG-M3-3, palier 2, flags, contre-épreuves) + 5 tests M5 (écran = rapport de démarrage avec `degradedServices`, run manuel réel, RG-M5-1 état en direct, RG-M5-2) + 5 tests M6 (AC-M6 cycle complet de verrouillage, RG-S1 `mfa_required`, recherche/export, politique `security.*`).
- **Intégration** : familles, forecast, géospatial, intelligence, interpolation,
  jobs, listings, messaging, policies, req…
- **Contre-épreuves** : 5 motifs de panne réintroduits volontairement, doivent
  tous être détectés (`npm run contre-epreuves`).
- **Qualité front** : `tsc` + build Vite (web), `tsc` (mobile). Deux fichiers
  vitest web existent (`tests/hero-carousel.test.tsx`, `tests/home.test.tsx`)
  mais exigent un navigateur (framer-motion/jsdom) — **non exécutés ici**.
- **Commandes** : `npm test`, `npm run test:e2e`, `npm run test:dbless`,
  `npm run verify` (enchaînement complet), `npm run check:*`. **Concurrence bornée à 2** (`--test-concurrency=2` placé avant la liste des fichiers, couture `fix-test-conc.mjs`) : en parallèle totale sous Windows, les démarrages (base PostgreSQL embarquée, moteur Python) se marchent dessus et font échouer des tests qui passent isolément — limite conservée dans `npm test`.

### 9.3 Limites et erreurs connues

- **B6 (règle projet)** : les écrans web et mobile sont **compile-verified
  only** — aucun rendu navigateur/simulateur n'est prouvé.
- Aucun SMS réel livré (voir §8) ; MFA non validé avec une vraie app.
- `npx prisma generate` : EPERM signalé sur la machine de développement
  (environnement Windows, non bloquant au fonctionnement constaté).
- Avertissement de build Vite : chunk principal > 500 kB (conseil de
  code-splitting, sans impact fonctionnel).
- 243 emojis encore utilisés comme icônes côté web (passe de remplacement
  par icônes vectorielles à venir).

---

## 10. Fonctionnalités réalisées et restantes

### 10.1 Réalisées et vérifiées

| Domaine | Détail |
|---|---|
| Socle plateforme | Auth, rôles, organisations, audit, idempotence, quotas, jobs, temps réel |
| Marché | Offres, demandes, matching, commandes (machine à états), inventaire, avis, litiges |
| Agricole | Fermes, parcelles, productions, sols, campagnes, plans de rotation |
| Conseil | Recommandations, plages agronomiques (mécanisme de validation B3), diagnostics |
| Données | Satellite, drones, capteurs IoT, anomalies, alertes (fenêtre de silence SMS), météo, prix |
| Investissement | Projets, data room, due diligence, financement, rapports, tenders |
| Export | Commandes d'export, documents, traçabilité lots + QR public |
| Coopératives | Membres, invitations, import, offres groupées |
| **Super Admin I1** | Fondations (permissions, audit, migrations gouvernance) |
| **Super Admin I2/M1** | Dashboard centralisé (indicateurs, pays, période, export) |
| **Super Admin I3/M2** | Utilisateurs & rôles : 10 routes API, web (Users/UserDetail/Roles) + mobile (users, [id], roles), tests 23+14, contrôles 5/5 |
| **Super Admin I4/M3** | Paramétrage global & feature flags : 6 routes API (`GET/PUT /admin/settings`, `GET /admin/settings/history`, `POST /admin/settings/:key/reset`, `GET/PUT /admin/flags`), catalogue 26 clés/5 sections, secrets AES-256-GCM masqués, révisions, effets réels (`module_disabled`/`maintenance_mode`), tests 15+8 (total **1306/1306**), contrat OpenAPI complet — livré via `fix-m3.mjs`, validé sur machine le 2026-11-02 (1306/1306, check:mounts 400/396/0/0/0)
| **Super Admin I5/M5+M6** | Supervision + Audit/Sécurité : 9 routes API (`GET /admin/jobs`, `POST /admin/jobs/:name/{run,pause,resume}`, `GET /admin/monitoring/{services,health}`, `GET /admin/audit/export`, `GET/PUT /admin/security/policy`), jobs enrichis (pause/reprise palier 2, verrou anti double-exécution, audit `admin.job.run`), gravité dérivée (`SEVERITY_RULES`), vue sécurité, politique palier 2, tests **8+11 unitaires, 5+5 e2e** (total **1335/1335**) — livré via coutures (`fix-i5.mjs`, `fix-i5-tests.mjs`), validé sur machine le 2026-11-02
| **Super Admin I5 — écrans M5/M6** | Web : `Monitoring.tsx`, `Jobs.tsx`, `AuditLog.tsx`, `Security.tsx` (routes `/admin/monitoring`, `/admin/jobs`, `/admin/audit`, `/admin/security`, menu administrateur à jour) + mobile : `monitoring.tsx`, `jobs.tsx`, `audit.tsx`, `security.tsx` — miroirs des écrans web, compile-verified (B6) |
| **Super Admin I6 — M4+M7** | Backend : `admin.operations.*` (GET `/admin/operations/:entity` file listings/avis/vérifications, GET `/:entity/:id`, POST `/:entity/:id/moderate` — approuver/refuser/suspendre **motif obligatoire**, décisions déléguées aux services métier, notification de l'acteur concerné) + `admin.notifications.*` (POST `/admin/notifications/broadcast` ciblé rôle et/ou pays, GET `/history` — annonces, lots SMS, taux de délivrance) ; écrans `Operations.tsx`/`Notifications.tsx` web + `operations.tsx`/`notifications.tsx` mobile ; tests **13 unitaires + 5 e2e** (total **1353/1353**) — livré le 2026-11-02 |
| Pages publiques | Accueil (Hero Carousel), services, détail service, à-propos — web **et** mobile (miroir), documenté `docs/PAGES-PROJET.md` |
| Documentation | Ce document, `LISEZ-MOI.md`, `RAPPORT-AUDIT-FINAL.md`, `SPEC-SUPER-ADMIN.md` |

### 10.2 En cours

| Sujet | Détail |
|---|---|
| Aucune livraison en cours | I6 complet (backend M4/M7 + écrans Operations/Notifications web et mobile). Reste : UI Settings web/mobile (ressort de M4), puis I7 (audit final) |

### 10.3 Prévu (roadmap validée, `SPEC-SUPER-ADMIN.md` §12)

I7 — Audit final + rapport de conformité.

### 10.4 Bloqué / dépendant de l'extérieur

| Sujet | Raison |
|---|---|
| SMS réels | Identifiants Twilio incomplets (voir §8) |
| Validation des plages agronomiques | Décision d'un expert agronome (statut `VALIDATED`) |
| S3 réel, satellite, GeoAI, LoRaWAN | Identifiants de services externes |
| Rotation des identifiants | Décision utilisateur (à faire après stabilisation de la connexion — voir §8) |

---

## 11. Installation et démarrage

### 11.1 Prérequis

- Node.js ≥ 20 (développé avec **Node 24**), npm.
- PostgreSQL : projet **Supabase** (ou instance locale) — `DATABASE_URL` +
  `DIRECT_URL`.
- Windows : utiliser **Git Bash (UCRT64)** pour les commandes du projet.

### 11.2 Installation

```bash
cd agrikonnect-africa-final/backend && npm install
cd ../apps/web && npm install
cd ../apps/Mobile && npm install
```

### 11.3 Configuration

Copier `backend/.env.example` vers `backend/.env` puis renseigner au minimum :
`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SMS_PROVIDER=console` (sans Twilio complet).
Ne **jamais** committer `.env`.

### 11.4 Base de données

```bash
cd backend
npm run prisma:generate     # client Prisma
npm run prisma:migrate      # applique les migrations (dev)
npm run prisma:deploy       # migrations en production
npm run seed                # données de démarrage (si fournies)
```

### 11.5 Lancement

```bash
# terminal 1 — API (port 4000 par défaut)
cd backend && npm run dev

# terminal 2 — web (Vite)
cd apps/web && npm run dev

# terminal 3 — mobile (Expo)
cd apps/Mobile && npm start
```

### 11.6 Commandes utiles (backend)

| Commande | Rôle |
|---|---|
| `npm test` | Tous les tests (unitaires + e2e) |
| `npm run test:e2e` | Tests de bout en bout uniquement |
| `npm run verify` | Enchaînement complet de vérification |
| `npm run contre-epreuves` | 5 motifs de panne réintroduits → doit tous échouer |
| `npm run check:mounts` | Routes ↔ contrat OpenAPI |
| `npm run check:trace` | Traçabilité des familles de tests |
| `npm run check:perms` | Matrice de permissions |
| `npm run check:migrations` | Dérive de schéma Prisma |
| `npm run docs:openapi` | Régénère `src/docs/openapi.json` |

Web : `npm run build` (tsc + Vite), `npm run typecheck`. Mobile :
`npm run typecheck`, `npm run bundle:android`.

### 11.7 Déploiement (notes)

1. Base : `npm run prisma:deploy` sur la base cible.
2. API : `npm start` (Node 20+), variables d'environnement de production,
   `NODE_ENV=production`, `CORS_ORIGIN` réel.
3. Web : `npm run build` → héberger `dist/` (SPA, rediriger les routes vers
   `index.html`).
4. Mobile : `npm run bundle:android` / EAS Build (Expo).
5. Webhooks : exposer les URL Twilio (`TWILIO_WEBHOOK_BASE_URL`) en HTTPS.
6. Vérifier `npm run verify` avant mise en production.

---

## 12. Historique et évolution

### 12.1 Chronologie

| Étape | Contenu |
|---|---|
| Genèse | Développement initial des trois applications (backend, web, mobile) |
| Audit final | `RAPPORT-AUDIT-FINAL.md` : audit complet, corrections (web/mobile/backend), ajout de fonctionnalités, charte visuelle AGRIKONNECT AFRICA (vert forêt/terre cuite), **1232 tests** à cette date |
| Passe « compléter le backend » | Fenêtre de silence SMS, quotas, escalade d'alertes, hardening (`LISEZ-MOI.md` §4.3) |
| Miroir public | Pages publiques web → mobile (accueil, services, à-propos, `public-site/`), `docs/PAGES-PROJET.md` |
| **Spécification Super Admin** | `docs/SPEC-SUPER-ADMIN.md` — dashboard, utilisateurs/rôles, paramétrage, supervision, audit, notifications, outils ; palier 1/palier 2 |
| **I1 — Fondations** | Permissions, audit, migrations gouvernance (`settings_revisions`, `MfaSecret`…) |
| **I2 — M1 Dashboard** | `admin.dashboard` + page web `Dashboard.tsx` |
| **I3 — M2 Users & rôles** | 10 routes API, tests **23 unitaires + 14 e2e** (total porté à **1283/1283**), pages web `Users/UserDetail/Roles`, écrans mobile `users`, `[id]`, `roles` — chaîne complète prouvée sur machine |
| Fusion `App.tsx` | Routes `/services`, `/a-propos`, `/services/:serviceId` + M2 ; `docs/PAGES-PROJET.md` |
| **Ce document** | Documentation technique de référence (v1.0) |
| **I4 — M3 Paramétrage global & feature flags** | Catalogue 26 clés/5 sections, `settings` + `setting_revisions` + `zone_feature_flags`, secrets AES-256-GCM (`v1.…`, masque `••••••••`), palier 2 (`security.*`/`integrations.*`, reset, flags), effets réels 403 `module_disabled`/`maintenance_mode`, OpenAPI étendu (sous-routeurs), tests **15+8** (total **1306/1306**) — livré et validé sur machine le 2026-11-02
| **I5 — M5 Supervision + M6 Audit/Sécurité (backend)** | 9 routes (`/admin/jobs`, `/admin/monitoring/*`, `/admin/audit/export`, `/admin/security/policy`), modules `admin.monitoring.*` + `admin.security.*` (8 fichiers), coutures jobs/admin (run audité + verrou, recherche élargie, gravité dérivée), tests **8+11 unitaires + 5+5 e2e** (total **1335/1335**) — livré le 2026-11-02 ; écrans M5/M6 web (`Monitoring`, `Jobs`, `AuditLog`, `Security`) + mobile livrés le même jour (compile-verified, B6) |
| **I6 — M7 Notifications + M4 modération** | 5 routes (`/admin/operations/:entity` file, `/admin/operations/:entity/:id`, `/admin/operations/:entity/:id/moderate`, `/admin/notifications/broadcast`, `/admin/notifications/history`), modules `admin.operations.*` + `admin.notifications.*`, décisions motivées **motif obligatoire** déléguées aux services métier (RG-M4-1) + notification de l'acteur (RG-M4-2), broadcast ciblé rôle et/ou pays, historique + taux de délivrance SMS, tests **13 unitaires + 5 e2e** (total **1353/1353**) — livré le 2026-11-02 ; écrans `Operations`, `Notifications` web + mobile (compile-verified, B6) |
| *À venir* | Écrans M5/M6 (web + mobile) · I6 (M7 Notifications + M4 modération) · I7 (audit final + conformité) |

### 12.2 Points de vigilance permanents

- Rotation des identifiants (Postgres, `anon`/`service_role`, `backend/.env`).
- Aucun SMS réel ne sera déclaré validé sans réception constatée.
- Les écrans restent « compile-verified » tant qu'aucun navigateur/simulateur
  n'a été utilisé.
- Contenu : aucun chiffre de mise en page, aucun témoignage fictif, aucun
  partenaire inventé.

### 12.3 Procédure de mise à jour de ce document

1. Toute livraison de fonctionnalité/page/route/module/config **modifie ce
   document dans le même temps** (section concernée + §12 si notable).
2. Les nombres (pages, routes, modèles, tests) sont **re-vérifiés** à chaque
   mise à jour via les commandes du §9/§11 (`check:mounts`, `find`, `npm test`).
   La section §4 se régénère automatiquement : `node generer-doc-routes.mjs`
   réécrit la pièce `docs/DOC-TECH-2.md` depuis le code réel, puis les trois
   pièces sont réassemblées (voir le commentaire d'en-tête du script).
3. Ne jamais déclarer « fonctionnel » sans preuve d'exécution ; signaler en §8
   ce qui reste partiel ou non vérifié.
4. Incrémenter la **version du document** en en-tête (date + numéro).

---

*Fin du document — AGRIKONNECT AFRICA, documentation technique v1.1 (2026-11-02).*
