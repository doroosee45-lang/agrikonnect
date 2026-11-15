# Inventaire — Application mobile React Native AGRIKONNECT AFRICA

**Référence :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md).

**Base :** copie de travail de `apps/Mobile` (291 fichiers dans `src/`, 40 293 lignes).

L'état réel de chaque élément est indiqué. Un écran n'est jamais déclaré « opérationnel » au seul motif qu'il existe : la colonne « Appels API » et les anomalies associées le qualifient.

---

## 1. Configurations

| Fichier | Contenu clé | État |
|---|---|---|
| `package.json` | `agrikonnect-mobile` 1.0.0, `main: expo-router/entry`. Scripts : `start`, `android`, `ios`, `web`, `typecheck`, `bundle:android`, `bundle:web`, `verify`. Pas de `test`, `lint` ni `bundle:ios` | À AMÉLIORER (MOB-M17) |
| `app.json` | name « AgriKonnect Africa », slug `agrikonnect-africa`, scheme `agrikonnect`, portrait, `userInterfaceStyle: light`. iOS : `supportsTablet`, bundle `africa.agrikonnect.mobile`, 3 textes d'usage. Android : package identique, `edgeToEdgeEnabled`, icône adaptative, 3 permissions. Web : metro, sortie `single`. Plugins : expo-router, expo-secure-store, expo-image, expo-font, expo-splash-screen. `extra` : `apiBaseUrl` et `realtimeUrl` en localhost | NON CONFORME (MOB-E11, M13) |
| `babel.config.js` | `babel-preset-expo` + `react-native-worklets/plugin` (en dernier) | CONFORME |
| `metro.config.js` | `getDefaultConfig(__dirname)` | CONFORME |
| `tsconfig.json` | `extends expo/tsconfig.base`, `strict`, alias `@/*` → `src/*`, `types` react/react-native, exclut `node_modules` et `dist` | CONFORME (tsc : 0 erreur) |
| `.env.example` | `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_REALTIME_URL` (vides) ; avertissement « aucun secret » | CONFORME. Mention « Supabase Realtime » inexacte |
| `.env` | Absent | NON IMPLÉMENTÉ (MOB-E11) |
| `eas.json`, `app.config.ts` | Absents | NON IMPLÉMENTÉ (MOB-E11) |
| `.gitignore` | `node_modules`, `.expo`, `dist`, `/ios`, `/android`, clés de signature, `.env*.local` | CONFORME (`.env` non local non ignoré : à ajouter) |
| `scripts/redirects.test.mjs` | 29 cas `node:test`, `localStorage` simulé | CONFORME (29/29), non représentatif du natif (MOB-M18) |
| `README.md` | Pile, démarrage, contenu livré, état du chantier | Partiellement inexact (MOB-F11) |
| `fiche.md` | **Code TSX** (écran de services) dans un fichier Markdown | Parasite (MOB-F01) |
| Gradle, `AndroidManifest.xml`, `Info.plist`, Podfile | Non versionnés (CNG). Observés par introspection | NON VÉRIFIABLE (MOB-I01) |
| `dist/`, `.expo/` | Artefacts d'export et de serveur de dev, ignorés | Sans incidence |

## 2. Dépendances

