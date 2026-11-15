# Audit de l'intégration API — Application mobile AGRIKONNECT AFRICA

**Référence :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md).

**Méthode :** lecture de `src/services/**`, puis rapprochement automatisé des 304 appels de `endpoints.ts` avec les 399 routes extraites de `backend/src/routes/index.js` et des modules montés (lecture seule). Les 17 routes `/auth/*` et `/health`, non résolues par l'extracteur, ont été vérifiées à la main (`auth.routes.js:15-48`, `routes/index.js:80`).

Aucune modification du backend.

---

## 1. Services API

| Module | Rôle | Lignes |
|---|---|---:|
| `services/api/http.ts` | Instance axios, intercepteurs, `RequestError`, `api.get/post/patch/put/delete`, `cleanQuery` | 161 |
| `services/api/session.ts` | Jetons en mémoire + SecureStore, refresh à vol unique, cache du profil | 116 |
| `services/api/endpoints.ts` | 44 objets `xxxApi`, 304 fonctions | 1 145 |
| `services/api/types.ts` | Types des contrats (`ApiEnvelope`, `RequestError`, entités) | 2 248 |
| `services/query.ts` | `QueryClient` + fabrique `queryKeys` | 279 |
| `services/realtime.ts` | Client Socket.IO, invalidations | 146 |
| `hooks/usePublicData.ts` | 5 hooks sur `/public/*` | 91 |

**Constat (fait vérifié) :** l'architecture est saine, avec un client unique, aucun `fetch` dispersé et aucune URL codée en dur hors `lib/config.ts`.

