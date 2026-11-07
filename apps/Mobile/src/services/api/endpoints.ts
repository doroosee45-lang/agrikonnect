import { API_BASE_URL } from '@/lib/config';

import { api, cleanQuery, http } from './http';
import {
  type AiAnalysis,
  type ApiClient,
  type ApiKeyCreated,
  type ApiKeyItem,
  type ApiUsageResult,
  type Certification,
  type Conversation,
  type ConversationListResult,
  type ConversationSubject,
  type ConversationThreadResult,
  type Cooperative,
  type CooperativeMember,
  type CooperativeOverview,
  type Dispute,
  type ExportDocumentRow,
  type ExportOrderDetail,
  type ExportOrderList,
  type ExportOrderRow,
  type FundingRequest,
  type ImpactReport,
  type InventoryItem,
  type InventoryMovement,
  type Listing,
  type Membership,
  type MessageItem,
  type Offer,
  type Order,
  type OrderEvent,
  type OrganizationSummary,
  type ProgressReport,
  type Project,
  type PurchaseRequest,
  type ReputationResult,
  type Review,
  type TransportRequest,
  type Verification,
  type ContactFarmPayload,
  type Crop,
  type CropHistoryResult,
  type Farm,
  type LoginPayload,
  type LoginResult,
  type ManagementZoneComputed,
  type ManagementZoneList,
  type InsightsActivity,
  type InsightsCrops,
  type InsightsDisclosurePolicy,
  type InsightsOverview,
  type IotDevice,
  type IotDeviceList,
  type IotDeviceRecord,
  type IotDeviceRegistered,
  type IotKeyRotated,
  type IotReadingsResult,
  type MapResult,
  type NotificationChannel,
  type NotificationItem,
  type NotificationListResult,
  type NotificationPreference,
  type SeasonFeedback,
  type SeasonFeedbackComparison,
  type SeasonFeedbackStats,
  type SmsConsent,
  type SmsConsentListResult,
  type NotificationPreferencesResult,
  type MarketPrice,
  type MeResult,
  type PageQuery,
  type PermissionsResult,
  type PrecisionReportCreated,
  type PrecisionReportList,
  type PrecisionReportValidated,
  type Plot,
  type PlotDetail,
  type PriceListResult,
  type PriceSeriesResult,
  type Production,
  type ProductionCreated,
  type ProductionStats,
  type PublicFarmListItem,
  type PublicFarmPage,
  type PublicLot,
  type RegisterPayload,
  type RegisterResult,
  type Session,
  type SoilAssessment,
  type SoilAssessmentList,
  type GeospatialHealth,
  type SoilDiagnosisComputed,
  type SoilDiagnosisLatest,
  type SoilDiagnosticList,
  type SoilProfileResult,
  type Suitability,
  type SuitabilityList,
  type RotationPlan,
  type RotationPlanList,
  type FarmingPlan,
  type FarmingPlanList,
  type YieldEstimate,
  type YieldEstimateList,
  type SoilStatsResult,
  type SyncCollectionsResult,
  type SyncConflictsResult,
  type SyncPullResult,
  type SatelliteSettings,
  type SatelliteObservationList,
  type SatelliteAcquisition,
  type RecommendationList,
  type RecommendationCreated,
  type RecommendationExplanation,
  type CropRecommendation,
  type RecommendationDecision,
  type AlertList,
  type AlertStatus,
  type AlertSourceType,
  type AlertFilterMeta,
  type DescribedAlert,
  type AnomalySettings,
  type AnomalyStatus,
  type AnomalyDetectionResult,
  type AnomalyReviewResult,
  type SensorAnomaly,
  type AgronomicRangeList,
  type AgronomicRangeMeta,
  type AgronomicRangeImportTemplate,
  type AgronomicRangeImportResult,
  type CropAgronomicRange,
  type RangeStatus,
  type RangeSourceType,
  type RangeParameterKey,
  type Tender,
  type TenderListResult,
  type WeatherForPlot,
} from './types';

/**
 * Cartographie des endpoints consommés par l'application.
 *
 * Chaque chemin est recopié du routeur Express correspondant
 * (`backend/src/routes/index.js` + `modules/<module>/<module>.routes.js`). Deux
 * familles se distinguent volontairement :
 * - `public.*` → `anonymous: true`, aucune session (routes `/public/*`) ;
 * - le reste → Bearer requis ; l'UI doit gérer l'état « connexion requise ».
 */

// ─── Public (aucune authentification) ─────────────────────────

export const publicApi = {
  /** MAP-01→04 — carte par emprise, positions approximatives. */
  map: (params: { bbox?: string; countryCode?: string; province?: string; cropId?: string; locale?: string; limit?: number } = {}) =>
    api.get<MapResult>('/public/map', { params: cleanQuery(params), anonymous: true }),

  /** PUB-01 — annuaire paginé (data = items, meta = pagination). */
  farms: (params: PageQuery = {}) =>
    api.get<PublicFarmListItem[]>('/public/farms', { params: cleanQuery(params), anonymous: true }),

  farm: (slug: string) =>
    api.get<PublicFarmPage>(`/public/farms/${encodeURIComponent(slug)}`, { anonymous: true }),

  /** PUB-06 — contact sans révéler les coordonnées. */
  contactFarm: (slug: string, payload: ContactFarmPayload) =>
    api.post<{ sent: boolean; message: string }>(
      `/public/farms/${encodeURIComponent(slug)}/contact`,
      payload,
      { anonymous: true, idempotent: true },
    ),

  /** SOIL-16 — statistiques agrégées, k-anonymat ≥ 10. */
  soilStats: (params: { countryCode?: string; parameter?: string } = {}) =>
    api.get<SoilStatsResult>('/public/soil-stats', { params: cleanQuery(params), anonymous: true }),

  /** TRC-03 — fiche publique de lot (QR). */
  lot: (code: string) =>
    api.get<PublicLot>(`/public/lots/${encodeURIComponent(code)}`, { anonymous: true }),

  /** PUB-03 — QR du profil, rendu serveur (URL à charger directement). */
  farmQrUrl: (slug: string, format: 'png' | 'svg' = 'png', size = 512) =>
    `${API_BASE_URL}/public/farms/${encodeURIComponent(slug)}/qr.${format}?size=${size}`,

  health: () =>
    api.get<{ status: string; version: string; uptime: number; timestamp: string }>('/health', {
      anonymous: true,
      skipAuthRefresh: true,
    }),
};