| Paquet | Version déclarée | Fichiers importateurs | Natif | État |
|---|---|---:|---|---|
| expo | ~58.0.21 | (runtime) | oui | En retard (→ ~58.0.25) |
| react / react-dom | 19.3.0 | — / 0 | — | react-dom pour le web seulement |
| react-native | 0.88.1 | 262 | oui | OK |
| expo-router | ~58.0.28 | 142 | oui | En retard (→ ~58.0.31) |
| @tanstack/react-query | ^5.104.5 | 179 | — | OK |
| axios | ^1.20.0 | 1 | — | follow-redirects vulnérable (élevée) |
| zustand | ^5.0.15 | 2 | — | OK |
| socket.io-client | ^4.8.4 | 1 | — | OK |
| zod | ^4.6.7 | **0** | — | Inutilisé (et vulnérable) |
| expo-secure-store | ~58.0.2 | 1 | oui | En retard |
| expo-constants | ~58.0.14 | 1 | oui | En retard |
| expo-font | ~58.0.11 | 0 (plugin + polices Google) | oui | En retard |
| expo-splash-screen | ~58.0.12 | 1 | oui | En retard |
| expo-status-bar | ~58.0.4 | 1 | oui | En retard |
| expo-haptics | ~58.0.7 | 1 | oui | En retard |
| expo-image | ~58.0.18 | 3 | oui | OK |
| expo-linear-gradient | ~58.0.3 | 8 | oui | En retard |
| expo-blur | ~58.0.5 | **0** | oui | Inutilisé |
| expo-linking | ~58.0.15 | **0** (dépendance d'expo-router) | oui | Inutilisé en direct |
| react-native-reanimated | 4.7.1 | 32 | oui | OK |
| react-native-worklets | ^0.13.0 | 0 (plugin Babel) | oui | OK |
| react-native-gesture-handler | ~3.3.0 | 1 | oui | OK |
| react-native-safe-area-context | ~5.10.1 | 9 | oui | En retard (→ ~5.11.1) |
| react-native-screens | ~4.30.0 | 0 (expo-router) | oui | En retard (→ ~4.30.1) |
| react-native-svg | 15.16.0 | 3 | oui | OK |
| react-native-web | ^0.21.4 | 0 (export web) | — | OK |
| @expo/vector-icons | ^15.0.2 | 72 | polices | Embarque 19 polices d'icônes (MOB-M16) |
| @expo-google-fonts/inter | ^0.4.2 | 1 | polices | 18 graisses embarquées |
| @expo-google-fonts/jetbrains-mono | ^0.4.1 | 1 | polices | 16 graisses embarquées |
| @expo-google-fonts/space-grotesk | ^0.4.1 | **0** | — | Inutilisé |
| babel-preset-expo | ~58.0.0 | (build) | — | Placé dans `dependencies` (devrait être en dev) |
| typescript, @types/react | ~6.0.3, ~19.3.0 | (dev) | — | OK |

**Modules natifs absents** (fonctionnalités annoncées) : expo-location, expo-camera, expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-notifications, expo-localization, @react-native-community/netinfo, react-native-maps, expo-local-authentication (MOB-E02).

## 3. Permissions Android et iOS

### Android (manifeste généré, introspection)

| Permission | Source | Utilisée par le code ? | État |
|---|---|---|---|
| INTERNET | modèle | oui (HTTP, socket) | CONFORME |
| VIBRATE | modèle / expo-haptics | oui (`PressableScale`) | CONFORME |
| SYSTEM_ALERT_WINDOW | modèle Expo | non | À bloquer |
| READ_EXTERNAL_STORAGE | modèle Expo | non | À bloquer |
| WRITE_EXTERNAL_STORAGE | modèle Expo | non | À bloquer |
| CAMERA | `app.json:31` | **non** | MOB-M13 |
| ACCESS_FINE_LOCATION | `app.json:32` | **non** | MOB-M13 |
| ACCESS_COARSE_LOCATION | `app.json:33` | **non** | MOB-M13 |

### iOS (Info.plist généré, introspection)

| Clé | Source | Utilisée ? | État |
|---|---|---|---|
| NSCameraUsageDescription | `app.json:16` | **non** | MOB-M13 |
| NSPhotoLibraryUsageDescription | `app.json:17` | **non** | MOB-M13 |
| NSLocationWhenInUseUsageDescription | `app.json:18` | **non** | MOB-M13 |
| NSFaceIDUsageDescription | plugin expo-secure-store | **non** (pas de biométrie) | MOB-M13 |
| NSAppTransportSecurity.NSAllowsArbitraryLoads | modèle | — | `true` : MOB-E11 |
| CFBundleURLSchemes | `agrikonnect`, `africa.agrikonnect.mobile` | liens profonds | À AMÉLIORER (pas de liens universels) |

## 4. Stores, contextes, services, hooks, layouts

| Élément | Type | Fichier | Lignes | État |
|---|---|---|---:|---|
| `useAuthStore` | Store Zustand (session, utilisateur, permissions, MFA, complétude) | `store/auth.ts` | 186 | NON CONFORME (MOB-C01, E09, E10) |
| `useI18nStore` | Store Zustand (locale, hydratation) | `i18n/index.ts` | 87 | CONFORME |
| `sessionStore`, `profileStorage` | Module singleton (jetons, refresh) | `services/api/session.ts` | 116 | NON CONFORME (MOB-E10) |
| `queryClient`, `queryKeys` | TanStack Query | `services/query.ts` | 279 | À AMÉLIORER (MOB-M02, E09) |
| `http`, `api`, `cleanQuery` | Client axios | `services/api/http.ts` | 161 | NON CONFORME (MOB-C01) |
| 44 objets `xxxApi` (304 fonctions) | Services | `services/api/endpoints.ts` | 1 145 | 304/304 routes existantes, 101 inutilisées |
| Types et contrats | — | `services/api/types.ts` | 2 248 | CONFORME |
| `realtime` | Client Socket.IO | `services/realtime.ts` | 146 | À AMÉLIORER (MOB-M01) |
| `ScrollYProvider` / `useScrollY` | Contexte React (défilement → `Reveal`) | `components/ui/Reveal.tsx` | 153 | CONFORME |
| `usePublicFarms`, `usePublicMap`, `useSoilStats`, `usePublicLot`, `useCountriesFromMap` | Hooks | `hooks/usePublicData.ts` | 91 | CONFORME |
| `useMouvementReducit` | Hook (réduire les animations) | `hooks/useMouvementReducit.ts` | 62 | CONFORME |
| `useScreenScrollProps` | Hook | `components/ui/Screen.tsx` | — | Utilisé 0 fois hors `Screen` |
| `useAppFonts` | Hook | `theme/typography.ts` | 104 | Charge toutes les graisses (MOB-M16) |
| Layout racine | `Stack` + `SessionGate` | `app/_layout.tsx` | 142 | À AMÉLIORER (MOB-M09, E05) |
| Layout auth | `Stack` modal | `app/auth/_layout.tsx` | 16 | CONFORME |
| Layout producteur | `Tabs` + `FarmerTabBar` | `app/farmer/_layout.tsx` | 28 | NON CONFORME (MOB-E03) |
| Layouts admin, organisation, investissement, vérificateur, agent… | — | absents | — | NON IMPLÉMENTÉ (MOB-E04) |

Contextes React explicites (`createContext`) : uniquement `ScrollYProvider`. Pas de Redux.

## 5. Composants et modules

« Importateurs » : nombre de fichiers qui importent le module par son chemin. Les composants `ui/*` sont surtout importés via le baril `@/components/ui` (**232 fichiers**), et `@/i18n` est importé par 162 fichiers.

| Fichier | Lignes | Importateurs directs | Exports principaux | État |
|---|---:|---:|---|---|
| components/app/AppHeader.tsx | 98 | 109 | AppHeader | À AMÉLIORER (MOB-F09) |
| components/auth/AuthShell.tsx | 138 | 5 | AuthShell | CONFORME |
| components/farmer/FarmerHeader.tsx | 120 | 38 | FarmerHeader | CONFORME |
| components/farmer/FarmerTabBar.tsx | 149 | 1 | FarmerTabBar | NON CONFORME (MOB-E03) |
| components/farmer/PlotScreenHeader.tsx | 42 | 8 | PlotScreenHeader | CONFORME |
| components/farmer/RecommendationMethod.tsx | 161 | 1 | MethodeDonnees, MethodeDeCalcul… | CONFORME |
| components/farmer/SoilModule.tsx | 404 | 1 | SoilModule | CONFORME (non traduit) |
| components/public-site/FarmCard.tsx | 107 | 1 | FarmCard | CONFORME |
| components/public-site/Logo.tsx | 62 | 3 | Logo, LogoMark | CONFORME |
| components/public-site/Navbar.tsx | 373 | 1 | Navbar, PUBLIC_NAV | CONFORME |
| components/public-site/PublicFooter.tsx | 287 | 1 | PublicFooter | CONFORME |
| components/public-site/PublicShell.tsx | 198 | 53 | PublicShell, PageHeader | CONFORME |
| components/public-site/home/ClosingSections.tsx | 181 | 2 | RoadmapSection, FaqSection, ContactCta | CONFORME |
| components/public-site/home/DataSections.tsx | 473 | 1 | TraceSection, SoilSection, AiSection | CONFORME |
| components/public-site/home/Hero.tsx | 385 | 1 | Hero | CONFORME |
| components/public-site/home/HeroCarousel.tsx | 333 | 2 | HeroCarousel | Lien `demo` (MOB-M08) |
| components/public-site/home/MapAndFarmers.tsx | 293 | 1 | MapSection, FarmersSection | CONFORME |
| components/public-site/home/ServicesSection.tsx | 195 | **0** | ServicesSection, RolesSection | **Inutilisé** (MOB-F01) |
| components/public-site/home/TrustAndStats.tsx | 193 | 1 | TrustBand, StatsBand | CONFORME |
| components/public-site/home/WebHomeSections.tsx | 734 | 1 | 11 sections d'accueil | CONFORME (93 textes en dur) |
| components/ui/Accordion.tsx | 142 | baril | Accordion | CONFORME |
| components/ui/AppErrorBoundary.tsx | 91 | 1 | AppErrorBoundary | CONFORME (non suivi par git) |
| components/ui/AppImage.tsx | 107 | baril | AppImage | CONFORME |
| components/ui/Button.tsx | 183 | baril | Button, IconButton | À AMÉLIORER (42 pt, MOB-M12) |
| components/ui/Card.tsx | 128 | baril | Card, PressableCard | CONFORME |
| components/ui/Chip.tsx | 109 | baril | Chip, FilterChip, ChipRow | CONFORME |
| components/ui/Divider.tsx | 35 | baril | Divider | CONFORME |
| components/ui/HeroBackground.tsx | 129 | baril | HeroBackground | CONFORME |
| components/ui/HorizonMobile.tsx | 656 | 16 écrans | Cartes Horizon (KPI, aire, donut, pistes) | CONFORME (non suivi par git) |
| components/ui/Input.tsx | 188 | baril | Input, TextArea | À AMÉLIORER (MOB-M12) |
| components/ui/MapPreview.tsx | 204 | baril | MapPreview (SVG) | PARTIEL (pas de carte interactive) |
| components/ui/Marquee.tsx | 61 | baril | Marquee | CONFORME |
| components/ui/PressableScale.tsx | 131 | 8 + baril | PressableScale | À AMÉLIORER (libellés) |
| components/ui/Progress.tsx | 52 | baril | Progress | CONFORME |
| components/ui/ProvenanceTag.tsx | 92 | baril | ProvenanceTag | CONFORME |
| components/ui/Reveal.tsx | 153 | 3 + baril | Reveal | CONFORME |
| components/ui/Reveal.tsx.bak | 154 | 0 | — | **Parasite** |
| components/ui/Screen.tsx | 101 | baril | Screen | À AMÉLIORER (clavier, MOB-M03) |
| components/ui/Section.tsx | 201 | baril | Section | CONFORME |
| components/ui/Skeleton.tsx | 90 | baril | Skeleton* | CONFORME |
| components/ui/StatCard.tsx | 176 | baril | StatCard | CONFORME |
| components/ui/StatCounter.tsx | 63 | baril | StatCounter | CONFORME |
| components/ui/States.tsx | 231 | baril | LoadingState, EmptyState, ErrorState, OfflineNotice, AuthGate, AdvisoryNotice | CONFORME (`OfflineNotice` inutilisé) |
| components/ui/Text.tsx | 43 | 15 + baril | Text | À AMÉLIORER (rôle `header`) |
| components/ui/index.ts | 22 | 232 | baril | CONFORME |
| lib/config.ts | 53 | 7 | API_BASE_URL, REALTIME_URL, TIMEOUTS… | NON CONFORME (MOB-E11) |
| lib/faq.ts | 115 | 2 | FAQ_ENTRIES | CONFORME |
| lib/format.ts | 148 | 127 | format*, PROVENANCE | CONFORME (devise par défaut : MOB-F03) |
| lib/phone.ts | 59 | 1 | isValidE164, phoneReadiness | CONFORME |
| lib/platform.ts | 175 | 11 | PLATFORM_SERVICES, SELF_SERVICE_ROLES, RELEASE_TRACK | NON CONFORME (MOB-E13) |
| lib/platform.ts.bak | 175 | 0 | — | **Parasite** (identique) |
| lib/redirects.ts | 238 | 6 | getUserInitialRoute… | À AMÉLIORER (MOB-E06, M18) |
| lib/secure-storage.ts | 52 | 2 | secureStorage, STORAGE_KEYS | CONFORME |
| lib/service-catalog.ts | 37 | 2 | SERVICE_CATALOG | CONFORME |
| lib/ulid.ts | 50 | 1 | ulid | CONFORME |
| theme/agrikonnect.ts | 269 | 25 | jetons | CONFORME |
| theme/colors.ts | 112 | 256 | COLORS, TINTS, DARK | À AMÉLIORER (contrastes, MOB-M12) |
| theme/index.ts | 8 | **0** | baril | **Inutilisé** |
| theme/motion.ts | 55 | 25 | DURATION, EASE, SPRING… | CONFORME |
| theme/shadows.ts | 60 | 3 | SHADOWS | CONFORME |
| theme/space.ts | 57 | 250 | SPACING, RADIUS, LAYOUT, BREAKPOINT | `BREAKPOINT` inutilisé |
| theme/typography.ts | 104 | 3 | useAppFonts, TYPO | À AMÉLIORER (MOB-M16) |

## 6. Fichiers de traduction

| Fichier | Langue | Clés | Lignes | État |
|---|---|---:|---:|---|
| `src/i18n/fr.ts` | Français | 173 | 210 | Source. 85 clés référencées en littéral, ~69 réellement mortes |
| `src/i18n/en.ts` | Anglais | 173 | 198 | Parité stricte |
| `src/i18n/index.ts` | Moteur | — | 87 | CONFORME |

Détail : [AUDIT_I18N_MOBILE.md](AUDIT_I18N_MOBILE.md).

## 7. Ressources

| Dossier | Contenu | Poids exporté |
|---|---|---|
| `assets/` | icon, splash, favicon, icônes adaptatives Android (×3) | — |
| `assets/hero/` | 10 JPG | 237 à 409 Ko chacun |
| `assets/cultures/` | 8 JPG | 151 à 197 Ko chacun |
| `assets/partenaires/` | 7 JPG | 106 à 183 Ko chacun |
| Polices (paquets) | 53 TTF (Inter 18, JetBrains Mono 16, icônes 19) | environ 12 Mo |
| **Total ressources (export Android)** | 104 fichiers | **18 Mo** |
| Bundle JS Hermes | `entry-*.hbc` | 6,2 Mo (Android), 6,2 Mo (iOS) |

## 8. Routes de navigation et écrans (213 routes + 3 layouts)

Répartition :
- `farmer` 47, `admin` 40, `public-site` 38, `organization` 14, `auth` 7 ;
- `investment` 5, `marketplace` 4, `requests` 4, `developers` 4, `international` 4, `ai` 4 ;
- `reviewer` 3, `agent` 3, `notifications` 3, `messages` 2, `insights` 2 ;
- racine publique : environ 30.

**Légende des colonnes :**
- **Garde :**
  - `SessionGate` : racine protégée dans `_layout.tsx:102-117` ;
  - `AuthGate` : contenu masqué hors session ;
  - `public` : ni l'une ni l'autre. **Aucune garde de rôle n'existe** (MOB-E05).
- **États L/E/V :** présence de `LoadingState`, `ErrorState`, `EmptyState` (`-` = absent).
- **Appels API :** fonctions `endpoints.ts` appelées directement par le fichier (les hooks `usePublicData` ne sont pas comptés).
- **t() :** appels de traduction dans le fichier.
- **Lien entrant :** `non` = aucun lien interne vers cette route (80 routes, MOB-E04). `bouton inerte` = `onPress={() => {}}`.

### Routes orphelines (aucun lien entrant)

`/actualites/[id]`, `/admin`, `/admin/agronomic-ranges`, `/admin/ai-usage`, `/admin/api-clients`, `/admin/audit`, `/admin/compliance`, `/admin/cooperatives`, `/admin/countries`, `/admin/crops`, `/admin/data-products`, `/admin/devices`, `/admin/farmers`, `/admin/investors`, `/admin/jobs`, `/admin/lots`, `/admin/messages`, `/admin/monitoring`, `/admin/notifications`, `/admin/operations`, `/admin/partners`, `/admin/plots`, `/admin/prices`, `/admin/producers`, `/admin/productions`, `/admin/projects`, `/admin/reports`, `/admin/rules`, `/admin/security`, `/admin/settings`, `/admin/sync`, `/ai`, `/ai/analyses`, `/ai/documents`, `/auth/mfa`, `/auth/reset-password`, `/auth/verify-phone`, `/cooperatives/[slug]`, `/developers/docs`, `/developers/keys`, `/developers/usage`, `/farmer/certifications`, `/farmer/devices`, `/farmer/export`, `/farmer/gallery`, `/farmer/inventory`, `/farmer/lots`, `/farmer/lots/[id]`, `/farmer/notifications`, `/farmer/orders`, `/farmer/orders/invoices`, `/farmer/projects`, `/farmer/reviews`, `/farmer/settings`, `/farmer/surveys`, `/farmer/sync`, `/farmer/transport`, `/farmer/verification`, `/insights`, `/insights/[country]/[region]`, `/international`, `/international/documents`, `/international/orders`, `/international/tenders`, `/investment/requests`, `/marketplace/new`, `/producteurs`, `/producteurs/[slug]`, `/projets/[id]`, `/projets/proposer`, `/public-site`, `/public-site/cooperatives/[slug]`, `/public-site/country-language`, `/public-site/creer-profil`, `/public-site/producteurs`, `/public-site/profil`, `/requests/[id]/matches`, `/requests/new`, `/ventes/[id]`.

(Dans le tableau ci-dessous, `+not-found` apparaît aussi sans lien entrant, ce qui est normal.)

**Note :** les routes de la barre d'onglets du producteur (`/farmer/farms`, `/farmer/plots`, `/farmer/productions`, `/farmer/soil`) sont atteintes par onglet, mais la barre est elle-même défaillante (MOB-E03).

### Doublons publics (MOB-M14)

`/a-propos`, `/actualites`, `/annonces`, `/annonces/creer`, `/contact`, `/cooperatives`, `/faq`, `/farmers`, `/marches`, `/producteurs`, `/profil`, `/projets`, `/projets/proposer`, `/services`, `/tenders` et `/ventes` existent aussi sous `/public-site/…`.

### Tableau complet des écrans

| Route | Fichier | Lignes | Garde | États L/E/V | Appels API | t() | Lien entrant |
|---|---|---:|---|---|---|---:|---|
| `/+not-found` | app/+not-found.tsx | 43 | public | --- | — | 0 | **non** |
| `(layout)` | app/_layout.tsx | 143 |  |  |  |  |  |
| `/a-propos` | app/a-propos.tsx | 209 | public | --- | — | 0 | oui |
| `/accueil` | app/accueil.tsx | 82 | public | --- | — | 0 | oui |
| `/actualites` | app/actualites.tsx | 97 | public | --- | — | 0 | oui |
| `/actualites/[id]` | app/actualites/[id].tsx | 45 | public | --V | — | 0 | **non** |
| `/admin/agronomic-ranges` | app/admin/agronomic-ranges.tsx | 514 | SessionGate+AuthGate | LEV | agronomicRange.create, agronomicRange.validate, agronomicRange.retire, agronomicRange.importTemplate, agronomicRange.importCsv | 0 | **non** |
| `/admin/ai-usage` | app/admin/ai-usage.tsx | 46 | SessionGate+AuthGate | LEV | admin.dashboard | 0 | **non** |
| `/admin/api-clients` | app/admin/api-clients.tsx | 49 | SessionGate+AuthGate | LEV | apiClient.clients | 0 | **non** |
| `/admin/audit` | app/admin/audit.tsx | 227 | SessionGate+AuthGate | LEV | admin.audit, admin.auditExport | 0 | **non** |
| `/admin/compliance` | app/admin/compliance.tsx | 39 | SessionGate+AuthGate | --- | — | 0 | **non** |
| `/admin/cooperatives` | app/admin/cooperatives.tsx | 50 | SessionGate+AuthGate | LEV | organization.list | 0 | **non** |
| `/admin/countries/[code]` | app/admin/countries/[code].tsx | 50 | SessionGate+AuthGate | LE- | reference.country | 0 | oui |
| `/admin/countries` | app/admin/countries/index.tsx | 51 | SessionGate+AuthGate | LEV | reference.countries | 0 | **non** |
| `/admin/crops` | app/admin/crops.tsx | 49 | SessionGate+AuthGate | LEV | reference.crops | 0 | **non** |
| `/admin/dashboard` | app/admin/dashboard.tsx | 229 | SessionGate+AuthGate | LE- | reference.countries, admin.dashboard | 0 | oui |
| `/admin/data-products` | app/admin/data-products.tsx | 33 | SessionGate+AuthGate | --- | — | 0 | **non** |
| `/admin/devices` | app/admin/devices.tsx | 204 | SessionGate+AuthGate | LEV | iot.devices, anomaly.settings, anomaly.list, anomaly.review | 0 | **non** |
| `/admin/farmers` | app/admin/farmers.tsx | 52 | SessionGate+AuthGate | LEV | admin.users | 0 | **non** |
| `/admin/farms` | app/admin/farms.tsx | 49 | SessionGate+AuthGate | LEV | farm.list | 0 | oui |
| `/admin` | app/admin/index.tsx | 250 | SessionGate+AuthGate | LEV | admin.dashboard, admin.users, admin.audit, admin.jobs, admin.runJob | 0 | **non** |
| `/admin/investors` | app/admin/investors.tsx | 52 | SessionGate+AuthGate | LEV | admin.users | 0 | **non** |
| `/admin/jobs` | app/admin/jobs.tsx | 188 | SessionGate+AuthGate | LEV | admin.jobs, admin.runJob, admin.pauseJob, admin.resumeJob | 0 | **non** |
| `/admin/lots` | app/admin/lots.tsx | 49 | SessionGate+AuthGate | LEV | lot.list | 0 | **non** |
| `/admin/marketplace` | app/admin/marketplace.tsx | 50 | SessionGate+AuthGate | LEV | listing.list | 0 | oui |
| `/admin/messages` | app/admin/messages.tsx | 55 | SessionGate+AuthGate | LEV | messaging.conversations | 0 | **non** |
| `/admin/moderation` | app/admin/moderation.tsx | 33 | SessionGate+AuthGate | --- | — | 0 | oui |
| `/admin/monitoring` | app/admin/monitoring.tsx | 230 | SessionGate+AuthGate | LEV | admin.monitoringServices, admin.monitoringHealth | 0 | **non** |
| `/admin/notifications` | app/admin/notifications.tsx | 227 | SessionGate+AuthGate | LEV | admin.broadcastAnnouncement, admin.notificationsHistory | 0 | **non** |
| `/admin/operations` | app/admin/operations.tsx | 191 | SessionGate+AuthGate | LEV | admin.operationsList, admin.moderateOperation | 0 | **non** |
| `/admin/orders` | app/admin/orders.tsx | 50 | SessionGate+AuthGate | LEV | order.list | 0 | oui |
| `/admin/partners` | app/admin/partners.tsx | 28 | SessionGate+AuthGate | --- | — | 0 | **non** |
| `/admin/plots` | app/admin/plots.tsx | 49 | SessionGate+AuthGate | LEV | plot.list | 0 | **non** |
| `/admin/prices` | app/admin/prices.tsx | 50 | SessionGate+AuthGate | LEV | price.list | 0 | **non** |
| `/admin/producers` | app/admin/producers.tsx | 52 | SessionGate+AuthGate | LEV | admin.users | 0 | **non** |
| `/admin/productions` | app/admin/productions.tsx | 50 | SessionGate+AuthGate | LEV | production.list | 0 | **non** |
| `/admin/projects` | app/admin/projects.tsx | 52 | SessionGate+AuthGate | LEV | project.list | 0 | **non** |
| `/admin/reports` | app/admin/reports.tsx | 50 | SessionGate+AuthGate | --- | admin.exportFarms | 0 | **non** |
| `/admin/roles` | app/admin/roles.tsx | 97 | SessionGate+AuthGate | LE- | admin.roles | 0 | oui |
| `/admin/rules` | app/admin/rules.tsx | 33 | SessionGate+AuthGate | --- | — | 0 | **non** |
| `/admin/security` | app/admin/security.tsx | 310 | SessionGate+AuthGate | LE- | admin.unlockUser, admin.securityOverview, admin.securityPolicy, admin.updateSecurityPolicy | 0 | **non** |
| `/admin/settings` | app/admin/settings.tsx | 60 | SessionGate+AuthGate | LEV | admin.settings | 0 | **non** |
| `/admin/sync` | app/admin/sync.tsx | 28 | SessionGate+AuthGate | --- | — | 0 | **non** |
| `/admin/users` | app/admin/users.tsx | 161 | SessionGate+AuthGate | LEV | admin.users | 0 | oui |
| `/admin/users/[id]` | app/admin/users/[id].tsx | 359 | SessionGate+AuthGate | LE- | admin.user, admin.setUserStatus, admin.unlockUser, admin.forceLogout, admin.verifyUserEmail, admin.verifyUserPhone, admin.grantRole, admin.revokeRole, admin.deleteUser, admin.exportUser | 0 | oui |
| `/admin/verifications` | app/admin/verifications.tsx | 50 | SessionGate+AuthGate | LEV | verification.adminQueue | 0 | oui |
| `/agent/consent` | app/agent/consent.tsx | 50 | SessionGate+AuthGate | --- | — | 0 | oui |
| `/agent` | app/agent/index.tsx | 194 | SessionGate+AuthGate | LE- | verification.adminQueue, ai.list | 0 | oui |
| `/agent/registration` | app/agent/registration.tsx | 54 | SessionGate+AuthGate | -E- | auth.register | 0 | oui |
| `/ai/analyses/[id]` | app/ai/analyses/[id].tsx | 70 | SessionGate+AuthGate | LE- | ai.get | 0 | oui |
| `/ai/analyses` | app/ai/analyses/index.tsx | 58 | SessionGate+AuthGate | LEV | ai.list | 0 | **non** |
| `/ai/documents` | app/ai/documents.tsx | 55 | SessionGate+AuthGate | LEV | ai.list | 0 | **non** |
| `/ai` | app/ai/index.tsx | 265 | SessionGate+AuthGate | LEV | ai.analyze, ai.copilot, ai.list, ai.escalate | 0 | **non** |
| `/annonces/[id]` | app/annonces/[id].tsx | 249 | AuthGate | LE- | listing.get, listing.setStatus, listing.contact | 0 | oui |
| `/annonces/creer` | app/annonces/creer.tsx | 78 | AuthGate | -E- | listing.create | 0 | oui |
| `/annonces` | app/annonces/index.tsx | 180 | AuthGate | LEV | listing.list | 0 | oui |
| `(layout)` | app/auth/_layout.tsx | 17 |  |  |  |  |  |
| `/auth/forgot-password` | app/auth/forgot-password.tsx | 84 | public | -E- | auth.forgotPassword | 3 | oui |
| `/auth/login` | app/auth/login.tsx | 146 | public | -E- | — | 11 | oui |
| `/auth/mfa` | app/auth/mfa.tsx | 291 | public | -E- | auth.mfaStatus, auth.mfaSetup, auth.mfaConfirm, auth.mfaVerify, auth.mfaDisable | 4 | **non** |
| `/auth/register` | app/auth/register.tsx | 213 | public | -E- | — | 11 | oui |
| `/auth/reset-password` | app/auth/reset-password.tsx | 48 | public | -E- | auth.resetPassword | 0 | **non** |
| `/auth/verify-email` | app/auth/verify-email.tsx | 165 | public | -E- | auth.resendVerification, auth.verifyEmail | 0 | oui |
| `/auth/verify-phone` | app/auth/verify-phone.tsx | 120 | public | -E- | auth.sendOtp, auth.verifyPhone | 0 | **non** |
| `/contact` | app/contact.tsx | 276 | public | LE- | public.contactFarm | 0 | oui |
| `/cooperatives/[slug]` | app/cooperatives/[slug].tsx | 51 | SessionGate+AuthGate | LE- | cooperative.current | 0 | **non** |
| `/cooperatives` | app/cooperatives/index.tsx | 224 | SessionGate+AuthGate | LEV | cooperative.current, cooperative.members, cooperative.overview | 0 | oui |
| `/developers/docs` | app/developers/docs.tsx | 54 | SessionGate | --- | — | 0 | **non** |
| `/developers` | app/developers/index.tsx | 390 | SessionGate+AuthGate | LEV | apiClient.clients, apiClient.create, apiClient.setPurpose, apiClient.createKey, apiClient.revokeKey, apiClient.usage | 0 | oui |
| `/developers/keys` | app/developers/keys.tsx | 50 | SessionGate+AuthGate | LEV | apiClient.clients | 0 | **non** |
| `/developers/usage` | app/developers/usage.tsx | 50 | SessionGate+AuthGate | LEV | apiClient.clients | 0 | **non** |
| `/explore` | app/explore.tsx | 200 | public | LEV | — | 0 | oui |
| `/faq` | app/faq.tsx | 82 | public | --- | — | 0 | oui |
| `(layout)` | app/farmer/_layout.tsx | 29 |  |  |  |  |  |
| `/farmer/alerts` | app/farmer/alerts.tsx | 341 | SessionGate+AuthGate | LEV | alert.list, alert.meta, alert.markRead, alert.markHandled | 0 | oui |
| `/farmer/certifications` | app/farmer/certifications.tsx | 53 | SessionGate+AuthGate | LEV | certification.list | 0 | **non** |
| `/farmer/devices` | app/farmer/devices.tsx | 55 | SessionGate+AuthGate | LEV | iot.devices | 0 | **non** |
| `/farmer/export/[id]` | app/farmer/export/[id].tsx | 181 | SessionGate+AuthGate | LE- | export.get | 0 | oui |
| `/farmer/export/[id]/documents` | app/farmer/export/[id]/documents.tsx | 118 | SessionGate+AuthGate | LEV | export.get | 0 | oui |
| `/farmer/export` | app/farmer/export/index.tsx | 96 | SessionGate+AuthGate | LEV | export.list | 0 | **non** |
| `/farmer/farms/[id]` | app/farmer/farms/[id].tsx | 64 | SessionGate+AuthGate | LE- | farm.get | 0 | oui · bouton inerte |
| `/farmer/farms/create` | app/farmer/farms/create.tsx | 48 | SessionGate+AuthGate | -E- | farm.create | 0 | oui |
| `/farmer/farms` | app/farmer/farms/index.tsx | 54 | SessionGate+AuthGate | LEV | farm.list | 0 | oui |
| `/farmer/gallery` | app/farmer/gallery.tsx | 46 | SessionGate+AuthGate | LEV | media.list | 0 | **non** |
| `/farmer` | app/farmer/index.tsx | 180 | SessionGate | LEV | auth.me, plot.list, dashboard.farmer, alert.list | 7 | oui |
| `/farmer/inventory` | app/farmer/inventory.tsx | 54 | SessionGate+AuthGate | LEV | inventory.list | 0 | **non** |
| `/farmer/lots/[id]` | app/farmer/lots/[id].tsx | 57 | SessionGate+AuthGate | LE- | lot.get | 0 | **non** · bouton inerte |
| `/farmer/lots` | app/farmer/lots/index.tsx | 52 | SessionGate+AuthGate | LEV | lot.list | 0 | **non** |
| `/farmer/notifications` | app/farmer/notifications.tsx | 50 | SessionGate+AuthGate | LEV | notification.list | 0 | **non** |
| `/farmer/orders/[id]` | app/farmer/orders/[id].tsx | 61 | SessionGate+AuthGate | LE- | order.get | 0 | oui |
| `/farmer/orders` | app/farmer/orders/index.tsx | 53 | SessionGate+AuthGate | LEV | order.list | 0 | **non** |
| `/farmer/orders/invoices` | app/farmer/orders/invoices.tsx | 49 | SessionGate+AuthGate | LEV | order.list | 0 | **non** |
| `/farmer/plots/[id]` | app/farmer/plots/[id].tsx | 67 | SessionGate+AuthGate | LE- | plot.get | 0 | oui |
| `/farmer/plots/[id]/plan` | app/farmer/plots/[id]/plan.tsx | 248 | SessionGate | LEV | plot.get, soil.rotationPlans, soil.farmingPlans, soil.proposeFarmingPlan | 0 | oui |
| `/farmer/plots/[id]/precision-report` | app/farmer/plots/[id]/precision-report.tsx | 304 | SessionGate | LEV | reference.crops, plot.get, soil.yieldEstimates, soil.estimateYield, precision.reports, precision.createReport, precision.validateReport, precision.pdfUrl | 0 | oui |
| `/farmer/plots/[id]/recommendations` | app/farmer/plots/[id]/recommendations.tsx | 526 | SessionGate | LEV | reference.crops, plot.get, soil.suitability, soil.computeSuitability, recommendation.list, recommendation.create, recommendation.decide | 0 | oui |
| `/farmer/plots/[id]/rotation` | app/farmer/plots/[id]/rotation.tsx | 280 | SessionGate | LEV | reference.crops, plot.get, soil.rotationPlans, soil.proposeRotation, soil.decideRotation | 0 | oui |
| `/farmer/plots/[id]/satellite` | app/farmer/plots/[id]/satellite.tsx | 393 | SessionGate | LEV | plot.get, geo.diagnose, geo.latest, geo.history, geo.health, satellite.settings, satellite.observations, satellite.acquire | 0 | oui |
| `/farmer/plots/[id]/sensors` | app/farmer/plots/[id]/sensors.tsx | 498 | SessionGate | LEV | plot.get, iot.devices, iot.registerDevice, iot.rotateKey, iot.revoke, iot.readings, alert.list, alert.markRead, alert.markHandled | 0 | oui |
| `/farmer/plots/[id]/soil` | app/farmer/plots/[id]/soil.tsx | 27 | SessionGate | --- | — | 0 | oui |
| `/farmer/plots/[id]/zones` | app/farmer/plots/[id]/zones.tsx | 196 | SessionGate | LEV | plot.get, precision.zones, precision.computeZones | 0 | oui |
| `/farmer/plots/create` | app/farmer/plots/create.tsx | 46 | SessionGate+AuthGate | -E- | plot.create | 0 | oui |
| `/farmer/plots` | app/farmer/plots/index.tsx | 53 | SessionGate+AuthGate | LEV | plot.list | 0 | oui |
| `/farmer/productions` | app/farmer/productions.tsx | 385 | SessionGate | LEV | reference.crops, farm.list, plot.list, production.list, production.stats, production.create | 1 | oui |
| `/farmer/profile` | app/farmer/profile.tsx | 55 | SessionGate+AuthGate | -E- | auth.updateMe | 0 | oui |
| `/farmer/projects/[id]` | app/farmer/projects/[id].tsx | 54 | SessionGate+AuthGate | LE- | project.get | 0 | oui |
| `/farmer/projects/[id]/access-log` | app/farmer/projects/[id]/access-log.tsx | 49 | SessionGate+AuthGate | LEV | projectData.accessLog | 0 | oui |
| `/farmer/projects/[id]/dataroom` | app/farmer/projects/[id]/dataroom.tsx | 58 | SessionGate+AuthGate | LEV | projectData.documents | 0 | oui |
| `/farmer/projects/[id]/reports` | app/farmer/projects/[id]/reports.tsx | 68 | SessionGate+AuthGate | LEV | projectData.reports | 0 | oui |
| `/farmer/projects` | app/farmer/projects/index.tsx | 54 | SessionGate+AuthGate | LEV | project.list | 0 | **non** |
| `/farmer/projects/new` | app/farmer/projects/new.tsx | 45 | SessionGate+AuthGate | -E- | — | 0 | oui |
| `/farmer/public-profile` | app/farmer/public-profile.tsx | 55 | SessionGate+AuthGate | L-- | auth.me, farm.list | 0 | oui |
| `/farmer/reviews` | app/farmer/reviews.tsx | 63 | SessionGate+AuthGate | LEV | auth.me, review.reputation | 0 | **non** |
| `/farmer/season-feedback` | app/farmer/season-feedback.tsx | 369 | SessionGate+AuthGate | LEV | reference.crops, plot.list, season.list, season.create, season.compare | 0 | oui |
| `/farmer/settings` | app/farmer/settings.tsx | 76 | SessionGate+AuthGate | --- | auth.me | 0 | **non** · bouton inerte |
| `/farmer/soil` | app/farmer/soil.tsx | 453 | SessionGate | LEV | plot.list, soil.assessments, soil.profile, soil.createAssessment | 1 | oui |
| `/farmer/surveys` | app/farmer/surveys.tsx | 56 | SessionGate+AuthGate | LEV | dashboard.farmer | 0 | **non** |
| `/farmer/sync` | app/farmer/sync.tsx | 80 | SessionGate+AuthGate | LE- | sync.collections, sync.pull | 0 | **non** |
| `/farmer/sync/conflicts` | app/farmer/sync/conflicts.tsx | 64 | SessionGate+AuthGate | LEV | sync.conflicts | 0 | oui |
| `/farmer/transport` | app/farmer/transport.tsx | 50 | SessionGate+AuthGate | LEV | transport.requests | 0 | **non** |
| `/farmer/verification` | app/farmer/verification.tsx | 60 | SessionGate+AuthGate | LE- | verification.mine | 0 | **non** |
| `/farmers` | app/farmers.tsx | 146 | public | LEV | — | 0 | oui |
| `/` | app/index.tsx | 7 | public | --- | — | 0 | oui |
| `/insights/[country]/[region]` | app/insights/[country]/[region].tsx | 68 | AuthGate | LE- | insights.overview | 0 | **non** |
| `/insights` | app/insights/index.tsx | 265 | AuthGate | LEV | insights.overview, insights.crops, insights.activity, insights.disclosurePolicy | 0 | **non** |
| `/international/documents` | app/international/documents.tsx | 53 | SessionGate+AuthGate | LEV | export.list | 0 | **non** |
| `/international` | app/international/index.tsx | 170 | SessionGate+AuthGate | LEV | tender.list | 0 | **non** |
| `/international/orders` | app/international/orders.tsx | 62 | SessionGate+AuthGate | LEV | order.list | 0 | **non** |
| `/international/tenders` | app/international/tenders.tsx | 53 | SessionGate+AuthGate | LEV | tender.list | 0 | **non** |
| `/investment/followed` | app/investment/followed.tsx | 52 | SessionGate+AuthGate | LEV | invest.followed | 0 | oui |
| `/investment` | app/investment/index.tsx | 291 | SessionGate+AuthGate | LEV | invest.projects, invest.followed, invest.follow, invest.profile, invest.dashboard | 0 | oui |
| `/investment/profile` | app/investment/profile.tsx | 55 | SessionGate+AuthGate | -E- | auth.updateMe | 0 | oui |
| `/investment/projects/[id]` | app/investment/projects/[id].tsx | 54 | SessionGate+AuthGate | LE- | project.get | 0 | oui |
| `/investment/requests` | app/investment/requests.tsx | 50 | SessionGate+AuthGate | LEV | invest.dashboard | 0 | **non** |
| `/marches` | app/marches.tsx | 204 | AuthGate | LEV | listing.list | 0 | oui |
| `/marketplace/[id]` | app/marketplace/[id].tsx | 266 | AuthGate | LEV | order.get, order.events, order.setStatus, order.setPayment, order.dispute | 0 | oui |
| `/marketplace` | app/marketplace/index.tsx | 205 | AuthGate | LEV | order.list | 0 | oui |
| `/marketplace/inventory` | app/marketplace/inventory.tsx | 239 | AuthGate | LEV | inventory.list, inventory.create, inventory.movements, inventory.addMovement | 0 | oui |
| `/marketplace/new` | app/marketplace/new.tsx | 83 | AuthGate | -E- | listing.create | 0 | **non** |
| `/messages/[conversationId]` | app/messages/[conversationId].tsx | 72 | SessionGate+AuthGate | LE- | messaging.messages, messaging.send | 0 | oui |
| `/messages` | app/messages/index.tsx | 141 | SessionGate+AuthGate | LEV | messaging.conversations | 1 | oui |
| `/notifications` | app/notifications/index.tsx | 178 | SessionGate+AuthGate | LEV | notification.list, notification.readAll, notification.read | 1 | oui |
| `/notifications/preferences` | app/notifications/preferences.tsx | 179 | SessionGate+AuthGate | LE- | notification.preferences, notification.setPreferences | 0 | oui |
| `/notifications/sms-consent` | app/notifications/sms-consent.tsx | 279 | SessionGate+AuthGate | LE- | smsConsent.get, smsConsent.grant, smsConsent.withdraw | 0 | oui |
| `/organization/[id]` | app/organization/[id].tsx | 53 | SessionGate+AuthGate | LE- | organization.get | 0 | oui |
| `/organization/create` | app/organization/create.tsx | 49 | SessionGate+AuthGate | -E- | organization.create | 0 | oui |
| `/organization/farms` | app/organization/farms.tsx | 56 | SessionGate+AuthGate | LEV | farm.list | 0 | oui |
| `/organization` | app/organization/index.tsx | 154 | SessionGate+AuthGate | LEV | organization.list | 0 | oui |
| `/organization/invitations` | app/organization/invitations.tsx | 53 | SessionGate+AuthGate | LEV | auth.me, organization.get | 0 | oui |
| `/organization/member-import` | app/organization/member-import.tsx | 84 | SessionGate+AuthGate | -E- | cooperative.current, cooperative.importMembers | 0 | oui |
| `/organization/members` | app/organization/members.tsx | 58 | SessionGate+AuthGate | LEV | auth.me, organization.get | 0 | oui |
| `/organization/offers` | app/organization/offers.tsx | 65 | SessionGate+AuthGate | LEV | cooperative.current, cooperative.groupOffers | 0 | oui |
| `/organization/orders` | app/organization/orders.tsx | 58 | SessionGate+AuthGate | LEV | order.list | 0 | oui |
| `/organization/overview` | app/organization/overview.tsx | 166 | SessionGate+AuthGate | LE- | auth.me | 0 | oui |
| `/organization/production-summary` | app/organization/production-summary.tsx | 70 | SessionGate+AuthGate | LEV | production.stats | 0 | oui |
| `/organization/profile` | app/organization/profile.tsx | 60 | SessionGate+AuthGate | LE- | auth.me, organization.get, organization.update | 0 | oui |
| `/organization/transport` | app/organization/transport.tsx | 52 | SessionGate+AuthGate | LEV | transport.requests | 0 | oui |
| `/organization/verification` | app/organization/verification.tsx | 63 | SessionGate+AuthGate | LEV | verification.mine | 0 | oui |
| `/prices/[crop]` | app/prices/[crop].tsx | 54 | public | LEV | price.list | 0 | oui |
| `/prices` | app/prices/index.tsx | 62 | public | LEV | price.list | 0 | oui |
| `/producteurs/[slug]` | app/producteurs/[slug].tsx | 42 | public | LE- | public.farm | 0 | **non** |
| `/producteurs` | app/producteurs/index.tsx | 188 | AuthGate | LE- | auth.me | 1 | **non** |
| `/profil` | app/profil.tsx | 301 | AuthGate | LE- | auth.me, auth.permissions, auth.mfaStatus | 2 | oui |
| `/projets` | app/projets.tsx | 165 | AuthGate | LEV | project.list | 0 | oui |
| `/projets/[id]` | app/projets/[id].tsx | 52 | public | LE- | project.get | 0 | **non** |
| `/projets/proposer` | app/projets/proposer.tsx | 47 | AuthGate | -E- | — | 0 | **non** |
| `/public-site/a-propos` | app/public-site/a-propos.tsx | 51 | public | --- | — | 0 | oui |
| `/public-site/actualites` | app/public-site/actualites.tsx | 41 | public | --- | — | 0 | oui |
| `/public-site/actualites/[id]` | app/public-site/actualites/[id].tsx | 40 | public | --V | — | 0 | oui |
| `/public-site/agriculture/[country]` | app/public-site/agriculture/[country].tsx | 100 | public | LEV | insights.overview, insights.crops | 0 | oui |
| `/public-site/annonces/[id]` | app/public-site/annonces/[id].tsx | 85 | AuthGate | LE- | listing.get, listing.contact | 0 | oui |
| `/public-site/annonces/creer` | app/public-site/annonces/creer.tsx | 86 | AuthGate | -E- | listing.create | 0 | oui |
| `/public-site/annonces` | app/public-site/annonces/index.tsx | 60 | AuthGate | LEV | listing.list | 0 | oui |
| `/public-site/conditions` | app/public-site/conditions.tsx | 62 | public | --- | — | 0 | oui |
| `/public-site/confidentialite` | app/public-site/confidentialite.tsx | 62 | public | --- | — | 0 | oui |
| `/public-site/contact` | app/public-site/contact.tsx | 44 | public | -E- | — | 0 | oui |
| `/public-site/cooperatives/[slug]` | app/public-site/cooperatives/[slug].tsx | 40 | public | LE- | public.farm | 0 | **non** |
| `/public-site/cooperatives` | app/public-site/cooperatives/index.tsx | 49 | public | LEV | organization.list | 0 | oui |
| `/public-site/country-language` | app/public-site/country-language.tsx | 71 | public | LE- | reference.countries | 0 | **non** |
| `/public-site/creer-profil` | app/public-site/creer-profil.tsx | 49 | public | --- | — | 0 | **non** |
| `/public-site/data` | app/public-site/data.tsx | 82 | public | LEV | public.soilStats | 0 | oui |
| `/public-site/faq` | app/public-site/faq.tsx | 34 | public | --- | — | 0 | oui |
| `/public-site/farm/[slug]` | app/public-site/farm/[slug].tsx | 385 | public | LE- | public.farm, public.contactFarm, public.farmQrUrl | 0 | oui |
| `/public-site/farmers` | app/public-site/farmers.tsx | 48 | public | LEV | public.farms | 0 | oui |
| `/public-site` | app/public-site/index.tsx | 50 | public | --- | — | 0 | **non** |
| `/public-site/lot` | app/public-site/lot.tsx | 104 | public | --- | — | 0 | oui |
| `/public-site/lot/[code]` | app/public-site/lot/[code].tsx | 188 | public | LE- | — | 0 | oui |
| `/public-site/map` | app/public-site/map.tsx | 44 | public | LE- | public.map | 0 | oui |
| `/public-site/marches` | app/public-site/marches.tsx | 60 | AuthGate | LEV | price.list | 0 | oui |
| `/public-site/mentions` | app/public-site/mentions.tsx | 59 | public | --- | — | 0 | oui |
| `/public-site/producteurs/[slug]` | app/public-site/producteurs/[slug].tsx | 57 | public | LE- | public.farm | 0 | oui |
| `/public-site/producteurs` | app/public-site/producteurs/index.tsx | 48 | public | LEV | public.farms | 0 | **non** |
| `/public-site/profil` | app/public-site/profil.tsx | 68 | AuthGate | LE- | auth.me | 0 | **non** |
| `/public-site/projects/[id]` | app/public-site/projects/[id].tsx | 56 | AuthGate | LE- | project.get | 0 | oui |
| `/public-site/projects` | app/public-site/projects/index.tsx | 66 | AuthGate | LEV | project.list | 0 | oui |
| `/public-site/projets` | app/public-site/projets.tsx | 61 | AuthGate | LEV | project.list | 0 | oui |
| `/public-site/projets/[id]` | app/public-site/projets/[id].tsx | 56 | AuthGate | LE- | project.get | 0 | oui |
| `/public-site/projets/proposer` | app/public-site/projets/proposer.tsx | 50 | AuthGate | -E- | — | 0 | oui |
| `/public-site/services` | app/public-site/services.tsx | 65 | public | --- | — | 0 | oui |
| `/public-site/sols` | app/public-site/sols.tsx | 148 | public | LEV | — | 0 | oui |
| `/public-site/tenders` | app/public-site/tenders.tsx | 55 | AuthGate | LEV | tender.list | 0 | oui |
| `/public-site/transporters` | app/public-site/transporters.tsx | 59 | AuthGate | LEV | transport.requests | 0 | oui |
| `/public-site/ventes/[id]` | app/public-site/ventes/[id].tsx | 60 | AuthGate | LE- | order.get | 0 | oui |
| `/public-site/ventes` | app/public-site/ventes/index.tsx | 59 | AuthGate | LEV | order.list | 0 | oui |
| `/requests/[id]` | app/requests/[id].tsx | 297 | SessionGate+AuthGate | LEV | request.get, request.matches, request.offers, request.submitOffer, request.updateOffer | 0 | oui |
| `/requests/[id]/matches` | app/requests/[id]/matches.tsx | 69 | SessionGate+AuthGate | LEV | request.matches | 0 | **non** |
| `/requests` | app/requests/index.tsx | 246 | SessionGate+AuthGate | LEV | reference.crops, request.list, request.create | 0 | oui |
| `/requests/new` | app/requests/new.tsx | 77 | SessionGate+AuthGate | -E- | request.create | 0 | **non** |
| `/reviewer/checklists/[id]` | app/reviewer/checklists/[id].tsx | 91 | SessionGate+AuthGate | LE- | verification.adminQueue, verification.decide | 0 | oui |
| `/reviewer` | app/reviewer/index.tsx | 294 | SessionGate+AuthGate | LEV | order.adminDisputes, verification.adminQueue, verification.decide, certification.list, certification.verify, ai.list | 0 | oui |
| `/reviewer/missions` | app/reviewer/missions.tsx | 142 | SessionGate+AuthGate | LEV | verification.adminQueue | 0 | oui |
| `/services/[serviceId]` | app/services/[serviceId].tsx | 165 | public | --- | — | 0 | oui |
| `/services` | app/services/index.tsx | 194 | public | --- | — | 0 | oui |
| `/tenders` | app/tenders.tsx | 176 | AuthGate | LEV | tender.list | 0 | oui |
| `/ventes/[id]` | app/ventes/[id].tsx | 56 | SessionGate | LE- | order.get | 0 | **non** |
| `/ventes` | app/ventes/index.tsx | 210 | SessionGate+AuthGate | LEV | listing.list, order.list | 0 | oui |
| `/weather` | app/weather.tsx | 251 | AuthGate | LEV | plot.list, weather.forPlot | 0 | oui |
