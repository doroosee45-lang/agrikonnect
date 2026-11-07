import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingState } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useEffect } from 'react';

// Lazy-loaded page modules
const Admin = lazy(() => import('@/pages/admin/Admin'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminFarmers = lazy(() => import('@/pages/admin/Farmers'));
const AdminFarms = lazy(() => import('@/pages/admin/Farms'));
const AdminPlots = lazy(() => import('@/pages/admin/Plots'));
const AdminProductions = lazy(() => import('@/pages/admin/Productions'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminUserDetail = lazy(() => import('@/pages/admin/UserDetail'));
const AdminRoles = lazy(() => import('@/pages/admin/Roles'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminMarketplace = lazy(() => import('@/pages/admin/Marketplace'));
const AdminPrices = lazy(() => import('@/pages/admin/Prices'));
const AdminCountries = lazy(() => import('@/pages/admin/Countries'));
const AdminCountryDetail = lazy(() => import('@/pages/admin/CountryDetail'));
const AdminCrops = lazy(() => import('@/pages/admin/Crops'));
const AdminCooperatives = lazy(() => import('@/pages/admin/Cooperatives'));
const AdminProjects = lazy(() => import('@/pages/admin/Projects'));
const AdminInvestors = lazy(() => import('@/pages/admin/Investors'));
const AdminVerifications = lazy(() => import('@/pages/admin/Verifications'));
const AdminModeration = lazy(() => import('@/pages/admin/Moderation'));
const AdminReports = lazy(() => import('@/pages/admin/Reports'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AuditLog'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminMonitoring = lazy(() => import('@/pages/admin/Monitoring'));
const AdminJobs = lazy(() => import('@/pages/admin/Jobs'));
const AdminSecurity = lazy(() => import('@/pages/admin/Security'));
const AdminOperations = lazy(() => import('@/pages/admin/Operations'));
const AdminNotifications = lazy(() => import('@/pages/admin/Notifications'));
const AdminSync = lazy(() => import('@/pages/admin/Sync'));
const AdminDevices = lazy(() => import('@/pages/admin/Devices'));
const AdminLots = lazy(() => import('@/pages/admin/Lots'));
const AdminProducers = lazy(() => import('@/pages/admin/Producers'));
const AdminMessages = lazy(() => import('@/pages/admin/Messages'));
const AdminApiClients = lazy(() => import('@/pages/admin/ApiClients'));
const AdminAiUsage = lazy(() => import('@/pages/admin/AiUsage'));
const AdminDataProducts = lazy(() => import('@/pages/admin/DataProducts'));
const AdminPartners = lazy(() => import('@/pages/admin/Partners'));
const AdminCompliance = lazy(() => import('@/pages/admin/Compliance'));
const AdminAgronomicRanges = lazy(() => import('@/pages/admin/AgronomicRanges'));
const AdminRules = lazy(() => import('@/pages/admin/Rules'));

const AgentConsent = lazy(() => import('@/pages/agent/Consent'));
const AgentRegistration = lazy(() => import('@/pages/agent/Registration'));

const AiAssistant = lazy(() => import('@/pages/ai/Assistant'));
const AiAnalyses = lazy(() => import('@/pages/ai/Analyses'));
const AiAnalysisDetail = lazy(() => import('@/pages/ai/AnalysisDetail'));
const AiDocuments = lazy(() => import('@/pages/ai/Documents'));

const AppDashboard = lazy(() => import('@/pages/app/Dashboard'));
const AppFarms = lazy(() => import('@/pages/app/Farms'));
const AppFarmDetail = lazy(() => import('@/pages/app/FarmDetail'));
const AppPlots = lazy(() => import('@/pages/app/Plots'));
const AppPlotDetail = lazy(() => import('@/pages/app/PlotDetail'));
const AppProductions = lazy(() => import('@/pages/app/Productions'));
const AppSoil = lazy(() => import('@/pages/app/Soil'));
const AppInventory = lazy(() => import('@/pages/app/Inventory'));
const AppOrders = lazy(() => import('@/pages/app/Orders'));
const AppOrderDetail = lazy(() => import('@/pages/app/OrderDetail'));
const AppMessages = lazy(() => import('@/pages/app/Messages'));
const AppConversation = lazy(() => import('@/pages/app/Conversation'));
const AppNotifications = lazy(() => import('@/pages/app/Notifications'));
const AppSmsConsent = lazy(() => import('@/pages/app/SmsConsent'));
const AppSeasonFeedback = lazy(() => import('@/pages/app/SeasonFeedback'));
const AppProfile = lazy(() => import('@/pages/app/Profile'));
const AppVerification = lazy(() => import('@/pages/app/Verification'));
const AppAgent = lazy(() => import('@/pages/app/Agent'));
const AppCooperative = lazy(() => import('@/pages/app/Cooperative'));
const AppCooperativeOffers = lazy(() => import('@/pages/app/CooperativeOffers'));
const AppCooperativeOrders = lazy(() => import('@/pages/app/CooperativeOrders'));
const AppInvoices = lazy(() => import('@/pages/app/Invoices'));
const AppTransport = lazy(() => import('@/pages/app/Transport'));
const AppNotFound = lazy(() => import('@/components/pages/NotFound'));

const AuthLogin = lazy(() => import('@/pages/auth/Login'));
const AuthRegister = lazy(() => import('@/pages/auth/Register'));
const AuthForgot = lazy(() => import('@/pages/auth/Forgot'));
const AuthReset = lazy(() => import('@/pages/auth/Reset'));
const AuthVerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const AuthMfa = lazy(() => import('@/pages/auth/Mfa'));
const AuthVerifyPhone = lazy(() => import('@/pages/auth/VerifyPhone'));

const DevelopersHome = lazy(() => import('@/pages/developers/index'));
const DevelopersKeys = lazy(() => import('@/pages/developers/Keys'));
const DevelopersUsage = lazy(() => import('@/pages/developers/Usage'));
const DevelopersDocs = lazy(() => import('@/pages/developers/Docs'));

const FarmerHome = lazy(() => import('@/pages/farmer/index'));
const FarmerProfile = lazy(() => import('@/pages/farmer/Profile'));
const FarmerPublicProfile = lazy(() => import('@/pages/farmer/PublicProfile'));
const FarmerSettings = lazy(() => import('@/pages/farmer/Settings'));
const FarmerAlerts = lazy(() => import('@/pages/farmer/Alerts'));
const FarmerFarms = lazy(() => import('@/pages/farmer/Farms/index'));
const FarmerFarmCreate = lazy(() => import('@/pages/farmer/Farms/Create'));
const FarmerFarmDetail = lazy(() => import('@/pages/farmer/Farms/Detail'));
const FarmerPlots = lazy(() => import('@/pages/farmer/Plots/index'));
const FarmerPlotCreate = lazy(() => import('@/pages/farmer/Plots/Create'));
const FarmerPlotDetail = lazy(() => import('@/pages/farmer/Plots/Detail'));
const FarmerPlotSoil = lazy(() => import('@/pages/farmer/Plots/Soil'));
const FarmerPlotRecommendations = lazy(() => import('@/pages/farmer/Plots/Recommendations'));
const FarmerPlotRotation = lazy(() => import('@/pages/farmer/Plots/Rotation'));
const FarmerPlotPlan = lazy(() => import('@/pages/farmer/Plots/Plan'));
const FarmerPlotPrecisionReport = lazy(() => import('@/pages/farmer/Plots/PrecisionReport'));
const FarmerPlotZones = lazy(() => import('@/pages/farmer/Plots/Zones'));
const FarmerPlotSensors = lazy(() => import('@/pages/farmer/Plots/Sensors'));
const FarmerPlotSatellite = lazy(() => import('@/pages/farmer/Plots/Satellite'));
const FarmerProductions = lazy(() => import('@/pages/farmer/Productions'));
const FarmerSoil = lazy(() => import('@/pages/farmer/Soil'));
const FarmerLots = lazy(() => import('@/pages/farmer/Lots/index'));
const FarmerLotDetail = lazy(() => import('@/pages/farmer/Lots/Detail'));
const FarmerExport = lazy(() => import('@/pages/farmer/Export/index'));
const FarmerExportDetail = lazy(() => import('@/pages/farmer/Export/Detail'));
const FarmerExportDocuments = lazy(() => import('@/pages/farmer/Export/Documents'));
const FarmerProjects = lazy(() => import('@/pages/farmer/Projects/index'));
const FarmerProjectCreate = lazy(() => import('@/pages/farmer/Projects/Create'));
const FarmerProjectDetail = lazy(() => import('@/pages/farmer/Projects/Detail'));
const FarmerProjectDataRoom = lazy(() => import('@/pages/farmer/Projects/DataRoom'));
const FarmerProjectReports = lazy(() => import('@/pages/farmer/Projects/Reports'));
const FarmerProjectAccessLog = lazy(() => import('@/pages/farmer/Projects/AccessLog'));
const FarmerCertifications = lazy(() => import('@/pages/farmer/Certifications'));
const FarmerDevices = lazy(() => import('@/pages/farmer/Devices'));
const FarmerSurveys = lazy(() => import('@/pages/farmer/Surveys'));
const FarmerSyncStatus = lazy(() => import('@/pages/farmer/SyncStatus'));
const FarmerVerification = lazy(() => import('@/pages/farmer/Verification'));
const FarmerConflictResolution = lazy(() => import('@/pages/farmer/ConflictResolution'));
const FarmerGallery = lazy(() => import('@/pages/farmer/Gallery'));

const InsightsHome = lazy(() => import('@/pages/insights/index'));
const InsightsRegion = lazy(() => import('@/pages/insights/Region'));

const InternationalTenders = lazy(() => import('@/pages/international/Tenders'));
const InternationalOrders = lazy(() => import('@/pages/international/Orders'));
const InternationalDocuments = lazy(() => import('@/pages/international/Documents'));

const InvestmentHome = lazy(() => import('@/pages/investment/index'));
const InvestmentProfile = lazy(() => import('@/pages/investment/Profile'));
const InvestmentFollowedProjects = lazy(() => import('@/pages/investment/FollowedProjects'));
const InvestmentRequests = lazy(() => import('@/pages/investment/Requests'));
const InvestmentProjectDetail = lazy(() => import('@/pages/investment/ProjectDetail'));

const MarketPublic = lazy(() => import('@/pages/market/MarketPublic'));
const MarketListingDetail = lazy(() => import('@/pages/market/ListingDetail'));
const MarketNewListing = lazy(() => import('@/pages/market/NewListing'));
const MarketRequests = lazy(() => import('@/pages/market/Requests'));
const MarketNewRequest = lazy(() => import('@/pages/market/NewRequest'));
const MarketRequestMatches = lazy(() => import('@/pages/market/RequestMatches'));
const MarketReviews = lazy(() => import('@/pages/market/Reviews'));
const MarketTransporters = lazy(() => import('@/pages/market/Transporters'));
const MarketApp = lazy(() => import('@/pages/market/MarketApp'));

const OrganizationHome = lazy(() => import('@/pages/organization/index'));
const OrganizationOverview = lazy(() => import('@/pages/organization/Overview'));
const OrganizationProfile = lazy(() => import('@/pages/organization/Profile'));
const OrganizationMembers = lazy(() => import('@/pages/organization/Members'));
const OrganizationInvitations = lazy(() => import('@/pages/organization/Invitations'));
const OrganizationMemberImport = lazy(() => import('@/pages/organization/MemberImport'));
const OrganizationFarms = lazy(() => import('@/pages/organization/Farms'));
const OrganizationProductionSummary = lazy(() => import('@/pages/organization/ProductionSummary'));
const OrganizationVerification = lazy(() => import('@/pages/organization/Verification'));

const PublicHome = lazy(() => import('@/pages/public/Home'));
const PublicServices = lazy(() => import('@/pages/public/Services'));
const PublicAbout = lazy(() => import('@/pages/public/About'));
const PublicServiceDetail = lazy(() => import('@/pages/public/ServiceDetail'));
const PublicFarmers = lazy(() => import('@/pages/public/Farmers'));
const PublicFarmProfile = lazy(() => import('@/pages/public/FarmProfile'));
const PublicLotProfile = lazy(() => import('@/pages/public/LotProfile'));
const PublicMapPage = lazy(() => import('@/pages/public/MapPage'));
const PublicCooperatives = lazy(() => import('@/pages/public/Cooperatives'));
const PublicCooperativeProfile = lazy(() => import('@/pages/public/CooperativeProfile'));
const PublicProjects = lazy(() => import('@/pages/public/Projects'));
const PublicProjectProfile = lazy(() => import('@/pages/public/ProjectProfile'));
const PublicTenders = lazy(() => import('@/pages/public/Tenders'));
const PublicDataCatalog = lazy(() => import('@/pages/public/DataCatalog'));
const PublicAgricultureCountry = lazy(() => import('@/pages/public/AgricultureCountry'));
const PublicCountryLanguageSelector = lazy(() => import('@/pages/public/CountryLanguageSelector'));
const PublicLegal = lazy(() => import('@/pages/public/Legal'));

const ReviewerMissions = lazy(() => import('@/pages/reviewer/Missions'));
const ReviewerChecklist = lazy(() => import('@/pages/reviewer/Checklist'));

const CropPrices = lazy(() => import('@/pages/CropPrices'));
const Prices = lazy(() => import('@/pages/Prices'));
const Weather = lazy(() => import('@/pages/Weather'));

function App() {
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense fallback={<div style={{ padding: 48 }}><LoadingState count={2} height={120} /></div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/services" element={<PublicServices />} />
            <Route path="/a-propos" element={<PublicAbout />} />
            <Route path="/services/:serviceId" element={<PublicServiceDetail />} />
            <Route path="/public/farmers" element={<PublicFarmers />} />
            <Route path="/public/farms/:slug" element={<PublicFarmProfile />} />
            <Route path="/public/lots/:code" element={<PublicLotProfile />} />
            <Route path="/public/map" element={<PublicMapPage />} />
            <Route path="/public/cooperatives" element={<PublicCooperatives />} />
            <Route path="/public/cooperatives/:slug" element={<PublicCooperativeProfile />} />
            <Route path="/public/projects" element={<PublicProjects />} />
            <Route path="/public/projects/:id" element={<PublicProjectProfile />} />
            <Route path="/public/tenders" element={<PublicTenders />} />
            <Route path="/public/data" element={<PublicDataCatalog />} />
            <Route path="/public/agriculture/:countryCode" element={<PublicAgricultureCountry />} />
            <Route path="/public/country-language" element={<PublicCountryLanguageSelector />} />
            <Route path="/public/legal" element={<PublicLegal />} />

            {/* Auth routes */}
            <Route path="/auth/login" element={<AuthLogin />} />
            <Route path="/auth/register" element={<AuthRegister />} />
            <Route path="/auth/forgot" element={<AuthForgot />} />
            <Route path="/auth/reset" element={<AuthReset />} />
            <Route path="/auth/verify-email" element={<AuthVerifyEmail />} />
            <Route path="/auth/mfa" element={<AuthMfa />} />
            <Route path="/auth/verify-phone" element={<AuthVerifyPhone />} />

            {/* Admin routes */}
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/farmers" element={<AdminFarmers />} />
            <Route path="/admin/farms" element={<AdminFarms />} />
            <Route path="/admin/plots" element={<AdminPlots />} />
            <Route path="/admin/productions" element={<AdminProductions />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/:id" element={<AdminUserDetail />} />
            <Route path="/admin/roles" element={<AdminRoles />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/marketplace" element={<AdminMarketplace />} />
            <Route path="/admin/prices" element={<AdminPrices />} />
            <Route path="/admin/countries" element={<AdminCountries />} />
            <Route path="/admin/countries/:code" element={<AdminCountryDetail />} />
            <Route path="/admin/crops" element={<AdminCrops />} />
            <Route path="/admin/cooperatives" element={<AdminCooperatives />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/investors" element={<AdminInvestors />} />
            <Route path="/admin/verifications" element={<AdminVerifications />} />
            <Route path="/admin/moderation" element={<AdminModeration />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/audit" element={<AdminAuditLog />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/monitoring" element={<AdminMonitoring />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/operations" element={<AdminOperations />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/sync" element={<AdminSync />} />
            <Route path="/admin/devices" element={<AdminDevices />} />
            <Route path="/admin/lots" element={<AdminLots />} />
            <Route path="/admin/producers" element={<AdminProducers />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/api-clients" element={<AdminApiClients />} />
            <Route path="/admin/ai-usage" element={<AdminAiUsage />} />
            <Route path="/admin/data-products" element={<AdminDataProducts />} />
            <Route path="/admin/partners" element={<AdminPartners />} />
            <Route path="/admin/compliance" element={<AdminCompliance />} />
            <Route path="/admin/agronomic-ranges" element={<AdminAgronomicRanges />} />
            <Route path="/admin/rules" element={<AdminRules />} />

            {/* Agent routes */}
            <Route path="/agent/consent" element={<AgentConsent />} />
            <Route path="/agent/registration" element={<AgentRegistration />} />

            {/* AI routes */}
            <Route path="/ai/assistant" element={<AiAssistant />} />
            <Route path="/ai/analyses" element={<AiAnalyses />} />
            <Route path="/ai/analyses/:id" element={<AiAnalysisDetail />} />
            <Route path="/ai/documents" element={<AiDocuments />} />

            {/* App routes (authenticated) */}
            <Route path="/app" element={<AppDashboard />} />
            <Route path="/app/farms" element={<AppFarms />} />
            <Route path="/app/farms/:id" element={<AppFarmDetail />} />
            <Route path="/app/plots" element={<AppPlots />} />
            <Route path="/app/plots/:id" element={<AppPlotDetail />} />
            <Route path="/app/productions" element={<AppProductions />} />
            <Route path="/app/soil" element={<AppSoil />} />
            <Route path="/app/inventory" element={<AppInventory />} />
            <Route path="/app/orders" element={<AppOrders />} />
            <Route path="/app/orders/:id" element={<AppOrderDetail />} />
            <Route path="/app/messages" element={<AppMessages />} />
            <Route path="/app/messages/:id" element={<AppConversation />} />
            <Route path="/app/notifications" element={<AppNotifications />} />
            <Route path="/app/sms-consent" element={<AppSmsConsent />} />
            <Route path="/app/season-feedback" element={<AppSeasonFeedback />} />
            <Route path="/app/profile" element={<AppProfile />} />
            <Route path="/app/verification" element={<AppVerification />} />
            <Route path="/app/agent" element={<AppAgent />} />
            <Route path="/app/cooperative" element={<AppCooperative />} />
            <Route path="/app/cooperative/offers" element={<AppCooperativeOffers />} />
            <Route path="/app/cooperative/orders" element={<AppCooperativeOrders />} />
            <Route path="/app/invoices" element={<AppInvoices />} />
            <Route path="/app/transport" element={<AppTransport />} />

            {/* Developer routes */}
            <Route path="/developers" element={<DevelopersHome />} />
            <Route path="/developers/keys" element={<DevelopersKeys />} />
            <Route path="/developers/usage" element={<DevelopersUsage />} />
            <Route path="/developers/docs" element={<DevelopersDocs />} />

            {/* Farmer routes */}
            <Route path="/farmer" element={<FarmerHome />} />
            <Route path="/farmer/profile" element={<FarmerProfile />} />
            <Route path="/farmer/public-profile" element={<FarmerPublicProfile />} />
            <Route path="/farmer/settings" element={<FarmerSettings />} />
            <Route path="/farmer/alerts" element={<FarmerAlerts />} />
            <Route path="/farmer/farms" element={<FarmerFarms />} />
            <Route path="/farmer/farms/create" element={<FarmerFarmCreate />} />
            <Route path="/farmer/farms/:id" element={<FarmerFarmDetail />} />
            <Route path="/farmer/plots" element={<FarmerPlots />} />
            <Route path="/farmer/plots/create" element={<FarmerPlotCreate />} />
            <Route path="/farmer/plots/:id" element={<FarmerPlotDetail />} />
            <Route path="/farmer/plots/:id/soil" element={<FarmerPlotSoil />} />
            <Route path="/farmer/plots/:id/recommendations" element={<FarmerPlotRecommendations />} />
            <Route path="/farmer/plots/:id/rotation" element={<FarmerPlotRotation />} />
            <Route path="/farmer/plots/:id/plan" element={<FarmerPlotPlan />} />
            <Route path="/farmer/plots/:id/precision-report" element={<FarmerPlotPrecisionReport />} />
            <Route path="/farmer/plots/:id/zones" element={<FarmerPlotZones />} />
            <Route path="/farmer/plots/:id/sensors" element={<FarmerPlotSensors />} />
            <Route path="/farmer/plots/:id/satellite" element={<FarmerPlotSatellite />} />
            <Route path="/farmer/productions" element={<FarmerProductions />} />
            <Route path="/farmer/soil" element={<FarmerSoil />} />
            <Route path="/farmer/lots" element={<FarmerLots />} />
            <Route path="/farmer/lots/:id" element={<FarmerLotDetail />} />
            <Route path="/farmer/export" element={<FarmerExport />} />
            <Route path="/farmer/export/:id" element={<FarmerExportDetail />} />
            <Route path="/farmer/export/:id/documents" element={<FarmerExportDocuments />} />
            <Route path="/farmer/projects" element={<FarmerProjects />} />
            <Route path="/farmer/projects/create" element={<FarmerProjectCreate />} />
            <Route path="/farmer/projects/:id" element={<FarmerProjectDetail />} />
            <Route path="/farmer/projects/:id/dataroom" element={<FarmerProjectDataRoom />} />
            <Route path="/farmer/projects/:id/reports" element={<FarmerProjectReports />} />
            <Route path="/farmer/projects/:id/access" element={<FarmerProjectAccessLog />} />
            <Route path="/farmer/certifications" element={<FarmerCertifications />} />
            <Route path="/farmer/devices" element={<FarmerDevices />} />
            <Route path="/farmer/surveys" element={<FarmerSurveys />} />
            <Route path="/farmer/sync" element={<FarmerSyncStatus />} />
            <Route path="/farmer/verification" element={<FarmerVerification />} />
            <Route path="/farmer/conflicts" element={<FarmerConflictResolution />} />
            <Route path="/farmer/gallery" element={<FarmerGallery />} />

            {/* Insights routes */}
            <Route path="/insights" element={<InsightsHome />} />
            <Route path="/insights/:region" element={<InsightsRegion />} />

            {/* International routes */}
            <Route path="/international/tenders" element={<InternationalTenders />} />
            <Route path="/international/orders" element={<InternationalOrders />} />
            <Route path="/international/documents" element={<InternationalDocuments />} />

            {/* Investment routes */}
            <Route path="/investment" element={<InvestmentHome />} />
            <Route path="/investment/profile" element={<InvestmentProfile />} />
            <Route path="/investment/projects" element={<InvestmentFollowedProjects />} />
            <Route path="/investment/projects/:id" element={<InvestmentProjectDetail />} />
            <Route path="/investment/requests" element={<InvestmentRequests />} />

            {/* Market routes */}
            <Route path="/market" element={<MarketPublic />} />
            <Route path="/market/listings" element={<MarketPublic />} />
            <Route path="/market/listings/:id" element={<MarketListingDetail />} />
            <Route path="/market/listings/new" element={<MarketNewListing />} />
            <Route path="/market/requests" element={<MarketRequests />} />
            <Route path="/market/requests/new" element={<MarketNewRequest />} />
            <Route path="/market/requests/:id/matches" element={<MarketRequestMatches />} />
            <Route path="/market/reviews" element={<MarketReviews />} />
            <Route path="/market/transporters" element={<MarketTransporters />} />
            <Route path="/market/app" element={<MarketApp />} />

            {/* Organization routes */}
            <Route path="/organization" element={<OrganizationHome />} />
            <Route path="/organization/overview" element={<OrganizationOverview />} />
            <Route path="/organization/profile" element={<OrganizationProfile />} />
            <Route path="/organization/members" element={<OrganizationMembers />} />
            <Route path="/organization/invitations" element={<OrganizationInvitations />} />
            <Route path="/organization/import" element={<OrganizationMemberImport />} />
            <Route path="/organization/farms" element={<OrganizationFarms />} />
            <Route path="/organization/production" element={<OrganizationProductionSummary />} />
            <Route path="/organization/verification" element={<OrganizationVerification />} />

            {/* Reviewer routes */}
            <Route path="/reviewer/missions" element={<ReviewerMissions />} />
            <Route path="/reviewer/missions/:id" element={<ReviewerChecklist />} />

            {/* Standalone data routes */}
            <Route path="/prices" element={<Prices />} />
            <Route path="/crop-prices" element={<CropPrices />} />
            <Route path="/weather" element={<Weather />} />

            {/* Catch-all */}
            <Route path="*" element={<AppNotFound />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
