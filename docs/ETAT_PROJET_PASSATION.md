# AGRIKONNECT AFRICA — État du projet et passation

État au 15/11/2026.

## Résumé

Le projet n'a plus qu'une seule version de référence : la branche `main` du dépôt `doroosee45-lang/agrikonnect`, commit `ee417a6`. Cette version est publiée sur Render (API + site web) et c'est aussi la copie de travail locale.

- **En ligne** : API `https://agrikonnect-api.onrender.com` et site `https://agrikonnectweb.onrender.com`, branchés sur Supabase **Production**.
- **Contenu** : backend, web et mobile complets, dont la traduction FR/EN centralisée et le blog.
- **Tests** : 1 374 tests backend sur 1 374 passent (sans base), migrations et RLS vérifiées, web et mobile compilent.
- **Pas encore fait** : les tests d'authentification sur la version en ligne, avec un compte dédié aux essais.
- **Mode prudent** : déploiement manuel, tâches planifiées et temps réel coupés, SMS et e-mails en mode `console`.

## Version de référence

`main` @ `ee417a6` est la seule branche du dépôt, sur GitHub comme en local ; toutes les branches de travail ont été fusionnées puis supprimées.

- Dépôt : `https://github.com/doroosee45-lang/agrikonnect` (public).
- CI : workflow `.github/workflows/backend-migrations.yml`, job `migrations-and-rls`, lancé sur chaque PR et chaque push sur `main`. Dernier résultat sur `main` : vert.
- Branche `main` : non protégée sur GitHub (protection recommandée, voir Règles de travail).

| Date | PR | Commit de fusion | Contenu |
| --- | --- | --- | --- |
| 15/11/2026 | #2 | `ee417a6` | Contrôle CI des privilèges `anon` / `authenticated` (aucun fichier modifié : déjà inclus par #5) |
| 15/11/2026 | #5 | `88ffce7` | Version locale de référence : i18n web/mobile, blog, correctifs backend et tests, rapports (591 fichiers) |
| 15/11/2026 | #4 | `05900c1` | Correctif web : le champ « Nom » ne déborde plus du formulaire d'inscription |
| 15/11/2026 | #3 | `662454f` | `render.yaml` + mode matériel `HARDWARE_MODE=NONE` + tests |
| 15/11/2026 | #1 | `e9d6996` | CI : contrôle des migrations, de la RLS et du drift Prisma |
| — | — | `7b8fda2` | Première version du projet |

Aucun force-push ni réécriture d'historique n'a été fait.

## Application en ligne

Deux services Render, créés à la main dans le tableau de bord, déploient `main` ; le mobile (Expo) n'est pas hébergé et doit pointer vers la même API.

| Service | Type | Root Directory | Build | Démarrage / publication | Contrôle |
| --- | --- | --- | --- | --- | --- |
| `agrikonnect-api` | Web Service Node 22 | `backend` | `npm ci --omit=dev && npx --yes prisma@5.22.0 generate` | `node src/server.js` (écoute `$PORT` sur `0.0.0.0`) | Health check `/api/v1/health` |
| `agrikonnectweb` | Static Site | `apps/web` | `npm ci && npm run build` | publie `dist` ; rewrite `/*` → `/index.html` | — |

- Branche source : `main`. Auto-déploiement : **désactivé** (consigne donnée) : chaque mise en ligne = Manual Deploy.
- `render.yaml` (racine) décrit ces deux services mais **n'a pas servi à les créer**. Ne pas l'appliquer en Blueprint : Render créerait des doublons.
- Aucune migration, aucun seed, aucun SQL dans les commandes de build ou de démarrage.
- Mobile : renseigner `EXPO_PUBLIC_API_BASE_URL=https://agrikonnect-api.onrender.com/api/v1` et `EXPO_PUBLIC_REALTIME_URL` au build ; aucun changement de code requis.

**Variables du service API** (valeurs dans Render uniquement, jamais dans le dépôt)