Deux exceptions construisent des URL complètes destinées à être ouvertes hors du client HTTP :
- `endpoints.ts:182` (QR public) ;
- `:372` et `:948` (PDF de précision et export d'administration), voir A9.

---

## 2. Configuration des URL de base

| Élément | Valeur | Source |
|---|---|---|
| `API_BASE_URL` | `EXPO_PUBLIC_API_BASE_URL`, sinon `extra.apiBaseUrl`, sinon `http://localhost:4000/api/v1` | `lib/config.ts:13-21`, `app.json:57` |
| `REALTIME_URL` | `EXPO_PUBLIC_REALTIME_URL`, sinon `extra.realtimeUrl`, sinon l'origine de l'API | `lib/config.ts:23-27`, `app.json:58` |
| Chemin Socket.IO | `/realtime` | `realtime.ts:68` |
| Médias relatifs | rebasés sur l'origine | `config.ts:41-46` |

**Anomalie A1 (= MOB-E11, ÉLEVÉ).** Le repli silencieux sur `localhost` est inutilisable sur un téléphone. Il n'existe aucun fichier `.env`, aucun `eas.json` ni profil, et HTTP est autorisé par défaut.

À noter : `.env.example` décrit le temps réel comme « Supabase Realtime », alors que le code utilise Socket.IO sur `/realtime`. C'est une incohérence de documentation.

---

## 3. Authentification, jetons et en-têtes

| Mécanisme | Implémentation | Statut |
|---|---|---|
| Stockage des jetons | SecureStore (`session.ts:38-44`, `secure-storage.ts:9-44`). Sur le web : `localStorage` | CONFORME (natif) / À AMÉLIORER (web) |
| En-tête `Authorization: Bearer` | Intercepteur de requête (`http.ts:58-60`), sauf `anonymous` | CONFORME |
| `X-Organization-Id` | Lu depuis `globalThis.localStorage` (`http.ts:61-64` → `redirects.ts:121-127`) : **jamais envoyé sur natif** | NON CONFORME (MOB-M18) |
| `Accept-Language` | Locale active (`http.ts:67-68`) | CONFORME |
| `Idempotency-Key` | ULID sur les écritures marquées (`http.ts:70-72`), **92 fonctions** | CONFORME |
| `X-Client` | `mobile/<version>[-web]` (`http.ts:45`) | CONFORME |
| Refresh | Rotatif, à vol unique (`session.ts:73-97`), déclenché sur le premier 401 (`http.ts:113-118`) | **NON CONFORME** (A2 = MOB-C01, A3 = MOB-E10) |
| Expiration | `expiresAt` calculé, mais `isFresh()` n'est jamais utilisé, et `restore()` met `expiresAt = null` (`session.ts:53`) | À AMÉLIORER (pas de refresh proactif) |
| MFA | `mfaRequired` lu dans `details` (`types.ts:61`), identifiants gardés en mémoire (`store/auth.ts:121-122`) | CONFORME |
| Déconnexion | `POST /auth/logout`, puis purge des jetons et du profil (`store/auth.ts:145-154`), **sans purge du cache** | NON CONFORME (MOB-E09) |

### A2 — Rejeu après refresh (MOB-C01, CRITIQUE)

**Reproduction isolée (fait vérifié)** :
- script `replay-test.mjs` ;
- axios 1.20.0 de `apps/Mobile/node_modules` ;
- adaptateur simulé qui renvoie 401 puis 200.

```
Attendu (cas nominal) : {"data":[{"id":"A"},{"id":"B"}],"meta":{"total":2}}
Obtenu après 401+refresh : {}
```

**Cause :** `replay()` (`http.ts:93-105`) renvoie `response.data`, et l'intercepteur (`:116`) résout avec cette enveloppe. `request()` (`:136-137`) lit alors `body.data` sur l'enveloppe interne.

### A3 — Échec réseau pendant le refresh = déconnexion (MOB-E10, ÉLEVÉ)

`session.ts:88-90` purge les jetons dans le `catch`, quelle que soit l'erreur.

---

## 4. Erreurs, délais, concurrence, cache, réseau instable

| Sujet | Implémentation | Statut |
|---|---|---|
| Normalisation des erreurs | `toRequestError` (`http.ts:78-90`) : statut 0 = réseau, `errors[]` par champ, `requestId` | CONFORME |
| Affichage | `ErrorState` (`ui/States.tsx:76-104`) : message serveur ou libellé i18n par famille, référence de requête | CONFORME |
| Erreurs par champ | Exploitées par login et register (`login.tsx:58-62`). La plupart des autres formulaires affichent un `ErrorState` global | À AMÉLIORER |
| Délais | 15 s par défaut, 20 s géospatial, 60 s envoi de fichier, IA (`config.ts:49-53`, `endpoints.ts:380,739,741`) | CONFORME |
| Nouvel essai | Pas de nouvel essai sur 4xx ; 2 sur erreur réseau ; 1 sur 5xx ; aucun pour les mutations (`query.ts:18-38`) | CONFORME |
| Requêtes simultanées | Refresh à vol unique (`pendingRefresh`). Pas d'annulation explicite (`signal`) transmise par `useQuery` | À AMÉLIORER |
| Cache | `staleTime` de 60 s (5 à 10 minutes pour les données publiques), `gcTime` de 10 minutes, clés centralisées | CONFORME / NON CONFORME pour la purge (MOB-E09) |
| Réseau instable | `refetchOnReconnect: true`, mais `onlineManager` n'est pas branché (pas de NetInfo) : **inopérant sur natif**. Pas de file hors ligne. `OfflineNotice` inutilisé | NON CONFORME (MOB-M02) |
| Pagination | `meta` lu dans 18 endroits. **Aucun `useInfiniteQuery`.** La plupart des listes demandent `limit: 100` et n'affichent que la première page | NON CONFORME (MOB-M04) |
| Filtres et recherche | `cleanQuery` retire les valeurs vides (`http.ts:153-161`). Filtres par puces sur pays, statut, culture | CONFORME |
| Limites | Toutes les limites respectent les maxima backend (100 en standard, 500 pour `/public/map`, IoT plafonné à 2 000 par le service). Aucun 422 dû à `limit` (contrôle des 98 occurrences) | CONFORME |

---

## 5. Endpoints mal utilisés

| ID | Anomalie | Mobile | Backend (lecture seule) | Conséquence | Rapport |
|---|---|---|---|---|---|
| A4 | Création de parcelle sans géométrie | `farmer/plots/create.tsx:21` | `plots.schema.js:20` `geometry` requis | 422 systématique | MOB-E01 |
| A5 | File de vérification réservée aux ADMIN, appelée par les espaces expert et agent | `reviewer/missions.tsx:31-33`, `agent/index.tsx:41-43` → `GET /admin/verifications` | `verification.routes.js:31-35` + `permissions.js:16,132` | 403 | MOB-E06 |
| A6 | Écrans publics sur des routes `authenticate` | voir le tableau A6 ci-dessous | `router.use(authenticate, resolveTenant)` | 401 pour un visiteur | MOB-E07 |
| A7 | `indicativePrice: null` / `budgetPrice: null` | `annonces/creer.tsx:36`, `marketplace/new.tsx:37`, `public-site/annonces/creer.tsx:35`, `requests/new.tsx:35` | `z.coerce.number().min(0).optional()`. **Vérifié : `null` → `0`** | Prix affiché « 0 » | MOB-M05 |
| A8 | `cropId` en texte libre, éventuellement `''` | `annonces/creer.tsx:53`, `marketplace/new.tsx:58`, `requests/new.tsx:52` | `cropId: z.string().max(60).optional()` accepte `''` | Clé étrangère invalide (500 ou 422 attendu), saisie impossible pour l'utilisateur | MOB-M05 |
| A9 | Téléchargement par URL nue, sans jeton | `admin/reports.tsx:28` (`Linking.openURL`), `precision-report.tsx:167` (URL affichée) | Routes authentifiées | 401 dans le navigateur | MOB-M10 |
| A10 | Inscription : rôles sensibles | `lib/platform.ts:136-146` | `auth.schema.js:21-30` les accepte | Élévation de privilèges | MOB-E13 |
| A11 | Commandes privées affichées comme « ventes » publiques | `public-site/ventes/index.tsx`, `[id].tsx` → `orderApi.list/get` | `/orders` (authentifié, filtré par tenant) | Confusion entre public et privé | MOB-E07 |
| A12 | Préférence PUSH sans canal réel | `notifications/preferences.tsx:26,43` | Le schéma accepte `PUSH` (`notifications.routes.js:20`) mais aucun envoi push | Préférence sans effet | MOB-M21 |

### Tableau A6 — écrans hors `SessionGate` qui appellent une route authentifiée (fait vérifié)

| Écran | Fonction | Route |
|---|---|---|
| `app/annonces/index.tsx`, `app/marches.tsx`, `app/public-site/annonces/index.tsx` | `listingApi.list` | `GET /listings` |
| `app/annonces/[id].tsx`, `app/public-site/annonces/[id].tsx` | `listingApi.get`, `.contact` | `GET /listings/:id`, `POST /listings/:id/contact` |
| `app/annonces/creer.tsx`, `app/marketplace/new.tsx`, `app/public-site/annonces/creer.tsx` | `listingApi.create` | `POST /listings` |
| `app/marketplace/index.tsx`, `app/public-site/ventes/index.tsx` | `orderApi.list` | `GET /orders` |
| `app/marketplace/[id].tsx`, `app/public-site/ventes/[id].tsx` | `orderApi.get` (+ events, setStatus, setPayment, dispute) | `/orders/:id…` |
| `app/marketplace/inventory.tsx` | `inventoryApi.*` | `/inventory…` |
| `app/prices/index.tsx`, `app/prices/[crop].tsx`, `app/public-site/marches.tsx` | `priceApi.list` | `GET /prices` |
| `app/weather.tsx` | `plotApi.list`, `weatherApi.forPlot` | `GET /plots`, `GET /weather/plots/:id` |
| `app/tenders.tsx`, `app/public-site/tenders.tsx` | `tenderApi.list` | `GET /tenders` |
| `app/projets.tsx`, `app/public-site/projets.tsx`, `app/public-site/projects/index.tsx` | `projectApi.list` | `GET /projects` |
| `app/projets/[id].tsx`, `app/public-site/projets/[id].tsx`, `app/public-site/projects/[id].tsx` | `projectApi.get` | `GET /projects/:id` |
| `app/insights/index.tsx`, `app/insights/[country]/[region].tsx`, `app/public-site/agriculture/[country].tsx` | `insightsApi.*` | `/insights/*` |
| `app/public-site/cooperatives/index.tsx` | `organizationApi.list` | `GET /organizations` |
| `app/public-site/transporters.tsx` | `transportApi.requests` | `GET /transport/requests` |
| `app/producteurs/index.tsx`, `app/profil.tsx`, `app/public-site/profil.tsx` | `authApi.me` (+ permissions, mfaStatus) | `/me`, `/auth/mfa/status` |

Note : `marketplace`, `prices`, `weather` et `profil` sont des espaces connectés par nature, mais ils ne sont pas dans `protectedRoots` (`_layout.tsx:102-117`). Ils dépendent seulement d'`AuthGate`.

---

## 6. Données fictives ou simulées

| Constat | Fichier:ligne | Statut |
|---|---|---|
| Aucun jeu de données simulé dans les services | `services/**` | CONFORME |
| Progression de suivi constante (`62`, `55`, `50`, `70`, `65`, `100`) | `marketplace/index.tsx:72`, `reviewer/missions.tsx:53`, `agent/index.tsx:68,80`, `farmer/index.tsx:63`, `organization/index.tsx:52` | NON CONFORME (MOB-M11) |
| Libellé « 12 mois » pour 8 points | `admin/dashboard.tsx:82,182` | NON CONFORME (MOB-M11) |
| Lien « lot exemple » `demo` | `home/HeroCarousel.tsx:97` | À AMÉLIORER (MOB-M08) |
| Catalogues éditoriaux statiques (services, FAQ, calendrier V1 à V5) | `lib/platform.ts`, `lib/service-catalog.ts`, `lib/faq.ts` | Contenu, pas des données métier (CONFORME) |

---

## 7. Temps réel (Socket.IO)

| Événement | Émis par le backend (fait vérifié) | Traitement mobile | Statut |
|---|---|---|---|
| `ready` | `realtime/index.js:105` | `emitLocal` sans abonné | Sans effet |
| `typing` | `realtime/index.js:120` | `emitLocal` sans abonné | NON IMPLÉMENTÉ en UI |
| `message:new`, `message:read`, `conversation:new`, `conversation:blocked` | `realtime/bus.js` | Invalidation des conversations et des messages (`realtime.ts:79-102`) | CONFORME |
| `order:new`, `order:updated`, `order:disputed` | `bus.js` | Invalidation `orders.all` (`realtime.ts:104-109`) | CONFORME |
| `notification:new` | `shared/events.js:51` | Invalidation `notifications.all` (`realtime.ts:111-114`) | CONFORME |
| `alert:new` | `alerts.service.js:560` | Invalidation `alerts.all` (`realtime.ts:116-119`) | CONFORME |
| Émission `typing`, `conversation:join` | — | `setTyping` et `joinConversation` ne sont **jamais appelés** | NON IMPLÉMENTÉ |
| Authentification | `handshake.auth.token` | Jeton lu une fois à la connexion, aucune gestion de `connect_error` | NON CONFORME (MOB-M01) |
| Cycle de vie | — | Connexion si authentifié (`_layout.tsx:47-50`). Pas d'AppState. `disconnect` à la sortie | À AMÉLIORER |

---

## 8. Conformité des endpoints et couverture fonctionnelle

- **304/304** fonctions pointent vers une route existante, avec la bonne méthode et le bon chemin (annexe B).
- **13** fonctions sont marquées `anonymous` : `/public/*` (6), `/health`, connexion, inscription, refresh, mot de passe oublié, réinitialisation, vérification d'e-mail. S'y ajoute l'URL publique du QR (`farmQrUrl`), chargée comme image.
- **101 fonctions (33 %) ne sont utilisées par aucun écran.** Ce sont des fonctionnalités sans interface :

| Objet | Inutilisées | Fonctions |
|---|---:|---|
| authApi | 2 | changePassword (POST /me/password), syncProfile (POST /auth/sync-profile) |
| referenceApi | 2 | crop, fxRates |
| farmApi | 3 | update, publish, remove — **aucune modification ni suppression d'exploitation** |
| plotApi | 4 | update, remove, cropHistory, addCropHistory |
| productionApi | 2 | update, remove |
| soilApi | 3 | updateAssessment, removeAssessment, explainSuitability |
| geoApi | 2 | one, methods |
| listingApi | 3 | update, attachPhotos, remove — **aucune photo ni modification d'annonce** |
| requestApi | 1 | update |
| reviewApi | 4 | create, respond, report, moderate — **aucun avis** |
| orderApi | 1 | resolveDispute |
| priceApi | 3 | series, staleMarkets, record |
| weatherApi | 2 | history, alerts |
| tenderApi | 2 | get, respond — **impossible de répondre à un appel d'offres** |
| lotApi | 3 | addEvent, setPublicFields, recall — **traçabilité non alimentable** |
| dashboardApi | 1 | invest |
| messagingApi | 4 | createConversation, archive, block, reportMessage — **le signalement et le blocage annoncés n'existent pas** |
| seasonApi | 4 | get, update, archive, stats |
| cooperativeApi | 7 | updateCurrent, addMember, updateMember, preview/create/confirm/cancelGroupOffer — **offres groupées absentes** |
| verificationApi | 1 | request — **impossible de demander une vérification** |
| certificationApi | 4 | create, forOrganization, get, remove |
| aiApi | 3 | analyzeDocument, review, feedback |
| investApi | 6 | unfollow, matches, contact, decideContact, contactRequests, updateProfile |
| projectDataApi | 10 | data room (documents, accès), financement (consent, transmit, follow-up), rapports d'avancement et d'impact |
| transportApi | 5 | create, offer, acceptOffer, proofOfDelivery, setStatus — **transport non implémenté** |
| adminApi | 3 | dashboardExport, operationsDetail, updateSettings |
| mediaApi | 2 | uploadUrl, confirm — **aucun téléversement** |
| exportApi | 3 | create, addDocument, setStatus |
| syncApi | 1 | push — **aucune remontée hors ligne** |
| recommendationApi | 2 | one, explanation |
| alertApi | 1 | one |
| anomalyApi | 3 | one, detectDevice, detectPlot |
| agronomicRangeApi | 4 | list, meta, one, update |

**Lecture :**
- le mobile **consulte** beaucoup mais **modifie** peu ;
- la modification et la suppression sont absentes pour les exploitations, parcelles, productions et annonces ;
- les flux de traçabilité, de transport, d'avis, de signalement et d'envoi de fichiers sont absents.

---

## 9. Problèmes d'intégration : synthèse et priorités

| Priorité | Problème | Réf. |
|---|---|---|
| 1 | Rejeu après refresh | A2 / MOB-C01 |
| 2 | Déconnexion sur erreur réseau | A3 / MOB-E10 |
| 3 | Configuration localhost/HTTP | A1 / MOB-E11 |
| 4 | Parcelle sans géométrie | A4 / MOB-E01 |
| 5 | 403 vérificateur | A5 / MOB-E06 |
| 6 | Public sur routes authentifiées | A6 / MOB-E07 |
| 7 | Cache non purgé | MOB-E09 |
| 8 | `X-Organization-Id` jamais envoyé | MOB-M18 |
| 9 | Jeton socket figé | MOB-M01 |
| 10 | Prix nul, IDs saisis | A7-A8 / MOB-M05 |
| 11 | Téléchargements sans jeton | A9 / MOB-M10 |
| 12 | Pagination absente | MOB-M04 |

---

## Annexe B — Les 304 fonctions API (rapprochement complet)

Colonnes :
- « Route backend » : fichier:ligne de la déclaration dans `backend/` ;
- « Anonyme » : option `anonymous: true` ;
- « Utilisée par » : nombre d'écrans ou modules, avec les 3 premiers.

| Objet.fonction | endpoints.ts | Méthode | Chemin | Route backend | Anonyme | Utilisée par |
|---|---:|---|---|---|---|---|
| publicApi.map | 154 | GET | `/public/map` | src/modules/public/public.routes.js:16 | oui | 2 (app/public-site/map.tsx, hooks/usePublicData.ts) |
| publicApi.farms | 158 | GET | `/public/farms` | src/modules/public/public.routes.js:22 | oui | 3 (app/public-site/farmers.tsx, app/public-site/producteurs/index.tsx, hooks/usePublicData.ts) |
| publicApi.farm | 161 | GET | `/public/farms/${encodeURIComponent(slug)}` | src/modules/public/public.routes.js:28 | oui | 4 (app/producteurs/[slug].tsx, app/public-site/cooperatives/[slug].tsx, app/public-site/farm/[slug].tsx…) |
| publicApi.contactFarm | 165 | POST | `/public/farms/${slug}/contact` | src/modules/public/public.routes.js:34 | oui | 2 (app/contact.tsx, app/public-site/farm/[slug].tsx) |
| publicApi.soilStats | 173 | GET | `/public/soil-stats` | src/modules/public/public.routes.js:70 | oui | 2 (app/public-site/data.tsx, hooks/usePublicData.ts) |
| publicApi.lot | 177 | GET | `/public/lots/${encodeURIComponent(code)}` | src/modules/traceability/public.routes.js:13 | oui | 1 (hooks/usePublicData.ts) |
| publicApi.farmQrUrl | 181 | URL | `/public/farms/${encodeURIComponent(slug)}/qr.${format}?size=${size}` | src/modules/public/public.routes.js:43 | non | 1 (app/public-site/farm/[slug].tsx) |
| publicApi.health | 184 | GET | `/health` | backend/src/routes/index.js:80 | oui | 1 (components/public-site/PublicFooter.tsx) |
| authApi.login | 194 | POST | `/auth/login` | backend/src/modules/auth/auth.routes.js | oui | 1 (store/auth.ts) |
| authApi.register | 197 | POST | `/auth/register` | backend/src/modules/auth/auth.routes.js | oui | 2 (app/agent/registration.tsx, store/auth.ts) |
| authApi.refresh | 201 | POST | `/auth/refresh` | backend/src/modules/auth/auth.routes.js | oui | 1 (store/auth.ts) |
| authApi.logout | 204 | POST | `/auth/logout` | backend/src/modules/auth/auth.routes.js | non | 1 (store/auth.ts) |
| authApi.me | 207 | GET | `/me` | src/modules/users/users.routes.js:20 | non | 12 (app/farmer/index.tsx, app/farmer/public-profile.tsx, app/farmer/reviews.tsx…) |
| authApi.updateMe | 208 | PATCH | `/me` | src/modules/users/users.routes.js:21 | non | 2 (app/farmer/profile.tsx, app/investment/profile.tsx) |
| authApi.permissions | 209 | GET | `/me/permissions` | src/modules/users/users.routes.js:22 | non | 2 (app/profil.tsx, store/auth.ts) |
| authApi.changePassword | 210 | POST | `/me/password` | src/modules/users/users.routes.js:23 | non | **aucun écran** |
| authApi.forgotPassword | 213 | POST | `/auth/forgot-password` | backend/src/modules/auth/auth.routes.js | oui | 1 (app/auth/forgot-password.tsx) |
| authApi.resetPassword | 215 | POST | `/auth/reset-password` | backend/src/modules/auth/auth.routes.js | oui | 1 (app/auth/reset-password.tsx) |
| authApi.resendVerification | 217 | POST | `/auth/resend-verification` | backend/src/modules/auth/auth.routes.js | non | 1 (app/auth/verify-email.tsx) |
| authApi.verifyEmail | 226 | POST | `/auth/verify-email` | backend/src/modules/auth/auth.routes.js | oui | 1 (app/auth/verify-email.tsx) |
| authApi.mfaStatus | 230 | GET | `/auth/mfa/status` | backend/src/modules/auth/auth.routes.js | non | 2 (app/auth/mfa.tsx, app/profil.tsx) |
| authApi.mfaSetup | 235 | POST | `/auth/mfa/setup` | src/modules/auth/auth.routes.js:20 | non | 1 (app/auth/mfa.tsx) |
| authApi.mfaConfirm | 245 | POST | `/auth/mfa/confirm` | src/modules/auth/auth.routes.js:23 | non | 1 (app/auth/mfa.tsx) |
| authApi.mfaVerify | 260 | POST | `/auth/mfa/verify` | backend/src/modules/auth/auth.routes.js | non | 1 (app/auth/mfa.tsx) |
| authApi.mfaDisable | 261 | POST | `/auth/mfa/disable` | backend/src/modules/auth/auth.routes.js | non | 1 (app/auth/mfa.tsx) |
| authApi.sendOtp | 264 | POST | `/auth/send-otp` | backend/src/modules/auth/auth.routes.js | non | 1 (app/auth/verify-phone.tsx) |
| authApi.verifyPhone | 266 | POST | `/auth/verify-phone` | backend/src/modules/auth/auth.routes.js | non | 1 (app/auth/verify-phone.tsx) |
| authApi.syncProfile | 268 | POST | `/auth/sync-profile` | backend/src/modules/auth/auth.routes.js | non | **aucun écran** |
| referenceApi.crops | 274 | GET | `/crops` | src/modules/crops/crops.routes.js:19 | non | 7 (app/admin/crops.tsx, app/farmer/plots/[id]/precision-report.tsx, app/farmer/plots/[id]/recommendations.tsx…) |
| referenceApi.crop | 276 | GET | `/crops/${id}` | src/modules/crops/crops.routes.js:20 | non | **aucun écran** |
| referenceApi.countries | 277 | GET | `/countries/${code.toUpperCase()}` | src/modules/countries/countries.routes.js:48 | non | 3 (app/admin/countries/index.tsx, app/admin/dashboard.tsx, app/public-site/country-language.tsx) |
| referenceApi.country | 281 | GET | `/countries/${code.toUpperCase()}` | src/modules/countries/countries.routes.js:48 | non | 1 (app/admin/countries/[code].tsx) |
| referenceApi.fxRates | 282 | GET | `/countries/fx-rates` | src/modules/countries/countries.routes.js:48 | non | **aucun écran** |
| farmApi.list | 288 | GET | `/farms` | src/modules/farms/farms.routes.js:14 | non | 5 (app/admin/farms.tsx, app/farmer/farms/index.tsx, app/farmer/productions.tsx…) |
| farmApi.create | 289 | POST | `/farms` | src/modules/farms/farms.routes.js:15 | non | 1 (app/farmer/farms/create.tsx) |
| farmApi.get | 290 | GET | `/farms/${id}` | src/modules/farms/farms.routes.js:16 | non | 1 (app/farmer/farms/[id].tsx) |
| farmApi.update | 291 | PATCH | `/farms/${id}` | src/modules/farms/farms.routes.js:17 | non | **aucun écran** |
| farmApi.publish | 292 | PATCH | `/farms/${id}/publish` | src/modules/farms/farms.routes.js:24 | non | **aucun écran** |
| farmApi.remove | 293 | DELETE | `/farms/${id}` | src/modules/farms/farms.routes.js:31 | non | **aucun écran** |
| plotApi.list | 297 | GET | `/plots` | src/modules/plots/plots.routes.js:14 | non | 7 (app/admin/plots.tsx, app/farmer/index.tsx, app/farmer/plots/index.tsx…) |
| plotApi.create | 299 | POST | `/plots` | src/modules/plots/plots.routes.js:15 | non | 1 (app/farmer/plots/create.tsx) |
| plotApi.get | 301 | GET | `/plots/${id}` | src/modules/plots/plots.routes.js:17 | non | 8 (app/farmer/plots/[id]/plan.tsx, app/farmer/plots/[id]/precision-report.tsx, app/farmer/plots/[id]/recommendations.tsx…) |
| plotApi.update | 302 | PATCH | `/plots/${id}` | src/modules/plots/plots.routes.js:18 | non | **aucun écran** |
| plotApi.remove | 303 | DELETE | `/plots/${id}` | src/modules/plots/plots.routes.js:25 | non | **aucun écran** |
| plotApi.cropHistory | 305 | GET | `/plots/${id}/crop-history` | src/modules/plots/plots.routes.js:33 | non | **aucun écran** |
| plotApi.addCropHistory | 306 | POST | `/plots/${id}/crop-history` | src/modules/plots/plots.routes.js:39 | non | **aucun écran** |
| productionApi.list | 311 | GET | `/productions` | src/modules/productions/productions.routes.js:15 | non | 2 (app/admin/productions.tsx, app/farmer/productions.tsx) |
| productionApi.stats | 314 | GET | `/productions/stats` | src/modules/productions/productions.routes.js:14 | non | 2 (app/farmer/productions.tsx, app/organization/production-summary.tsx) |
| productionApi.create | 317 | POST | `/productions` | src/modules/productions/productions.routes.js:21 | non | 1 (app/farmer/productions.tsx) |
| productionApi.update | 318 | PATCH | `/productions/${id}` | src/modules/productions/productions.routes.js:33 | non | **aucun écran** |
| productionApi.remove | 319 | DELETE | `/productions/${id}` | src/modules/productions/productions.routes.js:40 | non | **aucun écran** |
| soilApi.assessments | 326 | GET | `/plots/${plotId}/soil-assessments` | src/modules/soil/soil.routes.js:21 | non | 2 (app/farmer/soil.tsx, components/farmer/SoilModule.tsx) |
| soilApi.profile | 328 | GET | `/plots/${plotId}/soil-profile` | src/modules/soil/soil.routes.js:28 | non | 2 (app/farmer/soil.tsx, components/farmer/SoilModule.tsx) |
| soilApi.createAssessment | 329 | POST | `/plots/${plotId}/soil-assessments` | src/modules/soil/soil.routes.js:35 | non | 2 (app/farmer/soil.tsx, components/farmer/SoilModule.tsx) |
| soilApi.updateAssessment | 331 | PATCH | `/plots/${plotId}/soil-assessments/${assessmentId}` | src/modules/soil/soil.routes.js:43 | non | **aucun écran** |
| soilApi.removeAssessment | 333 | DELETE | `/plots/${plotId}/soil-assessments/${assessmentId}` | src/modules/soil/soil.routes.js:51 | non | **aucun écran** |
| soilApi.suitability | 336 | GET | `/plots/${plotId}/suitability` | src/modules/soil/soil.routes.js:60 | non | 1 (app/farmer/plots/[id]/recommendations.tsx) |
| soilApi.computeSuitability | 337 | POST | `/plots/${plotId}/suitability` | src/modules/soil/soil.routes.js:67 | non | 1 (app/farmer/plots/[id]/recommendations.tsx) |
| soilApi.explainSuitability | 339 | GET | `/plots/${plotId}/suitability/${suitabilityId}` | src/modules/soil/soil.routes.js:79 | non | **aucun écran** |
| soilApi.rotationPlans | 342 | GET | `/plots/${plotId}/rotation-plans` | src/modules/soil/soil.routes.js:88 | non | 2 (app/farmer/plots/[id]/plan.tsx, app/farmer/plots/[id]/rotation.tsx) |
| soilApi.proposeRotation | 343 | POST | `/plots/${plotId}/rotation-plans` | src/modules/soil/soil.routes.js:95 | non | 1 (app/farmer/plots/[id]/rotation.tsx) |
| soilApi.decideRotation | 346 | PATCH | `/plots/${plotId}/rotation-plans/${planId}` | src/modules/soil/soil.routes.js:107 | non | 1 (app/farmer/plots/[id]/rotation.tsx) |
| soilApi.farmingPlans | 349 | GET | `/plots/${plotId}/farming-plans` | src/modules/soil/soil.routes.js:119 | non | 1 (app/farmer/plots/[id]/plan.tsx) |
| soilApi.proposeFarmingPlan | 350 | POST | `/plots/${plotId}/farming-plans` | src/modules/soil/soil.routes.js:126 | non | 1 (app/farmer/plots/[id]/plan.tsx) |
| soilApi.yieldEstimates | 353 | GET | `/plots/${plotId}/yield-estimates` | src/modules/soil/soil.routes.js:138 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| soilApi.estimateYield | 354 | POST | `/plots/${plotId}/yield-estimates` | src/modules/soil/soil.routes.js:145 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| precisionApi.zones | 361 | GET | `/precision/plots/${plotId}/management-zones` | src/modules/precision/precision.routes.js:30 | non | 1 (app/farmer/plots/[id]/zones.tsx) |
| precisionApi.computeZones | 363 | POST | `/precision/plots/${plotId}/management-zones` | src/modules/precision/precision.routes.js:33 | non | 1 (app/farmer/plots/[id]/zones.tsx) |
| precisionApi.reports | 365 | GET | `/precision/plots/${plotId}/precision-reports` | src/modules/precision/precision.routes.js:37 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| precisionApi.createReport | 366 | POST | `/precision/plots/${plotId}/precision-reports` | src/modules/precision/precision.routes.js:40 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| precisionApi.validateReport | 369 | PATCH | `/precision/precision-reports/${id}/validate` | src/modules/precision/precision.routes.js:45 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| precisionApi.pdfUrl | 372 | URL | `/precision/precision-reports/${id}/pdf` | src/modules/precision/precision.routes.js:49 | non | 1 (app/farmer/plots/[id]/precision-report.tsx) |
| geoApi.diagnose | 377 | POST | `/plots/${plotId}/soil-diagnosis` | src/modules/geospatial/geospatial.routes.js:162 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| geoApi.latest | 383 | GET | `/plots/${plotId}/soil-diagnosis/latest` | src/modules/geospatial/geospatial.routes.js:182 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| geoApi.history | 384 | GET | `/plots/${plotId}/soil-diagnosis` | src/modules/geospatial/geospatial.routes.js:174 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| geoApi.one | 386 | GET | `/geospatial/soil-diagnostics/${id}` | src/modules/geospatial/geospatial.routes.js:215 | non | **aucun écran** |
| geoApi.health | 387 | GET | `/geospatial/health` | src/modules/geospatial/geospatial.routes.js:193 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| geoApi.methods | 389 | GET | `/geospatial/methods` | src/modules/geospatial/geospatial.routes.js:199 | non | **aucun écran** |
| listingApi.list | 395 | GET | `/listings` | src/modules/market/listings/listings.routes.js:17 | non | 5 (app/admin/marketplace.tsx, app/annonces/index.tsx, app/marches.tsx…) |
| listingApi.get | 397 | GET | `/listings/${id}` | src/modules/market/listings/listings.routes.js:27 | non | 2 (app/annonces/[id].tsx, app/public-site/annonces/[id].tsx) |
| listingApi.create | 398 | POST | `/listings` | src/modules/market/listings/listings.routes.js:24 | non | 3 (app/annonces/creer.tsx, app/marketplace/new.tsx, app/public-site/annonces/creer.tsx) |
| listingApi.update | 399 | PATCH | `/listings/${id}` | src/modules/market/listings/listings.routes.js:30 | non | **aucun écran** |
| listingApi.setStatus | 400 | PATCH | `/listings/${id}/status` | src/modules/market/listings/listings.routes.js:35 | non | 1 (app/annonces/[id].tsx) |
| listingApi.contact | 402 | POST | `/listings/${id}/contact` | src/modules/market/listings/listings.routes.js:45 | non | 2 (app/annonces/[id].tsx, app/public-site/annonces/[id].tsx) |
| listingApi.attachPhotos | 404 | POST | `/listings/${id}/photos` | src/modules/market/listings/listings.routes.js:58 | non | **aucun écran** |
| listingApi.remove | 406 | DELETE | `/listings/${id}` | src/modules/market/listings/listings.routes.js:68 | non | **aucun écran** |
| requestApi.list | 411 | GET | `/purchase-requests` | src/modules/market/requests/requests.routes.js:14 | non | 1 (app/requests/index.tsx) |
| requestApi.get | 413 | GET | `/purchase-requests/${id}` | src/modules/market/requests/requests.routes.js:22 | non | 1 (app/requests/[id].tsx) |
| requestApi.create | 414 | POST | `/purchase-requests` | src/modules/market/requests/requests.routes.js:19 | non | 2 (app/requests/index.tsx, app/requests/new.tsx) |
| requestApi.update | 415 | PATCH | `/purchase-requests/${id}` | src/modules/market/requests/requests.routes.js:25 | non | **aucun écran** |
| requestApi.matches | 417 | GET | `/purchase-requests/${id}/matches` | src/modules/market/requests/requests.routes.js:30 | non | 2 (app/requests/[id]/matches.tsx, app/requests/[id].tsx) |
| requestApi.offers | 418 | GET | `/market/purchase-requests/${id}/offers` | src/modules/market/offers/offers.routes.js:53 | non | 1 (app/requests/[id].tsx) |
| requestApi.submitOffer | 419 | POST | `/market/purchase-requests/${id}/offers` | src/modules/market/offers/offers.routes.js:42 | non | 1 (app/requests/[id].tsx) |
| requestApi.updateOffer | 421 | PATCH | `/market/offers/${offerId}` | src/modules/market/offers/offers.routes.js:60 | non | 1 (app/requests/[id].tsx) |
| inventoryApi.list | 427 | GET | `/inventory` | src/modules/market/inventory/inventory.routes.js:37 | non | 2 (app/farmer/inventory.tsx, app/marketplace/inventory.tsx) |
| inventoryApi.create | 428 | POST | `/inventory` | src/modules/market/inventory/inventory.routes.js:40 | non | 1 (app/marketplace/inventory.tsx) |
| inventoryApi.movements | 429 | GET | `/inventory/${id}/movements` | src/modules/market/inventory/inventory.routes.js:43 | non | 1 (app/marketplace/inventory.tsx) |
| inventoryApi.addMovement | 430 | POST | `/inventory/movements` | src/modules/market/inventory/inventory.routes.js:47 | non | 1 (app/marketplace/inventory.tsx) |
| reviewApi.create | 436 | POST | `/orders/${orderId}/reviews` | src/modules/market/reviews/reviews.routes.js:27 | non | **aucun écran** |
| reviewApi.respond | 438 | POST | `/reviews/${id}/response` | src/modules/market/reviews/reviews.routes.js:31 | non | **aucun écran** |
| reviewApi.report | 440 | POST | `/reviews/${id}/report` | src/modules/market/reviews/reviews.routes.js:35 | non | **aucun écran** |
| reviewApi.moderate | 442 | POST | `/reviews/${id}/moderate` | src/modules/market/reviews/reviews.routes.js:39 | non | **aucun écran** |
| reviewApi.reputation | 444 | GET | `/organizations/${organizationId}/reputation` | src/modules/market/reviews/reviews.routes.js:46 | non | 1 (app/farmer/reviews.tsx) |
| orderApi.list | 448 | GET | `/orders` | src/modules/market/orders/orders.routes.js:83 | non | 8 (app/admin/orders.tsx, app/farmer/orders/index.tsx, app/farmer/orders/invoices.tsx…) |
| orderApi.get | 450 | GET | `/orders/${id}` | src/modules/market/orders/orders.routes.js:88 | non | 4 (app/farmer/orders/[id].tsx, app/marketplace/[id].tsx, app/public-site/ventes/[id].tsx…) |
| orderApi.events | 451 | GET | `/orders/${id}/events` | src/modules/market/orders/orders.routes.js:92 | non | 1 (app/marketplace/[id].tsx) |
| orderApi.setStatus | 453 | PATCH | `/orders/${id}/status` | src/modules/market/orders/orders.routes.js:96 | non | 1 (app/marketplace/[id].tsx) |
| orderApi.setPayment | 455 | PATCH | `/orders/${id}/payment` | src/modules/market/orders/orders.routes.js:101 | non | 1 (app/marketplace/[id].tsx) |
| orderApi.dispute | 457 | POST | `/orders/${id}/disputes` | src/modules/market/orders/orders.routes.js:106 | non | 1 (app/marketplace/[id].tsx) |
| orderApi.adminDisputes | 459 | GET | `/orders/admin/disputes` | src/modules/market/orders/orders.routes.js:111 | non | 1 (app/reviewer/index.tsx) |
| orderApi.resolveDispute | 460 | PATCH | `/orders/admin/disputes/${id}` | src/modules/market/orders/orders.routes.js:119 | non | **aucun écran** |
| priceApi.list | 468 | GET | `/prices` | src/modules/prices/prices.routes.js:42 | non | 4 (app/admin/prices.tsx, app/prices/index.tsx, app/prices/[crop].tsx…) |
| priceApi.series | 470 | GET | `/prices/series` | src/modules/prices/prices.routes.js:45 | non | **aucun écran** |
| priceApi.staleMarkets | 472 | GET | `/prices/stale-markets` | src/modules/prices/prices.routes.js:52 | non | **aucun écran** |
| priceApi.record | 473 | POST | `/prices` | src/modules/prices/prices.routes.js:49 | non | **aucun écran** |
| weatherApi.forPlot | 477 | GET | `/weather/plots/${plotId}` | src/modules/weather/weather.routes.js:27 | non | 1 (app/weather.tsx) |
| weatherApi.history | 479 | GET | `/weather/plots/${plotId}/history` | src/modules/weather/weather.routes.js:30 | non | **aucun écran** |
| weatherApi.alerts | 481 | GET | `/weather/plots/${plotId}/alerts` | src/modules/weather/weather.routes.js:33 | non | **aucun écran** |
| tenderApi.list | 485 | GET | `/tenders` | src/modules/tenders/tenders.routes.js:45 | non | 4 (app/international/index.tsx, app/international/tenders.tsx, app/public-site/tenders.tsx…) |
| tenderApi.get | 487 | GET | `/tenders/${id}` | src/modules/tenders/tenders.routes.js:53 | non | **aucun écran** |
| tenderApi.respond | 488 | POST | `/tenders/${id}/responses` | src/modules/tenders/tenders.routes.js:56 | non | **aucun écran** |
| lotApi.list | 493 | GET | `/lots` | src/modules/traceability/traceability.routes.js:42 | non | 2 (app/admin/lots.tsx, app/farmer/lots/index.tsx) |
| lotApi.get | 494 | GET | `/lots/${id}` | src/modules/traceability/traceability.routes.js:50 | non | 1 (app/farmer/lots/[id].tsx) |
| lotApi.addEvent | 495 | POST | `/lots/${id}/events` | src/modules/traceability/traceability.routes.js:54 | non | **aucun écran** |
| lotApi.setPublicFields | 498 | PUT | `/lots/${id}/public-fields` | src/modules/traceability/traceability.routes.js:60 | non | **aucun écran** |
| lotApi.recall | 500 | POST | `/lots/${id}/recall` | src/modules/traceability/traceability.routes.js:64 | non | **aucun écran** |
| projectApi.list | 507 | GET | `/projects` | src/modules/projects/projects.routes.js:66 | non | 5 (app/admin/projects.tsx, app/farmer/projects/index.tsx, app/projets.tsx…) |
| projectApi.get | 509 | GET | `/projects/${id}` | src/modules/projects/projects.routes.js:78 | non | 5 (app/farmer/projects/[id].tsx, app/investment/projects/[id].tsx, app/projets/[id].tsx…) |
| insightsApi.overview | 516 | GET | `/insights/overview` | src/modules/insights/insights.routes.js:26 | non | 3 (app/insights/index.tsx, app/insights/[country]/[region].tsx, app/public-site/agriculture/[country].tsx) |
| insightsApi.crops | 519 | GET | `/insights/crops` | src/modules/insights/insights.routes.js:33 | non | 2 (app/insights/index.tsx, app/public-site/agriculture/[country].tsx) |
| insightsApi.activity | 522 | GET | `/insights/activity` | src/modules/insights/insights.routes.js:40 | non | 1 (app/insights/index.tsx) |
| insightsApi.disclosurePolicy | 524 | GET | `/insights/disclosure-policy` | src/modules/insights/insights.routes.js:48 | non | 1 (app/insights/index.tsx) |
| dashboardApi.farmer | 528 | GET | `/dashboard` | src/modules/dashboard/dashboard.routes.js:9 | non | 2 (app/farmer/index.tsx, app/farmer/surveys.tsx) |
| dashboardApi.invest | 529 | GET | `/invest` | src/modules/investdashboard/dashboard.routes.js:12 | non | **aucun écran** |
| messagingApi.conversations | 536 | GET | `/messaging/conversations` | src/modules/messaging/messaging.routes.js:45 | non | 2 (app/admin/messages.tsx, app/messages/index.tsx) |
| messagingApi.createConversation | 539 | POST | `/messaging/conversations` | src/modules/messaging/messaging.routes.js:38 | non | **aucun écran** |
| messagingApi.messages | 546 | GET | `/messaging/conversations/${conversationId}/messages` | src/modules/messaging/messaging.routes.js:52 | non | 1 (app/messages/[conversationId].tsx) |
| messagingApi.send | 550 | POST | `/messaging/conversations/${conversationId}/messages` | src/modules/messaging/messaging.routes.js:60 | non | 1 (app/messages/[conversationId].tsx) |
| messagingApi.archive | 552 | POST | `/messaging/conversations/${conversationId}/archive` | src/modules/messaging/messaging.routes.js:64 | non | **aucun écran** |
| messagingApi.block | 555 | POST | `/messaging/conversations/${conversationId}/block` | src/modules/messaging/messaging.routes.js:68 | non | **aucun écran** |
| messagingApi.reportMessage | 557 | POST | `/messaging/messages/${messageId}/report` | src/modules/messaging/messaging.routes.js:73 | non | **aucun écran** |
| seasonApi.list | 579 | GET | `/seasons` | src/modules/seasons/seasons.routes.js:25 | non | 1 (app/farmer/season-feedback.tsx) |
| seasonApi.get | 588 | GET | `/seasons/${id}` | src/modules/seasons/seasons.routes.js:18 | non | **aucun écran** |
| seasonApi.create | 593 | POST | `/seasons` | src/modules/seasons/seasons.routes.js:32 | non | 1 (app/farmer/season-feedback.tsx) |
| seasonApi.update | 606 | PATCH | `/seasons/${id}` | src/modules/seasons/seasons.routes.js:54 | non | **aucun écran** |
| seasonApi.archive | 615 | DELETE | `/seasons/${id}` | src/modules/seasons/seasons.routes.js:62 | non | **aucun écran** |
| seasonApi.compare | 617 | GET | `/seasons/${id}/compare` | src/modules/seasons/seasons.routes.js:47 | non | 1 (app/farmer/season-feedback.tsx) |
| seasonApi.stats | 618 | GET | `/seasons/stats` | src/modules/seasons/seasons.routes.js:18 | non | **aucun écran** |
| smsConsentApi.get | 624 | GET | `/sms/consent` | src/modules/smsDelivery/smsDelivery.routes.js:80 | non | 1 (app/notifications/sms-consent.tsx) |
| smsConsentApi.grant | 626 | POST | `/sms/consent` | src/modules/smsDelivery/smsDelivery.routes.js:103 | non | 1 (app/notifications/sms-consent.tsx) |
| smsConsentApi.withdraw | 638 | DELETE | `/sms/consent` | src/modules/smsDelivery/smsDelivery.routes.js:124 | non | 1 (app/notifications/sms-consent.tsx) |
| notificationApi.list | 643 | GET | `/notifications` | src/modules/notifications/notifications.routes.js:34 | non | 2 (app/farmer/notifications.tsx, app/notifications/index.tsx) |
| notificationApi.readAll | 645 | POST | `/notifications/read-all` | src/modules/notifications/notifications.routes.js:41 | non | 1 (app/notifications/index.tsx) |
| notificationApi.read | 646 | POST | `/notifications/${id}/read` | src/modules/notifications/notifications.routes.js:44 | non | 1 (app/notifications/index.tsx) |
| notificationApi.preferences | 648 | GET | `/notifications/preferences` | src/modules/notifications/notifications.routes.js:48 | non | 1 (app/notifications/preferences.tsx) |
| notificationApi.setPreferences | 649 | PUT | `/notifications/preferences` | src/modules/notifications/notifications.routes.js:51 | non | 1 (app/notifications/preferences.tsx) |
| iotApi.devices | 657 | GET | `/iot/devices` | src/modules/iot/iot.routes.js:61 | non | 3 (app/admin/devices.tsx, app/farmer/devices.tsx, app/farmer/plots/[id]/sensors.tsx) |
| iotApi.registerDevice | 659 | POST | `/iot/devices` | src/modules/iot/iot.routes.js:64 | non | 1 (app/farmer/plots/[id]/sensors.tsx) |
| iotApi.rotateKey | 666 | POST | `/iot/devices/${id}/rotate-key` | src/modules/iot/iot.routes.js:67 | non | 1 (app/farmer/plots/[id]/sensors.tsx) |
| iotApi.revoke | 668 | POST | `/iot/devices/${id}/revoke` | src/modules/iot/iot.routes.js:70 | non | 1 (app/farmer/plots/[id]/sensors.tsx) |
| iotApi.readings | 670 | GET | `/iot/devices/${id}/readings` | src/modules/iot/iot.routes.js:74 | non | 1 (app/farmer/plots/[id]/sensors.tsx) |
| organizationApi.list | 677 | GET | `/organizations` | src/modules/organizations/organizations.routes.js:13 | non | 3 (app/admin/cooperatives.tsx, app/organization/index.tsx, app/public-site/cooperatives/index.tsx) |
| organizationApi.create | 679 | POST | `/organizations` | src/modules/organizations/organizations.routes.js:14 | non | 1 (app/organization/create.tsx) |
| organizationApi.get | 680 | GET | `/organizations/${id}` | src/modules/organizations/organizations.routes.js:15 | non | 4 (app/organization/invitations.tsx, app/organization/members.tsx, app/organization/profile.tsx…) |
| organizationApi.update | 681 | PATCH | `/organizations/${id}` | src/modules/organizations/organizations.routes.js:16 | non | 1 (app/organization/profile.tsx) |
| cooperativeApi.current | 686 | GET | `/cooperatives/current` | src/modules/cooperatives/cooperatives.routes.js:15 | non | 4 (app/cooperatives/index.tsx, app/cooperatives/[slug].tsx, app/organization/member-import.tsx…) |
| cooperativeApi.updateCurrent | 687 | PATCH | `/cooperatives/current` | src/modules/cooperatives/cooperatives.routes.js:16 | non | **aucun écran** |
| cooperativeApi.members | 688 | GET | `/cooperatives/${id}/members` | src/modules/cooperatives/cooperatives.routes.js:19 | non | 1 (app/cooperatives/index.tsx) |
| cooperativeApi.addMember | 690 | POST | `/cooperatives/${id}/members` | src/modules/cooperatives/cooperatives.routes.js:26 | non | **aucun écran** |
| cooperativeApi.importMembers | 692 | POST | `/cooperatives/${id}/members/import` | src/modules/cooperatives/cooperatives.routes.js:33 | non | 1 (app/organization/member-import.tsx) |
| cooperativeApi.updateMember | 694 | PATCH | `/cooperatives/${id}/members/${memberId}` | src/modules/cooperatives/cooperatives.routes.js:40 | non | **aucun écran** |
| cooperativeApi.overview | 696 | GET | `/cooperatives/${id}/overview` | src/modules/cooperatives/cooperatives.routes.js:47 | non | 1 (app/cooperatives/index.tsx) |
| cooperativeApi.previewGroupOffer | 698 | POST | `/cooperatives/${id}/group-offers/preview` | src/modules/cooperatives/cooperatives.routes.js:55 | non | **aucun écran** |
| cooperativeApi.groupOffers | 700 | GET | `/cooperatives/${id}/group-offers` | src/modules/cooperatives/cooperatives.routes.js:62 | non | 1 (app/organization/offers.tsx) |
| cooperativeApi.createGroupOffer | 701 | POST | `/cooperatives/${id}/group-offers` | src/modules/cooperatives/cooperatives.routes.js:69 | non | **aucun écran** |
| cooperativeApi.confirmGroupOffer | 703 | POST | `/cooperatives/${id}/group-offers/${offerId}/confirm` | src/modules/cooperatives/cooperatives.routes.js:76 | non | **aucun écran** |
| cooperativeApi.cancelGroupOffer | 705 | POST | `/cooperatives/${id}/group-offers/${offerId}/cancel` | src/modules/cooperatives/cooperatives.routes.js:82 | non | **aucun écran** |
| verificationApi.request | 713 | POST | `/verifications` | src/modules/verification/verification.routes.js:15 | non | **aucun écran** |
| verificationApi.mine | 715 | GET | `/verifications/me` | src/modules/verification/verification.routes.js:22 | non | 2 (app/farmer/verification.tsx, app/organization/verification.tsx) |
| verificationApi.adminQueue | 717 | GET | `/admin/verifications` | src/modules/verification/verification.routes.js:31 | non | 5 (app/admin/verifications.tsx, app/agent/index.tsx, app/reviewer/checklists/[id].tsx…) |
| verificationApi.decide | 719 | PATCH | `/admin/verifications/${id}` | src/modules/verification/verification.routes.js:38 | non | 2 (app/reviewer/checklists/[id].tsx, app/reviewer/index.tsx) |
| certificationApi.list | 724 | GET | `/certifications` | src/modules/certifications/certifications.routes.js:38 | non | 2 (app/farmer/certifications.tsx, app/reviewer/index.tsx) |
| certificationApi.create | 725 | POST | `/certifications` | src/modules/certifications/certifications.routes.js:43 | non | **aucun écran** |
| certificationApi.forOrganization | 726 | GET | `/certifications/organization/${organizationId}` | src/modules/certifications/certifications.routes.js:48 | non | **aucun écran** |
| certificationApi.get | 727 | GET | `/certifications/${id}` | src/modules/certifications/certifications.routes.js:51 | non | **aucun écran** |
| certificationApi.verify | 728 | PATCH | `/certifications/${id}/verify` | src/modules/certifications/certifications.routes.js:55 | non | 1 (app/reviewer/index.tsx) |
| certificationApi.remove | 730 | DELETE | `/certifications/${id}` | src/modules/certifications/certifications.routes.js:59 | non | **aucun écran** |
| aiApi.analyze | 737 | POST | `/ai/analyses` | src/modules/ai/ai.routes.js:45 | non | 1 (app/ai/index.tsx) |
| aiApi.copilot | 738 | POST | `/ai/copilot` | src/modules/ai/ai.routes.js:49 | non | 1 (app/ai/index.tsx) |
| aiApi.analyzeDocument | 740 | POST | `/ai/documents` | src/modules/ai/ai.routes.js:55 | non | **aucun écran** |
| aiApi.list | 742 | GET | `/ai/analyses` | src/modules/ai/ai.routes.js:60 | non | 5 (app/agent/index.tsx, app/ai/analyses/index.tsx, app/ai/documents.tsx…) |
| aiApi.get | 744 | GET | `/ai/analyses/${id}` | src/modules/ai/ai.routes.js:67 | non | 1 (app/ai/analyses/[id].tsx) |
| aiApi.escalate | 746 | POST | `/ai/analyses/${id}/escalate` | src/modules/ai/ai.routes.js:71 | non | 1 (app/ai/index.tsx) |
| aiApi.review | 748 | POST | `/ai/analyses/${id}/review` | src/modules/ai/ai.routes.js:76 | non | **aucun écran** |
| aiApi.feedback | 749 | POST | `/ai/analyses/${id}/feedback` | src/modules/ai/ai.routes.js:83 | non | **aucun écran** |
| apiClientApi.clients | 756 | GET | `/api-clients/clients` | src/modules/apiclients/apiclients.routes.js:30 | non | 4 (app/admin/api-clients.tsx, app/developers/index.tsx, app/developers/keys.tsx…) |
| apiClientApi.create | 757 | POST | `/api-clients/clients` | src/modules/apiclients/apiclients.routes.js:33 | non | 1 (app/developers/index.tsx) |
| apiClientApi.setPurpose | 760 | PATCH | `/api-clients/clients/${id}/purpose` | src/modules/apiclients/apiclients.routes.js:39 | non | 1 (app/developers/index.tsx) |
| apiClientApi.createKey | 762 | POST | `/api-clients/clients/${id}/keys` | src/modules/apiclients/apiclients.routes.js:44 | non | 1 (app/developers/index.tsx) |
| apiClientApi.revokeKey | 764 | DELETE | `/api-clients/keys/${keyId}` | src/modules/apiclients/apiclients.routes.js:48 | non | 1 (app/developers/index.tsx) |
| apiClientApi.usage | 765 | GET | `/api-clients/clients/${id}/usage` | src/modules/apiclients/apiclients.routes.js:53 | non | 1 (app/developers/index.tsx) |
| investApi.projects | 772 | GET | `/investment/projects` | src/modules/investors/hub.routes.js:27 | non | 1 (app/investment/index.tsx) |
| investApi.followed | 774 | GET | `/investment/followed` | src/modules/investors/hub.routes.js:34 | non | 2 (app/investment/followed.tsx, app/investment/index.tsx) |
| investApi.follow | 775 | POST | `/investment/projects/${id}/follow` | src/modules/investors/hub.routes.js:40 | non | 1 (app/investment/index.tsx) |
| investApi.unfollow | 776 | DELETE | `/investment/projects/${id}/follow` | src/modules/investors/hub.routes.js:48 | non | **aucun écran** |
| investApi.matches | 777 | GET | `/investment/matches` | src/modules/investors/hub.routes.js:56 | non | **aucun écran** |
| investApi.contact | 779 | POST | `/investment/projects/${id}/contact` | src/modules/investors/hub.routes.js:63 | non | **aucun écran** |
| investApi.decideContact | 781 | POST | `/investment/projects/${id}/contacts/${requestId}/decide` | src/modules/investors/hub.routes.js:74 | non | **aucun écran** |
| investApi.contactRequests | 783 | GET | `/investment/contact-requests` | src/modules/investors/hub.routes.js:85 | non | **aucun écran** |
| investApi.profile | 784 | GET | `/investors/me` | src/modules/investors/investors.routes.js:32 | non | 1 (app/investment/index.tsx) |
| investApi.updateProfile | 785 | PUT | `/investors/me` | src/modules/investors/investors.routes.js:35 | non | **aucun écran** |
| investApi.dashboard | 786 | GET | `/invest` | src/modules/investdashboard/dashboard.routes.js:12 | non | 2 (app/investment/index.tsx, app/investment/requests.tsx) |
| projectDataApi.documents | 790 | GET | `/dataroom/projects/${projectId}/documents` | src/modules/dataroom/dataroom.routes.js:46 | non | 1 (app/farmer/projects/[id]/dataroom.tsx) |
| projectDataApi.addDocument | 791 | POST | `/dataroom/projects/${projectId}/documents` | src/modules/dataroom/dataroom.routes.js:49 | non | **aucun écran** |
| projectDataApi.requestAccess | 793 | POST | `/dataroom/projects/${projectId}/access-requests` | src/modules/dataroom/dataroom.routes.js:53 | non | **aucun écran** |
| projectDataApi.decideAccess | 795 | PATCH | `/dataroom/access-requests/${requestId}` | src/modules/dataroom/dataroom.routes.js:57 | non | **aucun écran** |
| projectDataApi.document | 797 | GET | `/dataroom/documents/${documentId}` | src/modules/dataroom/dataroom.routes.js:61 | non | **aucun écran** |
| projectDataApi.accessLog | 798 | GET | `/dataroom/projects/${projectId}/access-log` | src/modules/dataroom/dataroom.routes.js:65 | non | 1 (app/farmer/projects/[id]/access-log.tsx) |
| projectDataApi.fundingRequests | 799 | GET | `/funding/projects/${projectId}/funding-requests` | src/modules/funding/funding.routes.js:26 | non | **aucun écran** |
| projectDataApi.consentFunding | 800 | POST | `/funding/projects/${projectId}/funding-requests/consent` | src/modules/funding/funding.routes.js:30 | non | **aucun écran** |
| projectDataApi.transmitFunding | 802 | POST | `/funding/funding-requests/${id}/transmit` | src/modules/funding/funding.routes.js:37 | non | **aucun écran** |
| projectDataApi.followUpFunding | 803 | PATCH | `/funding/funding-requests/${id}/follow-up` | src/modules/funding/funding.routes.js:41 | non | **aucun écran** |
| projectDataApi.reports | 805 | GET | `/projects/${projectId}/reports` | src/modules/reporting/reporting.routes.js:44 | non | 1 (app/farmer/projects/[id]/reports.tsx) |
| projectDataApi.addProgressReport | 807 | POST | `/projects/${projectId}/progress-reports` | src/modules/reporting/reporting.routes.js:48 | non | **aucun écran** |
| projectDataApi.addImpactReport | 809 | POST | `/projects/${projectId}/impact-reports` | src/modules/reporting/reporting.routes.js:53 | non | **aucun écran** |
| transportApi.requests | 816 | GET | `/transport/requests` | src/modules/transport/transport.routes.js:43 | non | 3 (app/farmer/transport.tsx, app/organization/transport.tsx, app/public-site/transporters.tsx) |
| transportApi.create | 818 | POST | `/transport/requests` | src/modules/transport/transport.routes.js:46 | non | **aucun écran** |
| transportApi.offer | 820 | POST | `/transport/requests/${id}/offers` | src/modules/transport/transport.routes.js:49 | non | **aucun écran** |
| transportApi.acceptOffer | 822 | POST | `/transport/offers/${offerId}/accept` | src/modules/transport/transport.routes.js:53 | non | **aucun écran** |
| transportApi.proofOfDelivery | 824 | POST | `/transport/requests/${id}/proof-of-delivery` | src/modules/transport/transport.routes.js:57 | non | **aucun écran** |
| transportApi.setStatus | 826 | PATCH | `/transport/requests/${id}/status` | src/modules/transport/transport.routes.js:61 | non | **aucun écran** |
| adminApi.dashboard | 834 | GET | `/admin/dashboard` | src/modules/admin/admin.routes.js:19 | non | 3 (app/admin/ai-usage.tsx, app/admin/dashboard.tsx, app/admin/index.tsx) |
| adminApi.dashboardExport | 837 | GET | `/admin/dashboard/export` | src/modules/admin/admin.routes.js:27 | non | **aucun écran** |
| adminApi.users | 843 | GET | `/admin/users` | src/modules/admin/admin.routes.js:34 | non | 5 (app/admin/farmers.tsx, app/admin/index.tsx, app/admin/investors.tsx…) |
| adminApi.user | 857 | GET | `/admin/users/${id}` | src/modules/admin/admin.routes.js:42 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.setUserStatus | 859 | PATCH | `/admin/users/${id}/status` | src/modules/admin/admin.routes.js:49 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.unlockUser | 862 | POST | `/admin/users/${id}/unlock` | src/modules/admin/admin.routes.js:58 | non | 2 (app/admin/security.tsx, app/admin/users/[id].tsx) |
| adminApi.forceLogout | 865 | POST | `/admin/users/${id}/force-logout` | src/modules/admin/admin.routes.js:65 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.verifyUserEmail | 868 | POST | `/admin/users/${id}/verify-email` | src/modules/admin/admin.routes.js:72 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.verifyUserPhone | 870 | POST | `/admin/users/${id}/verify-phone` | src/modules/admin/admin.routes.js:79 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.roles | 873 | GET | `/admin/roles` | src/modules/admin/admin.routes.js:88 | non | 1 (app/admin/roles.tsx) |
| adminApi.grantRole | 875 | POST | `/admin/users/${id}/roles` | src/modules/admin/admin.routes.js:96 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.revokeRole | 880 | DELETE | `/admin/users/${id}/roles/${role}` | src/modules/admin/admin.routes.js:103 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.deleteUser | 882 | DELETE | `/admin/users/${id}` | src/modules/admin/admin.routes.js:109 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.exportUser | 885 | GET | `/admin/users/${id}/export` | src/modules/admin/admin.routes.js:116 | non | 1 (app/admin/users/[id].tsx) |
| adminApi.audit | 887 | GET | `/admin/audit` | src/modules/admin/admin.routes.js:123 | non | 2 (app/admin/audit.tsx, app/admin/index.tsx) |
| adminApi.auditExport | 900 | GET | `/admin/audit/export` | src/modules/admin/admin.security.routes.js:20 | non | 1 (app/admin/audit.tsx) |
| adminApi.jobs | 914 | GET | `/admin/jobs` | src/modules/admin/admin.monitoring.routes.js:21 | non | 2 (app/admin/index.tsx, app/admin/jobs.tsx) |
| adminApi.runJob | 916 | POST | `/admin/jobs/${name}/run` | src/modules/admin/admin.monitoring.routes.js:23 | non | 2 (app/admin/index.tsx, app/admin/jobs.tsx) |
| adminApi.pauseJob | 919 | POST | `/admin/jobs/${name}/pause` | src/modules/admin/admin.monitoring.routes.js:32 | non | 1 (app/admin/jobs.tsx) |
| adminApi.resumeJob | 920 | POST | `/admin/jobs/${name}/resume` | src/modules/admin/admin.monitoring.routes.js:39 | non | 1 (app/admin/jobs.tsx) |
| adminApi.monitoringServices | 922 | GET | `/admin/monitoring/services` | src/modules/admin/admin.monitoring.routes.js:49 | non | 1 (app/admin/monitoring.tsx) |
| adminApi.monitoringHealth | 924 | GET | `/admin/monitoring/health` | src/modules/admin/admin.monitoring.routes.js:51 | non | 1 (app/admin/monitoring.tsx) |
| adminApi.securityOverview | 926 | GET | `/admin/security/overview` | src/modules/admin/admin.security.routes.js:30 | non | 1 (app/admin/security.tsx) |
| adminApi.securityPolicy | 928 | GET | `/admin/security/policy` | src/modules/admin/admin.security.routes.js:36 | non | 1 (app/admin/security.tsx) |
| adminApi.updateSecurityPolicy | 929 | PUT | `/admin/security/policy` | src/modules/admin/admin.security.routes.js:38 | non | 1 (app/admin/security.tsx) |
| adminApi.operationsList | 932 | GET | `/admin/operations/${entity}` | src/modules/admin/admin.operations.routes.js:20 | non | 1 (app/admin/operations.tsx) |
| adminApi.operationsDetail | 935 | GET | `/admin/operations/${entity}/${id}` | src/modules/admin/admin.operations.routes.js:32 | non | **aucun écran** |
| adminApi.moderateOperation | 938 | POST | `/admin/operations/${entity}/${id}/moderate` | src/modules/admin/admin.operations.routes.js:43 | non | 1 (app/admin/operations.tsx) |
| adminApi.broadcastAnnouncement | 941 | POST | `/admin/notifications/broadcast` | src/modules/admin/admin.notifications.routes.js:19 | non | 1 (app/admin/notifications.tsx) |
| adminApi.notificationsHistory | 944 | GET | `/admin/notifications/history` | src/modules/admin/admin.notifications.routes.js:28 | non | 1 (app/admin/notifications.tsx) |
| adminApi.settings | 946 | GET | `/admin/settings` | src/modules/admin/admin.settings.routes.js:37 | non | 1 (app/admin/settings.tsx) |
| adminApi.updateSettings | 947 | PUT | `/admin/settings` | src/modules/admin/admin.settings.routes.js:43 | non | **aucun écran** |
| adminApi.exportFarms | 948 | URL | `/admin/export/farms` | src/modules/admin/admin.routes.js:161 | non | 1 (app/admin/reports.tsx) |
| mediaApi.uploadUrl | 955 | POST | `/media/upload-url` | src/modules/media/media.routes.js:14 | non | **aucun écran** |
| mediaApi.confirm | 959 | POST | `/media/${id}/confirm` | src/modules/media/media.routes.js:20 | non | **aucun écran** |
| mediaApi.list | 960 | GET | `/media` | src/modules/media/media.routes.js:26 | non | 1 (app/farmer/gallery.tsx) |
| exportApi.list | 970 | GET | `/exports` | src/modules/exports/exports.routes.js:46 | non | 2 (app/farmer/export/index.tsx, app/international/documents.tsx) |
| exportApi.get | 973 | GET | `/exports/${id}` | src/modules/exports/exports.routes.js:54 | non | 2 (app/farmer/export/[id]/documents.tsx, app/farmer/export/[id].tsx) |
| exportApi.create | 974 | POST | `/exports` | src/modules/exports/exports.routes.js:51 | non | **aucun écran** |
| exportApi.addDocument | 976 | POST | `/exports/${id}/documents` | src/modules/exports/exports.routes.js:57 | non | **aucun écran** |
| exportApi.setStatus | 978 | PATCH | `/exports/${id}/status` | src/modules/exports/exports.routes.js:61 | non | **aucun écran** |
| syncApi.collections | 986 | GET | `/sync/collections` | src/modules/sync/sync.routes.js:37 | non | 1 (app/farmer/sync.tsx) |
| syncApi.push | 988 | POST | `/sync/push` | src/modules/sync/sync.routes.js:40 | non | **aucun écran** |
| syncApi.pull | 991 | GET | `/sync/pull` | src/modules/sync/sync.routes.js:43 | non | 1 (app/farmer/sync.tsx) |
| syncApi.conflicts | 994 | GET | `/sync/conflicts` | src/modules/sync/sync.routes.js:46 | non | 1 (app/farmer/sync/conflicts.tsx) |
| satelliteApi.settings | 1003 | GET | `/satellite/settings` | src/modules/satellite/acquisition.routes.js:27 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| satelliteApi.observations | 1008 | GET | `/satellite/plots/${plotId}/observations` | src/modules/satellite/acquisition.routes.js:49 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| satelliteApi.acquire | 1015 | POST | `/satellite/plots/${plotId}/acquire` | src/modules/satellite/acquisition.routes.js:34 | non | 1 (app/farmer/plots/[id]/satellite.tsx) |
| recommendationApi.list | 1021 | GET | `/plots/${plotId}/recommendations` | src/modules/recommendation/recommendation.routes.js:90 | non | 1 (app/farmer/plots/[id]/recommendations.tsx) |
| recommendationApi.create | 1027 | POST | `/plots/${plotId}/recommendations` | src/modules/recommendation/recommendation.routes.js:77 | non | 1 (app/farmer/plots/[id]/recommendations.tsx) |
| recommendationApi.one | 1029 | GET | `/recommendations/${id}` | src/modules/recommendation/recommendation.routes.js:112 | non | **aucun écran** |
| recommendationApi.explanation | 1030 | GET | `/recommendations/${id}/explanation` | src/modules/recommendation/recommendation.routes.js:152 | non | **aucun écran** |
| recommendationApi.decide | 1035 | POST | `/recommendations/${id}/decision` | src/modules/recommendation/recommendation.routes.js:167 | non | 1 (app/farmer/plots/[id]/recommendations.tsx) |
| alertApi.list | 1049 | GET | `/alerts` | src/modules/alerts/alerts.routes.js:28 | non | 3 (app/farmer/alerts.tsx, app/farmer/index.tsx, app/farmer/plots/[id]/sensors.tsx) |
| alertApi.meta | 1067 | GET | `/alerts/meta` | src/modules/alerts/alerts.routes.js:57 | non | 1 (app/farmer/alerts.tsx) |
| alertApi.one | 1068 | GET | `/alerts/${id}` | src/modules/alerts/alerts.routes.js:57 | non | **aucun écran** |
| alertApi.markRead | 1070 | POST | `/alerts/${id}/read` | src/modules/alerts/alerts.routes.js:72 | non | 2 (app/farmer/alerts.tsx, app/farmer/plots/[id]/sensors.tsx) |
| alertApi.markHandled | 1072 | POST | `/alerts/${id}/handled` | src/modules/alerts/alerts.routes.js:87 | non | 2 (app/farmer/alerts.tsx, app/farmer/plots/[id]/sensors.tsx) |
| anomalyApi.settings | 1078 | GET | `/anomalies/settings` | src/modules/anomalies/anomalies.routes.js:33 | non | 1 (app/admin/devices.tsx) |
| anomalyApi.list | 1079 | GET | `/anomalies` | src/modules/anomalies/anomalies.routes.js:40 | non | 1 (app/admin/devices.tsx) |
| anomalyApi.one | 1081 | GET | `/anomalies/${id}` | src/modules/anomalies/anomalies.routes.js:33 | non | **aucun écran** |
| anomalyApi.detectDevice | 1082 | POST | `/anomalies/devices/${deviceId}/detect` | src/modules/anomalies/anomalies.routes.js:66 | non | **aucun écran** |
| anomalyApi.detectPlot | 1084 | POST | `/anomalies/plots/${plotId}/detect` | src/modules/anomalies/anomalies.routes.js:80 | non | **aucun écran** |
| anomalyApi.review | 1090 | POST | `/anomalies/${id}/review` | src/modules/anomalies/anomalies.routes.js:95 | non | 1 (app/admin/devices.tsx) |
| agronomicRangeApi.list | 1095 | GET | `/agronomic-ranges` | src/modules/recommendation/agronomicRanges.routes.js:134 | non | **aucun écran** |
| agronomicRangeApi.meta | 1097 | GET | `/agronomic-ranges/meta` | src/modules/recommendation/agronomicRanges.routes.js:144 | non | **aucun écran** |
| agronomicRangeApi.one | 1098 | GET | `/agronomic-ranges/${id}` | src/modules/recommendation/agronomicRanges.routes.js:144 | non | **aucun écran** |
| agronomicRangeApi.create | 1100 | POST | `/agronomic-ranges` | src/modules/recommendation/agronomicRanges.routes.js:223 | non | 1 (app/admin/agronomic-ranges.tsx) |
| agronomicRangeApi.update | 1122 | PATCH | `/agronomic-ranges/${id}` | src/modules/recommendation/agronomicRanges.routes.js:234 | non | **aucun écran** |
| agronomicRangeApi.validate | 1137 | POST | `/agronomic-ranges/${id}/validate` | src/modules/recommendation/agronomicRanges.routes.js:252 | non | 1 (app/admin/agronomic-ranges.tsx) |
| agronomicRangeApi.retire | 1139 | POST | `/agronomic-ranges/${id}/retire` | src/modules/recommendation/agronomicRanges.routes.js:265 | non | 1 (app/admin/agronomic-ranges.tsx) |
| agronomicRangeApi.importTemplate | 1141 | GET | `/agronomic-ranges/import/template` | src/modules/recommendation/agronomicRanges.routes.js:173 | non | 1 (app/admin/agronomic-ranges.tsx) |
| agronomicRangeApi.importCsv | 1143 | POST | `/agronomic-ranges/import` | src/modules/recommendation/agronomicRanges.routes.js:203 | non | 1 (app/admin/agronomic-ranges.tsx) |