// ─── Auth ─────────────────────────────────────────────────────

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResult>('/auth/login', payload, { anonymous: true, skipAuthRefresh: true, idempotent: true }),

  register: (payload: RegisterPayload) =>
    api.post<RegisterResult>('/auth/register', payload, { anonymous: true, skipAuthRefresh: true, idempotent: true }),

  /** AUTH-05 — refresh rotatif : les deux jetons changent à chaque appel. */
  refresh: (refreshToken: string) =>
    api.post<{ session: Session }>('/auth/refresh', { refreshToken }, { anonymous: true, skipAuthRefresh: true }),

  logout: () => api.post<{ success: true }>('/auth/logout', {}, { idempotent: true }),

  /** PROF-01 — renvoie `{ user, completeness, counts, activeOrganizationId }`. */
  me: () => api.get<MeResult>('/me'),
  updateMe: (payload: Record<string, unknown>) => api.patch<MeResult>('/me', payload),
  permissions: () => api.get<PermissionsResult>('/me/permissions'),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.post<{ updated: true }>('/me/password', payload, { idempotent: true }),

  forgotPassword: (identifier: string) =>
    api.post<{ sent: boolean }>('/auth/forgot-password', { identifier }, { anonymous: true, skipAuthRefresh: true }),
  resetPassword: (payload: { token: string; password: string }) =>
    api.post<{ reset: boolean }>('/auth/reset-password', payload, { anonymous: true, skipAuthRefresh: true }),
  resendVerification: (email: string) =>
    api.post<{ sent: boolean }>('/auth/resend-verification', { email }, { skipAuthRefresh: true }),
  /**
   * Vérification de l'adresse e-mail par le jeton reçu.
   *
   * `anonymous` : l'utilisateur n'est pas encore vérifié, et le jeton **est** la
   * preuve — exiger une session ici rendrait la vérification impossible depuis
   * le lien reçu par e-mail.
   */
  verifyEmail: (tokenHash: string) =>
    api.post<{ verified: boolean }>('/auth/verify-email', { tokenHash }, { anonymous: true, skipAuthRefresh: true }),

  // V4 NFR-01 — double authentification TOTP
  mfaStatus: () => api.get<{ enabled: boolean; method: string | null }>('/auth/mfa/status'),
  /**
   * `qrDataUri` est généré côté serveur : il permet d'ajouter le compte à une
   * application d'authentification **sans afficher le secret en clair**.
   */
  mfaSetup: () =>
    api.post<{
      mfaId: string;
      method: string;
      secret: string;
      otpauthUrl: string;
      qrDataUri: string;
      digits: number;
      period: number;
    }>('/auth/mfa/setup', {}, { idempotent: true }),
  mfaConfirm: (code: string) =>
    api.post<{
      mfaEnabled: true;
      /**
       * **Affichés une seule fois.** Jamais stockés en clair côté serveur
       * (seuls leurs empreintes le sont) : une fois cet écran quitté, aucune
       * voie de récupération n'existe. D'où le bloc dédié et l'acquittement.
       */
      backupCodes: string[];
      warning: string;
    }>('/auth/mfa/confirm', { code }),
  /**
   * Validation ponctuelle d'un code (point de contrôle NFR-01 réutilisé par les
   * opérations sensibles). Distinct de `mfaConfirm`, qui active la 2FA.
   */
  mfaVerify: (code: string) => api.post<{ verified: true; remaining?: number }>('/auth/mfa/verify', { code }),
  mfaDisable: (code: string) => api.post<{ disabled: true }>('/auth/mfa/disable', { code }),

  // Téléphone / OTP
  sendOtp: (payload: { channel: 'SMS' | 'WHATSAPP' }) =>
    api.post<{ sent: boolean; expiresInMinutes: number }>('/auth/send-otp', payload, { idempotent: true }),
  verifyPhone: (payload: { code: string }) =>
    api.post<{ verified: boolean }>('/auth/verify-phone', payload, { idempotent: true }),
  syncProfile: () => api.post<{ synced: true }>('/auth/sync-profile'),
};

// ─── Référentiels ─────────────────────────────────────────────

export const referenceApi = {
  crops: (params: { search?: string; category?: string } = {}) =>
    api.get<Crop[]>('/crops', { params: cleanQuery(params) }),
  crop: (id: string) => api.get<Crop>(`/crops/${id}`),
  countries: () =>
    api.get<Array<{ code: string; name: string; currencies: string[]; defaultCurrency: string; locales: string[]; timezone: string; status: string }>>(
      '/countries',
    ),
  country: (code: string) => api.get<{ code: string; name: string; defaultCurrency: string }>(`/countries/${code.toUpperCase()}`),
  fxRates: () => api.get<Record<string, number>>('/countries/fx-rates'),
};

// ─── V1 FARM — exploitations, parcelles, productions ──────────

export const farmApi = {
  list: (params: PageQuery = {}) => api.get<Farm[]>('/farms', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) => api.post<Farm>('/farms', payload, { idempotent: true }),
  get: (id: string) => api.get<Farm>(`/farms/${id}`),
  update: (id: string, payload: Record<string, unknown>) => api.patch<Farm>(`/farms/${id}`, payload),
  publish: (id: string) => api.patch<Farm>(`/farms/${id}/publish`, {}),
  remove: (id: string) => api.delete<{ deleted: true }>(`/farms/${id}`),
};

