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
  icon: string;
  title: string;
  body: string;
  detail: string;
  href: string;
  requiresAuth: boolean;
  tone: 'forest' | 'gold' | 'living' | 'info';
  /** Exigences du cahier des charges couvertes par le service. */
  cdc: string[];
}

export const SERVICES: PlatformService[] = [
  {
    id: 'traceability',
    icon: 'shield-checkmark-outline',
    get title() { return tr('ui.tracabiliteEtOrigine'); },
    get body() { return tr('ui.chaqueLotPorteSonExploitationSa'); },
    get detail() { return tr('ui.codeQrParLotHistoriqueImmuable'); },
    href: '/public/lots/demo',
    requiresAuth: false,
    tone: 'forest',
    cdc: ['PROV-01', 'PROV-02', 'LOT-01', 'QR-01'],
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    get title() { return tr('ui.marcheEtCommandes'); },
    get body() { return tr('ui.annoncesDemandesDAchatOffresEt'); },
    get detail() { return tr('ui.miseEnRelationStructureeInstantaneDe'); },
    href: '/market',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['MKT-01', 'MKT-02', 'ORD-01', 'ORD-02', 'PAY-01', 'DIS-01'],
  },
  {
    id: 'investment',
    icon: 'trending-up-outline',
    get title() { return tr('ui.investissementEtProjets'); },
    get body() { return tr('ui.portefeuilleDeProjetsDataRoomRapports'); },
    get detail() { return tr('ui.diligenceStructureeAccesTraceAuxDocuments'); },
    href: '/investment',
    requiresAuth: true,
    tone: 'living',
    cdc: ['INV-01', 'INV-02', 'INV-03', 'DAT-01', 'FUN-01'],
  },
  {
    id: 'insights',
    icon: 'bar-chart-outline',
    get title() { return tr('ui.donneesDeMarche'); },
    get body() { return tr('ui.prixVolumesEtActiviteAgregesAvec'); },
    get detail() { return tr('ui.agregatsSousSeuilMasquesProvenanceEt'); },
    href: '/insights',
    requiresAuth: true,
    tone: 'info',
    cdc: ['INS-01', 'INS-02', 'INS-03', 'KANO-01'],
  },
  {
    id: 'cooperative',
    icon: 'people-outline',
    get title() { return tr('ui.cooperatives'); },
    get body() { return tr('ui.regroupementDeProducteursVolumesConsolidesEt'); },
    get detail() { return tr('ui.gestionDesMembresConsentementExpliciteVolumes'); },
    href: '/public/cooperatives',
    requiresAuth: true,
    tone: 'forest',
    cdc: ['COO-01', 'COO-02', 'COO-03'],
  },
  {
    id: 'ai',
    icon: 'sparkles-outline',
    get title() { return tr('ui.assistanceIa'); },
    get body() { return tr('ui.analysesDeCulturesDocumentsEtCopilote'); },
    get detail() { return tr('ui.consentementExpliciteAvertissementsSystematiques'); },
    href: '/ai/assistant',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['AI-01', 'AI-02', 'AI-03', 'AI-10'],
  },
];
