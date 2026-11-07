AGRIKONNECT AFRICA — Documentation technique de référence
Statut : référence officielle et permanente du projet.
Version du document : 1.0 — 2026-11-02.
Règle de vie : ce document est évolutif. À chaque ajout, modification ou
suppression de fonctionnalité, service, page, route, module ou configuration,
la section concernée doit être mise à jour dans le même temps que le code.

Sources : analyse du code source réel (backend, web, mobile), exécution des
contrôles du projet (check:mounts, check:perms, check:trace, npm test),
et les documents existants du dépôt (LISEZ-MOI.md, RAPPORT-AUDIT-FINAL.md,
COHERENCE-3-PARTIES.md, docs/SPEC-SUPER-ADMIN.md,
backend/docs/PERIMETRE-BACKEND.md, docs/PAGES-PROJET.md).
Tout ce qui n'a pas pu être vérifié est signalé explicitement.

Table des matières
Présentation générale
Architecture technique
Inventaire des pages
Inventaire des routes
Composants et modules
Base de données
Configurations techniques
État des configurations
Tests et qualité
Fonctionnalités réalisées et restantes
Installation et démarrage
Historique et évolution
1. Présentation générale
AGRIKONNECT AFRICA est une plateforme numérique agricole destinée à
l'Afrique subsaharienne (premier déploiement : République Démocratique du
Congo). Elle relie les producteurs, coopératives, acheteurs, transporteurs,
investisseurs et organismes de vérification autour de données agricoles fiables.