export const plotApi = {
  list: (params: PageQuery & { farmId?: string } = {}) =>
    api.get<Plot[]>('/plots', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) => api.post<Plot>('/plots', payload, { idempotent: true }),
  /** GET /plots/:id — parcelle + exploitation, culture courante, historique, médias, analyses. */
  get: (id: string) => api.get<PlotDetail>(`/plots/${id}`),
  update: (id: string, payload: Record<string, unknown>) => api.patch<Plot>(`/plots/${id}`, payload),
  remove: (id: string) => api.delete<{ deleted: true }>(`/plots/${id}`),
  /** GET /plots/:id/crop-history → { items, timeline } (frise SOIL-03). */
  cropHistory: (id: string) => api.get<CropHistoryResult>(`/plots/${id}/crop-history`),
  addCropHistory: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/plots/${id}/crop-history`, payload, { idempotent: true }),
};

export const productionApi = {
  list: (params: PageQuery & { farmId?: string; plotId?: string; cropId?: string; season?: string; from?: string; to?: string } = {}) =>
    api.get<Production[]>('/productions', { params: cleanQuery(params) }),
  /** GET /productions/stats — groupBy : crop | plot | month | year. */
  stats: (params: { groupBy?: 'crop' | 'plot' | 'month' | 'year'; farmId?: string; season?: string; from?: string; to?: string } = {}) =>
    api.get<ProductionStats>('/productions/stats', { params: cleanQuery(params) }),
  /** POST /productions — PROD-01/PROD-02, retourne la conversion d'unité. */
  create: (payload: Record<string, unknown>) => api.post<ProductionCreated>('/productions', payload, { idempotent: true }),
  update: (id: string, payload: Record<string, unknown>) => api.patch<Production>(`/productions/${id}`, payload),
  remove: (id: string) => api.delete<{ deleted: true }>(`/productions/${id}`),
};

// ─── Sol & géospatial ─────────────────────────────────────────

export const soilApi = {
  /** GET /plots/:id/soil-assessments → { items, displayRules, emptyMessage }. */
  assessments: (plotId: string) => api.get<SoilAssessmentList>(`/plots/${plotId}/soil-assessments`),
  /** GET /plots/:id/soil-profile → profil fusionné + paramètres manquants. */
  profile: (plotId: string) => api.get<SoilProfileResult>(`/plots/${plotId}/soil-profile`),
  createAssessment: (plotId: string, payload: Record<string, unknown>) =>
    api.post<SoilAssessment>(`/plots/${plotId}/soil-assessments`, payload, { idempotent: true }),
  updateAssessment: (plotId: string, assessmentId: string, payload: Record<string, unknown>) =>
    api.patch<SoilAssessment>(`/plots/${plotId}/soil-assessments/${assessmentId}`, payload),
  removeAssessment: (plotId: string, assessmentId: string) =>
    api.delete<{ deleted: true }>(`/plots/${plotId}/soil-assessments/${assessmentId}`),
  /** GET /plots/:id/suitability — évaluations culture/parcelle (SOIL-04 → SOIL-08). */
  suitability: (plotId: string) => api.get<SuitabilityList>(`/plots/${plotId}/suitability`),
  computeSuitability: (plotId: string, payload: { cropId: string }) =>
    api.post<Suitability>(`/plots/${plotId}/suitability`, payload, { idempotent: true }),
  explainSuitability: (plotId: string, suitabilityId: string) =>
    api.get<Suitability>(`/plots/${plotId}/suitability/${suitabilityId}`),
  /** GET /plots/:id/rotation-plans — propositions versionnées (SOIL-06). */
  rotationPlans: (plotId: string) => api.get<RotationPlanList>(`/plots/${plotId}/rotation-plans`),
  proposeRotation: (plotId: string, payload: { cropId?: string; horizonYears?: number } = {}) =>
    api.post<RotationPlan>(`/plots/${plotId}/rotation-plans`, payload, { idempotent: true }),
  /** PATCH — décision humaine ACCEPTED | REJECTED. */
  decideRotation: (plotId: string, planId: string, payload: { decision: 'ACCEPTED' | 'REJECTED'; comment?: string }) =>
    api.patch<RotationPlan>(`/plots/${plotId}/rotation-plans/${planId}`, payload),
  /** GET /plots/:id/farming-plans — calendrier issu du jeu de règles (SOIL-07). */
  farmingPlans: (plotId: string) => api.get<FarmingPlanList>(`/plots/${plotId}/farming-plans`),
  proposeFarmingPlan: (plotId: string, payload: { rotationPlanId?: string; horizonYears?: number } = {}) =>
    api.post<FarmingPlan>(`/plots/${plotId}/farming-plans`, payload, { idempotent: true }),
  /** GET /plots/:id/yield-estimates — fourchettes de rendement (SOIL-14). */
  yieldEstimates: (plotId: string) => api.get<YieldEstimateList>(`/plots/${plotId}/yield-estimates`),
  estimateYield: (plotId: string, payload: { cropId: string }) =>
    api.post<YieldEstimate>(`/plots/${plotId}/yield-estimates`, payload, { idempotent: true }),
};

/** Agriculture de précision — routes montées sous /precision (plots et precision-reports). */
export const precisionApi = {
  /** GET /plots/:plotId/management-zones — versions horodatées (PRE-01). */
  zones: (plotId: string) => api.get<ManagementZoneList>(`/precision/plots/${plotId}/management-zones`),
  /** POST — 422 « Données insuffisantes » si aucune source réelle n'est disponible. */
  computeZones: (plotId: string, payload: { methodVersion?: string } = {}) =>
    api.post<ManagementZoneComputed>(`/precision/plots/${plotId}/management-zones`, payload, { idempotent: true }),
  reports: (plotId: string) => api.get<PrecisionReportList>(`/precision/plots/${plotId}/precision-reports`),
  createReport: (plotId: string, payload: { ruleSetVersion?: string; methodVersion?: string } = {}) =>
    api.post<PrecisionReportCreated>(`/precision/plots/${plotId}/precision-reports`, payload, { idempotent: true }),
  /** PATCH /precision/precision-reports/:id/validate — validation humaine (PRE-03). */
  validateReport: (id: string, payload: { ruleSetVersion?: string } = {}) =>
    api.patch<PrecisionReportValidated>(`/precision/precision-reports/${id}/validate`, payload),
  /** GET /precision/precision-reports/:id/pdf — nécessite un Bearer : ouvrir via une session. */
  pdfUrl: (id: string) => `${API_BASE_URL}/precision/precision-reports/${id}/pdf`,
};

export const geoApi = {
  /** Moteur Python (20 s de timeout, 1 retry côté serveur) → { diagnosis, engine, plot, disclaimer }. */
  diagnose: (plotId: string, payload: Record<string, unknown> = {}) =>
    api.post<SoilDiagnosisComputed>(`/plots/${plotId}/soil-diagnosis`, payload, {
      idempotent: true,
      timeoutMs: 25_000,
    }),
  /** 404 « Aucun diagnostic de sol enregistré » tant qu'aucun calcul n'a eu lieu. */
  latest: (plotId: string) => api.get<SoilDiagnosisLatest>(`/plots/${plotId}/soil-diagnosis/latest`),
  history: (plotId: string, params: { limit?: number } = {}) =>
    api.get<SoilDiagnosticList>(`/plots/${plotId}/soil-diagnosis`, { params: cleanQuery(params) }),
  one: (id: string) => api.get<SoilDiagnosisLatest>(`/geospatial/soil-diagnostics/${id}`),
  health: () => api.get<GeospatialHealth>('/geospatial/health'),
  /** Seuils, méthodes et priorité des sources exposés par le moteur. */
  methods: () => api.get<Record<string, unknown>>('/geospatial/methods'),
};

// ─── V2 MARKET ────────────────────────────────────────────────

export const listingApi = {
  list: (params: PageQuery & { type?: string; status?: string; cropId?: string; countryCode?: string } = {}) =>
    api.get<Listing[]>('/listings', { params: cleanQuery(params) }),
  get: (id: string) => api.get<Listing>(`/listings/${id}`),
  create: (payload: Record<string, unknown>) => api.post<Listing>('/listings', payload, { idempotent: true }),
  update: (id: string, payload: Record<string, unknown>) => api.patch<Listing>(`/listings/${id}`, payload),
  setStatus: (id: string, status: string) => api.patch<Listing>(`/listings/${id}/status`, { status }),
  /** Les coordonnées du vendeur ne transitent jamais : seule une conversation s'ouvre. */
  contact: (id: string, message?: string) =>
    api.post<Conversation>(`/listings/${id}/contact`, { message }, { idempotent: true }),
  attachPhotos: (id: string, mediaIds: string[]) =>
    api.post<Listing>(`/listings/${id}/photos`, { mediaIds }, { idempotent: true }),
  remove: (id: string) => api.delete<{ deleted: true }>(`/listings/${id}`),
};

/** Demandes d'achat et offres (V2 §5). */
export const requestApi = {
  list: (params: PageQuery & { status?: string; cropId?: string } = {}) =>
    api.get<PurchaseRequest[]>('/purchase-requests', { params: cleanQuery(params) }),
  get: (id: string) => api.get<PurchaseRequest>(`/purchase-requests/${id}`),
  create: (payload: Record<string, unknown>) => api.post<PurchaseRequest>('/purchase-requests', payload, { idempotent: true }),
  update: (id: string, payload: Record<string, unknown>) => api.patch<PurchaseRequest>(`/purchase-requests/${id}`, payload),
  /** Correspondances réelles : annonces publiées compatibles avec la demande. */
  matches: (id: string) => api.get<Listing[]>(`/purchase-requests/${id}/matches`),
  offers: (id: string) => api.get<Offer[]>(`/market/purchase-requests/${id}/offers`),
  submitOffer: (id: string, payload: Record<string, unknown>) =>
    api.post<Offer>(`/market/purchase-requests/${id}/offers`, payload, { idempotent: true }),
  updateOffer: (offerId: string, payload: Record<string, unknown>) =>
    api.patch<Offer>(`/market/offers/${offerId}`, payload),
};

/** Stock et mouvements (V2 §7). */
export const inventoryApi = {
  list: (params: PageQuery = {}) => api.get<InventoryItem[]>('/inventory', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) => api.post<InventoryItem>('/inventory', payload, { idempotent: true }),
  movements: (id: string) => api.get<InventoryMovement[]>(`/inventory/${id}/movements`),
  addMovement: (payload: Record<string, unknown>) =>
    api.post<InventoryMovement>('/inventory/movements', payload, { idempotent: true }),
};

/** Avis et réputation (V2 §8). */
export const reviewApi = {
  create: (orderId: string, payload: { rating: number; comment?: string }) =>
    api.post<Review>(`/orders/${orderId}/reviews`, payload, { idempotent: true }),
  respond: (id: string, payload: { response: string }) =>
    api.post<Review>(`/reviews/${id}/response`, payload, { idempotent: true }),
  report: (id: string, payload: { reason: string }) =>
    api.post<Review>(`/reviews/${id}/report`, payload, { idempotent: true }),
  moderate: (id: string, payload: Record<string, unknown>) =>
    api.post<Review>(`/reviews/${id}/moderate`, payload),
  reputation: (organizationId: string) => api.get<ReputationResult>(`/organizations/${organizationId}/reputation`),
};

export const orderApi = {
  list: (params: PageQuery & { status?: string } = {}) =>
    api.get<Order[]>('/orders', { params: cleanQuery(params) }),
  get: (id: string) => api.get<Order>(`/orders/${id}`),
  events: (id: string) => api.get<OrderEvent[]>(`/orders/${id}/events`),
  /** PATCH /orders/:id/status — transitions validées côté serveur. */
  setStatus: (id: string, status: string, payload: Record<string, unknown> = {}) =>
    api.patch<Order>(`/orders/${id}/status`, { status, ...payload }),
  setPayment: (id: string, payload: Record<string, unknown>) =>
    api.patch<Order>(`/orders/${id}/payment`, payload),
  dispute: (id: string, payload: { reason: string; evidence?: unknown }) =>
    api.post<Dispute>(`/orders/${id}/disputes`, payload, { idempotent: true }),
  adminDisputes: () => api.get<Dispute[]>('/orders/admin/disputes'),
  resolveDispute: (id: string, payload: Record<string, unknown>) =>
    api.patch<Dispute>(`/orders/admin/disputes/${id}`, payload),
};

// ─── V3 INTELLIGENCE ──────────────────────────────────────────

export const priceApi = {
  /** PRI-01 — aucun prix estimé sans source : `available:false` sinon. */
  list: (params: { cropId?: string; market?: string; countryCode?: string; since?: string; limit?: number } = {}) =>
    api.get<PriceListResult>('/prices', { params: cleanQuery(params) }),
  series: (params: { cropId: string; market?: string; countryCode?: string; days?: number }) =>
    api.get<PriceSeriesResult>('/prices/series', { params: cleanQuery(params) }),
  staleMarkets: () => api.get<MarketPrice[]>('/prices/stale-markets'),
  record: (payload: Record<string, unknown>) => api.post<MarketPrice>('/prices', payload, { idempotent: true }),
};

export const weatherApi = {
  forPlot: (plotId: string, params: { limit?: number } = {}) =>
    api.get<WeatherForPlot>(`/weather/plots/${plotId}`, { params: cleanQuery(params) }),
  history: (plotId: string, params: { days?: number } = {}) =>
    api.get<Record<string, unknown>>(`/weather/plots/${plotId}/history`, { params: cleanQuery(params) }),
  alerts: (plotId: string) => api.get<Record<string, unknown>[]>(`/weather/plots/${plotId}/alerts`),
};

export const tenderApi = {
  list: (params: PageQuery & { status?: string } = {}) =>
    api.get<Tender[]>('/tenders', { params: cleanQuery(params) }),
  get: (id: string) => api.get<Tender>(`/tenders/${id}`),
  respond: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/tenders/${id}/responses`, payload, { idempotent: true }),
};

