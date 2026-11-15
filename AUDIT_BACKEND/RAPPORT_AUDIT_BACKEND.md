# Rapport d'audit technique — Backend AGRIKONNECT AFRICA

| Élément | Valeur |
|---|---|
| Projet audité | **AGRIKONNECT AFRICA** — API V1→V5 (FARM · MARKET · INTELLIGENCE · INVEST · GLOBAL) |
| Identification | `backend/package.json` (`"description": "AGRIKONNECT AFRICA — API V1→V5 …"`), `src/app.js` (`name: 'AGRIKONNECT AFRICA API'`), `backend/README.md` |
| Périmètre | `backend/` : `src/` (Node 20 / Express / ESM), `prisma/` (schéma + 21 migrations + seed), `geoai/` (moteur Python) |
| Révision | branche `main`, commit `7b8fda2` + modifications non committées de la copie de travail (état au 14/11/2026) |
| Volume | ≈ 74 700 lignes (src + prisma + geoai) — 415 déclarations de routes, 102 modèles Prisma, 68 enums, 141 permissions |
| Méthode | Lecture statique du code, extraction outillée (routes, permissions), `prisma validate`, tests unitaires purs |
| Contraintes respectées | Aucun fichier existant modifié, aucune base de données interrogée, aucune dépendance installée |

> Les secrets découverts sont **masqués** dans tous les livrables (`<REDACTED>`). Aucune valeur n'est reproduite.

---

## 1. Synthèse exécutive

Le backend AGRIKONNECT AFRICA est un **monolithe modulaire** ambitieux et globalement bien structuré : découpage `routes → controller → service → schema`, validation Zod systématique, isolation par tenant (`organizationId`) appliquée dans la grande majorité des services, journal d'audit, idempotence, durcissement réel du dépôt de fichiers géospatiaux. Le niveau de documentation interne est élevé.

En revanche, l'audit révèle **4 anomalies critiques** et **8 anomalies élevées** qui interdisent une mise en production en l'état :

1. **Secrets réels versionnés** dans `backend/.env.example` (dont des identifiants Cloudinary déjà poussés sur GitHub, et en copie de travail le mot de passe de la base Supabase, la clé `service_role` et une clé Resend).
2. **Probable absence de RLS** sur les tables Supabase : tout jeton utilisateur pourrait lire/écrire la base entière via l'API REST de Supabase (à confirmer, cf. §4.2).
3. **MFA contournable** : elle n'est contrôlée que par `POST /auth/login`, alors que le middleware accepte tout jeton Supabase, y compris obtenu directement auprès de Supabase Auth.
4. **Synchronisation hors-ligne (`/sync/push`)** : affectation massive non filtrée et collection `lot_events` sans isolation tenant → altération inter-organisations de la traçabilité.

À cela s'ajoutent une **auto-attribution de rôles sensibles à l'inscription** (`SUPPORT_AGENT` peut écrire les prix de marché et taux de change ; `AGRONOMIST` peut valider les référentiels qui pilotent toutes les recommandations), une **union des rôles inter-organisations**, un **changement de mot de passe sans mot de passe actuel**, et une **fuite de géolocalisation** quand un producteur rend sa position privée.

### Tableau de bord

| Sévérité | Nombre | Identifiants |
|---|:-:|---|
| 🔴 Critique | 4 | C-01 → C-04 |
| 🟠 Élevée | 8 | H-01 → H-08 |
| 🟡 Moyenne | 14 | M-01 → M-14 |
| 🔵 Faible / fonctionnelle | 16 | F-01 → F-16 |

### Verdict

**Non prêt pour la production.** Les corrections de la phase 0 (rotation des secrets, RLS, MFA, sync) sont des prérequis bloquants. Voir `PLAN_CORRECTION_BACKEND.md`.

---

## 2. Architecture générale

### 2.1 Stack réelle

| Couche | Technologie | Preuve |
|---|---|---|
| Runtime | Node ≥ 20, ESM | `package.json` (`"type": "module"`, `engines`) |
| HTTP | Express 4.21, helmet, cors, morgan, express-rate-limit | `src/app.js` |
| Validation | Zod 3 | `src/middleware/validate.js`, `*.schema.js` |
| Données | PostgreSQL (Supabase) via Prisma 5.22 | `prisma/schema.prisma`, `src/config/prisma.js` |
| Authentification | Supabase Auth (JWT) | `src/middleware/auth.js:22` |
| Temps réel | Socket.IO 4.8 sur `/realtime` | `src/realtime/index.js` |
| Planification | `setInterval` + verrou consultatif Postgres | `src/jobs/index.js:343` |
| Moteur géospatial / IA | Service Python HTTP séparé (`geoai/server.py`, port 8100) | `src/integrations/geospatial.js` |
| Stockage | Supabase Storage, disque local ou S3 | `src/integrations/storage.js`, `s3.js` |
| Messagerie | Twilio / Africa's Talking / webhook / console ; Resend / SendGrid | `src/integrations/*` |

**Divergence assumée avec le CDC** (documentée dans `README.md`) : le CDC visait MongoDB (index `2dsphere`) ; l'implémentation utilise Postgres sans PostGIS (GeoJSON en `jsonb` + lat/lng indexés). Voir `AUDIT_GEOSPATIAL.md`.

### 2.2 Chaîne de traitement d'une requête

```
helmet → cors → requestId → [parseur JSON 1 Mo | chemin dépôt géospatial : writeLimiter → authenticate → JSON 100 Mo]
→ urlencoded → rejectOperators → morgan → globalLimiter → settingsEffects → routes/index.js
   └── router : authenticate → resolveTenant → authorize('ressource.action') → validate(Zod) → service
→ notFound → errorHandler
```

