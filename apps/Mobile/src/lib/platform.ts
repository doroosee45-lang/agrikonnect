import type { Ionicons } from '@expo/vector-icons';
import { tr } from '@/i18n';

/**
 * Catalogue des services de la plateforme.
 *
 * Source : le périmètre fonctionnel du cahier des charges (V1 → V5) et le
 * routage réel du backend. `requiresAuth` reflète la présence du middleware
 * `authenticate` sur la route correspondante — ce n'est pas une intention,
 * c'est l'état du serveur.
 */
export interface PlatformService {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  detail: string;
  href: string;
  requiresAuth: boolean;
  tone: 'forest' | 'gold' | 'living' | 'info';
  /** Exigences du cahier des charges couvertes par le service. */
  cdc: string[];
}

export const PLATFORM_SERVICES: PlatformService[] = [
  {
    id: 'traceability',
    icon: 'qr-code-outline',
    get title() { return tr('ui.tracabiliteDesLots'); },
    get body() { return tr('ui.unCodeUniqueParLotDe'); },
    get detail() { return tr('ui.chaqueLotPorteUnCodeEx'); },
    href: '/public-site/lot',
    requiresAuth: false,
    tone: 'forest',
    cdc: ['TRC-01', 'TRC-02', 'TRC-03'],
  },
  {
    id: 'mapping',
    icon: 'map-outline',
    get title() { return tr('ui.cartographieDesParcelles'); },
    get body() { return tr('ui.delimitationSurfaceEtHistoriqueCultural'); },
    get detail() { return tr('ui.lesParcellesSontCreeesParPoint'); },
    href: '/explore',
    requiresAuth: false,
    tone: 'living',
    cdc: ['MAP-01', 'MAP-02', 'MAP-03', 'MAP-04'],
  },
  {
    id: 'soil',
    icon: 'flask-outline',
    get title() { return tr('ui.diagnosticDeSol'); },
    get body() { return tr('ui.fusionPondereeDesAnalysesCapteursEt'); },
    get detail() { return tr('ui.leMoteurGeospatialPondereChaqueSource'); },
    href: '/farmer/soil',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['SOIL-01', 'SOIL-15', 'SOIL-16', 'AI-10'],
  },
  {
    id: 'prices',
    icon: 'pricetags-outline',
    get title() { return tr('ui.prixDeMarche'); },
    get body() { return tr('ui.relevesDatesEtSourcesMarchePar'); },
    get detail() { return tr('ui.chaqueRelevePorteSonMarcheSa'); },
    href: '/prices',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['PRC-01', 'PRC-02', 'PRC-10'],
  },
  {
    id: 'weather',
    icon: 'partly-sunny-outline',
    get title() { return tr('ui.meteoAgricole'); },
    get body() { return tr('ui.observationsRattacheesALaParcelle'); },
    get detail() { return tr('ui.lesDonneesMeteoSontRattacheesA'); },
    href: '/weather',
    requiresAuth: true,
    tone: 'info',
    cdc: ['WX-01', 'WX-02'],
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    get title() { return tr('ui.marcheMiseEnRelation'); },
    get body() { return tr('ui.annoncesDemandesOffresCommandes'); },
    get detail() { return tr('ui.lesAnnoncesEtDemandesDAchat'); },
    href: '/marches',
    requiresAuth: true,
    tone: 'forest',
    cdc: ['MKT-01', 'MKT-02', 'ORD-01'],
  },
  {
    id: 'transport',
    icon: 'car-outline',
    get title() { return tr('ui.transportLogistique'); },
    get body() { return tr('ui.demandesDeTransportEtPreuveDe'); },
    get detail() { return tr('ui.lesDemandesDeTransportSontRattachees'); },
    href: '/marches',
    requiresAuth: true,
    tone: 'info',
    cdc: ['TRP-01', 'TRP-02'],
  },
  {
    id: 'invest',
    icon: 'trending-up-outline',
    get title() { return tr('ui.investissementProjets'); },
    get body() { return tr('ui.dossiersDataroomDueDiligenceReporting'); },
    get detail() { return tr('ui.lesDossiersDeProjetSuiventUn'); },
    href: '/projets',
    requiresAuth: true,
    tone: 'living',
    cdc: ['INV-01', 'DDR-01', 'RPT-01'],
  },
  {
    id: 'tenders',
    icon: 'globe-outline',
    get title() { return tr('ui.appelsDOffres'); },
    get body() { return tr('ui.avisInternationauxVolumesEtExigences'); },
    get detail() { return tr('ui.lesAcheteursPublientDesAvisAvec'); },
    href: '/tenders',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['TND-01', 'TND-02'],
  },
];

/** Rôles ouvrables en libre-service (les rôles de gouvernance sont attribués). */
export const SELF_SERVICE_ROLES = [
  { id: 'FARMER', get label() { return tr('ui.producteur'); } },
  { id: 'COOPERATIVE_ADMIN', get label() { return tr('ui.cooperative'); } },
  { id: 'AGRICULTURAL_COMPANY', get label() { return tr('ui.societeAgricole'); } },
  { id: 'BUYER', get label() { return tr('ui.acheteur'); } },
  { id: 'SUPPLIER', get label() { return tr('ui.fournisseur'); } },
  { id: 'TRANSPORTER', get label() { return tr('ui.transporteur'); } },
  { id: 'AGRONOMIST', get label() { return tr('ui.agronome'); } },
  { id: 'INVESTOR', get label() { return tr('ui.investisseur'); } },
  { id: 'SUPPORT_AGENT', get label() { return tr('ui.agentDAppui'); } },
] as const;

/** Calendrier fonctionnel V1 → V5 (périmètre livré). */
export const RELEASE_TRACK = [
  {
    tag: 'V1',
    name: 'FARM',
    get body() { return tr('ui.inscriptionDesProducteursExploitationsParcellesG'); },
  },
  {
    tag: 'V2',
    name: 'MARKET',
    get body() { return tr('ui.annoncesEtDemandesDAchatOffres'); },
  },
  {
    tag: 'V3',
    name: 'INTELLIGENCE',
    get body() { return tr('ui.prixDeMarcheSourcesMeteoPar_f0936'); },
  },
  {
    tag: 'V4',
    name: 'INVEST',
    get body() { return tr('ui.dossiersDeProjetDataroomAAcces'); },
  },
  {
    tag: 'V5',
    name: 'GLOBAL',
    get body() { return tr('ui.appelsDOffresInternationauxApiPublique_bde7c'); },
  },
] as const;
