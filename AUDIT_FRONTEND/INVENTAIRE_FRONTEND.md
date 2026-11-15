# Inventaire du frontend — AGRIKONNECT AFRICA (application web)

> Inventaire exhaustif de `apps/web/`, généré à partir du code par des scripts exécutés hors du dépôt, puis vérifié. État au 2026-11-14. Aucun fichier modifié.
>
> Légende d'état : **OK** = branché et fonctionnel à l'analyse statique · **Partiel** = lecture seule ou actions manquantes · **KO** = défaut bloquant identifié · **Mort** = jamais importé · voir les identifiants FE-xx dans [RAPPORT_AUDIT_FRONTEND.md](RAPPORT_AUDIT_FRONTEND.md).

## 1. Identification

| Élément | Valeur | Preuve |
|---|---|---|
| Nom du projet | AGRIKONNECT AFRICA | `src/lib/config.ts:23`, `index.html:9`, `README.md:1` |
| Paquet | `agrikonnect-web` 1.0.0 (privé, ESM) | `package.json:2-5` |
| Version affichée | `APP.version = '1.0.0'` (codée en dur) | `src/lib/config.ts:26` |
| Client mobile associé (hors périmètre) | `apps/Mobile` (`agrikonnect-mobile` 1.0.0, Expo Router) | `apps/Mobile/package.json` |
| Copie de sauvegarde présente dans le dépôt | `apps/Mobile_src_backup_20261031_1901/` | arborescence |

## 2. Volumétrie

