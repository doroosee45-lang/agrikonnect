/**
 * Types miroirs du contrat backend (CDC §13.1 / A.5).
 *
 * Les formes ci-dessous sont recopiées des projections réelles de
 * `backend/src/modules/*` : `public.service.js` (projectFarm, map, soilStats),
 * `auth.service.js` (publicUser, session), `prices.service.js`,
 * `weather.service.js`, `traceability.service.js` (publicView).
 * Aucune projection n'est inventée côté client : si un champ n'existe pas côté
 * serveur, il n'existe pas ici.
 */

// ─── Enveloppe ────────────────────────────────────────────────

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface ApiEnvelope<T> {
  success: true;
  message?: string;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFieldError {
  field: string;
  code?: string;
  message?: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  requestId?: string | null;
  errors?: ApiFieldError[];
  details?: Record<string, unknown>;
  stack?: string;
}

/** Erreur normalisée côté client : un seul type à intercepter dans l'UI. */
export class RequestError extends Error {
  readonly status: number;
  readonly fields: ApiFieldError[];
  readonly details: Record<string, unknown>;
  readonly requestId?: string | null;
  /** true quand le serveur réclame le second facteur (NFR-01). */
  readonly mfaRequired: boolean;

  constructor(status: number, message: string, body?: Partial<ApiErrorBody>) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.fields = body?.errors ?? [];
    this.details = body?.details ?? {};
    this.requestId = body?.requestId ?? null;
    this.mfaRequired = Boolean(this.details.mfaRequired);
  }

  get kind(): ErrorKind {
    if (this.status === 0) return 'network';
    if (this.status === 401) return 'unauthorized';
    if (this.status === 403) return 'forbidden';
    if (this.status === 404) return 'notFound';
    if (this.status === 409) return 'conflict';
    if (this.status === 422) return 'validation';
    if (this.status === 429) return 'rateLimit';
    if (this.status >= 500) return 'server';
    return 'unknown';
  }
}

export type ErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'validation'
  | 'rateLimit'
  | 'server'
  | 'unknown';

/** Clé i18n associée à chaque famille d'erreur (`errors.*`). */
export const ERROR_KIND_I18N: Record<ErrorKind, string> = {
  network: 'errors.network',
  unauthorized: 'errors.unauthorized',
  forbidden: 'errors.forbidden',
  notFound: 'errors.notFound',
  conflict: 'errors.conflict',
  validation: 'errors.validation',
  rateLimit: 'errors.rateLimit',
  server: 'errors.server',
  unknown: 'errors.unknown',
};

// ─── Auth ─────────────────────────────────────────────────────

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Secondes. */
  expiresIn: number;
  tokenType?: string;
}

export interface OrganizationRef {
  id: string;
  type: string;
  name: string;
  slug?: string;
  roles?: string[];
}

/** `publicUser()` — projection AUTH renvoyée par login/register/me. */
export interface PublicUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  whatsapp: string | null;
  locale: string;
  countryCode: string;
  status: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  organizations: OrganizationRef[];
}

export interface LoginResult {
  user: PublicUser;
  session: Session;
}

/** PROF-01 — `GET /me` : profil + complétude + compteurs du tenant actif. */
export interface MeResult {
  user: PublicUser;
  completeness: {
    percent: number;
    done: number;
    total: number;
    criteria: Array<{ key: string; label: string; done: boolean }>;
    missing: string[];
  };
  counts: { farms: number; plots: number; productions: number };
  activeOrganizationId: string | null;
}

/** `GET /me/permissions` — rôles effectifs et permissions accordées. */
export interface PermissionsResult {
  roles: string[];
  permissions: string[];
}

export interface RegisterResult {
  user: PublicUser;
  organization: { id: string; type: string; name: string };
  /** null quand l'inscription s'est faite par téléphone (pas de session immédiate). */
  session: Session | null;
  nextSteps: string[];
}

/** AUTH-01 — types de compte ouvrables en libre-service (jamais ADMIN/VERIFIER). */
export type SelfServiceAccountType =
  | 'FARMER'
  | 'COOPERATIVE_ADMIN'
  | 'AGRICULTURAL_COMPANY'
  | 'SUPPORT_AGENT'
  | 'BUYER'
  | 'SUPPLIER'
  | 'TRANSPORTER'
  | 'AGRONOMIST'
  | 'INVESTOR';

export interface RegisterPayload {
  accountType: SelfServiceAccountType;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password: string;
  locale?: 'fr' | 'en';
  countryCode: string;
  whatsapp?: string;
  cooperativeName?: string;
  consentReference?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  /** Second facteur (TOTP ou code de secours) dès que la MFA est active. */
  mfaCode?: string;
}

// ─── Public (aucune authentification) ─────────────────────────

export interface PublicFarmListItem {
  slug: string;
  name: string;
  countryCode: string;
  province: string | null;
  description: string | null;
  totalAreaHa: number | null;
  verificationStatus: string | null;
  updatedAt: string;
  crops: Array<{ crop: { slug: string; names: Record<string, string> | null } }>;
}

export interface PublicFarmListResult {
  items: PublicFarmListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PublicContact {
  phone?: string;
  whatsapp?: string;
  email?: string;
  /** true = le contact existe mais reste masqué → formulaire PUB-06. */
  masked: boolean;
  requestAvailable: boolean;
}

export interface PublicFarm {
  slug: string;
  name: string;
  description: string | null;
  countryCode: string;
  adminPath: {
    province: string | null;
    territory: string | null;
    sector: string | null;
    village: string | null;
  };
  /** Position volontairement approximative (MAP-04 / SEC-12). */
  location: { type: 'Point'; coordinates: [number, number]; precision: string } | null;
  totalAreaHa: number | null;
  workers: number | null;
  capacity: string | null;
  foundedYear: number | null;
  crops: Array<{ slug: string; name: string }>;
  gallery: Array<{ url: string; caption: string | null; kind: string }>;
  plotsCount: number;
  contact: PublicContact;
  /** VER-04 — « vérifié par AGRIKONNECT » ≠ « déclaré par le producteur ». */
  verification: { status: string; verifiedAt: string | null; label: string };
  owner: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  seo: { indexable: boolean; robots: string; canonicalUrl: string };
  viewCount: number;
  source: string;
  updatedAt: string;
}

export interface PublicFarmPage {
  slug: string;
  canonicalSlug: string;
  redirectedFrom: string | null;
  farm: PublicFarm;
  share: {
    url: string;
    openGraph: { title: string; description: string; image: string | null; type: string };
  };
}

export interface MapFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    slug: string;
    name: string;
    countryCode: string;
    province: string | null;
    totalAreaHa: number | null;
    crops: string[];
    verified: boolean;
    precision: 'approximate';
  };
}

export interface MapResult {
  type: 'FeatureCollection';
  features: MapFeature[];
  meta: {
    count: number;
    bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
    clustering: 'client';
    note: string;
  };
}

