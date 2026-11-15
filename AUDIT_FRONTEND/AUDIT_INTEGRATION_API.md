# Audit de l'intégration API — AGRIKONNECT AFRICA (application web)

> Périmètre : `apps/web/src/services/*`, `src/store/auth.ts` et la consommation des services par les pages. Le frontend est confronté au backend réel (`backend/src/routes/index.js` et routeurs de modules, schémas Zod).
>
> Méthode : confrontation automatique des 311 appels de `services/endpoints.ts` aux routes Express montées, vérification manuelle des schémas des cas litigieux, et reproduction isolée du défaut de rejeu. Aucun appel n'a été émis vers une base réelle. Aucun fichier modifié.

## 1. Synthèse

| Contrôle | Résultat | Statut |
|---|---|---|
| Chemins et méthodes : existence côté backend | **311 / 311** | CONFORME |
| Fonctions client reliées à un écran | **171 / 311** (140 inutilisées, 45 %) | PARTIELLEMENT IMPLÉMENTÉ |
| Rejeu après rafraîchissement du jeton | Données perdues (reproduit) | **NON CONFORME (CRITIQUE)** |
| Paramètres conformes aux schémas | 3 écarts bloquants (limit 200, rôle PRODUCER, QR de lot) | NON CONFORME |
| Routes publiques supposées vs réelles | 4 écrans publics appellent des routes authentifiées | NON CONFORME |
| Pagination | Ignorée par les 61 écrans `ResourcePage` ; seules 8 pages lisent `meta` | NON IMPLÉMENTÉ |
| Données fictives ou simulées | Aucune donnée métier simulée ; **40 mini-graphiques décoratifs codés en dur** | NON CONFORME (FE-E08) |
| Gestion des erreurs | Enveloppe décodée, `RequestError` typée ; messages non traduits | À AMÉLIORER |

## 2. Architecture du client

### 2.1 Configuration

| Paramètre | Valeur | Preuve |
|---|---|---|
| URL de base | `VITE_API_BASE_URL`, sinon `http://localhost:4000/api/v1` | `lib/config.ts:12-15` |
| Temps réel | `VITE_REALTIME_URL`, sinon `http://localhost:4000`, chemin `/realtime` | `lib/config.ts:17-20,38` |
| Délai par défaut | 20 s ; envoi 60 s ; géospatial 25 s (`timeoutMs`) | `lib/config.ts:32-36`, `endpoints.ts:397` |
| En-têtes | `Authorization: Bearer`, `X-Organization-Id`, `Accept-Language`, `Idempotency-Key` (ULID), `X-Client` | `services/http.ts:42-75` |

**Défaut (FE-M12) :** le repli sur `localhost` est silencieux en build de production. Le `dist/` local actuel en contient la preuve : `http://localhost:4000/api/v1` dans `dist/assets/index-DO-iKtoh.js`.

### 2.2 Couches

```
pages ─▶ services/endpoints.ts (311 fonctions, 44 objets) ─▶ api.get/post/patch/put/delete
       ─▶ http (instance axios) ─▶ intercepteur requête ─▶ réseau
                                  ◀─ intercepteur réponse (401 → refresh → rejeu ; sinon RequestError)
       ◀─ request() : { data: body.data, meta: body.meta, message }
```

- **Enveloppe serveur :** `{ success, message?, data, meta? }` en succès et `{ success:false, message, requestId, errors?, details? }` en erreur (`http.ts:19-21`). C'est conforme au backend (`backend/src/shared/http`).
- **Erreurs :** `RequestError` (`services/types.ts:46-75`) porte `status`, `fields`, `details`, `requestId`, `mfaRequired` et un `kind` dérivé.
- **Cache :** TanStack Query (`services/query.ts:26-39`) avec `staleTime` 60 s, `gcTime` 10 min et une relance seulement sur erreur réseau (2 fois) ou 5xx (1 fois), jamais sur 4xx. Les clés sont centralisées (`query.ts:45-283`).
- **Requêtes simultanées :** le rafraîchissement est mono-vol (`services/session.ts:98-121`). Les autres requêtes ne sont pas dédupliquées hors TanStack Query, et aucune annulation (`AbortController` ou `signal`) n'est transmise à axios : une requête obsolète va à son terme.

## 3. Authentification et gestion des jetons

| Aspect | Constat | Statut | Réf. |
|---|---|---|---|
| Connexion | `POST /auth/login` (anonyme, sans rafraîchissement, idempotent) ; branche MFA si `details.mfaRequired` | CONFORME | `store/auth.ts:98-127`, `endpoints.ts:211-212` |
| Session | `{accessToken, refreshToken, expiresIn}` placée dans `sessionStore` | — | `session.ts:66-72` |
| Stockage | **`sessionStorage` + `localStorage`** pour les deux jetons et le profil | NON CONFORME | FE-E01, `session.ts:31-38` |
| Bearer | Posé si `!anonymous` | CONFORME | `http.ts:58-60` |
| Rafraîchissement | Au premier 401, mono-vol, rotatif (les deux jetons changent) | CONFORME (conception) | `session.ts:98-121` |
| **Rejeu** | `replay()` renvoie `response.data` au lieu d'une `AxiosResponse` : `request()` lit `data.data` et obtient `undefined` | **NON CONFORME — CRITIQUE** | FE-C01, §4 |
| Échec du rafraîchissement | Toute exception vide la session, y compris une coupure réseau | NON CONFORME | FE-M05, `session.ts:112-114` |
| Rafraîchissement proactif | `isFresh()` (`session.ts:61-64`) défini mais jamais utilisé ; `expiresAt` à `null` après restauration | À AMÉLIORER | — |
| Démarrage | `/me` puis `/me/permissions` ; en cas d'échec, **profil en cache et `permissions: []`** | NON CONFORME (combiné à FE-C01) | `store/auth.ts:68-96` |
| Déconnexion | `POST /auth/logout` puis purge locale, **sans purge de l'organisation active** | NON CONFORME | FE-E03, `store/auth.ts:145-154` |
| Organisation active | `X-Organization-Id` lu dans `localStorage` sans validation ; le backend répond 404 si l'utilisateur n'est pas membre | NON CONFORME | FE-E03, `http.ts:61-64`, `backend/src/middleware/tenant.js:28-33` |
| Temps réel | `handshake.auth.token` lu à la création seulement ; pas de mise à jour après rafraîchissement | NON CONFORME | FE-M04, `realtime.ts:57-69` |

## 4. Défaut critique FE-C01 — démonstration

**Code (`apps/web/src/services/http.ts`) :**

```ts
// :93-105
async function replay(config) {
  …
  const response = await axios.request({ ...config, headers, … });
  return response.data;                 // ← enveloppe {success, data, meta}
}
// :113-117
if (status === 401 && config && !config._retried && …) {
  config._retried = true;
  const token = await sessionStore.refresh();
  if (token) return replay(config);     // ← devient la valeur résolue de http.request()
}
// :130-137
const response = await http.request(…);   // ← reçoit l'enveloppe, pas une AxiosResponse
const body = response.data;                // ← = payload
return { data: body.data, meta: body.meta };  // ← payload.data → undefined
```

**Reproduction isolée** : copie conforme des trois fonctions, avec l'axios du projet chargé en lecture seule et un adaptateur 401 puis 200.

```
Attendu (cas nominal)      : {"data":[{"id":"A"},{"id":"B"}],"meta":{"total":2}}
Obtenu après 401+refresh : {}
```

**Effets en chaîne :**
1. Les listes et fiches chargées au moment de l'expiration renvoient `undefined`. TanStack Query v5 refuse `undefined` comme donnée, et la page passe en erreur.
2. Au démarrage avec un jeton expiré, `authApi.me()` renvoie `data` indéfini, `data.user` lève une exception, et l'application se replie sur le profil en cache avec `permissions: []`. L'utilisateur apparaît connecté sans droits.
3. Les mutations rejouées sont bien exécutées côté serveur, mais l'interface affiche une erreur. L'utilisateur risque de relancer l'action (l'idempotence limite le risque pour les `POST idempotent: true` uniquement).
4. Les erreurs du rejeu échappent à `toRequestError` : elles arrivent comme `AxiosError` brutes.

**Correction :** `return http.request(config)` (le marqueur `_retried` empêche la boucle). Tests : voir le plan, tâche 0.2.

## 5. Écarts de contrat (paramètres, routes, réponses)

