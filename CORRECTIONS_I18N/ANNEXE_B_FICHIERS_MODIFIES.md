# Annexe B — Fichiers modifiés et ajoutés

Comparaison avec l’état du dépôt avant la correction (copie de travail reconstituée : commit `7b8fda2` + modifications non commitées préexistantes), fins de ligne ignorées. M = modifié, A = ajouté. « Remplacements » = nombre de textes en dur remplacés par une clé de traduction par l’outil de migration (les corrections manuelles ne sont pas comptées).

## Application web (212 entrées)

| État | Fichier | Remplacements |
|---|---|---:|
| A | `'apps/web/src/components/ui'/LanguageSwitcher.tsx` |  |
| A | `'apps/web/src/hooks'/useLocaleSync.ts` |  |
| A | `'apps/web/src/i18n'/ui.en.ts` |  |
| A | `'apps/web/src/i18n'/ui.fr.ts` |  |
| A | `'apps/web/src/i18n'/ui.types.ts` |  |
| M | `apps/web/src/App.tsx` |  |
| M | `apps/web/src/components/hero/HeroCarousel.tsx` | 3 |
| M | `apps/web/src/components/kit.tsx` | 2 |
| M | `apps/web/src/components/layout/AdminSidebar.tsx` | 23 |
| M | `apps/web/src/components/layout/AppLayout.tsx` | 18 |
| M | `apps/web/src/components/layout/Footer.tsx` | 39 |
| M | `apps/web/src/components/layout/Header.tsx` | 31 |
| M | `apps/web/src/components/pages/DetailPage.tsx` | 3 |
| M | `apps/web/src/components/pages/NotFound.tsx` | 2 |
| M | `apps/web/src/components/pages/PlotModule.tsx` | 1 |
| M | `apps/web/src/components/pages/ResourcePage.tsx` | 4 |
| M | `apps/web/src/components/ui/AppErrorBoundary.tsx` | 3 |
| M | `apps/web/src/components/ui/AuthGate.tsx` | 2 |
| M | `apps/web/src/components/ui/ProvenanceTag.tsx` | 6 |
| M | `apps/web/src/components/ui/States.tsx` | 3 |
| M | `apps/web/src/design-system/components/ChartCard.tsx` | 1 |
| M | `apps/web/src/design-system/components/HorizonDashboard.tsx` | 8 |
| M | `apps/web/src/design-system/components/Sidebar.tsx` | 11 |
| M | `apps/web/src/design-system/components/StatCard.tsx` | 1 |
| M | `apps/web/src/i18n/en.ts` |  |
| M | `apps/web/src/i18n/fr.ts` |  |
| M | `apps/web/src/i18n/index.ts` |  |
| M | `apps/web/src/lib/config.ts` | 1 |
| M | `apps/web/src/lib/faq.ts` | 28 |
| M | `apps/web/src/lib/format.ts` |  |
| M | `apps/web/src/lib/phone.ts` | 2 |
| M | `apps/web/src/lib/platform.ts` | 18 |
| M | `apps/web/src/lib/service-catalog.ts` | 100 |
| M | `apps/web/src/lib/space-nav.ts` | 148 |
| M | `apps/web/src/main.tsx` |  |
| M | `apps/web/src/pages/admin/Admin.tsx` | 41 |
| M | `apps/web/src/pages/admin/AgronomicRanges.tsx` | 79 |
| M | `apps/web/src/pages/admin/AiUsage.tsx` | 8 |
| M | `apps/web/src/pages/admin/ApiClients.tsx` | 10 |
| M | `apps/web/src/pages/admin/AuditLog.tsx` | 27 |
| M | `apps/web/src/pages/admin/BlogPosts.tsx` | 21 |
| M | `apps/web/src/pages/admin/Compliance.tsx` | 9 |
| M | `apps/web/src/pages/admin/Cooperatives.tsx` | 8 |
| M | `apps/web/src/pages/admin/Countries.tsx` | 9 |
| M | `apps/web/src/pages/admin/CountryDetail.tsx` | 6 |
| M | `apps/web/src/pages/admin/Crops.tsx` | 8 |
| M | `apps/web/src/pages/admin/Dashboard.tsx` | 58 |
| M | `apps/web/src/pages/admin/DataProducts.tsx` | 8 |
| M | `apps/web/src/pages/admin/Devices.tsx` | 25 |
| M | `apps/web/src/pages/admin/Farmers.tsx` | 9 |
| M | `apps/web/src/pages/admin/Farms.tsx` | 13 |
| M | `apps/web/src/pages/admin/Investors.tsx` | 8 |
| M | `apps/web/src/pages/admin/Jobs.tsx` | 24 |
| M | `apps/web/src/pages/admin/Lots.tsx` | 7 |
| M | `apps/web/src/pages/admin/Marketplace.tsx` | 8 |
| M | `apps/web/src/pages/admin/Messages.tsx` | 7 |
| M | `apps/web/src/pages/admin/Moderation.tsx` | 8 |
| M | `apps/web/src/pages/admin/Monitoring.tsx` | 47 |
| M | `apps/web/src/pages/admin/Notifications.tsx` | 30 |
| M | `apps/web/src/pages/admin/Operations.tsx` | 20 |
| M | `apps/web/src/pages/admin/Orders.tsx` | 9 |
| M | `apps/web/src/pages/admin/Partners.tsx` | 8 |
| M | `apps/web/src/pages/admin/Plots.tsx` | 9 |
| M | `apps/web/src/pages/admin/Prices.tsx` | 11 |
| M | `apps/web/src/pages/admin/Producers.tsx` | 8 |
| M | `apps/web/src/pages/admin/Productions.tsx` | 8 |
| M | `apps/web/src/pages/admin/Projects.tsx` | 8 |
| M | `apps/web/src/pages/admin/Reports.tsx` | 8 |
| M | `apps/web/src/pages/admin/Roles.tsx` | 7 |
| M | `apps/web/src/pages/admin/Rules.tsx` | 5 |
| M | `apps/web/src/pages/admin/Security.tsx` | 41 |
| M | `apps/web/src/pages/admin/Settings.tsx` | 5 |
| M | `apps/web/src/pages/admin/Sync.tsx` | 8 |
| M | `apps/web/src/pages/admin/UserDetail.tsx` | 47 |
| M | `apps/web/src/pages/admin/Users.tsx` | 20 |
| M | `apps/web/src/pages/admin/Verifications.tsx` | 9 |
| M | `apps/web/src/pages/agent/Consent.tsx` | 15 |
| M | `apps/web/src/pages/agent/Registration.tsx` | 14 |
| M | `apps/web/src/pages/ai/Analyses.tsx` | 7 |
| M | `apps/web/src/pages/ai/AnalysisDetail.tsx` | 14 |
| M | `apps/web/src/pages/ai/Assistant.tsx` | 16 |
| M | `apps/web/src/pages/ai/Documents.tsx` | 7 |
| M | `apps/web/src/pages/app/Agent.tsx` | 33 |
| M | `apps/web/src/pages/app/Conversation.tsx` | 9 |
| M | `apps/web/src/pages/app/Cooperative.tsx` | 20 |
| M | `apps/web/src/pages/app/CooperativeOffers.tsx` | 6 |
| M | `apps/web/src/pages/app/CooperativeOrders.tsx` | 8 |
| M | `apps/web/src/pages/app/Dashboard.tsx` | 42 |
| M | `apps/web/src/pages/app/FarmDetail.tsx` | 21 |
| M | `apps/web/src/pages/app/Farms.tsx` | 12 |
| M | `apps/web/src/pages/app/Inventory.tsx` | 10 |
| M | `apps/web/src/pages/app/Invoices.tsx` | 8 |
| M | `apps/web/src/pages/app/Messages.tsx` | 16 |
| M | `apps/web/src/pages/app/Notifications.tsx` | 11 |
| M | `apps/web/src/pages/app/OrderDetail.tsx` | 8 |
| M | `apps/web/src/pages/app/Orders.tsx` | 9 |
| M | `apps/web/src/pages/app/PlotDetail.tsx` | 18 |
| M | `apps/web/src/pages/app/Plots.tsx` | 10 |
| M | `apps/web/src/pages/app/Productions.tsx` | 9 |
| M | `apps/web/src/pages/app/Profile.tsx` | 22 |
| M | `apps/web/src/pages/app/SeasonFeedback.tsx` | 36 |
| M | `apps/web/src/pages/app/SmsConsent.tsx` | 29 |
| M | `apps/web/src/pages/app/Soil.tsx` | 9 |
| M | `apps/web/src/pages/app/Transport.tsx` | 43 |
| M | `apps/web/src/pages/app/Verification.tsx` | 10 |
| M | `apps/web/src/pages/auth/Forgot.tsx` | 8 |
| M | `apps/web/src/pages/auth/Login.tsx` | 12 |
| M | `apps/web/src/pages/auth/Mfa.tsx` | 29 |
| M | `apps/web/src/pages/auth/Register.tsx` | 23 |
| M | `apps/web/src/pages/auth/Reset.tsx` | 10 |
| M | `apps/web/src/pages/auth/VerifyEmail.tsx` | 15 |
| M | `apps/web/src/pages/auth/VerifyPhone.tsx` | 7 |
| M | `apps/web/src/pages/CropPrices.tsx` | 9 |
| M | `apps/web/src/pages/developers/Docs.tsx` | 14 |
| M | `apps/web/src/pages/developers/index.tsx` | 34 |
| M | `apps/web/src/pages/developers/Keys.tsx` | 38 |
| M | `apps/web/src/pages/developers/Usage.tsx` | 7 |
| M | `apps/web/src/pages/farmer/Alerts.tsx` | 31 |
| M | `apps/web/src/pages/farmer/Certifications.tsx` | 9 |
| M | `apps/web/src/pages/farmer/ConflictResolution.tsx` | 6 |
| M | `apps/web/src/pages/farmer/Devices.tsx` | 11 |
| M | `apps/web/src/pages/farmer/Export/Detail.tsx` | 28 |
| M | `apps/web/src/pages/farmer/Export/Documents.tsx` | 14 |
| M | `apps/web/src/pages/farmer/Export/index.tsx` | 11 |
| M | `apps/web/src/pages/farmer/Farms/Create.tsx` | 13 |
| M | `apps/web/src/pages/farmer/Farms/Detail.tsx` | 21 |
| M | `apps/web/src/pages/farmer/Farms/index.tsx` | 12 |
| M | `apps/web/src/pages/farmer/Gallery.tsx` | 5 |
| M | `apps/web/src/pages/farmer/index.tsx` | 54 |
| M | `apps/web/src/pages/farmer/Lots/Detail.tsx` | 15 |
| M | `apps/web/src/pages/farmer/Lots/index.tsx` | 6 |
| M | `apps/web/src/pages/farmer/Plots/Create.tsx` | 13 |
| M | `apps/web/src/pages/farmer/Plots/Detail.tsx` | 24 |
| M | `apps/web/src/pages/farmer/Plots/index.tsx` | 10 |
| M | `apps/web/src/pages/farmer/Plots/Plan.tsx` | 6 |
| M | `apps/web/src/pages/farmer/Plots/PrecisionReport.tsx` | 12 |
| M | `apps/web/src/pages/farmer/Plots/RecommendationMethod.tsx` | 6 |
| M | `apps/web/src/pages/farmer/Plots/Recommendations.tsx` | 35 |
| M | `apps/web/src/pages/farmer/Plots/Rotation.tsx` | 8 |
| M | `apps/web/src/pages/farmer/Plots/Satellite.tsx` | 20 |
| M | `apps/web/src/pages/farmer/Plots/Sensors.tsx` | 18 |
| M | `apps/web/src/pages/farmer/Plots/Soil.tsx` | 5 |
| M | `apps/web/src/pages/farmer/Plots/Zones.tsx` | 9 |
| M | `apps/web/src/pages/farmer/Productions.tsx` | 10 |
| M | `apps/web/src/pages/farmer/Profile.tsx` | 12 |
| M | `apps/web/src/pages/farmer/Projects/AccessLog.tsx` | 8 |
| M | `apps/web/src/pages/farmer/Projects/Create.tsx` | 29 |
| M | `apps/web/src/pages/farmer/Projects/DataRoom.tsx` | 9 |
| M | `apps/web/src/pages/farmer/Projects/Detail.tsx` | 16 |
| M | `apps/web/src/pages/farmer/Projects/index.tsx` | 9 |
| M | `apps/web/src/pages/farmer/Projects/Reports.tsx` | 10 |
| M | `apps/web/src/pages/farmer/PublicProfile.tsx` | 7 |
| M | `apps/web/src/pages/farmer/Settings.tsx` | 13 |
| M | `apps/web/src/pages/farmer/Soil.tsx` | 4 |
| M | `apps/web/src/pages/farmer/Surveys.tsx` | 5 |
| M | `apps/web/src/pages/farmer/SyncStatus.tsx` | 18 |
| M | `apps/web/src/pages/farmer/Verification.tsx` | 6 |
| M | `apps/web/src/pages/insights/index.tsx` | 15 |
| M | `apps/web/src/pages/insights/Region.tsx` | 12 |
| M | `apps/web/src/pages/international/Documents.tsx` | 7 |
| M | `apps/web/src/pages/international/Orders.tsx` | 8 |
| M | `apps/web/src/pages/international/Tenders.tsx` | 9 |
| M | `apps/web/src/pages/investment/FollowedProjects.tsx` | 7 |
| M | `apps/web/src/pages/investment/index.tsx` | 55 |
| M | `apps/web/src/pages/investment/Profile.tsx` | 8 |
| M | `apps/web/src/pages/investment/ProjectDetail.tsx` | 13 |
| M | `apps/web/src/pages/investment/Requests.tsx` | 8 |
| M | `apps/web/src/pages/market/common.tsx` | 5 |
| M | `apps/web/src/pages/market/ListingDetail.tsx` | 21 |
| M | `apps/web/src/pages/market/MarketApp.tsx` | 50 |
| M | `apps/web/src/pages/market/MarketPublic.tsx` | 4 |
| M | `apps/web/src/pages/market/NewListing.tsx` | 11 |
| M | `apps/web/src/pages/market/NewRequest.tsx` | 9 |
| M | `apps/web/src/pages/market/RequestMatches.tsx` | 6 |
| M | `apps/web/src/pages/market/Requests.tsx` | 9 |
| M | `apps/web/src/pages/market/Reviews.tsx` | 7 |
| M | `apps/web/src/pages/market/Transporters.tsx` | 8 |
| M | `apps/web/src/pages/organization/Farms.tsx` | 10 |
| M | `apps/web/src/pages/organization/index.tsx` | 51 |
| M | `apps/web/src/pages/organization/Invitations.tsx` | 8 |
| M | `apps/web/src/pages/organization/MemberImport.tsx` | 27 |
| M | `apps/web/src/pages/organization/Members.tsx` | 8 |
| M | `apps/web/src/pages/organization/Overview.tsx` | 32 |
| M | `apps/web/src/pages/organization/ProductionSummary.tsx` | 18 |
| M | `apps/web/src/pages/organization/Profile.tsx` | 12 |
| M | `apps/web/src/pages/organization/Verification.tsx` | 18 |
| M | `apps/web/src/pages/Prices.tsx` | 11 |
| M | `apps/web/src/pages/public/About.tsx` | 39 |
| M | `apps/web/src/pages/public/AgricultureCountry.tsx` | 7 |
| M | `apps/web/src/pages/public/Blog.tsx` | 5 |
| M | `apps/web/src/pages/public/BlogNewsSection.tsx` | 6 |
| M | `apps/web/src/pages/public/BlogPost.tsx` | 3 |
| M | `apps/web/src/pages/public/CooperativeProfile.tsx` | 12 |
| M | `apps/web/src/pages/public/Cooperatives.tsx` | 7 |
| M | `apps/web/src/pages/public/CountryLanguageSelector.tsx` | 6 |
| M | `apps/web/src/pages/public/DataCatalog.tsx` | 13 |
| M | `apps/web/src/pages/public/Farmers.tsx` | 10 |
| M | `apps/web/src/pages/public/FarmProfile.tsx` | 14 |
| M | `apps/web/src/pages/public/Home.tsx` | 95 |
| M | `apps/web/src/pages/public/homeSlides.ts` | 30 |
| M | `apps/web/src/pages/public/Legal.tsx` | 21 |
| M | `apps/web/src/pages/public/LotProfile.tsx` | 12 |
| M | `apps/web/src/pages/public/MapPage.tsx` | 10 |
| M | `apps/web/src/pages/public/ProjectProfile.tsx` | 18 |
| M | `apps/web/src/pages/public/Projects.tsx` | 8 |
| M | `apps/web/src/pages/public/ServiceDetail.tsx` | 6 |
| M | `apps/web/src/pages/public/Services.tsx` | 7 |
| M | `apps/web/src/pages/public/Tenders.tsx` | 9 |
| M | `apps/web/src/pages/reviewer/Checklist.tsx` | 26 |
| M | `apps/web/src/pages/reviewer/Missions.tsx` | 54 |
| M | `apps/web/src/pages/Weather.tsx` | 14 |
| M | `apps/web/src/services/http.ts` |  |

