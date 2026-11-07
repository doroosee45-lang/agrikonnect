import { QueryClient } from '@tanstack/react-query';

import { IS_WEB } from '@/lib/config';
import { RequestError } from '@/services/types';

/**
 * Cache serveur.
 *
 * Règles choisies pour une connexion africaine réelle (3G/4G instable) :
 * - `staleTime` long sur les données publiques (elles bougent peu) ;
 * - aucun retry sur un 4xx : rejouer un 401/422 ne ferait que saturer le
 *   rate-limit du serveur ;
 * - `gcTime` conservé pour garder l'affichage pendant une coupure réseau ;
 * - `refetchOnWindowFocus` désactivé sur mobile (l'app est mise en arrière-plan
 *   en permanence, ce qui provoquerait des rafales de requêtes).
 */

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof RequestError) {
    if (error.status === 0) return failureCount < 2; // réseau : 2 tentatives
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: IS_WEB,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Fabrique de clés. Toute requête passe par ici : les invalidations sont alors
 * précises (`queryClient.invalidateQueries({ queryKey: queryKeys.plots.all })`).
 */
export const queryKeys = {
  public: {
    all: ['public'] as const,
    map: (params: unknown) => ['public', 'map', params] as const,
    farms: (params: unknown) => ['public', 'farms', params] as const,
    farm: (slug: string) => ['public', 'farm', slug] as const,
    soilStats: (params: unknown) => ['public', 'soil-stats', params] as const,
    lot: (code: string) => ['public', 'lot', code] as const,
  },
  health: ['health'] as const,
  me: ['me'] as const,
  permissions: ['me', 'permissions'] as const,
  crops: {
    all: ['crops'] as const,
    list: (params: unknown) => ['crops', 'list', params] as const,
    one: (id: string) => ['crops', id] as const,
  },
  countries: {
    all: ['countries'] as const,
    one: (code: string) => ['countries', code] as const,
    fx: ['countries', 'fx'] as const,
  },
  farms: {
    all: ['farms'] as const,
    list: (params: unknown) => ['farms', 'list', params] as const,
    one: (id: string) => ['farms', id] as const,
  },
  plots: {
    all: ['plots'] as const,
    list: (params: unknown) => ['plots', 'list', params] as const,
    one: (id: string) => ['plots', id] as const,
    cropHistory: (id: string) => ['plots', id, 'crop-history'] as const,
  },
  productions: {
    all: ['productions'] as const,
    list: (params: unknown) => ['productions', 'list', params] as const,
    stats: (params: unknown) => ['productions', 'stats', params] as const,
  },
  soil: {
    assessments: (plotId: string) => ['soil', plotId, 'assessments'] as const,
    profile: (plotId: string) => ['soil', plotId, 'profile'] as const,
    diagnosisLatest: (plotId: string) => ['soil', plotId, 'diagnosis', 'latest'] as const,
    diagnosisHistory: (plotId: string) => ['soil', plotId, 'diagnosis'] as const,
    suitability: (plotId: string) => ['soil', plotId, 'suitability'] as const,
    rotation: (plotId: string) => ['soil', plotId, 'rotation'] as const,
    farmingPlans: (plotId: string) => ['soil', plotId, 'farming-plans'] as const,
  },
  geoEngine: {
    health: ['geospatial', 'health'] as const,
    methods: ['geospatial', 'methods'] as const,
  },
  /** Capteurs IoT (IOT-01 → IOT-04). */
  iot: {
    devices: ['iot', 'devices'] as const,
    readings: (deviceId: string, params: unknown) => ['iot', deviceId, 'readings', params] as const,
  },
  prices: {
    all: ['prices'] as const,
    list: (params: unknown) => ['prices', 'list', params] as const,
    series: (params: unknown) => ['prices', 'series', params] as const,
    stale: ['prices', 'stale'] as const,
  },
  weather: {
    forPlot: (plotId: string, params: unknown) => ['weather', plotId, params] as const,
    alerts: (plotId: string) => ['weather', plotId, 'alerts'] as const,
  },
  tenders: {
    all: ['tenders'] as const,
    list: (params: unknown) => ['tenders', 'list', params] as const,
    one: (id: string) => ['tenders', id] as const,
  },
  listings: {
    all: ['listings'] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    one: (id: string) => ['listings', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params: unknown) => ['orders', 'list', params] as const,
    one: (id: string) => ['orders', id] as const,
  },
  lots: {
    all: ['lots'] as const,
    list: (params: unknown) => ['lots', 'list', params] as const,
    one: (id: string) => ['lots', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (params: unknown) => ['projects', 'list', params] as const,
    one: (id: string) => ['projects', id] as const,
  },
  insights: {
    overview: (params: unknown) => ['insights', 'overview', params] as const,
    crops: (params: unknown) => ['insights', 'crops', params] as const,
    activity: ['insights', 'activity'] as const,
    disclosure: ['insights', 'disclosure-policy'] as const,
  },
  dashboard: {
    farmer: ['dashboard', 'farmer'] as const,
    invest: ['dashboard', 'invest'] as const,
  },
  messaging: {
    conversations: ['messaging', 'conversations'] as const,
    messages: (conversationId: string) => ['messaging', 'conversations', conversationId, 'messages'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
    preferences: ['notifications', 'preferences'] as const,
  },
  /** Consentement SMS — canal d'alerte primaire, désinscription dans l'app. */
  sms: {
    all: ['sms'] as const,
    consent: ['sms', 'consent'] as const,
  },
  /** Retours de saison — rendement réellement obtenu. */
  seasons: {
    all: ['seasons'] as const,
    list: (params: unknown) => ['seasons', 'list', params] as const,
    compare: (id: string) => ['seasons', id, 'compare'] as const,
  },
  /** Demandes d'achat, offres, stock, avis (V2). */
  requests: {
    all: ['requests'] as const,
    list: (params: unknown) => ['requests', 'list', params] as const,
    one: (id: string) => ['requests', id] as const,
    matches: (id: string) => ['requests', id, 'matches'] as const,
    offers: (id: string) => ['requests', id, 'offers'] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    movements: (id: string) => ['inventory', id, 'movements'] as const,
  },
  reviews: {
    reputation: (organizationId: string) => ['reviews', 'reputation', organizationId] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    one: (id: string) => ['organizations', id] as const,
  },
  cooperatives: {
    current: ['cooperatives', 'current'] as const,
    members: (id: string) => ['cooperatives', id, 'members'] as const,
    overview: (id: string) => ['cooperatives', id, 'overview'] as const,
    groupOffers: (id: string) => ['cooperatives', id, 'group-offers'] as const,
  },
  verifications: {
    mine: ['verifications', 'me'] as const,
    queue: (params: unknown) => ['verifications', 'queue', params] as const,
    one: (id: string) => ['verifications', id] as const,
  },
  satellite: {
    settings: ['satellite', 'settings'] as const,
    observations: (plotId: string, params: unknown) => ['satellite', plotId, 'observations', params] as const,
  },
  recommendations: {
    list: (plotId: string, params: unknown) => ['recommendations', plotId, params] as const,
    one: (id: string) => ['recommendations', id] as const,
    explanation: (id: string) => ['recommendations', id, 'explanation'] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (params: unknown) => ['alerts', 'list', params] as const,
    one: (id: string) => ['alerts', id] as const,
    meta: ['alerts', 'meta'] as const,
  },
  agronomicRanges: {
    all: ['agronomicRanges'] as const,
    list: (params: unknown) => ['agronomicRanges', 'list', params] as const,
    meta: ['agronomicRanges', 'meta'] as const,
    template: ['agronomicRanges', 'importTemplate'] as const,
  },
  anomalies: {
    all: ['anomalies'] as const,
    settings: ['anomalies', 'settings'] as const,
    list: (params: unknown) => ['anomalies', 'list', params] as const,
    one: (id: string) => ['anomalies', id] as const,
  },
  exports: {
    all: ['exports'] as const,
    list: (params: unknown) => ['exports', 'list', params] as const,
    one: (id: string) => ['exports', id] as const,
  },
  sync: {
    collections: ['sync', 'collections'] as const,
    pull: (params: unknown) => ['sync', 'pull', params] as const,
    conflicts: (params: unknown) => ['sync', 'conflicts', params] as const,
  },
  certifications: {
    all: ['certifications'] as const,
    forOrganization: (organizationId: string) => ['certifications', 'org', organizationId] as const,
  },
  ai: {
    all: ['ai'] as const,
    list: (params: unknown) => ['ai', 'list', params] as const,
    one: (id: string) => ['ai', id] as const,
  },
  apiClients: {
    all: ['api-clients'] as const,
    usage: (id: string, params: unknown) => ['api-clients', id, 'usage', params] as const,
  },
  invest: {
    projects: (params: unknown) => ['invest', 'projects', params] as const,
    followed: ['invest', 'followed'] as const,
    matches: ['invest', 'matches'] as const,
    profile: ['invest', 'profile'] as const,
    dashboard: ['invest', 'dashboard'] as const,
    dataRoom: (projectId: string) => ['invest', projectId, 'dataroom'] as const,
    funding: (projectId: string) => ['invest', projectId, 'funding'] as const,
    reports: (projectId: string) => ['invest', projectId, 'reports'] as const,
  },
  transport: {
    all: ['transport'] as const,
    list: (params: unknown) => ['transport', 'list', params] as const,
  },
  admin: {
    dashboard: (params: unknown) => ['admin', 'dashboard', params] as const,
    users: (params: unknown) => ['admin', 'users', params] as const,
    /** M2 — fiche utilisateur (U-M2-2). */
    user: (id: string) => ['admin', 'user', id] as const,
    /** M2 — matrice des rôles (U-M2-6). */
    roles: ['admin', 'roles'] as const,
    audit: (params: unknown) => ['admin', 'audit', params] as const,
    jobs: ['admin', 'jobs'] as const,
    monitoringServices: ['admin', 'monitoring', 'services'] as const,
    monitoringHealth: ['admin', 'monitoring', 'health'] as const,
    securityOverview: ['admin', 'security', 'overview'] as const,
    securityPolicy: ['admin', 'security', 'policy'] as const,
    /** M4 — file de modération unifiée (listings, avis, vérifications). */
    operations: (entity: string, params?: unknown) => ['admin', 'operations', entity, params] as const,
    /** M7 — historique des annonces internes. */
    notificationsHistory: ['admin', 'notifications', 'history'] as const,
    settings: ['admin', 'settings'] as const,
  },
} as const;