export const lotApi = {
  list: (params: PageQuery = {}) => api.get<Record<string, unknown>[]>('/lots', { params: cleanQuery(params) }),
  get: (id: string) => api.get<Record<string, unknown>>(`/lots/${id}`),
  addEvent: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/lots/${id}/events`, payload, { idempotent: true }),
  /** TRC-03 — le producteur choisit les champs publiés sur la fiche publique. */
  setPublicFields: (id: string, publicFields: Record<string, unknown>) =>
    api.put<Record<string, unknown>>(`/lots/${id}/public-fields`, { publicFields }),
  recall: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/lots/${id}/recall`, payload, { idempotent: true }),
};

// ─── V4 INVEST ────────────────────────────────────────────────

export const projectApi = {
  list: (params: PageQuery & { status?: string } = {}) =>
    api.get<Record<string, unknown>[]>('/projects', { params: cleanQuery(params) }),
  get: (id: string) => api.get<Record<string, unknown>>(`/projects/${id}`),
};

// ─── V5 — insights & tableau de bord ──────────────────────────

export const insightsApi = {
  /** INS-01 — indicateurs agrégés par pays, avec k-anonymat appliqué. */
  overview: (params: { countryCode: string }) =>
    api.get<InsightsOverview>('/insights/overview', { params: cleanQuery(params) }),
  /** INS-02 — volumes par culture, cultures sous le seuil non publiées. */
  crops: (params: { countryCode: string }) =>
    api.get<InsightsCrops>('/insights/crops', { params: cleanQuery(params) }),
  /** INS-03 — activité mensuelle (annonces, commandes, projets). */
  activity: (params: { countryCode: string; months?: number }) =>
    api.get<InsightsActivity>('/insights/activity', { params: cleanQuery(params) }),
  disclosurePolicy: () => api.get<InsightsDisclosurePolicy>('/insights/disclosure-policy'),
};

export const dashboardApi = {
  farmer: () => api.get<Record<string, unknown>>('/dashboard'),
  invest: () => api.get<Record<string, unknown>>('/invest'),
};

// ─── Messaging & notifications ────────────────────────────────

export const messagingApi = {
  /** GET /messaging/conversations → { items, total, page, limit, totalUnread }. */
  conversations: (params: { page?: number; limit?: number } = {}) =>
    api.get<ConversationListResult>('/messaging/conversations', { params: cleanQuery(params) }),
  /** MSG-01 — une conversation est toujours rattachée à un objet métier. */
  createConversation: (payload: {
    subjectType: ConversationSubject;
    subjectId: string;
    participantOrgIds: string[];
    firstMessage?: string;
  }) => api.post<Conversation>('/messaging/conversations', payload, { idempotent: true }),
  /** Fil paginé par curseur : `before` = ISO du plus ancien message reçu. */
  messages: (conversationId: string, params: { limit?: number; before?: string } = {}) =>
    api.get<ConversationThreadResult>(`/messaging/conversations/${conversationId}/messages`, {
      params: cleanQuery(params),
    }),
  send: (conversationId: string, payload: { body: string; attachments?: string[] }) =>
    api.post<MessageItem>(`/messaging/conversations/${conversationId}/messages`, payload, { idempotent: true }),
  archive: (conversationId: string) =>
    api.post<Conversation>(`/messaging/conversations/${conversationId}/archive`, {}, { idempotent: true }),
  /** Modération : blocage d'une conversation abusive. */
  block: (conversationId: string, payload: { reason: string }) =>
    api.post<Conversation>(`/messaging/conversations/${conversationId}/block`, payload, { idempotent: true }),
  reportMessage: (messageId: string, payload: { reason: string }) =>
    api.post<{ reported: true }>(`/messaging/messages/${messageId}/report`, payload, { idempotent: true }),
};

// ─── Consentement SMS ──────────────────────────────────────────

/**
 * Consentement aux alertes par SMS.
 *
 * Le canal SMS est le canal d'alerte primaire en RDC, mais il est à sens
 * unique : répondre à un SMS n'a aucun effet. Donner et retirer l'accord ne
 * peut donc se faire que dans l'application.
 */
// ─── Retours de saison ─────────────────────────────────────────

/**
 * Rendement réellement obtenu en fin de saison.
 *
 * C'est la seule entrée de vérité « ce qui s'est passé » : sans elle, aucune
 * comparaison entre le moteur de règles et un modèle appris n'est possible.
 */
export const seasonApi = {
  list: (params: {
    plotId?: string;
    cropId?: string;
    season?: string;
    year?: number;
    withRecommendation?: boolean;
    page?: number;
    limit?: number;
  } = {}) => api.get<SeasonFeedback[]>('/seasons', { params: cleanQuery(params) }),
  get: (id: string) => api.get<SeasonFeedback>(`/seasons/${id}`),
  /**
   * Déclare un rendement réel. La source par défaut est `declared` : c'est
   * l'agriculteur qui le dit, rien n'est estimé côté serveur.
   */
  create: (payload: {
    plotId: string;
    cropId: string;
    recommendationId?: string;
    season: string;
    year: number;
    periodStart: string;
    periodEnd: string;
    actualYieldKg: number;
    areaHa?: number;
    unit?: string;
    observations?: string;
  }) => api.post<{ seasonFeedback: SeasonFeedback }>('/seasons', payload),
  update: (id: string, payload: Partial<{
    actualYieldKg: number;
    areaHa: number;
    observations: string;
    season: string;
    year: number;
    periodStart: string;
    periodEnd: string;
  }>) => api.patch<SeasonFeedback>(`/seasons/${id}`, payload),
  archive: (id: string) => api.delete<void>(`/seasons/${id}`),
  /** Rapprochement avec la recommandation — sans verdict. */
  compare: (id: string) => api.get<SeasonFeedbackComparison>(`/seasons/${id}/compare`),
  stats: (params: { groupBy?: 'crop' | 'plot' | 'season' | 'year'; cropId?: string } = {}) =>
    api.get<SeasonFeedbackStats>('/seasons/stats', { params: cleanQuery(params) }),
};