export interface SoilStatsResult {
  kAnonymity: number;
  rows: Array<{
    countryCode: string;
    assessments: number;
    parameters: Array<{ parameter: string; mean: number; samples: number; published: boolean }>;
    withheldParameters: string[];
  }>;
  suppressedGroups: Array<{ countryCode: string; assessments: number; reason: string }>;
  provenance: { method: string; individuals: string; rule: string };
}

export interface PublicLot {
  code: string;
  status: string;
  createdAt: string;
  published: Record<string, unknown>;
  timeline: Array<{ type: string; at: string }>;
  crop: { slug: string; name: string } | null;
  /** La fiche publique n'est jamais une certification — le serveur le dit. */
  verification: { certification: false; note: string };
  disclosure: { rule: string; hiddenFields: string[] };
}

export interface ContactFarmPayload {
  name?: string;
  email?: string;
  phone?: string;
  message: string;
  /** Pot de miel anti-spam : doit rester vide. */
  website?: string;
}

// ─── Données métier (session requise) ─────────────────────────

export interface MarketPrice {
  id: string;
  cropId: string;
  market: string;
  city: string | null;
  countryCode: string;
  price: number;
  currency: string;
  unit: string;
  observedAt: string;
  source: string;
  sourceLabel: string | null;
  createdAt: string;
}

export interface PriceListResult {
  items: MarketPrice[];
  available?: boolean;
  message?: string;
  count?: number;
  period?: { from: string; to: string };
  sources?: string[];
}

export interface PriceSeriesPoint {
  observedAt: string;
  price: number;
  market: string;
  source: string;
}

export interface PriceSeriesResult {
  cropId: string;
  available: boolean;
  points: PriceSeriesPoint[];
  message?: string;
  average?: number;
  min?: number;
  max?: number;
}

export interface WeatherRecord {
  id: string;
  plotId: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  observedAt: string;
  source: string;
  confidence: string | null;
  payload: Record<string, unknown>;
}

export interface WeatherForPlot {
  plotId: string;
  available: boolean;
  message?: string;
  actionSuggestion?: string;
  latest?: { observedAt: string; source: string; confidence: string | null; payload: Record<string, unknown> };
  records?: WeatherRecord[];
  freshness?: { ageHours: number; stale: boolean; warning: string | null };
}