| Variable | Valeur ou nature |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `HARDWARE_MODE` | `NONE` |
| `SIMULATION_ENABLED` | `false` |
| `JOBS_ENABLED` | `false` (premiers essais) |
| `REALTIME_ENABLED` | `false` (premiers essais) |
| `LOG_LEVEL` | `info` |
| `CORS_ORIGIN`, `PUBLIC_WEB_URL` | `https://agrikonnectweb.onrender.com` |
| `SMS_PROVIDER`, `EMAIL_PROVIDER` | `console` (codes visibles dans les journaux Render) |
| `DATABASE_URL`, `DIRECT_URL` | secret : connexions Postgres Supabase (pooler / directe) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | secret : projet Supabase, Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | secret : côté serveur uniquement |
| `MFA_ENCRYPTION_KEY` | secret : chiffrement des secrets TOTP (voir Risques) |

**Variables du site web** (lues au build, non secrètes) : `NODE_VERSION=22`, `VITE_API_BASE_URL=https://agrikonnect-api.onrender.com/api/v1` (avec `/api/v1`), `VITE_REALTIME_URL=https://agrikonnect-api.onrender.com`. Toute modification impose un **Clear build cache & deploy**.

## Travaux réalisés

Cinq chantiers sont terminés et intégrés à `main` ; le détail des audits et de l'i18n est dans les dossiers `AUDIT_*` et `CORRECTIONS_I18N/`.

1. **Audits** backend, web et mobile : rapports, inventaires et plans de correction dans `AUDIT_BACKEND/`, `AUDIT_FRONTEND/`, `AUDIT_MOBILE/`.
2. **Traduction FR/EN centralisée** (web + mobile)
    - Dictionnaires uniques `apps/web/src/i18n/ui.fr.ts` / `ui.en.ts` et `apps/Mobile/src/i18n/ui.fr.ts` / `ui.en.ts`, types dans `ui.types.ts`.
    - `useI18n()` : `t` change d'identité avec la langue ; les constantes de module utilisent des getters + `tr()`. Les `useMemo` qui produisent des libellés doivent avoir `t` dans leurs dépendances.
    - `useLocaleSync` envoie `PATCH /me {locale}` ; le choix de l'appareil prime sur le profil.
    - Backend : messages traduits dans `backend/src/shared/i18n/` (doc `backend/docs/I18N.md`).
    - Contrôle : `node scripts/i18n/check-i18n.mjs`. Rapport : `CORRECTIONS_I18N/RAPPORT_CORRECTIONS_I18N.md` + annexes A (traductions) et B (fichiers modifiés).