## Application mobile (250 entrées)

| État | Fichier | Remplacements |
|---|---|---:|
| M | `'apps/Mobile/src/app/actualites/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/admin/countries/[code].tsx'` |  |
| M | `'apps/Mobile/src/app/admin/users/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/ai/analyses/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/annonces/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/cooperatives/[slug].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/export/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/export/[id]/documents.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/farms/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/lots/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/orders/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/plan.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/precision-report.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/recommendations.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/rotation.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/satellite.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/sensors.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/soil.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/plots/[id]/zones.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/projects/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/projects/[id]/access-log.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/projects/[id]/dataroom.tsx'` |  |
| M | `'apps/Mobile/src/app/farmer/projects/[id]/reports.tsx'` |  |
| M | `'apps/Mobile/src/app/insights/[country]/[region].tsx'` |  |
| M | `'apps/Mobile/src/app/investment/projects/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/marketplace/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/messages/[conversationId].tsx'` |  |
| M | `'apps/Mobile/src/app/organization/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/prices/[crop].tsx'` |  |
| M | `'apps/Mobile/src/app/producteurs/[slug].tsx'` |  |
| M | `'apps/Mobile/src/app/projets/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/actualites/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/agriculture/[country].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/annonces/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/cooperatives/[slug].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/farm/[slug].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/lot/[code].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/producteurs/[slug].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/projects/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/projets/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/public-site/ventes/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/requests/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/requests/[id]/matches.tsx'` |  |
| M | `'apps/Mobile/src/app/reviewer/checklists/[id].tsx'` |  |
| M | `'apps/Mobile/src/app/services/[serviceId].tsx'` |  |
| M | `'apps/Mobile/src/app/ventes/[id].tsx'` |  |
| A | `'apps/Mobile/src/hooks'/useLocaleSync.ts` |  |
| A | `'apps/Mobile/src/i18n'/ui.en.ts` |  |
| A | `'apps/Mobile/src/i18n'/ui.fr.ts` |  |
| A | `'apps/Mobile/src/i18n'/ui.types.ts` |  |
| M | `apps/Mobile/src/app/_layout.tsx` |  |
| M | `apps/Mobile/src/app/+not-found.tsx` | 5 |
| M | `apps/Mobile/src/app/a-propos.tsx` | 25 |
| M | `apps/Mobile/src/app/actualites.tsx` | 9 |
| M | `apps/Mobile/src/app/admin/agronomic-ranges.tsx` | 64 |
| M | `apps/Mobile/src/app/admin/ai-usage.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/api-clients.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/audit.tsx` | 29 |
| M | `apps/Mobile/src/app/admin/compliance.tsx` | 8 |
| M | `apps/Mobile/src/app/admin/cooperatives.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/countries/index.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/crops.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/dashboard.tsx` | 33 |
| M | `apps/Mobile/src/app/admin/data-products.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/devices.tsx` | 19 |
| M | `apps/Mobile/src/app/admin/farmers.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/farms.tsx` | 7 |
| M | `apps/Mobile/src/app/admin/index.tsx` | 24 |
| M | `apps/Mobile/src/app/admin/investors.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/jobs.tsx` | 22 |
| M | `apps/Mobile/src/app/admin/lots.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/marketplace.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/messages.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/moderation.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/monitoring.tsx` | 37 |
| M | `apps/Mobile/src/app/admin/notifications.tsx` | 32 |
| M | `apps/Mobile/src/app/admin/operations.tsx` | 18 |
| M | `apps/Mobile/src/app/admin/orders.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/partners.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/plots.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/prices.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/producers.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/productions.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/projects.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/reports.tsx` | 7 |
| M | `apps/Mobile/src/app/admin/roles.tsx` | 7 |
| M | `apps/Mobile/src/app/admin/rules.tsx` | 6 |
| M | `apps/Mobile/src/app/admin/security.tsx` | 38 |
| M | `apps/Mobile/src/app/admin/settings.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/sync.tsx` | 5 |
| M | `apps/Mobile/src/app/admin/users.tsx` | 12 |
| M | `apps/Mobile/src/app/admin/verifications.tsx` | 5 |
| M | `apps/Mobile/src/app/agent/consent.tsx` | 15 |
| M | `apps/Mobile/src/app/agent/index.tsx` | 30 |
| M | `apps/Mobile/src/app/agent/registration.tsx` | 11 |
| M | `apps/Mobile/src/app/ai/analyses/index.tsx` | 6 |
| M | `apps/Mobile/src/app/ai/documents.tsx` | 6 |
| M | `apps/Mobile/src/app/ai/index.tsx` | 23 |
| M | `apps/Mobile/src/app/annonces/creer.tsx` | 14 |
| M | `apps/Mobile/src/app/annonces/index.tsx` | 17 |
| M | `apps/Mobile/src/app/auth/forgot-password.tsx` | 4 |
| M | `apps/Mobile/src/app/auth/login.tsx` | 2 |
| M | `apps/Mobile/src/app/auth/mfa.tsx` | 22 |
| M | `apps/Mobile/src/app/auth/register.tsx` | 9 |
| M | `apps/Mobile/src/app/auth/reset-password.tsx` | 7 |
| M | `apps/Mobile/src/app/auth/verify-email.tsx` | 16 |
| M | `apps/Mobile/src/app/auth/verify-phone.tsx` | 14 |
| M | `apps/Mobile/src/app/contact.tsx` | 26 |
| M | `apps/Mobile/src/app/cooperatives/index.tsx` | 20 |
| M | `apps/Mobile/src/app/developers/docs.tsx` | 14 |
| M | `apps/Mobile/src/app/developers/index.tsx` | 51 |
| M | `apps/Mobile/src/app/developers/keys.tsx` | 5 |
| M | `apps/Mobile/src/app/developers/usage.tsx` | 5 |
| M | `apps/Mobile/src/app/explore.tsx` | 9 |
| M | `apps/Mobile/src/app/faq.tsx` | 6 |
| M | `apps/Mobile/src/app/farmer/alerts.tsx` | 24 |
| M | `apps/Mobile/src/app/farmer/certifications.tsx` | 6 |
| M | `apps/Mobile/src/app/farmer/devices.tsx` | 8 |
| M | `apps/Mobile/src/app/farmer/export/index.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/farms/create.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/farms/index.tsx` | 8 |
| M | `apps/Mobile/src/app/farmer/gallery.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/index.tsx` | 23 |
| M | `apps/Mobile/src/app/farmer/inventory.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/lots/index.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/notifications.tsx` | 6 |
| M | `apps/Mobile/src/app/farmer/orders/index.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/orders/invoices.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/plots/create.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/plots/index.tsx` | 6 |
| M | `apps/Mobile/src/app/farmer/productions.tsx` | 44 |
| M | `apps/Mobile/src/app/farmer/profile.tsx` | 12 |
| M | `apps/Mobile/src/app/farmer/projects/index.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/projects/new.tsx` | 8 |
| M | `apps/Mobile/src/app/farmer/public-profile.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/reviews.tsx` | 7 |
| M | `apps/Mobile/src/app/farmer/season-feedback.tsx` | 37 |
| M | `apps/Mobile/src/app/farmer/settings.tsx` | 11 |
| M | `apps/Mobile/src/app/farmer/soil.tsx` | 55 |
| M | `apps/Mobile/src/app/farmer/surveys.tsx` | 5 |
| M | `apps/Mobile/src/app/farmer/sync.tsx` | 9 |
| M | `apps/Mobile/src/app/farmer/sync/conflicts.tsx` | 6 |
| M | `apps/Mobile/src/app/farmer/transport.tsx` | 8 |
| M | `apps/Mobile/src/app/farmer/verification.tsx` | 8 |
| M | `apps/Mobile/src/app/farmers.tsx` | 11 |
| M | `apps/Mobile/src/app/insights/index.tsx` | 28 |
| M | `apps/Mobile/src/app/international/documents.tsx` | 6 |
| M | `apps/Mobile/src/app/international/index.tsx` | 15 |
| M | `apps/Mobile/src/app/international/orders.tsx` | 6 |
| M | `apps/Mobile/src/app/international/tenders.tsx` | 5 |
| M | `apps/Mobile/src/app/investment/followed.tsx` | 5 |
| M | `apps/Mobile/src/app/investment/index.tsx` | 32 |
| M | `apps/Mobile/src/app/investment/profile.tsx` | 12 |
| M | `apps/Mobile/src/app/investment/requests.tsx` | 5 |
| M | `apps/Mobile/src/app/marches.tsx` | 20 |
| M | `apps/Mobile/src/app/marketplace/index.tsx` | 32 |
| M | `apps/Mobile/src/app/marketplace/inventory.tsx` | 31 |
| M | `apps/Mobile/src/app/marketplace/new.tsx` | 16 |
| M | `apps/Mobile/src/app/messages/index.tsx` | 16 |
| M | `apps/Mobile/src/app/notifications/index.tsx` | 14 |
| M | `apps/Mobile/src/app/notifications/preferences.tsx` | 9 |
| M | `apps/Mobile/src/app/notifications/sms-consent.tsx` | 28 |
| M | `apps/Mobile/src/app/organization/create.tsx` | 8 |
| M | `apps/Mobile/src/app/organization/farms.tsx` | 8 |
| M | `apps/Mobile/src/app/organization/index.tsx` | 25 |
| M | `apps/Mobile/src/app/organization/invitations.tsx` | 7 |
| M | `apps/Mobile/src/app/organization/member-import.tsx` | 9 |
| M | `apps/Mobile/src/app/organization/members.tsx` | 9 |
| M | `apps/Mobile/src/app/organization/offers.tsx` | 6 |
| M | `apps/Mobile/src/app/organization/orders.tsx` | 6 |
| M | `apps/Mobile/src/app/organization/overview.tsx` | 40 |
| M | `apps/Mobile/src/app/organization/production-summary.tsx` | 12 |
| M | `apps/Mobile/src/app/organization/profile.tsx` | 8 |
| M | `apps/Mobile/src/app/organization/transport.tsx` | 8 |
| M | `apps/Mobile/src/app/organization/verification.tsx` | 11 |
| M | `apps/Mobile/src/app/prices/index.tsx` | 5 |
| M | `apps/Mobile/src/app/producteurs/index.tsx` | 22 |
| M | `apps/Mobile/src/app/profil.tsx` | 26 |
| M | `apps/Mobile/src/app/projets.tsx` | 21 |
| M | `apps/Mobile/src/app/projets/proposer.tsx` | 8 |
| M | `apps/Mobile/src/app/public-site/a-propos.tsx` | 14 |
| M | `apps/Mobile/src/app/public-site/actualites.tsx` | 3 |
| M | `apps/Mobile/src/app/public-site/annonces/creer.tsx` | 17 |
| M | `apps/Mobile/src/app/public-site/annonces/index.tsx` | 9 |
| M | `apps/Mobile/src/app/public-site/conditions.tsx` | 15 |
| M | `apps/Mobile/src/app/public-site/confidentialite.tsx` | 15 |
| M | `apps/Mobile/src/app/public-site/contact.tsx` | 8 |
| M | `apps/Mobile/src/app/public-site/cooperatives/index.tsx` | 5 |
| M | `apps/Mobile/src/app/public-site/country-language.tsx` | 5 |
| M | `apps/Mobile/src/app/public-site/creer-profil.tsx` | 6 |
| M | `apps/Mobile/src/app/public-site/data.tsx` | 9 |
| M | `apps/Mobile/src/app/public-site/faq.tsx` | 16 |
| M | `apps/Mobile/src/app/public-site/farmers.tsx` | 6 |
| M | `apps/Mobile/src/app/public-site/index.tsx` | 18 |
| M | `apps/Mobile/src/app/public-site/lot.tsx` | 12 |
| M | `apps/Mobile/src/app/public-site/map.tsx` | 4 |
| M | `apps/Mobile/src/app/public-site/marches.tsx` | 8 |
| M | `apps/Mobile/src/app/public-site/mentions.tsx` | 9 |
| M | `apps/Mobile/src/app/public-site/producteurs/index.tsx` | 6 |
| M | `apps/Mobile/src/app/public-site/profil.tsx` | 13 |
| M | `apps/Mobile/src/app/public-site/projects/index.tsx` | 7 |
| M | `apps/Mobile/src/app/public-site/projets.tsx` | 8 |
| M | `apps/Mobile/src/app/public-site/projets/proposer.tsx` | 9 |
| M | `apps/Mobile/src/app/public-site/services.tsx` | 6 |
| M | `apps/Mobile/src/app/public-site/sols.tsx` | 11 |
| M | `apps/Mobile/src/app/public-site/tenders.tsx` | 8 |
| M | `apps/Mobile/src/app/public-site/transporters.tsx` | 10 |
| M | `apps/Mobile/src/app/public-site/ventes/index.tsx` | 8 |
| M | `apps/Mobile/src/app/requests/index.tsx` | 28 |
| M | `apps/Mobile/src/app/requests/new.tsx` | 14 |
| M | `apps/Mobile/src/app/reviewer/index.tsx` | 37 |
| M | `apps/Mobile/src/app/reviewer/missions.tsx` | 23 |
| M | `apps/Mobile/src/app/services/index.tsx` | 8 |
| M | `apps/Mobile/src/app/tenders.tsx` | 13 |
| M | `apps/Mobile/src/app/ventes/index.tsx` | 23 |
| M | `apps/Mobile/src/app/weather.tsx` | 16 |
| M | `apps/Mobile/src/components/app/AppHeader.tsx` | 4 |
| M | `apps/Mobile/src/components/auth/AuthShell.tsx` | 3 |
| M | `apps/Mobile/src/components/farmer/FarmerHeader.tsx` | 3 |
| M | `apps/Mobile/src/components/farmer/FarmerTabBar.tsx` | 5 |
| M | `apps/Mobile/src/components/farmer/PlotScreenHeader.tsx` | 2 |
| M | `apps/Mobile/src/components/farmer/RecommendationMethod.tsx` | 6 |
| M | `apps/Mobile/src/components/farmer/SoilModule.tsx` | 50 |
| M | `apps/Mobile/src/components/public-site/FarmCard.tsx` | 3 |
| M | `apps/Mobile/src/components/public-site/home/ClosingSections.tsx` | 7 |
| M | `apps/Mobile/src/components/public-site/home/DataSections.tsx` | 31 |
| M | `apps/Mobile/src/components/public-site/home/Hero.tsx` | 10 |
| M | `apps/Mobile/src/components/public-site/home/HeroCarousel.tsx` | 32 |
| M | `apps/Mobile/src/components/public-site/home/MapAndFarmers.tsx` | 18 |
| M | `apps/Mobile/src/components/public-site/home/ServicesSection.tsx` | 12 |
| M | `apps/Mobile/src/components/public-site/home/TrustAndStats.tsx` | 12 |
| M | `apps/Mobile/src/components/public-site/home/WebHomeSections.tsx` | 94 |
| M | `apps/Mobile/src/components/public-site/Navbar.tsx` | 2 |
| M | `apps/Mobile/src/components/public-site/PublicFooter.tsx` | 16 |
| M | `apps/Mobile/src/components/public-site/PublicShell.tsx` | 7 |
| M | `apps/Mobile/src/components/ui/AppErrorBoundary.tsx` | 3 |
| M | `apps/Mobile/src/components/ui/HorizonMobile.tsx` | 2 |
| M | `apps/Mobile/src/components/ui/MapPreview.tsx` | 3 |
| M | `apps/Mobile/src/components/ui/StatCard.tsx` | 4 |
| M | `apps/Mobile/src/components/ui/States.tsx` | 1 |
| M | `apps/Mobile/src/i18n/en.ts` |  |
| M | `apps/Mobile/src/i18n/fr.ts` |  |
| M | `apps/Mobile/src/i18n/index.ts` |  |
| M | `apps/Mobile/src/lib/faq.ts` | 28 |
| M | `apps/Mobile/src/lib/format.ts` |  |
| M | `apps/Mobile/src/lib/phone.ts` | 2 |
| M | `apps/Mobile/src/lib/platform.ts` | 41 |
| M | `apps/Mobile/src/lib/service-catalog.ts` | 100 |
| M | `apps/Mobile/src/services/api/http.ts` |  |

## Backend (11 entrées)

| État | Fichier | Remplacements |
|---|---|---:|
| M | `backend/src/app.js` |  |
| M | `backend/src/integrations/email.js` |  |
| M | `backend/src/middleware/validate.js` |  |
| M | `backend/src/modules/alerts/alertLabels.js` |  |
| M | `backend/src/modules/public/public.service.js` |  |
| M | `backend/src/modules/recommendation/agronomicRanges.routes.js` |  |
| M | `backend/src/modules/verification/verification.service.js` |  |
| M | `backend/src/shared/events.js` |  |
| M | `backend/src/shared/http/errorHandler.js` |  |
| M | `backend/src/shared/http/response.js` |  |
| A | `backend/src/shared/i18n` |  |

## Autres ajouts et modifications

| État | Fichier |
|---|---|
| M | `backend/package.json` (test i18n ajouté aux suites `test`, `test:dbless`, `test:unit`) |
| A | `backend/tests/i18n.test.mjs` |
| A | `backend/docs/I18N.md` |
| A | `scripts/i18n/check-i18n.mjs` |
| A | `CORRECTIONS_I18N/` (rapport et annexes) |
