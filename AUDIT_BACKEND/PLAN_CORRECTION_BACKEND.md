# Plan de correction — Backend AGRIKONNECT AFRICA

Référence : `RAPPORT_AUDIT_BACKEND.md` (identifiants C-, H-, M-, F-).
**Aucune correction n'a été appliquée.** Ce plan attend une validation explicite avant toute intervention.

## Principes

- Chaque lot est livrable seul, avec ses tests de non-régression (la suite existante — `npm test`, Postgres embarqué — sert de filet).
- Les corrections de sécurité ajoutent un **test qui échoue avant correction** (preuve de la faille) puis passe après.
- Toute modification de schéma passe par une migration Prisma versionnée.
- Estimation en jours-personne (j/p) pour un développeur connaissant le code.

## Vue d'ensemble

| Phase | Objectif | Constats | Effort estimé | Bloquant prod |
|---|---|---|:-:|:-:|
| **0 — Urgence** (J0-J2) | Stopper les expositions actives | C-01, C-02 | 1-2 j/p | ✅ |
| **1 — Sécurité critique** (S1) | Authentification forte, intégrité des données | C-03, C-04, H-04, H-01 | 6-8 j/p | ✅ |
| **2 — Autorisation** (S2) | RBAC et isolation tenant | H-02, H-03, H-05, H-07, M-01, M-10 | 5-6 j/p | ✅ |
| **3 — Intégrité métier & vie privée** (S3) | Commandes, géolocalisation, médias | H-06, H-08, M-11, F-01, F-02, F-04 | 4-5 j/p | ✅ (H-06, H-08) |
| **4 — Durcissement** (S4) | Surface d'attaque, abus, robustesse | M-02 → M-09, M-12 → M-14 | 6-8 j/p | Recommandé |
| **5 — Qualité & dette** (S5+) | Fonctionnel, nettoyage, scalabilité | F-03, F-05 → F-16, géospatial | 8-12 j/p | Non |

Total indicatif : **30 à 41 j/p**.

---

## Phase 0 — Urgence (avant toute autre action)

### P0.1 — Rotation et purge des secrets (C-01)

| Étape | Action | Responsable |
|---|---|---|
| 1 | Révoquer/régénérer : mot de passe Postgres Supabase, clé `service_role` (`sb_secret_…`), clé Resend, clé et secret Cloudinary | Propriétaire des comptes |
| 2 | Remplacer toutes les valeurs de `backend/.env.example` par des placeholders explicites (`<à-renseigner>`) ; retirer `CONTACT_EMAIL` personnel | Dev |
| 3 | Purger l'historique git (`git filter-repo --path backend/.env.example --invert-paths` puis réintroduction propre, ou `--replace-text`) et forcer la mise à jour du dépôt distant après accord | Dev + propriétaire du dépôt |
| 4 | Ajouter gitleaks (hook pre-commit + job CI) | Dev |
| 5 | Vérifier les journaux d'accès Supabase/Cloudinary/Resend sur la période d'exposition | Propriétaire |

**Critère d'acceptation** : `gitleaks detect` sans résultat sur tout l'historique ; anciens secrets refusés par les fournisseurs.

### P0.2 — Fermer l'accès direct à la base via Supabase (C-02)

1. Exécuter en lecture seule les requêtes de vérification du rapport (§C-02).
2. Si des tables `public` sont sans RLS et accessibles à `anon`/`authenticated` :
   - Migration `enable_rls_all_tables` : `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` sur toutes les tables, **sans politique** (refus par défaut). Le backend se connecte avec le rôle propriétaire (`postgres`), non soumis à la RLS — vérifier que le rôle de `DATABASE_URL` est bien propriétaire ou `BYPASSRLS`.
   - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` + `ALTER DEFAULT PRIVILEGES … REVOKE …`.
   - Désactiver la Data API (PostgREST) dans le tableau de bord si elle n'est pas utilisée.
3. Ajouter un test/contrôle CI (`scripts/check-migrations.mjs`) qui échoue si une table de `public` n'a pas `relrowsecurity = true`.

**Critère d'acceptation** : `GET https://<projet>.supabase.co/rest/v1/profiles` avec un JWT utilisateur renvoie 401/403 ou une liste vide.

---

## Phase 1 — Sécurité critique

### P1.1 — MFA réellement contraignante (C-03)

Option recommandée — **MFA native Supabase** :
1. Migrer l'enrôlement TOTP vers `supabase.auth.mfa.enroll/challenge/verify` ; reprendre les secrets existants ou demander un ré-enrôlement.
2. Dans `middleware/auth.js`, décoder le JWT (claim `aal`) ; exposer `req.user.aal`.
3. `requireMfa` : exiger `aal === 'aal2'` (et non plus le drapeau `profile.mfaEnabled`).
4. Appliquer `requireMfa` à toutes les routes `/admin/*` et aux routes investisseur/data room.
5. Activer la protection anti-force brute et le CAPTCHA côté Supabase Auth (le verrouillage applicatif ne couvre pas les connexions directes).

Option alternative : jeton applicatif signé par le backend après MFA (claims `mfa: true`, durée courte), seuls jetons acceptés sur les routes protégées.