3. **Mode matériel `NONE`** (`backend/src/config/hardware.js`)
    - `HARDWARE_MODE=NONE` permet de démarrer en production sans matériel ; l'ingestion IoT répond alors **403** (`iot.service.js`).
    - `SIMULATION` reste refusé en production ; `REAL` ne s'active que dans le fichier, jamais par l'environnement ; toute autre valeur arrête le démarrage.
    - Tests de non-régression dans `backend/tests/hardware.test.mjs` (démarrage hors processus, refus d'ingestion avant tout accès base).
4. **Formulaire d'inscription** : le composant `Input` (`apps/web/src/components/ui/Field.tsx`) prend la largeur de sa colonne ; Prénom / Nom côte à côte, empilés sur mobile ; libellé `ui.lastName` (« Last name »).
5. **Publication** : `render.yaml`, création des deux services Render, CI de contrôle des migrations, de la RLS, des privilèges `anon` / `authenticated` et du drift (`backend/scripts/check-migrations.mjs`).

Sécurité du dépôt : des valeurs réelles (mot de passe de la base, clé anon) présentes dans un `backend/.env.example` local ont été remplacées par des gabarits **avant** tout commit ; une recherche par motifs ne trouve aucun identifiant réel dans l'historique publié. Le blog utilise la table `BlogPost`, déjà présente dans le schéma : aucune migration n'a été nécessaire.

## Vérifications exécutées

Tout ce qui suit a été réellement exécuté le 15/11/2026 ; l'authentification sur la version en ligne n'a **pas** encore été testée.

| Vérification | Où | Résultat |
| --- | --- | --- |
| Suite backend `npm run test:dbless` (valeurs factices, sans base) | local, Windows | 1 374 / 1 374 réussis |
| `npm run check:migrations` (PostgreSQL jetable) | local | 21 migrations, RLS sur 102 tables, aucun privilège `anon` / `authenticated`, aucun drift Prisma |
| CI `migrations-and-rls` | GitHub, `main` | vert |
| Build web + `check-i18n.mjs` | local | build OK ; 0 erreur, 2 avertissements |
| Typage mobile `npm run typecheck` | local | OK |
| Bascule de langue (clic EN dans le footer, 137 routes, sans rechargement) | navigateur Chrome | 137 / 137 en anglais ; seul « Français » reste, nom de la langue dans les sélecteurs (voulu) |
| Formulaire d'inscription à 1 280 px et 360 px | navigateur Chrome | aucun champ hors du cadre |
| Démarrage en production (`NODE_ENV=production`, `HARDWARE_MODE=NONE`) | local, valeurs factices | démarre ; tâches planifiées désactivées |
| `GET /api/v1/health` | en ligne | 200 |
| `POST /api/v1/iot/ingest` | en ligne | 403 (refus attendu) |
| `GET /api/v1/me` sans jeton | en ligne | 401 |
| `GET /api/v1/public/blog-posts` | en ligne | 200 |
| Prérequête CORS `OPTIONS /api/v1/auth/login` depuis le site | en ligne | 204, origine `agrikonnectweb` autorisée |
| Bundle du site en ligne | en ligne | appelle `…/api/v1`, contient la traduction |

Aucune tentative de connexion n'a été faite en ligne : même un échec écrit des traces dans la base de production.

## Règles de travail

Toute modification passe par une petite branche, une PR vers `main` avec la CI verte, puis un déploiement manuel ; aucune version ne doit vivre hors de `main`.

1. Partir de la dernière version : `git switch main` puis `git pull`.
2. Créer une branche courte et ciblée : `git switch -c <sujet>`.
3. Modifier, tester localement, puis `git add`, `git commit`, `git push -u origin <sujet>`.
4. Ouvrir une PR vers `main` ; attendre `migrations-and-rls` au vert.
5. Fusionner (Merge), puis supprimer la branche.
6. Render : Manual Deploy du service touché (`agrikonnect-api` pour `backend/`, `agrikonnectweb` pour `apps/web/`).
7. Revenir sur `main` en local : `git switch main` puis `git pull`.

**Interdits**

- Aucun secret dans le dépôt, `render.yaml`, les journaux ou les rapports ; secrets uniquement dans l'onglet Environment de Render. Ne jamais utiliser « Add from .env ».
- Aucun force-push, `reset` destructif ni réécriture d'historique.
- Aucune migration, seed, `prisma migrate deploy`, `db push` ni SQL depuis les commandes de build ou de démarrage. Toute migration sur Supabase Production = décision explicite du propriétaire.
- Ne pas rejouer la migration `20261031020000_revoke_anon_authenticated_grants`, déjà appliquée.
- Aucun test d'écriture en production sans compte dédié aux essais ; jamais de JWT ni de mot de passe collé dans un chat ou un rapport.

**Recommandé** : protéger `main` dans GitHub (PR obligatoire, check `migrations-and-rls` requis, sans approbation obligatoire tant qu'il n'y a qu'un développeur).

## Risques et points d'attention

Le risque principal est que l'application en ligne écrit dans Supabase **Production** avec des identifiants dont la rotation a été reportée (risque accepté par le propriétaire).

| Risque | Impact | Mesure en place ou à prendre |
| --- | --- | --- |
| Supabase Production utilisé pour les essais | toute écriture touche les vraies données | compte dédié aux essais ; jobs et temps réel coupés ; déploiement manuel |
| Rotation des secrets reportée ; le mot de passe de la base a figuré en clair dans un `.env.example` local et dans une sortie de session (jamais dans GitHub) | fuite possible hors dépôt | changer le mot de passe de la base, puis mettre à jour `DATABASE_URL` / `DIRECT_URL` dans Render |
| `MFA_ENCRYPTION_KEY` différente de la clé d'origine | comptes MFA existants bloqués | reprendre la clé du `.env` ; si elle est vide et que `mfa_secrets` contient des lignes, utiliser la valeur de `SUPABASE_SERVICE_ROLE_KEY` (repli utilisé hors production) |
| Privilèges par défaut `EXECUTE` sur les **fonctions** futures non révoqués pour `anon` / `authenticated`, et non couverts par la CI | une fonction ajoutée dans `public` serait appelable via `/rest/v1/rpc` | nouvelle migration `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS` + étendre `check-migrations.mjs` (à valider) |
| `/api/v1/health` ne teste pas la base | Render peut afficher « live » avec Supabase injoignable | vérifier les journaux ; envisager un check base séparé |
| `JOBS_ENABLED` et `REALTIME_ENABLED` à `false` | ni expirations, purges, relances SMS, ni temps réel | réactiver après validation des essais |
| SMS / e-mails en `console` | aucun message réel n'est envoyé | configurer un fournisseur avant toute ouverture aux utilisateurs |
| Stockage géospatial `local` par défaut | fichiers perdus à chaque redéploiement (disque Render éphémère) | passer `GEOSPATIAL_STORAGE_DRIVER` sur `s3` / objet avant usage réel |
| Offre Render gratuite | mise en veille après 15 min, premier appel environ 50 s | offre payante avant production réelle |
| `check:env` : 8 écarts hérités (`JOB_ALERT_FAILURES`, `SETTINGS_SECRET_KEY` non documentées ; `CLOUDINARY_*`, `CONTACT_EMAIL`, `MAIL_FROM`, `RESEND_API_KEY` documentées mais inutilisées) | documentation de configuration incomplète | nettoyer `backend/.env.example` |
| 8 erreurs JavaScript connues côté web (date invalide du blog ; pages de vérification producteur / organisation) | pages partiellement en erreur | antérieures à l'i18n ; à corriger |

## Prochaines étapes

La priorité immédiate est de tester l'authentification sur la version en ligne avec un compte dédié aux essais.

- [ ] Créer un compte d'essai sur `https://agrikonnectweb.onrender.com/auth/register` (adresse réservée aux tests, jamais un vrai utilisateur).
- [ ] Lire le code de vérification dans les journaux Render de `agrikonnect-api` (fournisseurs en `console`).
- [ ] Tester : connexion valide, mauvais mot de passe, session conservée après rechargement, rafraîchissement de session, `GET /me`, déconnexion, mot de passe oublié, bascule FR/EN.
- [ ] Consigner chaque résultat (OK / capture + message), sans jeton ni mot de passe.
- [ ] Protéger `main` dans GitHub.
- [ ] Construire le mobile avec `EXPO_PUBLIC_API_BASE_URL` pointant sur l'API officielle et le tester.
- [ ] Corriger les 8 erreurs JavaScript web connues et nettoyer les 8 écarts de `check:env`.

**Décisions attendues du propriétaire**

- Date de rotation des secrets (mot de passe de la base, clés Supabase).
- Valeur de `MFA_ENCRYPTION_KEY` selon l'état de la table `mfa_secrets`.
- Migration de révocation des privilèges par défaut sur les fonctions.
- Moment de réactiver `JOBS_ENABLED`, `REALTIME_ENABLED` et de brancher les vrais fournisseurs SMS / e-mail.
- Passage à une offre Render payante et à un stockage géospatial persistant avant ouverture au public.

## Annexe : fichiers clés et commandes

| Fichier | Rôle |
| --- | --- |
| `render.yaml` | Description des deux services Render (référence, non appliquée en Blueprint) |
| `backend/src/config/env.js` | Schéma des variables d'environnement (Zod) |
| `backend/.env.example` | Liste documentée des variables, sans valeurs réelles |
| `backend/src/config/hardware.js` | Configuration matériel, `resolveHardwareMode`, garde de démarrage |
| `backend/src/server.js` | Démarrage, port `$PORT`, Socket.IO, planificateur |
| `backend/scripts/check-migrations.mjs` | Contrôle CI : migrations, RLS, privilèges, drift |
| `.github/workflows/backend-migrations.yml` | CI GitHub `migrations-and-rls` |
| `apps/web/src/lib/config.ts` | URL de l'API côté web (`VITE_API_BASE_URL`) |
| `apps/Mobile/src/lib/config.ts` | URL de l'API côté mobile (`EXPO_PUBLIC_API_BASE_URL`) |
| `apps/web/src/i18n/`, `apps/Mobile/src/i18n/` | Dictionnaires et moteur de traduction |
| `scripts/i18n/check-i18n.mjs` | Contrôle de cohérence des traductions |

```bash
# Backend (dossier backend/)
npm run check               # l'application se charge
npm run check:migrations    # migrations + RLS + privilèges + drift (PostgreSQL jetable)
npm run check:env           # cohérence .env.example / code
npm run test:dbless         # suite de tests sans base

# Web (dossier apps/web/)
npm run build

# Mobile (dossier apps/Mobile/)
npm run typecheck

# Traductions (racine)
node scripts/i18n/check-i18n.mjs
```
