# Rapport d'audit technique — Application mobile React Native

**Projet :** AGRIKONNECT AFRICA. Le nom est attesté par `app.json:3` (« AgriKonnect Africa »), `src/lib/config.ts:34` (`APP.name = 'AGRIKONNECT AFRICA'`), le paquet `agrikonnect-mobile` (`package.json:2`) et l'identifiant `africa.agrikonnect.mobile` (`app.json:14,22`).

**Périmètre :** `apps/Mobile`, soit 291 fichiers et 40 293 lignes dans `src/`.

**Date :** 14/11/2026.

**Nature :** audit en lecture seule. Aucun fichier du projet n'a été modifié.

| Base auditée | Copie de travail courante, et non le commit `7b8fda2`. `apps/Mobile` contient 16 fichiers modifiés et 2 fichiers non suivis (`AppErrorBoundary.tsx`, `HorizonMobile.tsx`). Les numéros de ligne cités se rapportent à cette copie. L'état git d'`apps/Mobile` est identique avant et après l'audit. |
|---|---|

---

## 0. Synthèse exécutive

**Verdict : l'application mobile n'est pas prête pour une mise en production sur les stores.**

Le socle technique est sain :
- TypeScript strict, 0 erreur ;
- export Android et iOS fonctionnel ;
- client HTTP centralisé ;
- jetons dans SecureStore ;
- 304 appels API qui correspondent tous à une route backend existante.

Le produit livré ne tient cependant pas les promesses de son README. Les points bloquants sont les suivants :

1. **Session dégradée toutes les ~15 minutes (CRITIQUE).** La requête rejouée après renouvellement du jeton renvoie `data = undefined`. C'est reproduit en isolation. Sur mobile, chaque retour au premier plan après expiration déclenche ce chemin.
2. **Aucune fonctionnalité native de terrain.** Ni GPS, ni caméra, ni galerie, ni envoi de fichier, ni notification push, ni carte native, ni détection réseau, ni hors-ligne. Les permissions caméra et localisation sont pourtant déclarées.
3. **La création de parcelle échoue toujours.** La géométrie n'est jamais envoyée, alors que le backend l'exige. L'identifiant d'exploitation se saisit à la main.
4. **Navigation cassée.**
   - La barre d'onglets du producteur affiche 47 entrées au lieu de 5.
   - 80 écrans sur 213 n'ont aucun lien entrant, dont 30 écrans d'administration.
   - Aucune garde de rôle n'existe dans l'interface.
5. **Espaces et écrans non fonctionnels.**
   - L'espace vérificateur renvoie 403 aux agronomes et laboratoires.
   - Les écrans publics appellent des routes authentifiées.
   - L'écran « Paramètres » est factice, y compris l'interrupteur 2FA.
6. **Sécurité et production.**
   - L'URL de l'API retombe sur `http://localhost`, et aucun profil de build n'existe.
   - Le transport en clair est autorisé sur iOS (`NSAllowsArbitraryLoads: true`) mais bloqué sur Android en release.
   - Le cache n'est pas purgé à la déconnexion (fuite entre utilisateurs d'un même appareil).
   - Une coupure réseau pendant le renouvellement déconnecte l'utilisateur.
7. **Internationalisation quasi absente.** On compte 109 appels `t()` dans 21 fichiers sur 286, pour environ 2 800 textes écrits en dur.

| Criticité | Nombre | Identifiants |
|---|---:|---|
| CRITIQUE | 1 | MOB-C01 |
| ÉLEVÉ | 13 | MOB-E01 → MOB-E13 |
| MOYEN | 21 | MOB-M01 → MOB-M21 |
| FAIBLE | 12 | MOB-F01 → MOB-F12 |
| INFORMATIONNEL | 7 | MOB-I01 → MOB-I07 |

Les livrables associés sont :
- [PLAN_CORRECTION_REACT_NATIVE.md](PLAN_CORRECTION_REACT_NATIVE.md) ;
- [AUDIT_SECURITE_MOBILE.md](AUDIT_SECURITE_MOBILE.md) ;
- [AUDIT_INTEGRATION_API_MOBILE.md](AUDIT_INTEGRATION_API_MOBILE.md) ;
- [AUDIT_I18N_MOBILE.md](AUDIT_I18N_MOBILE.md) ;
- [AUDIT_UI_UX_MOBILE.md](AUDIT_UI_UX_MOBILE.md) ;
- [INVENTAIRE_REACT_NATIVE.md](INVENTAIRE_REACT_NATIVE.md).

---

## 1. Périmètre et méthodologie

### 1.1 Périmètre

| Inclus | Exclu |
|---|---|
| `apps/Mobile/src` : écrans `app/`, composants, services, store, i18n, thème, lib, hooks | Backend. Il est consulté en lecture seule pour comparer les contrats, sans aucune modification |
| `package.json`, `app.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `.env.example`, `scripts/` | `apps/web`, déjà couvert par `AUDIT_FRONTEND/` |
| Configuration native générée, observée par introspection en mémoire | Exécution sur appareil ou émulateur réel (indisponible) |

### 1.2 Contrôles exécutés (non destructifs)

| # | Contrôle | Environnement | Résultat |
|---|---|---|---|
| 1 | `tsc --noEmit -p tsconfig.json` | projet, lecture seule (`noEmit`) | **0 erreur**, 66 s |
| 2 | `node --test scripts/redirects.test.mjs` | projet, lecture seule | **29/29** réussis. Le test simule `localStorage`, voir MOB-M18 |
| 3 | `expo export --platform android` et `ios` | **copie isolée** dans le dossier temporaire de session (src + configs + jonctions vers `node_modules`, `expo-router` copié) | Succès sur les deux plateformes : bundle Hermes de 6,2 Mo, 104 ressources Android et 101 iOS, 18 Mo |
| 4 | `expo config --type introspect` | copie isolée, évaluation en mémoire | AndroidManifest et Info.plist générés, permissions, ATS, schémas |
| 5 | `expo install --check` | copie isolée, `package.json` de la copie vérifié intact | 13 paquets en retard sur les versions attendues par le SDK 58 |
| 6 | `npm audit --omit=dev` | copie de `package.json` et du lockfile | 11 vulnérabilités : 3 élevées, 7 modérées, 1 faible |
| 7 | Rapprochement des 304 appels API avec les 399 routes backend | script d'analyse statique | 304/304 routes existantes. Les 17 routes `/auth` et `/health` ont été vérifiées à la main |
| 8 | Usage des 304 fonctions API par les écrans | script statique | **101 fonctions inutilisées** (33 %) |
| 9 | Liens internes (332) comparés aux 213 routes du système de fichiers | script statique | **4 liens cassés**, **80 routes orphelines** |
| 10 | i18n : parité des clés et textes en dur | script statique | 173/173 clés en parité. 109 `t()`, environ 2 800 textes en dur |
| 11 | Reproduction du défaut de rejeu (MOB-C01) | script isolé, axios 1.20.0 de `apps/Mobile/node_modules` | Attendu `{data,meta}`, obtenu `{}` |
| 12 | Graphe d'imports | script statique | 0 cycle. 2 modules non référencés |
| 13 | Contrastes WCAG | calcul sur les jetons du thème | Voir AUDIT_UI_UX_MOBILE §6 |

### 1.3 Ce qui n'a pas pu être vérifié (NON VÉRIFIABLE)

| Élément | Raison | Ce qu'il faudrait |
|---|---|---|
| Rendu réel sur appareil, gestes, clavier, encoches | Ni émulateur ni appareil disponible, et aucun backend démarré | Expo Go ou build de développement sur un Android bas de gamme et un iPhone avec encoche |
| Gradle, `AndroidManifest.xml`, `Info.plist`, Podfile versionnés | Projet Expo « managed » : les dossiers `/android` et `/ios` sont générés et ignorés (`.gitignore:39-41`) | `expo prebuild` dans un environnement jetable. Seule l'introspection a été faite |
| minSdk, targetSdk, version minimale iOS, signature, capacités | Aucun `eas.json` ni `expo-build-properties` : ce sont les valeurs par défaut du SDK 58 | `eas.json` + `expo-build-properties` |
| Performances réelles (démarrage, mémoire, batterie, FPS) | Pas d'appareil | Profilage avec Perfetto (Android) et Instruments (iOS) |
| Comportement de `Intl` sous Hermes (notation compacte, `RelativeTimeFormat`) | Dépend du moteur sur l'appareil | Test sur appareil (voir MOB-F05) |

### 1.4 Conventions

- **Fait vérifié** : constaté dans le code ou par exécution. Le fichier et la ligne sont cités.
- **Hypothèse** : déduction plausible non exécutée. Elle est signalée explicitement.
- **Recommandation** : correction proposée. Les détails sont dans le plan de correction.
- **Plateformes** : A = Android, I = iOS, A+I = les deux, W = export web.

---

## 2. Architecture mobile

### 2.1 Pile technique (fait vérifié, `package.json`)

| Couche | Choix | Version |
|---|---|---|
| Socle | Expo managed (CNG), point d'entrée `expo-router/entry` | expo ~58.0.21, react-native 0.88.1, React 19.3.0 |
| Moteur JS | Hermes, d'après les bundles `.hbc` produits par l'export | — |
| Navigation | Expo Router, routes fichiers sous `src/app` | ~58.0.28 |
| État serveur | TanStack Query | ^5.104.5 |
| État client | Zustand (`store/auth.ts`, `i18n/index.ts`) | ^5.0.15 |
| HTTP | Axios avec intercepteurs | ^1.20.0 |
| Temps réel | socket.io-client | ^4.8.4 |
| Stockage | expo-secure-store (Keychain/Keystore), `localStorage` sur le web | ~58.0.2 |
| UI | StyleSheet + jetons de thème (`theme/`), Reanimated 4, Gesture Handler, SVG, expo-image, LinearGradient | — |
| i18n | Maison (Zustand + dictionnaires `fr.ts`/`en.ts`) | — |

### 2.2 Organisation

```
src/
  app/            213 routes + 3 layouts (Expo Router)
    _layout.tsx   racine : polices, i18n, session, garde SessionGate, temps réel
    auth/         7 écrans (pile modale)
    farmer/       47 routes sous un layout Tabs (5 onglets prévus)
    admin/        40 routes
    public-site/  38 routes (doublons de routes publiques racine)
    …             organization (14), investment (5), reviewer (3), agent (3), developers (4),
                  international (4), ai (4), marketplace (4), requests (4), messages (2), notifications (3)…
  components/     ui (24), public-site (13), farmer (5), auth (1), app (1)
  services/       api/http.ts, api/session.ts, api/endpoints.ts (1 145 l.), api/types.ts (2 248 l.),
                  query.ts, realtime.ts
  store/auth.ts   session Zustand
  i18n/           fr.ts, en.ts, index.ts
  lib/            config, redirects, secure-storage, format, phone, ulid, platform, faq, service-catalog
  hooks/          usePublicData, useMouvementReducit
  theme/          agrikonnect (jetons), colors, typography, space, motion, shadows