export const smsConsentApi = {
  /** GET /sms/consent → consentement courant + rappel de désinscription. */
  get: () => api.get<SmsConsentListResult>('/sms/consent'),
  /** POST /sms/consent → donne son accord pour un usage. */
  grant: (purpose: string, noticeVersion: string) =>
    api.post<{ consent: SmsConsent }>('/sms/consent', { purpose, noticeVersion }),
  /**
   * DELETE /sms/consent → se désinscrit. Plus aucun envoi pour cet usage.
   *
   * Aucun corps n'est envoyé : le client HTTP du web n'en porte pas sur
   * `DELETE`, et la route retombe sur l'usage d'alerte configuré côté serveur
   * (`purpose = env.SMS_ALERT_PURPOSE`). C'est le seul usage que cet écran
   * gère, donc le défaut est exactement ce qu'il faut — mais si un second
   * usage apparaissait, il faudrait accepter `purpose` en query plutôt que
   * de supposer le défaut.
   */
  withdraw: () => api.delete<{ consent: SmsConsent }>('/sms/consent'),
};

export const notificationApi = {
  /** GET /notifications → { items, unreadCount } (canal IN_APP uniquement). */
  list: (params: { unread?: boolean; page?: number; limit?: number } = {}) =>
    api.get<NotificationListResult>('/notifications', { params: cleanQuery(params) }),
  readAll: () => api.post<{ updated: number }>('/notifications/read-all', {}, { idempotent: true }),
  read: (id: string) => api.post<NotificationItem>(`/notifications/${id}/read`, {}, { idempotent: true }),
  /** NOTIF-03 — préférences par type × canal. */
  preferences: () => api.get<NotificationPreferencesResult>('/notifications/preferences'),
  setPreferences: (preferences: Array<{ type: string; channel: NotificationChannel; enabled: boolean }>) =>
    api.put<{ preferences: NotificationPreference[] }>('/notifications/preferences', { preferences }),
};

// ─── Capteurs (IoT) ────────────────────────────────────────────

export const iotApi = {
  /** GET /iot/devices → { items } avec l'état « muet » calculé côté serveur. */
  devices: () => api.get<IotDeviceList>('/iot/devices'),
  /** POST /iot/devices — la clé d'appareil n'est renvoyée qu'à la création. */
  registerDevice: (payload: {
    label: string;
    plotId?: string;
    serialNumber?: string;
    thresholds?: Record<string, { min?: number; max?: number }>;
  }) => api.post<IotDeviceRegistered>('/iot/devices', payload, { idempotent: true }),
  /** POST /iot/devices/:id/rotate-key — l'ancienne clé est invalidée aussitôt. */
  rotateKey: (id: string) => api.post<IotKeyRotated>(`/iot/devices/${id}/rotate-key`, {}, { idempotent: true }),
  /** POST /iot/devices/:id/revoke — motif obligatoire (5 à 500 caractères). */
  revoke: (id: string, reason: string) => api.post<IotDeviceRecord>(`/iot/devices/${id}/revoke`, { reason }, { idempotent: true }),
  /** GET /iot/devices/:id/readings?hours&metric&limit — fenêtres et trous signalés. */
  readings: (id: string, params: { hours?: number; metric?: string; limit?: number } = {}) =>
    api.get<IotReadingsResult>(`/iot/devices/${id}/readings`, { params: cleanQuery(params) }),
};

// ─── Organisations & coopératives ─────────────────────────────

export const organizationApi = {
  list: (params: PageQuery & { type?: string } = {}) =>
    api.get<OrganizationSummary[]>('/organizations', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) => api.post<OrganizationSummary>('/organizations', payload, { idempotent: true }),
  get: (id: string) => api.get<OrganizationSummary & { memberships?: Membership[] }>(`/organizations/${id}`),
  update: (id: string, payload: Record<string, unknown>) => api.patch<OrganizationSummary>(`/organizations/${id}`, payload),
};

export const cooperativeApi = {
  /** Coopérative de l'organisation active. */
  current: () => api.get<Cooperative>('/cooperatives/current'),
  updateCurrent: (payload: Record<string, unknown>) => api.patch<Cooperative>('/cooperatives/current', payload),
  members: (id: string, params: PageQuery = {}) =>
    api.get<CooperativeMember[]>(`/cooperatives/${id}/members`, { params: cleanQuery(params) }),
  addMember: (id: string, payload: Record<string, unknown>) =>
    api.post<CooperativeMember>(`/cooperatives/${id}/members`, payload, { idempotent: true }),
  importMembers: (id: string, payload: Record<string, unknown>) =>
    api.post<{ imported: number; skipped: number }>(`/cooperatives/${id}/members/import`, payload, { idempotent: true }),
  updateMember: (id: string, memberId: string, payload: Record<string, unknown>) =>
    api.patch<CooperativeMember>(`/cooperatives/${id}/members/${memberId}`, payload),
  overview: (id: string) => api.get<CooperativeOverview>(`/cooperatives/${id}/overview`),
  /** Offre groupée : aperçu calculé, puis création, confirmation ou annulation. */
  previewGroupOffer: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/cooperatives/${id}/group-offers/preview`, payload, { idempotent: true }),
  groupOffers: (id: string) => api.get<Array<Record<string, unknown>>>(`/cooperatives/${id}/group-offers`),
  createGroupOffer: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/cooperatives/${id}/group-offers`, payload, { idempotent: true }),
  confirmGroupOffer: (id: string, offerId: string) =>
    api.post<Record<string, unknown>>(`/cooperatives/${id}/group-offers/${offerId}/confirm`, {}, { idempotent: true }),
  cancelGroupOffer: (id: string, offerId: string) =>
    api.post<Record<string, unknown>>(`/cooperatives/${id}/group-offers/${offerId}/cancel`, {}, { idempotent: true }),
};

// ─── Vérification & certifications ────────────────────────────

export const verificationApi = {
  /** Demande de vérification d'un sujet (exploitation, parcelle, certification…). */
  request: (payload: Record<string, unknown>) => api.post<Verification>('/verifications', payload, { idempotent: true }),
  /** File de l'organisation active. */
  mine: () => api.get<Verification[]>('/verifications/me'),
  /** Queue administrateur / vérificateur. */
  adminQueue: (params: { status?: string; limit?: number } = {}) =>
    api.get<Verification[]>('/admin/verifications', { params: cleanQuery(params) }),
  decide: (id: string, payload: Record<string, unknown>) =>
    api.patch<Verification>(`/admin/verifications/${id}`, payload),
};

export const certificationApi = {
  list: (params: PageQuery = {}) => api.get<Certification[]>('/certifications', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) => api.post<Certification>('/certifications', payload, { idempotent: true }),
  forOrganization: (organizationId: string) => api.get<Certification[]>(`/certifications/organization/${organizationId}`),
  get: (id: string) => api.get<Certification>(`/certifications/${id}`),
  verify: (id: string, payload: Record<string, unknown> = {}) =>
    api.patch<Certification>(`/certifications/${id}/verify`, payload),
  remove: (id: string) => api.delete<{ deleted: true }>(`/certifications/${id}`),
};

// ─── IA (AI-01 → AI-10) ───────────────────────────────────────

export const aiApi = {
  /** Consentement explicite requis : `consentGiven: true`. */
  analyze: (payload: Record<string, unknown>) => api.post<AiAnalysis>('/ai/analyses', payload, { idempotent: true }),
  copilot: (payload: Record<string, unknown>) =>
    api.post<AiAnalysis>('/ai/copilot', payload, { idempotent: true, timeoutMs: 60_000 }),
  analyzeDocument: (payload: Record<string, unknown>) =>
    api.post<AiAnalysis>('/ai/documents', payload, { idempotent: true, timeoutMs: 60_000 }),
  list: (params: PageQuery & { type?: string; status?: string } = {}) =>
    api.get<AiAnalysis[]>('/ai/analyses', { params: cleanQuery(params) }),
  get: (id: string) => api.get<AiAnalysis>(`/ai/analyses/${id}`),
  /** Escalade humaine obligatoire avant toute décision (AI-10). */
  escalate: (id: string, payload: Record<string, unknown> = {}) =>
    api.post<AiAnalysis>(`/ai/analyses/${id}/escalate`, payload, { idempotent: true }),
  review: (id: string, payload: Record<string, unknown>) => api.post<AiAnalysis>(`/ai/analyses/${id}/review`, payload),
  feedback: (id: string, payload: Record<string, unknown>) =>
    api.post<AiAnalysis>(`/ai/analyses/${id}/feedback`, payload, { idempotent: true }),
};