| Catégorie | Nombre |
|---|---:|
| Fichiers `.ts/.tsx` dans `src/` | 204 (≈ 34 000 lignes) |
| Fichiers dans `src/pages/` | 176 (172 composants routés + 4 modules d'appui) |
| Routes `<Route>` dans `App.tsx` | 173 + 1 route 404 (`*`) |
| Composants chargés en `React.lazy` | 173 |
| Fonctions d'appel API (`services/endpoints.ts`) | 311, en 44 objets (171 utilisées) |
| Types de contrat (`services/types.ts`) | ≈ 200 exportations, 2 395 lignes |
| Clés i18n | 173 (fr) = 173 (en) |
| Tests | 3 fichiers (2 Vitest + 1 `node:test`) |
| Ressources (`src/assets`) | 46 images JPG, 6,7 Mo |

## 3. Configurations

| Fichier | Rôle | Constats | Réf. |
|---|---|---|---|
| `package.json` | Scripts `dev`, `build` (= `tsc --noEmit && vite build`), `preview`, `typecheck`, `verify` | Pas de script `test` ni `lint` ; outils de test en `dependencies` ; `jsdom` et `happy-dom` en double | FE-M19, FE-F04 |
| `vite.config.ts` | Plugins React et Tailwind ; alias `@` ; découpage des dépendances en 8 groupes ; `chunkSizeWarningLimit: 350` | `host 0.0.0.0` + `allowedHosts: true` (dev et preview) ; `sourcemap: false` | FE-F05 |
| `vitest.config.ts` | jsdom, `globals`, `tests/setup.ts`, `tests/**/*.test.{ts,tsx}` | `setup.ts` ne simule pas `matchMedia` | FE-M19 |
| `tsconfig.json` | `strict`, `bundler`, `verbatimModuleSyntax`, `noEmit` | `noUnusedLocals: false`, `noUnusedParameters: false` | FE-F04 |
| `index.html` | `lang="fr"`, `theme-color`, Google Fonts (Inter, JetBrains Mono) | `lang` statique ; police externe bloquante ; pas de CSP | FE-E02, FE-M16, FE-F10 |
| `.env.example` | `VITE_API_BASE_URL=`, `VITE_REALTIME_URL=` (vides) | Aucun secret ; description de `VITE_REALTIME_URL` erronée (« Supabase Realtime ») | FE-M12 |
| `.gitignore` (racine et `apps/`) | Ignore `node_modules`, `dist`, `.env*` sauf `.env.example` | `dist/` et `.env` non suivis (vérifié par `git check-ignore`) | CONFORME |
| ESLint / Prettier | **Absents** | — | FE-M19 |

### Variables d'environnement exposées au navigateur

| Variable | Utilisation | Sensibilité |
|---|---|---|
| `VITE_API_BASE_URL` | `src/lib/config.ts:13` | Publique (URL) |
| `VITE_REALTIME_URL` | `src/lib/config.ts:18` | Publique (URL) |

Aucune autre `import.meta.env.*` dans `src/`.

## 4. Dépendances

| Paquet | Version déclarée | Usage constaté | Remarque |
|---|---|---|---|
| react, react-dom | ^19.3.1 | Partout | — |
| react-router-dom | ^7.18.4 | `App.tsx`, liens | — |
| @tanstack/react-query | ^5.104.5 | 57 `useMutation`, nombreuses `useQuery` | — |
| zustand | ^5.0.15 | `store/auth.ts`, `i18n/index.ts` | — |
| axios | ^1.20.0 | `services/http.ts` | — |
| socket.io-client | ^4.8.4 | `services/realtime.ts` | — |
| framer-motion | ^14.5.0 | Animations (pages, listes, carrousel) | 3 fragments `vendor-motion` (≈ 142 kB non compressés) |
| class-variance-authority, clsx, tailwind-merge | — | `design-system/` | Liés à Tailwind |
| tailwindcss, @tailwindcss/vite | ^4.3.4 | `design-system/index.css`, `AppLayout` | Contraire à la spécification §4.1 (FE-M14) |
| vitest, jsdom, happy-dom, @testing-library/* | — | Tests | Devraient être en `devDependencies` ; `happy-dom` inutilisé (vitest configuré sur jsdom) |
| typescript | ^6.0.3 | — | — |
| vite | ^8.3.5 | — | — |

Aucune vérification de vulnérabilités (`npm audit`) n'a été lancée : elle interroge un service externe, et la mission excluait toute opération sur les dépendances. **NON VÉRIFIABLE.**

## 5. Points d'entrée, contextes et stores

| Élément | Fichier | Rôle | État |
|---|---|---|---|
| Point d'entrée | `src/main.tsx` | `createRoot`, `StrictMode`, `QueryClientProvider`, CSS globaux | OK (n'hydrate pas la langue : FE-E02) |
| Racine | `src/App.tsx` | `init()` de session, connexion temps réel, `BrowserRouter`, `AppLayout`, `AppErrorBoundary`, `Suspense`, `Routes` | OK (pas de garde de permission : FE-M01) |
| Contexte React Query | `QueryClientProvider` (`main.tsx:12`) | Cache serveur (`services/query.ts`) | OK |
| Store `useAuthStore` | `src/store/auth.ts` | `status`, `user`, `permissions`, `pendingMfa`, `busy`, `completeness` ; `init/login/register/logout/refreshProfile/can/hasAnyRole` | **KO** (FE-C01 au démarrage, FE-E03, FE-F01) |
| Store `useI18nStore` | `src/i18n/index.ts` | `locale`, `hydrated`, `setLocale`, `hydrate` | **KO** (`hydrate` jamais appelé : FE-E02) |
| Détenteur de session (non React) | `src/services/session.ts` | Jetons en mémoire et dans le stockage, rafraîchissement mono-vol, cache du profil | **KO** (FE-E01, FE-M05) |
| Contexte d'organisation (non React) | `src/lib/redirects.ts:103-122` | `localStorage['agrikonnect.activeOrganizationId']` | **KO** (FE-E03) |
| Temps réel (singleton) | `src/services/realtime.ts` | Socket.IO, invalidations, bus local `on()` | Partiel (FE-M04) |

Aucun `React.createContext` applicatif n'existe : l'état global passe exclusivement par Zustand, TanStack Query et des singletons de module.

## 6. Hooks

| Hook | Fichier | Rôle | Importé par |
|---|---|---|---:|
| `useI18n` | `src/i18n/index.ts:74-82` | `t`, `locale`, `setLocale` | 110 fichiers (majoritairement pour `locale`) |
| `useAuthStore` (+ sélecteurs `selectUser`, `selectStatus`, `selectIsAuthenticated`) | `src/store/auth.ts:48,184-186` | Session | 81 fichiers |
| `useI18nStore` | `src/i18n/index.ts:56` | Store de langue | 1 (`http.ts`) |
| `useBreakpoint` | `src/design-system/hooks/useBreakpoint.ts` | `matchMedia` sm/md/lg/xl | 2 |
| `useReveal` | `src/hooks/useReveal.ts` | Apparition au défilement (`IntersectionObserver`, `prefers-reduced-motion`) | 2 |
| Hooks de bibliothèque | `useQuery`, `useMutation`, `useQueryClient`, `useNavigate`, `useParams`, `useLocation`, `useSearchParams` | — | — |

## 7. Services API

| Module | Lignes | Rôle | État |
|---|---:|---|---|
| `src/services/http.ts` | 162 | Instance axios, intercepteurs, `api.*`, `cleanQuery` | **KO** (FE-C01) |
| `src/services/endpoints.ts` | 1 239 | 44 objets, 311 fonctions (détail : [AUDIT_INTEGRATION_API.md](AUDIT_INTEGRATION_API.md), annexe B) | Chemins OK ; 140 fonctions inutilisées |
| `src/services/types.ts` | 2 395 | Contrats TypeScript, `RequestError`, `ERROR_KIND_I18N` | OK ; `ERROR_KIND_I18N` inutilisé |
| `src/services/query.ts` | 284 | `QueryClient`, fabrique `queryKeys` | OK |
| `src/services/realtime.ts` | 147 | Socket.IO | Partiel (FE-M04) |
| `src/services/session.ts` | 147 | Jetons, profil | **KO** (FE-E01, FE-M05) |
| `src/services/index.ts` | 6 | Réexportations | OK |

## 8. Layouts et navigation

| Élément | Fichier | Rôle | État |
|---|---|---|---|
| `AppLayout` | `src/components/layout/AppLayout.tsx` | Deux coquilles : publique (Header + Footer) ou espace (Sidebar + barre supérieure + tiroir mobile) selon `resolveEspace(pathname)` | Partiel (FE-M01, FE-M03, FE-E03) |
| `Header` | `src/components/layout/Header.tsx` | Barre « Conseils agricoles », navigation publique (7 entrées), actions, menu mobile | Partiel (FE-E07) |
| `Footer` | `src/components/layout/Footer.tsx` | Colonnes de liens, état de l'API, « newsletter », langues | Partiel (FE-F08, FE-M16) |
| `AdminSidebar` | `src/components/layout/AdminSidebar.tsx` | Ancienne barre admin | **Mort** (FE-F03) |
| `Sidebar` (design system) | `src/design-system/components/Sidebar.tsx` | Barre latérale repliable des espaces | OK |
| Définition des espaces | `src/lib/space-nav.ts` (`ESPACES`, `resolveEspace`) | Menus des espaces admin, producteur, organisation, marché, app, vérificateur, investissement, développeurs | OK (libellés non traduits) |
| Destination initiale | `src/lib/redirects.ts` (`getUserInitialRoute`) | Rôle → espace | Partiel (FE-E05 : 3 rôles absents, 2 mal orientés) |

## 9. Fichiers de traduction

| Fichier | Lignes | Clés | État |
|---|---:|---:|---|
| `src/i18n/fr.ts` | 211 | 173 | OK (9 clés utilisées) |
| `src/i18n/en.ts` | 199 | 173 | OK (parité) |
| `src/i18n/index.ts` | 88 | — | Partiel (`hydrate` inutilisé) |

## 10. Tests

| Fichier | Outil | Résultat (2026-11-14) | Cause |
|---|---|---|---|
| `tests/hero-carousel.test.tsx` | Vitest | **3 échecs sur 3** | `<Link>` rendu sans routeur (`useContext(...)` null) |
| `tests/home.test.tsx` | Vitest | **5 échecs sur 5** | `window.matchMedia is not a function` (`hooks/useReveal.ts:12`) |
| `scripts/redirects.test.mjs` | `node --test` | **29/29** | — |

## 11. Ressources statiques

| Dossier | Contenu | Taille |
|---|---|---:|
| `src/assets/hero` | 10 JPG du carrousel | 3,1 Mo |
| `src/assets/cultures` | 18 JPG | 2,0 Mo |
| `src/assets/partenaires` | 16 JPG | 1,4 Mo |
| `src/assets/sections` | 2 JPG | 0,2 Mo |

Aucun format WebP ou AVIF, ni variante de résolution (FE-M16).

## 12. Documentation présente dans `apps/web/`

| Fichier | Lignes | Observation |
|---|---:|---|
| `README.md` | — | Partiellement obsolète (FE-F12) |
| `AGRIKONNECT AFRICA — Spécification fonctionnelle et technique.md` | 393 | Référence UX (§4) et frontend (§5) utilisée pour la comparaison |
| `HARMONISATION-CONVERSION.md`, `HARMONISATION-PALIER-P1.md` | 138, 300 | Notes d'harmonisation |

---

## 13. Routes (`src/App.tsx`)

Toutes les routes sont à plat (pas de routes imbriquées ni de `<Outlet>`). Protection : aucune au niveau du routeur ; elle est faite dans chaque page (voir §14).

| Route | Composant | Fichier |
|---|---|---|
| `/` | PublicHome | `src/pages/public/Home.tsx` (App.tsx:225) |
| `/services` | PublicServices | `src/pages/public/Services.tsx` (App.tsx:226) |
| `/a-propos` | PublicAbout | `src/pages/public/About.tsx` (App.tsx:227) |
| `/services/:serviceId` | PublicServiceDetail | `src/pages/public/ServiceDetail.tsx` (App.tsx:228) |
| `/public/farmers` | PublicFarmers | `src/pages/public/Farmers.tsx` (App.tsx:229) |
| `/public/farms/:slug` | PublicFarmProfile | `src/pages/public/FarmProfile.tsx` (App.tsx:230) |
| `/public/lots/:code` | PublicLotProfile | `src/pages/public/LotProfile.tsx` (App.tsx:231) |
| `/public/map` | PublicMapPage | `src/pages/public/MapPage.tsx` (App.tsx:232) |
| `/public/cooperatives` | PublicCooperatives | `src/pages/public/Cooperatives.tsx` (App.tsx:233) |
| `/public/cooperatives/:slug` | PublicCooperativeProfile | `src/pages/public/CooperativeProfile.tsx` (App.tsx:234) |
| `/public/projects` | PublicProjects | `src/pages/public/Projects.tsx` (App.tsx:235) |
| `/public/projects/:id` | PublicProjectProfile | `src/pages/public/ProjectProfile.tsx` (App.tsx:236) |
| `/public/tenders` | PublicTenders | `src/pages/public/Tenders.tsx` (App.tsx:237) |
| `/public/data` | PublicDataCatalog | `src/pages/public/DataCatalog.tsx` (App.tsx:238) |
| `/public/agriculture/:countryCode` | PublicAgricultureCountry | `src/pages/public/AgricultureCountry.tsx` (App.tsx:239) |
| `/public/country-language` | PublicCountryLanguageSelector | `src/pages/public/CountryLanguageSelector.tsx` (App.tsx:240) |
| `/public/legal` | PublicLegal | `src/pages/public/Legal.tsx` (App.tsx:241) |
| `/public/blog` | PublicBlog | `src/pages/public/Blog.tsx` (App.tsx:242) |
| `/public/blog/:slug` | PublicBlogPost | `src/pages/public/BlogPost.tsx` (App.tsx:243) |
| `/auth/login` | AuthLogin | `src/pages/auth/Login.tsx` (App.tsx:246) |
| `/auth/register` | AuthRegister | `src/pages/auth/Register.tsx` (App.tsx:247) |
| `/auth/forgot` | AuthForgot | `src/pages/auth/Forgot.tsx` (App.tsx:248) |
| `/auth/reset` | AuthReset | `src/pages/auth/Reset.tsx` (App.tsx:249) |
| `/auth/verify-email` | AuthVerifyEmail | `src/pages/auth/VerifyEmail.tsx` (App.tsx:250) |
| `/auth/mfa` | AuthMfa | `src/pages/auth/Mfa.tsx` (App.tsx:251) |
| `/auth/verify-phone` | AuthVerifyPhone | `src/pages/auth/VerifyPhone.tsx` (App.tsx:252) |
| `/admin` | Admin | `src/pages/admin/Admin.tsx` (App.tsx:255) |
| `/admin/dashboard` | AdminDashboard | `src/pages/admin/Dashboard.tsx` (App.tsx:256) |
| `/admin/farmers` | AdminFarmers | `src/pages/admin/Farmers.tsx` (App.tsx:257) |
| `/admin/farms` | AdminFarms | `src/pages/admin/Farms.tsx` (App.tsx:258) |
| `/admin/plots` | AdminPlots | `src/pages/admin/Plots.tsx` (App.tsx:259) |
| `/admin/productions` | AdminProductions | `src/pages/admin/Productions.tsx` (App.tsx:260) |
| `/admin/users` | AdminUsers | `src/pages/admin/Users.tsx` (App.tsx:261) |
| `/admin/users/:id` | AdminUserDetail | `src/pages/admin/UserDetail.tsx` (App.tsx:262) |
| `/admin/roles` | AdminRoles | `src/pages/admin/Roles.tsx` (App.tsx:263) |
| `/admin/orders` | AdminOrders | `src/pages/admin/Orders.tsx` (App.tsx:264) |
| `/admin/marketplace` | AdminMarketplace | `src/pages/admin/Marketplace.tsx` (App.tsx:265) |
| `/admin/prices` | AdminPrices | `src/pages/admin/Prices.tsx` (App.tsx:266) |
| `/admin/countries` | AdminCountries | `src/pages/admin/Countries.tsx` (App.tsx:267) |
| `/admin/countries/:code` | AdminCountryDetail | `src/pages/admin/CountryDetail.tsx` (App.tsx:268) |
| `/admin/crops` | AdminCrops | `src/pages/admin/Crops.tsx` (App.tsx:269) |
| `/admin/cooperatives` | AdminCooperatives | `src/pages/admin/Cooperatives.tsx` (App.tsx:270) |
| `/admin/projects` | AdminProjects | `src/pages/admin/Projects.tsx` (App.tsx:271) |
| `/admin/investors` | AdminInvestors | `src/pages/admin/Investors.tsx` (App.tsx:272) |
| `/admin/verifications` | AdminVerifications | `src/pages/admin/Verifications.tsx` (App.tsx:273) |
| `/admin/moderation` | AdminModeration | `src/pages/admin/Moderation.tsx` (App.tsx:274) |
| `/admin/reports` | AdminReports | `src/pages/admin/Reports.tsx` (App.tsx:275) |
| `/admin/audit` | AdminAuditLog | `src/pages/admin/AuditLog.tsx` (App.tsx:276) |
| `/admin/settings` | AdminSettings | `src/pages/admin/Settings.tsx` (App.tsx:277) |
| `/admin/monitoring` | AdminMonitoring | `src/pages/admin/Monitoring.tsx` (App.tsx:278) |
| `/admin/jobs` | AdminJobs | `src/pages/admin/Jobs.tsx` (App.tsx:279) |
| `/admin/security` | AdminSecurity | `src/pages/admin/Security.tsx` (App.tsx:280) |
| `/admin/operations` | AdminOperations | `src/pages/admin/Operations.tsx` (App.tsx:281) |
| `/admin/notifications` | AdminNotifications | `src/pages/admin/Notifications.tsx` (App.tsx:282) |
| `/admin/sync` | AdminSync | `src/pages/admin/Sync.tsx` (App.tsx:283) |
| `/admin/devices` | AdminDevices | `src/pages/admin/Devices.tsx` (App.tsx:284) |
| `/admin/lots` | AdminLots | `src/pages/admin/Lots.tsx` (App.tsx:285) |
| `/admin/producers` | AdminProducers | `src/pages/admin/Producers.tsx` (App.tsx:286) |
| `/admin/messages` | AdminMessages | `src/pages/admin/Messages.tsx` (App.tsx:287) |
| `/admin/api-clients` | AdminApiClients | `src/pages/admin/ApiClients.tsx` (App.tsx:288) |
| `/admin/ai-usage` | AdminAiUsage | `src/pages/admin/AiUsage.tsx` (App.tsx:289) |
| `/admin/data-products` | AdminDataProducts | `src/pages/admin/DataProducts.tsx` (App.tsx:290) |
| `/admin/partners` | AdminPartners | `src/pages/admin/Partners.tsx` (App.tsx:291) |
| `/admin/compliance` | AdminCompliance | `src/pages/admin/Compliance.tsx` (App.tsx:292) |
| `/admin/agronomic-ranges` | AdminAgronomicRanges | `src/pages/admin/AgronomicRanges.tsx` (App.tsx:293) |
| `/admin/rules` | AdminRules | `src/pages/admin/Rules.tsx` (App.tsx:294) |
| `/admin/blog-posts` | AdminBlogPosts | `src/pages/admin/BlogPosts.tsx` (App.tsx:295) |
| `/agent/consent` | AgentConsent | `src/pages/agent/Consent.tsx` (App.tsx:298) |
| `/agent/registration` | AgentRegistration | `src/pages/agent/Registration.tsx` (App.tsx:299) |
| `/ai/assistant` | AiAssistant | `src/pages/ai/Assistant.tsx` (App.tsx:302) |
| `/ai/analyses` | AiAnalyses | `src/pages/ai/Analyses.tsx` (App.tsx:303) |
| `/ai/analyses/:id` | AiAnalysisDetail | `src/pages/ai/AnalysisDetail.tsx` (App.tsx:304) |
| `/ai/documents` | AiDocuments | `src/pages/ai/Documents.tsx` (App.tsx:305) |
| `/app` | AppDashboard | `src/pages/app/Dashboard.tsx` (App.tsx:308) |
| `/app/farms` | AppFarms | `src/pages/app/Farms.tsx` (App.tsx:309) |
| `/app/farms/:id` | AppFarmDetail | `src/pages/app/FarmDetail.tsx` (App.tsx:310) |
| `/app/plots` | AppPlots | `src/pages/app/Plots.tsx` (App.tsx:311) |
| `/app/plots/:id` | AppPlotDetail | `src/pages/app/PlotDetail.tsx` (App.tsx:312) |
| `/app/productions` | AppProductions | `src/pages/app/Productions.tsx` (App.tsx:313) |
| `/app/soil` | AppSoil | `src/pages/app/Soil.tsx` (App.tsx:314) |
| `/app/inventory` | AppInventory | `src/pages/app/Inventory.tsx` (App.tsx:315) |
| `/app/orders` | AppOrders | `src/pages/app/Orders.tsx` (App.tsx:316) |
| `/app/orders/:id` | AppOrderDetail | `src/pages/app/OrderDetail.tsx` (App.tsx:317) |
| `/app/messages` | AppMessages | `src/pages/app/Messages.tsx` (App.tsx:318) |
| `/app/messages/:id` | AppConversation | `src/pages/app/Conversation.tsx` (App.tsx:319) |
| `/app/notifications` | AppNotifications | `src/pages/app/Notifications.tsx` (App.tsx:320) |
| `/app/sms-consent` | AppSmsConsent | `src/pages/app/SmsConsent.tsx` (App.tsx:321) |
| `/app/season-feedback` | AppSeasonFeedback | `src/pages/app/SeasonFeedback.tsx` (App.tsx:322) |
| `/app/profile` | AppProfile | `src/pages/app/Profile.tsx` (App.tsx:323) |
| `/app/verification` | AppVerification | `src/pages/app/Verification.tsx` (App.tsx:324) |
| `/app/agent` | AppAgent | `src/pages/app/Agent.tsx` (App.tsx:325) |
| `/app/cooperative` | AppCooperative | `src/pages/app/Cooperative.tsx` (App.tsx:326) |
| `/app/cooperative/offers` | AppCooperativeOffers | `src/pages/app/CooperativeOffers.tsx` (App.tsx:327) |
| `/app/cooperative/orders` | AppCooperativeOrders | `src/pages/app/CooperativeOrders.tsx` (App.tsx:328) |
| `/app/invoices` | AppInvoices | `src/pages/app/Invoices.tsx` (App.tsx:329) |
| `/app/transport` | AppTransport | `src/pages/app/Transport.tsx` (App.tsx:330) |
| `/developers` | DevelopersHome | `src/pages/developers/index.tsx` (App.tsx:333) |
| `/developers/keys` | DevelopersKeys | `src/pages/developers/Keys.tsx` (App.tsx:334) |
| `/developers/usage` | DevelopersUsage | `src/pages/developers/Usage.tsx` (App.tsx:335) |
| `/developers/docs` | DevelopersDocs | `src/pages/developers/Docs.tsx` (App.tsx:336) |
| `/farmer` | FarmerHome | `src/pages/farmer/index.tsx` (App.tsx:339) |
| `/farmer/profile` | FarmerProfile | `src/pages/farmer/Profile.tsx` (App.tsx:340) |
| `/farmer/public-profile` | FarmerPublicProfile | `src/pages/farmer/PublicProfile.tsx` (App.tsx:341) |
| `/farmer/settings` | FarmerSettings | `src/pages/farmer/Settings.tsx` (App.tsx:342) |
| `/farmer/alerts` | FarmerAlerts | `src/pages/farmer/Alerts.tsx` (App.tsx:343) |
| `/farmer/farms` | FarmerFarms | `src/pages/farmer/Farms/index.tsx` (App.tsx:344) |
| `/farmer/farms/create` | FarmerFarmCreate | `src/pages/farmer/Farms/Create.tsx` (App.tsx:345) |
| `/farmer/farms/:id` | FarmerFarmDetail | `src/pages/farmer/Farms/Detail.tsx` (App.tsx:346) |
| `/farmer/plots` | FarmerPlots | `src/pages/farmer/Plots/index.tsx` (App.tsx:347) |
| `/farmer/plots/create` | FarmerPlotCreate | `src/pages/farmer/Plots/Create.tsx` (App.tsx:348) |
| `/farmer/plots/:id` | FarmerPlotDetail | `src/pages/farmer/Plots/Detail.tsx` (App.tsx:349) |
| `/farmer/plots/:id/soil` | FarmerPlotSoil | `src/pages/farmer/Plots/Soil.tsx` (App.tsx:350) |
| `/farmer/plots/:id/recommendations` | FarmerPlotRecommendations | `src/pages/farmer/Plots/Recommendations.tsx` (App.tsx:351) |
| `/farmer/plots/:id/rotation` | FarmerPlotRotation | `src/pages/farmer/Plots/Rotation.tsx` (App.tsx:352) |
| `/farmer/plots/:id/plan` | FarmerPlotPlan | `src/pages/farmer/Plots/Plan.tsx` (App.tsx:353) |
| `/farmer/plots/:id/precision-report` | FarmerPlotPrecisionReport | `src/pages/farmer/Plots/PrecisionReport.tsx` (App.tsx:354) |
| `/farmer/plots/:id/zones` | FarmerPlotZones | `src/pages/farmer/Plots/Zones.tsx` (App.tsx:355) |
| `/farmer/plots/:id/sensors` | FarmerPlotSensors | `src/pages/farmer/Plots/Sensors.tsx` (App.tsx:356) |
| `/farmer/plots/:id/satellite` | FarmerPlotSatellite | `src/pages/farmer/Plots/Satellite.tsx` (App.tsx:357) |
| `/farmer/productions` | FarmerProductions | `src/pages/farmer/Productions.tsx` (App.tsx:358) |
| `/farmer/soil` | FarmerSoil | `src/pages/farmer/Soil.tsx` (App.tsx:359) |
| `/farmer/lots` | FarmerLots | `src/pages/farmer/Lots/index.tsx` (App.tsx:360) |
| `/farmer/lots/:id` | FarmerLotDetail | `src/pages/farmer/Lots/Detail.tsx` (App.tsx:361) |
| `/farmer/export` | FarmerExport | `src/pages/farmer/Export/index.tsx` (App.tsx:362) |
| `/farmer/export/:id` | FarmerExportDetail | `src/pages/farmer/Export/Detail.tsx` (App.tsx:363) |
| `/farmer/export/:id/documents` | FarmerExportDocuments | `src/pages/farmer/Export/Documents.tsx` (App.tsx:364) |
| `/farmer/projects` | FarmerProjects | `src/pages/farmer/Projects/index.tsx` (App.tsx:365) |
| `/farmer/projects/create` | FarmerProjectCreate | `src/pages/farmer/Projects/Create.tsx` (App.tsx:366) |
| `/farmer/projects/:id` | FarmerProjectDetail | `src/pages/farmer/Projects/Detail.tsx` (App.tsx:367) |
| `/farmer/projects/:id/dataroom` | FarmerProjectDataRoom | `src/pages/farmer/Projects/DataRoom.tsx` (App.tsx:368) |
| `/farmer/projects/:id/reports` | FarmerProjectReports | `src/pages/farmer/Projects/Reports.tsx` (App.tsx:369) |
| `/farmer/projects/:id/access` | FarmerProjectAccessLog | `src/pages/farmer/Projects/AccessLog.tsx` (App.tsx:370) |
| `/farmer/certifications` | FarmerCertifications | `src/pages/farmer/Certifications.tsx` (App.tsx:371) |
| `/farmer/devices` | FarmerDevices | `src/pages/farmer/Devices.tsx` (App.tsx:372) |
| `/farmer/surveys` | FarmerSurveys | `src/pages/farmer/Surveys.tsx` (App.tsx:373) |
| `/farmer/sync` | FarmerSyncStatus | `src/pages/farmer/SyncStatus.tsx` (App.tsx:374) |
| `/farmer/verification` | FarmerVerification | `src/pages/farmer/Verification.tsx` (App.tsx:375) |
| `/farmer/conflicts` | FarmerConflictResolution | `src/pages/farmer/ConflictResolution.tsx` (App.tsx:376) |
| `/farmer/gallery` | FarmerGallery | `src/pages/farmer/Gallery.tsx` (App.tsx:377) |
| `/insights` | InsightsHome | `src/pages/insights/index.tsx` (App.tsx:380) |
| `/insights/:region` | InsightsRegion | `src/pages/insights/Region.tsx` (App.tsx:381) |
| `/international/tenders` | InternationalTenders | `src/pages/international/Tenders.tsx` (App.tsx:384) |
| `/international/orders` | InternationalOrders | `src/pages/international/Orders.tsx` (App.tsx:385) |
| `/international/documents` | InternationalDocuments | `src/pages/international/Documents.tsx` (App.tsx:386) |
| `/investment` | InvestmentHome | `src/pages/investment/index.tsx` (App.tsx:389) |
| `/investment/profile` | InvestmentProfile | `src/pages/investment/Profile.tsx` (App.tsx:390) |
| `/investment/projects` | InvestmentFollowedProjects | `src/pages/investment/FollowedProjects.tsx` (App.tsx:391) |
| `/investment/projects/:id` | InvestmentProjectDetail | `src/pages/investment/ProjectDetail.tsx` (App.tsx:392) |
| `/investment/requests` | InvestmentRequests | `src/pages/investment/Requests.tsx` (App.tsx:393) |
| `/market` | MarketPublic | `src/pages/market/MarketPublic.tsx` (App.tsx:396) |
| `/market/listings` | MarketPublic | `src/pages/market/MarketPublic.tsx` (App.tsx:397) |
| `/market/listings/:id` | MarketListingDetail | `src/pages/market/ListingDetail.tsx` (App.tsx:398) |
| `/market/listings/new` | MarketNewListing | `src/pages/market/NewListing.tsx` (App.tsx:399) |
| `/market/requests` | MarketRequests | `src/pages/market/Requests.tsx` (App.tsx:400) |
| `/market/requests/new` | MarketNewRequest | `src/pages/market/NewRequest.tsx` (App.tsx:401) |
| `/market/requests/:id/matches` | MarketRequestMatches | `src/pages/market/RequestMatches.tsx` (App.tsx:402) |
| `/market/reviews` | MarketReviews | `src/pages/market/Reviews.tsx` (App.tsx:403) |
| `/market/transporters` | MarketTransporters | `src/pages/market/Transporters.tsx` (App.tsx:404) |
| `/market/app` | MarketApp | `src/pages/market/MarketApp.tsx` (App.tsx:405) |
| `/organization` | OrganizationHome | `src/pages/organization/index.tsx` (App.tsx:408) |
| `/organization/overview` | OrganizationOverview | `src/pages/organization/Overview.tsx` (App.tsx:409) |
| `/organization/profile` | OrganizationProfile | `src/pages/organization/Profile.tsx` (App.tsx:410) |
| `/organization/members` | OrganizationMembers | `src/pages/organization/Members.tsx` (App.tsx:411) |
| `/organization/invitations` | OrganizationInvitations | `src/pages/organization/Invitations.tsx` (App.tsx:412) |
| `/organization/import` | OrganizationMemberImport | `src/pages/organization/MemberImport.tsx` (App.tsx:413) |
| `/organization/farms` | OrganizationFarms | `src/pages/organization/Farms.tsx` (App.tsx:414) |
| `/organization/production` | OrganizationProductionSummary | `src/pages/organization/ProductionSummary.tsx` (App.tsx:415) |
| `/organization/verification` | OrganizationVerification | `src/pages/organization/Verification.tsx` (App.tsx:416) |
| `/reviewer/missions` | ReviewerMissions | `src/pages/reviewer/Missions.tsx` (App.tsx:419) |
| `/reviewer/missions/:id` | ReviewerChecklist | `src/pages/reviewer/Checklist.tsx` (App.tsx:420) |
| `/prices` | Prices | `src/pages/Prices.tsx` (App.tsx:423) |
| `/crop-prices` | CropPrices | `src/pages/CropPrices.tsx` (App.tsx:424) |
| `/weather` | Weather | `src/pages/Weather.tsx` (App.tsx:425) |
| `*` | AppNotFound | `src/components/pages/NotFound.tsx` (App.tsx:428) |

## 14. Pages (`src/pages/`)

Colonnes :
- **Protection** : `ResourcePage`, `DetailPage` et `PlotModule` intègrent `AuthGate` (sauf `public`) ; `AuthGate` est la vérification de session seule (aucune page ne vérifie une permission) ; « — » signifie aucune protection (pages publiques et d'authentification).
- **Textes en dur (≈)** : nombre approximatif de chaînes visibles non traduites.

**Pages à défaut bloquant identifié (KO)** :
- `app/Messages.tsx`, `app/Orders.tsx`, `market/ListingDetail.tsx` (FE-E04) ;
- `reviewer/Checklist.tsx`, `reviewer/Missions.tsx` (FE-E05) ;
- `admin/Producers.tsx` (FE-M08) ;
- `admin/Reports.tsx`, `farmer/Lots/Detail.tsx` (FE-M07) ;
- `market/MarketPublic.tsx`, `public/DataCatalog.tsx`, `public/AgricultureCountry.tsx` en anonyme (FE-E07) ;
- les 10 tableaux de bord à graphiques fictifs (FE-E08) : `app/Agent`, `app/Dashboard`, `app/Transport`, `developers/index`, `farmer/index`, `investment/index`, `market/MarketApp`, `organization/index`, `organization/Overview`, `reviewer/Missions`.

| Fichier | Lignes | Route(s) | Protection | useQuery | useMutation | Appels API | Textes en dur (≈) |
|---|---:|---|---|---:|---:|---|---:|
| `pages/admin/Admin.tsx` | 100 | `/admin` | AuthGate | 0 | 0 | — | 39 |
| `pages/admin/AgronomicRanges.tsx` | 658 | `/admin/agronomic-ranges` | AuthGate | 3 | 4 | `agronomicRangeApi.meta`, `agronomicRangeApi.importTemplate`, `agronomicRangeApi.update`, `agronomicRangeApi.create`, `agronomicRangeApi.validate`, `agronomicRangeApi.retire`, `agronomicRangeApi.importCsv` | 47 |
| `pages/admin/AiUsage.tsx` | 32 | `/admin/ai-usage` | ResourcePage | 0 | 0 | `aiApi.list` | 7 |
| `pages/admin/ApiClients.tsx` | 33 | `/admin/api-clients` | ResourcePage | 0 | 0 | `apiClientApi.clients` | 10 |
| `pages/admin/AuditLog.tsx` | 268 | `/admin/audit` | AuthGate | 1 | 0 | `adminApi.audit`, `adminApi.auditExport` | 14 |
| `pages/admin/BlogPosts.tsx` | 152 | `/admin/blog-posts` | AuthGate | 1 | 2 | `adminApi.blogPosts`, `adminApi.updateBlogPost`, `adminApi.createBlogPost`, `adminApi.deleteBlogPost` | 15 |
| `pages/admin/Compliance.tsx` | 32 | `/admin/compliance` | ResourcePage | 0 | 0 | `certificationApi.list` | 9 |
| `pages/admin/Cooperatives.tsx` | 31 | `/admin/cooperatives` | ResourcePage | 0 | 0 | `organizationApi.list` | 8 |
| `pages/admin/Countries.tsx` | 31 | `/admin/countries` | ResourcePage | 0 | 0 | `referenceApi.countries` | 8 |
| `pages/admin/CountryDetail.tsx` | 34 | `/admin/countries/:code` | DetailPage | 0 | 0 | `referenceApi.country` | 5 |
| `pages/admin/Crops.tsx` | 30 | `/admin/crops` | ResourcePage | 0 | 0 | `referenceApi.crops` | 8 |
| `pages/admin/Dashboard.tsx` | 399 | `/admin/dashboard` | AuthGate | 4 | 0 | `adminApi.dashboard`, `referenceApi.countries`, `farmApi.list`, `verificationApi.adminQueue`, `adminApi.dashboardExport` | 41 |
| `pages/admin/DataProducts.tsx` | 89 | `/admin/data-products` | AuthGate | 1 | 0 | `insightsApi.disclosurePolicy` | 2 |
| `pages/admin/Devices.tsx` | 216 | `/admin/devices` | AuthGate | 3 | 1 | `anomalyApi.list`, `anomalyApi.settings`, `anomalyApi.review`, `iotApi.devices` | 13 |
| `pages/admin/Farmers.tsx` | 29 | `/admin/farmers` | ResourcePage | 0 | 0 | `adminApi.users` | 9 |
| `pages/admin/Farms.tsx` | 35 | `/admin/farms` | ResourcePage | 0 | 0 | `farmApi.list` | 11 |
| `pages/admin/Investors.tsx` | 28 | `/admin/investors` | ResourcePage | 0 | 0 | `adminApi.users` | 7 |
| `pages/admin/Jobs.tsx` | 213 | `/admin/jobs` | AuthGate | 1 | 3 | `adminApi.jobs`, `adminApi.runJob`, `adminApi.pauseJob`, `adminApi.resumeJob` | 14 |
| `pages/admin/Lots.tsx` | 28 | `/admin/lots` | ResourcePage | 0 | 0 | `lotApi.list` | 6 |
| `pages/admin/Marketplace.tsx` | 32 | `/admin/marketplace` | ResourcePage | 0 | 0 | `listingApi.list` | 8 |
| `pages/admin/Messages.tsx` | 31 | `/admin/messages` | ResourcePage | 0 | 0 | `messagingApi.conversations` | 6 |
| `pages/admin/Moderation.tsx` | 31 | `/admin/moderation` | ResourcePage | 0 | 0 | `orderApi.adminDisputes` | 7 |
| `pages/admin/Monitoring.tsx` | 264 | `/admin/monitoring` | AuthGate | 2 | 0 | `adminApi.monitoringServices`, `adminApi.monitoringHealth` | 13 |
| `pages/admin/Notifications.tsx` | 266 | `/admin/notifications` | AuthGate | 1 | 1 | `adminApi.notificationsHistory`, `adminApi.broadcastAnnouncement` | 14 |
| `pages/admin/Operations.tsx` | 234 | `/admin/operations` | AuthGate | 1 | 1 | `adminApi.operationsList`, `adminApi.moderateOperation` | 14 |
| `pages/admin/Orders.tsx` | 33 | `/admin/orders` | ResourcePage | 0 | 0 | `orderApi.list` | 9 |
| `pages/admin/Partners.tsx` | 28 | `/admin/partners` | ResourcePage | 0 | 0 | `adminApi.users` | 7 |
| `pages/admin/Plots.tsx` | 30 | `/admin/plots` | ResourcePage | 0 | 0 | `plotApi.list` | 9 |
| `pages/admin/Prices.tsx` | 34 | `/admin/prices` | ResourcePage | 0 | 0 | `priceApi.list` | 10 |
| `pages/admin/Producers.tsx` | 28 | `/admin/producers` | ResourcePage | 0 | 0 | `adminApi.users` | 7 |
| `pages/admin/Productions.tsx` | 32 | `/admin/productions` | ResourcePage | 0 | 0 | `productionApi.list` | 9 |
| `pages/admin/Projects.tsx` | 28 | `/admin/projects` | ResourcePage | 0 | 0 | `projectApi.list` | 8 |
| `pages/admin/Reports.tsx` | 63 | `/admin/reports` | AuthGate | 1 | 0 | `adminApi.dashboard`, `adminApi.exportFarms` | 3 |
| `pages/admin/Roles.tsx` | 100 | `/admin/roles` | AuthGate | 1 | 0 | `adminApi.roles` | 4 |
| `pages/admin/Rules.tsx` | 68 | `/admin/rules` | AuthGate | 1 | 0 | `geoApi.methods` | 2 |
| `pages/admin/Security.tsx` | 372 | `/admin/security` | AuthGate | 2 | 2 | `adminApi.securityOverview`, `adminApi.securityPolicy`, `adminApi.unlockUser`, `adminApi.updateSecurityPolicy` | 20 |
| `pages/admin/Settings.tsx` | 68 | `/admin/settings` | AuthGate | 1 | 0 | `adminApi.settings` | 2 |
| `pages/admin/Sync.tsx` | 86 | `/admin/sync` | AuthGate | 1 | 0 | `publicApi.health` | 2 |
| `pages/admin/UserDetail.tsx` | 384 | `/admin/users/:id` | AuthGate | 1 | 0 | `adminApi.user`, `adminApi.setUserStatus`, `adminApi.unlockUser`, `adminApi.forceLogout`, `adminApi.verifyUserEmail`, `adminApi.verifyUserPhone`, `adminApi.grantRole`, `adminApi.revokeRole`, `adminApi.exportUser`, `adminApi.deleteUser` | 31 |
| `pages/admin/Users.tsx` | 152 | `/admin/users` | ResourcePage | 0 | 0 | `adminApi.users` | 19 |
| `pages/admin/Verifications.tsx` | 32 | `/admin/verifications` | ResourcePage | 0 | 0 | `verificationApi.adminQueue` | 9 |
| `pages/agent/Consent.tsx` | 63 | `/agent/consent` | AuthGate | 0 | 0 | — | 13 |
| `pages/agent/Registration.tsx` | 85 | `/agent/registration` | AuthGate | 0 | 1 | `authApi.register` | 8 |
| `pages/ai/Analyses.tsx` | 32 | `/ai/analyses` | ResourcePage | 0 | 0 | `aiApi.list` | 7 |
| `pages/ai/AnalysisDetail.tsx` | 64 | `/ai/analyses/:id` | DetailPage | 0 | 0 | `aiApi.get` | 10 |
| `pages/ai/Assistant.tsx` | 168 | `/ai/assistant` | AuthGate | 1 | 2 | `aiApi.list`, `aiApi.copilot`, `aiApi.escalate` | 9 |
| `pages/ai/Documents.tsx` | 31 | `/ai/documents` | ResourcePage | 0 | 0 | `aiApi.list` | 7 |
| `pages/app/Agent.tsx` | 217 | `/app/agent` | AuthGate | 2 | 0 | `messagingApi.conversations`, `notificationApi.list` | 26 |
| `pages/app/Conversation.tsx` | 109 | `/app/messages/:id` | AuthGate | 1 | 1 | `messagingApi.messages`, `messagingApi.send` | 8 |
| `pages/app/Cooperative.tsx` | 183 | `/app/cooperative` | AuthGate | 3 | 0 | `cooperativeApi.current`, `cooperativeApi.members`, `cooperativeApi.overview` | 8 |
| `pages/app/CooperativeOffers.tsx` | 34 | `/app/cooperative/offers` | ResourcePage | 1 | 0 | `cooperativeApi.current`, `cooperativeApi.groupOffers` | 5 |
| `pages/app/CooperativeOrders.tsx` | 32 | `/app/cooperative/orders` | ResourcePage | 0 | 0 | `orderApi.list` | 7 |
| `pages/app/Dashboard.tsx` | 282 | `/app` | AuthGate | 5 | 0 | `dashboardApi.farmer`, `orderApi.list`, `messagingApi.conversations`, `notificationApi.list`, `verificationApi.mine` | 26 |
| `pages/app/FarmDetail.tsx` | 64 | `/app/farms/:id` | DetailPage | 0 | 0 | `farmApi.get` | 19 |
| `pages/app/Farms.tsx` | 34 | `/app/farms` | ResourcePage | 0 | 0 | `farmApi.list` | 11 |
| `pages/app/Inventory.tsx` | 39 | `/app/inventory` | ResourcePage | 0 | 0 | `inventoryApi.list` | 8 |
| `pages/app/Invoices.tsx` | 33 | `/app/invoices` | ResourcePage | 0 | 0 | `orderApi.list` | 8 |
| `pages/app/Messages.tsx` | 188 | `/app/messages` | AuthGate | 2 | 1 | `messagingApi.conversations`, `messagingApi.messages`, `messagingApi.send` | 11 |
| `pages/app/Notifications.tsx` | 115 | `/app/notifications` | AuthGate | 1 | 2 | `notificationApi.list`, `notificationApi.readAll`, `notificationApi.read` | 10 |
| `pages/app/OrderDetail.tsx` | 131 | `/app/orders/:id` | AuthGate | 2 | 1 | `orderApi.get`, `orderApi.events`, `orderApi.setStatus` | 3 |
| `pages/app/Orders.tsx` | 84 | `/app/orders` | AuthGate | 1 | 0 | `orderApi.list` | 5 |
| `pages/app/PlotDetail.tsx` | 136 | `/app/plots/:id` | AuthGate | 1 | 0 | `plotApi.get` | 10 |
| `pages/app/Plots.tsx` | 31 | `/app/plots` | ResourcePage | 0 | 0 | `plotApi.list` | 10 |
| `pages/app/Productions.tsx` | 33 | `/app/productions` | ResourcePage | 0 | 0 | `productionApi.list` | 10 |
| `pages/app/Profile.tsx` | 177 | `/app/profile` | AuthGate | 1 | 1 | `authApi.me`, `authApi.updateMe` | 13 |
| `pages/app/SeasonFeedback.tsx` | 551 | `/app/season-feedback` | AuthGate | 4 | 1 | `plotApi.list`, `referenceApi.crops`, `seasonApi.list`, `seasonApi.compare`, `seasonApi.create` | 25 |
| `pages/app/SmsConsent.tsx` | 270 | `/app/sms-consent` | AuthGate | 1 | 2 | `smsConsentApi.get`, `smsConsentApi.grant`, `smsConsentApi.withdraw` | 17 |
| `pages/app/Soil.tsx` | 93 | `/app/soil` | AuthGate | 1 | 0 | `soilApi.profile` | 5 |
| `pages/app/Transport.tsx` | 255 | `/app/transport` | AuthGate | 1 | 0 | `transportApi.requests` | 36 |
| `pages/app/Verification.tsx` | 33 | `/app/verification` | ResourcePage | 0 | 0 | `verificationApi.mine` | 9 |
| `pages/auth/Forgot.tsx` | 84 | `/auth/forgot` | — | 0 | 0 | `authApi.forgotPassword` | 4 |
| `pages/auth/Login.tsx` | 119 | `/auth/login` | — | 0 | 0 | — | 7 |
| `pages/auth/Mfa.tsx` | 371 | `/auth/mfa` | AuthGate | 1 | 4 | `authApi.mfaSetup`, `authApi.mfaStatus`, `authApi.mfaConfirm`, `authApi.mfaVerify`, `authApi.mfaDisable` | 14 |
| `pages/auth/Register.tsx` | 171 | `/auth/register` | — | 0 | 0 | — | 19 |
| `pages/auth/Reset.tsx` | 85 | `/auth/reset` | — | 0 | 0 | `authApi.resetPassword` | 4 |
| `pages/auth/VerifyEmail.tsx` | 179 | `/auth/verify-email` | test status | 0 | 2 | `authApi.verifyEmail`, `authApi.resendVerification` | 10 |
| `pages/auth/VerifyPhone.tsx` | 75 | `/auth/verify-phone` | — | 0 | 2 | `authApi.verifyPhone`, `authApi.sendOtp` | 4 |
| `pages/CropPrices.tsx` | 33 | `/crop-prices` | ResourcePage | 0 | 0 | `priceApi.list` | 8 |
| `pages/developers/Docs.tsx` | 80 | `/developers/docs` | — | 0 | 0 | — | 13 |
| `pages/developers/index.tsx` | 220 | `/developers` | test status | 3 | 0 | `apiClientApi.clients`, `referenceApi.countries`, `referenceApi.crops` | 28 |
| `pages/developers/Keys.tsx` | 238 | `/developers/keys` | AuthGate | 1 | 4 | `apiClientApi.clients`, `apiClientApi.create`, `apiClientApi.setPurpose`, `apiClientApi.createKey`, `apiClientApi.revokeKey` | 20 |
| `pages/developers/Usage.tsx` | 30 | `/developers/usage` | ResourcePage | 0 | 0 | `apiClientApi.clients` | 6 |
| `pages/farmer/Alerts.tsx` | 398 | `/farmer/alerts` | AuthGate | 2 | 2 | `alertApi.meta`, `alertApi.list`, `alertApi.markRead`, `alertApi.markHandled` | 17 |
| `pages/farmer/Certifications.tsx` | 32 | `/farmer/certifications` | ResourcePage | 0 | 0 | `certificationApi.list` | 9 |
| `pages/farmer/ConflictResolution.tsx` | 71 | `/farmer/conflicts` | AuthGate | 1 | 0 | `orderApi.list` | 3 |
| `pages/farmer/Devices.tsx` | 32 | `/farmer/devices` | ResourcePage | 0 | 0 | `iotApi.devices` | 11 |
| `pages/farmer/Export/Detail.tsx` | 135 | `/farmer/export/:id` | DetailPage | 0 | 0 | `exportApi.get` | 28 |
| `pages/farmer/Export/Documents.tsx` | 61 | `/farmer/export/:id/documents` | ResourcePage | 0 | 0 | `exportApi.get` | 8 |
| `pages/farmer/Export/index.tsx` | 72 | `/farmer/export` | ResourcePage | 0 | 0 | `exportApi.list` | 9 |
| `pages/farmer/Farms/Create.tsx` | 81 | `/farmer/farms/create` | AuthGate | 0 | 1 | `farmApi.create` | 7 |
| `pages/farmer/Farms/Detail.tsx` | 60 | `/farmer/farms/:id` | DetailPage | 0 | 0 | `farmApi.get` | 19 |
| `pages/farmer/Farms/index.tsx` | 34 | `/farmer/farms` | ResourcePage | 0 | 0 | `farmApi.list` | 11 |
| `pages/farmer/Gallery.tsx` | 60 | `/farmer/gallery` | AuthGate | 1 | 0 | `mediaApi.list` | 4 |
| `pages/farmer/index.tsx` | 371 | `/farmer` | AuthGate | 5 | 0 | `dashboardApi.farmer`, `plotApi.list`, `productionApi.list`, `alertApi.list`, `lotApi.list` | 42 |
| `pages/farmer/Lots/Detail.tsx` | 77 | `/farmer/lots/:id` | DetailPage | 0 | 0 | `lotApi.get` | 15 |
| `pages/farmer/Lots/index.tsx` | 28 | `/farmer/lots` | ResourcePage | 0 | 0 | `lotApi.list` | 5 |
| `pages/farmer/Plots/Create.tsx` | 81 | `/farmer/plots/create` | AuthGate | 0 | 1 | `plotApi.create` | 7 |
| `pages/farmer/Plots/Detail.tsx` | 89 | `/farmer/plots/:id` | DetailPage | 0 | 0 | `plotApi.get` | 23 |
| `pages/farmer/Plots/index.tsx` | 31 | `/farmer/plots` | ResourcePage | 0 | 0 | `plotApi.list` | 10 |
| `pages/farmer/Plots/Plan.tsx` | 63 | `/farmer/plots/:id/plan` | PlotModule | 0 | 0 | `soilApi.farmingPlans` | 6 |
| `pages/farmer/Plots/PrecisionReport.tsx` | 80 | `/farmer/plots/:id/precision-report` | PlotModule | 0 | 0 | `precisionApi.reports` | 8 |
| `pages/farmer/Plots/RecommendationMethod.tsx` | 172 | — (non routé, importé) | — | 0 | 0 | — | 7 |
| `pages/farmer/Plots/Recommendations.tsx` | 460 | `/farmer/plots/:id/recommendations` | AuthGate | 2 | 2 | `recommendationApi.list`, `soilApi.suitability`, `recommendationApi.create`, `recommendationApi.decide` | 17 |
| `pages/farmer/Plots/Rotation.tsx` | 78 | `/farmer/plots/:id/rotation` | PlotModule | 0 | 0 | `soilApi.rotationPlans` | 5 |
| `pages/farmer/Plots/Satellite.tsx` | 208 | `/farmer/plots/:id/satellite` | PlotModule | 0 | 1 | `satelliteApi.acquire`, `satelliteApi.observations` | 14 |
| `pages/farmer/Plots/Sensors.tsx` | 192 | `/farmer/plots/:id/sensors` | PlotModule | 1 | 1 | `alertApi.list`, `alertApi.markRead`, `alertApi.markHandled`, `iotApi.devices` | 10 |
| `pages/farmer/Plots/Soil.tsx` | 71 | `/farmer/plots/:id/soil` | PlotModule | 0 | 0 | `soilApi.profile` | 3 |
| `pages/farmer/Plots/Zones.tsx` | 87 | `/farmer/plots/:id/zones` | PlotModule | 0 | 0 | `precisionApi.zones` | 4 |
| `pages/farmer/Productions.tsx` | 33 | `/farmer/productions` | ResourcePage | 0 | 0 | `productionApi.list` | 9 |
| `pages/farmer/Profile.tsx` | 72 | `/farmer/profile` | AuthGate | 0 | 1 | `authApi.updateMe` | 8 |
| `pages/farmer/Projects/AccessLog.tsx` | 37 | `/farmer/projects/:id/access` | ResourcePage | 0 | 0 | `projectDataApi.accessLog` | 6 |
| `pages/farmer/Projects/Create.tsx` | 269 | `/farmer/projects/create` | AuthGate | 1 | 1 | `referenceApi.countries`, `projectApi.create` | 17 |
| `pages/farmer/Projects/DataRoom.tsx` | 47 | `/farmer/projects/:id/dataroom` | ResourcePage | 0 | 0 | `projectDataApi.documents` | 8 |
| `pages/farmer/Projects/Detail.tsx` | 60 | `/farmer/projects/:id` | DetailPage | 0 | 0 | `projectApi.get` | 14 |
| `pages/farmer/Projects/index.tsx` | 31 | `/farmer/projects` | ResourcePage | 0 | 0 | `projectApi.list` | 9 |
| `pages/farmer/Projects/Reports.tsx` | 103 | `/farmer/projects/:id/reports` | AuthGate | 1 | 0 | `projectDataApi.reports` | 3 |
| `pages/farmer/PublicProfile.tsx` | 88 | `/farmer/public-profile` | AuthGate | 2 | 0 | `authApi.me`, `farmApi.list` | 3 |
| `pages/farmer/Settings.tsx` | 88 | `/farmer/settings` | AuthGate | 0 | 0 | — | 5 |
| `pages/farmer/Soil.tsx` | 34 | `/farmer/soil` | AuthGate | 0 | 0 | — | 1 |
| `pages/farmer/Surveys.tsx` | 32 | `/farmer/surveys` | AuthGate | 0 | 0 | — | 2 |
| `pages/farmer/SyncStatus.tsx` | 190 | `/farmer/sync` | AuthGate | 3 | 0 | `syncApi.collections`, `syncApi.conflicts`, `syncApi.pull` | 8 |
| `pages/farmer/Verification.tsx` | 70 | `/farmer/verification` | AuthGate | 1 | 0 | `verificationApi.mine` | 3 |
| `pages/insights/index.tsx` | 175 | `/insights` | AuthGate | 3 | 0 | `insightsApi.overview`, `insightsApi.crops`, `insightsApi.disclosurePolicy` | 7 |
| `pages/insights/Region.tsx` | 92 | `/insights/:region` | — | 1 | 0 | `insightsApi.overview` | 9 |
| `pages/international/Documents.tsx` | 26 | `/international/documents` | ResourcePage | 0 | 0 | — | 5 |
| `pages/international/Orders.tsx` | 32 | `/international/orders` | ResourcePage | 0 | 0 | `orderApi.list` | 7 |
| `pages/international/Tenders.tsx` | 33 | `/international/tenders` | ResourcePage | 0 | 0 | `tenderApi.list` | 5 |
| `pages/investment/FollowedProjects.tsx` | 29 | `/investment/projects` | ResourcePage | 0 | 0 | `investApi.followed` | 7 |
| `pages/investment/index.tsx` | 435 | `/investment` | AuthGate | 5 | 1 | `investApi.projects`, `investApi.followed`, `investApi.follow` | 35 |
| `pages/investment/Profile.tsx` | 47 | `/investment/profile` | AuthGate | 0 | 0 | — | 3 |
| `pages/investment/ProjectDetail.tsx` | 51 | `/investment/projects/:id` | DetailPage | 0 | 0 | `projectApi.get` | 12 |
| `pages/investment/Requests.tsx` | 30 | `/investment/requests` | ResourcePage | 0 | 0 | — | 8 |
| `pages/market/common.tsx` | 17 | — (non routé, importé) | — | 0 | 0 | — | 5 |
| `pages/market/ListingDetail.tsx` | 185 | `/market/listings/:id` | AuthGate | 1 | 1 | `listingApi.get`, `listingApi.contact` | 7 |
| `pages/market/MarketApp.tsx` | 305 | `/market/app` | AuthGate | 4 | 0 | `listingApi.list`, `orderApi.list`, `requestApi.list`, `transportApi.requests` | 33 |
| `pages/market/MarketPublic.tsx` | 29 | `/market`<br>`/market/listings` | ResourcePage | 0 | 0 | `listingApi.list` | 4 |
| `pages/market/NewListing.tsx` | 78 | `/market/listings/new` | AuthGate | 0 | 1 | `listingApi.create` | 5 |
| `pages/market/NewRequest.tsx` | 73 | `/market/requests/new` | AuthGate | 0 | 1 | `requestApi.create` | 5 |
| `pages/market/RequestMatches.tsx` | 84 | `/market/requests/:id/matches` | AuthGate | 1 | 0 | `requestApi.matches` | 4 |
| `pages/market/Requests.tsx` | 33 | `/market/requests` | ResourcePage | 0 | 0 | `requestApi.list` | 6 |
| `pages/market/Reviews.tsx` | 29 | `/market/reviews` | ResourcePage | 0 | 0 | — | 7 |
| `pages/market/Transporters.tsx` | 31 | `/market/transporters` | ResourcePage | 0 | 0 | — | 7 |
| `pages/organization/Farms.tsx` | 29 | `/organization/farms` | ResourcePage | 0 | 0 | `farmApi.list` | 8 |
| `pages/organization/index.tsx` | 323 | `/organization` | AuthGate | 5 | 0 | `organizationApi.list`, `cooperativeApi.current`, `cooperativeApi.overview`, `cooperativeApi.members`, `cooperativeApi.groupOffers` | 41 |
| `pages/organization/Invitations.tsx` | 30 | `/organization/invitations` | ResourcePage | 0 | 0 | — | 7 |
| `pages/organization/MemberImport.tsx` | 264 | `/organization/import` | AuthGate | 1 | 1 | `cooperativeApi.current`, `cooperativeApi.importMembers` | 13 |
| `pages/organization/Members.tsx` | 30 | `/organization/members` | ResourcePage | 0 | 0 | — | 7 |
| `pages/organization/Overview.tsx` | 209 | `/organization/overview` | AuthGate | 2 | 0 | `cooperativeApi.current`, `cooperativeApi.overview` | 23 |
| `pages/organization/ProductionSummary.tsx` | 166 | `/organization/production` | AuthGate | 1 | 0 | `productionApi.stats` | 3 |
| `pages/organization/Profile.tsx` | 115 | `/organization/profile` | AuthGate | 1 | 0 | `organizationApi.get` | 3 |
| `pages/organization/Verification.tsx` | 147 | `/organization/verification` | AuthGate | 1 | 0 | `verificationApi.mine` | 8 |
| `pages/Prices.tsx` | 35 | `/prices` | ResourcePage | 0 | 0 | `priceApi.list` | 10 |
| `pages/public/About.tsx` | 150 | `/a-propos` | — | 3 | 0 | `publicApi.farms`, `publicApi.map`, `publicApi.soilStats` | 41 |
| `pages/public/AgricultureCountry.tsx` | 96 | `/public/agriculture/:countryCode` | — | 1 | 0 | `insightsApi.overview` | 4 |
| `pages/public/Blog.tsx` | 68 | `/public/blog` | — | 1 | 0 | `publicApi.blogPosts` | 4 |
| `pages/public/BlogNewsSection.tsx` | 53 | — (non routé, importé) | — | 1 | 0 | `publicApi.blogPosts` | 3 |
| `pages/public/BlogPost.tsx` | 60 | `/public/blog/:slug` | — | 1 | 0 | `publicApi.blogPost` | 0 |
| `pages/public/CooperativeProfile.tsx` | 46 | `/public/cooperatives/:slug` | DetailPage | 0 | 0 | `organizationApi.get` | 13 |
| `pages/public/Cooperatives.tsx` | 33 | `/public/cooperatives` | ResourcePage | 0 | 0 | `organizationApi.list` | 6 |
| `pages/public/CountryLanguageSelector.tsx` | 53 | `/public/country-language` | — | 0 | 0 | — | 1 |
| `pages/public/DataCatalog.tsx` | 87 | `/public/data` | — | 1 | 0 | `insightsApi.disclosurePolicy` | 6 |
| `pages/public/Farmers.tsx` | 96 | `/public/farmers` | — | 1 | 0 | `publicApi.farms` | 4 |
| `pages/public/FarmProfile.tsx` | 144 | `/public/farms/:slug` | — | 1 | 0 | `publicApi.farm` | 2 |
| `pages/public/Home.tsx` | 658 | `/` | — | 2 | 0 | `publicApi.farms`, `publicApi.soilStats` | 42 |
| `pages/public/homeSlides.ts` | 84 | — (non routé, importé) | — | 0 | 0 | — | 0 |
| `pages/public/Legal.tsx` | 96 | `/public/legal` | — | 0 | 0 | — | 12 |
| `pages/public/LotProfile.tsx` | 141 | `/public/lots/:code` | — | 1 | 0 | `publicApi.lot` | 2 |
| `pages/public/MapPage.tsx` | 141 | `/public/map` | — | 1 | 0 | `publicApi.map` | 1 |
| `pages/public/ProjectProfile.tsx` | 56 | `/public/projects/:id` | DetailPage | 0 | 0 | `projectApi.get` | 17 |
| `pages/public/Projects.tsx` | 31 | `/public/projects` | ResourcePage | 0 | 0 | `projectApi.list` | 6 |
| `pages/public/ServiceDetail.tsx` | 30 | `/services/:serviceId` | — | 0 | 0 | — | 7 |
| `pages/public/Services.tsx` | 69 | `/services` | — | 0 | 0 | — | 6 |
| `pages/public/Tenders.tsx` | 34 | `/public/tenders` | ResourcePage | 0 | 0 | `tenderApi.list` | 6 |
| `pages/reviewer/Checklist.tsx` | 248 | `/reviewer/missions/:id` | AuthGate | 1 | 1 | `verificationApi.adminQueue`, `verificationApi.decide` | 15 |
| `pages/reviewer/Missions.tsx` | 350 | `/reviewer/missions` | AuthGate | 3 | 3 | `verificationApi.adminQueue`, `aiApi.list`, `certificationApi.list`, `verificationApi.decide`, `aiApi.review`, `certificationApi.verify` | 37 |
| `pages/Weather.tsx` | 107 | `/weather` | — | 1 | 0 | `weatherApi.forPlot` | 5 |

## 15. Composants, modules et utilitaires (hors pages)

La colonne « Importé par » compte les fichiers qui l'importent. **0 = module mort**.

| Fichier | Lignes | Exports | Importé par (nb fichiers) |
|---|---:|---|---:|
| `App.tsx` | 438 | — | 1 |
| `components/Icons.tsx` | 224 | IconeFeuille, IconePlant, IconeGoutte, IconeSonde, IconeCarte, IconeRepere, IconeCheck, IconeAttention, IconeInfo, IconeCroix, IconeHorloge, IconeFleche, … (+9) | 4 |
| `components/hero/HeroCarousel.tsx` | 321 | HeroCarouselSlide, HeroCarouselProps, HeroCarousel | 3 |
| `components/kit.tsx` | 515 | TitreSection, Encadre, Etiquette, BadgeFiabilite, Progression, Carte, Bouton, Champ, Reveal | 1 |
| `components/layout/AdminSidebar.tsx` | 145 | AdminSidebar | 0 |
| `components/layout/AppLayout.tsx` | 383 | AppLayout | 1 |
| `components/layout/Footer.tsx` | 178 | Footer | 1 |
| `components/layout/Header.tsx` | 238 | Header | 1 |
| `components/pages/AdminShared.tsx` | 41 | Row, str, StatusChip, DateCell, Num, render | 2 |
| `components/pages/DetailPage.tsx` | 143 | DetailField, DetailSection, DetailPageProps, DetailPage | 2 |
| `components/pages/NotFound.tsx` | 23 | NotFound | 2 |
| `components/pages/PlotModule.tsx` | 95 | PlotModuleProps, PlotModule | 2 |
| `components/pages/ResourcePage.tsx` | 176 | ResourceColumn, ResourcePageProps, ResourcePage | 2 |
| `components/pages/index.ts` | 10 | — | 94 |
| `components/ui/AppErrorBoundary.tsx` | 53 | AppErrorBoundary | 1 |
| `components/ui/AuthGate.tsx` | 42 | AuthGateProps, AuthGate | 2 |
| `components/ui/Button.tsx` | 112 | ButtonVariant, ButtonSize, ButtonProps, Button | 4 |
| `components/ui/Card.tsx` | 70 | CardTone, CardProps, Card, CardTitle, CardBody | 2 |
| `components/ui/Chip.tsx` | 80 | ChipTone, ChipSize, ChipProps, Chip, FilterChip, ChipRow | 2 |
| `components/ui/Field.tsx` | 100 | InputProps, Input, TextAreaProps, TextArea | 2 |
| `components/ui/ProvenanceTag.tsx` | 47 | ProvenanceTagProps, ProvenanceTag | 2 |
| `components/ui/Reveal.tsx` | 24 | Reveal | 3 |
| `components/ui/Section.tsx` | 38 | SectionProps, Section | 2 |
| `components/ui/States.tsx` | 97 | LoadingState, EmptyState, ErrorState | 1 |
| `components/ui/Text.tsx` | 43 | TextPreset, TextProps, Text | 3 |
| `components/ui/index.ts` | 19 | — | 165 |
| `design-system/components/ChartCard.tsx` | 38 | ChartCardProps, ChartCard | 2 |
| `design-system/components/HorizonDashboard.tsx` | 1177 | HorizonTone, HorizonIconName, HorizonMiniIcon, HorizonShell, HorizonKpiItem, HorizonOverviewCardProps, HorizonOverviewCard, HorizonSeriesPoint, HorizonAreaChartCardProps, HorizonAreaChartCard, HorizonMapMarker, HorizonMapLegendItem, … (+9) | 2 |
| `design-system/components/Sidebar.tsx` | 460 | SidebarItem, SidebarGroup, SidebarStatusCard, SidebarProps, Sidebar | 2 |
| `design-system/components/StatCard.tsx` | 71 | StatTendance, StatCardProps, StatCard | 2 |
| `design-system/hooks/useBreakpoint.ts` | 32 | Breakpoint, useBreakpoint | 2 |
| `design-system/index.ts` | 38 | — | 27 |
| `design-system/lib/utils.ts` | 8 | cn | 5 |
| `hooks/useReveal.ts` | 32 | useReveal | 2 |
| `i18n/en.ts` | 199 | en | 1 |
| `i18n/fr.ts` | 211 | fr, Dictionary | 2 |
| `i18n/index.ts` | 88 | TranslationKey, translate, useI18nStore, useI18n, SUPPORTED_LOCALES | 110 |
| `lib/config.ts` | 39 | API_BASE_URL, REALTIME_URL, APP, IS_WEB, IS_NATIVE, TIMEOUTS, REALTIME_PATH | 5 |
| `lib/faq.ts` | 116 | FaqEntry, FAQ_ENTRIES | 0 |
| `lib/format.ts` | 166 | Locale, DEFAULT_CURRENCY, formatNumber, formatCompact, formatCurrency, formatMoney, formatAreaHa, formatWeightKg, formatDate, formatRelative, formatPercent, truncate, … (+5) | 109 |
| `lib/phone.ts` | 60 | isValidE164, PhoneReadiness, phoneReadiness, maskForDisplay | 1 |
| `lib/platform.ts` | 96 | PlatformService, SERVICES | 1 |
| `lib/redirects.ts` | 224 | CompletenessItem, UserLike, RedirectInput, RedirectResult, ECRAN_ATTENTE, ECRAN_SUR, ECRAN_CONNEXION, getActiveOrganizationId, setActiveOrganizationId, getRoles, resolveActiveContext, getUserInitialRoute | 7 |
| `lib/secure-storage.ts` | 54 | STORAGE_KEYS, secureStorage | 1 |
| `lib/service-catalog.ts` | 107 | ServiceCatalogItem, SERVICE_CATALOG, SERVICE_DOMAINS | 2 |
| `lib/space-nav.ts` | 390 | LienEspace, GroupeEspace, CtaEspace, EspaceDef, ESPACES, resolveEspace | 1 |
| `lib/ulid.ts` | 51 | ulid, createUlidFactory, isUlid | 1 |
| `main.tsx` | 18 | — | 0 |
| `services/endpoints.ts` | 1239 | publicApi, authApi, referenceApi, farmApi, plotApi, productionApi, soilApi, precisionApi, geoApi, listingApi, requestApi, inventoryApi, … (+32) | 146 |
| `services/http.ts` | 162 | ExtraConfig, http, setSessionLostHandler, RequestResult, api, cleanQuery | 3 |
| `services/index.ts` | 6 | — | 11 |
| `services/query.ts` | 284 | queryClient, queryKeys | 136 |
| `services/realtime.ts` | 147 | RealtimeEvent, REALTIME_EVENTS, RealtimeEventName, realtime | 1 |
| `services/session.ts` | 147 | sessionStore, profileStorage | 4 |
| `services/types.ts` | 2395 | ApiMeta, ApiEnvelope, ApiFieldError, ApiErrorBody, RequestError, ErrorKind, ERROR_KIND_I18N, Session, OrganizationRef, PublicUser, LoginResult, MeResult, … (+190) | 74 |
| `store/auth.ts` | 187 | AuthStatus, useAuthStore, selectUser, selectStatus, selectIsAuthenticated | 81 |
| `theme/agrikonnect.ts` | 270 | VERT, TERRE, CREME, ENCRE, BLANC, ROUGE, SCIENTIFIQUE, FONCTION, SEMANTIQUE, TEXTE, TAILLES, RAYON, … (+3) | 11 |
| `theme/colors.ts` | 2 | — | 1 |
| `theme/index.ts` | 109 | COLORS, TINTS, SPACING, RADIUS, LAYOUT, BREAKPOINT, DURATION, EASE | 106 |

### Constats sur les composants

- **Morts** : `components/layout/AdminSidebar.tsx`, `lib/faq.ts` (`main.tsx` est le point d'entrée, chargé par `index.html`).
- **Sous-utilisé** : `components/kit.tsx` (515 lignes, 9 composants, 1 seul importateur), doublon de `components/ui` (`Bouton`/`Button`, `Champ`/`Input`, `Reveal`/`Reveal`) (FE-M14).
- **Dépendance circulaire** : `components/ui/index.ts` → `AuthGate.tsx` → `components/ui/index.ts` (FE-F03).
- **Composant monolithique** : `design-system/components/HorizonDashboard.tsx` (1 177 lignes, 21 exportations) à découper.
- **Socles génériques** : `ResourcePage` (61 écrans), `DetailPage` (11), `PlotModule` (7). Bonne mutualisation, mais sans pagination ni tri (FE-M06).