```

**Points forts (fait vérifié) :**
- séparation nette entre écrans, composants, services et store ;
- un client HTTP unique ;
- une fabrique de clés de cache (`services/query.ts:45-279`) ;
- `session.ts` isolé pour éviter une dépendance circulaire avec le store ;
- 0 cycle d'import.

**Faiblesses (fait vérifié) :**
- **Pas de couche par domaine.** Les écrans appellent directement `xxxApi` dans `useQuery`, avec 179 imports de `@tanstack/react-query`. Il n'existe pas de hooks métier réutilisables, hors `usePublicData.ts`.
- **Routes dupliquées.** 16 routes publiques existent en double, par exemple `/annonces` et `/public-site/annonces` (§9).
- **Fichiers parasites :** `fiche.md` (du code TSX dans un `.md`), `Reveal.tsx.bak` et `platform.ts.bak`.
- **Un seul layout imbriqué** (`farmer/_layout.tsx`). Les espaces admin, organisation, investissement, etc. n'ont ni layout, ni navigation propre (MOB-E04).

### 2.3 Flux d'amorçage (fait vérifié, `src/app/_layout.tsx`)

1. `SplashScreen.preventAutoHideAsync()` (l. 21).
2. `useAppFonts()` et `hydrateLocale()` + `initAuth()` (l. 36-44).
3. Tant que les polices ne sont pas chargées ou que `status === 'booting'`, une vue vide s'affiche (l. 58-60).
4. `AppErrorBoundary` → `GestureHandlerRootView` → `SafeAreaProvider` → `QueryClientProvider` → `SessionGate` + `Stack` (l. 63-82).
5. `SessionGate` (l. 93-137) redirige les racines protégées vers `/auth/login?next=…` si la session est anonyme.
6. Le temps réel se connecte lorsque `status === 'authenticated'` (l. 47-50).

### 2.4 Environnements (fait vérifié)

- **Configuration unique.** `lib/config.ts:13-27` lit `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_REALTIME_URL`, sinon `extra` d'`app.json:56-59`, sinon **`http://localhost:4000`**.
- **Aucun fichier de configuration réel.** Il n'y a ni `.env`, ni `eas.json`, ni `app.config.ts`, ni variante dev/staging/prod.

C'est inadapté à un build de production (MOB-E11).

---

## 3. Analyse par module

Statut attribué après lecture du code et des appels API. « Opérationnel » ne signifie jamais seulement que l'écran existe.

| Module | Routes | Statut | Constats principaux |
|---|---:|---|---|
| Amorçage, session | — | **NON CONFORME** | MOB-C01 rejeu ; MOB-E10 déconnexion sur coupure réseau ; MOB-E09 cache non purgé |
| Authentification | 7 | PARTIELLEMENT IMPLÉMENTÉ | Login et MFA en ligne : OK. Register : validation tardive (MOB-M06) et rôles sensibles (MOB-E13). Reset et écran MFA inaccessibles (MOB-M20) |
| Site public | 38 + ~20 racine | PARTIELLEMENT IMPLÉMENTÉ | Les routes `/public/*` fonctionnent. Les écrans annonces, marchés, ventes, appels d'offres, projets, coopératives, transporteurs, agriculture, prix et météo appellent des routes authentifiées (MOB-E07). 16 doublons |
| Espace producteur | 47 | **NON CONFORME** | Barre d'onglets à 47 entrées (MOB-E03). Création de parcelle impossible (MOB-E01). Paramètres factices (MOB-E12). Boutons inertes. Les modules de parcelle (sol, rotation, plan, précision, zones, capteurs, satellite) sont branchés sur l'API |
| Marché (annonces, demandes, commandes, stock) | ~14 | PARTIELLEMENT IMPLÉMENTÉ | Les appels sont réels. Saisie manuelle d'ID (MOB-M05), prix nul converti en 0 (MOB-M05), 3 liens cassés (MOB-M08), progression inventée (MOB-M11) |
| Messagerie | 2 | PARTIELLEMENT IMPLÉMENTÉ | Envoi et lecture OK, invalidation en temps réel OK. Pas de clavier, pas de pagination, liste imbriquée (MOB-M19) |
| Notifications | 3 | PARTIELLEMENT IMPLÉMENTÉ | Liste, préférences et consentement SMS OK. Canal PUSH proposé mais jamais livré (MOB-M21) |
| Organisation, coopérative | 14 | PARTIELLEMENT IMPLÉMENTÉ | Appels réels. 7 fonctions coopérative sur 12 inutilisées. Contexte multi-organisation inopérant sur natif (MOB-M18) |
| Investissement | 5 | PARTIELLEMENT IMPLÉMENTÉ | 6 fonctions sur 11 inutilisées. Data room accessible côté producteur |
| Vérificateur | 3 | **NON CONFORME** | 403 pour AGRONOMIST et LAB_PARTNER (MOB-E06) |
| Agent de terrain | 3 | PARTIELLEMENT IMPLÉMENTÉ | `/agent/consent` et `/agent/registration` OK. `/agent/index` appelle la file admin, d'où un 403 (MOB-E06) |
| Administration | 40 | PARTIELLEMENT IMPLÉMENTÉ | Les écrans existent, mais environ 30 sont inaccessibles par la navigation (MOB-E04). Export sans jeton (MOB-M10) |
| Développeurs, API | 4 | CONFORME (fonctionnel) / À AMÉLIORER | Clients et clés OK. Révocation sans confirmation (MOB-M07) |
| IA, insights, international | 10 | PARTIELLEMENT IMPLÉMENTÉ | Un lien cassé `/tenders/:id` (MOB-M08) |
| Transport | — | **NON IMPLÉMENTÉ** | Le README le reconnaît. TRANSPORTER atterrit sur `/profil` (`redirects.ts:29-32`). 5 fonctions `transportApi` sur 6 inutilisées |
| Hors-ligne, synchronisation | 2 | **NON IMPLÉMENTÉ** | `farmer/sync.tsx` affiche seulement l'état serveur. Il n'y a ni base locale, ni file d'attente, ni détection réseau (MOB-M02) |
| Géolocalisation, cartographie | — | **NON IMPLÉMENTÉ** | Voir §8. `MapPreview` est un SVG statique |
| Notifications push | — | **NON IMPLÉMENTÉ** | Voir §8 |
| Caméra, galerie, téléversement | — | **NON IMPLÉMENTÉ** | `mediaApi` 2/3 inutilisés. Aucun module natif |

