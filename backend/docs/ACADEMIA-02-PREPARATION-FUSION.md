# ACADEMIA-02 — Rapport de préparation de fusion

> Date : 19 novembre 2026. Suite de `ACADEMIA-01-AUDIT-ET-PLAN.md`.
> **Rien n'a été poussé ni fusionné.** Toutes les branches citées sont **locales**.
> Aucune connexion n'a été faite à une base Supabase ; aucune migration n'a été appliquée hors des bases éphémères de test.

---

## 1. État des branches et des commits

### 1.1 Branches distantes non fusionnées dans `main` (`48c4f00`)

| Branche | Commits hors `main` | Contenu | Incluse dans la branche d'audit ? |
|---|---|---|---|
| `fix/audit-lot3-authentification` | 10 | Audits lots 1 à 3 (dont **H-03**), appels audio, push, corrections mobile, tâches planifiées, pooler | — (branche de référence) |
| `fix/audit-lot2-autorisations` | 7 | Lots 1 et 2 | Oui |
| `fix/audit-lot1-correctifs-rapides` | 6 | Lot 1 | Oui |
| `fix/tableau-de-bord-et-navigation` | 5 | Menu, tableau de bord, pooler, tâches | Oui |
| `fix/mobile-blocages` | 2 | Mobile | **Non** — fusion d'essai avec ACADEMIA sans conflit |
| `docs-passation` | 1 | Documentation | **Non** — fusion d'essai sans conflit |

Le commit `e7657b8` (menu hamburger) est à la fois dans l'audit et dans `main` (sous le nom `b25387a`) : même contenu, aucune collision.

### 1.2 Branches locales préparées (non poussées)

| Branche | Base | Commits ajoutés | Rôle |
|---|---|---|---|
| `prep/audit-vers-main` | `origin/fix/audit-lot3-authentification` | `21b682f` fusion de `main` · `e9ecf05` workflow CI · `37a573c` correctif CI | **PR A** → `main` |
| `feature/academia` | `main` (`48c4f00`) | `d54240c` lot L1 | Développement ACADEMIA d'origine |
| `prep/academia` | `prep/audit-vers-main` | `bd0c849` réintégration d'ACADEMIA · `9cc7320` report du correctif CI | **PR B** → `main`, après la PR A |
| `sauvegarde/travail-local-2026-11-19` | `fix/audit-lot3-authentification` | `add6b55` instantané du travail non commité | Protection (voir §5.3) |

---

## 2. Stratégie de fusion de l'audit (PR A)

1. Partir de la branche d'audit telle qu'elle est sur GitHub (`1c6f1fb`) : **aucun commit d'audit n'est réécrit**.
2. Y fusionner `main` pour résoudre le seul conflit **dans la branche**, avant la PR (commit `21b682f`) — voir §4.1.
3. Ajouter le workflow CI complet (§6), pour que la PR A soit elle-même testée.
4. Ouvrir la PR `prep/audit-vers-main` → `main`, attendre la CI verte, relire, puis fusionner **avec ton accord**.

H-03 est conservé **intégralement** : `rolesEffectifs(rolesOrganisationActive, rolesTousTenants)` ne retient, en dehors de l'organisation active, que les rôles de plateforme (`PLATFORM_ROLES`).

---

## 3. Stratégie de réintégration d'ACADEMIA (PR B)

1. Partir de `prep/audit-vers-main` : ACADEMIA est intégré **au-dessus** de H-03, jamais l'inverse.
2. Fusionner `feature/academia` et résoudre 6 conflits (§4.2) — commit `bd0c849`.
3. Ouvrir la PR B **après** la fusion de la PR A : son diff ne montrera plus que les changements ACADEMIA.
4. Garder `modules.academia` désactivé par défaut (aucune ligne en base = désactivé).

---

## 4. Résolution détaillée des conflits

### 4.1 PR A — `main` dans l'audit

