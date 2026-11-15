# Rapport d'audit technique du frontend — AGRIKONNECT AFRICA (application web)

| Élément | Valeur |
|---|---|
| Projet audité | **AGRIKONNECT AFRICA**, portail web `agrikonnect-web` 1.0.0 (`apps/web/package.json:2-3`, `apps/web/src/lib/config.ts:22-27`) |
| Périmètre | `apps/web/` : 204 fichiers `.ts/.tsx` dans `src/` (≈ 34 000 lignes), configuration Vite/TypeScript, tests, `dist/` local |
| Hors périmètre | `apps/Mobile/` (client Expo distinct, ≈ 40 000 lignes) et `apps/Mobile_src_backup_20261031_1901/` : **NON COUVERTS**, à auditer séparément |
| Base auditée | **Copie de travail**, non le commit `7b8fda2` : 29 fichiers d'`apps/web` modifiés et 7 non suivis (par ex. `HorizonDashboard.tsx`, `AppErrorBoundary.tsx`, pages Blog) au moment de l'audit. Les numéros de ligne s'appliquent à cette copie de travail |
| Backend de référence | `backend/src/` (contrats de routes, schémas Zod, permissions) ; voir aussi `AUDIT_BACKEND/` |
| Date | 2026-11-14 |
| Nature | Audit statique et contrôles non destructifs. **Aucun fichier du projet n'a été modifié.** |

Documents associés : [PLAN_CORRECTION_FRONTEND.md](PLAN_CORRECTION_FRONTEND.md) · [AUDIT_I18N.md](AUDIT_I18N.md) · [AUDIT_INTEGRATION_API.md](AUDIT_INTEGRATION_API.md) · [INVENTAIRE_FRONTEND.md](INVENTAIRE_FRONTEND.md) · [AUDIT_UI_UX_RESPONSIVE.md](AUDIT_UI_UX_RESPONSIVE.md)

---

## 1. Synthèse

### 1.1 Verdict

**Le frontend web n'est pas prêt pour la production.** La base technique est saine : le typage strict passe, le build réussit, toutes les pages sont chargées à la demande et le client HTTP est centralisé. Les 311 appels API correspondent tous à une route existante du backend. En revanche, plusieurs défauts empêchent l'usage réel.

- **Session :** au bout d'environ 15 minutes, toute session connectée se dégrade. La requête rejouée après un rafraîchissement de jeton renvoie des données vides ; le défaut est reproduit (FE-C01).
- **Langue :** l'internationalisation est pratiquement absente. 9 clés de traduction sont utilisées, contre environ 2 000 textes codés en dur. Le choix de langue n'est pas conservé.
- **Parcours cassés :** la messagerie, le détail de commande, l'espace vérificateur et la page publique « Marché » ne fonctionnent pas.
- **Fonctionnalités absentes :** 45 % des fonctions d'appel API existent mais ne sont reliées à aucun écran. Il manque notamment la saisie de production, le diagnostic de sol, le transport, les litiges, le changement de mot de passe et le téléversement de fichiers.

### 1.2 Décompte des anomalies

| Criticité | Nombre | Identifiants |
|---|---:|---|
| CRITIQUE | 1 | FE-C01 |
| ÉLEVÉ | 9 | FE-E01 → FE-E09 |
| MOYEN | 20 | FE-M01 → FE-M20 |
| FAIBLE | 13 | FE-F01 → FE-F13 |
| INFORMATIONNEL | 8 | FE-I01 → FE-I08 (points conformes ou à noter) |

### 1.3 Les cinq actions les plus urgentes

1. **Corriger le rejeu après rafraîchissement de jeton.** Le défaut se trouve dans `services/http.ts:93-118` (FE-C01).
2. **Revoir la persistance de session.** Les jetons partent dans `localStorage`, et l'organisation active n'est pas purgée à la déconnexion (FE-E01, FE-E03).
3. **Réparer les 18 liens internes cassés et l'espace vérificateur** (FE-E04, FE-E05).
4. **Brancher réellement l'i18n et persister la langue** (FE-E02).
5. **Retirer les mini-graphes à valeurs fictives** (FE-E08), puis traiter la sécurité de l'inscription libre-service avec le backend (FE-E09 / H-01 backend).

---

## 2. Périmètre et méthodologie

### 2.1 Démarche

1. **Arborescence et inventaire.** J'ai inventorié l'arborescence complète de `apps/web/src`, avec des scripts d'inventaire écrits et exécutés **hors du dépôt**, dans le dossier temporaire de session.
2. **Lecture du socle.** J'ai lu individuellement les fichiers structurants :
   - `main.tsx` et `App.tsx` ;
   - `services/*` et `store/auth.ts` ;
   - `i18n/*` ;
   - `lib/*` ;
   - `components/layout/*` et `components/ui/*` ;
   - `components/pages/*` et `design-system/*`.
3. **Contrôle des pages.** Toutes les pages ont été passées en revue par motifs : protection, appels API, mutations, textes, liens. Les pages clés ont été lues en détail : authentification, administration, vérificateur, marché, organisation et tableaux de bord.
4. **Rapprochement avec le backend.** J'ai confronté automatiquement les 311 appels de `services/endpoints.ts` aux routes Express réellement montées (`backend/src/routes/index.js` et les routeurs de modules). J'ai ensuite vérifié manuellement les schémas Zod des cas douteux : limites de pagination, rôles, statuts.
5. **Contrôles exécutés.** Aucun ne modifie le dépôt : l'état `git status` d'`apps/web` est identique avant et après.
   - `tsc --noEmit` ;
   - `vite build` avec sortie redirigée vers le dossier temporaire (`--outDir`) ;
   - `vitest run` ;
   - `node --test scripts/redirects.test.mjs`.
6. **Reproduction isolée du défaut FE-C01.** J'ai reproduit le défaut avec une copie conforme du code et l'`axios` du projet, chargé en lecture seule.
7. **Comparaison à la spécification.** J'ai comparé le code à `apps/web/AGRIKONNECT AFRICA — Spécification fonctionnelle et technique.md` (§4 UX/UI, §5.1) et au `README.md`.

### 2.2 Limites (NON VÉRIFIABLE)

| Élément | Raison |
|---|---|
| Rendu visuel réel, contrastes mesurés, tests sur appareils | Aucun navigateur piloté ni backend démarré dans cette mission ; l'analyse UI repose sur le code (styles, points de rupture, structure) |
| Comportement avec données réelles | Le `.env` du backend pointe vers une base Supabase distante réelle : aucun appel n'a été émis pour ne pas la solliciter |
| Existence d'un lot de code `demo` (FE-M20) | Nécessite une lecture en base |
| En-têtes de sécurité HTTP (CSP, HSTS, Referrer-Policy) | Portés par l'hébergeur, non présents dans le dépôt |
| Poids réseau effectif / Lighthouse | Mesuré uniquement sur la sortie du build (tailles des fichiers) |

### 2.3 Convention

- **Fait vérifié :** constaté dans le code ou par l'exécution, avec la preuve `fichier:ligne`.
- **Hypothèse :** signalée explicitement.
- **Recommandation :** la correction proposée. Elle n'est **pas appliquée**.

Les chemins sont relatifs à `apps/web/` sauf mention contraire.

---

## 3. Architecture du frontend

### 3.1 Pile technique (fait vérifié, `package.json`)

| Couche | Choix |
|---|---|
| Build | Vite 8.3 (Rolldown), `@vitejs/plugin-react` 6, `@tailwindcss/vite` 4.3 |
| Langage | TypeScript 6 strict (`tsconfig.json:7`), alias `@/*` |
| UI | React 19.3, Framer Motion 14, Tailwind 4 (dans `design-system/`) + styles en ligne + `theme/tokens.css` |
| Routage | React Router 7 (`BrowserRouter`, routes à plat dans `App.tsx`) |
| État serveur | TanStack Query 5 (`services/query.ts`) |
| État client | Zustand 5 (`store/auth.ts`, `i18n/index.ts`) |
| HTTP | Axios 1.20, instance unique (`services/http.ts`) |
| Temps réel | socket.io-client 4.8 (`services/realtime.ts`) |
| Tests | Vitest 4 + Testing Library + jsdom (3 fichiers de test) |