export interface Tender {
  id: string;
  buyerOrgId: string;
  title: string;
  description: string | null;
  cropId: string | null;
  quantity: number;
  unit: string;
  quality: string | null;
  destinationCountry: string;
  certifications: string[];
  deadline: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenderListResult {
  items: Tender[];
  total: number;
}

export interface Farm {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  countryCode: string;
  province: string | null;
  totalAreaHa: number | null;
  isPublic: boolean;
  verificationStatus: string | null;
  source: string;
  updatedAt: string;
}

export type GeometryType = 'POINT' | 'POLYGON' | 'MULTIPOLYGON';

export interface Plot {
  id: string;
  farmId: string;
  name: string;
  areaHa: number | null;
  geometryType: GeometryType;
  geometry: unknown;
  latitude: number | null;
  longitude: number | null;
  currentCropId: string | null;
  plantingDate: string | null;
  status: string;
  source: string;
  updatedAt: string;
}

export interface Production {
  id: string;
  farmId: string;
  plotId: string | null;
  cropId: string;
  harvestedAt: string;
  season: string;
  quantity: number;
  unit: string;
  quantityKg: number | null;
  quality: string | null;
  destination: string | null;
  /** `declared` = déclarée, toute autre valeur = mesurée/vérifiée. */
  source: string;
  createdAt: string;
  updatedAt: string;
  /** Relations incluses par GET /productions et GET /productions/:id. */
  crop?: { id: string; slug: string; names: Partial<Record<'fr' | 'en', string>> };
  plot?: { id: string; name: string };
  farm?: { id: string; name: string };
}

/** POST /productions : PROD-02 renvoie la conversion d'unité appliquée. */
export interface ProductionCreated {
  production: Production;
  conversion: {
    quantityKg: number | null;
    convertible: boolean;
    message: string | null;
  };
}

/** GET /productions/stats : agrégats réels (PROD-03), source toujours `declared`. */
export interface ProductionStatsSeries {
  key: string;
  label: string;
  records: number;
  quantityKg: number;
  convertibleRecords: number;
  units: Record<string, number>;
}

export interface ProductionStats {
  groupBy: 'crop' | 'plot' | 'month' | 'year';
  filters: { farmId: string | null; season: string | null; from: string | null; to: string | null };
  totals: {
    records: number;
    quantityKg: number;
    /** Les unités non convertibles ne sont pas additionnées : on ne fabrique pas de total. */
    recordsWithoutKg: number;
  };
  series: ProductionStatsSeries[];
  source: string;
}

export interface Crop {
  id: string;
  slug: string;
  names: Record<string, string> | null;
  category?: string;
  seasonMonths?: number[];
}

/** Un paramètre de sol, tel que renvoyé par le backend (SOIL-01 → SOIL-03). */
export interface SoilParameter {
  key: string;
  /** Valeur brute conservée telle quelle (ex. « limono-argileux »). */
  value: string;
  numericValue: number | null;
  unit: string | null;
  /** declared | estimated | derived | measured_lab | measured_sensor | satellite | photo_interpreted | third_party_verified */
  source: string;
  sourceLabel: string;
  /** ✔ mesuré / ≈ déclaré — CDC §11.6. */
  flag: 'measured' | 'estimated';
  method: string | null;
  confidence: string;
  measuredAt: string | null;
  labReportId: string | null;
}

export interface SoilAssessment {
  id: string;
  plotId: string;
  countryCode: string;
  assessedAt: string;
  notes: string | null;
  source: string;
  version: number;
  parameters: SoilParameter[];
}

/** GET /plots/:id/soil-assessments */
export interface SoilAssessmentList {
  items: SoilAssessment[];
  displayRules: { measured: string; estimated: string; note: string };
  emptyMessage: string | null;
}

/** Profil fusionné multi-sources (SOIL-10 → SOIL-13). */
export interface SoilFusedParameter {
  value: string;
  numericValue: number | null;
  unit: string | null;
  source: string;
  confidence: string;
  measuredAt: string;
  assessmentId: string;
  alternatives: Array<{ value: string; numericValue: number | null; source: string; measuredAt: string }>;
}

/** GET /plots/:id/soil-profile */
export interface SoilProfileResult {
  plotId: string;
  assessment: SoilAssessment | null;
  fusedProfile: Record<string, SoilFusedParameter>;
  sourcesUsed: string[];
  sourcePriority: Array<{ source: string; rank: number }>;
  missingParameters: string[];
  displayRules: { measured: string; estimated: string; note: string };
  /** Avertissement systématique : en V1 le système ne conclut pas. */
  disclaimer: string;
}

/** Ligne brute d'un paramètre de sol (relation Prisma, sans libellé d'affichage). */
export interface SoilParameterRow {
  id: string;
  key: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  source: string;
  method: string | null;
  confidence: string;
  measuredAt: string | null;
  labReportId: string | null;
}

/** Analyse de sol telle qu'incluse dans GET /plots/:id (non mise en forme). */
export interface SoilAssessmentRow {
  id: string;
  plotId: string;
  countryCode: string;
  assessedAt: string;
  notes: string | null;
  source: string;
  version: number;
  parameters: SoilParameterRow[];
}

/** Historique cultural (PLOT-03 / SOIL-03). */
export interface PlotCropHistory {
  id: string;
  plotId: string;
  cropId: string;
  season: string;
  year: number;
  plantedAt: string | null;
  harvestedAt: string | null;
  declaredYield: number | null;
  unit: string | null;
  notes: string | null;
  source: string;
  version: number;
  crop?: { id: string; slug: string; names: Partial<Record<'fr' | 'en', string>> };
}

export interface CropHistoryTimelineEntry {
  id: string;
  label: string;
  year: number;
  season: string;
  cropId: string;
  plantedAt: string | null;
  harvestedAt: string | null;
  declaredYield: number | null;
  unit: string | null;
  source: string;
}

export interface CropHistoryResult {
  items: PlotCropHistory[];
  timeline: CropHistoryTimelineEntry[];
}

/** GET /plots/:id — parcelle avec ses relations. */
export interface PlotDetail extends Plot {
  farm: { id: string; name: string; slug: string; countryCode: string; province: string | null };
  currentCrop: Crop | null;
  histories: PlotCropHistory[];
  media: Array<{ id: string; url: string; kind: string; position: number }>;
  soilAssessments: SoilAssessmentRow[];
}

/** État du moteur géospatial Python (GET /geospatial/health). */
export interface EngineHealth {
  available: boolean;
  engine: string;
  version: string | null;
  latencyMs: number;
  url: string;
  error?: string;
}

export interface GeospatialHealth {
  engine: EngineHealth;
  methodVersion: string;
  ready: boolean;
  note: string;
}

/** Diagnostic de sol persisté (table `soil_diagnostics`). */
export interface SoilDiagnosticRecord {
  id: string;
  plotId: string;
  countryCode: string | null;
  engine: string;
  engineVersion: string;
  methodVersion: string;
  /** Compte des entrées seulement : aucune matrice de pixels n'est stockée. */
  inputs: Record<string, unknown>;
  /** Sortie complète du moteur (fusion, profils, indices…). */
  result: Record<string, unknown>;
  confidence: number | null;
  confidenceLevel: string | null;
  sourcesUsed: string[];
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ligne de GET /plots/:plotId/soil-diagnosis (projection réduite). */
export interface SoilDiagnosticSummary {
  id: string;
  engine: string;
  engineVersion: string;
  methodVersion: string;
  confidence: number | null;
  confidenceLevel: string | null;
  sourcesUsed: string[];
  createdAt: string;
}

export interface SoilDiagnosticList {
  items: SoilDiagnosticSummary[];
  total: number;
  limit: number;
}

/** POST /plots/:plotId/soil-diagnosis */
export interface SoilDiagnosisComputed {
  diagnosis: SoilDiagnosticRecord;
  engine: EngineHealth;
  plot: { id: string; name: string; areaHa: number | null };
  disclaimer: string | null;
}

/** GET /plots/:plotId/soil-diagnosis/latest — 404 si aucun diagnostic. */
export interface SoilDiagnosisLatest {
  diagnosis: SoilDiagnosticRecord;
}

// ─── Intelligence agronomique (S2/S3 — SOIL-04 → SOIL-14) ─────

/** Un critère évalué par le jeu de règles : `met: null` = donnée absente. */
export interface SuitabilityReason {
  label: string;
  expected: string;
  observed: string | null;
  unit?: string | null;
  source?: string | null;
  met: boolean | null;
  reason?: string;
}

export type SuitabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENTLY_DOCUMENTED';

export interface Suitability {
  id: string;
  plotId: string;
  cropId: string;
  level: SuitabilityLevel;
  levelLabel: string;
  ruleSetVersion: string;
  ruleSetId: string | null;
  confidence: string;
  coverage: number | null;
  reasons: SuitabilityReason[];
  missingData: Array<{ key: string; expected: string }>;
  usedData: { sources: string[]; parameterCount: number };
  generatedAt: string;
  disclaimer: string;
  /** SOIL-08 — réponse « pourquoi ? » prête à afficher. */
  explanation: {
    summary: string;
    satisfied: string[];
    unsatisfied: string[];
    missing: string[];
  };
}

export interface SuitabilityList {
  items: Suitability[];
  count: number;
}

export interface RotationStep {
  year: number;
  cropSlug: string;
  family: string | null;
  rationale: string | null;
  checks: string[];
}

export interface RotationPlan {
  id: string;
  plotId: string;
  horizonYears: number;
  ruleSetVersion: string;
  steps: {
    sequence: RotationStep[];
    ruleSetId: string;
    zone: string;
    assumptions: string[];
  };
  alternatives: { options: string[] };
  /** PROPOSED tant qu'aucune décision humaine n'est enregistrée. */
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | string;
  disclaimer: string;
  createdAt: string;
}

export interface RotationPlanList {
  items: RotationPlan[];
  count: number;
}

export interface FarmingPlanEntry {
  year: number;
  cropSlug: string | null;
  activity: string;
  window: { startMonth: number; endMonth: number };
  rationale: string | null;
}

export interface FarmingPlanCheckpoint {
  year: number;
  activity: string;
  window: { startMonth: number; endMonth: number };
  metric: string | null;
}

export interface FarmingPlan {
  id: string;
  plotId: string;
  rotationPlanId: string | null;
  horizonYears: number;
  calendar: { entries: FarmingPlanEntry[]; ruleSetVersion: string };
  checkpoints: { items: FarmingPlanCheckpoint[] };
  createdAt: string;
}

export interface FarmingPlanList {
  items: FarmingPlan[];
  count: number;
}

/** SOIL-14 — toujours une fourchette, jamais un chiffre unique. */
export interface YieldEstimate {
  id: string;
  plotId: string;
  cropId: string;
  lowKg: number;
  highKg: number;
  pointKg: number;
  uncertaintyPct: number;
  assumptions: {
    areaHa: number;
    lowKgPerHa: number;
    highKgPerHa: number;
    adequacyFactor: number;
    note: string;
  };
  sources: {
    ruleSetVersion: string;
    soilSources: string[];
    assessmentCount: number;
  };
  method: string;
  ruleSetVersion: string;
  disclaimer: string;
  createdAt: string;
  range: { lowKg: number; pointKg: number; highKg: number; uncertaintyPct: number };
}

export interface YieldEstimateList {
  items: YieldEstimate[];
  count: number;
}

// ─── Marché : annonces, demandes, offres, commandes (V2/V3) ───

export interface Listing {
  id: string;
  organizationId: string;
  type: string;
  cropId: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  quality: string | null;
  indicativePrice: number | null;
  currency: string;
  countryCode: string;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  availableFrom: string | null;
  availableTo: string | null;
  certifications: string[];
  conditions: string | null;
  status: string;
  source: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  crop?: { id: string; slug: string; names: Partial<Record<'fr' | 'en', string>> } | null;
  organization?: { id: string; name: string; type: string } | null;
}

export interface PurchaseRequest {
  id: string;
  buyerOrgId: string;
  cropId: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  quality: string | null;
  budgetPrice: number | null;
  currency: string;
  deliveryCountry: string;
  deliveryProvince: string | null;
  neededBy: string | null;
  conditions: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  crop?: { id: string; slug: string; names: Partial<Record<'fr' | 'en', string>> } | null;
}

export interface Offer {
  id: string;
  requestId: string | null;
  listingId: string | null;
  sellerOrgId: string;
  price: number;
  currency: string;
  quantity: number;
  unit: string;
  conditions: string | null;
  status: string;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  seller?: { id: string; name: string } | null;
}

export interface Order {
  id: string;
  number: string;
  buyerOrgId: string;
  sellerOrgId: string;
  listingId: string | null;
  requestId: string | null;
  offerId: string | null;
  /** Instantané figé à la commande : prix et quantités ne varient plus. */
  snapshot: Record<string, unknown>;
  status: string;
  paymentStatus: string;
  delivery: Record<string, unknown> | null;
  totalAmount: number | null;
  currency: string;
  placedBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  from: string | null;
  to: string;
  actorId: string | null;
  actorOrgId: string | null;
  reason: string | null;
  at: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  openedByOrgId: string;
  reason: string;
  evidence: unknown;
  status: string;
  moderatorId: string | null;
  decision: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  organizationId: string;
  label: string;
  cropId: string | null;
  unit: string;
  lowStockThreshold: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  stock?: number;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: string;
  quantity: number;
  unit: string;
  reason: string | null;
  at: string;
}

export interface Review {
  id: string;
  orderId: string;
  authorOrgId: string;
  targetOrgId: string;
  rating: number;
  comment: string | null;
  response: string | null;
  status: string;
  createdAt: string;
}

export interface ReputationResult {
  organizationId: string;
  reviews: Review[];
  average: number | null;
  count: number;
}

// ─── Messagerie (MSG-01 → MSG-05) ─────────────────────────────

export type ConversationSubject = 'LISTING' | 'ORDER' | 'TRANSPORT' | 'DISPUTE' | 'PROJECT';

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderOrgId: string;
  body: string;
  attachments: string[];
  readBy: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  subjectType: ConversationSubject | null;
  subjectId: string | null;
  participantOrgIds: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  unread: number;
  lastMessage: MessageItem | null;
  otherParticipants: string[];
}

export interface ConversationListResult {
  items: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalUnread: number;
}

export interface ConversationThreadResult {
  items: MessageItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ─── Coopératives & organisations ─────────────────────────────

export interface Cooperative {
  id: string;
  organizationId: string;
  legalStatus: string | null;
  foundedYear: number | null;
  description: string | null;
  province: string | null;
  territory: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string; slug: string | null; countryCode: string } | null;
}

export interface CooperativeMember {
  id: string;
  cooperativeId: string;
  memberUserId: string;
  memberOrganizationId: string | null;
  status: string;
  joinedAt: string | null;
  consentScopes: string[];
  consentRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string | null } | null;
}

