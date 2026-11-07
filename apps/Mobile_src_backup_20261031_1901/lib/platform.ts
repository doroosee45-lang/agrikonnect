import type { Ionicons } from '@expo/vector-icons';

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
    title: 'Traçabilité des lots',
    body: 'Un code unique par lot, de la parcelle à la livraison.',
    detail:
      'Chaque lot porte un code (ex. AK-CI-2026-00001) et un journal d’étapes horodaté. Le producteur choisit les champs publiés ; la fiche publique accessible par QR ne contient ni identifiant technique, ni acteur, ni localisation d’événement. Un rappel de lot est tracé et visible.',
    href: '/public-site/lot',
    requiresAuth: false,
    tone: 'forest',
    cdc: ['TRC-01', 'TRC-02', 'TRC-03'],
  },
  {
    id: 'mapping',
    icon: 'map-outline',
    title: 'Cartographie des parcelles',
    body: 'Délimitation, surface et historique cultural.',
    detail:
      'Les parcelles sont créées par point ou par polygone, avec leur surface et leur culture courante. Les positions publiées sont arrondies côté serveur : la coordonnée exacte ne quitte jamais la plateforme. Le regroupement des points est laissé au client.',
    href: '/explore',
    requiresAuth: false,
    tone: 'living',
    cdc: ['MAP-01', 'MAP-02', 'MAP-03', 'MAP-04'],
  },
  {
    id: 'soil',
    icon: 'flask-outline',
    title: 'Diagnostic de sol',
    body: 'Fusion pondérée des analyses, capteurs et imagerie.',
    detail:
      'Le moteur géospatial pondère chaque source par sa fiabilité, sa qualité et sa fraîcheur (demi-vie de 365 jours). Les sources en désaccord restent visibles, les avertissements sont affichés, et aucune recommandation n’est déclenchée automatiquement.',
    href: '/farmer/soil',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['SOIL-01', 'SOIL-15', 'SOIL-16', 'AI-10'],
  },
  {
    id: 'prices',
    icon: 'pricetags-outline',
    title: 'Prix de marché',
    body: 'Relevés datés et sourcés, marché par marché.',
    detail:
      'Chaque relevé porte son marché, sa devise, son unité, sa date d’observation et sa source. En l’absence de relevé, l’écran indique qu’aucun prix n’est disponible — aucun prix estimé n’est publié sans source.',
    href: '/prices',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['PRC-01', 'PRC-02', 'PRC-10'],
  },
  {
    id: 'weather',
    icon: 'partly-sunny-outline',
    title: 'Météo agricole',
    body: 'Observations rattachées à la parcelle.',
    detail:
      'Les données météo sont rattachées à une parcelle ou à des coordonnées explicites, avec leur source et leur niveau de confiance. Au-delà de 24 heures, un avertissement de fraîcheur s’affiche.',
    href: '/weather',
    requiresAuth: true,
    tone: 'info',
    cdc: ['WX-01', 'WX-02'],
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    title: 'Marché & mise en relation',
    body: 'Annonces, demandes, offres, commandes.',
    detail:
      'Les annonces et demandes d’achat débouchent sur des offres, puis des commandes suivies étape par étape. Les coordonnées des parties ne transitent pas : la relation passe par la messagerie interne, avec signalement et blocage possibles.',
    href: '/marches',
    requiresAuth: true,
    tone: 'forest',
    cdc: ['MKT-01', 'MKT-02', 'ORD-01'],
  },
  {
    id: 'transport',
    icon: 'car-outline',
    title: 'Transport & logistique',
    body: 'Demandes de transport et preuve de livraison.',
    detail:
      'Les demandes de transport sont rattachées à une commande et à un lot, avec suivi du chargement et preuve de livraison horodatée.',
    href: '/marches',
    requiresAuth: true,
    tone: 'info',
    cdc: ['TRP-01', 'TRP-02'],
  },
  {
    id: 'invest',
    icon: 'trending-up-outline',
    title: 'Investissement & projets',
    body: 'Dossiers, dataroom, due diligence, reporting.',
    detail:
      'Les dossiers de projet suivent un cycle de soumission et de revue. La dataroom donne un accès limité dans le temps (30 jours par défaut, 90 au plus), journalisé. Le reporting d’avancement et d’impact est versionné.',
    href: '/projets',
    requiresAuth: true,
    tone: 'living',
    cdc: ['INV-01', 'DDR-01', 'RPT-01'],
  },
  {
    id: 'tenders',
    icon: 'globe-outline',
    title: 'Appels d’offres',
    body: 'Avis internationaux, volumes et exigences.',
    detail:
      'Les acheteurs publient des avis avec quantité, qualité, certifications exigées, destination et délai. Les réponses sont tracées, l’attribution et la clôture sont journalisées.',
    href: '/tenders',
    requiresAuth: true,
    tone: 'gold',
    cdc: ['TND-01', 'TND-02'],
  },
];

/** Rôles ouvrables en libre-service (les rôles de gouvernance sont attribués). */
export const SELF_SERVICE_ROLES = [
  { id: 'FARMER', label: 'Producteur' },
  { id: 'COOPERATIVE_ADMIN', label: 'Coopérative' },
  { id: 'AGRICULTURAL_COMPANY', label: 'Société agricole' },
  { id: 'BUYER', label: 'Acheteur' },
  { id: 'SUPPLIER', label: 'Fournisseur' },
  { id: 'TRANSPORTER', label: 'Transporteur' },
  { id: 'AGRONOMIST', label: 'Agronome' },
  { id: 'INVESTOR', label: 'Investisseur' },
  { id: 'SUPPORT_AGENT', label: 'Agent d’appui' },
] as const;

/** Calendrier fonctionnel V1 → V5 (périmètre livré). */
export const RELEASE_TRACK = [
  {
    tag: 'V1',
    name: 'FARM',
    body: 'Inscription des producteurs, exploitations, parcelles géolocalisées, productions, analyses de sol, profils publics.',
  },
  {
    tag: 'V2',
    name: 'MARKET',
    body: 'Annonces et demandes d’achat, offres, commandes, messagerie interne, transport, avis et réputation.',
  },
  {
    tag: 'V3',
    name: 'INTELLIGENCE',
    body: 'Prix de marché sourcés, météo par parcelle, traçabilité des lots, certifications, capteurs, synchronisation hors ligne.',
  },
  {
    tag: 'V4',
    name: 'INVEST',
    body: 'Dossiers de projet, dataroom à accès limité, due diligence, reporting d’avancement et d’impact, double authentification.',
  },
  {
    tag: 'V5',
    name: 'GLOBAL',
    body: 'Appels d’offres internationaux, API publique à clé, exports, jeux de données, indicateurs multi-pays, résidence des données par pays.',
  },
] as const;