**Tests** : session obtenue sans second facteur → 403 sur `/admin/users` ; session `aal2` → 200.

### P1.2 — Refonte de la synchronisation hors-ligne (C-04, F-02)

1. Définir un schéma Zod **strict** par collection (liste blanche des champs modifiables par le terrain).
2. `lot_events` : charger le lot parent et vérifier `lot.organizationId === tenant` pour CREATE/UPDATE/DELETE ; envisager l'interdiction d'UPDATE/DELETE (journal append-only).
3. Vérifier chaque clé étrangère (`farmId`, `plotId`, `lotId`, `itemId`, `cropId`) contre le tenant.
4. Déléguer aux services métier (`plots.service.create/update`, `inventory.service`, `traceability.service`) pour bénéficier de leurs contrôles (géométrie, pays, stocks).
5. Remplacer les suppressions physiques par des suppressions logiques ; ajouter `updatedAt` (et `version`) à `InventoryMovement` et `LotEvent` (migration) ou un curseur dédié par collection pour `pull`.
6. Encapsuler opération + `syncOperation` dans une transaction.

**Tests** : opération `lot_events` UPDATE sur un lot d'une autre organisation → `REJECTED` ; champ `verificationStatus` dans le payload → ignoré ; `GET /sync/pull` sans paramètre → 200.

### P1.3 — Changement de mot de passe sécurisé (H-04)

1. `changePasswordSchema` : `currentPassword` + `newPassword` (+ `mfaCode` si MFA).
2. Vérifier le mot de passe actuel via Supabase (comme `verifyCurrentPassword` dans `admin.service.js`), puis `assertMfa`.
3. Révoquer les autres sessions (`revokeSessions`), envoyer une notification e-mail.

### P1.4 — Rôles en libre-service (H-01)

1. Retirer `SUPPORT_AGENT` et `AGRONOMIST` de `SELF_SERVICE_ACCOUNT_TYPES` **ou** les créer avec un statut d'adhésion `PENDING` sans permission d'écriture jusqu'à validation administrative.
2. Sortir `SUPPORT_AGENT` du groupe `PRODUCER` ; lui donner une liste de permissions explicite.
3. Retirer `fx.write` et `prices.write` à `SUPPORT_AGENT` (ou les conditionner à une vérification).
4. Audit des comptes existants porteurs de ces rôles.

---

## Phase 2 — Autorisation et isolation