### 3.2 Organisation

```
src/
├── main.tsx                 point d'entrée (QueryClientProvider)
├── App.tsx                  173 routes (+ 404), 173 composants React.lazy
├── components/
│   ├── layout/              AppLayout (coquille), Header, Footer, AdminSidebar (mort)
│   ├── pages/               socles génériques : ResourcePage, DetailPage, PlotModule, NotFound
│   ├── ui/                  Button, Card, Chip, Field, States, AuthGate, Text…
│   ├── kit.tsx              2e kit de composants (1 seul importateur)
│   └── hero/                HeroCarousel
├── design-system/           3e système : Sidebar, HorizonDashboard (1 177 l.), Tailwind
├── pages/                   176 fichiers, regroupés par espace métier
├── services/                http, endpoints (311 appels), types (2 395 l.), query, realtime, session
├── store/auth.ts            session applicative (Zustand)
├── i18n/                    fr.ts / en.ts (173 clés), useI18n
├── lib/                     config, format, redirects, space-nav, ulid…
└── theme/                   tokens.css (1 108 l.), agrikonnect.ts, index.ts
```

### 3.3 Flux principal

```
main.tsx ─▶ QueryClientProvider ─▶ App
  App : useEffect(init) ─▶ store/auth.init() ─▶ sessionStore.restore() ─▶ GET /me (+ /me/permissions)
        useEffect(isAuthenticated) ─▶ realtime.connect()
        BrowserRouter ─▶ AppLayout (coquille publique OU coquille « espace » + Sidebar)
                       ─▶ AppErrorBoundary ─▶ Suspense ─▶ Routes (lazy)
Page ─▶ useQuery/useMutation ─▶ services/endpoints.ts ─▶ api.* ─▶ http (intercepteurs)
        ├─ requête : Bearer, X-Organization-Id (localStorage), Accept-Language, Idempotency-Key
        └─ réponse : 401 ─▶ sessionStore.refresh() (une seule promesse) ─▶ replay()
```

### 3.4 Points forts constatés (faits vérifiés)

- **Chargement à la demande.** Les 173 routes (plus la 404) passent toutes par `React.lazy` (`App.tsx:12-198`). Le build produit 194 fragments JS.
- **Client HTTP unique :**
  - enveloppe `success/data/meta` décodée à un seul endroit ;
  - erreur typée `RequestError` (`services/types.ts:46-75`) ;
  - `Idempotency-Key` ULID posé sur les écritures (`services/http.ts:70-72`).
- **Rafraîchissement mono-vol.** Les 401 simultanés partagent la même promesse (`services/session.ts:98-121`).
- **Politique de relance raisonnée.** Pas de relance sur un 4xx (`services/query.ts:18-24`).
- **Clés de cache centralisées** (`services/query.ts:45-283`).
- **Aucune injection HTML.** Aucun `dangerouslySetInnerHTML`, `innerHTML` ni `eval`, et aucun secret dans le code ou le bundle (FE-I05).
- **MFA :**
  - le secret TOTP n'est jamais affiché (`pages/auth/Mfa.tsx:20-28,254-288`) ;
  - les codes de secours ne sont affichés qu'une seule fois.
- **Destination initiale centralisée et testée** (`lib/redirects.ts`, 29/29 tests).

---

## 4. Analyse par module

Les statuts sont ceux de la mission : CONFORME, NON CONFORME, PARTIELLEMENT IMPLÉMENTÉ, NON IMPLÉMENTÉ, NON VÉRIFIABLE, À AMÉLIORER. Le détail par page figure dans [INVENTAIRE_FRONTEND.md](INVENTAIRE_FRONTEND.md).

| Module (dossier) | Pages | Statut | Constats principaux |
|---|---:|---|---|
| Socle (`App`, `services`, `store`) | — | **NON CONFORME** | FE-C01 (rejeu), FE-E01 (stockage), FE-E03 (organisation active), FE-M04/M05 |
| Public (`pages/public`) | 21 | **PARTIELLEMENT IMPLÉMENTÉ** | Carte, annuaire, fiches, blog : branchés. Catalogue de données et agriculture par pays appellent des routes authentifiées (FE-E07). Lien `/public/lots/demo` (FE-M20). Contact producteur public non branché (`publicApi.contactFarm` inutilisé) |
| Authentification (`pages/auth`) | 7 | **À AMÉLIORER** | Connexion, MFA, vérification e-mail/téléphone, mot de passe oublié : fonctionnels. Rôles sensibles en libre-service (FE-E09), pas de consentement CGU (FE-F09), pas de retour à la page demandée (FE-M02) |
| Espace connecté (`pages/app`) | 23 | **PARTIELLEMENT IMPLÉMENTÉ** | Liens messagerie/commandes cassés (FE-E04). Transport : liste seule (création, offres, acceptation non branchées). Pas de changement de mot de passe (FE-E06). Graphiques fictifs (FE-E08) |
| Producteur (`pages/farmer`) | 41 | **PARTIELLEMENT IMPLÉMENTÉ** | Création d'exploitation et de parcelle : oui. Édition, suppression, publication : non. Saisie de production, diagnostic de sol, enregistrement IoT : non (FE-E06). 4 liens cassés (FE-E04) |
| Organisation (`pages/organization`) | 9 | **PARTIELLEMENT IMPLÉMENTÉ** | 7 liens vers des routes inexistantes (`/organization/collection`, `/group-sales`, `/governance`). Offres groupées non branchées. Import CSV par copier-coller (FE-M18) |
| Marché (`pages/market`) | 10 | **NON CONFORME** | Page publique « Marché » appelle `/listings` (authentification requise, FE-E07). Contact d'annonce redirige vers `/messages` inexistant (FE-E04). Offres et avis non branchés |
| Investissement (`pages/investment`) | 5 | **PARTIELLEMENT IMPLÉMENTÉ** | 8 des 11 fonctions `investApi` sont inutilisées, dont le profil investisseur et la prise de contact |
| Vérificateur (`pages/reviewer`) | 2 | **NON CONFORME** | 422 systématique sur la checklist ; 403 pour les rôles qui y sont redirigés (FE-E05) |
| Administration (`pages/admin`) | 41 | **À AMÉLIORER** | Le mieux couvert (35/37 fonctions `adminApi` branchées). Producteurs → 422 (FE-M09). Export d'exploitations → 401 (FE-M08). Pas de confirmation sur les actions sensibles (FE-M10). Pas de pagination (FE-M06) |
| IA (`pages/ai`) | 4 | **PARTIELLEMENT IMPLÉMENTÉ** | Assistant et liste branchés ; `aiApi.analyze`, `analyzeDocument` et `feedback` inutilisés |
| Développeurs (`pages/developers`) | 4 | **À AMÉLIORER** | Clients et clés branchés ; usage détaillé (`apiClientApi.usage`) non branché |
| Indicateurs (`pages/insights`, `international`) | 5 | **PARTIELLEMENT IMPLÉMENTÉ** | Lien « Données » de la navigation publique vers un espace authentifié (FE-E07) |
| i18n | — | **NON IMPLÉMENTÉ** dans les faits | FE-E02 ; voir [AUDIT_I18N.md](AUDIT_I18N.md) |
| Tests | 3 fichiers | **NON CONFORME** | 8 tests sur 8 échouent ; pas de script `test` ni de lint (FE-M19) |

---

## 5. Anomalies détaillées

Format : identifiant · criticité · statut · fichier:ligne · preuve · conséquence · correction recommandée · test de validation.

### 5.1 CRITIQUE