### 2.3 Modèle d'autorisation (4 couches annoncées)

1. **Authentification** : jeton Supabase vérifié par `supabase.auth.getUser()` (`auth.js:22`).
2. **Permission** : `authorize('x.y')` sur la matrice `shared/permissions.js`.
3. **Propriété** : `assertOwnership()` dans les services.
4. **Tenant** : `resolveTenant` choisit une organisation via `X-Organization-Id`, vérifiée contre les adhésions.

Points forts : la couche 4 est appliquée de façon cohérente (la plupart des requêtes filtrent `organizationId: req.tenant.organizationId`). Faiblesses : voir H-03 (union des rôles) et C-04 (sync).

### 2.4 Points forts constatés

- Validation Zod sur quasiment toutes les entrées, `strict()` sur les mises à jour.
- Isolation tenant par défaut, réponses 404 (et non 403) pour ne pas révéler l'existence de ressources tierces.
- Dépôt géospatial durci : limite de débit **avant** authentification **avant** lecture du corps (`app.js`), garde anti-traversée de chemin (`storage.js:71-72`), empreinte SHA-256 anti-doublon, quota transactionnel par organisation.
- Secrets TOTP chiffrés AES-256-GCM, codes de secours hachés, OTP hachés, comparaison à temps constant pour les signatures WhatsApp.
- Webhook Twilio : signature obligatoire, refus si jeton absent (`smsDelivery.routes.js:283+`).
- Machine à états des commandes centralisée (`shared/orderStateMachine.js`), journal d'audit, verrous consultatifs sur les tâches planifiées.
- `prisma validate` : **schéma valide** ; migrations alignées avec le schéma de la copie de travail.
- Tests unitaires purs exécutés (`tests/logic.test.mjs`, `tests/orderStateMachine.test.mjs`) : **30/30 réussis**.

---

## 3. Constats détaillés

Format : **ID — Titre** · Sévérité · Statut (*Confirmé* = lu dans le code ; *À confirmer* = dépend d'une configuration externe non accessible en lecture seule).

### 🔴 C-01 — Secrets de production présents dans un fichier versionné

- **Sévérité** : Critique · **Statut** : Confirmé
- **Fichier** : `backend/.env.example` (suivi par git — `git ls-files` le liste ; seul `backend/.env` est ignoré par `backend/.gitignore:2`).
- **Preuves** :
  - Copie de travail (non committée) : `DATABASE_URL` (l.101) et `DIRECT_URL` (l.103) contiennent l'hôte du pooler Supabase **et le mot de passe** ; `SUPABASE_SERVICE_ROLE_KEY` (l.112) contient une clé `sb_secret_…` réelle ; `RESEND_API_KEY` (l.285) une clé réelle ; `CONTACT_EMAIL` (l.284) une adresse personnelle.
  - **Déjà committé et poussé** (`git show HEAD:backend/.env.example`, remote `origin` GitHub) : `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` (l.274-275 dans HEAD, l.279-280 en copie de travail) sont des valeurs réelles.
- **Risque** : la clé `service_role` contourne toute RLS et donne un contrôle total sur Supabase (Auth, Storage, base). Le mot de passe DB donne un accès direct Postgres. Un simple `git commit -a` publierait l'ensemble. Les secrets Cloudinary sont déjà exposés à toute personne ayant accès au dépôt.
- **Correction** : rotation immédiate de **tous** ces secrets (mot de passe DB, `service_role`, Resend, Cloudinary), remplacement par des placeholders, purge de l'historique (`git filter-repo`), activation d'un scanner de secrets (gitleaks) en pré-commit et en CI.

### 🔴 C-02 — Aucune politique RLS : exposition potentielle de toute la base via l'API REST Supabase

- **Sévérité** : Critique · **Statut** : À confirmer (dépend de la configuration du projet Supabase)
- **Preuves** :
  - Aucune instruction `ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY` dans les 21 migrations (`prisma/migrations/*/migration.sql`) ni dans les scripts SQL du backend.
  - `docs/DEPLOYMENT.md:137-140` présente la RLS comme une « défense en profondeur » **optionnelle**.
  - Les tables sont créées dans le schéma `public` (`DATABASE_URL …?schema=public`), schéma exposé par défaut par PostgREST (Data API Supabase).
  - Le backend **délivre lui-même** des jetons Supabase valides à tout inscrit (`auth.service.js:176`, `:226`) ; la clé `anon`/publishable est publique par conception.
- **Risque** : si la Data API est active et que les privilèges par défaut `anon`/`authenticated` sont accordés (comportement standard de Supabase), n'importe quel utilisateur inscrit peut lire et modifier **toutes les tables** (`profiles`, `mfa_secrets`, `orders`, `api_keys`…) en appelant directement `https://<projet>.supabase.co/rest/v1/<table>` — contournant entièrement le backend, son RBAC et son isolation tenant.
- **Vérification recommandée (lecture seule)** :
  ```sql
  SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' ORDER BY relrowsecurity, relname;
  SELECT grantee, count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND grantee IN ('anon','authenticated') GROUP BY grantee;
  ```
- **Correction** : activer la RLS sur toutes les tables `public` **sans politique** (refus par défaut, le backend passant par un rôle propriétaire) ou révoquer les privilèges `anon`/`authenticated`, ou déplacer les tables dans un schéma non exposé ; désactiver la Data API si elle n'est pas utilisée.

### 🔴 C-03 — La double authentification (MFA) est contournable

- **Sévérité** : Critique · **Statut** : Confirmé (code) — l'exploitation suppose la clé publishable/anon, publique par conception
- **Preuves** :
  - La MFA n'est vérifiée **que** dans `POST /auth/login` (`auth.service.js:254-285`).
  - Le middleware `authenticate` accepte **tout** jeton Supabase valide (`auth.js:22`) sans examiner le niveau d'assurance (`aal`) ni l'origine de la session.
  - `requireMfa` (`authorize.js:52-63`) vérifie seulement le **drapeau** `profile.mfaEnabled`, pas que la session courante a franchi un second facteur. `requireSuperAdmin` s'appuie dessus.
  - `POST /auth/mfa/verify` (`auth.routes.js:31`) vérifie un code mais **n'élève rien** : aucune session/jeton n'est marqué.
- **Scénario** : un attaquant qui possède le mot de passe d'un SUPER_ADMIN appelle directement Supabase Auth (`/auth/v1/token?grant_type=password`) avec la clé publique, obtient un JWT, et l'utilise sur `/api/v1/admin/*`. Ni la MFA, ni le verrouillage anti-force brute (`auth.service.js:209-248`, géré côté backend uniquement) ne s'appliquent.
- **Correction** : utiliser la MFA native Supabase (facteurs TOTP, claim `aal` = `aal2`) et exiger `aal2` dans `authenticate`/`requireMfa` ; à défaut, émettre après MFA un jeton applicatif signé par le backend et refuser les JWT Supabase bruts sur les routes protégées. Activer la protection anti-force brute côté Supabase.

### 🔴 C-04 — Synchronisation hors-ligne : affectation massive et rupture d'isolation tenant

- **Sévérité** : Critique · **Statut** : Confirmé
- **Fichiers** : `src/modules/sync/sync.service.js`, `src/modules/sync/sync.routes.js`
- **Preuves** :
  - `sync.routes.js:17` : `payload: z.record(z.any())` — aucune validation par collection.
  - `sync.service.js:38-41` : seuls `organizationId`, `createdAt`, `deletedAt` sont retirés ; tous les autres champs vont tels quels dans `delegate.create/update` (`:224`, `:255`).
  - `sync.service.js:32` : `lot_events: { tenantField: null }` → pour `UPDATE`/`DELETE`, la recherche est `findFirst({ where: { id } })` **sans filtre d'organisation** ; pour `CREATE`, `lotId` n'est pas contrôlé.
  - Aucune clé étrangère (`plotId`, `farmId`, `lotId`, `itemId`…) n'est vérifiée contre le tenant.
  - `sync.service.js:269` : suppression **physique** pour `inventory_movements` et `lots`.
- **Risques** :
  - N'importe quel producteur peut **injecter, modifier ou supprimer les événements de traçabilité d'un lot appartenant à une autre organisation** — événements affichés publiquement via QR code (`/public/lots/:code`).
  - Rattachement de données à des parcelles/exploitations d'un autre tenant.
  - Contournement de toutes les règles métier des modules dédiés (validation de géométrie et contrôle pays des parcelles, cohérence des stocks, champs de vérification, `version`, `verificationStatus`…).
  - Effacement de l'historique des stocks et des lots (perte de piste d'audit).