export interface CooperativeOverview {
  cooperative: Cooperative;
  members: { total: number; active: number; pending: number };
  [key: string]: unknown;
}

export interface OrganizationSummary {
  id: string;
  type: string;
  name: string;
  slug: string | null;
  description: string | null;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  roles: string[];
  status: string;
  joinedAt: string;
  consentScopes: string[] | null;
  user?: { id: string; firstName: string; lastName: string; email: string | null } | null;
  organization?: OrganizationSummary | null;
}

// ─── Vérification, certifications, IA ─────────────────────────

export interface Verification {
  id: string;
  subjectType: string;
  subjectId: string;
  organizationId: string;
  level: string;
  status: string;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: Array<{ id: string; kind: string; status: string }> | undefined;
}

export interface Certification {
  id: string;
  organizationId: string;
  type: string;
  issuer: string;
  reference: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  documentId: string | null;
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAnalysis {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  status: string;
  plotId: string | null;
  prompt: string | null;
  promptVersion: string | null;
  provider: string | null;
  model: string | null;
  output: Record<string, unknown> | null;
  confidence: number | null;
  /** Avertissement systématique : l'IA ne remplace pas un agronome (AI-10). */
  disclaimer: string | null;
  escalatedTo: string | null;
  escalatedAt: string | null;
  feedback: Record<string, unknown> | null;
  consentGiven: boolean;
  tokensUsed: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Invest (V4) ──────────────────────────────────────────────

export interface Project {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  sector: string;
  countryCode: string;
  province: string | null;
  description: string | null;
  existingAreaHa: number | null;
  targetAreaHa: number | null;
  currentProduction: number | null;
  projectedProduction: number | null;
  fundingNeed: number | null;
  ownContribution: number | null;
  durationMonths: number | null;
  milestones: unknown;
  team: unknown;
  market: unknown;
  risks: unknown;
  impact: unknown;
  fieldStatus: string;
  linkedData: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FundingRequest {
  id: string;
  projectId: string;
  partnerOrgId: string | null;
  partnerName: string | null;
  consentId: string;
  consentAt: string;
  contentSnapshot: Record<string, unknown> | null;
  status: string;
  transmittedAt: string | null;
  createdAt: string;
}

export interface ProgressReport {
  id: string;
  projectId: string;
  period: string;
  production: unknown;
  progress: unknown;
  expenses: unknown;
  photos: string[];
  publishedAt: string;
  createdBy: string | null;
}

export interface ImpactReport {
  id: string;
  projectId: string;
  period: string;
  indicators: Record<string, unknown>;
  source: string;
  publishedAt: string;
}

// ─── Développeurs (API clients & clés) ────────────────────────

export interface ApiKeyItem {
  id: string;
  clientId: string;
  label: string;
  prefix: string;
  status: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiClient {
  id: string;
  organizationId: string;
  name: string;
  contactEmail: string | null;
  scopes: string[];
  status: string;
  dataPurpose: string | null;
  purposeApprovedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  keys?: ApiKeyItem[] | undefined;
}

export interface ApiKeyCreated {
  key: ApiKeyItem;
  /** La clé complète n'est renvoyée qu'à la création. */
  secret: string;
}

export interface ApiUsageResult {
  clientId: string;
  routes: Array<{ route: string; calls: number; errors: number }>;
  total: number;
  window: { days: number };
}

// ─── Transport ────────────────────────────────────────────────

export interface TransportRequest {
  id: string;
  orderId: string;
  requesterOrgId: string;
  pickup: Record<string, unknown> | null;
  dropoff: Record<string, unknown> | null;
  status: string;
  transporterOrgId: string | null;
  proof: unknown;
  createdAt: string;
  updatedAt: string;
}

// ─── Insights agrégés (INS-01 → INS-04, k-anonymat) ───────────

/** Un indicateur publié porte toujours source, méthode et horodatage. */
export interface InsightIndicator {
  /** `null` = non publiable (groupe trop petit) : jamais remplacé par 0. */
  value: number | null;
  unit: string | null;
  source: string;
  method: string;
  computedAt: string;
  reason?: string;
}

export interface InsightsOverview {
  countryCode: string;
  indicators: Record<string, InsightIndicator>;
  disclosure: {
    empty?: boolean;
    message?: string;
    minGroupSize: number;
  };
}

export interface InsightsCrops {
  countryCode: string;
  crops: Array<{
    crop: { id: string; slug: string | null; names: Partial<Record<'fr' | 'en', string>> | null };
    organizations: number;
    volumeKg: number;
    source: string;
    method: string;
  }>;
  suppressed: number;
  suppressedNote: string | null;
  minGroupSize: number;
  disclosure: { personalData: string; caveat: string };
}

export interface InsightsActivity {
  countryCode: string;
  window: number;
  /** Vide si le k-anonymat n'est pas atteint sur la fenêtre. */
  series: Array<{ period: string; listings: number; orders: number; projects: number }>;
  suppressedReason?: string;
  provenance: { source: string; method: string; computedAt: string };
  minGroupSize: number;
}

export interface InsightsDisclosurePolicy {
  minGroupSize: number;
  rules: string[];
  forbidden: string[];
}

// ─── Notifications (NOTIF-01 → NOTIF-03) ──────────────────────

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  channel: NotificationChannel;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** GET /notifications → { items, unreadCount } + meta de pagination. */
export interface NotificationListResult {
  items: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  type: string;
  channel: NotificationChannel;
  enabled: boolean;
}

/** Absence de ligne = valeur par défaut activée (opt-out explicite). */
export interface NotificationPreferencesResult {
  preferences: NotificationPreference[];
  default: { enabled: boolean };
}

// ─── Capteurs IoT (IOT-01 → IOT-04) ───────────────────────────

/** Une mesure capteur, telle qu'ingérée (aucune interpolation). */
export interface SensorReading {
  id: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string | null;
  quality: string | null;
  at: string;
  createdAt: string;
}

/** Ligne d'appareil renvoyée par GET /iot/devices. */
export interface IotDevice {
  id: string;
  label: string;
  plotId: string | null;
  status: string;
  lastSeenAt: string | null;
  /** Muet depuis plus de 24 h : signalé, jamais présenté comme actif. */
  silent: boolean;
  lastReading: SensorReading | null;
  keyRotatedAt: string | null;
}

export interface IotDeviceList {
  items: IotDevice[];
}

/** Enregistrement complet (sans le hash de clé, jamais renvoyé). */
export interface IotDeviceRecord {
  id: string;
  organizationId: string;
  plotId: string | null;
  label: string;
  serialNumber: string | null;
  status: string;
  thresholds: Record<string, { min?: number; max?: number }> | null;
  lastSeenAt: string | null;
  keyRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /iot/devices — la clé n'est visible qu'à cet instant. */
export interface IotDeviceRegistered {
  device: IotDeviceRecord;
  deviceKey: string;
}

export interface IotKeyRotated {
  deviceId: string;
  deviceKey: string;
  warning: string;
}

/** GET /iot/devices/:id/readings — fenêtre, mesures et trous détectés. */
export interface IotReadingsResult {
  device: {
    id: string;
    label: string;
    plotId: string | null;
    thresholds: Record<string, { min?: number; max?: number }> | null;
  };
  readings: SensorReading[];
  window: { since: string; hours: number };
  gaps: Array<{ from: string; to: string; minutes: number }>;
}

// ─── Agriculture de précision (PRE-01 → PRE-03) ───────────────

/** Une zone calculée : géométrie jamais inventée, `basis` liste les sources. */
export interface ManagementZoneEntry {
  index: number;
  label: string;
  geometry: unknown | null;
  basis: string[];
  recommendation: string | null;
}

export interface ManagementZoneVersion {
  id: string;
  methodVersion: string;
  computedAt: string;
  zones: ManagementZoneEntry[];
  sources: {
    available: Array<Record<string, unknown>>;
    missing: string[];
  };
}

/** GET /plots/:plotId/management-zones — historique versionné, jamais réécrit. */
export interface ManagementZoneList {
  plotId: string;
  versions: ManagementZoneVersion[];
  versioning: string;
}

/** POST /plots/:plotId/management-zones */
export interface ManagementZoneComputed {
  managementZones: {
    id: string;
    plotId: string;
    methodVersion: string;
    computedAt: string;
    zones: ManagementZoneEntry[];
    sources: ManagementZoneVersion['sources'];
  };
  justification: {
    methodVersion: string;
    sources: Array<Record<string, unknown>>;
    rule: string;
    requiresFieldValidation: boolean;
  };
}

export interface PrecisionReport {
  id: string;
  plotId: string;
  generatedAt: string;
  pdfKey: string | null;
  ruleSetVersion: string | null;
  methodVersion: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  validated: boolean;
  /** PRE-03 : PROPOSITION_NON_VALIDEE tant qu'aucun agronome n'a validé. */
  status: 'VALIDATED_BY_AGRONOMIST' | 'PROPOSITION_NON_VALIDEE';
}

export interface PrecisionReportList {
  plotId: string;
  reports: PrecisionReport[];
}

export interface PrecisionReportCreated {
  report: PrecisionReport;
  status: string;
  disclaimer: string;
}

export interface PrecisionReportValidated {
  report: PrecisionReport;
  validated: true;
  notice: string;
}

// ─── Pagination d'entrée ──────────────────────────────────────

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
  countryCode?: string;
  province?: string;
  cropId?: string;
  locale?: 'fr' | 'en';
}

// ─── V4 EXPORT — dossiers d'exportation (backend /exports) ────

/**
 * Pièce rattachée à un dossier d'export.
 * Aligné sur le modèle `ExportDocument` : il n'y a ni statut propre à la pièce,
 * ni date d'expiration. La conformité est calculée côté serveur à partir des
 * quatre `type` obligatoires.
 */
export interface ExportDocumentRow {
  id: string;
  exportOrderId: string;
  /** INVOICE · CERTIFICATE_OF_ORIGIN · PHYTOSANITARY · BILL_OF_LADING */
  type: string;
  name: string;
  storageKey: string | null;
  issuedAt: string;
}

export type ExportOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'IN_CONTROL'
  | 'CERTIFIED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';

export interface ExportOrderRow {
  id: string;
  reference: string;
  sellerOrgId: string;
  buyerOrgId: string | null;
  tenderId: string | null;
  status: ExportOrderStatus;
  incoterm: string | null;
  destinationCountry: string;
  logisticsPartnerOrgId: string | null;
  steps: Record<string, unknown> | null;
  totalAmount: number | null;
  currency: string;
  fxRate: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
}

export interface ExportOrderList {
  items: ExportOrderRow[];
  total: number;
  page: number;
  limit: number;
}

/** GET /exports/:id — conformité documentaire + conversion de change. */
export interface ExportOrderDetail {
  exportOrder: ExportOrderRow & { documents: ExportDocumentRow[] };
  compliance: {
    required: Array<{ type: string; label: string; present: boolean }>;
    missing: string[];
    canBeCertified: boolean;
  };
  finance: {
    totalAmount: unknown;
    currency: string;
    fxRate: unknown;
    conversion: { amount: number | null; error?: string };
  };
}

// ─── V3 SYNC — synchronisation hors ligne (backend /sync) ─────

export interface SyncOperation {
  opId: string;
  collection: string;
  operation: string;
  entityId: string;
  result: string;
  appliedAt: string | null;
}

export interface SyncConflictRow {
  opId: string;
  collection: string;
  entityId: string;
  reason: string;
  clientValue?: unknown;
  serverValue?: unknown;
  detectedAt?: string;
}

export interface SyncCollectionsResult {
  collections: Array<{ name: string; operations: string[]; softDelete: boolean }>;
  policy: string;
}

export interface SyncPullResult {
  since: string;
  cursor: string;
  hasMore: boolean;
  counts: Record<string, number>;
  changes: Record<string, Array<Record<string, unknown>>>;
  policy: { softDelete: boolean; tombstones: string; conflictResolution: string };
}

export interface SyncConflictsResult {
  window: { since: string; days: number };
  conflicts: SyncOperation[];
  operations: SyncOperation[];
  policy: string;
}

// ─── Satellite ────────────────────────────────────────────────
//
// Un satellite mesure la surface (humidité, température, végétation), jamais le
// sous-sol. `measuresSubsurface: false` accompagne donc chaque réponse : sans ce
// rappel, une valeur de surface serait lue comme une mesure de subsoil.

export type DataMode = 'REAL' | 'CONFIGURATION' | 'SIMULATED';
export type Confidence = 'high' | 'medium' | 'low';

export interface SatelliteSource {
  id: string;
  mission: string;
  sensor: string;
  cloudInsensitive: boolean;
  /** Un satellite ne mesure jamais le sous-sol : toujours `false`. */
  measuresSubsurface: boolean;
  confidence: Confidence;
  role: string;
}

export interface SatelliteSettings {
  provider: string;
  enabled: boolean;
  providers: string[];
  refreshHours: number;
  sceneLookbackDays: number;
  primaryMoistureSource: string;
  cloudCoverRejectPct: number;
  sources: SatelliteSource[];
  subsoilCaveat?: string;
}

export interface SatelliteObservation {
  id: string;
  plotId: string;
  provider: string;
  index: string;
  value: number;
  observedAt: string;
  cloudCover: number | null;
  confidence: Confidence;
  mode: DataMode;
  createdAt: string;
}

export interface SatelliteObservationList {
  plotId: string;
  items: SatelliteObservation[];
  count: number;
  settings: SatelliteSettings;
  /** Rappel contractuel : ces valeurs ne décrivent pas le sous-sol. */
  measuresSubsurface: false;
}

export interface SatelliteAcquisition {
  plotId: string;
  acquired: boolean;
  rejected?: boolean;
  reason?: string;
  observation?: SatelliteObservation;
}

// ─── Moteur de recommandation ─────────────────────────────────
//
// Répond à la question du cahier des charges : quoi semer sur une durée donnée,
// à partir de l'état réel du sol et du sous-sol. Sans données suffisantes le
// serveur renvoie `INSUFFICIENT_DATA` et aucun classement : rien n'est deviné.

export type RecommendationStatus =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'INSUFFICIENT_DATA'
  | 'PENDING';

/** Une culture classée, avec ce qui a servi à la classer. */
export interface RecommendationScore {
  cropSlug: string;
  label: string;
  /**
   * Score d'**adéquation** de 0 à 1 : dans quelle mesure l'état mesuré convient
   * à la culture. Ce n'est ni un rendement attendu ni une probabilité de
   * réussite.
   */
  score: number;
  /** Version du moteur ayant produit ce score — figée à l'écriture. */
  engineVersion?: string;
  /** Règle de combinaison : `MOST_LIMITING` (2.0) ou `MEAN_SATISFIED` (1.0). */
  combinationRule?: string;
  /**
   * Libellé de la règle, fourni par l'API.
   *
   * À afficher **tel quel**. Un écran qui recopie les libellés en dur n'affiche
   * rien pour une règle qu'il ne connaît pas : une règle nouvelle passerait
   * inaperçue au lieu d'être nommée.
   */
  combinationRuleLabel?: string;
  combinationRuleDescription?: string | null;
  /** `GRADED_FOUR_LIMITS` (2.0) ou `BINARY_SATISFIED` (1.0). */
  scoringModel?: string;
  scoringModelLabel?: string;
  /** Part des critères réellement évalués : sous 0.6 la culture n'est pas classée. */
  coverage: number;
  plantingWindow: Record<string, unknown> | null;
  cycleDays: number | null;
  criteria: Array<Record<string, unknown>>;
  /**
   * Critères sans donnée fiable — jamais complétés par une estimation.
   *
   * **Objets, pas chaînes.** Le type déclarait `string[]` : `.join(', ')`
   * compilait donc, et affichait `[object Object], [object Object]` à
   * l'écran. Chaque entrée porte son libellé et la raison de l'absence.
   */
  notEvaluated: NotEvaluatedCriterion[];
  /**
   * Nombre de critères réellement évalués.
   *
   * Avec la règle du facteur le plus limitant, un paramètre non mesuré est
   * ignoré : sans ce champ, un score élevé pourrait reposer sur un seul
   * critère sans que l'écran puisse le dire.
   */
  evaluatedCount?: number;
  /** Sous le minimum de critères : la culture n'est pas classable. */
  tooFewCriteria?: boolean;
}

/** Un critère écarté du calcul, avec la raison de son absence. */
export interface NotEvaluatedCriterion {
  key: string;
  label: string;
  reason: string;
  /** `NO_REFERENCE` (aucune plage fiable) ou `NO_MEASUREMENT` (aucune mesure). */
  cause: 'NO_REFERENCE' | 'NO_MEASUREMENT' | string;
}

export interface RecommendationExplanation {
  language: string;
  indicative: boolean;
  indicativeReasons: string[];
  period: { start: string; end: string; days: number };
  province: string;
  reference: {
    datasetLabel: string;
    calendarStatus: string | null;
    calendarValidated: boolean;
    rangesProvisional: boolean;
  };
  satellite?: Record<string, unknown>;
}

export interface CropRecommendation {
  id: string;
  organizationId: string;
  plotId: string;
  periodStart: string;
  periodEnd: string;
  requestedDays: number;
  status: RecommendationStatus;
  mode: DataMode;
  /** Classement, du meilleur score au moins bon. Vide si données insuffisantes. */
  scores: RecommendationScore[];
  referenceMeasurements: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  decomposition: {
    methodVersion: string;
    eliminated: Array<{ cropSlug: string; label: string; reason: string }>;
    insufficientData: Array<{ cropSlug: string; label: string; coverage: number }>;
    indicativeReasons?: string[];
  } | null;
  explanation: RecommendationExplanation | null;
  /**
   * Version du moteur ayant produit ces scores, **figée à l'écriture** : si la
   * règle par défaut change, une recommandation ancienne reste lisible sous la
   * règle qui l'a produite.
   */
  ruleSetVersion: string | null;
  modelVersionId: string | null;
  confidence: number | null;
  /** Provenance de chaque mesure ayant fondé le calcul. */
  sources: string[];
  insufficiencyReason: string | null;
  createdAt: string;
}

export interface RecommendationList {
  items: CropRecommendation[];
  count: number;
}

export interface RecommendationCreated {
  recommendation: CropRecommendation;
  /** `true` quand les plages agronomiques utilisées sont provisoires. */
  indicative: boolean;
  indicativeReasons: string[];
  /**
   * Version du moteur et règle de combinaison ayant produit les scores.
   *
   * Sans elles, un pourcentage est ininterprétable : 62 % en moyenne de verdicts
   * binaires et 62 % en minimum de scores gradués ne disent pas la même chose.
   */
  engineVersion: string;
  scoringModel: string;
  scoringModelLabel: string;
  combinationRule: string;
  combinationRuleLabel: string;
  combinationRuleDescription: string | null;
  /**
   * Rappel porté par chaque résultat : le score mesure une **adéquation**, ce
   * n'est ni un rendement attendu ni une probabilité de réussite. À afficher
   * tel quel, pas à reformuler.
   */
  scoreNotice: string;
  dataMode: DataMode;
  /** Présent uniquement quand le mode n'est pas REAL : ne jamais le masquer. */
  dataModeNotice?: string;
  counts: {
    candidates: number;
    ranked: number;
    eliminated: number;
    insufficientData: number;
    readingsUsed: number;
  };
  satellite?: Record<string, unknown>;
}

export interface RecommendationDecision {
  decision: 'ACCEPTED' | 'REJECTED';
  comment?: string;
}

// ─── Alertes de seuil ─────────────────────────────────────────

export type AlertStatus = 'NEW' | 'READ' | 'HANDLED';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
/** `SENSOR_SILENCE` : le capteur n'a rien transmis — absence, pas mauvaise mesure. */
export type AlertSourceType = 'MEASUREMENT' | 'FORECAST' | 'SENSOR_SILENCE';

export interface ThresholdAlert {
  id: string;
  organizationId: string;
  plotId: string | null;
  recommendationId: string | null;
  parameter: string;
  sourceType: AlertSourceType;
  referenceValue: number;
  observedValue: number | null;
  deviation: number | null;
  severity: AlertSeverity;
  status: AlertStatus;
  episodeKey: string;
  /** Canaux réellement envoyés — le SMS est le canal primaire. */
  channelsSent: string[];
  notifiedAt: string | null;
  lastNotifiedAt: string | null;
  notificationCount: number;
  observedAt: string | null;
  predictedBreachAt: string | null;
  /** `true` quand l'alerte anticipe un franchissement prévu, non constaté. */
  predictive: boolean;
  createdAt: string;
}

/**
 * Plage de référence qui a déclenché l'alerte, lue dans les `thresholds` de la
 * recommandation liée. `null` côté serveur quand la recommandation ne porte pas
 * de seuil pour cette grandeur.
 */
export interface AlertRange {
  min: number | null;
  max: number | null;
  unit: string | null;
  /** Plage formatée par l'API (« 5,5 – 6,8 »), ou `null` si les bornes sont inconnues. */
  label: string | null;
  /** `PROVISIONAL` ou `VALIDATED` : une alerte sur plage provisoire doit le dire. */
  status: string | null;
  derivedFrom: string | null;
}

/** Une valeur d'enum nommée par l'API, pour construire un filtre. */
export interface AlertFilterOption {
  value: string;
  label: string;
}

/**
 * Valeurs de filtre de la boîte d'alertes, avec leurs libellés
 * (`GET /alerts/meta`).
 *
 * `open` n'y figure pas : c'est un booléen **exclusif** de `status` (422 sinon).
 * L'écran propose donc un seul sélecteur d'état.
 */
export interface AlertFilterMeta {
  sourceTypes: AlertFilterOption[];
  severities: AlertFilterOption[];
  statuses: AlertFilterOption[];
}

/**
 * Alertes telles que l'API les renvoie : la ligne `ThresholdAlert` **plus** les
 * libellés et la plage.
 *
 * **Additif** — aucun champ d'origine n'est renommé. Les libellés viennent du
 * serveur : une valeur d'enum ajoutée plus tard est nommée dès qu'elle existe,
 * alors qu'une table recopiée dans chaque écran l'oublierait en silence.
 */
export interface DescribedAlert extends ThresholdAlert {
  sourceTypeLabel: string;
  severityLabel: string;
  statusLabel: string;
  parameterLabel: string;
  /** Unité de la grandeur, pour que « 6,1 » ne soit pas un nombre nu. */
  unit: string | null;
  range: AlertRange | null;
  observedLabel: string | null;
  referenceLabel: string;
}

export interface AlertList {
  items: DescribedAlert[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Alertes non traitées — évite un second aller-retour pour le compteur. */
  openCount: number;
}

// ─── Anomalies de mesure ──────────────────────────────────────

export type AnomalyStatus = 'NEW' | 'CONFIRMED' | 'DISMISSED';
export type AnomalyReason =
  | 'OUT_OF_RANGE'
  | 'IMPOSSIBLE_JUMP'
  | 'FROZEN_VALUE'
  | 'STATISTICAL_OUTLIER'
  | 'SILENT';

export interface SensorAnomaly {
  id: string;
  organizationId: string;
  deviceId: string;
  readingId: string | null;
  reason: AnomalyReason;
  severity: AlertSeverity;
  status: AnomalyStatus;
  details: Record<string, unknown>;
  episodeKey: string;
  detectedAt: string;
  /** Une donnée SIMULATED n'est jamais présentée comme une mesure physique. */
  mode: DataMode;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AnomalySettings {
  enabled: boolean;
  thresholds: Array<{ path: string; value: number | null; unit: string | null; source: string }>;
  silenceHandledBy: string;
}

/** Une détection sans assez de mesures est un 200 avec `detected: false`. */
export interface AnomalyDetectionResult {
  detected: boolean;
  reason?: string;
  devicesScanned?: number;
  analysed?: number;
  anomalies?: number;
  items?: SensorAnomaly[];
}

export interface AnomalyReviewResult {
  anomaly: SensorAnomaly;
  /** `false` après un rejet : la mesure réintègre immédiatement le calcul. */
  readingExcluded: boolean;
}

// ─── Référentiel agronomique ──────────────────────────────────
//
// Une plage VALIDATED fait sortir les recommandations du régime « indicatif » :
// la validation exige un validateur nommé et une source citable.

/**
 * Nature de la provenance d'une fourchette.
 *
 * Trois valeurs seulement : attribuer un type par défaut reviendrait à inventer
 * une provenance, ce que le suivi de source doit justement empêcher.
 */
export type RangeSourceType = 'AGRONOMIST' | 'PUBLICATION' | 'PILOT';

export type RangeStatus = 'PROVISIONAL' | 'VALIDATED' | 'RETIRED';

/** Les cinq paramètres du référentiel — le vocabulaire réel des analyses de sol. */
export type RangeParameterKey = 'ph' | 'airTemperatureC' | 'moisture' | 'ec' | 'depthCm';

export interface CropAgronomicRange {
  id: string;
  organizationId: string | null;
  cropSlug: string;
  /** Nom scientifique, à titre documentaire : l'appariement se fait sur le slug. */
  scientificName: string | null;
  parameterKey: RangeParameterKey;
  minValue: number;
  maxValue: number;
  /**
   * Borne basse tolérée. `null` = non renseignée : le moteur se limite alors à
   * un verdict binaire, il n'invente pas de limite.
   */
  toleratedMin: number | null;
  /** Borne haute tolérée. Même règle que `toleratedMin`. */
  toleratedMax: number | null;
  unit: string;
  status: RangeStatus;
  /** Nature de la provenance. `null` = non déclarée. */
  sourceType: RangeSourceType | null;
  sourceReference: string | null;
  sourceNote: string | null;
  /** Zone concernée par la fourchette. `null` = non circonscrite. */
  zone: string | null;
  datasetLabel: string;
  validatedBy: string | null;
  validatedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgronomicRangeList {
  items: CropAgronomicRange[];
  count: number;
}

export interface AgronomicRangeMeta {
  parameters: Array<{ key: RangeParameterKey; unit: Record<string, unknown> | null }>;
  physicalBounds: Record<string, { min: number; max: number }>;
}

export interface AgronomicRangeImportTemplate {
  header: string[];
  example: string[];
  columns: Record<string, string[]>;
  parameters: RangeParameterKey[];
  physicalBounds: Record<string, { min: number; max: number }>;
  csv: string;
  notes: string[];
}

export interface AgronomicRangeImportResult {
  summary: {
    totalLines: number;
    created: number;
    updated: number;
    skippedValidated: number;
    /**
     * Lignes **sans valeurs idéales**, ignorées sans être des erreurs : lignes
     * de séparation, total, ou cultures dont la fourchette n'est pas encore
     * établie. Les compter comme des erreurs noierait les vrais problèmes.
     */
    skippedEmpty: number;
    errors: number;
    dryRun: boolean;
  };
  results: Array<{
    line: number;
    cropSlug: string | null;
    parameterKey: string | null;
    outcome: 'CREATED' | 'UPDATED' | 'WOULD_CREATE' | 'WOULD_UPDATE' | 'SKIPPED_VALIDATED' | 'ERROR';
    id?: string;
    reason?: string;
  }>;
}

// ─── Consentement SMS (canal d'alerte primaire) ────────────────

/**
 * État d'un consentement SMS.
 *
 * `WITHDRAWN` n'est pas supprimé de la base : la trace est la preuve que
 * l'envoi a cessé, et qu'il avait commencé quelque part.
 */
export type SmsConsentStatus = 'GRANTED' | 'WITHDRAWN';

export interface SmsConsent {
  id: string;
  /** Usage couvert : `ALERT` (alertes agronomiques), `OTP` (codes)… */
  purpose: string;
  status: SmsConsentStatus;
  /** Où le consentement a été donné : `IN_APP`, `IMPORT`… */
  method: string;
  grantedAt: string;
  withdrawnAt: string | null;
  /** Version du texte présenté. Un texte modifié exige un nouveau consentement. */
  noticeVersion: string | null;
}

export interface SmsConsentListResult {
  items: SmsConsent[];
  count: number;
  /**
   * Toujours `false` en RDC : Twilio n'y propose pas de SMS bidirectionnel,
   * donc aucun STOP/HELP par réponse au message.
   */
  twoWaySupported: boolean;
  /** Comment se désinscrire, rappelé par l'API plutôt que recopié par écran. */
  optOutNotice: string;
}

// ─── Retours de saison (rendement réellement obtenu) ───────────

/**
 * Source d'un rendement déclaré.
 *
 * `satellite`, `derived` et `estimated` sont **exclus** : un retour de saison
 * est une observation de ce qui a été récolté, pas un calcul. Le backend les
 * refuse en 422.
 */
export type SeasonFeedbackSource = 'declared' | 'third_party_verified' | 'measured_lab';

export interface SeasonFeedback {
  id: string;
  organizationId: string;
  plotId: string;
  cropId: string;
  recommendationId: string | null;
  season: string;
  year: number;
  periodStart: string;
  periodEnd: string;
  /** Rendement **total** récolté, en kilogrammes. */
  actualYieldKg: number;
  areaHa: number | null;
  unit: string | null;
  observations: string | null;
  source: SeasonFeedbackSource;
  /**
   * Calculé à la lecture, jamais stocké. `null` quand la surface est inconnue :
   * on ne sait rien, ce n'est pas un rendement de zéro.
   */
  yieldPerHa: number | null;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  crop?: { id: string; slug: string; names: unknown } | null;
  plot?: { id: string; name: string } | null;
}

export interface SeasonFeedbackStatsGroup {
  key: string;
  label: string;
  feedbackCount: number;
  totalYieldKg: number;
  totalAreaHa: number;
  /** Retours sans surface : exclus de la moyenne, jamais devinés. */
  withoutArea: number;
  /** `null` quand aucune surface n'est connue. */
  yieldPerHa: number | null;
}

export interface SeasonFeedbackStats {
  groupBy: 'crop' | 'plot' | 'season' | 'year';
  groups: SeasonFeedbackStatsGroup[];
  feedbackCount: number;
  withoutAreaCount: number;
}

/**
 * Rapprochement avec la recommandation.
 *
 * **Aucun champ de verdict n'existe**, et aucun ne doit être ajouté : le score
 * mesure une adéquation, pas un rendement attendu. Un écran qui afficherait
 * « la recommandation s'est trompée » attribuerait au classement du sol des
 * effets qui viennent du climat, des ravageurs ou de la récolte.
 */
export interface SeasonFeedbackComparison {
  comparable: boolean;
  reason?: string;
  seasonFeedback: SeasonFeedback | null;
  recommendation: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    ruleSetVersion: string | null;
    cultureRank: {
      cropId: string;
      score: number | null;
      rank: number;
      eliminated: boolean;
    } | null;
    culturesClassified: number;
  } | null;
  /** Rappel obligatoire, à afficher tel quel à côté des deux valeurs. */
  scoreNote: string | null;
}