---

## 4. Anomalies détaillées

Format de chaque fiche :
- **Fichier:ligne** ;
- **Preuve** ;
- **Conséquence** ;
- **Plateforme** ;
- **Criticité** ;
- **Correction** ;
- **Test de validation**.

### 4.1 CRITIQUE

#### MOB-C01 — Le rejeu après renouvellement du jeton renvoie des données vides

- **Fichiers :** `src/services/api/http.ts:93-105` (`replay`), `:107-122` (intercepteur), `:130-138` (`request`).
- **Preuve (fait vérifié) :**
  - `replay()` renvoie `response.data`, c'est-à-dire l'enveloppe `{success,data,meta}`. L'intercepteur résout la promesse d'axios avec cette enveloppe à la place d'un objet `AxiosResponse`.
  - `request()` lit ensuite `response.data.data`, ce qui donne `undefined`.
  - Reproduction isolée avec axios 1.20.0 de `apps/Mobile/node_modules` : attendu `{"data":[…],"meta":{…}}`, **obtenu `{}`**.
- **Conséquence (mobile) :**
  - Le jeton d'accès dure 15 minutes au plus (`session.ts:32`). Une application mobile passe la plupart du temps en arrière-plan, et à chaque reprise, la première requête prend ce chemin.
  - Toute requête jouée après un 401 rend `data = undefined` :
    - TanStack Query v5 signale une erreur (« query data cannot be undefined ») ;
    - les mutations considèrent le succès comme vide.
  - **Au démarrage, avec un jeton expiré :**
    - `authApi.me()` rend `data` indéfini, puis `data.user` lève une erreur (`store/auth.ts:77-78`) ;
    - le code se replie sur le profil en cache avec **`permissions: []`** (`:86-91`) ;
    - un administrateur est alors envoyé sur `/profil`, car `redirects.ts:219-226` exige `admin.dashboard`.