#### FE-C01 — Le rejeu après rafraîchissement du jeton renvoie des données vides
- **Criticité :** CRITIQUE · **Statut :** NON CONFORME · **Fait vérifié** (statique + reproduction)
- **Fichiers :**
  - `src/services/http.ts:93-105` (`replay`) ;
  - `src/services/http.ts:107-122` (intercepteur) ;
  - `src/services/http.ts:130-138` (`request`).
- **Preuve :** l'intercepteur de réponse renvoie `replay(config)`, qui résout `response.data`, c'est-à-dire l'enveloppe `{success, data, meta}`. Or `request()` lit ensuite `response.data.data` : il attend une `AxiosResponse` et reçoit l'enveloppe.
- **Reproduction isolée :** copie conforme des trois fonctions, avec l'axios du projet et un adaptateur simulé 401 → 200 :
  ```
  Attendu (cas nominal)      : {"data":[{"id":"A"},{"id":"B"}],"meta":{"total":2}}
  Obtenu après 401+refresh : {}
  ```
- **Conséquences :**
  1. À l'expiration du jeton d'accès (≤ 15 min selon `session.ts:60`), chaque requête qui déclenche le rafraîchissement renvoie `data: undefined`. Les `queryFn` du type `.then(r => r.data)` produisent `undefined`, ce que TanStack Query v5 rejette : la page affiche une erreur.
  2. **Au démarrage avec un jeton expiré** (cas courant, rechargement après 15 min) :
     - `authApi.me()` renvoie `data` indéfini ;
     - `data.user` lève une exception, captée ;
     - le code se replie sur le profil en cache avec `permissions: []` (`store/auth.ts:76-91`).
     L'utilisateur paraît connecté sans aucune permission. Un administrateur est alors envoyé vers l'écran sûr (`lib/redirects.ts:204-211`) et voit le menu admin complet (FE-M01).
  3. Les mutations rejouées perdent leur résultat. L'écriture a bien eu lieu côté serveur, mais l'interface signale une erreur, d'où un risque de double saisie.
- **Correction :** dans l'intercepteur, rejouer via l'instance `http` (`return http.request(config)` avec `_retried = true`) pour retourner une `AxiosResponse` complète et repasser par les intercepteurs. À défaut, faire renvoyer à `replay()` la réponse complète et convertir ses erreurs en `RequestError`.
- **Test :** test unitaire avec un adaptateur axios simulé (401 puis 200), où `api.get()` doit retourner `{data, meta}` identiques au cas nominal. Ajouter un test E2E : jeton d'accès expiré, rechargement de `/admin/dashboard`, permissions chargées et tableau de bord affiché.

### 5.2 ÉLEVÉ

#### FE-E01 — Jetons d'accès et de rafraîchissement persistés dans `localStorage`
- **Statut :** NON CONFORME · **Fait vérifié**
- **Fichiers :**
  - `src/services/session.ts:31-38` : `writeStorage` écrit **dans `sessionStorage` et dans `localStorage`** ;
  - `src/services/session.ts:23-29` : lecture avec repli sur `localStorage` ;
  - `src/services/session.ts:125-133` : le profil est aussi écrit dans `localStorage` ;
  - `src/lib/secure-storage.ts:4-7` : le commentaire affirme « stockés uniquement pour la durée de l'onglet ».
- **Conséquences :**
  - le jeton de rafraîchissement, valable bien plus de 15 min, survit à la fermeture du navigateur ;
  - il est lisible par tout script de la page : une XSS, même dans une dépendance, permet une prise de compte durable ;
  - sur un poste partagé (cybercafé, poste de coopérative), la session reste ouverte, d'autant que la déconnexion est difficile à trouver (FE-M03) ;
  - la documentation interne est fausse.
- **Correction :** conserver le jeton d'accès **en mémoire seulement**. Placer le jeton de rafraîchissement dans un cookie `HttpOnly; Secure; SameSite=Strict`, ce qui demande une évolution backend de `/auth/refresh`. À défaut, le garder en `sessionStorage` uniquement et retirer toute écriture `localStorage`. Corriger les commentaires.
- **Test :** après connexion puis fermeture et réouverture du navigateur, l'utilisateur doit se reconnecter. `localStorage` ne contient aucune clé `agrikonnect.*Token`.

#### FE-E02 — Internationalisation non appliquée et langue non persistée
- **Statut :** NON IMPLÉMENTÉ (dans les faits) · **Fait vérifié** · détail dans [AUDIT_I18N.md](AUDIT_I18N.md)
- **Preuves :**
  - **9 appels `t()`** dans tout `src/`, répartis dans 2 fichiers : `components/layout/Footer.tsx` (8) et `pages/public/CountryLanguageSelector.tsx:34` (1) ;
  - **173 clés** définies (`i18n/fr.ts`, `i18n/en.ts`, parité parfaite), dont 9 utilisées (≈ 5 %) ;
  - environ **2 020 chaînes visibles codées en dur** dans 185 fichiers sans aucun `t()` ;
  - `hydrate()` (`i18n/index.ts:66-70`) n'est **jamais appelé** : la langue choisie est écrite (`:60-64`) mais jamais relue, et l'application redémarre toujours en français ;
  - `<html lang="fr">` est statique (`index.html:2`) et n'est jamais mis à jour ;
  - plusieurs pages contournent le dictionnaire par des ternaires `locale === 'fr' ? … : …` (`Footer.tsx:67-71,126-128`).
- **Conséquence :** le passage en anglais, exigé par la spécification (§4.1 « i18n fr/en »), ne traduit que le pied de page et les formats de nombres et de dates. L'expérience reste entièrement en français.
- **Correction :** appeler `hydrate()` au démarrage et synchroniser `document.documentElement.lang`. Extraire les chaînes page par page vers des espaces de noms. Ajouter un contrôle automatique (lint) qui interdit le texte JSX brut.
- **Test :** basculer en EN puis recharger : la langue est conservée. Un échantillon d'écrans par espace s'affiche intégralement en anglais. Le script d'inventaire des chaînes en dur renvoie 0.

#### FE-E03 — Contexte d'organisation obsolète et divergent
- **Statut :** NON CONFORME · **Fait vérifié**
- **Preuves :**
  - `src/lib/redirects.ts:103-122` : l'organisation active est mémorisée dans `localStorage` (`agrikonnect.activeOrganizationId`) ;
  - `src/services/http.ts:61-64` : elle est envoyée en `X-Organization-Id` sur **toutes** les requêtes authentifiées ;
  - `src/store/auth.ts:145-154` : `logout()` **ne la purge pas** ;
  - côté backend, `backend/src/middleware/tenant.js:28-33` répond **404 « Organisation introuvable »** si l'en-tête désigne une organisation dont l'utilisateur n'est pas membre ;
  - le sélecteur d'organisation n'apparaît que pour plus d'une organisation, et seulement à partir de 768 px (`AppLayout.tsx:264-269`, classe `hidden … md:inline-block`) ;
  - sans valeur mémorisée, l'interface affiche `organizations[0]` comme organisation active (`AppLayout.tsx:112-120`), alors que le backend choisit l'organisation `INDIVIDUAL` en priorité (`tenant.js:36-38`). Le frontend utilise une troisième règle encore, la priorité de rôle (`redirects.ts:139-163`).
- **Conséquences :**
  - **sur un appareil partagé**, l'utilisateur B qui se connecte après A reçoit un 404 sur toutes les routes multi-organisations, sans moyen de corriger s'il n'a qu'une organisation ou s'il est sur mobile ;
  - en usage normal, l'organisation affichée peut différer de celle réellement utilisée par l'API.
- **Correction :**
  - purger la clé à la déconnexion et à la perte de session ;
  - ignorer côté client une valeur qui ne figure pas dans `user.organizations` ;
  - utiliser une règle par défaut unique, alignée sur le backend (ou utiliser `activeOrganizationId` renvoyé par `/me`, cf. `endpoints.ts:223`) ;
  - rendre le sélecteur accessible sur mobile.