// ─── Développeurs : clients API, clés, usage ──────────────────

export const apiClientApi = {
  clients: () => api.get<ApiClient[]>('/api-clients/clients'),
  create: (payload: { name: string; contactEmail?: string; scopes?: string[] }) =>
    api.post<ApiClient & { secret?: string }>('/api-clients/clients', payload, { idempotent: true }),
  /** La finalité de traitement doit être déclarée puis approuvée. */
  setPurpose: (id: string, payload: { dataPurpose: string }) =>
    api.patch<ApiClient>(`/api-clients/clients/${id}/purpose`, payload),
  createKey: (id: string, payload: { label: string; expiresAt?: string } = { label: 'clé' }) =>
    api.post<ApiKeyCreated>(`/api-clients/clients/${id}/keys`, payload, { idempotent: true }),
  revokeKey: (keyId: string) => api.delete<ApiKeyItem>(`/api-clients/keys/${keyId}`),
  usage: (id: string, params: { days?: number } = {}) =>
    api.get<ApiUsageResult>(`/api-clients/clients/${id}/usage`, { params: cleanQuery(params) }),
};

// ─── Invest (V4) : projets, data room, financement, reporting ─

export const investApi = {
  projects: (params: PageQuery & { sector?: string; countryCode?: string; status?: string } = {}) =>
    api.get<Project[]>('/investment/projects', { params: cleanQuery(params) }),
  followed: () => api.get<Project[]>('/investment/followed'),
  follow: (id: string) => api.post<{ followed: true }>(`/investment/projects/${id}/follow`, {}, { idempotent: true }),
  unfollow: (id: string) => api.delete<{ followed: false }>(`/investment/projects/${id}/follow`),
  matches: () => api.get<Project[]>('/investment/matches'),
  /** Contact : la demande passe par la plateforme, jamais par une coordonnée directe. */
  contact: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/investment/projects/${id}/contact`, payload, { idempotent: true }),
  decideContact: (id: string, requestId: string, payload: { decision: 'ACCEPTED' | 'REJECTED' }) =>
    api.post<Record<string, unknown>>(`/investment/projects/${id}/contacts/${requestId}/decide`, payload),
  contactRequests: () => api.get<Array<Record<string, unknown>>>('/investment/contact-requests'),
  profile: () => api.get<Record<string, unknown>>('/investors/me'),
  updateProfile: (payload: Record<string, unknown>) => api.put<Record<string, unknown>>('/investors/me', payload),
  dashboard: () => api.get<Record<string, unknown>>('/invest'),
};

export const projectDataApi = {
  documents: (projectId: string) => api.get<Array<Record<string, unknown>>>(`/dataroom/projects/${projectId}/documents`),
  addDocument: (projectId: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/dataroom/projects/${projectId}/documents`, payload, { idempotent: true }),
  requestAccess: (projectId: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/dataroom/projects/${projectId}/access-requests`, payload, { idempotent: true }),
  decideAccess: (requestId: string, payload: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>(`/dataroom/access-requests/${requestId}`, payload),
  document: (documentId: string) => api.get<Record<string, unknown>>(`/dataroom/documents/${documentId}`),
  accessLog: (projectId: string) => api.get<Array<Record<string, unknown>>>(`/dataroom/projects/${projectId}/access-log`),
  fundingRequests: (projectId: string) => api.get<FundingRequest[]>(`/funding/projects/${projectId}/funding-requests`),
  consentFunding: (projectId: string, payload: Record<string, unknown>) =>
    api.post<FundingRequest>(`/funding/projects/${projectId}/funding-requests/consent`, payload, { idempotent: true }),
  transmitFunding: (id: string) => api.post<FundingRequest>(`/funding/funding-requests/${id}/transmit`, {}, { idempotent: true }),
  followUpFunding: (id: string, payload: Record<string, unknown>) =>
    api.patch<FundingRequest>(`/funding/funding-requests/${id}/follow-up`, payload),
  reports: (projectId: string) =>
    api.get<{ progress: ProgressReport[]; impact: ImpactReport[] }>(`/projects/${projectId}/reports`),
  addProgressReport: (projectId: string, payload: Record<string, unknown>) =>
    api.post<ProgressReport>(`/projects/${projectId}/progress-reports`, payload, { idempotent: true }),
  addImpactReport: (projectId: string, payload: Record<string, unknown>) =>
    api.post<ImpactReport>(`/projects/${projectId}/impact-reports`, payload, { idempotent: true }),
};

// ─── Transport ────────────────────────────────────────────────

export const transportApi = {
  requests: (params: PageQuery & { status?: string } = {}) =>
    api.get<TransportRequest[]>('/transport/requests', { params: cleanQuery(params) }),
  create: (payload: Record<string, unknown>) =>
    api.post<TransportRequest>('/transport/requests', payload, { idempotent: true }),
  offer: (id: string, payload: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/transport/requests/${id}/offers`, payload, { idempotent: true }),
  acceptOffer: (offerId: string) =>
    api.post<TransportRequest>(`/transport/offers/${offerId}/accept`, {}, { idempotent: true }),
  proofOfDelivery: (id: string, payload: Record<string, unknown>) =>
    api.post<TransportRequest>(`/transport/requests/${id}/proof-of-delivery`, payload, { idempotent: true }),
  setStatus: (id: string, payload: Record<string, unknown>) =>
    api.patch<TransportRequest>(`/transport/requests/${id}/status`, payload),
};

// ─── Administration ───────────────────────────────────────────