| Fichier | `main` | Audit | Résolution |
|---|---|---|---|
| `apps/web/src/lib/config.ts` | `REALTIME_ENABLED` (PR #9 : pas de Socket.IO si le serveur ne l'a pas monté) | `origineDe()` (temps réel sur l'origine de l'API, sonnerie des appels) | **Les deux conservés** |

### 4.2 PR B — ACADEMIA sur l'audit

| Fichier | Résolution | Justification |
|---|---|---|
| `backend/src/middleware/tenant.js` | **Version H-03 intégrale** ; la variante ACADEMIA est retirée | H-03 cloisonne les rôles dans **toutes** les organisations, établissements compris : la protection R2 d'ACADEMIA est incluse et renforcée |
| `backend/src/shared/permissions.js` | `PLATFORM_ROLES` et `ASSIGNABLE_ROLES` (audit) **+** constantes ACADEMIA | `ACADEMIA_ADMIN` étant un rôle de gouvernance, il devient rôle de plateforme et attribuable par un Super Admin ; `STUDENT`, `PROFESSOR`, `RESEARCHER`, `LIBRARIAN`, `UNIVERSITY_ADMIN` restent **contextuels** |
| `backend/src/middleware/settingsEffects.js` | Modules `appels` **et** `academia` | `appels` garde son défaut (actif) ; `academia` est désactivé par défaut |
| `backend/src/modules/admin/admin.settings.schema.js` | Réglages `modules.appels` **et** `modules.academia` | Idem |
| `backend/prisma/schema.prisma` | Réunion (appels audio, push, ACADEMIA) | Ajouts indépendants ; une accolade de `PushDevice` corrigée à la main après la réunion automatique |
| `backend/package.json` | Listes de tests de l'audit + tests ACADEMIA | — |

Adaptation : le test unitaire R2 d'ACADEMIA est réécrit selon la règle H-03 et vérifie en plus que les rôles académiques ne sont pas des rôles de plateforme.

Effet à valider : sous H-03, le rôle de plateforme `AGRONOMIST` s'applique aussi dans un établissement (expertise transverse).

---

## 5. Ordre définitif des migrations

### 5.1 Chaîne

| # | Migration | Origine | Statut dans le dépôt |
|---|---|---|---|
| 1 à 21 | … → `20261031020000_revoke_anon_authenticated_grants` | `main` | Versionnées |
| 22 | `20261116000000_audio_calls` | Audit | Versionnée (PR A) |
| 23 | `20261116010000_push_devices` | Audit | Versionnée (PR A) |
| 24 | `20261118100000_profile_settings` | Travail local | **Non versionnée** (§5.3) |
| 25 | `20261119100000_academia_foundations` | ACADEMIA | Versionnée (PR B) |

### 5.2 Contrôles exécutés (PostgreSQL 18 éphémère, `scripts/check-migrations.mjs`)

| Chaîne | Résultat |
|---|---|
| `main` + ACADEMIA | 22/22, RLS 106 tables, aucun drift |
| PR B (`main` + audit + ACADEMIA) | **24/24**, RLS **110** tables, aucun privilège `anon`/`authenticated`, **aucun drift** |
| PR B + `profile_settings` (essai temporaire, non commité) | **25/25**, RLS 110 tables, **aucun drift** |

### 5.3 Travail local « paramètres de profil »
- **Contenu de base de données** : 4 colonnes JSONB **facultatives** (`profiles.professional_profile`, `profiles.account_preferences`, `organizations.profile_details`, `organizations.settings`). La migration correspond exactement au schéma modifié.
- **Compatibilité ACADEMIA** : aucune colonne commune ; chaîne complète validée (§5.2).
- **Versionnement** : non commité, sur la copie locale de `fix/audit-lot3-authentification`, **mélangé** à d'autres chantiers (traçabilité, pages publiques, écrans web et mobile, réglages Expo Go).
- **Protection** : instantané complet (110 fichiers) dans la branche locale `sauvegarde/travail-local-2026-11-19` (`add6b55`), créé **sans modifier** la copie de travail ni l'index.
- **À décider** : le committer sur sa propre branche, de préférence en séparant les chantiers, **avant** la PR B si sa migration doit entrer dans la même mise en production.

### 5.4 État de la base de production : **inconnu**
- Render n'applique pas les migrations (`buildCommand` : `npm ci` puis `prisma generate`).
- `backend/.env` vise le projet Supabase `tvjyyevozihshzidqtbx` (pooler `aws-0-eu-west-1`, `NODE_ENV=development`). Rien dans le dépôt, la documentation ni le site public ne permet de dire s'il s'agit de la production. **Aucune connexion n'a été faite.**
- Un script de vérification **en lecture seule** est prêt (§8, étape 3). Il ouvre une transaction `READ ONLY`, ne lit que `_prisma_migrations` et classe chaque migration : appliquée, non appliquée, divergente (somme de contrôle différente), échouée, ou inconnue du dépôt.

---

## 6. Résultats des tests

**Le workflow CI n'a pas encore tourné sur GitHub** : il faut pousser une branche pour cela. Les résultats ci-dessous ont été obtenus **localement**, sur `prep/academia`, avec **exactement les variables du workflow** et sur des bases éphémères.

| Vérification | Résultat |
|---|---|
| `npm test` backend (unitaires et intégration PostgreSQL) | **1 447 tests : 1 442 réussis, 4 échecs** — tous **préexistants**, voir ci-dessous |
| Sécurité et isolation hors `npm test` (`auditLot3`, `calls`, `push`) | **27/27** |
| ACADEMIA (unitaires + bout en bout) | Inclus dans `npm test` : réussis |
| Typecheck web | Réussi |
| Typecheck mobile · tests mobiles | Réussi · **45/45** |
| Vitest web · build web | **Non exécutés localement** (les workers dépassent le délai de 60 s sur ce poste) — couverts par la CI |

**Analyse des 4 échecs** (reproduits à l'identique sur la branche d'audit d'origine, **sans** ACADEMIA) :
- 3 dans `adminUsers.test.mjs` : variable `SUPABASE_SERVICE_ROLE_KEY` absente. **Corrigé dans le workflow** (`37a573c`, valeur factice) ; avec elle, les 3 tests passent.
- 1 dans `recommendationLabels.test.mjs` : le test cherche `;\n`, mais sous Windows git extrait le fichier en CRLF (`core.autocrlf=true`). Le dépôt est en LF : **le test passe sous Linux (CI)**. Défaut du test, préexistant, non modifié.

---

## 7. Risques résiduels

| # | Risque | Niveau | Mesure |
|---|---|---|---|
| 1 | État des migrations en production inconnu | **Élevé** | Vérification en lecture seule, après identification de l'environnement |
| 2 | CI jamais exécutée sur GitHub | Moyen | Pousser les branches (avec ton accord) et exiger la CI verte |
| 3 | Travail local non commité et mélangé, modifié par d'autres sessions (nombre de fichiers modifiés en hausse pendant l'analyse) | Moyen | Sauvegarde faite ; tri et commits par chantier |
| 4 | Site web en production pas redéployé depuis la PR #9 (`index-DSyms6hK.js` toujours servi) | Moyen | Vérifier l'auto-déploiement Render |
| 5 | Deux demandes d'affiliation simultanées peuvent créer deux `PENDING` (aucun droit accordé) | Faible | Contrôle applicatif ; contrainte partielle impossible sans casser le contrôle de drift |
| 6 | `ACADEMIA_ADMIN` sans exigence MFA sur les routes ACADEMIA | Faible à moyen | Proposition : exiger `requireMfa` sur la création d'établissement et la désignation des responsables (lot suivant) |
| 7 | Test `recommendationLabels` en échec sur les postes Windows | Faible | Proposition : accepter `\r?\n` dans le test (hors périmètre) |
| 8 | `AGRONOMIST` effectif dans les établissements (H-03) | Faible | À confirmer |

---

## 8. Étapes avant la mise en production

1. **Ton accord** pour pousser `prep/audit-vers-main` et ouvrir la PR A ; CI verte ; relecture ; fusion.
2. **Ton accord** pour pousser `prep/academia` et ouvrir la PR B ; CI verte ; relecture ; fusion.
3. **Identifier l'environnement** de chaque base (développement, préproduction, production), puis lancer la vérification **en lecture seule** — d'abord hors production, puis en production, **sur confirmation**.
4. **Sauvegarde** de la base de production (Supabase) avant toute migration.
5. **Préproduction** : appliquer la chaîne (22 → 25) selon `PLAN_MIGRATION_STAGING_APPELS.md`, tester.
6. **Production**, avec ton accord explicite : mêmes migrations, dans le même ordre.
7. Déployer l'API ; vérifier que `modules.academia` reste désactivé (aucune ligne en base, ou `false`).
8. Contrôles après déploiement : santé de l'API, connexion, espaces producteur et administration, routes ACADEMIA en `403 module_disabled`.
9. Activer ACADEMIA **seulement** après la recette des écrans (lot L3).

**Retour arrière** : ACADEMIA se coupe instantanément par `modules.academia = false`. Le code se retire en annulant le commit de fusion. Les tables se suppriment par la procédure décrite en tête de la migration (les valeurs ajoutées aux énumérations restent, sans effet).