- **Test :** connexion A (organisation X), déconnexion, connexion B (organisation Y) : aucune requête ne part avec `X-Organization-Id: X`. Sur un écran de 375 px avec 2 organisations, le sélecteur est accessible.

#### FE-E04 — 18 liens internes mènent à des routes inexistantes (404)
- **Statut :** NON CONFORME · **Fait vérifié** (confrontation automatique des 658 liens aux 173 routes de `App.tsx`)
- **Preuves (liens les plus graves) :**

| Fichier:ligne | Lien | Route correcte probable |
|---|---|---|
| `pages/app/Messages.tsx:90` | `/messages/${id}` | `/app/messages/:id` |
| `pages/market/ListingDetail.tsx:32` | `navigate('/messages')` (après « Contacter ») | `/app/messages/:id` (id de conversation renvoyé) |
| `pages/app/Orders.tsx:72` | `/marketplace/${order.id}` | `/app/orders/:id` |
| `pages/app/Dashboard.tsx:207,253` | `/app/verifications` | `/app/verification` |
| `pages/farmer/index.tsx:173,202,325,360` | `/farmer/productions/:id`, `/farmer/harvests/new`, `/farmer/documents`, `/farmer/onboarding` | non implémentées |
| `pages/farmer/Projects/DataRoom.tsx:36` | `/farmer/projects/:id/dataroom/:docId` | non implémentée |
| `pages/organization/index.tsx:123,220,231,293,301` ; `pages/organization/Overview.tsx:59,130,142` | `/organization/collection`, `/organization/group-sales`, `/organization/governance` | non implémentées |

- **Conséquence :** les parcours cœur de métier sont interrompus : ouvrir une conversation, consulter une commande, contacter un vendeur.
- **Correction :** corriger les cibles existantes. Pour les fonctionnalités absentes, retirer les liens ou les remplacer par un état « non disponible » explicite. Centraliser les chemins dans un module `routes.ts` typé.
- **Test :** test automatisé qui extrait tous les `to=`, `href` et `navigate()` et les confronte aux routes, avec un résultat de 0 écart. Ajouter un E2E « Contacter une annonce » qui ouvre la conversation.

#### FE-E05 — Espace vérificateur inopérant
- **Statut :** NON CONFORME · **Fait vérifié**
- **Preuves :**
  1. `pages/reviewer/Checklist.tsx:57-58` : `adminQueue({ limit: 200, status: '' })`. Or la limite maximale côté serveur est 100 (`backend/src/shared/pagination.js:15`, utilisée par `listVerificationsSchema`, `verification.schema.js:21`). La réponse est donc **toujours un 422** et aucune décision n'est possible.
  2. Le commentaire `Checklist.tsx:54` dit que « la file doit aussi montrer les dossiers déjà traités ». C'est faux : `status: ''` est retiré par `cleanQuery`, et le backend filtre alors sur `PENDING` (`verification.service.js:129`).
  3. `lib/redirects.ts:81-82` envoie **AGRONOMIST** et **LAB_PARTNER** vers `/reviewer/missions`. Or `/admin/verifications` exige `verifications.review` (`verification.routes.js:31-34`), accordée uniquement à SUPER_ADMIN et ADMIN (`AUDIT_BACKEND/MATRICE_ROLES_PERMISSIONS.md`, ligne `verifications.review`). Le résultat est un **403 systématique**.
  4. Les rôles **VERIFIER, COUNTRY_ADMIN et DATA_STEWARD** existent côté backend mais sont absents de `ROLE_PRIORITY` et `ESPACE_PAR_ROLE` (`redirects.ts:50-87`). Ils atterrissent sur l'écran sûr `/app/profile`.
- **Correction :**
  - `limit ≤ 100` avec pagination, ou chargement unitaire d'une vérification (route à créer côté backend si nécessaire) ;
  - aligner la table rôle → espace sur la matrice backend ;
  - décider avec le métier qui instruit les vérifications.
- **Test :** un compte ADMIN ouvre une mission, approuve ou rejette, et le statut change. Un compte AGRONOMIST n'est plus dirigé vers un écran en 403.

#### FE-E06 — 140 fonctions d'appel API sur 311 (45 %) ne sont reliées à aucun écran
- **Statut :** PARTIELLEMENT IMPLÉMENTÉ · **Fait vérifié** (recherche de chaque `xxxApi.fn` dans `pages`, `components`, `store` et `lib`)
- **Fonctionnalités absentes de l'interface** (liste complète dans [AUDIT_INTEGRATION_API.md](AUDIT_INTEGRATION_API.md) §6) :

| Domaine | Fonctionnalités absentes |
|---|---|
| Compte | Changement de mot de passe (`authApi.changePassword`), préférences de notification (`notificationApi.preferences/setPreferences`), profil investisseur (`investApi.profile/updateProfile`) |
| Producteur | Édition, suppression et publication d'exploitation (`farmApi.update/remove/publish`), édition et suppression de parcelle, saisie et édition de production (`productionApi.create/update/remove`), historique cultural |
| Sol et géospatial | Diagnostic de sol par le moteur Python (`geoApi.diagnose/latest/history` : 5 fonctions sur 6 inutilisées), analyses de sol (11 fonctions `soilApi` sur 15 inutilisées), zones et rapport de précision (calcul, validation, PDF) |
| Marché | Offres sur demande d'achat, avis et réputation (`reviewApi` : 0 sur 5), litiges et paiement (`orderApi.dispute/setPayment`), stock (création, mouvements) |
| Transport | Création, offre, acceptation, preuve de livraison, statut (5 fonctions sur 6) |
| Coopérative | Ajout et édition de membre, offres groupées (aperçu, création, confirmation, annulation) |
| Investissement / data room | Demande d'accès, décision, documents, financements, rapports de progression et d'impact (10 fonctions `projectDataApi` sur 13) |
| IoT | Enregistrement, rotation de clé, révocation, lectures |
| Médias | Téléversement (`mediaApi.uploadUrl/confirm`) |
| Public | Contact d'un producteur (`publicApi.contactFarm`), QR d'exploitation |
| Hors-ligne | Envoi de la synchronisation (`syncApi.push`) |

- **Conséquence :** l'interface laisse croire à une couverture fonctionnelle (README §Structure : « 156 pages ») alors que de nombreuses actions métier ne sont possibles qu'en lecture.
- **Correction :** prioriser avec le métier ; brancher par lots (plan, phases 1 et 2). Supprimer les fonctions qui ne seront pas utilisées.
- **Test :** pour chaque fonctionnalité branchée, un test d'intégration (MSW) et un parcours E2E. Le rapport « fonctions inutilisées » doit tendre vers 0.

#### FE-E07 — Pages et liens publics vers des routes qui exigent une session
- **Statut :** NON CONFORME · **Fait vérifié**
- **Preuves :**
  - `pages/market/MarketPublic.tsx:17-19` déclare `public` mais appelle `GET /listings`, qui exige une session (`backend/src/modules/market/listings/listings.routes.js:14`). Or « Marché » est l'entrée principale de la navigation publique (`Header.tsx:14`).
  - `pages/public/DataCatalog.tsx:11-13` appelle `/insights/disclosure-policy` et `pages/public/AgricultureCountry.tsx:17-20` appelle `/insights/overview`. Les deux exigent une session (`insights.routes.js:20`).
  - L'entrée « Données » de la navigation publique (`Header.tsx:17`) mène à `/insights`, espace authentifié.
  - La barre « Conseils agricoles » du site public pointe vers `/farmer/soil` et `/farmer/plots` (`Header.tsx:52-54`), donc vers l'espace producteur.
  - La page `/weather` n'est pas protégée mais appelle `/weather/plots/:id`, authentifiée (`pages/Weather.tsx:17-20`).
