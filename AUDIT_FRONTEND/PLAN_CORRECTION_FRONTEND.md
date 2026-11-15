# Plan de correction du frontend — AGRIKONNECT AFRICA (application web)

> **Statut : proposition soumise à validation.** Aucune de ces corrections n'est appliquée. Chaque action renvoie à une anomalie de [RAPPORT_AUDIT_FRONTEND.md](RAPPORT_AUDIT_FRONTEND.md). Les chemins sont relatifs à `apps/web/`.

## 0. Principes d'exécution

1. **Filet de sécurité d'abord.** Réparer les tests (FE-M19, tâche 0.1), puis écrire pour chaque correction un test qui échoue avant et passe après.
2. **Une anomalie, une branche, une revue.** Les phases 0 et 1 sont livrables indépendamment.
3. **Aucune modification du backend dans ce plan.** Les besoins backend sont listés en §6 et doivent passer par le plan backend (`AUDIT_BACKEND/PLAN_CORRECTION_BACKEND.md`).
4. **Ordre logique.** Socle de session → navigation → sécurité de l'interface → fonctionnalités → qualité et i18n → finition.

Estimation globale : **environ 45 à 60 jours-personne** pour un développeur senior React, dont environ 15 jours pour l'extraction i18n complète.

---

## Phase 0 — URGENTES (environ 4 à 5 j)

Ces corrections conditionnent toute utilisation réelle.

### 0.1 Rétablir les tests et ajouter une CI minimale — FE-M19
- **Cause :** `tests/setup.ts` ne simule pas `window.matchMedia`, alors que `design-system/hooks/useBreakpoint.ts:19` et `hooks/useReveal.ts:12` en dépendent. Par ailleurs, `tests/hero-carousel.test.tsx` rend des `<Link>` hors routeur.
- **Fichiers :** `tests/setup.ts`, `tests/hero-carousel.test.tsx`, `package.json` (scripts).
- **Correction :**
  - simuler `matchMedia` ;
  - envelopper les rendus dans `MemoryRouter` ;
  - ajouter les scripts `"test": "vitest run"` et `"lint"` (ESLint + `eslint-plugin-react-hooks` + `jsx-a11y`) ;
  - déplacer les dépendances de test en `devDependencies` (FE-F04).
- **Dépendances :** aucune.
- **Risques :** faible. Le lint fera apparaître de nombreux avertissements ; commencer en mode avertissement.
- **Tests :** `npm test` vert ; CI exécutant `typecheck`, `test` et `build`.

### 0.2 Corriger le rejeu après rafraîchissement — FE-C01 (CRITIQUE)
- **Cause :** `replay()` renvoie `response.data` alors que `request()` attend une `AxiosResponse` (`services/http.ts:93-105,113-118,130-138`).
- **Correction :** remplacer `return replay(config)` par :
  ```ts
  config.headers.set('Authorization', `Bearer ${token}`);
  return http.request(config); // _retried=true empêche une boucle
  ```
  puis supprimer `replay()`. Les erreurs du rejeu repassent ainsi par l'intercepteur et deviennent des `RequestError`.
- **Dépendances :** 0.1.
- **Risques :** boucle infinie si `_retried` n'est pas conservé. À couvrir par un test.
- **Tests :**
  - unitaire avec un adaptateur simulé : 401 → rafraîchissement → 200 renvoie `{data, meta}` identiques au cas nominal ;
  - 401 → rafraîchissement → 401 déclenche `onSessionLost` sans boucle ;
  - E2E : jeton expiré puis rechargement de `/admin/dashboard`, qui affiche les permissions réelles.

### 0.3 Sécuriser la persistance de session — FE-E01, FE-F01
- **Fichiers :** `services/session.ts:23-47,124-146`, `lib/secure-storage.ts`, `store/auth.ts`.
- **Correction, étape 1 (frontend seul) :**
  - jeton d'accès en mémoire ;
  - jeton de rafraîchissement en `sessionStorage` **uniquement** ;
  - supprimer toutes les écritures `localStorage` de jetons ;
  - profil mis en cache sans données sensibles ;
  - nettoyer les clés héritées présentes chez les utilisateurs (migration au démarrage) ;
  - effacer `pendingMfa` à la sortie de `/auth/login` et après expiration.