- **Plateforme :** A+I+W. **Criticité :** CRITIQUE.
- **Correction :** remplacer `return replay(config)` par `return http.request(config)` (le jeton est réinjecté par l'intercepteur de requête), ou faire renvoyer `response` par `replay`. Ajouter un test unitaire de l'intercepteur.
- **Test :** jeton d'accès expiré et refresh valide, puis `GET /farms`. Les données doivent être identiques au cas nominal. Au démarrage, `permissions` doit être non vide pour un administrateur.

### 4.2 ÉLEVÉ

#### MOB-E01 — La création de parcelle est rejetée à chaque fois

- **Fichiers :** `src/app/farmer/plots/create.tsx:21,33` ; backend `modules/plots/plots.schema.js:15-24` (lecture seule).
- **Preuve :**
  - le mobile envoie `{ farmId, name, areaHa }` ;
  - `createPlotSchema` exige `geometry: geometrySchema` (l. 20), non optionnel : un `Point` ou un `Polygon` ;
  - le champ « Exploitation (ID) » se saisit en texte libre (l. 33).
- **Conséquence :** 422 systématique. La fonction centrale du producteur (PLOT-01/02) est inutilisable sur mobile. Aucun GPS n'est disponible pour fournir la géométrie (MOB-E02).
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :**
  - sélecteur d'exploitation alimenté par `farmApi.list` ;
  - capture GPS (`expo-location`) ou tracé de polygone ;
  - envoi de `geometry` ;
  - validation côté client.
- **Test :** créer une parcelle avec un point GPS ; vérifier 201 et sa présence dans `/farmer/plots`.

#### MOB-E02 — Aucune fonctionnalité native de terrain n'est implémentée

- **Preuve :**
  - les dépendances `package.json:15-48` ne contiennent ni `expo-location`, ni `expo-camera`, ni `expo-image-picker`, ni `expo-document-picker`, ni `expo-notifications`, ni `react-native-maps`, ni `@react-native-community/netinfo`, ni `expo-local-authentication` ;
  - une recherche de `Location|Camera|ImagePicker|Notifications|NetInfo` dans `src/` ne renvoie aucun import.
- **Pourtant :**
  - `app.json:16-18` déclare `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` et `NSLocationWhenInUseUsageDescription` ;
  - `app.json:30-34` déclare `CAMERA`, `ACCESS_FINE_LOCATION` et `ACCESS_COARSE_LOCATION` ;
  - le README promet photos, traçabilité par QR, carte et synchronisation hors ligne.
- **Conséquence :**
  - la géolocalisation, la photo de parcelle ou de lot, le scan QR, le téléversement de preuves, le push, la carte native et le hors-ligne sont **NON IMPLÉMENTÉS** ;
  - risque de rejet en revue : permissions et textes d'usage sans fonctionnalité associée.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :** voir le plan, phase 2 (lot « natif ») : modules Expo, flux de permission avec gestion du refus, `mediaApi.upload`.
- **Test :** pour chaque fonctionnalité, cas autorisé, refusé, et service indisponible, sur Android et sur iOS.

#### MOB-E03 — La barre d'onglets du producteur affiche toutes les routes du dossier (47 au lieu de 5)

- **Fichiers :** `src/app/farmer/_layout.tsx:13-26`, `src/components/farmer/FarmerTabBar.tsx:66-82` ; `node_modules/expo-router/build/useScreens.js:163-168` et `layouts/TabsClient.js:91-98` (lecture seule).
- **Preuve :**
  - le layout déclare 6 écrans ;
  - expo-router **ajoute toutes les autres routes enfants** (`// Add any remaining children`, `useScreens.js:163`), soit 47 fichiers sous `app/farmer` ;
  - `href: null` ne pose que `options.hidden = true` (`TabsClient.js:91-98`) ;
  - `FarmerTabBar` itère sur `state.routes` sans filtre ni lecture de `options` (l. 70-81). Les noms de route sont `farms/index` et `plots/index`, absents de `LABELS` et `ICONS` (l. 26-40), qui ne connaissent que `farms` et `plots` : le libellé affiché est donc le nom brut et l'icône est `ellipse`.
- **Conséquence (le code le démontre ; rendu NON VÉRIFIABLE sans appareil) :**
  - environ 47 boutons d'environ 8 à 14 pt de large sont affichés ;
  - les libellés sont du type `farms/index` ou `plots/[id]/plan` ;
  - l'indicateur animé est faux.
  - C'est la navigation principale du producteur.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :**
  - filtrer sur une liste blanche de 5 routes `['index','farms/index','plots/index','productions','soil']` ;
  - ou encapsuler les sous-écrans dans un `Stack` (`farmer/(tabs)/…` + `farmer/_layout` Stack) ;
  - corriger les clés `LABELS` et `ICONS`.
- **Test :** ouvrir `/farmer` et vérifier exactement 5 onglets nommés. Naviguer vers `/farmer/alerts` : l'onglet ne doit pas apparaître.

#### MOB-E04 — Pas de navigation globale dans les espaces authentifiés (80 routes orphelines)

- **Preuve :** analyse statique de 332 liens comparés aux 213 routes : **80 routes sans aucun lien entrant**. Parmi elles :
  - environ 30 écrans `admin/*` (audit, sécurité, monitoring, jobs, rôles, paramètres, notifications, opérations, appareils, plages agronomiques…) ;
  - `/auth/mfa` et `/auth/reset-password` ;
  - `/farmer/settings`, `/farmer/lots`, `/farmer/orders`, `/farmer/export`, `/farmer/sync`, `/farmer/certifications` ;
  - `/international/*`, `/insights`, `/ai`, `/marketplace/new`, `/requests/new`.

  Le détail est dans INVENTAIRE §3. `AppHeader.tsx:35-64` n'offre que retour, site public, notifications et profil. `admin/dashboard.tsx` ne lie que 6 écrans (l. 98-210).
- **Conséquence :** ces écrans ne sont atteignables que par lien profond. Fonctionnellement, ils n'existent pas pour l'utilisateur.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :** un layout par espace (Drawer ou Tabs + Stack) piloté par rôle et permission, avec un menu d'administration.
- **Test :** pour chaque rôle, chaque écran prévu doit être joignable en 3 interactions au plus depuis l'accueil de l'espace.

#### MOB-E05 — Aucune garde de rôle ou de permission dans l'interface

- **Preuve :**
  - `SessionGate` (`_layout.tsx:98-133`) ne teste que `status` ;
  - `AuthGate` (`components/ui/States.tsx:126-141`) ne teste que `isAuthenticated` (154 écrans l'utilisent) ;
  - `can()` et `hasAnyRole()` (`store/auth.ts:170-179`) ne sont utilisés qu'une fois (`admin/users/[id].tsx:38-39`) ;
  - `profil.tsx:240-246` propose « Espace producteur » à tout rôle.
- **Conséquence :**
  - un acheteur peut ouvrir `agrikonnect://admin/users` et voir l'écran ;
  - les données sont bien refusées par le backend (403), mais l'expérience devient une suite d'erreurs ;
  - c'est aussi une divulgation de la structure des écrans d'administration.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :** `RoleGate` / `PermissionGate` dans chaque layout d'espace, redirection vers l'espace du rôle, et masquage des actions non autorisées.
- **Test :** compte BUYER, puis ouvrir `/admin/dashboard` par lien profond : redirection vers `/marketplace` sans appel admin.

#### MOB-E06 — Espaces vérificateur et agent : 403 pour les rôles qui y sont envoyés

- **Preuve :**
  - `lib/redirects.ts:96-97` envoie AGRONOMIST et LAB_PARTNER vers `/reviewer/missions` ;
  - `reviewer/missions.tsx:31-33` et `agent/index.tsx:41-43` appellent `verificationApi.adminQueue`, soit `GET /admin/verifications` (`endpoints.ts:717-718`) ;
  - le backend exige `authorize('verifications.review')` (`verification.routes.js:31-35`), accordé à `ADMIN_ROLES = ['ADMIN','SUPER_ADMIN']` (`shared/permissions.js:16,132`) ;
  - VERIFIER, COUNTRY_ADMIN et DATA_STEWARD sont absents de `ROLE_PRIORITY` (`redirects.ts:65-82`).
- **Conséquence :** l'espace d'atterrissage de ces rôles affiche « accès refusé » dès l'ouverture.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :** aligner la destination sur des routes accessibles (file `ai.review` pour EXPERT, missions propres au vérificateur) ou ouvrir côté backend une file filtrée par rôle (prérequis backend). Compléter `ROLE_PRIORITY`.
- **Test :** connexion AGRONOMIST : atterrissage sans 403.

#### MOB-E07 — Les écrans publics appellent des routes authentifiées

- **Preuve :** rapprochement des écrans hors `protectedRoots` avec les fonctions non `anonymous` (AUDIT_INTEGRATION_API_MOBILE §5). Le backend pose `router.use(authenticate, …)` sur :
  - listings, orders, inventory (`market/*/…routes.js:14,69,35`) ;
  - prices (`prices.routes.js:40`), tenders (`:43`), projects (`:63`), insights (`:20`), organizations (`:11`), transport (`:40`), weather (`:25`).

  Les écrans concernés sont :
  - `public-site/annonces/*`, `/annonces/*` ;
  - `/marches`, `public-site/marches` ;
  - `public-site/ventes/*` (qui liste… **les commandes privées** de l'utilisateur) ;
  - `public-site/tenders`, `/tenders` ;
  - `/projets`, `public-site/projets*`, `public-site/projects*` ;
  - `public-site/cooperatives`, `public-site/transporters`, `public-site/agriculture/[country]` ;
  - `/prices/*`, `/weather`, `/insights/*`.
- **Conséquence :**
  - un visiteur obtient une erreur 401 et non l'« état vide » promis par le README ;
  - un utilisateur connecté voit des données privées sous l'habillage « site public ».
- **Plateforme :** A+I+W. **Criticité :** ÉLEVÉ.
- **Correction :** limiter le site public aux routes `/public/*`. Masquer ou rediriger vers la connexion les rubriques qui exigent un compte. Ajouter côté backend des routes publiques dédiées si le besoin est avéré (prérequis).
- **Test :** sans session, parcourir toutes les entrées du menu public : 0 appel 401.

#### MOB-E08 — Internationalisation quasi absente

Le détail est dans AUDIT_I18N_MOBILE.

- **Preuve :**
  - 109 appels `t()` dans 21 fichiers sur 286, contre environ 2 800 textes en dur (dont 2 426 dans `app/`) ;
  - 88 clés sur 173 ne sont jamais utilisées ;
  - `register.tsx:65` envoie `locale: 'fr'` en dur ;
  - formats `'fr-FR'` en dur (`season-feedback.tsx:43,249,295`, `sms-consent.tsx:43`).
- **Conséquence :** passer en anglais ne change que l'en-tête, le pied de page et quelques libellés. L'application est monolingue de fait.
- **Plateforme :** A+I+W. **Criticité :** ÉLEVÉ.

#### MOB-E09 — Le cache de données n'est pas purgé à la déconnexion

- **Preuve :**
  - `store/auth.ts:145-154` (`logout`) et `:55-58` (session perdue) ne font pas appel à `queryClient` ;
  - aucun `queryClient.clear|removeQueries|resetQueries` dans `src/` ;
  - les clés ne contiennent pas l'identifiant de l'utilisateur (`queryKeys.me = ['me']`, `farms.list(params)`…) ;
  - `gcTime` vaut 10 minutes (`query.ts:30`).
- **Conséquence :** sur un téléphone partagé (agent de terrain, coopérative), l'utilisateur B voit les données de A (fermes, commandes, profil) jusqu'au rechargement des requêtes. C'est une fuite de données personnelles.
- **Plateforme :** A+I+W. **Criticité :** ÉLEVÉ.
- **Correction :** `queryClient.clear()`, `realtime.disconnect()` et `setActiveOrganizationId(null)` dans `logout` et dans le gestionnaire de session perdue. Optionnellement, préfixer les clés par l'identifiant de l'utilisateur.
- **Test :** A se connecte et ouvre `/farmer/farms`, puis se déconnecte. B se connecte : aucune donnée de A, même brièvement.

#### MOB-E10 — Une coupure réseau pendant le renouvellement déconnecte l'utilisateur

- **Preuve :**
  - `session.ts:88-90` : toute exception de `refreshHandler`, y compris un timeout, un DNS ou le mode avion, aboutit à `sessionStore.clear()` ;
  - `http.ts:115-117` appelle ensuite `onSessionLost`, soit le statut `anonymous` (`store/auth.ts:55-58`).
- **Conséquence :** en 3G instable, cible explicite du produit (`query.ts:9`), l'agriculteur est déconnecté à la première reprise hors couverture. Il perd sa session et son contexte.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :** ne purger la session que sur une réponse 400/401 de `/auth/refresh`. Sur une erreur réseau, conserver les jetons et propager une erreur `network`.
- **Test :** mode avion, puis jeton expiré et requête. On attend un message réseau, et la session est conservée au retour du réseau.

#### MOB-E11 — Configuration de production absente, et transport en clair divergent entre plateformes

- **Preuve :**
  - `lib/config.ts:17-27` se replie sur `http://localhost:4000/api/v1` ;
  - `app.json:56-59` fixe `extra.apiBaseUrl` à `http://localhost:4000/api/v1` ;
  - il n'y a ni `.env`, ni `eas.json`, ni profil de build ;
  - **introspection** iOS : `NSAppTransportSecurity.NSAllowsArbitraryLoads: true` ;
  - **introspection** Android : `<application>` sans `usesCleartextTraffic`, donc le HTTP en clair est bloqué en release (comportement Android 9+ ; hypothèse en l'absence de build release).
- **Conséquence :**
  - un build sans variable pointe vers `localhost`, c'est-à-dire le téléphone lui-même : l'application est inutilisable ;
  - avec une URL HTTP, **iOS fonctionne et transmet les jetons en clair**, alors qu'Android release échoue.
- **Plateforme :** A+I (divergence). **Criticité :** ÉLEVÉ.
- **Correction :**
  - `app.config.ts` par environnement ;
  - `eas.json` (development, preview, production) ;
  - URL HTTPS obligatoire en production, avec échec explicite au démarrage si la configuration est absente ;
  - `NSAllowsArbitraryLoads: false`.
- **Test :** un build de production sans variable doit refuser de démarrer avec un message clair. Avec une URL HTTPS : appels OK sur A et sur I.

#### MOB-E12 — Écran « Paramètres » factice et boutons inertes

- **Preuve :**
  - `farmer/settings.tsx:27-29` : `useState` locaux pour les notifications, le résumé et la 2FA ;
  - `:51-52,56` : les interrupteurs n'appellent aucune API ;
  - `:61` : `Enregistrer` vaut `onPress={() => {}}` ;
  - boutons inertes : `farmer/farms/[id].tsx:55` (« Voir les parcelles ») et `farmer/lots/[id].tsx:47-48` (« QR code », « Fiche publique »).
- **Conséquence :** l'utilisateur croit avoir activé la double authentification ou les notifications. C'est un faux sentiment de sécurité.
- **Plateforme :** A+I. **Criticité :** ÉLEVÉ.
- **Correction :**
  - brancher les préférences sur `notificationApi.updatePreferences` ;
  - la 2FA sur `/auth/mfa` (écran existant) ;
  - supprimer ou brancher les boutons inertes.
- **Test :** basculer la 2FA, relancer l'application : l'état reflète `GET /auth/mfa/status`.

#### MOB-E13 — Rôles sensibles ouverts à l'inscription libre

- **Preuve :** `lib/platform.ts:136-146` (`SELF_SERVICE_ROLES`) inclut AGRONOMIST et SUPPORT_AGENT, affichés par `auth/register.tsx:94-99`. Le backend les accepte (`auth.schema.js:21-30`).
- **Conséquence :** n'importe qui devient « agronome » (droits `ai.review`, validation de rapports de précision) ou « agent d'appui » (inscription assistée de producteurs). C'est une élévation de privilèges, déjà relevée dans l'audit backend.
- **Plateforme :** A+I+W. **Criticité :** ÉLEVÉ.
- **Correction :** retirer ces rôles de l'interface d'inscription. Côté backend (prérequis) : attribution sur validation.
- **Test :** l'inscription ne propose plus ces rôles, et un POST forcé est refusé (backend).

### 4.3 MOYEN

| ID | Description | Fichier:ligne | Preuve | Conséquence | Plat. | Correction | Test |
|---|---|---|---|---|---|---|---|
| MOB-M01 | Jeton temps réel figé, sans reprise | `services/realtime.ts:57-75` | `auth: { token }` est lu une seule fois. Aucun `connect_error`, aucune mise à jour du jeton après refresh ni au retour au premier plan, `reconnectionAttempts: 8`. `realtime.on/setTyping/joinConversation` ne sont jamais utilisés | Après 15 minutes, toute reconnexion est refusée. Le temps réel meurt silencieusement | A+I | `auth: (cb) => cb({ token: sessionStore.accessToken })`, reconnexion sur AppState `active`, gestion de `connect_error` puis refresh | Socket ouvert, attendre l'expiration, couper et rétablir le réseau : des événements sont reçus |
| MOB-M02 | Pas d'AppState, de NetInfo ni de mode hors ligne | `services/query.ts:26-39` | `refetchOnWindowFocus: IS_WEB`. `focusManager` et `onlineManager` ne sont pas branchés. NetInfo est absent. `OfflineNotice` (`States.tsx:107`) n'est jamais utilisé. `farmer/sync.tsx` affiche seulement l'état serveur | `refetchOnReconnect` est inopérant sur natif, les données sont périmées au retour, aucune saisie n'est possible hors ligne | A+I | Brancher `focusManager` sur AppState et `onlineManager` sur NetInfo, utiliser `OfflineNotice`, puis une file de mutations persistée (phase 2) | Avion activé puis désactivé : rafraîchissement automatique et bandeau visible |
| MOB-M03 | Aucune gestion du clavier | `src/` entier | 0 `KeyboardAvoidingView`. `Screen.tsx:66-75` n'utilise pas `keyboardShouldPersistTaps`. La saisie du message est en bas d'écran (`messages/[conversationId].tsx:57-61`) | Champs et bouton masqués par le clavier (iOS surtout) ; double tap nécessaire pour valider. Rendu NON VÉRIFIÉ sur appareil | A+I | `KeyboardAvoidingView` ou `react-native-keyboard-controller` dans `Screen`, avec `keyboardShouldPersistTaps="handled"` | iPhone SE : le dernier champ du formulaire d'inscription reste visible |
| MOB-M04 | Listes non virtualisées et non paginées | 159 fichiers `.map(` dans `app/` | Une seule `FlatList` (messages), imbriquée dans un `ScrollView`. Listes allant jusqu'à 100 éléments, chacun enveloppé dans `Reveal` animé (232 usages). Aucun `useInfiniteQuery` ni `fetchNextPage` : seule la première page (≤ 100) est chargée | Ralentissements et mémoire sur Android bas de gamme. Avertissement « VirtualizedLists should never be nested ». Éléments au-delà de 100 invisibles | A+I | `FlatList` ou FlashList avec `Screen scroll={false}` et `useInfiniteQuery` (`meta.page`/`total`), `Reveal` limité aux premiers éléments | Liste de 250 éléments : tous atteignables, 60 images/s sur un appareil à 2 Go de RAM |
| MOB-M05 | Formulaires marché approximatifs | `annonces/creer.tsx:23,36,53` ; `marketplace/new.tsx:24,37,58` ; `public-site/annonces/creer.tsx:22,35` ; `requests/new.tsx:23,35,52` ; `farmer/plots/create.tsx:33` | « Culture (ID) » et « Exploitation (ID) » en texte libre. Devise par défaut `EUR` (alors que `XOF` est le défaut ailleurs). `indicativePrice: null` devient **0** côté backend (`z.coerce.number()` vérifié : `{"indicativePrice":0}`) | Annonces affichées à prix nul, identifiants impossibles à connaître pour l'utilisateur | A+I | Sélecteur de culture (`referenceApi.crops`), devise du pays, omettre la clé quand elle est vide | Créer une annonce sans prix : le prix est absent et non égal à 0 |
| MOB-M06 | Validation de l'inscription en retard d'un clic | `auth/register.tsx:45-54` | Les drapeaux d'erreur sont calculés au rendu avec `touched=false`. Au premier envoi, `setTouched(true)` n'a pas d'effet sur la condition déjà évaluée | Le premier envoi part sans validation client | A+I | Valider dans `submit` à partir des valeurs | Mot de passe de 3 caractères : aucune requête envoyée |
| MOB-M07 | Aucune confirmation avant les actions sensibles | `developers/index.tsx:316` ; `farmer/plots/[id]/sensors.tsx:362` ; `marketplace/[id].tsx` (transitions) | 0 `Alert.alert` dans `src/` | Révocation de clé API ou d'appareil, annulation de commande en un seul tap | A+I | Dialogue de confirmation, avec saisie du nom pour les actions irréversibles | Révoquer : un dialogue apparaît, « Annuler » n'envoie aucun appel |
| MOB-M08 | 4 liens internes cassés + 1 lien de démonstration | `international/tenders.tsx:34` (`/tenders/:id`) ; `marketplace/index.tsx:74` (`/marketplace/orders/:id`) ; `:117` (`/demandes`) ; `public-site/index.tsx:19` (`/public-site/agriculture`) ; `home/HeroCarousel.tsx:97` (`/public-site/lot/demo`) | Aucune route correspondante. Le code de lot `demo` est une hypothèse de 404 | Écran « introuvable » | A+I | Corriger vers `/farmer/orders/[id]`, `/requests`, `/public-site/agriculture/[country]` ; créer `/tenders/[id]` | Script de liens : 0 cassé |
| MOB-M09 | Retour après connexion (`next`) faux sur les routes dynamiques | `_layout.tsx:94,121` ; `auth/login.tsx:40-46,54` | `useSegments()` renvoie `['farmer','plots','[id]']`, donc `next=/farmer/plots/[id]` littéral. Trois redirections concurrentes (SessionGate, effet de login, `submit`). `next` n'est pas validé | Lien profond protégé puis connexion : écran vide ou 404. Ordre des redirections non déterministe (hypothèse) | A+I | `usePathname()` + paramètres, une seule redirection centralisée, liste blanche de `next` | Ouvrir `agrikonnect://farmer/plots/ID` sans session, se connecter : arrivée sur la parcelle ID |
| MOB-M10 | Téléchargements sans jeton | `admin/reports.tsx:28` ; `endpoints.ts:948` ; `farmer/plots/[id]/precision-report.tsx:167` | `Linking.openURL(adminApi.exportFarms())` ouvre le navigateur sans en-tête `Authorization`. Le lien PDF est affiché en texte brut | Réponse 401 dans le navigateur, export inaccessible | A+I | Télécharger avec le jeton (`expo-file-system` + partage) ou URL signée côté backend | Export : fichier obtenu et partageable |
| MOB-M11 | Progressions et libellés inventés | `agent/index.tsx:68,80` ; `marketplace/index.tsx:72` ; `reviewer/missions.tsx:53` ; `farmer/index.tsx:63` ; `organization/index.tsx:52` ; `admin/dashboard.tsx:82,182` | `progressPct: 62`, `55`, `50`, `70`, `65` sont des constantes. Le libellé « 12 mois » affiche `slice(-8)`, soit 8 points | Indicateurs trompeurs, contraires à la règle « aucune donnée inventée » du README | A+I | Supprimer la jauge ou la calculer à partir du statut réel. Libellé dynamique | Revue visuelle : aucune jauge sans source |
| MOB-M12 | Accessibilité des composants de base | `ui/Input.tsx:163-189,190-193` ; `ui/Button.tsx:147` ; `theme/colors.ts` | Libellé non associé au `TextInput` (pas d'`accessibilityLabel` par défaut). Bouton œil sans libellé. `PressableScale` : 36 usages, 0 libellé, 2 rôles. `IconButton` de 42 pt, sous la règle interne de 48 (`agrikonnect.ts:238-242`). Texte `livingGreen` à 3,52:1. Bordure de champ à 1,22:1 | Lecteur d'écran inutilisable sur les formulaires, cibles trop petites | A+I | `accessibilityLabel={label}` par défaut, `hitSlop` ou diamètre de 48, jetons AA | TalkBack/VoiceOver : chaque champ est annoncé avec son libellé |
| MOB-M13 | Permissions déclarées sans usage | `app.json:16-18,30-34` ; introspection | Android : CAMERA, FINE/COARSE_LOCATION, plus par défaut SYSTEM_ALERT_WINDOW et READ/WRITE_EXTERNAL_STORAGE. iOS : caméra, photos, localisation, et `NSFaceIDUsageDescription` (plugin secure-store) | Rejet ou avertissement Play/App Store, demande disproportionnée | A+I | Déclarer seulement à l'implémentation (MOB-E02), `android.blockedPermissions` | Manifeste généré = permissions réellement utilisées |
| MOB-M14 | Routes publiques dupliquées | `src/app/*` et `src/app/public-site/*` | 16 couples (`/annonces` et `/public-site/annonces`, `/projets`…). `/cooperatives` et `/ventes` sont protégés alors que leur double public ne l'est pas | Maintenance double et comportements divergents | A+I | Un seul arbre public | Script : 0 doublon |
| MOB-M15 | Dépendances en retard ou vulnérables | `package.json` | `expo install --check` : 13 paquets en retard (expo 58.0.21 → ~58.0.25, expo-router, safe-area 5.10 → 5.11…). `npm audit` : 11 vulnérabilités, dont `follow-redirects` (élevée, chargée à l'exécution via axios). Inutilisés : `zod`, `expo-blur`, `expo-linking`, `@expo-google-fonts/space-grotesk` | Incompatibilités natives possibles, surface d'attaque | A+I | `expo install --fix`, mise à jour d'axios, retrait des inutilisés | `expo install --check` sans écart, `npm audit` sans vulnérabilité élevée |
| MOB-M16 | Poids des ressources | export Android : 104 ressources, 18 Mo | 53 TTF : Inter en 18 graisses, JetBrains Mono en 16, et **19 polices d'icônes** alors que seul Ionicons est importé. 25 JPG (environ 5,6 Mo) | Taille de l'application et du téléchargement OTA | A+I | Importer les graisses une par une (`@expo-google-fonts/inter/400Regular`), icônes ciblées, images WebP redimensionnées | Ressources < 6 Mo |
| MOB-M17 | Tests quasi inexistants | `scripts/redirects.test.mjs` | Un seul test (29 cas), qui simule `localStorage` : non représentatif du natif. Aucun test de composant, d'intégration ou E2E. Pas d'ESLint | Régressions invisibles (MOB-C01, MOB-E03 non détectés) | — | Jest + RNTL, Maestro ou Detox, ESLint `expo` | CI verte avec des tests de session, de navigation et de formulaires |
| MOB-M18 | Contexte multi-organisation inopérant sur natif | `lib/redirects.ts:121-137` ; `http.ts:61-64` | `globalThis.localStorage` n'existe pas sous Hermes, donc `X-Organization-Id` n'est jamais envoyé. Sur l'export web, il est persisté et jamais purgé | Un utilisateur de plusieurs organisations ne peut pas choisir son contexte | A+I (W : périmé) | Stockage du contexte dans SecureStore ou un store Zustand persistant, avec purge à la déconnexion | Changer d'organisation : l'en-tête est envoyé et les données changent |
| MOB-M19 | Messagerie minimale | `messages/[conversationId].tsx:26,46-56,52,59` | `limit: 50` sans pagination. `FlatList` imbriquée (`maxHeight: 400`). `formatDate` sans heure. `Input label=""`. Pas de clavier. Pas de défilement vers le bas | Fil long tronqué, heure absente, saisie masquée | A+I | Liste inversée paginée, heure, composer ancré au clavier | 120 messages : défilement complet, l'heure est visible |
| MOB-M20 | Parcours mot de passe et MFA inaccessibles | `auth/forgot-password.tsx` ; `auth/reset-password.tsx:13,36` ; `profil.tsx:203-215` | Aucun lien vers `/auth/reset-password`. Le jeton se saisit à la main et n'est pas lu depuis le lien profond. `/auth/mfa` est orpheline : le profil affiche l'état sans action | Réinitialisation et activation de la 2FA impossibles sur mobile | A+I | Lire `token` depuis les paramètres (lien `agrikonnect://auth/reset-password?token=`), bouton « Configurer la 2FA » | Lien e-mail ouvert : formulaire prérempli |
| MOB-M21 | Canal PUSH proposé sans réalité | `notifications/preferences.tsx:26,43` | Aucun enregistrement de jeton d'appareil dans l'application. Aucun envoi push côté backend (aucune occurrence de `expo-server-sdk`, `fcm` ou `apns`) | Préférence sans effet, attente déçue | A+I | Masquer PUSH tant que MOB-E02 (push) n'est pas livré | Le canal PUSH est absent, ou bien livré de bout en bout |

### 4.4 FAIBLE

| ID | Description | Preuve | Plat. | Correction |
|---|---|---|---|---|
| MOB-F01 | Fichiers parasites | `fiche.md` (code TSX d'un écran de services), `components/ui/Reveal.tsx.bak`, `lib/platform.ts.bak` (identique), `components/public-site/home/ServicesSection.tsx` et `theme/index.ts` non référencés, artefacts `dist/` et `.expo/ios-bundle-check` (ignorés par git) | — | Supprimer après validation |
| MOB-F02 | iPad en paysage malgré la conception portrait | Introspection : `UISupportedInterfaceOrientations~ipad` inclut le paysage, `UIRequiresFullScreen: false`, `supportsTablet: true` (`app.json:13`) | I | Tester sur iPad ou passer `supportsTablet: false` |
| MOB-F03 | Formats et pays par défaut incohérents | `'fr-FR'` en dur (§4.2 MOB-E08). `DEFAULT_CURRENCY='XOF'` (`format.ts:8`) alors que les textes visent la RDC. Pays par défaut `CI` (`register.tsx:40`, `insights/index.tsx:49`) contre `CD` (`farms/create.tsx:16`, `agent/registration.tsx:20`) | A+I | Pays et devise issus du profil et de `/countries` |
| MOB-F04 | Pas de mode sombre | `app.json:9` `userInterfaceStyle: "light"`. Une palette `DARK` sert seulement au démarrage | A+I | Décision produit, documentée |
| MOB-F05 | `Intl` sous Hermes (hypothèse) | `format.ts:20` (`notation: 'compact'` sans `try`), `:70` (`RelativeTimeFormat` avec `try`) | A (surtout) | Vérifier sur appareil, sinon prévoir un repli |
| MOB-F06 | Profil complet dans SecureStore (hypothèse de taille) | `session.ts:100-103` écrit le JSON utilisateur avec ses organisations. SecureStore signale les valeurs > 2 048 octets. Le Keychain iOS survit à la désinstallation | A+I | Stocker uniquement l'identité minimale, purger au premier lancement |
| MOB-F07 | `next` non validé (hypothèse) | `login.tsx:54` : `router.replace(next)` | A+I | Liste blanche de chemins internes |
| MOB-F08 | Pas de remontée d'erreurs | `AppErrorBoundary.tsx:18` : `console.error` seul, pas de Sentry ou équivalent | A+I | Outil de suivi des plantages |
| MOB-F09 | En-tête surchargé sur petit écran | `AppHeader.tsx:33-66` : retour + titre + CTA + 3 `IconButton` de 42 pt sur 360 dp, `numberOfLines={1}` | A+I | Menu de débordement |
| MOB-F10 | Locale d'inscription figée | `register.tsx:65` `locale: 'fr'` | A+I | Envoyer la locale active |
| MOB-F11 | Écart entre le README et le code | Le README annonce « Implémenté et vérifié… espace producteur complet », la synchronisation hors ligne, des photos | — | Mettre le README à jour |
| MOB-F12 | Pas d'épinglage de certificat | Aucun mécanisme TLS spécifique | A+I | À évaluer selon le modèle de menace |

### 4.5 INFORMATIONNEL

| ID | Constat |
|---|---|
| MOB-I01 | Projet Expo managed (CNG). Gradle, AndroidManifest, Info.plist et Podfile ne sont pas versionnés : **NON VÉRIFIABLES** au-delà de l'introspection. minSdk, targetSdk et version iOS minimale sont les défauts du SDK 58 |
| MOB-I02 | `tsc` 0 erreur. Export Hermes Android et iOS réussi. Aucun cycle d'import |
| MOB-I03 | 304/304 appels API correspondent à une route backend (méthode et chemin) |
| MOB-I04 | Aucun `dangerouslySetInnerHTML` ni `eval`. Aucun secret dans le code ou dans `.env.example` (valeurs vides). Un seul `console.*` (boundary) |
| MOB-I05 | Bonnes pratiques présentes : SecureStore (Keychain/Keystore), refresh à vol unique, `Idempotency-Key` ULID, délais différenciés (15 s, 20 s, 60 s), pas de nouvel essai sur 4xx, `SafeAreaView` dans `Screen`, réglage « réduire les animations » respecté par `Reveal` |
| MOB-I06 | Les règles de sauvegarde Android excluent SecureStore (`secure_store_backup_rules`, introspection) |
| MOB-I07 | Copie de travail non commitée (16 fichiers modifiés et 2 non suivis dans `apps/Mobile`), retenue comme base |

---

## 5. Synthèses thématiques

### 5.1 UI/UX (détail : AUDIT_UI_UX_MOBILE.md)

- **Identité visuelle cohérente.** Jetons centralisés (`theme/agrikonnect.ts`), composants `ui/` réutilisés et états de chargement, d'erreur et de vide présents sur la majorité des écrans.
- **Navigation défaillante** (MOB-E03, E04, E05, M08, M09) : c'est le premier problème UX.
- **Interactions.** Pas de confirmation (M07), pas de clavier (M03), écrans factices (E12), progressions inventées (M11).

### 5.2 Compatibilité Android et iOS (détail : AUDIT_SECURITE_MOBILE §6)

| Sujet | Android | iOS |
|---|---|---|
| Configuration native | Générée (CNG), introspection seulement | Idem |
| HTTP en clair | Bloqué en release (pas de `usesCleartextTraffic`) | **Autorisé** (`NSAllowsArbitraryLoads: true`) |
| Permissions | 8 déclarées, 0 utilisée hors INTERNET et VIBRATE (Haptics) | 4 textes d'usage, 0 utilisé |
| Bouton retour | Géré par la pile Expo Router. Retour prédictif désactivé (`enableOnBackInvokedCallback=false`) | Geste de retour natif de la pile |
| Bord à bord | `edgeToEdgeEnabled: true`, `SafeAreaView` présent | Encoches couvertes par `Screen` (`edges` top et bottom) |
| Orientation | Portrait | Portrait (iPhone), **paysage autorisé sur iPad** |
| Haptique | `PressableScale.tsx:29-31` | Idem |

Fonctionnalités divergentes : l'appel HTTP (MOB-E11) et l'orientation sur iPad (MOB-F02).

### 5.3 i18n

Voir MOB-E08 et AUDIT_I18N_MOBILE.md. Les langues prises en charge sont fr et en, avec 173 clés en parité stricte. Le RTL est absent : non prévu, mais `android:supportsRtl="true"`.

### 5.4 API (détail : AUDIT_INTEGRATION_API_MOBILE.md)

- Contrats de chemin conformes (304/304).
- Défauts de traitement : MOB-C01 rejeu, MOB-E07 public/authentifié, MOB-E06 permission, MOB-E01 schéma de parcelle, MOB-M05 coercition du prix.
- 101 fonctions API inutilisées (33 %), signe de fonctionnalités sans écran.

### 5.5 Sécurité (détail : AUDIT_SECURITE_MOBILE.md)

- **Implémenté :** SecureStore, aucun jeton dans Zustand, refresh rotatif à vol unique, sauvegarde Android excluant SecureStore.
- **À mettre en place :**
  - purge du cache (E09) ;
  - ATS strict et HTTPS (E11) ;
  - gardes de rôle (E05) ;
  - réduction des permissions (M13) ;
  - mise à jour des dépendances (M15) ;
  - résilience de la session (E10) ;
  - liens profonds validés (M09, F07).

### 5.6 Fonctionnalités natives et géospatial

Voir §8. Le géospatial est **entièrement côté serveur** : diagnostics de sol, satellite, zones de gestion, carte publique `/public/map` (positions arrondies). Côté mobile :
- aucun accès GPS, aucun suivi, aucune carte interactive ;
- `MapPreview.tsx` projette des points sur un SVG (`AFRICA_BOUNDS`, l. 37) ;
- aucun calcul de distance ;
- aucune validation des coordonnées, puisque aucune n'est saisie.

### 5.7 Performances

- Bundle Hermes de 6,2 Mo par plateforme et 18 Mo de ressources (MOB-M16).
- Listes non virtualisées avec animation par élément (MOB-M04).
- Polices : chargement de toutes les graisses au démarrage, car le splash attend `useAppFonts` (`_layout.tsx:36,52`). C'est un coût de démarrage (hypothèse, non mesuré).
- `staleTime` de 60 s à 10 minutes et pas de nouvel essai sur 4xx : bonne maîtrise des appels redondants.
- `refetchOnReconnect` est sans effet (MOB-M02).

---

## 6. Incohérences identifiées

1. Le **README** annonce « Implémenté et vérifié », des photos, la synchronisation hors ligne et une traçabilité par QR. Le code ne contient aucun module natif correspondant (E02, F11).
2. Le **README** annonce que les écrans publics affichent l'état vide sans backend. Ils appellent en réalité des routes authentifiées et affichent des erreurs 401 (E07).
3. Le **README** annonce « Aucune donnée n'est inventée ». On trouve pourtant des jauges de progression constantes (M11).
4. `secure-storage.ts:4-7` affirme : « Aucune donnée sensible n'est écrite ailleurs ». Sur l'export web, les jetons sont dans `localStorage`, et sur natif le profil complet est en SecureStore (F06).
5. Le commentaire `realtime.ts:56` promet une reconnexion « au retour au premier plan ». Il n'y a aucun écouteur AppState (M01).
6. `redirects.ts:38-39` reconnaît qu'il n'y a pas de stockage natif, mais `http.ts:61` s'appuie sur ce stockage (M18).
7. Le layout `farmer/_layout.tsx` annonce « cinq onglets ». La barre en rend 47 (E03).
8. `theme/agrikonnect.ts:234-242` impose 48 pt. `IconButton` mesure 42 pt (M12).
9. Les devises par défaut des formulaires (EUR) contredisent `format.ts:8` (XOF) et le contexte RDC des textes (F03).

---

## 7. Fonctionnalités opérationnelles et non opérationnelles

| Opérationnel (code + contrat vérifiés) | Non opérationnel ou absent |
|---|---|
| Connexion e-mail ou téléphone + mot de passe, second facteur en ligne | Renouvellement de session (C01), résilience réseau (E10) |
| Vérification e-mail par lien et renvoi | Réinitialisation du mot de passe (M20), activation de la 2FA depuis l'interface (M20, E12) |
| Annuaire public, fiche exploitation, carte agrégée, statistiques de sol, fiche lot par code (`/public/*`) | Rubriques publiques annonces, marchés, ventes, appels d'offres, projets, coopératives, transporteurs, prix, météo (E07) |
| Listes producteur : exploitations, parcelles, productions, alertes, sol, modules de parcelle | Création de parcelle (E01), navigation par onglets (E03), paramètres (E12) |
| Création d'exploitation (le schéma accepte les champs envoyés) | Géolocalisation, photo, QR, téléversement, push, carte native, hors-ligne (E02) |
| Annonces, demandes, offres, commandes, stock (appels réels, utilisateur connecté) | Sélection de culture, prix vide, devise (M05), liens de commande (M08) |
| Messagerie (envoi, lecture, invalidation temps réel) | Pagination et clavier de la messagerie (M19) |
| Notifications : liste, préférences, consentement SMS | Push (M21) |
| Espace développeurs : clients et clés API | Confirmation de révocation (M07) |
| Écrans d'administration liés : tableau de bord, utilisateurs, fiche utilisateur | Environ 30 écrans d'administration inaccessibles (E04), export (M10) |
| — | Espace vérificateur pour AGRONOMIST et LAB_PARTNER (E06), transport (non implémenté), contexte multi-organisation natif (M18), i18n anglais (E08) |

---

## 8. Audit des fonctionnalités natives

| Fonctionnalité | Implémentation | Permissions | Android | iOS | Refus / indisponibilité | Statut |
|---|---|---|---|---|---|---|
| Géolocalisation GPS | Aucune (pas de `expo-location`) | Déclarées (FINE/COARSE, WhenInUse) | — | — | — | **NON IMPLÉMENTÉ** |
| Caméra | Aucune | CAMERA, NSCamera… | — | — | — | **NON IMPLÉMENTÉ** |
| Galerie, sélection d'image | Aucune | NSPhotoLibrary… | — | — | — | **NON IMPLÉMENTÉ** |
| Téléversement de fichiers | `mediaApi` présent (`endpoints.ts`), 2 fonctions sur 3 inutilisées, aucun sélecteur | — | — | — | — | **NON IMPLÉMENTÉ** |
| Microphone | Aucune | Aucune | — | — | — | Non prévu |
| Notifications push | Aucune (pas de `expo-notifications`, pas de jeton) | — | — | — | — | **NON IMPLÉMENTÉ** (M21) |
| Notifications locales | Aucune | — | — | — | — | NON IMPLÉMENTÉ |
| Contacts | Aucune | — | — | — | — | Non prévu |
| Stockage local | SecureStore (jetons, profil, locale) | — | Keystore | Keychain | Repli silencieux en mémoire (`secure-storage.ts:28-30`) | CONFORME / À AMÉLIORER (F06) |
| Partage | `Share.share` (`admin/audit.tsx:65`) | — | OK | OK | — | PARTIELLEMENT IMPLÉMENTÉ |
| Cartographie | SVG statique (`ui/MapPreview.tsx`) | — | — | — | — | PARTIELLEMENT IMPLÉMENTÉ (aperçu, sans interaction cartographique) |
| Liens profonds | Schéma `agrikonnect` (`app.json:7`), Expo Router expose toutes les routes | — | intent-filter VIEW/BROWSABLE (introspection) | CFBundleURLSchemes `agrikonnect`, `africa.agrikonnect.mobile` | — | À AMÉLIORER (E05, M09, M20) ; aucun lien universel ou App Link |
| Biométrie | Aucune (`NSFaceIDUsageDescription` est ajouté par le plugin secure-store) | — | — | — | — | NON IMPLÉMENTÉ |
| Bluetooth, capteurs | Aucune. Les capteurs IoT passent par l'API (`iotApi`) | — | — | — | — | Non prévu côté appareil |
| Haptique | `expo-haptics` (`PressableScale.tsx:29-31`) | VIBRATE | OK | OK | Ignoré sur le web | CONFORME |

### Géospatial (axe I)

- **Côté mobile (fait vérifié) :** aucun accès GPS, aucune précision, aucun suivi, aucun arrière-plan, aucune consommation batterie liée. Aucune saisie de latitude ou de longitude dans les formulaires d'exploitation, de parcelle ou d'annonce, alors que les schémas backend les acceptent (`farms.schema.js:29-30`, `listings.schema.js:20-21`).
- **Affichage :** `MapPreview` (projection équirectangulaire sur `AFRICA_BOUNDS`) et des données GeoJSON publiques arrondies côté serveur. Aucun calcul de distance, aucun itinéraire, aucune recherche géographique.
- **Synchronisation des positions avec le backend :** inexistante côté mobile.
- **Statut global :** NON IMPLÉMENTÉ côté application. Les traitements géospatiaux existent côté backend et sont consommés en lecture par les modules de parcelle.

---

## 9. Reproductibilité

| Élément | Commande ou méthode | Emplacement des sorties |
|---|---|---|
| Typecheck | `npx tsc --noEmit -p tsconfig.json` (dans `apps/Mobile`) | dossier temporaire de session `scratchpad/mob/tsc.txt` |
| Test des redirections | `node --test scripts/redirects.test.mjs` | `scratchpad/mob/redirects.txt` |
| Export natif | copie isolée + `node node_modules/expo/bin/cli export --platform android/ios --output-dir …` | `scratchpad/mob/dist-android`, `dist-ios`, `export-*.txt` |
| Introspection native | `expo config --type introspect --json` (copie isolée) | `scratchpad/mob/introspect.json` |
| Versions | `expo install --check` (copie isolée) | `scratchpad/mob/expo-check.txt` |
| Vulnérabilités | `npm audit --omit=dev --json` (copie du lockfile) | `scratchpad/mob/audit/audit.json` |
| Contrats API | `match.mjs` (399 routes backend, 304 appels) | `scratchpad/mob/fe-match.tsv`, `be-full.tsv` |
| Usage API et écrans publics | `apiuse.mjs` | `scratchpad/mob/apiuse.json` |
| Liens et routes | `links.mjs` | `routes.txt`, `links-all.txt` |
| i18n | `i18n.mjs` | `i18n-files.tsv`, `i18n-unused.txt` |
| Rejeu | `replay-test.mjs` | sortie console : `{}` |

> **Note méthodologique.** Un premier export dans une copie reliée à `node_modules` par une seule jonction (deux disques) a produit un bundle sans les écrans, car le chemin relatif d'Expo Router traversait deux lecteurs. Ce résultat a été écarté et l'export a été refait avec `expo-router` copié localement. Le bundle final contient bien les écrans, ce qui a été vérifié par des chaînes présentes dans le `.hbc`.