- **Correction** : schéma Zod **par collection** en liste blanche ; ajouter le filtre tenant pour `lot_events` (via `lot.organizationId`) ; vérifier chaque clé étrangère ; réutiliser les services métier au lieu d'écrire directement via Prisma ; suppression logique uniquement ; transaction englobant opération + `syncOperation`.

### 🟠 H-01 — Rôles sensibles obtenus librement à l'inscription

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuves** :
  - `auth.schema.js:21-31` : `SELF_SERVICE_ACCOUNT_TYPES` inclut `SUPPORT_AGENT`, `AGRONOMIST`, `INVESTOR`.
  - `auth.service.js:126-134` : le type de compte choisi devient directement le rôle de l'adhésion.
  - `permissions.js:40` `'fx.write': [...ADMIN_ROLES, 'SUPPORT_AGENT']`, `:178` `'prices.write': [...ADMIN_ROLES, 'SUPPORT_AGENT']`.
  - `permissions.js:76-86, 112, 123, 175` : `rules.write/validate`, `ranges.write/validate`, `models.write`, `anomaly.review`, `ai.review` ouverts à `AGRONOMIST`.
  - `SUPPORT_AGENT` fait partie du groupe `PRODUCER` (`permissions.js:8-14`) : il détient **94 permissions sur 141**, presque autant qu'un `ADMIN` (98).
- **Risque** : un compte anonyme créé en 10 secondes peut publier de faux prix de marché (`POST /prices`), et — dès que la route fonctionnera (cf. F-01) — de faux taux de change ; un « agronome » auto-déclaré peut valider des plages agronomiques et règles qui pilotent les recommandations envoyées à **tous** les agriculteurs, ou réhabiliter des mesures écartées comme anomalies.
- **Correction** : retirer `SUPPORT_AGENT` et `AGRONOMIST` de l'inscription libre (attribution par administrateur après vérification), ou créer un statut « en attente de vérification » sans permission d'écriture ; sortir `SUPPORT_AGENT` du groupe `PRODUCER`.

### 🟠 H-02 — Création d'organisation sans contrôle = auto-attribution de rôles producteur

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuves** : `organizations.routes.js:14` — `POST /organizations` sans `authorize` ; `organizations.service.js:65` attribue `COOPERATIVE_ADMIN` ou `AGRICULTURAL_COMPANY` au créateur. `PATCH /organizations/:id` (`:16`) n'a pas non plus de permission : tout membre (ex. `COOPERATIVE_MEMBER`) peut renommer l'organisation active.
- **Risque** : un `BUYER`, `INVESTOR` ou `TRANSPORTER` s'octroie un rôle producteur en un appel ; combiné à H-03, ce rôle s'applique dans **toutes** ses organisations.
- **Correction** : permission dédiée (`organizations.create`), validation administrative pour les coopératives/entreprises, `authorize('organizations.write')` restreint aux administrateurs de l'organisation pour `PATCH`.