export const adminApi = {
  /** M1 — KPIs du tableau de bord (filtres pays/période, RG-M1-1). */
  dashboard: (params: { country?: string; from?: string; to?: string } = {}) =>
    api.get<Record<string, unknown>>('/admin/dashboard', { params: cleanQuery(params) }),
  /** M1 — Export CSV du dashboard (RG-M1-4). */
  dashboardExport: (params: { country?: string; from?: string; to?: string } = {}) =>
    api.get<{ csv: string; filename: string }>('/admin/dashboard/export', { params: cleanQuery(params) }),
  /**
   * M2 U-M2-1 — liste paginée et filtrée : terme `q`, rôle, statut, pays,
   * MFA, vérifications e-mail/téléphone, période.
   */
  users: (
    params: PageQuery & {
      q?: string;
      status?: string;
      role?: string;
      country?: string;
      mfa?: string;
      emailVerified?: string;
      phoneVerified?: string;
      createdFrom?: string;
      createdTo?: string;
    } = {},
  ) => api.get<Array<Record<string, unknown>>>('/admin/users', { params: cleanQuery(params) }),
  /** M2 U-M2-2 — fiche complète (profil, rôles, sécurité, activité). */
  user: (id: string) => api.get<Record<string, unknown>>(`/admin/users/${id}`),
  /** M2 U-M2-4 — suspendre / réactiver (motif requis, RG-M2-2 audité). */
  setUserStatus: (id: string, payload: { status: string; reason: string }) =>
    api.patch<Record<string, unknown>>(`/admin/users/${id}/status`, payload),
  /** M2 U-M2-4 — déverrouiller après blocage anti brute-force. */
  unlockUser: (id: string, payload: { reason?: string }) =>
    api.post<Record<string, unknown>>(`/admin/users/${id}/unlock`, payload),
  /** M2 U-M2-4 — révoquer toutes les sessions du compte. */
  forceLogout: (id: string, payload: { reason?: string }) =>
    api.post<Record<string, unknown>>(`/admin/users/${id}/force-logout`, payload),
  /** M2 U-M2-4 — marquer e-mail / téléphone vérifié (motif requis). */
  verifyUserEmail: (id: string, payload: { reason: string }) =>
    api.post<Record<string, unknown>>(`/admin/users/${id}/verify-email`, payload),
  verifyUserPhone: (id: string, payload: { reason: string }) =>
    api.post<Record<string, unknown>>(`/admin/users/${id}/verify-phone`, payload),
  /** M2 U-M2-6 — rôles de gouvernance + matrice de permissions effective. */
  roles: () => api.get<Record<string, unknown>>('/admin/roles'),
  /** M2 U-M2-3 (palier 2) — attribution de rôle (MFA exigée, RG-G1/G3). */
  grantRole: (
    id: string,
    payload: { role: string; organizationId?: string; mfaCode: string; password?: string; reason: string },
  ) => api.post<Record<string, unknown>>(`/admin/users/${id}/roles`, payload),
  /** M2 U-M2-3 (palier 2) — révocation (RG-G2 : dernier super admin protégé). */
  revokeRole: (id: string, role: string) => api.delete<Record<string, unknown>>(`/admin/users/${id}/roles/${role}`),
  /** M2 U-M2-5 (palier 2) — suppression logique (RG-G5, audité). */
  deleteUser: (id: string, payload: { reason?: string }) =>
    api.delete<Record<string, unknown>>(`/admin/users/${id}`, { data: payload }),
  /** M2 U-M2-5 (palier 2) — export de portabilité (audité, sans secret). */
  exportUser: (id: string) => api.get<Record<string, unknown>>(`/admin/users/${id}/export`),
  /** M6 U-M6-1 — recherche avancée du journal (acteur, action, ressource, date, gravité). */
  audit: (
    params: {
      limit?: number;
      action?: string;
      actor?: string;
      actorId?: string;
      resource?: string;
      from?: string;
      to?: string;
      severity?: string;
    } = {},
  ) => api.get<Array<Record<string, unknown>>>('/admin/audit', { params: cleanQuery(params) }),
  /** M6 U-M6-1 — export CSV/JSON du journal (audité côté serveur, RG-S2). */
  auditExport: async (
    params: { format?: 'csv' | 'json'; limit?: number; action?: string; actor?: string; actorId?: string; resource?: string; from?: string; to?: string; severity?: string } = {},
  ) => {
    const response = await http.get<unknown>('/admin/audit/export', {
      params: cleanQuery(params),
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const brut = disposition.split('filename=')[1] ?? '';
    const filename = brut.split(String.fromCharCode(34)).join('').trim() || `audit.${params.format ?? 'csv'}`;
    return { content: String(response.data ?? ''), filename };
  },
  /** M5 U-M5-2 — console des jobs : état, cadence, derniers passages. */
  jobs: () => api.get<Array<Record<string, unknown>>>('/admin/jobs'),
  /** M5 U-M5-2 / RG-M5-2 — exécution manuelle (audité `admin.job.run`, verrou anti double-exécution). */
  runJob: (name: string, payload: { reason?: string } = {}) =>
    api.post<Record<string, unknown>>(`/admin/jobs/${name}/run`, payload, { idempotent: true }),
  /** M5 U-M5-2 — pause/reprise : palier 2 (SUPER_ADMIN + MFA). */
  pauseJob: (name: string) => api.post<Record<string, unknown>>(`/admin/jobs/${name}/pause`, {}, { idempotent: true }),
  resumeJob: (name: string) => api.post<Record<string, unknown>>(`/admin/jobs/${name}/resume`, {}, { idempotent: true }),
  /** M5 U-M5-1 — services externes, réévalués à chaque appel (RG-M5-1). */
  monitoringServices: () => api.get<Record<string, unknown>>('/admin/monitoring/services'),
  /** M5 U-M5-3/U-M5-4 — santé technique et alertes de supervision. */
  monitoringHealth: () => api.get<Record<string, unknown>>('/admin/monitoring/health'),
  /** M6 U-M6-2 — vue sécurité consolidée (connexions, verrous, MFA, clés, sessions). */
  securityOverview: () => api.get<Record<string, unknown>>('/admin/security/overview'),
  /** M6 U-M6-3 — politique de sécurité : palier 2 (SUPER_ADMIN + MFA). */
  securityPolicy: () => api.get<Record<string, unknown>>('/admin/security/policy'),
  updateSecurityPolicy: (payload: { values: Record<string, unknown>; reason?: string }) =>
    api.put<Record<string, unknown>>('/admin/security/policy', payload),
  /** M4 U-M4-2 — file de modération unifiée (listings, avis, vérifications). */
  operationsList: (entity: string, params: { limit?: number; page?: number; status?: string } = {}) =>
    api.get<Array<Record<string, unknown>>>(`/admin/operations/${entity}`, { params: cleanQuery(params) }),
  /** M4 U-M4-2 — fiche détail d'un élément à modérer. */
  operationsDetail: (entity: string, id: string) =>
    api.get<Record<string, unknown>>(`/admin/operations/${entity}/${id}`),
  /** M4 U-M4-2 / RG-M4-1 — décision motivée, déléguée aux services métier. */
  moderateOperation: (entity: string, id: string, payload: { decision: 'approve' | 'reject' | 'suspend'; reason: string }) =>
    api.post<Record<string, unknown>>(`/admin/operations/${entity}/${id}/moderate`, payload),
  /** M7 U-M7-1 — annonce interne ciblée (rôle et/ou pays). */
  broadcastAnnouncement: (payload: { title: string; body: string; role?: string; country?: string; channels?: string[] }) =>
    api.post<Record<string, unknown>>('/admin/notifications/broadcast', payload),
  /** M7 U-M7-1 — historique d'envois et taux de délivrance SMS. */
  notificationsHistory: (params: { limit?: number } = {}) =>
    api.get<Record<string, unknown>>('/admin/notifications/history', { params: cleanQuery(params) }),
  settings: () => api.get<Record<string, unknown>>('/admin/settings'),
  updateSettings: (payload: Record<string, unknown>) => api.put<Record<string, unknown>>('/admin/settings', payload),
  exportFarms: () => `${API_BASE_URL}/admin/export/farms`,
};

// ─── Médias (URL signées, TTL 300 s) ──────────────────────────

export const mediaApi = {
  /** Deux temps : URL signée d'upload, puis confirmation après dépôt. */
  uploadUrl: (payload: { filename: string; mimeType: string; size: number; kind?: string }) =>
    api.post<{ mediaId: string; uploadUrl: string; expiresAt: string }>('/media/upload-url', payload, {
      idempotent: true,
    }),
  confirm: (id: string) => api.post<{ id: string; url: string }>(`/media/${id}/confirm`, {}, { idempotent: true }),
  list: (params: { kind?: string; limit?: number } = {}) =>
    api.get<Array<{ id: string; url: string; kind: string; caption: string | null }>>('/media', {
      params: cleanQuery(params),
    }),
};

// ─── V4 EXPORT — dossiers d'exportation (backend `/exports`) ──

export const exportApi = {
  /** EXP-01 — dossiers d'export du vendeur (paginé). */
  list: (params: PageQuery & { status?: string } = {}) =>
    api.get<ExportOrderList>('/exports', { params: cleanQuery(params) }),
  /** EXP-02 — conformité documentaire + conversion de change. */
  get: (id: string) => api.get<ExportOrderDetail>(`/exports/${id}`),
  create: (payload: Record<string, unknown>) =>
    api.post<ExportOrderRow>('/exports', payload, { idempotent: true }),
  addDocument: (id: string, payload: Record<string, unknown>) =>
    api.post<ExportDocumentRow>(`/exports/${id}/documents`, payload, { idempotent: true }),
  setStatus: (id: string, payload: { status: string; note?: string }) =>
    api.patch<ExportOrderRow>(`/exports/${id}/status`, payload),
};

// ─── V3 SYNC — synchronisation hors ligne (backend `/sync`) ───

export const syncApi = {
  /** SYNC-01 — collections synchronisables (contrat client). */
  collections: () => api.get<SyncCollectionsResult>('/sync/collections'),
  /** SYNC-02 — pousse un lot d'opérations; les conflits ne sont jamais écrasés. */
  push: (payload: { operations: Array<Record<string, unknown>> }) =>
    api.post<Record<string, unknown>>('/sync/push', payload, { idempotent: true }),
  /** SYNC-03 — tire les changements depuis un curseur. */
  pull: (params: { since?: string; days?: number; limit?: number } = {}) =>
    api.get<SyncPullResult>('/sync/pull', { params: cleanQuery(params) }),
  /** SYNC-04 — rapport de conflits à arbitrer (jamais de résolution silencieuse). */
  conflicts: (params: { limit?: number; onlyConflicts?: 'true' | 'false' } = {}) =>
    api.get<SyncConflictsResult>('/sync/conflicts', { params: cleanQuery(params) }),
};

export const satelliteApi = {
  /**
   * GET /satellite/settings — réglages d'acquisition, sans les secrets.
   * `sources` porte `measuresSubsurface: false` : le rappel vient du serveur.
   */
  settings: () => api.get<SatelliteSettings>('/satellite/settings'),
  /**
   * GET /satellite/plots/:id/observations — les plus récentes d'abord.
   * `measuresSubsurface: false` accompagne la liste.
   */
  observations: (plotId: string, params: { index?: string; provider?: string; limit?: number } = {}) =>
    api.get<SatelliteObservationList>(`/satellite/plots/${plotId}/observations`, { params: cleanQuery(params) }),
  /**
   * POST /satellite/plots/:id/acquire — acquisition à la demande.
   * **201** scène acquise, **200** scène refusée (nuages, acquisition
   * désactivée). Un refus n'est pas une erreur : `rejected` + `reason`.
   */
  acquire: (plotId: string) =>
    api.post<SatelliteAcquisition>(`/satellite/plots/${plotId}/acquire`, {}, { idempotent: true }),
};

export const recommendationApi = {
  /** GET /plots/:id/recommendations — historique, le plus récent d'abord. */
  list: (plotId: string, params: { limit?: number } = {}) =>
    api.get<RecommendationList>(`/plots/${plotId}/recommendations`, { params: cleanQuery(params) }),
  /**
   * POST /plots/:id/recommendations — classement sur la période demandée.
   * Sans données suffisantes : `status: 'INSUFFICIENT_DATA'`, aucun classement.
   */
  create: (plotId: string, payload: { periodStart: string; periodEnd: string }) =>
    api.post<RecommendationCreated>(`/plots/${plotId}/recommendations`, payload, { idempotent: true }),
  one: (id: string) => api.get<CropRecommendation>(`/recommendations/${id}`),
  explanation: (id: string) => api.get<RecommendationExplanation>(`/recommendations/${id}/explanation`),
  /**
   * Décision de l'agriculteur. Une ancienne recommandation ne devient SUPERSEDED
   * qu'après **acceptation** de la nouvelle.
   */
  decide: (id: string, payload: RecommendationDecision) =>
    api.post<CropRecommendation>(`/recommendations/${id}/decision`, payload, { idempotent: true }),
};

export const alertApi = {
  /**
   * Boîte d'alertes filtrable.
   *
   * `severity` n'est **pas** un filtre de l'API (`listAlertsQuery` ne le
   * connaît pas) : il figurait pourtant ici, et un filtre annoncé qui ne fait
   * rien est pire qu'un filtre absent — l'utilisateur croit avoir réduit sa
   * liste. Filtres réels : `plotId`, `recommendationId`, `sourceType`, `status`
   * et `open` (`open` et `status` exclusifs, sinon 422).
   */
  list: (
    params: {
      plotId?: string;
      recommendationId?: string;
      sourceType?: AlertSourceType;
      status?: AlertStatus;
      open?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) =>
    api.get<AlertList>('/alerts', {
      params: cleanQuery({ ...params, open: params.open === undefined ? undefined : String(params.open) }),
    }),
  /**
   * Valeurs de filtre et leurs libellés. Les filtres de l'écran viennent de là,
   * pas d'une table recopiée dans le client.
   */
  meta: () => api.get<AlertFilterMeta>('/alerts/meta'),
  one: (id: string) => api.get<DescribedAlert>(`/alerts/${id}`),
  /** Marque lue — ne clôt pas l'alerte. */
  markRead: (id: string) => api.post<DescribedAlert>(`/alerts/${id}/read`, {}, { idempotent: true }),
  /** Clôture : une alerte traitée ne se renotifie plus. */
  markHandled: (id: string, payload: { note?: string } = {}) =>
    api.post<DescribedAlert>(`/alerts/${id}/handled`, payload, { idempotent: true }),
};

export const anomalyApi = {
  /** Seuils de détection — tous marqués provisoires, à recaler sur le pilote. */
  settings: () => api.get<AnomalySettings>('/anomalies/settings'),
  list: (params: { status?: AnomalyStatus; deviceId?: string; page?: number; limit?: number } = {}) =>
    api.get<SensorAnomaly[]>('/anomalies', { params: cleanQuery(params) }),
  one: (id: string) => api.get<SensorAnomaly>(`/anomalies/${id}`),
  detectDevice: (deviceId: string) =>
    api.post<AnomalyDetectionResult>(`/anomalies/devices/${deviceId}/detect`, {}, { idempotent: true }),
  detectPlot: (plotId: string) =>
    api.post<AnomalyDetectionResult>(`/anomalies/plots/${plotId}/detect`, {}, { idempotent: true }),
  /**
   * Revue par un agronome. `DISMISSED` réhabilite la mesure immédiatement
   * (`readingExcluded: false`) ; `CONFIRMED` la maintient écartée du calcul.
   */
  review: (id: string, payload: { decision: 'CONFIRMED' | 'DISMISSED'; note?: string }) =>
    api.post<AnomalyReviewResult>(`/anomalies/${id}/review`, payload),
};

export const agronomicRangeApi = {
  list: (params: { cropSlug?: string; status?: RangeStatus; datasetLabel?: string } = {}) =>
    api.get<AgronomicRangeList>('/agronomic-ranges', { params: cleanQuery(params) }),
  meta: () => api.get<AgronomicRangeMeta>('/agronomic-ranges/meta'),
  one: (id: string) => api.get<CropAgronomicRange>(`/agronomic-ranges/${id}`),
  /** Une plage sans provenance est refusée en 422. */
  create: (payload: {
    cropSlug: string;
    parameterKey: RangeParameterKey;
    minValue: number;
    maxValue: number;
    /** Bornes tolérées facultatives : `null` = non renseignées, jamais complétées. */
    toleratedMin?: number | null;
    toleratedMax?: number | null;
    unit: string;
    /** Nature de la provenance : agronome, publication ou pilote. */
    sourceType?: RangeSourceType | null;
    sourceReference?: string;
    sourceNote?: string;
    zone?: string | null;
    datasetLabel?: string;
  }) => api.post<CropAgronomicRange>('/agronomic-ranges', payload, { idempotent: true }),
  /**
   * Une plage validée modifiée redevient provisoire.
   *
   * `undefined` = champ non touché ; `null` = champ effacé. La distinction est
   * réelle côté serveur, elle doit l'être aussi dans la signature.
   */
  update: (
    id: string,
    payload: {
      minValue?: number;
      maxValue?: number;
      toleratedMin?: number | null;
      toleratedMax?: number | null;
      unit?: string;
      sourceType?: RangeSourceType | null;
      sourceReference?: string | null;
      sourceNote?: string | null;
      zone?: string | null;
    },
  ) => api.patch<CropAgronomicRange>(`/agronomic-ranges/${id}`, payload),
  /** Sans source citable déjà présente, le serveur refuse en 409. */
  validate: (id: string, payload: { validatedBy: string; sourceReference?: string }) =>
    api.post<CropAgronomicRange>(`/agronomic-ranges/${id}/validate`, payload, { idempotent: true }),
  retire: (id: string) =>
    api.post<CropAgronomicRange>(`/agronomic-ranges/${id}/retire`, {}, { idempotent: true }),
  importTemplate: () => api.get<AgronomicRangeImportTemplate>('/agronomic-ranges/import/template'),
  /** Chaque ligne est validée individuellement ; `dryRun` n'écrit rien. */
  importCsv: (payload: { csv: string; dryRun?: boolean; datasetLabel?: string }) =>
    api.post<AgronomicRangeImportResult>('/agronomic-ranges/import', payload, { idempotent: true }),
};