| # | Appel frontend | Contrat backend | Écart | Effet | Réf. |
|---|---|---|---|---|---|
| A1 | `verificationApi.adminQueue({ limit: 200, status: '' })` — `pages/reviewer/Checklist.tsx:58` | `listVerificationsSchema = paginationSchema.extend(…)` avec `limit ≤ 100` (`backend/src/shared/pagination.js:15`, `verification.schema.js:21`) | 200 > 100 | **422 systématique** : la checklist est inutilisable | FE-E05 |
| A2 | Même appel : « status omis volontairement : … déjà traités » (`Checklist.tsx:54`) | `status ? {status} : {status:'PENDING'}` (`verification.service.js:129`) | Le commentaire contredit le comportement | Les dossiers traités ne sont jamais listés | FE-E05 |
| A3 | `/admin/verifications` appelé par les rôles AGRONOMIST et LAB_PARTNER (`lib/redirects.ts:81-82`) | `authorize('verifications.review')`, accordée à SA et AD (`verification.routes.js:31-34`) | Permission absente | **403** | FE-E05 |
| A4 | `adminApi.users({ role: 'PRODUCER' })` — `pages/admin/Producers.tsx:15` | `role: z.enum(ALL_ROLES)` (`backend/src/modules/admin/admin.schema.js:29`) ; `PRODUCER` est un groupe de permissions | Valeur hors énumération | **422** | FE-M08 |
| A5 | `listingApi.list` depuis la page **publique** `/market` (`MarketPublic.tsx:17-19`, `public`) | `router.use(authenticate, resolveTenant)` (`listings.routes.js:14`) | Route authentifiée | 401 pour un visiteur | FE-E07 |
| A6 | `insightsApi.overview/disclosurePolicy` depuis `/public/agriculture/:cc` et `/public/data` | `router.use(authenticate, resolveTenant)` (`insights.routes.js:20`) | Route authentifiée | 401 pour un visiteur | FE-E07 |
| A7 | `window.open('/api/v1/public/lots/${code}/qr.png')` — `pages/farmer/Lots/Detail.tsx:26` | Seule `/public/farms/:slug/qr.:format` existe (`public.routes.js:44`) | Route inexistante, et chemin relatif à l'origine du frontend | 404 | FE-M07 |
| A8 | `window.open(adminApi.exportFarms())` — `pages/admin/Reports.tsx:46` | Route authentifiée (Bearer) | Le navigateur n'envoie pas le Bearer | 401 | FE-M07 |
| A9 | `precisionApi.pdfUrl(id)` (`endpoints.ts:389`) | Route authentifiée | Même problème (latent : fonction inutilisée) | — | FE-M07 |
| A10 | `authApi.changePassword({ currentPassword, newPassword })` (`endpoints.ts:227-228`) | Le schéma n'exige que `newPassword` (`users.schema.js:18-19`) ; `currentPassword` est ignoré | Contrat ambigu (et fonction inutilisée) | Faille backend H-04 | backend H-04 |
| A11 | `smsConsentApi.withdraw()` sans corps (`endpoints.ts:662`) | Repli serveur sur `SMS_ALERT_PURPOSE` | Documenté dans le code ; dépend d'un défaut serveur | Fragile si un second usage apparaît | — |
| A12 | Listes avec `limit: 100` sans lecture de `meta` (97 occurrences ; 8 pages lisent `meta`) | Pagination `page/limit/total` | Pagination ignorée | Troncature silencieuse au-delà de 100 | FE-M06 |
| A13 | `ResourcePage` accepte `T[]` **ou** `{items: T[]}` (`ResourcePage.tsx:72-77`) | Formes hétérogènes selon le module | Tolérance défensive qui masque les écarts de contrat | Une forme inattendue s'affiche comme un état vide, sans erreur | À AMÉLIORER |

Les limites `limit: 500` utilisées par la carte (`public/MapPage.tsx:18-19`, `public/About.tsx:30`) sont **conformes** : `public.schema.js:12` autorise jusqu'à 500.

## 6. Fonctions client non reliées à l'interface (140)

Elles sont définies dans `services/endpoints.ts`, leurs chemins sont valides côté backend, mais **aucun écran ne les appelle**.

| Objet | Fonctions inutilisées |
|---|---|
| `publicApi` | `contactFarm`, `farmQrUrl` |
| `authApi` | `changePassword`, `syncProfile` |
| `referenceApi` | `crop`, `fxRates` |
| `farmApi` | `update`, `publish`, `remove` |
| `plotApi` | `update`, `remove`, `cropHistory`, `addCropHistory` |
| `productionApi` | `create`, `update`, `remove` |
| `soilApi` | `assessments`, `createAssessment`, `updateAssessment`, `removeAssessment`, `computeSuitability`, `explainSuitability`, `proposeRotation`, `decideRotation`, `proposeFarmingPlan`, `yieldEstimates`, `estimateYield` |
| `precisionApi` | `computeZones`, `createReport`, `validateReport`, `pdfUrl` |
| `geoApi` | `diagnose`, `latest`, `history`, `one`, `health` |
| `listingApi` | `update`, `setStatus`, `attachPhotos`, `remove` |
| `requestApi` | `get`, `update`, `offers`, `submitOffer`, `updateOffer` |
| `inventoryApi` | `create`, `movements`, `addMovement` |
| `reviewApi` | `create`, `respond`, `report`, `moderate`, `reputation` |
| `orderApi` | `setPayment`, `dispute`, `resolveDispute` |
| `priceApi` | `series`, `staleMarkets`, `record` |
| `weatherApi` | `history`, `alerts` |
| `tenderApi` | `get`, `respond` |
| `lotApi` | `addEvent`, `setPublicFields`, `recall` |
| `insightsApi` | `activity` |
| `dashboardApi` | `invest` |
| `messagingApi` | `createConversation`, `archive`, `block`, `reportMessage` |
| `seasonApi` | `get`, `update`, `archive`, `stats` |
| `notificationApi` | `preferences`, `setPreferences` |
| `iotApi` | `registerDevice`, `rotateKey`, `revoke`, `readings` |
| `organizationApi` | `create`, `update` |
| `cooperativeApi` | `updateCurrent`, `addMember`, `updateMember`, `previewGroupOffer`, `createGroupOffer`, `confirmGroupOffer`, `cancelGroupOffer` |
| `verificationApi` | `request` |
| `certificationApi` | `create`, `forOrganization`, `get`, `remove` |
| `aiApi` | `analyze`, `analyzeDocument`, `feedback` |
| `apiClientApi` | `usage` |
| `investApi` | `unfollow`, `matches`, `contact`, `decideContact`, `contactRequests`, `profile`, `updateProfile`, `dashboard` |
| `projectDataApi` | `addDocument`, `requestAccess`, `decideAccess`, `document`, `fundingRequests`, `consentFunding`, `transmitFunding`, `followUpFunding`, `addProgressReport`, `addImpactReport` |
| `transportApi` | `create`, `offer`, `acceptOffer`, `proofOfDelivery`, `setStatus` |
| `adminApi` | `operationsDetail`, `updateSettings` |
| `mediaApi` | `uploadUrl`, `confirm` |
| `satelliteApi` | `settings` |
| `syncApi` | `push` |
| `recommendationApi` | `one`, `explanation` |
| `alertApi` | `one` |
| `anomalyApi` | `one`, `detectDevice`, `detectPlot` |
| `exportApi` | `create`, `addDocument`, `setStatus` |
| `agronomicRangeApi` | `list`, `one` |

> **Remarque.** Certaines absences sont compensées par d'autres appels : par exemple, `agronomicRangeApi.list` est remplacé par des requêtes filtrées, et `adminApi.updateSettings` peut être remplacé par une autre fonction de sauvegarde. D'autres correspondent à des **fonctionnalités entières sans interface** : saisie de production, diagnostic de sol, cycle transport, litiges, offres, avis, téléversement, changement de mot de passe, profil investisseur. Voir FE-E06.

## 7. Données fictives ou simulées

| Constat | Preuve | Statut |
|---|---|---|
| Aucune donnée métier simulée : listes, fiches et indicateurs proviennent de l'API, avec états vide et erreur explicites | `components/pages/ResourcePage.tsx:12-17`, `README.md` | CONFORME |
| Mini-graphiques « tendance » à **valeurs fixes** dans 10 tableaux de bord (40 occurrences) | par ex. `pages/app/Dashboard.tsx:227` `bars: [35, 56, 70, (tiles.plots ?? 0) > 0 ? 84 : 18]` | **NON CONFORME** (FE-E08) |
| Valeur par défaut fictive | `design-system/components/HorizonDashboard.tsx:979` `cell.bars ?? [45, 78, 38, 64]` | **NON CONFORME** |
| Lien vers un lot `demo` | `Footer.tsx:27`, `Home.tsx:606`, `homeSlides.ts:55`, `lib/platform.ts:30` | NON VÉRIFIABLE (FE-M20) |
| Tests : `publicApi` simulé par `vi.mock` | `tests/home.test.tsx:7-12` | Conforme (tests uniquement) |

## 8. Temps réel (Socket.IO)

