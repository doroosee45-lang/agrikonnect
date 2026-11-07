import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import organizationsRoutes from '../modules/organizations/organizations.routes.js';
import cropsRoutes from '../modules/crops/crops.routes.js';
import farmsRoutes from '../modules/farms/farms.routes.js';
import plotsRoutes from '../modules/plots/plots.routes.js';
import soilRoutes from '../modules/soil/soil.routes.js';
import geospatialRoutes, { plotsRouter as geospatialPlotsRoutes } from '../modules/geospatial/geospatial.routes.js';
import interpolationRoutes from '../modules/geospatial/interpolation.routes.js';
import satelliteRoutes from '../modules/satellite/acquisition.routes.js';
import anomalyRoutes from '../modules/anomalies/anomalies.routes.js';
import recommendationRoutes, { plotsRouter as recommendationPlotsRoutes } from '../modules/recommendation/recommendation.routes.js';
import agronomicRangesRoutes from '../modules/recommendation/agronomicRanges.routes.js';
import smsDeliveryRoutes, { twilioWebhookRouter } from '../modules/smsDelivery/smsDelivery.routes.js';
import alertsRoutes from '../modules/alerts/alerts.routes.js';
import forecastRoutes from '../modules/forecast/forecast.routes.js';
import modelVersionsRoutes from '../modules/ai/modelVersions.routes.js';
import rulesetRoutes from '../modules/soil/rulesets.routes.js';
import productionsRoutes from '../modules/productions/productions.routes.js';
import seasonsRoutes from '../modules/seasons/seasons.routes.js';
import geospatialImportRoutes from '../modules/geospatialImport/geospatialImport.routes.js';
import cooperativesRoutes from '../modules/cooperatives/cooperatives.routes.js';
import mediaRoutes from '../modules/media/media.routes.js';
import verificationRoutes, { adminRouter as adminVerificationRoutes } from '../modules/verification/verification.routes.js';
import reportsRoutes, { adminRouter as adminReportRoutes } from '../modules/reports/reports.routes.js';
import publicRoutes from '../modules/public/public.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import countriesRoutes from '../modules/countries/countries.routes.js';

// ─── V2 MARKET ────────────────────────────────────────────────
import listingsRoutes from '../modules/market/listings/listings.routes.js';
import requestsRoutes from '../modules/market/requests/requests.routes.js';
import offersRoutes from '../modules/market/offers/offers.routes.js';
import ordersRoutes from '../modules/market/orders/orders.routes.js';
import inventoryRoutes from '../modules/market/inventory/inventory.routes.js';
import reviewsRoutes from '../modules/market/reviews/reviews.routes.js';
import transportRoutes from '../modules/transport/transport.routes.js';
import messagingRoutes from '../modules/messaging/messaging.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import channelsWebhookRoutes, { adminRouter as adminChannelRoutes } from '../modules/channels/channels.routes.js';
import investmentHubRoutes from '../modules/investors/hub.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';

// ─── V3 INTELLIGENCE ──────────────────────────────────────────
import syncRoutes from '../modules/sync/sync.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import weatherRoutes from '../modules/weather/weather.routes.js';
import pricesRoutes from '../modules/prices/prices.routes.js';
import traceabilityRoutes from '../modules/traceability/traceability.routes.js';
import publicLotsRoutes from '../modules/traceability/public.routes.js';
import certificationsRoutes from '../modules/certifications/certifications.routes.js';
import iotRoutes from '../modules/iot/iot.routes.js';
import geodataRoutes from '../modules/geodata/geodata.routes.js';

// ─── V4 INVEST ────────────────────────────────────────────────
import projectsRoutes from '../modules/projects/projects.routes.js';
import dataroomRoutes from '../modules/dataroom/dataroom.routes.js';
import dueDiligenceRoutes from '../modules/duediligence/duediligence.routes.js';
import reportingRoutes from '../modules/reporting/reporting.routes.js';
import fundingRoutes from '../modules/funding/funding.routes.js';
import investorsRoutes from '../modules/investors/investors.routes.js';
import precisionRoutes from '../modules/precision/precision.routes.js';
import investDashboardRoutes from '../modules/investdashboard/dashboard.routes.js';

// ─── V5 GLOBAL ────────────────────────────────────────────────
import tendersRoutes from '../modules/tenders/tenders.routes.js';
import exportsRoutes from '../modules/exports/exports.routes.js';
import apiClientsRoutes from '../modules/apiclients/apiclients.routes.js';
import dataProductsRoutes from '../modules/dataproducts/dataproducts.routes.js';
import insightsRoutes from '../modules/insights/insights.routes.js';
import publicApiRoutes, { dataAliasRouter } from '../modules/publicapi/publicapi.routes.js';

const router = Router();

/** Healthcheck — monitoring et tests de disponibilité (NFR-07). */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Public (aucune authentification) ─────────────────────────
router.use('/public', publicRoutes);
router.use('/public', publicLotsRoutes); // fiche lot via QR — publicFields uniquement
router.use('/countries', countriesRoutes);
// ─── API publique de données — clé d'API (V5) ─────────────────
router.use('/public-api/v1', publicApiRoutes);