- **Correction, étape 2 (avec le backend, §6) :** jeton de rafraîchissement en cookie `HttpOnly; Secure; SameSite=Strict` et suppression de son stockage côté JS.
- **Risques :** les utilisateurs devront se reconnecter à chaque ouverture de navigateur. C'est un choix produit à valider, en contrepartie de la sécurité.
- **Tests :** après fermeture et réouverture, aucun jeton dans `localStorage` ; un test unitaire vérifie que `logout()` efface tout.

### 0.4 Organisation active fiable — FE-E03
- **Fichiers :** `lib/redirects.ts:103-163`, `services/http.ts:61-64`, `store/auth.ts:55-58,145-154`, `components/layout/AppLayout.tsx:112-126,264-277`.
- **Correction :**
  1. `logout()` et le gestionnaire de perte de session appellent `setActiveOrganizationId(null)`.
  2. L'intercepteur n'envoie `X-Organization-Id` que si l'identifiant figure dans `useAuthStore.getState().user.organizations`.
  3. La règle par défaut est unique et appliquée partout : `activeOrganizationId` renvoyé par `/me` (cf. `MeResult`), sinon la règle backend (`INDIVIDUAL`, puis la première).
  4. Le sélecteur d'organisation reste visible sous 768 px, dans le tiroir.
- **Dépendances :** 0.3.
- **Risques :** interactions avec `getUserInitialRoute`. Les 29 tests de `scripts/redirects.test.mjs` doivent rester verts et être complétés.
- **Tests :** scénario A puis B sur le même navigateur ; un compte à 2 organisations sur un écran de 375 px peut changer d'organisation.

### 0.5 Réparer les liens cassés — FE-E04
- **Fichiers :**
  - `pages/app/Messages.tsx:90` → `/app/messages/${id}` ;
  - `pages/market/ListingDetail.tsx:32` → `/app/messages/${conversation.id}`, avec l'identifiant renvoyé par `listingApi.contact` ;
  - `pages/app/Orders.tsx:72` → `/app/orders/${id}` ;
  - `pages/app/Dashboard.tsx:207,253` → `/app/verification` ;
  - liens vers des écrans inexistants (`farmer/index.tsx:173,202,325,360`, `farmer/Projects/DataRoom.tsx:36`, `organization/index.tsx:123,220,231,293,301`, `organization/Overview.tsx:59,130,142`) : retirer, ou remplacer par la route existante la plus proche, ou par un état « Bientôt disponible » non cliquable.