1.1 Objectifs
Marché agricole : offres et demandes de produits, matching, commandes,
avis, litiges, transporteurs.
Traçabilité : lots, événements de lot, QR code public, certifications.
Gestion agricole : exploitations, parcelles, productions, sols, inventaire,
campagnes, plans de rotation.
Conseil agronomique : recommandations par culture, plages agronomiques
validées par des experts, diagnostics de sol, prévisions de rendement.
Données satellitales et IoT : observations satellite, drones, capteurs,
anomalies, alertes.
Investissement : projets, data room, due diligence, demandes de financement,
rapports d'impact.
Coopératives : membres, invitations, import, offres groupées.
Exports : commandes d'export, documents, incoterms.
Administration centralisée : espace Super Admin (dashboard, utilisateurs et
rôles, paramétrage global, supervision, audit, sécurité, notifications) —
spécification docs/SPEC-SUPER-ADMIN.md, palier 1/palier 2.
1.2 Rôles utilisateurs
SUPER_ADMIN, ADMIN, MODERATOR, SUPPORT_AGENT, FARMER,
COOPERATIVE_ADMIN, COOPERATIVE_MEMBER, AGRICULTURAL_COMPANY, BUYER,
SUPPLIER, TRANSPORTER, AGRONOMIST, INVESTOR, LAB_PARTNER,
API_CLIENT, PUBLIC_USER, VERIFIER, COUNTRY_ADMIN, DATA_STEWARD
(miroir de l'enum Prisma Role, source : backend/src/modules/admin/admin.schema.js).

1.3 Applications livrées
Application	Chemin	Rôle
API backend	backend/	Express + Prisma + PostgreSQL — toute la logique métier
Web desktop	apps/web/	React + Vite — public, agriculteur, organisation, investisseur, admin
Mobile	apps/Mobile/	Expo (React Native) + Expo Router — miroir des parcours, mobile first
2. Architecture technique
2.1 Organisation du dépôt
text

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
2.2 Backend — principes
ESM partout (import), Node ≥ 20 recommandé (Node 24 utilisé en
développement), Express, Zod pour la validation.
Un module = un domaine : xxx.routes.js → xxx.controller.js →
xxx.service.js (+ xxx.schema.js quand il y a des schémas Zod).
Montage unique : src/routes/index.js monte tous les routeurs sous le
préfixe API_PREFIX (défaut /api/v1).
Sécurité en couches : authenticate (JWT Supabase) → resolveTenant
(rôles effectifs par organisation) → authorize('permission') →
validate(schema) → gestionnaire.
Audit immuable : toute action sensible écrit dans audit_logs
(shared/audit.js).
Idempotence : en-tête Idempotency-Key supporté (middleware/idempotency.js,
table idempotency_keys).
Temps réel : Socket.IO (server.js) pour notifications et messagerie.
Tâches planifiées : src/jobs/ (expiration d'offres, purges, relances) —
pilotables via /admin/jobs.
2.3 Web — principes
React + Vite, React Router (toutes les routes déclarées dans
src/App.tsx, composants en lazy() + Suspense).
React Query (@tanstack/react-query) pour le cache serveur ; clés
['admin', …] invalidées après mutation.
Zustand pour l'état d'authentification (store/auth.ts).
Appels API centralisés dans src/services/ (http.ts = client axios,
endpoints.ts = couche adminApi/…, query.ts = clés de requête,
session.ts, realtime.ts, types.ts).
Design system maison (src/components/ui) — aucun Tailwind ; styles
en CSS/inline selon la charte AGRIKONNECT AFRICA (vert forêt, terre cuite).
2.4 Mobile — principes
Expo Router : chaque fichier de src/app/ est une route
(app/admin/users/[id].tsx → /admin/users/:id).
Reanimated pour les animations ; expo-secure-store pour les secrets.
React Query + Zustand comme sur le web ; client API dans src/services/api.
Thème unique : theme/colors|space|typography, composants src/components/ui.
Miroir des textes du web mot pour mot (contrainte projet).
2.5 Flux d'une requête authentifiée
text

Client (web/mobile) → helmet/cors/rate-limit → authenticate (JWT Supabase)
→ resolveTenant (rôles effectifs) → authorize('permission') → validate(Zod)
→ controller → service → Prisma → PostgreSQL (Supabase)
→ audit_logs (si action sensible) → réponse { data, meta? }
3. Inventaire des pages
3.1 Web — 167 fichiers de pages (apps/web/src/pages/)
164 fichiers présents dans le dépôt de référence + 3 pages maintenues sur la
machine de développement (public/About.tsx, public/Services.tsx,
public/ServiceDetail.tsx). market/common.tsx est un module partagé de
sous-composants, pas une page routée. Les routes exactes : §4.1.

Zone	Dossier	Pages	Rôle
Public	public/	17	Site public : accueil (Hero Carousel), services + détail, à-propos, agriculteurs, fermes, lots (QR), carte, coopératives, projets, appels d'offres, catalogue de données, agriculture par pays, sélecteur pays/langue, mentions légales
Auth	auth/	7	Connexion, inscription, mot de passe oublié/réinitialisation, vérification e-mail, MFA, vérification téléphone
Application	app/	23	Espace connecté : tableau de bord, exploitations, parcelles, productions, sol, inventaire, commandes, messages/conversations, notifications, SMS consentement, retours de saison, profil, vérification, agent, coopérative (+offres/commandes), factures, transport
Agriculteur	farmer/	39	Parcours producteur : accueil, profil (public + privé), réglages, alertes, exploitations (CRUD), parcelles (CRUD + sol, recommandations, rotation, plan, rapport de précision, zones, capteurs, satellite), productions, sol, lots, exports (+documents), projets (+data room, rapports, journal d'accès), certifications, capteurs, enquêtes, sync, vérification, conflits, galerie
Organisation	organization/	9	Vue coopérative/société : aperçu, profil, membres, invitations, import, exploitations, synthèse production, vérification
Marché	market/	10	Marché public, détails d'offre, nouvelle offre/demande, demandes, matching, avis, transporteurs, app marché
Investissement	investment/	5	Accueil investisseur, profil, projets suivis, détail projet, demandes
International	international/	3	Appels d'offres, commandes, documents internationaux
Admin	admin/	36	Espace administrateur (voir §3.3)
IA	ai/	4	Assistant, analyses + détail, documents
Dev	developers/	4	Portail développeur : accueil, clés API, usage, documentation
Insights	insights/	2	Indicateurs par région/pays
Revue	reviewer/	2	Missions de vérification + check-list
Agent	agent/	2	Consentement et inscription agent de terrain
Données	(racine)	3	Prices, CropPrices, Weather
3.2 Mobile — 213 écrans (apps/Mobile/src/app/)
Chaque fichier .tsx = une route Expo Router. Les écrans sont vérifiés par
compilation (B6), pas lancés sur simulateur.

Zone	Dossiers	Écrans	Rôle
Admin	admin/ (+countries,users)	36	Hub admin, dashboard, comptes + fiche + rôles (M2), pays, supervision…
Site public	public-site/ (+11 sous-dossiers)	33	Miroir complet du site web public (accueil, a-propos, services, producteurs, projets, lots, fermes, coopératives, agriculture, données, carte, marchés, tenders, transporteurs, ventes, actualités, annonces, FAQ, contact, conditions, confidentialité, mentions, pays/langue, création de profil, sols)
Agriculteur	farmer/ (+7 sous-dossiers)	41	Parcours producteur mobile (fermes, parcelles dont vues [id], lots, commandes, projets, exports, sync)
Racine publique	(racine)	16	index, accueil, a-propos, services.tsx, contact, faq, farmers, marches, producteurs, projets, profil, explore, tenders, weather, prices, +not-found
Services	services/	1	Détail service (services/[id].tsx, lit SERVICE_CATALOG)
Organisation	organization/	14	Vue organisation mobile
Marché	marketplace/,ventes/,requests/	12	Offres, ventes, demandes (+détail)
Auth	auth/	8	Connexion/inscription/vérifications
Messagerie	messages/,notifications/,annonces/	8	Conversations, notifications, annonces
Investissement	investment/,projets/	9	Investisseurs, projets (+proposer)
Autres	agent,ai,developers,insights,international,prices,reviewer,cooperatives,actualites	26	Miroirs des espaces web correspondants
Bibliothèques partagées mobile : src/lib/ (config.ts, faq.ts,
format.ts, phone.ts, platform.ts, secure-storage.ts,
service-catalog.ts, ulid.ts), src/components/ (40 composants dont
public-site/), src/services/api + query.ts + realtime.ts,
src/store/auth.ts, src/hooks/ (useMouvementReducit, usePublicData).

3.3 Espace admin (web) — détail
Page	Fonction
Admin.tsx	Hub de navigation admin
Dashboard.tsx	Tableau de bord M1 (indicateurs, pays, période)
Users.tsx, UserDetail.tsx, Roles.tsx	M2 : comptes, fiche complète, rôles & permissions
Settings.tsx	Paramètres (M3 — extension en cours)
AuditLog.tsx	Journal d'audit (M6)
Monitoring.tsx	Supervision (M5)
Farmers/Farms/Plots/Productions/Lots/Producers/Crops/Cooperatives/Projects/Investors/Orders/M