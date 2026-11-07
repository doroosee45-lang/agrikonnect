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
    title: 'Traçabilité et origine',
    body: 'Chaque lot porte son exploitation, sa parcelle, sa saison et ses contrôles.',
    detail:
      'Code QR par lot, historique immuable, provenance déclarée ou mesurée distinguée à chaque affichage.',
    href: '/public/lots/demo',
    requiresAuth: false,
    tone: 'forest',
    cdc: ['PROV-01', 'PROV-02', 'LOT-01', 'QR-01'],
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    title: 'Marché et commandes',
    body: 'Annonces, demandes d’achat, offres et commandes avec paiement et litiges.',
    detail:
      'Mise en relation structurée, instantané de prix à la validation, suivi de commande et résolution de litiges.',
    href: '/market',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['MKT-01', 'MKT-02', 'ORD-01', 'ORD-02', 'PAY-01', 'DIS-01'],
  },
  {
    id: 'investment',
    icon: 'trending-up-outline',
    title: 'Investissement et projets',
    body: 'Portefeuille de projets, data room, rapports d’impact et financement.',
    detail:
      'Diligence structurée, accès tracé aux documents, suivi de financement et rapports d’impact vérifiables.',
    href: '/investment',
    requiresAuth: true,
    tone: 'living',
    cdc: ['INV-01', 'INV-02', 'INV-03', 'DAT-01', 'FUN-01'],
  },
  {
    id: 'insights',
    icon: 'bar-chart-outline',
    title: 'Données de marché',
    body: 'Prix, volumes et activité agrégés avec seuil de k-anonymat.',
    detail:
      'Agrégats sous seuil masqués, provenance et méthode affichées, aucune donnée personnelle révélée.',
    href: '/insights',
    requiresAuth: true,
    tone: 'info',
    cdc: ['INS-01', 'INS-02', 'INS-03', 'KANO-01'],
  },
  {
    id: 'cooperative',
    icon: 'people-outline',
    title: 'Coopératives',
    body: 'Regroupement de producteurs, volumes consolidés et offres groupées.',
    detail:
      'Gestion des membres, consentement explicite, volumes consolidés et offres groupées traçables.',
    href: '/public/cooperatives',
    requiresAuth: true,
    tone: 'forest',
    cdc: ['COO-01', 'COO-02', 'COO-03'],
  },
  {
    id: 'ai',
    icon: 'sparkles-outline',
    title: 'Assistance IA',
    body: 'Analyses de cultures, documents et copilote, avec escalade humaine.',
    detail:
      'Consentement explicite, avertissements systématiques, escalade vers un agronome identifié.',
    href: '/ai/assistant',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['AI-01', 'AI-02', 'AI-03', 'AI-10'],
  },
];