- **Correction structurelle :** module `lib/routes.ts` avec des constructeurs typés (`routes.app.message(id)`), utilisés partout.
- **Tests :** test automatisé de confrontation liens ↔ routes (le script d'audit `links.mjs` peut servir de base) intégré à la CI.

### 0.6 Espace vérificateur — FE-E05 (partie frontend)
- **Fichiers :** `pages/reviewer/Checklist.tsx:54-58,70`, `pages/reviewer/Missions.tsx:31`, `lib/redirects.ts:50-96`.
- **Correction :**
  - `limit` à 100 au plus, avec pagination, ou chargement de la vérification unitaire (route backend à prévoir, §6) ;
  - corriger le commentaire et le filtre de statut ;
  - aligner `ESPACE_PAR_ROLE` sur la matrice backend : ne plus envoyer AGRONOMIST et LAB_PARTNER vers un écran en 403 ;
  - ajouter VERIFIER, COUNTRY_ADMIN et DATA_STEWARD avec une destination validée par le métier.
- **Dépendances :** décision métier « qui instruit les vérifications » et éventuelle évolution des permissions backend.
- **Tests :** ADMIN approuve une mission ; table de destination testée pour les 19 rôles.

### 0.7 Configuration de production — FE-M12
- **Fichiers :** `lib/config.ts:8-20`, `vite.config.ts`, `.env.example`.
- **Correction :** en mode `production`, échec du build si `VITE_API_BASE_URL` est vide ; plus aucun repli sur `localhost`. Corriger la documentation de `VITE_REALTIME_URL` (Socket.IO du backend, chemin `/realtime`).
- **Tests :** un build de production sans variable échoue ; avec les variables, il réussit.

---

## Phase 1 — PRIORITAIRES (environ 12 à 15 j)

### 1.1 Internationalisation : socle — FE-E02 (début)
- **Fichiers :** `i18n/index.ts`, `App.tsx`, `index.html`, `components/layout/*`.
- **Correction :**
  - appeler `useI18nStore.getState().hydrate()` avant le premier rendu (dans `main.tsx`) ;
  - synchroniser `document.documentElement.lang` sur `locale` ;
  - sélecteur de langue dans l'en-tête et dans la barre d'espace ;
  - envoyer `Accept-Language` (déjà fait) ;
  - remplacer les ternaires `locale === 'fr' ? …` du pied de page par des clés ;
  - règle ESLint `i18next/no-literal-string` (ou équivalent) en mode avertissement.
- **Tests :** choix EN puis rechargement : EN conservé ; attribut `lang` correct.
- La suite (extraction complète) se fait en phase 2, tâche 2.1.

### 1.2 Garde de permission et écran 403 — FE-M01
- **Fichiers :** `App.tsx`, nouveau `components/ui/RequirePermission.tsx`, `components/layout/AppLayout.tsx:128-144`.
- **Correction :**
  - table route → permission, à partir de la spécification §5.1 et des permissions backend ;
  - écran 403 explicite ;
  - le menu admin est **vide** (et l'espace inaccessible) sans permission `admin.*`. Supprimer les replis `return espace.groupes` (`AppLayout.tsx:133,143`).
- **Risques :** la garde doit attendre la fin du chargement des permissions, ce qui suppose 0.2 corrigé.
- **Tests :** FARMER sur `/admin/users` voit le 403 ; ADMIN voit l'écran ; le menu est filtré.

### 1.3 Démarrage, retour après connexion et déconnexion — FE-M02, FE-M03
- **Correction :**
  - `AuthGate` affiche un squelette pendant `booting` ;
  - paramètre `?next=` limité aux chemins internes (`startsWith('/') && !startsWith('//')`) ;
  - menu compte avec « Se déconnecter » dans `Header` et dans la barre de `AppLayout`.
- **Tests :** aucun flash au rechargement ; lien profond conservé ; déconnexion accessible partout.

### 1.4 Résilience de session et temps réel — FE-M04, FE-M05
- **Fichiers :** `services/session.ts:112-114`, `services/realtime.ts:57-73`, `App.tsx:208-216`.
- **Correction :**
  - ne vider la session que sur un 401 ou 403 du rafraîchissement ;
  - `auth` du socket sous forme de fonction, qui lit le jeton courant à chaque reconnexion ;
  - ne pas connecter le temps réel en mode « profil en cache » sans jeton valide.
- **Tests :** coupure réseau pendant le rafraîchissement ; expiration suivie d'une reconnexion du socket.

### 1.5 Données fictives et pages publiques — FE-E08, FE-E07, FE-M20
- **Correction :**
  - supprimer les 40 `bars: […]` et le défaut de `HorizonDashboard.tsx:979`. Si une tendance est souhaitée, la calculer depuis des séries réelles (§6) ;
  - retirer `public` de `MarketPublic`, ou attendre une route publique d'annonces ;
  - signaler « Réservé aux membres » sur les entrées « Marché » et « Données » et sur les liens de la barre « Conseils agricoles » ;
  - remplacer `/public/lots/demo` par un champ de recherche de lot.
- **Tests :** E2E anonyme sur toutes les entrées du `Header` et du `Footer` ; aucune réponse 401, 403 ou 422.

### 1.6 Corrections de contrat ponctuelles — FE-M08, FE-M07, FE-E09 (interface)
- `admin/Producers.tsx:14-15` : remplacer `role: 'PRODUCER'` par un filtre par type d'organisation.
- `admin/Reports.tsx:46` et `precisionApi.pdfUrl` : téléchargement authentifié via `http.get(…, { responseType: 'blob' })`.
- `farmer/Lots/Detail.tsx:26` : utiliser `API_BASE_URL`. Masquer le bouton QR tant que la route backend n'existe pas (§6).
- `auth/Register.tsx:17,19` : retirer AGRONOMIST et SUPPORT_AGENT de l'inscription ; ajouter le consentement CGU (FE-F09).
- **Tests :** écran Producteurs affiché ; CSV téléchargé ; l'inscription ne propose que des rôles non sensibles.

### 1.7 Confirmation des actions sensibles — FE-M09
- **Correction :** composant `ConfirmDialog` (`role="alertdialog"`, focus piégé, Échap) avec rappel du motif. L'appliquer à : suppression et suspension de compte, révocation de rôle et de sessions, révocation de clé API, retrait de consentement, suppression d'article, annulation d'offre groupée, rappel de lot.
- **Tests :** « Annuler » n'émet aucune requête ; « Confirmer » émet la requête une seule fois.

---

## Phase 2 — IMPORTANTES (environ 20 à 28 j)

### 2.1 Extraction i18n complète — FE-E02 (suite)
- **Ordre :**
  1. coquilles (`Header`, `Footer`, `AppLayout`, `Sidebar`, `space-nav`) ;
  2. composants partagés (`ResourcePage`, `DetailPage`, `States`, `AuthGate`) ;
  3. authentification ;
  4. public ;
  5. espaces métier par ordre d'usage.
- **Méthode :** espaces de noms par domaine (`admin.*`, `farmer.*`…) ; messages d'erreur via `RequestError.kind` et `errors.*` ; formats via `useI18n().locale` (supprimer les 16 `'fr-FR'` codés en dur).
- **Effort :** environ 2 020 chaînes, soit environ 12 à 15 j avec relecture anglaise.
- **Tests :** script d'inventaire des chaînes en dur égal à 0 ; parité garantie par le type `Dictionary` ; revue linguistique.

### 2.2 Brancher les fonctionnalités manquantes — FE-E06, FE-M17
Lots proposés, par valeur métier. Chaque lot = écran, formulaire, validation, états, test.

| Lot | Contenu | Fonctions client |
|---|---|---|
| A | Compte : changement de mot de passe, préférences de notification | `authApi.changePassword`, `notificationApi.preferences/setPreferences` |
| B | Producteur : édition, suppression, publication d'exploitation et de parcelle ; saisie de production | `farmApi.*`, `plotApi.*`, `productionApi.*` |
| C | Sol : diagnostic par le moteur, historique, analyses | `geoApi.*`, `soilApi.*` |
| D | Marché : offres, avis, litiges, paiement, stock | `requestApi.*`, `reviewApi.*`, `orderApi.*`, `inventoryApi.*` |
| E | Transport : cycle complet | `transportApi.*` |
| F | Coopérative : membres, offres groupées | `cooperativeApi.*` |
| G | Investissement et data room | `investApi.*`, `projectDataApi.*` |
| H | Médias : téléversement (URL signée, PUT, confirmation), contrôles type et taille | `mediaApi.uploadUrl/confirm` |
| I | Public : contact d'un producteur | `publicApi.contactFarm` |

- **Dépendances :** lot H avant les écrans qui joignent des fichiers. Le lot G dépend des correctifs backend H-05 (data room).
- **Risques :** volume important ; prioriser avec le métier. Supprimer ce qui ne sera pas fait.

### 2.3 Pagination, tri, recherche — FE-M06
- **Correction :** `ResourcePage` gère `page/limit`, `meta.total` et le tri, avec un délai de saisie de 300 ms. Le texte « N renvoyé(s) » est remplacé par « N sur Total ». Limiter `limit` à 100 au plus partout.
- **Tests :** jeu de 150 éléments ; total exact ; une seule requête après la saisie.

### 2.4 Accessibilité — FE-M10
- **Correction :**
  - lien d'évitement ;
  - focus visible (`:focus-visible`) sur `Input`, `TextArea` et `Button`, en supprimant `outline: 'none'` (`Field.tsx:31,79`) ;
  - `aria-invalid` et `aria-describedby` reliés aux erreurs ;
  - `role="alert"` sur `ErrorState` ;
  - remplacer `<Link><Button/></Link>` par un `Button` polymorphe (`as={Link}`) ;
  - bouton pause du carrousel ;
  - dimensions des images.
- **Tests :** axe-core en CI (0 violation sérieuse) ; parcours clavier sur la connexion, l'inscription et une liste.

### 2.5 Responsive — FE-M11
- **Correction :**
  - grilles de formulaire fluides ;
  - une seule échelle de points de rupture (celle de `theme/index.ts` `BREAKPOINT`) ;
  - tiroir sous 1 024 px (spécification §4.2) ;
  - tableaux transformés en cartes sous 640 px.
- **Tests :** captures de régression visuelle à 320, 375, 768, 1 024 et 1 440 px.

### 2.6 Gestion des erreurs — FE-M13
- **Correction :**
  - messages traduits par `kind` ;
  - erreurs de champ affichées sous les champs (`RequestError.fields`) ;
  - frontière d'erreur réinitialisée à chaque navigation ;
  - outil de suivi d'erreurs côté client, après validation de la conformité des données.
- **Tests :** 422 avec erreur sous le bon champ ; coupure réseau affichant un message traduit.

---

## Phase 3 — AMÉLIORATIONS (environ 8 à 12 j)

| # | Action | Anomalies | Tests |
|---|---|---|---|
| 3.1 | Système de design unique : choisir entre `components/ui` + `theme` et `design-system` ; migrer `kit.tsx` ; réduire les styles en ligne ; trancher sur Tailwind (spécification §4.1) | FE-M14 | Revue visuelle ; un seul module importé |
| 3.2 | Fusionner les pages dupliquées `/app/*` et `/farmer/*`, avec redirections | FE-M15 | Anciennes URL redirigées |
| 3.3 | Performance des images et polices : diapositives courante et suivante seulement, WebP/AVIF + `srcset`, polices auto-hébergées, sonde `/health` réservée à l'admin | FE-M16, FE-F13 | Lighthouse mobile : LCP < 2,5 s |
| 3.4 | Formats monétaires : pas de XOF implicite, décimales par devise, locale dynamique | FE-M18 | Tests unitaires de `lib/format.ts` |
| 3.5 | Typage des contrats : types de charge utile par endpoint, générés depuis l'OpenAPI backend | FE-F06 | `tsc` strict, sans `as any` |
| 3.6 | Nettoyage : `AdminSidebar.tsx`, `lib/faq.ts`, fonctions API non retenues, cycle `ui/index` ↔ `AuthGate`, `X-Client`, `IS_NATIVE`, `noUnusedLocals: true` | FE-F02, FE-F03, FE-F04 | `tsc` + lint |
| 3.7 | Textes : supprimer le jargon technique (« GET /… », « renvoyé par l'API »), vouvoiement, rendu Markdown assaini du blog, pied de page « newsletter » honnête | FE-F07, FE-F08, FE-F11 | Revue éditoriale |
| 3.8 | Durcissement : `vite.config.ts` (`allowedHosts`), CSP et `referrer` documentés pour l'hébergeur, README à jour | FE-F05, FE-F10, FE-F12 | Revue de configuration |

---

## 4. Ordre d'exécution et dépendances

```
0.1 Tests/CI ─┬─▶ 0.2 Rejeu (CRITIQUE) ─▶ 0.3 Session ─▶ 0.4 Organisation active
              │                                   └──▶ 1.4 Résilience + temps réel
              ├─▶ 0.5 Liens ─▶ (lib/routes.ts) ─▶ 3.2 Fusion des pages
              ├─▶ 0.6 Vérificateur (+ décision métier, + backend)
              └─▶ 0.7 Configuration de production
0.2 ─▶ 1.2 Garde de permission ─▶ 1.3 Démarrage/next/déconnexion
1.1 Socle i18n ─▶ 2.1 Extraction ─▶ 2.6 Erreurs traduites
2.2-H Téléversement ─▶ 2.2 lots B, D, E, G
2.3 Pagination ─▶ 2.5 Tableaux responsives
3.1 Système de design : après 2.4 et 2.5 (évite de migrer deux fois)
```

## 5. Synthèse par priorité

| Phase | Contenu | Anomalies | Charge estimée |
|---|---|---|---|
| 0 — Urgentes | Tests, rejeu, session, organisation, liens, vérificateur, configuration | FE-C01, E01, E03, E04, E05, M12, M19, F01 | 4–5 j |
| 1 — Prioritaires | Socle i18n, permissions, démarrage et déconnexion, résilience, données fictives, pages publiques, contrats, confirmations | E02 (socle), E07, E08, E09, M01, M02, M03, M04, M05, M07, M08, M09, M20 | 12–15 j |
| 2 — Importantes | Extraction i18n, fonctionnalités manquantes, pagination, accessibilité, responsive, erreurs | E02, E06, M06, M10, M11, M13, M17 | 20–28 j (dont 2.2 selon le périmètre retenu) |
| 3 — Améliorations | Système de design, fusion, performances, formats, typage, nettoyage, textes, durcissement | M14, M15, M16, M18, F02–F13 | 8–12 j |

## 6. Prérequis côté backend (hors de ce plan, à porter au plan backend)

| Besoin | Lié à | Référence backend |
|---|---|---|
| Jeton de rafraîchissement en cookie `HttpOnly` | FE-E01 | `auth.controller` (refresh/login/logout) |
| Interdire l'auto-attribution de SUPPORT_AGENT et AGRONOMIST | FE-E09 | H-01 (`auth.schema.js:21-31`) |
| Clarifier qui détient `verifications.review` ; route `GET /admin/verifications/:id` | FE-E05 | `verification.routes.js:31-40` |
| Routes publiques pour les annonces et indicateurs k-anonymisés, si le produit les veut publics | FE-E07 | `listings.routes.js:14`, `insights.routes.js:20` |
| Route QR de lot `/public/lots/:code/qr.:format` | FE-M07 | `traceability/public.routes.js` |
| Séries temporelles réelles pour les mini-graphiques | FE-E08 | `dashboard`, `invest` |
| Publication d'un contrat OpenAPI pour générer les types | FE-F06 | `app.js` (index de l'API) |

## 7. Critères de clôture

- [ ] CI verte : `typecheck`, `lint`, `test` (dont les nouveaux tests 0.2 à 0.6), `build`.
- [ ] 0 lien interne cassé (test automatisé).
- [ ] Session maintenue au-delà de 30 min d'usage continu (E2E).
- [ ] Aucun jeton dans `localStorage`.
- [ ] Langue EN persistée et 0 chaîne codée en dur (script d'inventaire).
- [ ] 0 donnée fictive (recherche `bars: \[[0-9]` vide).
- [ ] axe-core : 0 violation « serious » ou « critical » sur 10 écrans de référence.
- [ ] Captures responsives validées à 320, 375, 768, 1 024 et 1 440 px.
- [ ] Rapport « fonctions API inutilisées » limité aux fonctions explicitement reportées.
