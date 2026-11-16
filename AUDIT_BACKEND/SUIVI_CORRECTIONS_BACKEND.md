# Suivi des corrections — Backend AGRIKONNECT AFRICA

Date de vérification : **16/11/2026**.
Code vérifié : `main` (`d66cc29`) + branche `fix/tableau-de-bord-et-navigation` (`c4baa3f`).
Références : `RAPPORT_AUDIT_BACKEND.md` (constats) et `PLAN_CORRECTION_BACKEND.md` (plan d'origine).

Chaque statut a été établi en relisant le code actuel, pas d'après la documentation.
**Corrigé** = le défaut décrit n'existe plus ; **Partiel** = le risque est réduit mais le
constat reste ouvert ; **Ouvert** = code inchangé depuis l'audit.

> Rotation des secrets : différée volontairement par le porteur du projet jusqu'à la
> fin du développement (risque accepté). Elle reste un **préalable à l'ouverture au public**.

---

## Avancement

| Lot | État | Branche |
|---|---|---|
| Lot 1 — Correctifs rapides | **Appliqué** (16/11/2026), tests `tests/auditLot1.test.mjs` | `fix/audit-lot1-correctifs-rapides` |
| Lots 2 à 6 | À faire | — |

Les tableaux du §2 décrivent l'état **avant** le Lot 1 ; le détail du Lot 1 est au §4.

## 1. Bilan (avant Lot 1)

| Sévérité | Total | Corrigé | Partiel | Ouvert |
|---|:-:|:-:|:-:|:-:|
| Critique (C) | 4 | 0 | 1 | 3 |
| Élevée (H) | 8 | 0 | 0 | 8 |
| Moyenne (M) | 14 | 0 | 2 | 12 |
| Faible / fonctionnelle (F) | 16 | 0 | 0 | 16 (6 vérifiés, 10 présumés — §2.4) |

Aucun constat de l'audit n'est entièrement corrigé à ce jour. Les travaux réalisés depuis
l'audit ont porté sur le déploiement, l'i18n, la vérification d'e-mail et la stabilité
(voir §3) — ils ont toutefois **levé un prérequis** important : la vérification d'adresse
e-mail fonctionne désormais, ce qui rend H-07 (`requireVerified`) applicable.

---

## 2. Statut par constat

### 2.1 Critiques

| ID | Statut | Constat dans le code actuel |
|---|---|---|
| C-01 Secrets versionnés | **Partiel** | `DATABASE_URL`, `service_role` et clé Resend ne sont plus dans `backend/.env.example` (placeholders). **Reste** : `CLOUDINARY_API_SECRET` (et la clé associée) toujours renseignés dans `backend/.env.example` (l. 289), fichier suivi et poussé ; présents dans l'historique (2 commits). Pas de gitleaks. Rotation différée (cf. encadré). |
| C-02 Exposition via l'API REST Supabase | **Partiel** | Migration `20261031020000_revoke_anon_authenticated_grants` (révocation des privilèges `anon`/`authenticated`) + contrôle CI `scripts/check-migrations.mjs` (vérifie les privilèges et lit `relrowsecurity`). **Reste** : aucune table n'a la RLS activée (défense en profondeur) ; état de la Data API côté tableau de bord à confirmer. |
| C-03 MFA contournable | **Ouvert** | Aucun contrôle du claim `aal` dans `src/middleware/` ; `requireMfa` se fie toujours au drapeau `profile.mfaEnabled`. |
| C-04 Synchronisation hors-ligne | **Ouvert** | `sync.routes.js:17` `payload: z.record(z.any())` ; `sync.service.js:32` `lot_events` sans `tenantField` ; `sync.service.js:269` suppression physique. |

### 2.2 Élevés

| ID | Statut | Constat dans le code actuel |
|---|---|---|
| H-01 Rôles sensibles en libre-service | **Ouvert** | `auth.schema.js:21-31` inclut toujours `SUPPORT_AGENT`, `AGRONOMIST`, `INVESTOR` ; `permissions.js:40` `fx.write` et `:178` `prices.write` ouverts à `SUPPORT_AGENT`. |
| H-02 Création d'organisation libre | **Ouvert** | `organizations.routes.js:14` `POST /` sans `authorize` ; `PATCH /:id` idem. |
| H-03 Union des rôles inter-organisations | **Ouvert** | `tenant.js:47` `effectiveRoles = membership.roles ∪ req.user.roles`. |
| H-04 Changement de mot de passe | **Ouvert** | `users.schema.js:19` seul `newPassword` ; `users.service.js:122` `updateUserById` direct, sans révocation de sessions. |
| H-05 MFA investisseur auto-déclarée | **Ouvert** | `investors.routes.js:19` accepte `mfaEnabled` ; `assertInvestorReady` appelé uniquement par `investdashboard/dashboard.service.js:10`, pas par la data room. |
| H-06 Fuite de géolocalisation | **Ouvert** | `farms.service.js:191` n'écrit `publicLatitude/Longitude` que si `lat !== null` : les anciennes coordonnées restent publiées. |
| H-07 Vérification jamais exigée | **Ouvert** (désormais **débloqué**) | `requireVerified` utilisé seulement par `smsDelivery`. La vérification d'e-mail fonctionne depuis la PR #7 : la mesure peut être appliquée sans bloquer les inscrits. |
| H-08 Prix de commande fixé par l'acheteur | **Ouvert** | `orders.service.js:105-108` `payload.unitPrice ?? offer.price…`, idem devise et quantité. |

### 2.3 Moyens

| ID | Statut | Constat dans le code actuel |
|---|---|---|
| M-01 Idempotence partagée | Ouvert | `idempotency.js:36` stocke `userId` sans le comparer. |
| M-02 MFA/OTP sans limiteur, TOTP rejouable | Ouvert | `auth.routes.js:31,34,46,47` sans `authLimiter` ; `mfa.service.js` ne mémorise que `lastUsedAt` (pas le dernier pas TOTP). |
| M-03 Effets des paramètres contournables | Ouvert | `settingsEffects.js:29-37` liste incomplète, comparaison sensible à la casse. |
| M-04 Politique de sécurité sans effet | Ouvert | `security.*` lus uniquement par le module admin (affichage). |
| M-05 USSD / WhatsApp non authentifiés | Ouvert | `channels.routes.js:28` `/ussd` sans authentification ; `:45` signature WhatsApp facultative, variable hors schéma `env.js`. |
| M-06 Contact public = relais de spam | **Partiel** | Le message n'est plus envoyé par e-mail mais déposé en notification interne (branche `fix/tableau-de-bord-et-navigation`) : plus de relais vers l'extérieur. **Reste** : `public.routes.js:35` sans `publicRateLimit` ni captcha → spam possible dans les notifications du producteur. |
| M-07 Temps réel figé | Ouvert | Aucun `disconnectSockets` ni contrôle d'expiration. |
| M-08 Limitation non distribuée | Ouvert | `MemoryStore` par défaut ; `app.js:38` `trust proxy = 1`. |
| M-09 GeoAI exposé | Ouvert | `geoai/server.py:219,227` écoute `0.0.0.0` ; jeton optionnel ; `integrations/geospatial.js` renvoie toujours `url: baseUrl()`. |
| M-10 `COUNTRY_ADMIN` non borné | Ouvert | `insights.service.js` valide le format du pays, pas l'appartenance. |
| M-11 Médias déclaratifs | Ouvert | Pas de contrôle des octets réels au `confirm`. |
| M-12 Oracle de mot de passe | Ouvert | Inchangé. |
| M-13 Verrou des tâches en transaction longue | **Partiel** | Les tâches s'exécutent désormais **une à la fois** par processus (`jobs/index.js`, `enFileUnique`), ce qui supprime l'interblocage du pool constaté avec `connection_limit=5`. Le verrou reste porté par une transaction pouvant durer 30 min. |
| M-14 Clé d'API | Ouvert | `apiKey.js:29` comparaison `!==` ; quota par `COUNT(*)`. |

### 2.4 Faibles / fonctionnels (vérifiés)

| ID | Statut | Constat |
|---|---|---|
| F-01 `PUT /countries/fx-rates` sans `authenticate` | Ouvert | `countries.routes.js:113` : seul le bloc l. 65 est authentifié → 403 systématique. |
| F-05 Champs USSD | Ouvert | `channels.service.js:90` `pricePerUnit ?? price`. |
| F-08 Code mort | Ouvert | `modules/auth/auth.schema.js.bak` présent. |
| F-10 Suppression de compte | Ouvert | Pas de bannissement Supabase ni de garde « dernier SUPER_ADMIN ». |
| F-11 CORS → 500 | Ouvert | `app.js:50` `new Error(...)` au lieu de `ApiError.forbidden`. |
| F-13 `service_role` facultative | Ouvert | `env.js:32` `.optional()`. |
| Config | Ouvert | Repli `agrikon-dev-mfa-key` hors production (`mfa.service.js:100`). |

F-02, F-03, F-04, F-06, F-07, F-09, F-12, F-14, F-15, F-16 : non revérifiés ligne à ligne ;
aucun travail ne les a visés depuis l'audit, statut présumé **Ouvert** (à confirmer au moment de les traiter).

---

## 3. Défauts trouvés et corrigés depuis l'audit (hors liste d'origine)

| Sujet | Correction | Où |
|---|---|---|
| Liens de vérification d'e-mail vers `localhost` | URL d'origine imposée, refus de démarrer en production avec une URL locale, modèles d'e-mail `token_hash` | PR #7 (`main`) |
| Connexion non vérifiée vue comme « identifiants incorrects » | 403 dédié, aucune tentative décomptée | PR #7 |
| Tableau de bord Organisation planté (`slug` nul) | Garde + type `slug: string \| null` | branche `fix/tableau-de-bord-et-navigation` |
| Saturation `EMAXCONNSESSION` (pooler en mode session) | Avertissement au démarrage + doc `backend/docs/SUPABASE_CONNEXIONS.md` ; `DATABASE_URL` à passer en 6543 | idem |
| Interblocage des tâches planifiées (`connection_limit`) | Exécution en file unique | idem |

---

## 4. Nouvelle recommandation de correction

Ordre révisé selon trois critères : **risque réel aujourd'hui** (application déjà en ligne),
**coût**, et **dépendances** (ce qui débloque la suite). Chaque lot est une PR distincte,
avec un test qui échoue avant correction.

### Lot 1 — Correctifs rapides, sans risque de régression (≈ 1 j/p) — ✅ appliqué

Résultat (branche `fix/audit-lot1-correctifs-rapides`) :

| Point | Statut | Ce qui a été fait |
|---|---|---|
| H-06 | **Corrigé** (code) | Position publique toujours recalculée, effacée en mode `private`. Test : échoue avant, passe après. **Reste** : script de reprise des fermes déjà privées (requête du plan d'origine, à exécuter par le porteur après sauvegarde). |
| M-06 | **Corrigé** (débit) | `contactLimiter` (5/h par IP en production) + `contactPerFarmLimiter` (20/h par ferme). Captcha non ajouté (dépend d'un fournisseur). |
| F-01 | **Corrigé** | `authenticate` + `resolveTenant` sur `PUT /countries/fx-rates` ; anonyme → 401 (fixture de surface mise à jour). |
| H-01 | **Partiel** | `fx.write` et `prices.write` retirés à `SUPPORT_AGENT` (préalable imposé par F-01). Le reste de H-01 est au Lot 2. |
| F-11 | **Corrigé** | Refus CORS → `ApiError.forbidden` (403) ; assertion ajoutée au test CORS existant. |
| M-14 | **Partiel** | Comparaison en temps constant (`empreintesEgales`). **Reste** : quota par compteur atomique (Lot 5). |
| M-09 | **Partiel** | GeoAI écoute `127.0.0.1` par défaut, refuse de démarrer en écoute réseau sans `GEOAI_TOKEN`, `hmac.compare_digest` ; `url` retirée de `/geospatial/health`. **Reste** : quota par organisation sur les routes de calcul. |
| Config MFA | **Sans changement** | `NODE_ENV` n'accepte que `development`/`test`/`production` : la clé de repli n'est déjà possible qu'en développement et en test. Risque résiduel opérationnel uniquement (ne jamais déployer un serveur public en `development`). |
| F-05 | **Corrigé** | USSD : `indicativePrice` et `nomCulture()` (lecture de `names`). |
| F-08 | **Corrigé** | `auth.schema.js.bak` supprimé ; bloc commenté dupliqué retiré d'`authorize.js`. |
| C-01 | **Partiel** | Valeurs Cloudinary, `CONTACT_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM` vidées dans `backend/.env.example`. **Reste** : rotation + purge d'historique (fin de projet). |

Plan initial du lot :

1. **H-06** — écrire `publicLatitude/publicLongitude = null` en mode `private` + script de
   reprise des fermes déjà passées en privé (à exécuter manuellement, après sauvegarde).
2. **M-06** — `publicRateLimit` + plafond par ferme sur `POST /public/farms/:slug/contact`.
3. **F-01** — `authenticate` sur `PUT /countries/fx-rates`.
4. **F-11** — origine CORS refusée → `ApiError.forbidden` (403).
5. **M-14** — `crypto.timingSafeEqual` pour l'empreinte de clé d'API.
6. **M-09 (partie code)** — GeoAI : écoute `127.0.0.1` par défaut, `hmac.compare_digest`,
   retirer `url` de `/geospatial/health`.
7. **Config** — supprimer le repli `agrikon-dev-mfa-key` hors `development`/`test`.
8. **F-05, F-08** — champs USSD corrects ; supprimer `auth.schema.js.bak` et le bloc commenté d'`authorize.js`.
9. **C-01 (partie dépôt)** — remplacer les valeurs Cloudinary de `backend/.env.example` par
   des placeholders (la rotation et la purge d'historique suivront la fin du projet).

### Lot 2 — Autorisation et isolation (≈ 3-4 j/p) — **bloquant ouverture au public**

1. **H-03** — `effectiveRoles` = rôles de l'organisation active + rôles de plateforme seulement.
2. **H-02** — `authorize('organizations.create')` / `organizations.write` ; coopérative et
   entreprise soumises à validation.
3. **H-01** — retirer `SUPPORT_AGENT` et `AGRONOMIST` de l'inscription libre (attribution par
   un administrateur) ; retirer `fx.write` / `prices.write` à `SUPPORT_AGENT` ; revue des
   comptes existants porteurs de ces rôles.
4. **H-07** — `requireVerified` sur les routes d'écriture métier (annexe A du plan d'origine).
   Prérequis rempli (vérification d'e-mail opérationnelle).
5. **M-01** — idempotence par `(key, scope, userId)` (migration).

### Lot 3 — Authentification forte (≈ 4-5 j/p) — **bloquant ouverture au public**

1. **H-04** — changement de mot de passe : mot de passe actuel + MFA si active, révocation des
   autres sessions.
2. **C-03** — MFA native Supabase (`aal2`) exigée par `requireMfa` sur `/admin/*`, data room
   et investisseurs ; activer la protection anti-force brute de Supabase Auth.
3. **M-02 / M-12** — `authLimiter` sur `/auth/mfa/*`, `/send-otp`, `/verify-phone` ;
   mémoriser le dernier pas TOTP ; compter la tentative « mot de passe correct, code absent ».
4. **H-05** — supprimer `mfaEnabled` du schéma investisseur ; `assertInvestorReady` dans la data room.

### Lot 4 — Intégrité des données métier (≈ 4-5 j/p) — **bloquant ouverture au public**

1. **C-04** — synchronisation : schéma strict par collection, contrôle tenant de `lot_events`
   et de chaque clé étrangère, passage par les services métier, suppression logique, transaction.
   À coordonner avec l'application mobile (contrat d'API modifié).
2. **H-08** — prix, devise et quantité dérivés de l'offre/annonce ; contrôle de la contrepartie ;
   réservation atomique.
3. **C-02 (fin)** — migration activant la RLS **sans politique** sur toutes les tables
   `public` (le backend utilise le rôle propriétaire) ; désactiver la Data API si inutilisée.
   Migration à appliquer manuellement, jamais dans la commande de build.

### Lot 5 — Durcissement (≈ 5-6 j/p) — recommandé avant montée en charge

M-03, M-04, M-05, M-07, M-08 (store partagé + incrément atomique des échecs de connexion),
M-10, M-11, M-13 (table de bail `job_leases`), F-10, F-13, gitleaks en CI.

### Lot 6 — Qualité et dette (≈ 6-8 j/p)

F-02, F-03, F-04, F-06, F-07, F-09, F-12 (`Decimal`), F-14, F-15, F-16 ; feuille de route
géospatiale (`AUDIT_GEOSPATIAL.md` §7).

### Préalables à l'ouverture au public (porteur du projet)

- Rotation de tous les secrets exposés (base, `service_role`, Resend, Cloudinary,
  `MFA_ENCRYPTION_KEY` si aucun utilisateur n'a activé la MFA) puis purge de l'historique Git.
- Lots 2, 3 et 4 terminés.
- `DATABASE_URL` en mode transaction (6543, `pgbouncer=true`, `connection_limit`) sur Render.
- Projet Supabase séparé pour le développement (le local écrit aujourd'hui dans la base de production).

**Total indicatif restant : 23 à 30 j/p**, dont environ **12 à 15 j/p bloquants** (lots 1 à 4).

---

## 5. Point d'attention pour les tests

Prisma charge lui-même `backend/.env` à l'import, **avant** la configuration de l'application.
Une valeur locale (ex. `JOBS_ENABLED=false`) modifie donc le résultat de la suite de tests
en local. La CI n'est pas concernée (pas de `.env`). À terme : lancer les tests avec un
environnement isolé (`DOTENV_CONFIG_PATH` ne suffit pas pour Prisma).