| Événement écouté (`realtime.ts`) | Émis par le backend | Action |
|---|---|---|
| `message:new`, `message:read`, `conversation:new`, `conversation:blocked` | Oui (`messaging.service.js`, `realtime/bus.js`) | Invalidation de `messaging.*` |
| `order:new`, `order:updated`, `order:disputed` | Oui (`orders.service.js`) | Invalidation de `orders.all` |
| `notification:new` | Oui (`emitToUser`) | Invalidation de `notifications.all` |
| `alert:new` | Oui (`alerts.service.js:560`) | Invalidation de `alerts.all` |
| `ready`, `typing` | Oui (`realtime/index.js:105,116-120`) | Relais local |
| Envoi `conversation:join`, `typing` | Gérés (`realtime/index.js:116,129`) | — |

**Constat :** le contrat d'événements est cohérent. Les défauts portent sur le jeton figé (FE-M04) et sur l'absence de `conversation:leave` côté client : le backend le gère (`realtime/index.js:146`), mais le client ne quitte jamais un salon.

## 9. Recommandations transverses

1. **Corriger FE-C01** et ajouter des tests d'intercepteur avec un adaptateur simulé.
2. **Générer les types et le client** depuis un contrat OpenAPI publié par le backend : supprimer les 124 `Record<string, unknown>` et détecter les écarts A1 à A4 à la compilation.
3. **Valider les réponses** critiques (`/me`, `/me/permissions`, `/auth/*`) par un schéma Zod côté client, pour éviter les `undefined` silencieux.
4. **Transmettre `signal`** (fourni par TanStack Query) à axios pour annuler les requêtes obsolètes.
5. **Téléchargements authentifiés** par un utilitaire unique (`downloadAuthenticated(url, filename)`), modèle déjà présent dans `pages/admin/AuditLog.tsx:30-40`.
6. **Pagination standard** dans `ResourcePage`, avec un plafond de `limit` à 100 vérifié par un test.
7. **Supprimer** les fonctions définitivement non retenues pour que `endpoints.ts` reflète la réalité de l'interface.

## 10. Annexe A — Synthèse par objet client

| Objet client | Fonctions | Utilisées | Non utilisées |
|---|---:|---:|---:|
| `publicApi` | 10 | 8 | 2 |
| `authApi` | 20 | 18 | 2 |
| `referenceApi` | 5 | 3 | 2 |
| `farmApi` | 6 | 3 | 3 |
| `plotApi` | 7 | 3 | 4 |
| `productionApi` | 5 | 2 | 3 |
| `soilApi` | 15 | 4 | 11 |
| `precisionApi` | 6 | 2 | 4 |
| `geoApi` | 6 | 1 | 5 |
| `listingApi` | 8 | 4 | 4 |
| `requestApi` | 8 | 3 | 5 |
| `inventoryApi` | 4 | 1 | 3 |
| `reviewApi` | 5 | 0 | 5 |
| `orderApi` | 8 | 5 | 3 |
| `priceApi` | 4 | 1 | 3 |
| `weatherApi` | 3 | 1 | 2 |
| `tenderApi` | 3 | 1 | 2 |
| `lotApi` | 5 | 2 | 3 |
| `projectApi` | 3 | 3 | 0 |
| `insightsApi` | 4 | 3 | 1 |
| `dashboardApi` | 2 | 1 | 1 |
| `messagingApi` | 7 | 3 | 4 |
| `seasonApi` | 7 | 3 | 4 |
| `smsConsentApi` | 3 | 3 | 0 |
| `notificationApi` | 5 | 3 | 2 |
| `iotApi` | 5 | 1 | 4 |
| `organizationApi` | 4 | 2 | 2 |
| `cooperativeApi` | 12 | 5 | 7 |
| `verificationApi` | 4 | 3 | 1 |
| `certificationApi` | 6 | 2 | 4 |
| `aiApi` | 8 | 5 | 3 |
| `apiClientApi` | 6 | 5 | 1 |
| `investApi` | 11 | 3 | 8 |
| `projectDataApi` | 13 | 3 | 10 |
| `transportApi` | 6 | 1 | 5 |
| `adminApi` | 37 | 35 | 2 |
| `mediaApi` | 3 | 1 | 2 |
| `satelliteApi` | 3 | 2 | 1 |
| `syncApi` | 4 | 3 | 1 |
| `recommendationApi` | 5 | 3 | 2 |
| `alertApi` | 5 | 4 | 1 |
| `anomalyApi` | 6 | 3 | 3 |
| `exportApi` | 5 | 2 | 3 |
| `agronomicRangeApi` | 9 | 7 | 2 |

## 11. Annexe B — Les 311 appels (ordre de `services/endpoints.ts`)

Colonne « Route backend » : fichier:ligne de la déclaration de route (chemins relatifs à `backend/`). Pour `/auth/*` et `/health`, la correspondance a été vérifiée manuellement (`backend/src/modules/auth/auth.routes.js:15-48`, `backend/src/routes/index.js:80`).