### 🟠 H-03 — Union des rôles de toutes les organisations dans le contexte actif

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuve** : `tenant.js:47` — `effectiveRoles: [...membership.roles, ...req.user.roles]` où `req.user.roles` est l'union des rôles de **toutes** les adhésions (`auth.js:56`).
- **Risque** : un utilisateur `COOPERATIVE_ADMIN` dans l'organisation A et simple `COOPERATIVE_MEMBER` dans B dispose des droits d'administrateur de coopérative **dans B** (ex. `cooperatives.members`). L'isolation des rôles par tenant est annulée.
- **Correction** : `effectiveRoles` = rôles de l'organisation active **+ uniquement** les rôles de plateforme (`SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `COUNTRY_ADMIN`, `DATA_STEWARD`) idéalement portés par une organisation « plateforme » dédiée.

### 🟠 H-04 — Changement de mot de passe sans mot de passe actuel ni MFA

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuves** : `users.schema.js:18-19` (seul `newPassword`) ; `users.service.js:121-122` appelle `supabaseAdmin.auth.admin.updateUserById` directement. Les autres sessions ne sont pas révoquées.
- **Risque** : un jeton volé (XSS, poste partagé) permet la prise de contrôle définitive du compte, y compris d'un administrateur.
- **Correction** : exiger le mot de passe actuel (vérifié via Supabase) **et** un code MFA si actif ; révoquer les autres sessions ; notifier l'utilisateur par e-mail.

### 🟠 H-05 — MFA investisseur auto-déclarée ; data room sans contrôle investisseur

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuves** : `investors.routes.js:19` accepte `mfaEnabled: z.boolean()` dans le profil ; `investors.service.js:27` l'enregistre tel quel ; `assertInvestorReady` (`investors.service.js:107-118`) se fie à ce drapeau. `assertInvestorReady` n'est appelé que par `investdashboard/dashboard.service.js:10`, **pas** par `dataroom.service.js`.
- **Risque** : l'exigence V4 NFR-01 (« MFA obligatoire pour les accès investisseur et documents confidentiels ») n'est pas appliquée : un investisseur se déclare « MFA activée » sans l'être, et la data room ne vérifie ni la vérification administrative ni la MFA.
- **Correction** : supprimer `mfaEnabled` du schéma d'entrée ; dériver la valeur de `Profile.mfaEnabled` (lui-même corrigé selon C-03) ; appeler `assertInvestorReady` dans `requestAccess` et `openDocument`.

### 🟠 H-06 — Fuite de géolocalisation après passage de la position en « privée »

- **Sévérité** : Élevée (vie privée) · **Statut** : Confirmé
- **Preuves** : `farms.service.js:44-54` renvoie `{lat:null,lng:null}` en mode `private` ; `farms.service.js:191` n'écrit `publicLatitude/publicLongitude` **que si** `lat !== null`. Les anciennes coordonnées publiques restent donc en base et continuent d'être servies par `GET /public/map` (`public.service.js:198-210`, filtre `publicLatitude: { not: null }`) et `GET /public/farms/:slug`.
- **Risque** : un producteur qui retire sa position (sécurité, conflit foncier) reste localisable publiquement à ~1 km près.
- **Correction** : écrire explicitement `publicLatitude: null, publicLongitude: null` quand la visibilité vaut `private` ; script de correction des données existantes.

### 🟠 H-07 — Vérification du compte (e-mail/téléphone) jamais exigée

- **Sévérité** : Élevée · **Statut** : Confirmé
- **Preuve** : `requireVerified` est défini (`auth.js:110`) mais **n'est utilisé dans aucune route** (recherche exhaustive dans `src/`). L'inscription renvoie immédiatement une session (`auth.service.js:173-178`).
- **Risque** : comptes jetables pouvant publier des annonces, passer des commandes, contacter des producteurs, demander des OTP, etc. Renforce H-01 et M-07.
- **Correction** : appliquer `requireVerified` sur toutes les routes d'écriture métier (annonces, commandes, offres, messagerie, projets, prix).

### 🟠 H-08 — Prix et contrepartie d'une commande contrôlés par l'acheteur

