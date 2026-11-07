# AGRIKONNECT AFRICA — Documentation technique de référence

> **Statut** : référence officielle et permanente du projet.
> **Version du document** : 1.1 — **2026-11-02** (mise à jour I5 — M5 Supervision + M6 Audit/Sécurité).
> **Règle de vie** : ce document est **évolutif**. À chaque ajout, modification ou
> suppression de fonctionnalité, service, page, route, module ou configuration,
> la section concernée doit être mise à jour dans le même temps que le code.
>
> **Sources** : analyse du code source réel (backend, web, mobile), exécution des
> contrôles du projet (`check:mounts`, `check:perms`, `check:trace`, `npm test`),
> et les documents existants du dépôt (`LISEZ-MOI.md`, `RAPPORT-AUDIT-FINAL.md`,
> `COHERENCE-3-PARTIES.md`, `docs/SPEC-SUPER-ADMIN.md`,
> `backend/docs/PERIMETRE-BACKEND.md`, `docs/PAGES-PROJET.md`).
> Tout ce qui n'a pas pu être vérifié est signalé **explicitement**.

---

## Table des matières

1. [Présentation générale](#1-présentation-générale)
2. [Architecture technique](#2-architecture-technique)
3. [Inventaire des pages](#3-inventaire-des-pages)
4. [Inventaire des routes](#4-inventaire-des-routes)
5. [Composants et modules](#5-composants-et-modules)
6. [Base de données](#6-base-de-données)
7. [Configurations techniques](#7-configurations-techniques)
8. [État des configurations](#8-état-des-configurations)
9. [Tests et qualité](#9-tests-et-qualité)
10. [Fonctionnalités réalisées et restantes](#10-fonctionnalités-réalisées-et-restantes)
11. [Installation et démarrage](#11-installation-et-démarrage)
12. [Historique et évolution](#12-historique-et-évolution)

---

## 1. Présentation générale

**AGRIKONNECT AFRICA** est une plateforme numérique agricole destinée à
l'Afrique subsaharienne (premier déploiement : République Démocratique du
Congo). Elle relie les producteurs, coopératives, acheteurs, transporteurs,
investisseurs et organismes de vérification autour de données agricoles fiables.

### 1.1 Objectifs

- **Marché agricole** : offres et demandes de produits, matching, commandes,
  avis, litiges, transporteurs.
- **Traçabilité** : lots, événements de lot, QR code public, certifications.
- **Gestion agricole** : exploitations, parcelles, productions, sols, inventaire,
  campagnes, plans de rotation.
- **Conseil agronomique** : recommandations par culture, plages agronomiques
  validées par des experts, diagnostics de sol, prévisions de rendement.
- **Données satellitales et IoT** : observations satellite, drones, capteurs,
  anomalies, alertes.
- **Investissement** : projets, data room, due diligence, demandes de financement,
  rapports d'impact.
- **Coopératives** : membres, invitations, import, offres groupées.
- **Exports** : commandes d'export, documents, incoterms.
- **Administration centralisée** : espace Super Admin (dashboard, utilisateurs et
  rôles, paramétrage global, supervision, audit, sécurité, notifications) —
  spécification `docs/SPEC-SUPER-ADMIN.md`, palier 1/palier 2.

### 1.2 Rôles utilisateurs

`SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `SUPPORT_AGENT`, `FARMER`,
`COOPERATIVE_ADMIN`, `COOPERATIVE_MEMBER`, `AGRICULTURAL_COMPANY`, `BUYER`,
`SUPPLIER`, `TRANSPORTER`, `AGRONOMIST`, `INVESTOR`, `LAB_PARTNER`,
`API_CLIENT`, `PUBLIC_USER`, `VERIFIER`, `COUNTRY_ADMIN`, `DATA_STEWARD`
(miroir de l'enum Prisma `Role`, source : `backend/src/modules/admin/admin.schema.js`).

### 1.3 Applications livrées

| Application | Chemin | Rôle |
|---|---|---|
| API backend | `backend/` | Express + Prisma + PostgreSQL — toute la logique métier |
| Web desktop | `apps/web/` | React + Vite — public, agriculteur, organisation, investisseur, admin |
| Mobile | `apps/Mobile/` | Expo (React Native) + Expo Router — miroir des parcours, mobile first |

---

## 2. Architecture technique

### 2.1 Organisation du dépôt

```
agrikonnect-africa-final/
├── backend/                  # API Node.js (ESM, Express, Prisma)
│   ├── prisma/               # schema.prisma (101 modèles) + 19 migrations
│   ├── src/
│   │   ├── app.js            # création de l'app Express (helmet, cors, rate limit)
│   │   ├── server.js         # point d'entrée HTTP + Socket.IO
│   │   ├── routes/index.js   # montage central de TOUS les routeurs (199 lignes)
│   │   ├── modules/          # 53 modules métier (voir §5)
│   │   ├── middleware/       # 8 middlewares (auth, tenant, permissions, settingsEffects…)
│   │   ├── shared/           # bibliothèque commune (~30 modules)
│   │   ├── config/           # env, prisma, supabase, satellite, hardware, messaging
│   │   ├── jobs/             # planificateur de tâches (cron interne)
│   │   └── docs/             # openapi.json + docs générées
│   ├── tests/                # 86 fichiers de tests (unitaires + e2e)
│   └── scripts/              # contrôles (check:*, verify, contre-epreuves…)
├── apps/
│   ├── web/                  # React 19 + Vite + React Router + React Query
│   └── Mobile/               # Expo SDK + expo-router (routes = fichiers)
├── scripts/                  # outils projet (audit, vérification d'archive)
├── docs/                     # SPEC-SUPER-ADMIN, PAGES-PROJET, ce document
└── LISEZ-MOI.md, RAPPORT-AUDIT-FINAL.md, COHERENCE-3-PARTIES.md
```

### 2.2 Backend — principes

- **ESM partout** (`import`), Node ≥ 20 recommandé (Node 24 utilisé en
  développement), Express, Zod pour la validation.
- **Un module = un domaine** : `xxx.routes.js` → `xxx.controller.js` →
  `xxx.service.js` (+ `xxx.schema.js` quand il y a des schémas Zod).
- **Montage unique** : `src/routes/index.js` monte tous les routeurs sous le
  préfixe `API_PREFIX` (défaut `/api/v1`).
- **Sécurité en couches** : `authenticate` (JWT Supabase) → `resolveTenant`
  (rôles effectifs par organisation) → `authorize('permission')` →
  `validate(schema)` → gestionnaire.
- **Audit immuable** : toute action sensible écrit dans `audit_logs`
  (`shared/audit.js`).
- **Idempotence** : en-tête `Idempotency-Key` supporté (`middleware/idempotency.js`,
  table `idempotency_keys`).
- **Temps réel** : Socket.IO (`server.js`) pour notifications et messagerie.
- **Tâches planifiées** : `src/jobs/` (expiration d'offres, purges, relances) —
  pilotables via `/admin/jobs`.

### 2.3 Web — principes

- React + Vite, **React Router** (toutes les routes déclarées dans
  `src/App.tsx`, composants en `lazy()` + `Suspense`).
- **React Query** (`@tanstack/react-query`) pour le cache serveur ; clés
  `['admin', …]` invalidées après mutation.
- **Zustand** pour l'état d'authentification (`store/auth.ts`).
- Appels API centralisés dans `src/services/` (`http.ts` = client axios,
  `endpoints.ts` = couche `adminApi`/…, `query.ts` = clés de requête,
  `session.ts`, `realtime.ts`, `types.ts`).
- Design system maison (`src/components/ui`) — **aucun Tailwind** ; styles
  en CSS/inline selon la charte AGRIKONNECT AFRICA (vert forêt, terre cuite).

### 2.4 Mobile — principes

- **Expo Router** : chaque fichier de `src/app/` est une route
  (`app/admin/users/[id].tsx` → `/admin/users/:id`).
- **Reanimated** pour les animations ; `expo-secure-store` pour les secrets.
- React Query + Zustand comme sur le web ; client API dans `src/services/api`.
- Thème unique : `theme/colors|space|typography`, composants `src/components/ui`.
- Miroir des textes du web **mot pour mot** (contrainte projet).

### 2.5 Flux d'une requête authentifiée

```
Client (web/mobile) → helmet/cors/rate-limit → authenticate (JWT Supabase)
→ resolveTenant (rôles effectifs) → authorize('permission') → validate(Zod)
→ controller → service → Prisma → PostgreSQL (Supabase)
→ audit_logs (si action sensible) → réponse { data, meta? }
```

---

## 3. Inventaire des pages

### 3.1 Web — 167 fichiers de pages (`apps/web/src/pages/`)

> 164 fichiers présents dans le dépôt de référence + 3 pages maintenues sur la
> machine de développement (`public/About.tsx`, `public/Services.tsx`,
> `public/ServiceDetail.tsx`). `market/common.tsx` est un module partagé de
> sous-composants, pas une page routée. Les routes exactes : §4.1.

| Zone | Dossier | Pages | Rôle |
|---|---|---|---|
| Public | `public/` | 17 | Site public : accueil (Hero Carousel), services + détail, à-propos, agriculteurs, fermes, lots (QR), carte, coopératives, projets, appels d'offres, catalogue de données, agriculture par pays, sélecteur pays/langue, mentions légales |
| Auth | `auth/` | 7 | Connexion, inscription, mot de passe oublié/réinitialisation, vérification e-mail, MFA, vérification téléphone |
| Application | `app/` | 23 | Espace connecté : tableau de bord, exploitations, parcelles, productions, sol, inventaire, commandes, messages/conversations, notifications, SMS consentement, retours de saison, profil, vérification, agent, coopérative (+offres/commandes), factures, transport |
| Agriculteur | `farmer/` | 39 | Parcours producteur : accueil, profil (public + privé), réglages, alertes, exploitations (CRUD), parcelles (CRUD + sol, recommandations, rotation, plan, rapport de précision, zones, capteurs, satellite), productions, sol, lots, exports (+documents), projets (+data room, rapports, journal d'accès), certifications, capteurs, enquêtes, sync, vérification, conflits, galerie |
| Organisation | `organization/` | 9 | Vue coopérative/société : aperçu, profil, membres, invitations, import, exploitations, synthèse production, vérification |
| Marché | `market/` | 10 | Marché public, détails d'offre, nouvelle offre/demande, demandes, matching, avis, transporteurs, app marché |
| Investissement | `investment/` | 5 | Accueil investisseur, profil, projets suivis, détail projet, demandes |
| International | `international/` | 3 | Appels d'offres, commandes, documents internationaux |
| Admin | `admin/` | 36 | Espace administrateur (voir §3.3) |
| IA | `ai/` | 4 | Assistant, analyses + détail, documents |
| Dev | `developers/` | 4 | Portail développeur : accueil, clés API, usage, documentation |
| Insights | `insights/` | 2 | Indicateurs par région/pays |
| Revue | `reviewer/` | 2 | Missions de vérification + check-list |
| Agent | `agent/` | 2 | Consentement et inscription agent de terrain |
| Données | *(racine)* | 3 | `Prices`, `CropPrices`, `Weather` |

### 3.2 Mobile — 213 écrans (`apps/Mobile/src/app/`)

> Chaque fichier `.tsx` = une route Expo Router. Les écrans sont vérifiés par
> compilation (B6), pas lancés sur simulateur.

| Zone | Dossiers | Écrans | Rôle |
|---|---|---|---|
| Admin | `admin/` (+`countries`,`users`) | 36 | Hub admin, dashboard, comptes + fiche + rôles (M2), pays, supervision… |
| Site public | `public-site/` (+11 sous-dossiers) | 33 | Miroir complet du site web public (accueil, a-propos, services, producteurs, projets, lots, fermes, coopératives, agriculture, données, carte, marchés, tenders, transporteurs, ventes, actualités, annonces, FAQ, contact, conditions, confidentialité, mentions, pays/langue, création de profil, sols) |
| Agriculteur | `farmer/` (+7 sous-dossiers) | 41 | Parcours producteur mobile (fermes, parcelles dont vues [id], lots, commandes, projets, exports, sync) |
| Racine publique | *(racine)* | 16 | `index`, `accueil`, `a-propos`, `services.tsx`, `contact`, `faq`, `farmers`, `marches`, `producteurs`, `projets`, `profil`, `explore`, `tenders`, `weather`, `prices`, `+not-found` |
| Services | `services/` | 1 | Détail service (`services/[id].tsx`, lit `SERVICE_CATALOG`) |
| Organisation | `organization/` | 14 | Vue organisation mobile |
| Marché | `marketplace/`,`ventes/`,`requests/` | 12 | Offres, ventes, demandes (+détail) |
| Auth | `auth/` | 8 | Connexion/inscription/vérifications |
| Messagerie | `messages/`,`notifications/`,`annonces/` | 8 | Conversations, notifications, annonces |
| Investissement | `investment/`,`projets/` | 9 | Investisseurs, projets (+proposer) |
| Autres | `agent`,`ai`,`developers`,`insights`,`international`,`prices`,`reviewer`,`cooperatives`,`actualites` | 26 | Miroirs des espaces web correspondants |

**Bibliothèques partagées mobile** : `src/lib/` (`config.ts`, `faq.ts`,
`format.ts`, `phone.ts`, `platform.ts`, `secure-storage.ts`,
`service-catalog.ts`, `ulid.ts`), `src/components/` (40 composants dont
`public-site/`), `src/services/api` + `query.ts` + `realtime.ts`,
`src/store/auth.ts`, `src/hooks/` (`useMouvementReducit`, `usePublicData`).

### 3.3 Espace admin (web) — détail

| Page | Fonction |
|---|---|
| `Admin.tsx` | Hub de navigation admin |
| `Dashboard.tsx` | Tableau de bord M1 (indicateurs, pays, période) |
| `Users.tsx`, `UserDetail.tsx`, `Roles.tsx` | **M2** : comptes, fiche complète, rôles & permissions |
| `Settings.tsx` | Paramètres (M3 — extension en cours) |
| `AuditLog.tsx` | Journal d'audit (M6) — recherche avancée, détail avant/après, export |
| `Monitoring.tsx` | Supervision (M5) — services externes, santé technique, alertes |
| `Jobs.tsx` | Tâches planifiées (M5) — exécution manuelle, pause/reprise |
| `Security.tsx` | Sécurité (M6) — verrous, MFA gouvernance, clés API, sessions, politique |
| `Operations.tsx` | Opérations (M4) — modération unifiée listings/avis/vérifications |
| `Notifications.tsx` | Notifications (M7) — annonces ciblées, historique, délivrance SMS |
| `Monitoring.tsx` | Supervision (M5) |
| `Farmers/Farms/Plots/Productions/Lots/Producers/Crops/Cooperatives/Projects/Investors/Orders/Marketplace/Prices/Countries/CountryDetail/Devices/Messages/Moderation/Verifications/Reports/Partners/Compliance/AgronomicRanges/Rules/ApiClients/AiUsage/DataProducts/Sync` | Pages de gestion métier existantes (M4/M7/M8) |

---
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