| # | Fonction client | Méthode | Chemin | endpoints.ts | Route backend | Utilisée par un écran |
|---:|---|---|---|---|---|---|
| 1 | `publicApi.blogPosts` | GET | `/public/blog-posts` | :166 | `src/modules/blog/blog.routes.js:58` | oui |
| 2 | `publicApi.blogPost` | GET | `/public/blog-posts/${encodeURIComponent(slug)}` | :168 | `src/modules/blog/blog.routes.js:71` | oui |
| 3 | `publicApi.map` | GET | `/public/map` | :172 | `src/modules/public/public.routes.js:16` | oui |
| 4 | `publicApi.farms` | GET | `/public/farms` | :176 | `src/modules/public/public.routes.js:22` | oui |
| 5 | `publicApi.farm` | GET | `/public/farms/${encodeURIComponent(slug)}` | :179 | `src/modules/public/public.routes.js:28` | oui |
| 6 | `publicApi.contactFarm` | POST | `/public/farms/${encodeURIComponent(slug)}/contact` | :183 | `src/modules/public/public.routes.js:34` | **non** |
| 7 | `publicApi.soilStats` | GET | `/public/soil-stats` | :191 | `src/modules/public/public.routes.js:70` | oui |
| 8 | `publicApi.lot` | GET | `/public/lots/${encodeURIComponent(code)}` | :195 | `src/modules/traceability/public.routes.js:13` | oui |
| 9 | `publicApi.health` | GET | `/health` | :202 | `routes/index.js:80` | oui |
| 10 | `authApi.login` | POST | `/auth/login` | :212 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 11 | `authApi.register` | POST | `/auth/register` | :215 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 12 | `authApi.refresh` | POST | `/auth/refresh` | :219 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 13 | `authApi.logout` | POST | `/auth/logout` | :221 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 14 | `authApi.me` | GET | `/me` | :224 | `src/modules/users/users.routes.js:20` | oui |
| 15 | `authApi.updateMe` | PATCH | `/me` | :225 | `src/modules/users/users.routes.js:21` | oui |
| 16 | `authApi.permissions` | GET | `/me/permissions` | :226 | `src/modules/users/users.routes.js:22` | oui |
| 17 | `authApi.changePassword` | POST | `/me/password` | :228 | `src/modules/users/users.routes.js:23` | **non** |
| 18 | `authApi.forgotPassword` | POST | `/auth/forgot-password` | :231 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 19 | `authApi.resetPassword` | POST | `/auth/reset-password` | :233 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 20 | `authApi.resendVerification` | POST | `/auth/resend-verification` | :235 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 21 | `authApi.verifyEmail` | POST | `/auth/verify-email` | :244 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 22 | `authApi.mfaStatus` | GET | `/auth/mfa/status` | :247 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 23 | `authApi.mfaSetup` | POST | `/auth/mfa/setup` | :253 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 24 | `authApi.mfaConfirm` | POST | `/auth/mfa/confirm` | :263 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 25 | `authApi.mfaVerify` | POST | `/auth/mfa/verify` | :277 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 26 | `authApi.mfaDisable` | POST | `/auth/mfa/disable` | :278 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 27 | `authApi.sendOtp` | POST | `/auth/send-otp` | :282 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 28 | `authApi.verifyPhone` | POST | `/auth/verify-phone` | :284 | `modules/auth/auth.routes.js (vérifié manuellement)` | oui |
| 29 | `authApi.syncProfile` | POST | `/auth/sync-profile` | :285 | `modules/auth/auth.routes.js (vérifié manuellement)` | **non** |
| 30 | `referenceApi.crops` | GET | `/crops` | :292 | `src/modules/crops/crops.routes.js:19` | oui |
| 31 | `referenceApi.crop` | GET | `/crops/${id}` | :293 | `src/modules/crops/crops.routes.js:20` | **non** |
| 32 | `referenceApi.countries` | GET | `/countries` | :295 | `src/modules/countries/countries.routes.js:35` | oui |
| 33 | `referenceApi.country` | GET | `/countries/${code.toUpperCase()}` | :298 | `src/modules/countries/countries.routes.js:48` | oui |
| 34 | `referenceApi.fxRates` | GET | `/countries/fx-rates` | :299 | `src/modules/countries/countries.routes.js:98` | **non** |
| 35 | `farmApi.list` | GET | `/farms` | :305 | `src/modules/farms/farms.routes.js:14` | oui |
| 36 | `farmApi.create` | POST | `/farms` | :306 | `src/modules/farms/farms.routes.js:15` | oui |
| 37 | `farmApi.get` | GET | `/farms/${id}` | :307 | `src/modules/farms/farms.routes.js:16` | oui |
| 38 | `farmApi.update` | PATCH | `/farms/${id}` | :308 | `src/modules/farms/farms.routes.js:17` | **non** |
| 39 | `farmApi.publish` | PATCH | `/farms/${id}/publish` | :309 | `src/modules/farms/farms.routes.js:24` | **non** |
| 40 | `farmApi.remove` | DELETE | `/farms/${id}` | :310 | `src/modules/farms/farms.routes.js:31` | **non** |
| 41 | `plotApi.list` | GET | `/plots` | :315 | `src/modules/plots/plots.routes.js:14` | oui |
| 42 | `plotApi.create` | POST | `/plots` | :316 | `src/modules/plots/plots.routes.js:15` | oui |
| 43 | `plotApi.get` | GET | `/plots/${id}` | :318 | `src/modules/plots/plots.routes.js:17` | oui |
| 44 | `plotApi.update` | PATCH | `/plots/${id}` | :319 | `src/modules/plots/plots.routes.js:18` | **non** |
| 45 | `plotApi.remove` | DELETE | `/plots/${id}` | :320 | `src/modules/plots/plots.routes.js:25` | **non** |
| 46 | `plotApi.cropHistory` | GET | `/plots/${id}/crop-history` | :322 | `src/modules/plots/plots.routes.js:33` | **non** |
| 47 | `plotApi.addCropHistory` | POST | `/plots/${id}/crop-history` | :324 | `src/modules/plots/plots.routes.js:39` | **non** |
| 48 | `productionApi.list` | GET | `/productions` | :329 | `src/modules/productions/productions.routes.js:15` | oui |
| 49 | `productionApi.stats` | GET | `/productions/stats` | :332 | `src/modules/productions/productions.routes.js:14` | oui |
| 50 | `productionApi.create` | POST | `/productions` | :334 | `src/modules/productions/productions.routes.js:21` | **non** |
| 51 | `productionApi.update` | PATCH | `/productions/${id}` | :335 | `src/modules/productions/productions.routes.js:33` | **non** |
| 52 | `productionApi.remove` | DELETE | `/productions/${id}` | :336 | `src/modules/productions/productions.routes.js:40` | **non** |
| 53 | `soilApi.assessments` | GET | `/plots/${plotId}/soil-assessments` | :343 | `src/modules/soil/soil.routes.js:21` | **non** |
| 54 | `soilApi.profile` | GET | `/plots/${plotId}/soil-profile` | :345 | `src/modules/soil/soil.routes.js:28` | oui |
| 55 | `soilApi.createAssessment` | POST | `/plots/${plotId}/soil-assessments` | :347 | `src/modules/soil/soil.routes.js:35` | **non** |
| 56 | `soilApi.updateAssessment` | PATCH | `/plots/${plotId}/soil-assessments/${assessmentId}` | :349 | `src/modules/soil/soil.routes.js:43` | **non** |
| 57 | `soilApi.removeAssessment` | DELETE | `/plots/${plotId}/soil-assessments/${assessmentId}` | :351 | `src/modules/soil/soil.routes.js:51` | **non** |
| 58 | `soilApi.suitability` | GET | `/plots/${plotId}/suitability` | :353 | `src/modules/soil/soil.routes.js:60` | oui |
| 59 | `soilApi.computeSuitability` | POST | `/plots/${plotId}/suitability` | :355 | `src/modules/soil/soil.routes.js:67` | **non** |
| 60 | `soilApi.explainSuitability` | GET | `/plots/${plotId}/suitability/${suitabilityId}` | :357 | `src/modules/soil/soil.routes.js:79` | **non** |
| 61 | `soilApi.rotationPlans` | GET | `/plots/${plotId}/rotation-plans` | :359 | `src/modules/soil/soil.routes.js:88` | oui |
| 62 | `soilApi.proposeRotation` | POST | `/plots/${plotId}/rotation-plans` | :361 | `src/modules/soil/soil.routes.js:95` | **non** |
| 63 | `soilApi.decideRotation` | PATCH | `/plots/${plotId}/rotation-plans/${planId}` | :364 | `src/modules/soil/soil.routes.js:107` | **non** |
| 64 | `soilApi.farmingPlans` | GET | `/plots/${plotId}/farming-plans` | :366 | `src/modules/soil/soil.routes.js:119` | oui |
| 65 | `soilApi.proposeFarmingPlan` | POST | `/plots/${plotId}/farming-plans` | :368 | `src/modules/soil/soil.routes.js:126` | **non** |
| 66 | `soilApi.yieldEstimates` | GET | `/plots/${plotId}/yield-estimates` | :370 | `src/modules/soil/soil.routes.js:138` | **non** |
| 67 | `soilApi.estimateYield` | POST | `/plots/${plotId}/yield-estimates` | :372 | `src/modules/soil/soil.routes.js:145` | **non** |
| 68 | `precisionApi.zones` | GET | `/precision/plots/${plotId}/management-zones` | :378 | `src/modules/precision/precision.routes.js:30` | oui |
| 69 | `precisionApi.computeZones` | POST | `/precision/plots/${plotId}/management-zones` | :381 | `src/modules/precision/precision.routes.js:33` | **non** |
| 70 | `precisionApi.reports` | GET | `/precision/plots/${plotId}/precision-reports` | :382 | `src/modules/precision/precision.routes.js:37` | oui |
| 71 | `precisionApi.createReport` | POST | `/precision/plots/${plotId}/precision-reports` | :384 | `src/modules/precision/precision.routes.js:40` | **non** |
| 72 | `precisionApi.validateReport` | PATCH | `/precision/precision-reports/${id}/validate` | :387 | `src/modules/precision/precision.routes.js:45` | **non** |
| 73 | `geoApi.diagnose` | POST | `/plots/${plotId}/soil-diagnosis` | :395 | `src/modules/geospatial/geospatial.routes.js:162` | **non** |
| 74 | `geoApi.latest` | GET | `/plots/${plotId}/soil-diagnosis/latest` | :400 | `src/modules/geospatial/geospatial.routes.js:182` | **non** |
| 75 | `geoApi.history` | GET | `/plots/${plotId}/soil-diagnosis` | :402 | `src/modules/geospatial/geospatial.routes.js:174` | **non** |
| 76 | `geoApi.one` | GET | `/geospatial/soil-diagnostics/${id}` | :403 | `src/modules/geospatial/geospatial.routes.js:215` | **non** |
| 77 | `geoApi.health` | GET | `/geospatial/health` | :404 | `src/modules/geospatial/geospatial.routes.js:193` | **non** |
| 78 | `geoApi.methods` | GET | `/geospatial/methods` | :406 | `src/modules/geospatial/geospatial.routes.js:199` | oui |
| 79 | `listingApi.list` | GET | `/listings` | :413 | `src/modules/market/listings/listings.routes.js:17` | oui |
| 80 | `listingApi.get` | GET | `/listings/${id}` | :414 | `src/modules/market/listings/listings.routes.js:27` | oui |
| 81 | `listingApi.create` | POST | `/listings` | :415 | `src/modules/market/listings/listings.routes.js:24` | oui |
| 82 | `listingApi.update` | PATCH | `/listings/${id}` | :416 | `src/modules/market/listings/listings.routes.js:30` | **non** |
| 83 | `listingApi.setStatus` | PATCH | `/listings/${id}/status` | :417 | `src/modules/market/listings/listings.routes.js:35` | **non** |
| 84 | `listingApi.contact` | POST | `/listings/${id}/contact` | :420 | `src/modules/market/listings/listings.routes.js:45` | oui |
| 85 | `listingApi.attachPhotos` | POST | `/listings/${id}/photos` | :422 | `src/modules/market/listings/listings.routes.js:58` | **non** |
| 86 | `listingApi.remove` | DELETE | `/listings/${id}` | :423 | `src/modules/market/listings/listings.routes.js:68` | **non** |
| 87 | `requestApi.list` | GET | `/purchase-requests` | :429 | `src/modules/market/requests/requests.routes.js:14` | oui |
| 88 | `requestApi.get` | GET | `/purchase-requests/${id}` | :430 | `src/modules/market/requests/requests.routes.js:22` | **non** |
| 89 | `requestApi.create` | POST | `/purchase-requests` | :431 | `src/modules/market/requests/requests.routes.js:19` | oui |
| 90 | `requestApi.update` | PATCH | `/purchase-requests/${id}` | :432 | `src/modules/market/requests/requests.routes.js:25` | **non** |
| 91 | `requestApi.matches` | GET | `/purchase-requests/${id}/matches` | :434 | `src/modules/market/requests/requests.routes.js:30` | oui |
| 92 | `requestApi.offers` | GET | `/market/purchase-requests/${id}/offers` | :435 | `src/modules/market/offers/offers.routes.js:53` | **non** |
| 93 | `requestApi.submitOffer` | POST | `/market/purchase-requests/${id}/offers` | :437 | `src/modules/market/offers/offers.routes.js:42` | **non** |
| 94 | `requestApi.updateOffer` | PATCH | `/market/offers/${offerId}` | :439 | `src/modules/market/offers/offers.routes.js:60` | **non** |
| 95 | `inventoryApi.list` | GET | `/inventory` | :444 | `src/modules/market/inventory/inventory.routes.js:37` | oui |
| 96 | `inventoryApi.create` | POST | `/inventory` | :445 | `src/modules/market/inventory/inventory.routes.js:40` | **non** |
| 97 | `inventoryApi.movements` | GET | `/inventory/${id}/movements` | :446 | `src/modules/market/inventory/inventory.routes.js:43` | **non** |
| 98 | `inventoryApi.addMovement` | POST | `/inventory/movements` | :448 | `src/modules/market/inventory/inventory.routes.js:47` | **non** |
| 99 | `reviewApi.create` | POST | `/orders/${orderId}/reviews` | :454 | `src/modules/market/reviews/reviews.routes.js:27` | **non** |
| 100 | `reviewApi.respond` | POST | `/reviews/${id}/response` | :456 | `src/modules/market/reviews/reviews.routes.js:31` | **non** |
| 101 | `reviewApi.report` | POST | `/reviews/${id}/report` | :458 | `src/modules/market/reviews/reviews.routes.js:35` | **non** |
| 102 | `reviewApi.moderate` | POST | `/reviews/${id}/moderate` | :460 | `src/modules/market/reviews/reviews.routes.js:39` | **non** |
| 103 | `reviewApi.reputation` | GET | `/organizations/${organizationId}/reputation` | :461 | `src/modules/market/reviews/reviews.routes.js:46` | **non** |
| 104 | `orderApi.list` | GET | `/orders` | :466 | `src/modules/market/orders/orders.routes.js:83` | oui |
| 105 | `orderApi.get` | GET | `/orders/${id}` | :467 | `src/modules/market/orders/orders.routes.js:88` | oui |
| 106 | `orderApi.events` | GET | `/orders/${id}/events` | :468 | `src/modules/market/orders/orders.routes.js:92` | oui |
| 107 | `orderApi.setStatus` | PATCH | `/orders/${id}/status` | :471 | `src/modules/market/orders/orders.routes.js:96` | oui |
| 108 | `orderApi.setPayment` | PATCH | `/orders/${id}/payment` | :473 | `src/modules/market/orders/orders.routes.js:101` | **non** |
| 109 | `orderApi.dispute` | POST | `/orders/${id}/disputes` | :475 | `src/modules/market/orders/orders.routes.js:106` | **non** |
| 110 | `orderApi.adminDisputes` | GET | `/orders/admin/disputes` | :476 | `src/modules/market/orders/orders.routes.js:111` | oui |
| 111 | `orderApi.resolveDispute` | PATCH | `/orders/admin/disputes/${id}` | :478 | `src/modules/market/orders/orders.routes.js:119` | **non** |
| 112 | `priceApi.list` | GET | `/prices` | :486 | `src/modules/prices/prices.routes.js:42` | oui |
| 113 | `priceApi.series` | GET | `/prices/series` | :488 | `src/modules/prices/prices.routes.js:45` | **non** |
| 114 | `priceApi.staleMarkets` | GET | `/prices/stale-markets` | :489 | `src/modules/prices/prices.routes.js:52` | **non** |
| 115 | `priceApi.record` | POST | `/prices` | :490 | `src/modules/prices/prices.routes.js:49` | **non** |
| 116 | `weatherApi.forPlot` | GET | `/weather/plots/${plotId}` | :495 | `src/modules/weather/weather.routes.js:27` | oui |
| 117 | `weatherApi.history` | GET | `/weather/plots/${plotId}/history` | :497 | `src/modules/weather/weather.routes.js:30` | **non** |
| 118 | `weatherApi.alerts` | GET | `/weather/plots/${plotId}/alerts` | :498 | `src/modules/weather/weather.routes.js:33` | **non** |
| 119 | `tenderApi.list` | GET | `/tenders` | :503 | `src/modules/tenders/tenders.routes.js:45` | oui |
| 120 | `tenderApi.get` | GET | `/tenders/${id}` | :504 | `src/modules/tenders/tenders.routes.js:53` | **non** |
| 121 | `tenderApi.respond` | POST | `/tenders/${id}/responses` | :506 | `src/modules/tenders/tenders.routes.js:56` | **non** |
| 122 | `lotApi.list` | GET | `/lots` | :510 | `src/modules/traceability/traceability.routes.js:42` | oui |
| 123 | `lotApi.get` | GET | `/lots/${id}` | :511 | `src/modules/traceability/traceability.routes.js:50` | oui |
| 124 | `lotApi.addEvent` | POST | `/lots/${id}/events` | :513 | `src/modules/traceability/traceability.routes.js:54` | **non** |
| 125 | `lotApi.setPublicFields` | PUT | `/lots/${id}/public-fields` | :516 | `src/modules/traceability/traceability.routes.js:60` | **non** |
| 126 | `lotApi.recall` | POST | `/lots/${id}/recall` | :518 | `src/modules/traceability/traceability.routes.js:64` | **non** |
| 127 | `projectApi.list` | GET | `/projects` | :525 | `src/modules/projects/projects.routes.js:66` | oui |
| 128 | `projectApi.get` | GET | `/projects/${id}` | :526 | `src/modules/projects/projects.routes.js:78` | oui |
| 129 | `projectApi.create` | POST | `/projects` | :533 | `src/modules/projects/projects.routes.js:73` | oui |
| 130 | `insightsApi.overview` | GET | `/insights/overview` | :541 | `src/modules/insights/insights.routes.js:26` | oui |
| 131 | `insightsApi.crops` | GET | `/insights/crops` | :544 | `src/modules/insights/insights.routes.js:33` | oui |
| 132 | `insightsApi.activity` | GET | `/insights/activity` | :547 | `src/modules/insights/insights.routes.js:40` | **non** |
| 133 | `insightsApi.disclosurePolicy` | GET | `/insights/disclosure-policy` | :548 | `src/modules/insights/insights.routes.js:48` | oui |
| 134 | `dashboardApi.farmer` | GET | `/dashboard` | :552 | `src/modules/dashboard/dashboard.routes.js:9` | oui |
| 135 | `dashboardApi.invest` | GET | `/invest` | :553 | `src/modules/investdashboard/dashboard.routes.js:12` | **non** |
| 136 | `messagingApi.conversations` | GET | `/messaging/conversations` | :561 | `src/modules/messaging/messaging.routes.js:45` | oui |
| 137 | `messagingApi.createConversation` | POST | `/messaging/conversations` | :568 | `src/modules/messaging/messaging.routes.js:38` | **non** |
| 138 | `messagingApi.messages` | GET | `/messaging/conversations/${conversationId}/messages` | :571 | `src/modules/messaging/messaging.routes.js:52` | oui |
| 139 | `messagingApi.send` | POST | `/messaging/conversations/${conversationId}/messages` | :575 | `src/modules/messaging/messaging.routes.js:60` | oui |
| 140 | `messagingApi.archive` | POST | `/messaging/conversations/${conversationId}/archive` | :577 | `src/modules/messaging/messaging.routes.js:64` | **non** |
| 141 | `messagingApi.block` | POST | `/messaging/conversations/${conversationId}/block` | :580 | `src/modules/messaging/messaging.routes.js:68` | **non** |
| 142 | `messagingApi.reportMessage` | POST | `/messaging/messages/${messageId}/report` | :582 | `src/modules/messaging/messaging.routes.js:73` | **non** |
| 143 | `seasonApi.list` | GET | `/seasons` | :611 | `src/modules/seasons/seasons.routes.js:25` | oui |
| 144 | `seasonApi.get` | GET | `/seasons/${id}` | :612 | `src/modules/seasons/seasons.routes.js:39` | **non** |
| 145 | `seasonApi.create` | POST | `/seasons` | :629 | `src/modules/seasons/seasons.routes.js:32` | oui |
| 146 | `seasonApi.update` | PATCH | `/seasons/${id}` | :638 | `src/modules/seasons/seasons.routes.js:54` | **non** |
| 147 | `seasonApi.archive` | DELETE | `/seasons/${id}` | :639 | `src/modules/seasons/seasons.routes.js:62` | **non** |
| 148 | `seasonApi.compare` | GET | `/seasons/${id}/compare` | :641 | `src/modules/seasons/seasons.routes.js:47` | oui |
| 149 | `seasonApi.stats` | GET | `/seasons/stats` | :643 | `src/modules/seasons/seasons.routes.js:18` | **non** |
| 150 | `smsConsentApi.get` | GET | `/sms/consent` | :648 | `src/modules/smsDelivery/smsDelivery.routes.js:80` | oui |
| 151 | `smsConsentApi.grant` | POST | `/sms/consent` | :651 | `src/modules/smsDelivery/smsDelivery.routes.js:103` | oui |
| 152 | `smsConsentApi.withdraw` | DELETE | `/sms/consent` | :662 | `src/modules/smsDelivery/smsDelivery.routes.js:124` | oui |
| 153 | `notificationApi.list` | GET | `/notifications` | :668 | `src/modules/notifications/notifications.routes.js:34` | oui |
| 154 | `notificationApi.readAll` | POST | `/notifications/read-all` | :669 | `src/modules/notifications/notifications.routes.js:41` | oui |
| 155 | `notificationApi.read` | POST | `/notifications/${id}/read` | :670 | `src/modules/notifications/notifications.routes.js:44` | oui |
| 156 | `notificationApi.preferences` | GET | `/notifications/preferences` | :672 | `src/modules/notifications/notifications.routes.js:48` | **non** |
| 157 | `notificationApi.setPreferences` | PUT | `/notifications/preferences` | :674 | `src/modules/notifications/notifications.routes.js:51` | **non** |
| 158 | `iotApi.devices` | GET | `/iot/devices` | :681 | `src/modules/iot/iot.routes.js:61` | oui |
| 159 | `iotApi.registerDevice` | POST | `/iot/devices` | :688 | `src/modules/iot/iot.routes.js:64` | **non** |
| 160 | `iotApi.rotateKey` | POST | `/iot/devices/${id}/rotate-key` | :690 | `src/modules/iot/iot.routes.js:67` | **non** |
| 161 | `iotApi.revoke` | POST | `/iot/devices/${id}/revoke` | :692 | `src/modules/iot/iot.routes.js:70` | **non** |
| 162 | `iotApi.readings` | GET | `/iot/devices/${id}/readings` | :695 | `src/modules/iot/iot.routes.js:74` | **non** |
| 163 | `organizationApi.list` | GET | `/organizations` | :703 | `src/modules/organizations/organizations.routes.js:13` | oui |
| 164 | `organizationApi.create` | POST | `/organizations` | :704 | `src/modules/organizations/organizations.routes.js:14` | **non** |
| 165 | `organizationApi.get` | GET | `/organizations/${id}` | :706 | `src/modules/organizations/organizations.routes.js:15` | oui |
| 166 | `organizationApi.update` | PATCH | `/organizations/${id}` | :707 | `src/modules/organizations/organizations.routes.js:16` | **non** |
| 167 | `cooperativeApi.current` | GET | `/cooperatives/current` | :712 | `src/modules/cooperatives/cooperatives.routes.js:15` | oui |
| 168 | `cooperativeApi.updateCurrent` | PATCH | `/cooperatives/current` | :713 | `src/modules/cooperatives/cooperatives.routes.js:16` | **non** |
| 169 | `cooperativeApi.members` | GET | `/cooperatives/${id}/members` | :715 | `src/modules/cooperatives/cooperatives.routes.js:19` | oui |
| 170 | `cooperativeApi.addMember` | POST | `/cooperatives/${id}/members` | :717 | `src/modules/cooperatives/cooperatives.routes.js:26` | **non** |
| 171 | `cooperativeApi.importMembers` | POST | `/cooperatives/${id}/members/import` | :719 | `src/modules/cooperatives/cooperatives.routes.js:33` | oui |
| 172 | `cooperativeApi.updateMember` | PATCH | `/cooperatives/${id}/members/${memberId}` | :721 | `src/modules/cooperatives/cooperatives.routes.js:40` | **non** |
| 173 | `cooperativeApi.overview` | GET | `/cooperatives/${id}/overview` | :722 | `src/modules/cooperatives/cooperatives.routes.js:47` | oui |
| 174 | `cooperativeApi.previewGroupOffer` | POST | `/cooperatives/${id}/group-offers/preview` | :725 | `src/modules/cooperatives/cooperatives.routes.js:55` | **non** |
| 175 | `cooperativeApi.groupOffers` | GET | `/cooperatives/${id}/group-offers` | :726 | `src/modules/cooperatives/cooperatives.routes.js:62` | oui |
| 176 | `cooperativeApi.createGroupOffer` | POST | `/cooperatives/${id}/group-offers` | :728 | `src/modules/cooperatives/cooperatives.routes.js:69` | **non** |
| 177 | `cooperativeApi.confirmGroupOffer` | POST | `/cooperatives/${id}/group-offers/${offerId}/confirm` | :730 | `src/modules/cooperatives/cooperatives.routes.js:76` | **non** |
| 178 | `cooperativeApi.cancelGroupOffer` | POST | `/cooperatives/${id}/group-offers/${offerId}/cancel` | :732 | `src/modules/cooperatives/cooperatives.routes.js:82` | **non** |
| 179 | `verificationApi.request` | POST | `/verifications` | :739 | `src/modules/verification/verification.routes.js:15` | **non** |
| 180 | `verificationApi.mine` | GET | `/verifications/me` | :744 | `src/modules/verification/verification.routes.js:22` | oui |
| 181 | `verificationApi.adminQueue` | GET | `/admin/verifications` | :747 | `src/modules/verification/verification.routes.js:31` | oui |
| 182 | `verificationApi.decide` | PATCH | `/admin/verifications/${id}` | :749 | `src/modules/verification/verification.routes.js:38` | oui |
| 183 | `certificationApi.list` | GET | `/certifications` | :753 | `src/modules/certifications/certifications.routes.js:38` | oui |
| 184 | `certificationApi.create` | POST | `/certifications` | :754 | `src/modules/certifications/certifications.routes.js:43` | **non** |
| 185 | `certificationApi.forOrganization` | GET | `/certifications/organization/${organizationId}` | :755 | `src/modules/certifications/certifications.routes.js:48` | **non** |
| 186 | `certificationApi.get` | GET | `/certifications/${id}` | :756 | `src/modules/certifications/certifications.routes.js:51` | **non** |
| 187 | `certificationApi.verify` | PATCH | `/certifications/${id}/verify` | :758 | `src/modules/certifications/certifications.routes.js:55` | oui |
| 188 | `certificationApi.remove` | DELETE | `/certifications/${id}` | :759 | `src/modules/certifications/certifications.routes.js:59` | **non** |
| 189 | `aiApi.analyze` | POST | `/ai/analyses` | :766 | `src/modules/ai/ai.routes.js:45` | **non** |
| 190 | `aiApi.copilot` | POST | `/ai/copilot` | :768 | `src/modules/ai/ai.routes.js:49` | oui |
| 191 | `aiApi.analyzeDocument` | POST | `/ai/documents` | :770 | `src/modules/ai/ai.routes.js:55` | **non** |
| 192 | `aiApi.list` | GET | `/ai/analyses` | :772 | `src/modules/ai/ai.routes.js:60` | oui |
| 193 | `aiApi.get` | GET | `/ai/analyses/${id}` | :773 | `src/modules/ai/ai.routes.js:67` | oui |
| 194 | `aiApi.escalate` | POST | `/ai/analyses/${id}/escalate` | :776 | `src/modules/ai/ai.routes.js:71` | oui |
| 195 | `aiApi.review` | POST | `/ai/analyses/${id}/review` | :777 | `src/modules/ai/ai.routes.js:76` | oui |
| 196 | `aiApi.feedback` | POST | `/ai/analyses/${id}/feedback` | :779 | `src/modules/ai/ai.routes.js:83` | **non** |
| 197 | `apiClientApi.clients` | GET | `/api-clients/clients` | :785 | `src/modules/apiclients/apiclients.routes.js:30` | oui |
| 198 | `apiClientApi.create` | POST | `/api-clients/clients` | :787 | `src/modules/apiclients/apiclients.routes.js:33` | oui |
| 199 | `apiClientApi.setPurpose` | PATCH | `/api-clients/clients/${id}/purpose` | :790 | `src/modules/apiclients/apiclients.routes.js:39` | oui |
| 200 | `apiClientApi.createKey` | POST | `/api-clients/clients/${id}/keys` | :792 | `src/modules/apiclients/apiclients.routes.js:44` | oui |
| 201 | `apiClientApi.revokeKey` | DELETE | `/api-clients/keys/${keyId}` | :793 | `src/modules/apiclients/apiclients.routes.js:48` | oui |
| 202 | `apiClientApi.usage` | GET | `/api-clients/clients/${id}/usage` | :795 | `src/modules/apiclients/apiclients.routes.js:53` | **non** |
| 203 | `investApi.projects` | GET | `/investment/projects` | :802 | `src/modules/investors/hub.routes.js:27` | oui |
| 204 | `investApi.followed` | GET | `/investment/followed` | :803 | `src/modules/investors/hub.routes.js:34` | oui |
| 205 | `investApi.follow` | POST | `/investment/projects/${id}/follow` | :804 | `src/modules/investors/hub.routes.js:40` | oui |
| 206 | `investApi.unfollow` | DELETE | `/investment/projects/${id}/follow` | :805 | `src/modules/investors/hub.routes.js:48` | **non** |
| 207 | `investApi.matches` | GET | `/investment/matches` | :806 | `src/modules/investors/hub.routes.js:56` | **non** |
| 208 | `investApi.contact` | POST | `/investment/projects/${id}/contact` | :809 | `src/modules/investors/hub.routes.js:63` | **non** |
| 209 | `investApi.decideContact` | POST | `/investment/projects/${id}/contacts/${requestId}/decide` | :811 | `src/modules/investors/hub.routes.js:74` | **non** |
| 210 | `investApi.contactRequests` | GET | `/investment/contact-requests` | :812 | `src/modules/investors/hub.routes.js:85` | **non** |
| 211 | `investApi.profile` | GET | `/investors/me` | :813 | `src/modules/investors/investors.routes.js:32` | **non** |
| 212 | `investApi.updateProfile` | PUT | `/investors/me` | :814 | `src/modules/investors/investors.routes.js:35` | **non** |
| 213 | `investApi.dashboard` | GET | `/invest` | :815 | `src/modules/investdashboard/dashboard.routes.js:12` | **non** |
| 214 | `projectDataApi.documents` | GET | `/dataroom/projects/${projectId}/documents` | :819 | `src/modules/dataroom/dataroom.routes.js:46` | oui |
| 215 | `projectDataApi.addDocument` | POST | `/dataroom/projects/${projectId}/documents` | :821 | `src/modules/dataroom/dataroom.routes.js:49` | **non** |
| 216 | `projectDataApi.requestAccess` | POST | `/dataroom/projects/${projectId}/access-requests` | :823 | `src/modules/dataroom/dataroom.routes.js:53` | **non** |
| 217 | `projectDataApi.decideAccess` | PATCH | `/dataroom/access-requests/${requestId}` | :825 | `src/modules/dataroom/dataroom.routes.js:57` | **non** |
| 218 | `projectDataApi.document` | GET | `/dataroom/documents/${documentId}` | :826 | `src/modules/dataroom/dataroom.routes.js:61` | **non** |
| 219 | `projectDataApi.accessLog` | GET | `/dataroom/projects/${projectId}/access-log` | :827 | `src/modules/dataroom/dataroom.routes.js:65` | oui |
| 220 | `projectDataApi.fundingRequests` | GET | `/funding/projects/${projectId}/funding-requests` | :828 | `src/modules/funding/funding.routes.js:26` | **non** |
| 221 | `projectDataApi.consentFunding` | POST | `/funding/projects/${projectId}/funding-requests/consent` | :830 | `src/modules/funding/funding.routes.js:30` | **non** |
| 222 | `projectDataApi.transmitFunding` | POST | `/funding/funding-requests/${id}/transmit` | :831 | `src/modules/funding/funding.routes.js:37` | **non** |
| 223 | `projectDataApi.followUpFunding` | PATCH | `/funding/funding-requests/${id}/follow-up` | :833 | `src/modules/funding/funding.routes.js:41` | **non** |
| 224 | `projectDataApi.reports` | GET | `/projects/${projectId}/reports` | :835 | `src/modules/reporting/reporting.routes.js:44` | oui |
| 225 | `projectDataApi.addProgressReport` | POST | `/projects/${projectId}/progress-reports` | :837 | `src/modules/reporting/reporting.routes.js:48` | **non** |
| 226 | `projectDataApi.addImpactReport` | POST | `/projects/${projectId}/impact-reports` | :839 | `src/modules/reporting/reporting.routes.js:53` | **non** |
| 227 | `transportApi.requests` | GET | `/transport/requests` | :846 | `src/modules/transport/transport.routes.js:43` | oui |
| 228 | `transportApi.create` | POST | `/transport/requests` | :848 | `src/modules/transport/transport.routes.js:46` | **non** |
| 229 | `transportApi.offer` | POST | `/transport/requests/${id}/offers` | :850 | `src/modules/transport/transport.routes.js:49` | **non** |
| 230 | `transportApi.acceptOffer` | POST | `/transport/offers/${offerId}/accept` | :852 | `src/modules/transport/transport.routes.js:53` | **non** |
| 231 | `transportApi.proofOfDelivery` | POST | `/transport/requests/${id}/proof-of-delivery` | :854 | `src/modules/transport/transport.routes.js:57` | **non** |
| 232 | `transportApi.setStatus` | PATCH | `/transport/requests/${id}/status` | :856 | `src/modules/transport/transport.routes.js:61` | **non** |
| 233 | `adminApi.blogPosts` | GET | `/admin/blog-posts` | :864 | `src/modules/blog/blog.routes.js:81` | oui |
| 234 | `adminApi.createBlogPost` | POST | `/admin/blog-posts` | :866 | `src/modules/blog/blog.routes.js:95` | oui |
| 235 | `adminApi.updateBlogPost` | PATCH | `/admin/blog-posts/${encodeURIComponent(id)}` | :868 | `src/modules/blog/blog.routes.js:106` | oui |
| 236 | `adminApi.deleteBlogPost` | DELETE | `/admin/blog-posts/${encodeURIComponent(id)}` | :870 | `src/modules/blog/blog.routes.js:118` | oui |
| 237 | `adminApi.dashboard` | GET | `/admin/dashboard` | :874 | `src/modules/admin/admin.routes.js:19` | oui |
| 238 | `adminApi.dashboardExport` | GET | `/admin/dashboard/export` | :877 | `src/modules/admin/admin.routes.js:27` | oui |
| 239 | `adminApi.users` | GET | `/admin/users` | :896 | `src/modules/admin/admin.routes.js:34` | oui |
| 240 | `adminApi.user` | GET | `/admin/users/${id}` | :898 | `src/modules/admin/admin.routes.js:42` | oui |
| 241 | `adminApi.setUserStatus` | PATCH | `/admin/users/${id}/status` | :901 | `src/modules/admin/admin.routes.js:49` | oui |
| 242 | `adminApi.unlockUser` | POST | `/admin/users/${id}/unlock` | :904 | `src/modules/admin/admin.routes.js:58` | oui |
| 243 | `adminApi.forceLogout` | POST | `/admin/users/${id}/force-logout` | :907 | `src/modules/admin/admin.routes.js:65` | oui |
| 244 | `adminApi.verifyUserEmail` | POST | `/admin/users/${id}/verify-email` | :910 | `src/modules/admin/admin.routes.js:72` | oui |
| 245 | `adminApi.verifyUserPhone` | POST | `/admin/users/${id}/verify-phone` | :912 | `src/modules/admin/admin.routes.js:79` | oui |
| 246 | `adminApi.roles` | GET | `/admin/roles` | :914 | `src/modules/admin/admin.routes.js:88` | oui |
| 247 | `adminApi.grantRole` | POST | `/admin/users/${id}/roles` | :919 | `src/modules/admin/admin.routes.js:96` | oui |
| 248 | `adminApi.revokeRole` | DELETE | `/admin/users/${id}/roles/${role}` | :921 | `src/modules/admin/admin.routes.js:103` | oui |
| 249 | `adminApi.deleteUser` | DELETE | `/admin/users/${id}` | :924 | `src/modules/admin/admin.routes.js:109` | oui |
| 250 | `adminApi.exportUser` | GET | `/admin/users/${id}/export` | :926 | `src/modules/admin/admin.routes.js:116` | oui |
| 251 | `adminApi.audit` | GET | `/admin/audit` | :939 | `src/modules/admin/admin.routes.js:123` | oui |
| 252 | `adminApi.auditExport` | GET | `/admin/audit/export` | :944 | `src/modules/admin/admin.security.routes.js:20` | oui |
| 253 | `adminApi.jobs` | GET | `/admin/jobs` | :955 | `src/modules/admin/admin.monitoring.routes.js:21` | oui |
| 254 | `adminApi.runJob` | POST | `/admin/jobs/${name}/run` | :958 | `src/modules/admin/admin.monitoring.routes.js:23` | oui |
| 255 | `adminApi.pauseJob` | POST | `/admin/jobs/${name}/pause` | :960 | `src/modules/admin/admin.monitoring.routes.js:32` | oui |
| 256 | `adminApi.resumeJob` | POST | `/admin/jobs/${name}/resume` | :961 | `src/modules/admin/admin.monitoring.routes.js:39` | oui |
| 257 | `adminApi.monitoringServices` | GET | `/admin/monitoring/services` | :963 | `src/modules/admin/admin.monitoring.routes.js:49` | oui |
| 258 | `adminApi.monitoringHealth` | GET | `/admin/monitoring/health` | :965 | `src/modules/admin/admin.monitoring.routes.js:51` | oui |
| 259 | `adminApi.securityOverview` | GET | `/admin/security/overview` | :967 | `src/modules/admin/admin.security.routes.js:30` | oui |
| 260 | `adminApi.securityPolicy` | GET | `/admin/security/policy` | :969 | `src/modules/admin/admin.security.routes.js:36` | oui |
| 261 | `adminApi.updateSecurityPolicy` | PUT | `/admin/security/policy` | :971 | `src/modules/admin/admin.security.routes.js:38` | oui |
| 262 | `adminApi.operationsList` | GET | `/admin/operations/${entity}` | :974 | `src/modules/admin/admin.operations.routes.js:20` | oui |
| 263 | `adminApi.operationsDetail` | GET | `/admin/operations/${entity}/${id}` | :977 | `src/modules/admin/admin.operations.routes.js:32` | **non** |
| 264 | `adminApi.moderateOperation` | POST | `/admin/operations/${entity}/${id}/moderate` | :980 | `src/modules/admin/admin.operations.routes.js:43` | oui |
| 265 | `adminApi.broadcastAnnouncement` | POST | `/admin/notifications/broadcast` | :983 | `src/modules/admin/admin.notifications.routes.js:19` | oui |
| 266 | `adminApi.notificationsHistory` | GET | `/admin/notifications/history` | :986 | `src/modules/admin/admin.notifications.routes.js:28` | oui |
| 267 | `adminApi.settings` | GET | `/admin/settings` | :987 | `src/modules/admin/admin.settings.routes.js:37` | oui |
| 268 | `adminApi.updateSettings` | PUT | `/admin/settings` | :988 | `src/modules/admin/admin.settings.routes.js:43` | **non** |
| 269 | `mediaApi.uploadUrl` | POST | `/media/upload-url` | :997 | `src/modules/media/media.routes.js:14` | **non** |
| 270 | `mediaApi.confirm` | POST | `/media/${id}/confirm` | :1000 | `src/modules/media/media.routes.js:20` | **non** |
| 271 | `mediaApi.list` | GET | `/media` | :1002 | `src/modules/media/media.routes.js:26` | oui |
| 272 | `satelliteApi.settings` | GET | `/satellite/settings` | :1016 | `src/modules/satellite/acquisition.routes.js:27` | **non** |
| 273 | `satelliteApi.observations` | GET | `/satellite/plots/${plotId}/observations` | :1024 | `src/modules/satellite/acquisition.routes.js:49` | oui |
| 274 | `satelliteApi.acquire` | POST | `/satellite/plots/${plotId}/acquire` | :1033 | `src/modules/satellite/acquisition.routes.js:34` | oui |
| 275 | `syncApi.collections` | GET | `/sync/collections` | :1040 | `src/modules/sync/sync.routes.js:37` | oui |
| 276 | `syncApi.pull` | GET | `/sync/pull` | :1046 | `src/modules/sync/sync.routes.js:43` | oui |
| 277 | `syncApi.push` | POST | `/sync/push` | :1049 | `src/modules/sync/sync.routes.js:40` | **non** |
| 278 | `syncApi.conflicts` | GET | `/sync/conflicts` | :1052 | `src/modules/sync/sync.routes.js:46` | oui |
| 279 | `recommendationApi.list` | GET | `/plots/${plotId}/recommendations` | :1060 | `src/modules/recommendation/recommendation.routes.js:90` | oui |
| 280 | `recommendationApi.create` | POST | `/plots/${plotId}/recommendations` | :1068 | `src/modules/recommendation/recommendation.routes.js:77` | oui |
| 281 | `recommendationApi.one` | GET | `/recommendations/${id}` | :1069 | `src/modules/recommendation/recommendation.routes.js:139` | **non** |
| 282 | `recommendationApi.explanation` | GET | `/recommendations/${id}/explanation` | :1072 | `src/modules/recommendation/recommendation.routes.js:152` | **non** |
| 283 | `recommendationApi.decide` | POST | `/recommendations/${id}/decision` | :1079 | `src/modules/recommendation/recommendation.routes.js:167` | oui |
| 284 | `alertApi.list` | GET | `/alerts` | :1105 | `src/modules/alerts/alerts.routes.js:28` | oui |
| 285 | `alertApi.meta` | GET | `/alerts/meta` | :1115 | `src/modules/alerts/alerts.routes.js:57` | oui |
| 286 | `alertApi.one` | GET | `/alerts/${id}` | :1116 | `src/modules/alerts/alerts.routes.js:64` | **non** |
| 287 | `alertApi.markRead` | POST | `/alerts/${id}/read` | :1118 | `src/modules/alerts/alerts.routes.js:72` | oui |
| 288 | `alertApi.markHandled` | POST | `/alerts/${id}/handled` | :1121 | `src/modules/alerts/alerts.routes.js:87` | oui |
| 289 | `anomalyApi.settings` | GET | `/anomalies/settings` | :1128 | `src/modules/anomalies/anomalies.routes.js:33` | oui |
| 290 | `anomalyApi.list` | GET | `/anomalies` | :1130 | `src/modules/anomalies/anomalies.routes.js:40` | oui |
| 291 | `anomalyApi.one` | GET | `/anomalies/${id}` | :1131 | `src/modules/anomalies/anomalies.routes.js:58` | **non** |
| 292 | `anomalyApi.detectDevice` | POST | `/anomalies/devices/${deviceId}/detect` | :1133 | `src/modules/anomalies/anomalies.routes.js:66` | **non** |
| 293 | `anomalyApi.detectPlot` | POST | `/anomalies/plots/${plotId}/detect` | :1135 | `src/modules/anomalies/anomalies.routes.js:80` | **non** |
| 294 | `anomalyApi.review` | POST | `/anomalies/${id}/review` | :1141 | `src/modules/anomalies/anomalies.routes.js:95` | oui |
| 295 | `exportApi.list` | GET | `/exports` | :1149 | `src/modules/exports/exports.routes.js:46` | oui |
| 296 | `exportApi.get` | GET | `/exports/${id}` | :1155 | `src/modules/exports/exports.routes.js:54` | oui |
| 297 | `exportApi.create` | POST | `/exports` | :1166 | `src/modules/exports/exports.routes.js:51` | **non** |
| 298 | `exportApi.addDocument` | POST | `/exports/${id}/documents` | :1168 | `src/modules/exports/exports.routes.js:57` | **non** |
| 299 | `exportApi.setStatus` | PATCH | `/exports/${id}/status` | :1171 | `src/modules/exports/exports.routes.js:61` | **non** |
| 300 | `agronomicRangeApi.list` | GET | `/agronomic-ranges` | :1179 | `src/modules/recommendation/agronomicRanges.routes.js:134` | **non** |
| 301 | `agronomicRangeApi.meta` | GET | `/agronomic-ranges/meta` | :1181 | `src/modules/recommendation/agronomicRanges.routes.js:144` | oui |
| 302 | `agronomicRangeApi.one` | GET | `/agronomic-ranges/${id}` | :1182 | `src/modules/recommendation/agronomicRanges.routes.js:215` | **non** |
| 303 | `agronomicRangeApi.create` | POST | `/agronomic-ranges` | :1199 | `src/modules/recommendation/agronomicRanges.routes.js:223` | oui |
| 304 | `agronomicRangeApi.update` | PATCH | `/agronomic-ranges/${id}` | :1219 | `src/modules/recommendation/agronomicRanges.routes.js:234` | oui |
| 305 | `agronomicRangeApi.validate` | POST | `/agronomic-ranges/${id}/validate` | :1225 | `src/modules/recommendation/agronomicRanges.routes.js:252` | oui |
| 306 | `agronomicRangeApi.retire` | POST | `/agronomic-ranges/${id}/retire` | :1228 | `src/modules/recommendation/agronomicRanges.routes.js:265` | oui |
| 307 | `agronomicRangeApi.importTemplate` | GET | `/agronomic-ranges/import/template` | :1230 | `src/modules/recommendation/agronomicRanges.routes.js:173` | oui |
| 308 | `agronomicRangeApi.importCsv` | POST | `/agronomic-ranges/import` | :1237 | `src/modules/recommendation/agronomicRanges.routes.js:203` | oui |
| 309 | `publicApi.farmQrUrl` | GET(url) | `/public/farms/${encodeURIComponent(slug)}/qr.${format}?size=${size}` | :199 | `src/modules/public/public.routes.js:43` | **non** |
| 310 | `precisionApi.pdfUrl` | GET(url) | `/precision/precision-reports/${id}/pdf` | :389 | `src/modules/precision/precision.routes.js:49` | **non** |
| 311 | `adminApi.exportFarms` | GET(url) | `/admin/export/farms` | :989 | `src/modules/admin/admin.routes.js:161` | oui |