// ─── Authentification ─────────────────────────────────────────
router.use('/auth', authRoutes);

// ─── Espace connecté — V1 FARM ────────────────────────────────
router.use('/me', usersRoutes);
router.use('/organizations', organizationsRoutes);
router.use('/crops', cropsRoutes);
router.use('/farms', farmsRoutes);
router.use('/plots', plotsRoutes);
router.use('/plots', soilRoutes); // Soil S1 : /plots/:id/soil-assessments
router.use('/plots', geospatialPlotsRoutes); // S3 : /plots/:id/soil-diagnosis (moteur Python)
// Recommandation culturale (quoi semer sur une période) — RDC, Équateur/Bandundu.
router.use('/plots', recommendationPlotsRoutes);
router.use('/recommendations', recommendationRoutes);
// Référentiel agronomique : lecture large (tout le monde doit pouvoir vérifier
// sur quelle base une recommandation a été calculée), écriture admin/agronome.
router.use('/agronomic-ranges', agronomicRangesRoutes);
/**
 * SMS — consentement, suivi de remise, et webhook Twilio.
 *
 * Le webhook est monté **hors** de l'authentification par jeton : Twilio n'en a
 * pas. Son authentification est la signature de la requête, vérifiée dans le
 * routeur lui-même.
 */
router.use('/sms', smsDeliveryRoutes);
router.use('/webhooks/twilio', twilioWebhookRouter);
// Surveillance : alertes de seuil, prévisions défavorables, capteurs silencieux.
router.use('/alerts', alertsRoutes);
// Prévision des paramètres du sol (moteur Python) et gouvernance des modèles.
router.use('/plots', forecastRoutes);
router.use('/ai/models', modelVersionsRoutes);
router.use('/productions', productionsRoutes);
router.use('/seasons', seasonsRoutes); // retours de saison : rendement réel
// Dépôt de fichiers géoradar / drone. Réception uniquement : aucun traitement
// du contenu n'est effectué ici (statut `RECEIVED` seul).
router.use('/geospatial/imports', geospatialImportRoutes);
router.use('/cooperatives', cooperativesRoutes);
router.use('/media', mediaRoutes);
router.use('/dashboard', dashboardRoutes);
// Cartes interpolées (krigeage) : montage avant '/geospatial', plus spécifique.
router.use('/geospatial/interpolations', interpolationRoutes);
router.use('/satellite', satelliteRoutes); // acquisition satellite programmée
router.use('/anomalies', anomalyRoutes); // anomalies de mesure et revue agronome
router.use('/geospatial', geospatialRoutes); // moteur géospatial & pédologique (Python)
router.use('/verifications', verificationRoutes);
router.use('/reports', reportsRoutes);

// ─── V2 MARKET ────────────────────────────────────────────────
router.use('/listings', listingsRoutes);
router.use('/purchase-requests', requestsRoutes);
router.use('/market', offersRoutes);          // offres liées aux demandes
router.use('/orders', ordersRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/', reviewsRoutes);        // /orders/:id/reviews, /reviews/:id/…, /organizations/:id/reputation
router.use('/transport', transportRoutes);
router.use('/messaging', messagingRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/billing', billingRoutes);

// ─── V3 INTELLIGENCE ──────────────────────────────────────────
router.use('/sync', syncRoutes);
router.use('/ai', aiRoutes);
router.use('/weather', weatherRoutes);
router.use('/prices', pricesRoutes);
router.use('/lots', traceabilityRoutes);
router.use('/certifications', certificationsRoutes);
router.use('/iot', iotRoutes);
router.use('/geodata', geodataRoutes);

// ─── V4 INVEST ────────────────────────────────────────────────
router.use('/projects', projectsRoutes);
router.use('/dataroom', dataroomRoutes);
router.use('/', dueDiligenceRoutes);   // /projects/:id/due-diligence, /due-diligence/:id
router.use('/', reportingRoutes);      // /projects/:id/reports|progress-reports|impact-reports
router.use('/funding', fundingRoutes);
router.use('/investors', investorsRoutes);
router.use('/precision', precisionRoutes);
router.use('/invest', investDashboardRoutes);

// ─── V5 GLOBAL ────────────────────────────────────────────────
router.use('/tenders', tendersRoutes);
router.use('/exports', exportsRoutes);
router.use('/api-clients', apiClientsRoutes);
router.use('/data', dataProductsRoutes);
router.use('/insights', insightsRoutes);

// ─── Administration & modération ──────────────────────────────
router.use('/admin/verifications', adminVerificationRoutes);
router.use('/admin', rulesetRoutes);
router.use('/admin/channels', adminChannelRoutes);
router.use('/channels', channelsWebhookRoutes);
router.use('/investment', investmentHubRoutes);
router.use('/admin/reports', adminReportRoutes);
router.use('/admin', adminRoutes);

// ─── V5 §6 — chemins normalisés exigés par le CDC ─────────────
// Monté en dernier : les routes existantes (/crops, /projects…) gardent la
// priorité ; l'alias n'ajoute que les jeux de données absents (mêmes handlers,
// même clé d'API).
router.use('/', dataAliasRouter);

export default router;