- **Sévérité** : Élevée (intégrité commerciale) · **Statut** : Confirmé
- **Preuves** : `orders.service.js:105-108` — `unitPrice = payload.unitPrice ?? offer.price ?? …`, idem `currency` et `quantity` : le prix d'une **offre acceptée** est écrasé par celui fourni par l'acheteur. `orders.service.js:74-81` : l'offre est chargée par identifiant sans vérifier que l'organisation courante est l'auteur de la demande d'achat liée → un tiers peut commander sur l'offre négociée entre deux autres parties. La quantité n'est pas comparée à celle de l'offre ; pas de réservation atomique du stock de l'annonce.
- **Risque** : commandes à prix arbitraire figées dans le `snapshot` « contractuel », usurpation d'offres négociées, survente.
- **Correction** : prix/quantité/devise **dérivés** de l'offre ou de l'annonce (non modifiables par l'acheteur) ; vérifier `offer.request.organizationId === tenant` ; décrément/réservation de quantité dans la transaction.

### 🟡 M-01 — Idempotence partagée entre utilisateurs

- **Preuves** : `idempotency.js:28` — clé unique `(key, scope)`, le `userId` est stocké (`:36`) mais jamais comparé ; `:49` rejoue `responseBody` à quiconque présente la même clé.
- **Risque** : si une clé est connue (journaux, proxy, client défaillant générant des clés prévisibles), un autre utilisateur obtient la réponse d'autrui (données de commande, etc.).
- **Correction** : inclure `userId` (et `organizationId`) dans la clé unique et dans la recherche.

### 🟡 M-02 — Points d'entrée MFA et OTP sans limitation dédiée ; TOTP rejouable

- **Preuves** : `auth.routes.js:31,34,46,47` — `/mfa/verify`, `/mfa/disable`, `/verify-phone`, `/send-otp` sans `authLimiter` (seul le limiteur global 300 req/15 min s'applique). `mfa.service.js:255-263` : fenêtre ±1 pas, aucun mémorisation du dernier compteur utilisé → un même code est valable ~90 s et rejouable.
- **Correction** : `authLimiter` + compteur d'échecs par utilisateur sur ces routes ; mémoriser le dernier pas TOTP accepté.

### 🟡 M-03 — Effets des paramètres (maintenance / modules désactivés) contournables

- **Preuves** : `settingsEffects.js:75` compare les préfixes en respectant la casse, alors qu'Express route sans tenir compte de la casse (`/api/v1/LISTINGS` atteint le routeur des annonces sans être reconnu comme module `market`). La liste `MODULE_PREFIXES` (`:29-37`) omet `/geospatial`, `/messaging`, `/alerts`, `/sync`, `/organizations/:id/reputation`, etc. En cas d'erreur de lecture, le garde laisse passer (`:112`, fail-open assumé).
- **Correction** : normaliser en minuscules, `app.set('case sensitive routing', true)` ou comparaison insensible ; compléter la liste.

### 🟡 M-04 — Politique de sécurité administrable mais sans effet

- **Preuves** : les clés `security.lockoutMinutes`, `security.passwordMinLength`, `security.passwordRequireSpecial`, `security.sessionTtlHours`, `security.mfaRequiredForGovernance`, `integrations.smsProvider`, `integrations.emailProvider`, etc. (`admin.settings.schema.js:54-170`) ne sont lues **nulle part** en dehors du module admin (l'authentification utilise `env.LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, une longueur minimale 8 codée dans `auth.schema.js`). De plus, `PUT /admin/settings` (`admin.settings.routes.js:45`) n'exige pas de MFA pour les clés de palier 2 alors que le service le prétend (`admin.settings.service.js:209-215`).
- **Risque** : un SUPER_ADMIN croit renforcer la politique alors que rien ne change (fausse assurance).
- **Correction** : brancher ces paramètres dans l'auth et les intégrations, ou les retirer de l'écran ; `requireSuperAdmin` (avec MFA) pour les sections `security`/`integrations`.

### 🟡 M-05 — Canaux USSD / WhatsApp non authentifiés

- **Preuves** : `channels.routes.js:27-31` — `POST /channels/ussd` sans aucune authentification ni signature d'agrégateur ; `channels.routes.js:45-46` — signature WhatsApp vérifiée **seulement si** `WHATSAPP_APP_SECRET` est défini (vide dans `.env.example`) et cette variable n'est pas dans le schéma Zod d'environnement.
- **Risques** : énumération des numéros inscrits (`channels.service.js:76-78` : « Numéro non reconnu »), lecture des annonces d'un producteur à partir de son seul numéro, écriture illimitée dans `channel_messages`/`channel_sessions`, faux messages WhatsApp.
- **Correction** : liste blanche d'IP ou secret partagé de l'agrégateur USSD ; signature WhatsApp obligatoire en production (démarrage refusé sinon) ; limiteur dédié.

### 🟡 M-06 — Formulaire de contact public exploitable comme relais de spam

- **Preuves** : `public.routes.js:34-40` — `POST /public/farms/:slug/contact` sans authentification, sans `publicRateLimit`, sans captcha ; `public.service.js:153-185` envoie un e-mail au producteur avec le contenu libre.
- **Correction** : `publicRateLimit` + limiteur par cible, captcha, file de modération, journalisation.

### 🟡 M-07 — Temps réel : autorisations figées à la connexion

- **Preuves** : `realtime/index.js:80-90` — rooms utilisateur/organisation/conversation calculées une seule fois ; aucune revalidation lors d'une suspension (`admin.service.js:304`), d'un retrait d'adhésion ou de l'expiration du JWT.
- **Correction** : vérifier l'expiration du jeton (déconnexion à échéance), purger les sockets lors d'une suspension/révocation (`io.in(roomForUser(id)).disconnectSockets()`), revalider les rooms d'organisation.

### 🟡 M-08 — Limitation de débit non distribuée

- **Preuves** : `rateLimit.js` utilise le `MemoryStore` par défaut ; `app.js:37` `trust proxy = 1`. Le compteur de verrouillage du login (`auth.service.js:229-238`) est un read-modify-write non atomique.
- **Risque** : limites contournables en multi-instance ou par requêtes parallèles ; derrière deux niveaux de proxy, l'IP utilisée est celle d'un proxy.
- **Correction** : store Redis/Postgres partagé ; incrément atomique (`failedLoginAttempts: { increment: 1 }`) ; paramétrer `trust proxy` selon l'infrastructure réelle.

### 🟡 M-09 — Moteur GeoAI exposé et divulgation d'URL interne

- **Preuves** : `geoai/server.py:219,227` écoute sur `0.0.0.0` par défaut ; `:37,155-157` jeton **optionnel** et comparaison `==` non constante ; `integrations/geospatial.js:129,133` renvoie `url: baseUrl()` servi par `GET /geospatial/health` à tout porteur de `geospatial.read`. Les routes de calcul (`/geospatial/texture`, `/spectral`, `/imagery`, `/fusion`, `/subsurface`…) n'ont ni quota ni `writeLimiter`.
- **Correction** : écoute `127.0.0.1` par défaut, jeton obligatoire hors développement, `hmac.compare_digest`, retirer l'URL de la réponse, quota par organisation.

### 🟡 M-10 — `COUNTRY_ADMIN` non borné à son pays

- **Preuves** : `insights.service.js:80` accepte n'importe quel `countryCode` fourni par la requête ; aucun code ne rattache un `COUNTRY_ADMIN` à un pays (recherche exhaustive : le rôle n'apparaît que dans les listes de validation). `apiclients.read` lui donne la liste globale des clients API.
- **Correction** : rattacher le rôle à un pays (organisation ou attribut d'adhésion) et filtrer systématiquement.

### 🟡 M-11 — Médias : contrôles déclaratifs et URL qui expire

- **Preuves** : `media.schema.js` valide `mimeType`/`sizeBytes` **déclarés** par le client ; `media.service.js:95-114` ne vérifie ni la taille ni le type réels de l'objet téléversé, et enregistre comme `url` permanente une URL signée valable `SIGNED_URL_TTL_SECONDS` (300 s).
- **Risques** : fichiers arbitraires stockés, quota contourné ; images cassées 5 minutes après confirmation.
- **Correction** : vérifier l'objet (taille, octets magiques via `shared/fileMagic.js`) au `confirm` ; stocker la clé et générer l'URL à la lecture.

### 🟡 M-12 — Oracle de mot de passe et déni de service par verrouillage

- **Preuves** : `auth.service.js:255-261` — quand la MFA est active et qu'aucun code n'est fourni, la réponse « Code de double authentification requis » confirme la validité du mot de passe sans incrémenter le compteur ; le verrouillage par compte (`:229-238`) permet de bloquer n'importe quel compte connu par 5 essais.
- **Correction** : compter la tentative sans code comme un échec partiel ; préférer un ralentissement progressif par couple (IP, compte) au verrouillage dur.

### 🟡 M-13 — Verrou des tâches planifiées tenu dans une transaction longue

- **Preuves** : `jobs/index.js:340-355` — `pg_try_advisory_lock` dans une transaction interactive de 30 min ; la tâche s'exécute avec un autre client (`prisma`), la connexion de la transaction reste « idle in transaction ». Incompatible avec un pooler en mode transaction (PgBouncer/Supavisor port 6543).
- **Correction** : verrou de session sur une connexion dédiée ou table de bail (`job_leases`) avec expiration.

### 🟡 M-14 — Clé d'API : comparaison et quota

- **Preuves** : `apiKey.js:29` compare des empreintes avec `!==` (faible risque, empreinte SHA-256) ; `:44` compte les usages des 24 dernières heures à **chaque** appel (`COUNT(*)`), et l'écriture de l'usage est asynchrone (`:53-88`) → quota contournable par rafale parallèle, coût croissant.
- **Correction** : compteur agrégé (table `resource_usage` déjà présente) incrémenté atomiquement ; `timingSafeEqual`.

### 🔵 Anomalies faibles et fonctionnelles

| ID | Constat | Preuve | Correction |
|---|---|---|---|
| F-01 | `PUT /countries/fx-rates` sans `authenticate` : `authorize('fx.write')` voit des rôles vides → **403 systématique**, y compris pour un administrateur. Fonctionnalité inutilisable. | `countries.routes.js:112-114` (comparer `:63-67` où `authenticate` est présent) | Ajouter `authenticate` (et retirer `SUPPORT_AGENT`, cf. H-01) |
| F-02 | `GET /sync/pull` sans paramètre `collections` échoue : `InventoryMovement` et `LotEvent` n'ont pas de champ `updatedAt` | `sync.service.js:334` ; `schema.prisma` (modèles sans `updatedAt`) | Champ de curseur par collection |
| F-03 | Saisie de résultats de laboratoire inopérante : `organization.type === 'LAB_PARTNER'` n'existe pas dans l'enum `OrgType` ; le laboratoire doit posséder la parcelle ; seul `roles[0]` est testé | `geodata.service.js:156-162` ; `schema.prisma` enum `OrgType` | Modéliser le partenariat laboratoire ↔ parcelle |
| F-04 | Contrôle « point dans le pays » (PLOT-05) jamais actif : aucun `bounds` dans les profils pays seedés | `plots.service.js:29-39` ; `prisma/seed.js:30-34` | Renseigner les emprises (ou polygones) pays |
| F-05 | USSD : champs inexistants `pricePerUnit`/`price` et `crop.name` → prix et nom de culture toujours vides | `channels.service.js:90,99` | Utiliser `indicativePrice` et `crop.names[locale]` |
| F-06 | Inscription assistée (AUTH-07) : la route `register` n'est pas authentifiée → `agentId` toujours `null` | `auth.routes.js:15` ; `auth.service.js:159` | Route dédiée authentifiée pour les agents |
| F-07 | Matrice RBAC : clés dupliquées `dataproducts.manage` et `data.read` ; rôle `VISITOR` inexistant ; `admin.roles`, `admin.security`, `admin.maintenance` définies mais jamais utilisées | `permissions.js:133, 225-229, 233-239` | Nettoyage + test de cohérence |
| F-08 | Code mort : bloc entièrement commenté dupliquant `authorize.js` ; fichier `auth.schema.js.bak` | `authorize.js:92-175` ; `modules/auth/auth.schema.js.bak` | Supprimer |
| F-09 | Documentation divergente : README annonce 73 modèles / 86 tables ; le schéma compte **102 modèles** | `README.md:21,44,261` | Régénérer la documentation |
| F-10 | Suppression de compte : l'utilisateur Supabase n'est pas désactivé ; pas de garde « dernier SUPER_ADMIN » | `users.service.js:137-157` | Bannir côté Supabase, garde RG-G2 |
| F-11 | Origine CORS refusée → erreur 500 (au lieu de 403) | `app.js:49` + `errorHandler.js:50` | Erreur `ApiError.forbidden` |
| F-12 | Montants et quantités en `Float` (pas `Decimal`) | `schema.prisma` (`totalAmount`, `price`, `rate`…) | `Decimal(18,4)` pour les montants |
| F-13 | `register` utilise `supabaseAdmin` sans tester sa présence → 500 si la clé de service manque | `auth.service.js:78` ; `config/supabase.js:26-28` | Garde explicite au démarrage |
| F-14 | `public/soil-stats` charge toutes les analyses en mémoire | `public.service.js:345-346` | Agrégation SQL (`groupBy`) |
| F-15 | Racine du dépôt encombrée : ~50 scripts `fix-*.mjs`, journaux (`test-run.log` 247 Ko), sondes (`openapi-sonde.json` 346 Ko). Pendant l'audit (14/11, 13:12), une partie a été déplacée vers `flux/` et `docs/` hors de toute action de l'auditeur ; `test-run.log`, `openapi-sonde.json` et les sondes restent à la racine | racine du dépôt, `flux/` | Archiver hors du dépôt (ou `.gitignore`) |
| F-16 | `errorHandler` renvoie le code Prisma brut pour les erreurs non mappées | `errorHandler.js:29-30` | Message neutre + log |

---

## 4. Sécurité et configuration — analyse transverse

### 4.1 Configuration (`src/config/env.js`)

- Validation Zod de l'environnement au démarrage, arrêt si invalide : **bon point**.
- `SUPABASE_SERVICE_ROLE_KEY` optionnelle alors que l'inscription, le reset de mot de passe et les URL signées en dépendent (F-13).
- `CORS_ORIGIN` accepte `*` avec `credentials: true` (`app.js:46`) : à interdire en production.
- Variables lues hors schéma (`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `MFA_ENCRYPTION_KEY`, `API_DAILY_QUOTA`, `AI_DAILY_QUOTA_*`) : non validées.
- `MFA_ENCRYPTION_KEY` : repli sur la clé `service_role` puis sur une constante `agrikon-dev-mfa-key` hors production (`mfa.service.js:97-100`). Tout environnement de pré-production avec `NODE_ENV≠production` chiffre donc avec une clé connue.
- `SIMULATION_ENABLED=true` par défaut, neutralisé en production (`env.js:449`) : correct.

### 4.2 Authentification

| Mécanisme | État | Constat |
|---|---|---|
| Inscription | Partiel | Rôles sensibles en libre-service (H-01), pas de vérification exigée (H-07), pas de captcha |
| Connexion | Partiel | Verrouillage non atomique et contournable via Supabase direct (C-03, M-08, M-12) |
| MFA TOTP | Défaillant | Contournable (C-03), rejouable (M-02), drapeau investisseur déclaratif (H-05) |
| Rafraîchissement / déconnexion | Correct | Délégué à Supabase |
| Mot de passe oublié | Correct | Réponse identique (anti-énumération) |
| Changement de mot de passe | Défaillant | Sans mot de passe actuel (H-04) |
| OTP téléphone | Correct | Code haché, 5 essais, double plafond numéro/utilisateur |
| API publique (clé) | Correct avec réserves | Hachage, portée, contrat de finalité ; quota contournable (M-14) |

### 4.3 Validation des entrées

Zod est appliqué sur la quasi-totalité des routes ; `rejectOperators` bloque les clés `$…`. Exception majeure : `sync.push` (`z.record(z.any())`, C-04), `preferences: z.record(z.any())` dans le profil investisseur (risque faible). Aucune requête SQL brute non paramétrée (`$queryRawUnsafe` absent), aucun `eval`/`child_process`. Les appels `fetch` sortants ne visent que des URL de configuration (pas de SSRF contrôlé par l'utilisateur).

### 4.4 Journalisation et audit

Journal d'audit présent sur les actions sensibles (`shared/audit.js`). Réserves : `newValue: payload` journalise parfois des données personnelles complètes (`users.service.js:101`, `organizations.service.js:134`) ; aucune politique de rétention des journaux d'audit n'a été trouvée.

---

## 5. Système géospatial

Synthèse (détail dans `AUDIT_GEOSPATIAL.md`) : stockage GeoJSON `jsonb` + lat/lng indexés en B-tree, **sans PostGIS ni index spatial** ; calculs (centroïde, surface) approximatifs et limités aux `Polygon` simples ; aucune validation topologique ; contrôle pays inactif (F-04) ; fuite de position privée (H-06) ; moteur Python de qualité correcte mais exposé (M-09). Le dépôt de fichiers géospatiaux est la partie la mieux sécurisée du backend.

---

## 6. Rôles et permissions

Synthèse (détail dans `MATRICE_ROLES_PERMISSIONS.md`) : 19 rôles, 141 permissions, matrice centralisée et lisible. Défauts structurels : rôles sensibles en libre-service (H-01), escalade par création d'organisation (H-02), union des rôles inter-tenant (H-03), `COUNTRY_ADMIN` sans périmètre (M-10), groupe `PRODUCER` qui englobe `SUPPORT_AGENT`, permissions définies mais inutilisées (F-07). Le `SUPER_ADMIN` ne détient **pas** les permissions d'écriture producteur (`farms.write`…), ce qui est cohérent avec une séparation des rôles.

---

## 7. API, routes, contrôleurs et services

- 70 fichiers de routes, **415 déclarations** (inventaire complet dans `INVENTAIRE_BACKEND.md`).
- Montage : `routes/index.js` agrège ~70 routeurs ; plusieurs routeurs sont montés sur le même préfixe (`/plots` ×5, `/` ×4, `/admin` ×5) avec des `router.use(authenticate, resolveTenant)` au niveau routeur : fonctionnel mais fragile (ordre de montage déterminant, ré-exécution de `resolveTenant`).
- Contrôleurs souvent fusionnés dans les routes (handlers inline) : le motif `controller` annoncé n'est appliqué que dans 17 dossiers de modules sur 54.
- Services volumineux : `recommendation.service.js` (1 151 l.), `alerts.service.js` (1 036 l.), `admin.service.js` (881 l.), `soil/intelligence.service.js` (867 l.).
- Routes sans garde de permission explicite (hors routes publiques assumées) : `/organizations/*`, `/me/*`, `/media` (GET), `/sms/settings`, `/dashboard` — acceptable pour `/me`, à corriger pour `/organizations` (H-02).

---

## 8. Modèle de données

- 102 modèles, 68 enums, 143 `@@index`, 47 modèles portant `organizationId` (isolation tenant).
- Identifiants `String` (ULID côté client pour l'offline) ; `version` + `deletedAt` sur les entités synchronisées.
- Faiblesses : montants en `Float` (F-12) ; `LotEvent` et `InventoryMovement` sans `updatedAt`/`version` (F-02) ; absence de RLS (C-02) ; pas de type géométrique natif.
- Migrations : 21 migrations versionnées, `prisma validate` OK, migration `20261031010000_blog_posts` non encore committée (dossier non suivi).

---

## 9. Performances et scalabilité

| Sujet | Constat | Impact |
|---|---|---|
| État en mémoire | Rate-limit, cache des paramètres (15 s), Socket.IO sans adaptateur Redis | Pas de scale horizontal sans adaptation |
| Tâches planifiées | `setInterval` dans chaque instance + verrou en transaction longue (M-13) | Connexions monopolisées |
| Requêtes non agrégées | `soilStats` (F-14), quota API par `COUNT(*)` (M-14), `loadConversationRooms` jusqu'à 500 par socket | Coût croissant avec le volume |
| Géospatial | Filtrage par bbox B-tree sans PostGIS, pas de plafond d'emprise | Requêtes larges coûteuses |
| Corps volumineux | Dépôt base64 jusqu'à 100 Mo en mémoire (+33 %), multipart jusqu'à 64 Mo bufferisé | Pression mémoire sous charge (atténuée par rate-limit + auth préalables) |
| Pagination | Plafond 100 via `paginationSchema` ; quelques `findMany` non bornés sur des relations par utilisateur | Acceptable |

---

## 10. Fonctionnalités : implémentées, incomplètes, absentes

| Domaine | État | Commentaire |
|---|---|---|
| V1 FARM (exploitations, parcelles, productions, sol S1) | ✅ Implémenté | Réserves géospatiales (AUDIT_GEOSPATIAL) |
| Inscription / connexion / OTP / reset | ✅ Implémenté | Défauts de sécurité (§4.2) |
| MFA | ⚠️ Incomplet | Non contraignante (C-03) |
| Inscription assistée par agent (AUTH-07) | ⚠️ Incomplet | `agentId` jamais renseigné (F-06) |
| V2 MARKET (annonces, demandes, offres, commandes, avis, litiges, stock, transport, messagerie) | ✅ Implémenté | Intégrité des prix (H-08) |
| Paiement en ligne | ❌ Absent (assumé) | « Mise en relation uniquement — paiement hors plateforme » |
| Temps réel | ✅ Implémenté | Revalidation absente (M-07) |
| V3 INTELLIGENCE (IA, météo, prix, traçabilité, certifications, IoT, géodonnées, recommandation, alertes, prévision, interpolation, satellite, anomalies) | ✅ Implémenté | Satellite et anomalies désactivés par défaut ; laboratoire inopérant (F-03) |
| Synchronisation hors-ligne | ⚠️ Défaillant | C-04, F-02 |
| Taux de change | ⚠️ Cassé | Écriture impossible (F-01) |
| V4 INVEST (projets, data room, due diligence, reporting, financement, investisseurs) | ✅ Implémenté | Garde MFA/vérification absente sur la data room (H-05) |
| V5 GLOBAL (appels d'offres, export, API publique, produits de données, insights) | ✅ Implémenté | `COUNTRY_ADMIN` non borné (M-10) |
| Canaux USSD / WhatsApp | ⚠️ Incomplet | Non authentifiés (M-05), réponses USSD erronées (F-05) |
| Gouvernance Super Admin (rôles, paramètres, flags, maintenance) | ⚠️ Partiel | Politique de sécurité sans effet (M-04) |
| RLS Supabase | ❌ Absent | C-02 |
| PostGIS / index spatial | ❌ Absent | Choix documenté |
| Store distribué (Redis) | ❌ Absent | M-08 |

---

## 11. Limites de l'audit

- Audit **statique** : aucune requête n'a été envoyée à l'API ni à la base (consigne de non-modification ; le `.env` pointe vers une base Supabase distante réelle).
- Tests d'intégration et E2E (Postgres embarqué) non exécutés ; seuls les tests unitaires purs l'ont été (30/30).
- La configuration du projet Supabase (RLS, Data API, MFA native, protection anti-force brute) n'est pas visible depuis le code : C-02 et l'exploitabilité de C-03 sont à confirmer avec les requêtes fournies.
- Les ~75 000 lignes ont été parcourues par extraction outillée ; les modules à risque (auth, RBAC, tenant, admin, sync, commandes, investissement, géospatial, canaux, médias, temps réel) ont été lus en détail. Les algorithmes métier (scoring de recommandation, krigeage, prévision) ont été examinés sous l'angle sécurité/robustesse, pas validés scientifiquement.
- Les applications `apps/web` et `apps/Mobile` sont hors périmètre (seule l'absence d'usage direct de Supabase côté client a été vérifiée).