- **Conséquence :** un visiteur anonyme rencontre des erreurs 401 ou 403 ou des écrans « Se connecter » dès la navigation principale, ce qui donne une mauvaise première impression et un taux de rebond élevé.
- **Correction :** soit exposer côté backend des variantes publiques (annonces publiées, indicateurs k-anonymisés), soit retirer ces pages du site public et les marquer « réservé aux membres » avant le clic.
- **Test :** E2E anonyme qui parcourt toutes les entrées du `Header` et du `Footer` : aucune réponse 401, 403 ou 422.

#### FE-E08 — Mini-graphiques à valeurs codées en dur présentés comme des tendances
- **Statut :** NON CONFORME · **Fait vérifié**
- **Preuves :**
  - **40** propriétés `bars: [38, 60, 74, …]` codées en dur dans 10 tableaux de bord : `pages/app/Agent.tsx:169-193`, `pages/app/Dashboard.tsx:227-243`, `app/Transport.tsx`, `developers/index.tsx`, `farmer/index.tsx`, `investment/index.tsx`, `market/MarketApp.tsx`, `organization/index.tsx`, `organization/Overview.tsx` et `reviewer/Missions.tsx` (4 chacun) ;
  - valeur par défaut fictive `cell.bars ?? [45, 78, 38, 64]` dans `design-system/components/HorizonDashboard.tsx:979`.