| Lot | Constat | Actions | Tests |
|---|---|---|---|
| P2.1 | H-03 | `resolveTenant` : `effectiveRoles = membership.roles ∪ PLATFORM_ROLES∩req.user.roles` avec `PLATFORM_ROLES = [SUPER_ADMIN, ADMIN, MODERATOR, COUNTRY_ADMIN, DATA_STEWARD]` | Utilisateur CA dans A, CM dans B → 403 sur `cooperatives.members` dans B |
| P2.2 | H-02 | Permissions `organizations.create` / `organizations.write` ; création de COOPERATIVE/COMPANY soumise à validation ; `PATCH` réservé aux administrateurs de l'organisation | BUYER → 403 sur `POST /organizations` |
| P2.3 | H-07 | Appliquer `requireVerified` sur les routes d'écriture métier (liste en annexe A) | Compte non vérifié → 403 sur `POST /listings` |
| P2.4 | H-05 | Retirer `mfaEnabled` du schéma investisseur ; dériver du profil ; appeler `assertInvestorReady` dans `dataroom.requestAccess` et `openDocument` | Investisseur non vérifié → 403 data room |
| P2.5 | M-01 | Clé d'idempotence unique `(key, scope, userId)` (migration) ; recherche filtrée par utilisateur | Même clé, deux utilisateurs → pas de rejeu croisé |
| P2.6 | M-10 | Rattacher `COUNTRY_ADMIN` à un pays (attribut d'adhésion ou organisation pays) ; filtrer `insights`, `apiclients` | COUNTRY_ADMIN CD → 403 sur `countryCode=CG` |

---

## Phase 3 — Intégrité métier et vie privée

| Lot | Constat | Actions |
|---|---|---|
| P3.1 | H-06 | `farms.service.update/create` : en mode `private`, écrire `publicLatitude/publicLongitude = null` ; script de reprise : `UPDATE farms SET public_latitude=NULL, public_longitude=NULL WHERE visibility->>'location'='private'` (après sauvegarde, validé par le porteur) |
| P3.2 | H-08 | Commandes : prix, devise, quantité dérivés de l'offre/annonce ; vérifier que l'offre répond à une demande de l'organisation courante ; réservation atomique (`updateMany … where quantity >= q`) |
| P3.3 | M-11 | Médias : contrôle taille/type réels au `confirm` (`shared/fileMagic.js`) ; stocker `storageKey`, générer l'URL signée à la lecture |
| P3.4 | F-01 | Ajouter `authenticate` sur `PUT /countries/fx-rates` (après P1.4) |
| P3.5 | F-04 | Renseigner les emprises pays (ou polygones) dans `seed.js` ; contrôler **tous** les sommets, pas seulement le centroïde |

---

## Phase 4 — Durcissement

| Lot | Constat | Actions |
|---|---|---|
| P4.1 | M-02 | `authLimiter` sur `/auth/mfa/*`, `/auth/send-otp`, `/auth/verify-phone` ; mémoriser le dernier pas TOTP accepté (colonne `lastCounter`) |
| P4.2 | M-03 | `settingsEffects` : comparaison insensible à la casse ; compléter `MODULE_PREFIXES` ; test de couverture listant tous les montages de `routes/index.js` |
| P4.3 | M-04 | Brancher `security.*` dans l'auth (verrouillage, longueur de mot de passe, durée de session) et `integrations.*` dans les fournisseurs, ou retirer ces paramètres ; `requireSuperAdmin` sur les sections palier 2 |
| P4.4 | M-05 | USSD : secret/IP de l'agrégateur + limiteur ; WhatsApp : signature obligatoire en production (arrêt au démarrage sinon) ; ajouter ces variables au schéma `env.js` ; réponse USSD neutre pour un numéro inconnu |
| P4.5 | M-06 | `publicRateLimit` + plafond par producteur + captcha sur `POST /public/farms/:slug/contact` |
| P4.6 | M-07 | Socket.IO : déconnexion à l'expiration du JWT ; `disconnectSockets()` sur suspension/révocation ; revalidation des rooms |
| P4.7 | M-08 | Store Redis pour `express-rate-limit` ; incrément atomique des échecs de connexion ; `trust proxy` aligné sur l'infrastructure |
| P4.8 | M-09 | GeoAI : écoute `127.0.0.1`, jeton obligatoire hors dev, `hmac.compare_digest` ; retirer `url` de `/geospatial/health` ; quota par organisation sur les routes de calcul |
| P4.9 | M-12 | Compter la tentative « mot de passe correct, MFA absente » ; ralentissement progressif plutôt que verrouillage dur |
| P4.10 | M-13 | Table de bail pour les tâches (`job_leases`) au lieu d'un verrou en transaction longue |
| P4.11 | M-14 | Quota API via compteur atomique (`resource_usage`) ; `timingSafeEqual` |
| P4.12 | Config | Refuser `CORS_ORIGIN=*` en production ; supprimer le repli `agrikon-dev-mfa-key` hors `development`/`test` ; `SUPABASE_SERVICE_ROLE_KEY` obligatoire |

---

## Phase 5 — Qualité, dette et scalabilité

| Lot | Constats | Actions |
|---|---|---|
| P5.1 | F-03 | Modéliser le partenariat laboratoire (relation labo ↔ parcelle mandatée), tester le rôle `LAB_PARTNER` sur `effectiveRoles` |
| P5.2 | F-05, F-06 | Corriger les champs USSD ; route d'inscription assistée authentifiée (`/agents/registrations`) |
| P5.3 | F-07, F-08, F-15 | Nettoyer `permissions.js` (doublons, `VISITOR`, permissions mortes), supprimer code commenté et `.bak`, archiver les scripts `fix-*.mjs` et journaux de la racine |
| P5.4 | F-09 | Régénérer README/API/OpenAPI depuis le code (scripts existants) et ajouter un contrôle CI de cohérence |
| P5.5 | F-10, F-11, F-13, F-16 | Garde « dernier SUPER_ADMIN » et bannissement Supabase à la suppression ; erreur CORS 403 ; garde `supabaseAdmin` ; message d'erreur Prisma neutre |
| P5.6 | F-12 | Migration `Float → Decimal(18,4)` pour montants et taux (plan de migration de données) |
| P5.7 | F-14 + perf | Agrégations SQL ; adaptateur Redis Socket.IO ; extraction des tâches planifiées dans un worker dédié |
| P5.8 | Géospatial | Feuille de route `AUDIT_GEOSPATIAL.md` §7 (PostGIS, validation topologique, MultiPolygon) |

---

## Annexe A — Routes d'écriture à protéger par `requireVerified` (P2.3)

`POST/PATCH /listings*`, `POST /purchase-requests`, `POST/PATCH /market/*` (offres), `POST /orders*`, `POST /transport/*`, `POST /messaging/*`, `POST /projects*`, `POST /tenders*`, `POST /exports*`, `POST /prices`, `PUT /countries/fx-rates`, `POST /reviews*`, `POST /organizations`, `POST /dataroom/*`, `POST /investment/projects/:id/contact`.

## Annexe B — Ordre de déploiement recommandé

1. Phase 0 (immédiat, indépendant du code applicatif).
2. P1.1 + P1.3 ensemble (même surface : authentification).
3. P1.2 (sync) avec communication aux équipes mobiles (contrat d'API modifié).
4. P1.4 + phase 2 (impact sur les comptes existants : prévoir une revue des rôles).
5. Phase 3, puis 4, puis 5.

## Annexe C — Indicateurs de clôture

- 0 constat critique/élevé ouvert ; tests de preuve de faille ajoutés et verts.
- `gitleaks`, contrôle RLS et contrôle de couverture `settingsEffects` intégrés à `npm run verify`.
- Revue de sécurité indépendante après la phase 2.