- **Conséquence :** ces graphiques contredisent la règle produit énoncée dans ce même fichier (`HorizonDashboard.tsx:13-14`, « zéro chiffre fictif ») et le README (« Aucune donnée n'est inventée côté client »). L'utilisateur lit une tendance qui n'existe pas, ce qui pose un risque de décision erronée et de crédibilité.
- **Correction :** supprimer les barres, ou les alimenter par une série réelle avec un état vide explicite.
- **Test :** une recherche `bars: \[[0-9]` ne renvoie aucun résultat. Revue visuelle des 10 tableaux de bord.

#### FE-E09 — L'inscription libre-service propose des rôles sensibles
- **Statut :** NON CONFORME · **Fait vérifié** (défaut principal côté backend : H-01 de `AUDIT_BACKEND/RAPPORT_AUDIT_BACKEND.md`)
- **Preuve :** `pages/auth/Register.tsx:17,19` propose `AGRONOMIST` et `SUPPORT_AGENT` dans la liste des types de compte.
- **Conséquences :**
  - `SUPPORT_AGENT` reçoit 94 permissions, dont l'écriture des prix et des taux de change ;
  - `AGRONOMIST` peut valider les référentiels agronomiques.
  Le frontend rend l'élévation de privilèges triviale.
- **Correction :** retirer ces options du formulaire. La correction de fond se fait côté backend : attribution par un administrateur uniquement. Côté interface, indiquer que ces profils sont attribués sur demande.
- **Test :** le formulaire ne propose plus ces rôles. Un `POST /auth/register` forgé avec ces rôles est refusé par le backend.

### 5.3 MOYEN

| ID | Statut | Constat et preuve | Conséquence | Correction recommandée | Test de validation |
|---|---|---|---|---|---|
| **FE-M01** | NON CONFORME | **Pas de garde de permission par route.** Les 173 routes ne sont protégées que par l'authentification (`AuthGate`, `components/ui/AuthGate.tsx:15-16`). Tout compte connecté peut ouvrir `/admin/*`. Pire, `AppLayout.tsx:132-133` et `:143` affichent **tous** les groupes du menu admin quand l'utilisateur n'a **aucune** permission `admin.*`. La spécification §5.1 prévoit une « permission front » par route et un « écran 403 explicite » (§4.1) | Exposition de toute la structure d'administration ; écrans d'erreur 403 en cascade ; confusion | Composant `<RequirePermission perm>` sur les routes ; écran 403 dédié ; menu filtré (vide si aucun droit) | Compte FARMER : `/admin/users` affiche l'écran 403 et le menu admin est absent |
| **FE-M02** | À AMÉLIORER | **Démarrage et retour après connexion.** Pendant `status === 'booting'`, `AuthGate` affiche « Se connecter » (`ResourcePage.tsx:64-67` + `AuthGate.tsx:16`) avant la fin de `init()`. Après connexion, la navigation va toujours vers l'espace par défaut (`Login.tsx:43`) : la page demandée est perdue | Flash d'écran trompeur à chaque rechargement ; parcours rompu (lien d'e-mail vers une commande, par exemple) | Rendre un squelette pendant `booting` ; passer `?next=` (validé : chemin interne uniquement) | Recharger `/app/orders` connecté : aucun flash ; lien profond anonyme → connexion → retour sur la page |
| **FE-M03** | À AMÉLIORER | **Déconnexion introuvable.** Le seul bouton est dans `/app/profile` (`pages/app/Profile.tsx:168`). Il est absent de la barre d'espace (`AppLayout.tsx:287-332`), de l'en-tête public et de la barre latérale | Sessions laissées ouvertes (aggrave FE-E01) | Menu compte avec « Se déconnecter » dans l'en-tête de tous les espaces | Déconnexion possible en ≤ 2 clics depuis tout écran |
| **FE-M04** | NON CONFORME | **Le temps réel fige le jeton à la connexion.** `realtime.ts:57-69` lit `sessionStore.accessToken` à la création du socket, et `socket.auth` n'est jamais mis à jour après un rafraîchissement. `connect()` n'est rappelé que sur changement de `isAuthenticated` (`App.tsx:208-216`). La connexion est aussi tentée en mode « profil en cache » | Après une coupure réseau au-delà de 15 min, la reconnexion utilise un jeton expiré et le temps réel s'arrête silencieusement | `auth: (cb) => cb({ token: sessionStore.accessToken })` (fonction) ; reconnecter après rafraîchissement | Simuler une expiration puis une coupure : la reconnexion réussit et `message:new` est reçu |
| **FE-M05** | NON CONFORME | **Déconnexion forcée sur erreur réseau.** `session.ts:112-114` vide la session sur **toute** exception du rafraîchissement, y compris une coupure (statut 0) | Utilisateur en zone 3G instable déconnecté et données locales perdues ; contraire au discours « hors-ligne » (`query.ts:9-15`) | Ne purger que sur 401 ou 403 du rafraîchissement ; conserver la session en cas d'erreur réseau | Couper le réseau pendant le rafraîchissement : la session reste et la reprise fonctionne |
| **FE-M06** | NON IMPLÉMENTÉ | **Pas de pagination.** 61 écrans `ResourcePage` et 97 requêtes à `limit: 100/200/500` ; seules 8 pages lisent `meta`. `ResourcePage.tsx:157` affiche « N enregistrement(s) renvoyé(s) par l'API », qui n'est pas le total. Recherche admin sans délai de saisie (requête à chaque frappe, `admin/Users.tsx:37-46`). La spécification §4.2 exige « tri, filtres, pagination » | Données tronquées sans le savoir au-delà de 100 lignes ; charge serveur | Pagination dans `ResourcePage` (page/limit + `meta.total`) ; tri ; `useDeferredValue` ou délai de 300 ms | Jeu de 150 éléments : navigation jusqu'à la page 2 ; total exact affiché |
| **FE-M07** | NON CONFORME | **Ouverture d'URL protégées sans jeton.** `admin/Reports.tsx:46` fait `window.open(adminApi.exportFarms())`, une URL qui exige un Bearer (`endpoints.ts:989`) : la réponse est 401. `farmer/Lots/Detail.tsx:26` ouvre `/api/v1/public/lots/:code/qr.png`, chemin **relatif à l'origine du frontend** (ignore `API_BASE_URL`) et **route absente** côté backend (seul `/public/farms/:slug/qr.:format` existe, `public.routes.js:44`). `precisionApi.pdfUrl` présente le même problème latent | Boutons « Télécharger » et « QR code » non fonctionnels | Téléchargement via `http.get(…, {responseType:'blob'})` puis `URL.createObjectURL` (modèle déjà utilisé dans `AuditLog.tsx:39`) ; créer la route QR de lot côté backend | Clic sur « Télécharger » : fichier CSV reçu ; QR affiché |
| **FE-M08** | NON CONFORME | **Rôle inexistant envoyé à l'API.** `admin/Producers.tsx:14-15` filtre `role: 'PRODUCER'`. `PRODUCER` est un **groupe de permissions**, pas un rôle : le schéma `z.enum(ALL_ROLES)` (`backend/src/modules/admin/admin.schema.js:29`) renvoie 422 | Écran « Organisations de production » toujours en erreur | Filtrer par type d'organisation (`organizationApi.list({type})`) ou par une liste de rôles explicite | L'écran liste les organisations FARMER, COOPERATIVE et COMPANY |
| **FE-M09** | NON CONFORME | **Actions sensibles sans confirmation.** Un seul `window.confirm` dans tout le code (`admin/BlogPosts.tsx:136`). Sans confirmation : suppression de compte (`admin/UserDetail.tsx:354-361`), révocation de rôle (`:327`), révocation des sessions (`:236`), révocation de clé API (`developers/Keys.tsx:214`), retrait du consentement SMS (`app/SmsConsent.tsx:84`). La spécification §4.3 exige « confirmation modale + rappel du motif » | Erreur de manipulation irréversible | Composant `ConfirmDialog` accessible (`role="alertdialog"`, focus piégé) avec rappel du motif | Chaque action destructive ouvre la boîte ; « Annuler » n'émet aucune requête |
| **FE-M10** | À AMÉLIORER | **Accessibilité** (détail dans [AUDIT_UI_UX_RESPONSIVE.md](AUDIT_UI_UX_RESPONSIVE.md) §5) : pas de lien d'évitement ; `Input` en `outline: 'none'` avec un focus signalé par la seule couleur de bordure (`components/ui/Field.tsx:31-40`) ; erreurs de champ sans `aria-invalid` ni `aria-describedby` ; `ErrorState` sans `role="alert"` ; environ 50 `<Link><Button>` imbriqués, soit `<a><button>` (HTML invalide, double tabulation, `ResourcePage.tsx:146-148`) ; carrousel sans bouton pause (`HeroCarousel.tsx:77`) | Non-conformité RGAA/WCAG 2.1 AA probable | Voir le plan, phase 2 | Audit axe-core : 0 violation « serious » ; navigation clavier complète |
| **FE-M11** | NON CONFORME | **Responsive** : 6 formulaires en `gridTemplateColumns: '1fr 1fr'` figé en ligne, dont l'inscription (`auth/Register.tsx:79`, `farmer/Farms/Create.tsx:64`, `farmer/Plots/Create.tsx:66`, `farmer/Profile.tsx:59`, `market/NewListing.tsx:63`, `agent/Registration.tsx:66`) ; points de rupture CSS hétérogènes (560/620/640/760/980/1200 px) contre la grille du thème (640/768/1024/1280) ; tiroir sous 768 px alors que la spécification §4.2 demande 1 024 px | Champs écrasés à 320-375 px (marché cible : smartphones d'entrée de gamme) | Grilles `repeat(auto-fit, minmax(240px, 1fr))` ; une seule échelle de points de rupture | Captures 320/375/768/1024/1440 px sans débordement horizontal |
| **FE-M12** | NON CONFORME | **Repli silencieux sur `localhost` en production.** `lib/config.ts:12-20` se replie sur `http://localhost:4000` si `VITE_API_BASE_URL` est vide. Le `dist/` local actuel contient bien `http://localhost:4000/api/v1` (`dist/assets/index-DO-iKtoh.js`). `.env.example` décrit `VITE_REALTIME_URL` comme « Supabase Realtime » et dit « Laisser vide », ce qui est faux : le serveur est Socket.IO sur `/realtime` du backend | Build de production qui appelle `localhost` sans erreur au build | Faire échouer le build (`vite.config.ts`) si les variables manquent en mode production ; corriger `.env.example` | `vite build --mode production` sans variables : échec explicite |
| **FE-M13** | À AMÉLIORER | **Gestion des erreurs** : messages bruts du serveur ou d'axios (« Network Error », en anglais) affichés tels quels (`States.tsx:70`, `http.ts:82`) ; `RequestError.kind` et `ERROR_KIND_I18N` (`types.ts:64-89`) et `errors.*` (i18n) inutilisés ; erreurs par champ (`RequestError.fields`) exploitées une seule fois ; `AppErrorBoundary` sans réinitialisation à la navigation (`AppErrorBoundary.tsx:12-21`) ; pas de remontée d'erreurs (`console.error` seul) | Messages incompréhensibles ; écran bloqué jusqu'au rechargement | Mapper `kind` vers un message traduit ; afficher `fields` sous les champs ; `key={location.pathname}` sur la frontière d'erreur ; outil de suivi d'erreurs | Coupure réseau : message traduit ; 422 : erreur sous le bon champ |
| **FE-M14** | À AMÉLIORER | **Trois systèmes de design concurrents** : `components/ui` (165 importateurs), `components/kit.tsx` (515 l., **1** importateur, doublons `Bouton`, `Champ`, `Reveal`), `design-system/` (Tailwind) ; plus `theme/tokens.css` (1 108 l.) et `theme/agrikonnect.ts`. 1 404 `style={{…}}` contre 494 `className`. La spécification §4.1 dit « pas de Tailwind », or Tailwind est utilisé (`vite.config.ts:7`, `AppLayout.tsx:209+`) | Incohérences visuelles, dette de maintenance | Choisir un système unique ; migrer ; documenter | Un seul module de composants importé par les pages |
| **FE-M15** | À AMÉLIORER | **Pages dupliquées** : 6 paires `/app/*` et `/farmer/*` quasi identiques (`app/Plots.tsx` et `farmer/Plots/index.tsx` ne diffèrent que par `rowHref`, ligne 17) ; `/market` et `/market/listings` rendent le même composant (`App.tsx:396-397`) ; `admin/Farmers` et `admin/Producers` ; `Section` et `AuthGate` imbriqués deux fois (`admin/Users.tsx:49-56` + `ResourcePage`) | Double maintenance et navigation ambiguë | Fusionner ; redirections `Navigate` pour les anciennes URL | Une seule implémentation par écran |
| **FE-M16** | À AMÉLIORER | **Images et polices** : le carrousel rend ses 10 diapositives superposées ; `loading="lazy"` y est inopérant puisqu'elles sont toutes dans la zone visible (`HeroCarousel.tsx:122-163`), ce qui fait environ 3 Mo de JPG au premier affichage (`src/assets/hero` = 3,1 Mo). Aucun WebP/AVIF ni `srcset` ; aucune image avec `width`/`height` (décalage de mise en page) ; Google Fonts en CSS bloquant (`index.html:12-16`) ; sondage `/health` toutes les 2 min sur **toutes** les pages publiques (`Footer.tsx:59-64`) | Premier affichage lent en 3G ; charge backend | Ne rendre que la diapositive courante et la suivante ; images responsives ; polices auto-hébergées ; sonde d'état réservée à l'admin | Lighthouse mobile : LCP < 2,5 s ; une seule image hero au chargement |
| **FE-M17** | NON IMPLÉMENTÉ | **Aucun téléversement de fichier.** `mediaApi.uploadUrl/confirm` sont inutilisés et il n'y a aucun `<input type="file">`. `organization/MemberImport.tsx:98` annonce « depuis un fichier CSV » mais propose une zone de texte à coller (`:160-163`). Les pièces d'export et de data room ne prennent qu'une « référence » (`farmer/Export/Documents.tsx:51`) | Photos, preuves de livraison et documents impossibles à fournir | Composant d'envoi (URL signée → PUT → confirm) avec contrôle de type et de taille côté client | Envoi d'une photo de 2 Mo : média confirmé et affiché |
| **FE-M18** | NON CONFORME | **Formats monétaires** : devise par défaut `XOF` (`lib/format.ts:7`) alors que le marché principal est la RDC (pays par défaut `CD`, `Register.tsx:44` ; marque « RDC · AFRICA », `Header.tsx`) ; `maximumFractionDigits: 0` (`format.ts:44`) arrondit les montants en USD ; 16 `fr-FR` codés en dur (dont `AppLayout.tsx:200`) | Montants affichés dans une mauvaise devise ou arrondis | Pas de devise implicite (afficher « — » sans devise) ; décimales selon la devise (`Intl` par défaut) ; locale issue de `useI18n` | Montant de 12,50 USD affiché exactement ; montant sans devise non formaté en XOF |
| **FE-M19** | NON CONFORME | **Qualité logicielle** : 8 tests sur 8 échouent (`tests/hero-carousel.test.tsx` : `Link` sans routeur ; `tests/home.test.tsx` : `window.matchMedia` non simulé dans `tests/setup.ts`) ; aucun script `test` ni `lint` dans `package.json:6-12` ; pas d'ESLint ni de Prettier ; 3 fichiers de test pour 204 sources | Régressions non détectées (FE-C01 et FE-E04 auraient été détectés) | Réparer `setup.ts` ; scripts `test`, `lint` ; CI bloquante | `npm test` vert en CI |
| **FE-M20** | NON VÉRIFIABLE | **Lien de démonstration de lot** : `/public/lots/demo` est utilisé à 4 endroits (`Footer.tsx:27`, `Home.tsx:606`, `homeSlides.ts:55`, `lib/platform.ts:30`). Le format réel est `AK-CI-2026-00001` (`i18n/fr.ts`, `home.tracePlaceholder`) | Probable fiche « lot introuvable » sur un appel à l'action de l'accueil | Pointer vers un lot réel publié ou vers un champ de recherche | E2E : le lien affiche une fiche de lot |

### 5.4 FAIBLE

| ID | Constat et preuve | Correction recommandée |
|---|---|---|
| FE-F01 | `pendingMfa` conserve **le mot de passe en clair** dans le store Zustand (`store/auth.ts:26,122`) ; `clearPendingMfa()` n'est jamais appelé | Effacer à l'abandon, à la sortie de `/auth/login` et après 5 min |
| FE-F02 | En-tête `X-Client: mobile/1.0.0-web` (`http.ts:45`) et constantes `IS_WEB`/`IS_NATIVE` héritées du mobile (`config.ts:29-30`) | `X-Client: web/<version>` |
| FE-F03 | Code mort : `components/layout/AdminSidebar.tsx` (145 l., jamais importé), `lib/faq.ts` (116 l.) ; dépendance circulaire `components/ui/index.ts` ↔ `components/ui/AuthGate.tsx` | Supprimer ; importer directement les composants dans `AuthGate` |
| FE-F04 | `package.json` : outils de test (`vitest`, `jsdom`, `happy-dom`, `@testing-library/*`) en `dependencies` ; `jsdom` et `happy-dom` en double ; `noUnusedLocals: false` (`tsconfig.json:8`) | Déplacer en `devDependencies` ; activer `noUnusedLocals` |
| FE-F05 | `vite.config.ts:9-10` : `host: '0.0.0.0'` + `allowedHosts: true` (serveur de développement exposé au réseau et à la recombinaison DNS) | Réserver `0.0.0.0` à un usage explicite ; liste d'hôtes autorisés |
| FE-F06 | Typage faible des contrats : 124 `Record<string, unknown>` dans `endpoints.ts`, 14 `as unknown as`, 7 `as any` | Types de charge utile par endpoint, idéalement générés depuis l'OpenAPI du backend |
| FE-F07 | Jargon technique affiché à l'utilisateur : « GET /admin/dashboard » (`admin/Dashboard.tsx:294,391`), « Calculé depuis vos enregistrements GET /productions » (`farmer/index.tsx:266`), « … renvoyé(s) par l'API » (36 occurrences) ; tutoiement isolé (`admin/UserDetail.tsx:92`) | Textes métier ; vouvoiement uniforme |
| FE-F08 | Le « newsletter » du pied de page redirige vers `/auth/register?email=…` (`Footer.tsx:72-77`) : donnée personnelle dans l'URL, et `Register.tsx` ne lit pas ce paramètre | Renommer en « Créer un compte » ou implémenter un vrai abonnement ; ne pas passer l'e-mail en URL |
| FE-F09 | Inscription sans consentement CGU ni politique de confidentialité, sans confirmation du mot de passe (`Register.tsx`) | Case obligatoire avec lien ; double saisie ou affichage du mot de passe |
| FE-F10 | `index.html` : `lang` statique, pas de `<meta name="referrer">` ; aucune politique CSP dans le dépôt (NON VÉRIFIABLE côté hébergeur) | CSP stricte au niveau de l'hébergeur ; `referrer` `strict-origin-when-cross-origin` |
| FE-F11 | Article de blog rendu en texte brut `pre-wrap` (`public/BlogPost.tsx:50-53`) : sûr vis-à-vis des XSS, mais pas de mise en forme | Rendu Markdown avec assainissement (liste blanche) |
| FE-F12 | README obsolète : « six routes anonymes » (alors que `/public/blog-posts` et `/public/lots/:code` existent), « 156 pages » (176 fichiers, 173 routes) | Mettre à jour |
| FE-F13 | Le pied de page public expose la version de l'API et du frontend (`Footer.tsx:66-68,150`) | Réserver à l'espace admin |

### 5.5 INFORMATIONNEL (constats conformes)

| ID | Constat | Statut |
|---|---|---|
| FE-I01 | `tsc --noEmit` : **0 erreur** (sortie 0) | CONFORME |
| FE-I02 | `vite build` : **réussi** en 9,7 s, 805 modules, 194 fragments JS, 1 CSS, 25 JPG. Plus gros fragments : `vendor-react` 203 kB (63,5 kB gzip), `index` 167,6 kB (45,7 kB gzip). Aucun avertissement de taille | CONFORME |
| FE-I03 | Les **311** appels de `endpoints.ts` correspondent à une route existante (méthode et chemin) du backend | CONFORME |
| FE-I04 | `node --test scripts/redirects.test.mjs` : **29/29** réussis | CONFORME |
| FE-I05 | Aucun `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, `console.log` ; aucun secret (clé, jeton, mot de passe) dans `src/`, `dist/` ni `.env.example` ; `.env` et `dist/` ignorés par git | CONFORME |
| FE-I06 | `Idempotency-Key` sur les écritures, rafraîchissement mono-vol, pas de relance sur 4xx, invalidations ciblées par le temps réel | CONFORME |
| FE-I07 | 57 `useMutation`, 54 boutons avec `loading` et 44 `disabled` : la double soumission est en général évitée par le désactivement pendant `isPending` ; aucun bouton sans action détecté | CONFORME (à généraliser) |
| FE-I08 | RTL : aucune langue RTL n'est prévue par la spécification (fr/en) | NON APPLICABLE |

---

## 6. Synthèses thématiques

### 6.1 UI/UX
Le site public est soigné : en-tête, pied de page, carrousel et sections d'accueil. Les espaces métier sont homogènes grâce à `ResourcePage` et `HorizonDashboard`. En revanche :
- **Cohérence visuelle :** trois systèmes de composants coexistent (FE-M14).
- **Parcours :** des liens sont cassés (FE-E04) et des boutons d'action manquent pour les opérations d'écriture (FE-E06).
- **Données :** des graphiques fictifs sont affichés (FE-E08) et du jargon technique est montré à l'utilisateur (FE-F07).

Détail : [AUDIT_UI_UX_RESPONSIVE.md](AUDIT_UI_UX_RESPONSIVE.md).

### 6.2 Responsive
La coquille d'espace bascule correctement en tiroir sous 768 px (`AppLayout.tsx:210-241,360-379`), mais :
- des formulaires restent à deux colonnes figées et les points de rupture sont incohérents (FE-M11) ;
- le sélecteur d'organisation est masqué sur mobile (FE-E03) ;
- les tableaux ne passent pas en cartes (`SeasonFeedback.tsx:362`, `minWidth: 620`).

### 6.3 i18n
Le mécanisme existe (typage des clés, parité fr/en garantie par le type `Dictionary`) mais il n'est **pas utilisé** (FE-E02). Voir [AUDIT_I18N.md](AUDIT_I18N.md).

### 6.4 Intégration API
Les chemins sont tous corrects (FE-I03). Les défauts portent sur :
- le rejeu (FE-C01) ;
- les paramètres hors contrat : `limit` à 200 (FE-E05), rôle `PRODUCER` (FE-M08) ;
- les routes authentifiées appelées depuis le public (FE-E07) ;
- l'absence de pagination (FE-M06) ;
- 45 % de fonctions non branchées (FE-E06).

Voir [AUDIT_INTEGRATION_API.md](AUDIT_INTEGRATION_API.md).

### 6.5 Sécurité côté client

| Contrôle | Réalisé par le frontend | Doit être garanti par le backend |
|---|---|---|
| Authentification des routes | Oui (`AuthGate`, authentification seule) | Oui : seule barrière réelle |
| Autorisation par rôle/permission | Non par route (FE-M01) ; partiel dans le menu admin et `UserDetail` (`hasAnyRole`) | **Oui, impérativement** (permissions, propriétaire, organisation) |
| Rôles proposés à l'inscription | Rôles sensibles proposés (FE-E09) | Refuser l'auto-attribution (H-01 backend) |
| Stockage des jetons | `localStorage` (FE-E01) | Cookie `HttpOnly` pour le rafraîchissement ; rotation (déjà en place) |
| XSS | Pas d'injection HTML ; React échappe ; blog en texte brut | Assainir le contenu stocké, CSP |
| Validation des saisies | HTML5 (`required`, `minLength`, `type=email`) ; validation e-mail du pied de page | Schémas Zod (en place) |
| Fichiers | Aucun téléversement (FE-M17) | Contrôle type et taille, signature (M-11 backend) |
| Redirections | Destinations internes fixes ; pas de paramètre `next` donc pas de redirection ouverte | — |
| Secrets | Aucun dans le bundle ; seules `VITE_API_BASE_URL` et `VITE_REALTIME_URL` sont exposées (non sensibles) | — |

### 6.6 Performances
- **Points positifs :**
  - toutes les pages sont chargées à la demande ;
  - les dépendances sont découpées par groupes (`vite.config.ts:18-29`) ;
  - le bundle initial est raisonnable : environ 110 kB gzip pour l'index, `vendor-react` et le routeur ;
  - le cache Query a un `staleTime` de 60 s.
- **Points faibles :**
  - images et polices (FE-M16) ;
  - absence de pagination (FE-M06) ;
  - invalidation globale au changement d'organisation (`AppLayout.tsx:125`), acceptable ;
  - animations `framer-motion` sur chaque ligne de liste (`ResourcePage.tsx:123-129`), coûteuses au-delà de quelques centaines de lignes ;
  - sondage `/health` (FE-M16).

---

## 7. Fonctionnalités opérationnelles et non opérationnelles

| Fonctionnalité | État | Référence |
|---|---|---|
| Navigation publique, accueil, à propos, services, blog | Opérationnelle | — |
| Carte publique, annuaire et fiche d'exploitation, fiche de lot | Opérationnelle (lien de démonstration douteux) | FE-M20 |
| Connexion, MFA (activation, codes de secours), mots de passe oublié et réinitialisation, vérification e-mail/téléphone | Opérationnelle | — |
| Maintien de session au-delà de 15 min | **Non opérationnelle** | FE-C01 |
| Changement de langue | **Non opérationnelle** (pied de page uniquement, non persistée) | FE-E02 |
| Messagerie : liste et fil | Liste et fil oui ; **ouverture d'une conversation depuis la liste cassée** | FE-E04 |
| Commandes : liste et détail | Liste oui ; **lien vers le détail cassé** ; litiges et paiement absents | FE-E04, FE-E06 |
| Marché public | **Non opérationnel en anonyme** | FE-E07 |
| Annonces : création, détail | Oui ; contact cassé ; offres et avis absents | FE-E04, FE-E06 |
| Exploitations et parcelles : création, liste, détail | Oui ; édition, suppression et publication absentes | FE-E06 |
| Productions | Lecture seule | FE-E06 |
| Diagnostic de sol (moteur Python) | **Absent** | FE-E06 |
| Recommandations, alertes, satellite, anomalies | Branchées (lecture et actions principales) | — |
| Vérificateur (missions, checklist) | **Non opérationnel** | FE-E05 |
| Administration : tableau de bord, comptes, rôles, audit, tâches, sécurité, réglages, opérations | Opérationnelle (sans confirmation ni pagination) | FE-M06, FE-M09 |
| Administration : producteurs, export d'exploitations | **Non opérationnelle** | FE-M08, FE-M07 |
| Transport | Lecture seule | FE-E06 |
| Investissement et data room | Lecture partielle ; contact, profil et accès absents | FE-E06 |
| Téléversement de fichiers | **Absent** | FE-M17 |
| Temps réel (messages, commandes, notifications, alertes) | Opérationnel jusqu'à la première reconnexion après expiration du jeton | FE-M04 |

---

## 8. Incohérences relevées (synthèse)

1. **Documentation et code :**
   - « jetons pour la durée de l'onglet » alors qu'ils sont écrits dans `localStorage` (FE-E01) ;
   - « zéro chiffre fictif » alors que 40 séries sont codées en dur (FE-E08) ;
   - « aucune donnée inventée » ;
   - « six routes anonymes » (FE-F12) ;
   - « Supabase Realtime » (FE-M12).
2. **Spécification et code :**
   - « pas de Tailwind » (FE-M14) ;
   - « permission front » et « écran 403 » (FE-M01) ;
   - « tiroir < 1 024 px » (FE-M11) ;
   - « tri, filtres, pagination » (FE-M06) ;
   - « confirmation modale » (FE-M09) ;
   - « i18n fr/en » (FE-E02).
3. **Frontend et backend :**
   - limite de pagination (FE-E05) ;
   - rôle `PRODUCER` (FE-M08) ;
   - organisation par défaut (FE-E03) ;
   - permissions de l'espace vérificateur (FE-E05) ;
   - routes publiques supposées (FE-E07) ;
   - QR de lot (FE-M07).
4. **Frontend et frontend :** pages dupliquées (FE-M15), trois systèmes de composants (FE-M14), règles d'organisation active différentes dans `AppLayout` et `redirects` (FE-E03).

---

## 9. Reproductibilité des contrôles

Tous les contrôles ont été exécutés depuis `apps/web/`. Les sorties sont dans le dossier temporaire de session, hors du dépôt.

| Contrôle | Commande | Résultat |
|---|---|---|
| Typage | `npx tsc --noEmit -p tsconfig.json` | sortie 0 |
| Build isolé | `npx vite build --outDir <tmp>/dist-build --emptyOutDir` | succès, 9,7 s |
| Tests unitaires | `npx vitest run` | 8 échecs sur 8 (2 fichiers) |
| Tests de redirection | `node --test scripts/redirects.test.mjs` | 29/29 |
| Intégrité du dépôt | `git status --porcelain .` avant et après | identique |
| Correspondance API | script de confrontation `endpoints.ts` ↔ routeurs Express | 311/311 chemins existants |
| Liens internes | script de confrontation des liens ↔ `App.tsx` | 18 liens cassés sur 658 |
| i18n | script de comptage `t()` et chaînes JSX/propriétés | 9 `t()`, ≈ 2 020 chaînes en dur |
| FE-C01 | reproduction isolée (adaptateur axios 401 → 200) | `{}` au lieu de `{data, meta}` |

---

*Fin du rapport. Aucune correction n'a été appliquée ; le plan est soumis à validation : [PLAN_CORRECTION_FRONTEND.md](PLAN_CORRECTION_FRONTEND.md).*
