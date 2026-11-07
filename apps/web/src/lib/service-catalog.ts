export interface ServiceCatalogItem {
  id: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  imageAlt: string;
  icon: string;
  features: string[];
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: 'traceabilite', title: 'Traçabilité et origine', icon: '◈',
    summary: 'Un QR code par lot, une origine lisible à chaque étape.',
    description: 'Suivez les productions depuis la parcelle jusqu’au marché. La fiche du lot rassemble son historique et distingue clairement les informations déclarées de celles qui ont été mesurées ou vérifiées.',
    image: new URL('../assets/hero/tracabilite-lot.jpg', import.meta.url).href,
    imageAlt: 'Lot de production agricole prêt à être tracé',
    features: ['Code QR et fiche publique pour chaque lot', 'Historique horodaté des opérations et contrôles', 'Origine déclarée distinguée de la provenance mesurée', 'Informations de production consultables sans exposer les données privées'],
  },
  {
    id: 'marche', title: 'Marché et commandes', icon: '↗',
    summary: 'Publiez, trouvez des acheteurs et suivez les commandes.',
    description: 'La place de marché met en relation producteurs, coopératives, acheteurs et transporteurs. Les annonces, demandes d’achat, offres et commandes sont réunies dans un même parcours.',
    image: new URL('../assets/hero/marche.jpg', import.meta.url).href,
    imageAlt: 'Produits agricoles proposés sur un marché',
    features: ['Annonces de vente et demandes d’achat', 'Offres liées aux besoins et commandes suivies étape par étape', 'Instantané du prix lors de la validation de commande', 'Gestion des stocks, factures, transport et litiges'],
  },
  {
    id: 'investissement', title: 'Investissement et projets', icon: '↗',
    summary: 'Des projets agricoles documentés, du dépôt au suivi d’impact.',
    description: 'Les porteurs présentent leurs projets et partagent des documents dans un espace sécurisé. Les investisseurs peuvent suivre l’avancement, les besoins de financement et les résultats déclarés.',
    image: new URL('../assets/hero/investissement-projet.jpg', import.meta.url).href,
    imageAlt: 'Projet agricole et partenaires de financement',
    features: ['Portefeuille et fiches détaillées de projets', 'Data room avec accès et consultations journalisés', 'Due diligence structurée et suivi des financements', 'Rapports de progrès et d’impact vérifiables'],
  },
  {
    id: 'donnees-marche', title: 'Données de marché', icon: '▥',
    summary: 'Prix, volumes et tendances avec leurs sources.',
    description: 'Consultez les indicateurs agricoles agrégés avec leur période, leur provenance et leur méthode. Les résultats qui ne respectent pas le seuil de confidentialité ne sont pas affichés.',
    image: new URL('../assets/hero/terres-aeriennes.jpg', import.meta.url).href,
    imageAlt: 'Zones agricoles observées depuis le ciel',
    features: ['Prix datés, marchés, unités et sources cités', 'Séries de prix et indicateurs de volumes', 'Agrégats anonymisés soumis au seuil de k-anonymat', 'Catalogue et produits de données avec exports structurés'],
  },
  {
    id: 'cooperatives', title: 'Coopératives', icon: '♧',
    summary: 'Organisez les membres et rassemblez les volumes.',
    description: 'Les organisations agricoles disposent d’outils pour gérer leurs membres, consolider leurs productions et préparer des ventes collectives en gardant la traçabilité des opérations.',
    image: new URL('../assets/hero/cooperative.jpg', import.meta.url).href,
    imageAlt: 'Producteurs réunis au sein d’une coopérative',
    features: ['Profil d’organisation et vérification', 'Invitations, gestion et import des membres', 'Volumes de production consolidés', 'Offres groupées, commandes et appels d’offres'],
  },
  {
    id: 'assistance-ia', title: 'Assistance IA', icon: '✳',
    summary: 'Analysez cultures et documents, avec relais humain.',
    description: 'Le copilote aide à examiner des informations agricoles et des documents. Ses analyses restent identifiées comme telles, et les situations nécessitant un avis professionnel peuvent être transmises à un agronome.',
    image: new URL('../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    imageAlt: 'Technologie numérique utilisée dans une exploitation agricole',
    features: ['Analyse de cultures et de documents', 'Historique des analyses et suivi de consommation', 'Références et limites clairement présentées', 'Possibilité d’escalade vers un agronome'],
  },
  {
    id: 'inspection-sols', title: 'Inspection et diagnostic des sols', icon: '⌁',
    summary: 'Comprenez l’état du sol et du sous-sol de vos parcelles.',
    description: 'Rassemblez les évaluations pédologiques, observations de terrain, mesures de capteurs et données disponibles pour mieux connaître l’état de vos sols. Les sources et leur fraîcheur restent visibles pour éclairer la lecture du diagnostic.',
    image: new URL('../assets/hero/sol-analyse.jpg', import.meta.url).href,
    imageAlt: 'Inspection agronomique du sol dans une parcelle',
    features: ['Évaluations du sol et observations de terrain', 'Lecture des paramètres disponibles et de leur source', 'Cartes pédologiques et zones interpolées lorsqu’elles existent', 'Diagnostic indicatif avec limites et besoin de relecture humaine'],
  },
  {
    id: 'fermes-productions', title: 'Fermes, cultures et productions', icon: '♧',
    summary: 'Gérez parcelles, cultures, saisons et rendements.',
    description: 'Centralisez les informations sur les exploitations, les parcelles et leurs productions. Comparez les rendements réels aux retours de saison et partagez des données structurées avec les membres autorisés.',
    image: new URL('../assets/hero/champs-manioc.jpg', import.meta.url).href,
    imageAlt: 'Cultures vivrières dans une exploitation agricole',
    features: ['Exploitations et parcelles cartographiées', 'Référentiel de cultures et calendrier des saisons', 'Productions, rendements réels et retours de saison', 'Certifications et exports de données'],
  },
  {
    id: 'agriculture-precision', title: 'Technologie et agriculture de précision', icon: '⌖',
    summary: 'Combinez cartographie, satellite et capteurs agricoles.',
    description: 'Des outils géospatiaux et des appareils connectés permettent de suivre les variations d’une parcelle. Les relevés et alertes aident les équipes à repérer les zones qui méritent une inspection.',
    image: new URL('../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    imageAlt: 'Capteurs et outils numériques pour le suivi agricole',
    features: ['Données géographiques et cartes de parcelles', 'Imagerie satellite et indices de végétation disponibles', 'Import de données drone et géoradar', 'Mesures IoT, anomalies et revue par un agronome'],
  },
  {
    id: 'conseils-semis', title: 'Conseils de culture et calendrier de semis', icon: '◷',
    summary: 'Repérez quoi semer et quand, selon les données disponibles.',
    description: 'Les recommandations culturales s’appuient sur un référentiel agronomique vérifiable, la culture et les informations de la parcelle. Elles indiquent leur source et ne remplacent pas la validation d’un spécialiste.',
    image: new URL('../assets/hero/recolte.jpg', import.meta.url).href,
    imageAlt: 'Culture agricole suivie au fil de la saison',
    features: ['Périodes de semis, d’entretien et de récolte', 'Conseils liés aux cultures et à la zone', 'Alertes météo et agronomiques rattachées aux parcelles', 'Recommandations sourcées et relecture humaine si nécessaire'],
  },
];

export const SERVICE_DOMAINS = [
  { title: 'Identité, comptes et accès', text: 'Inscription, connexion, MFA, vérification des coordonnées, profils, organisations, invitations et espace développeur avec clés API et suivi de consommation.' },
  { title: 'Exploitation agricole', text: 'Fermes, parcelles, cultures, diagnostic de sol, saisons, rendements, certifications, recommandations vérifiables et exports.' },
  { title: 'Géospatial, télédétection et IoT', text: 'Cartographie, analyses pédologiques, imagerie satellite, import drone ou géoradar, appareils connectés, mesures et alertes d’anomalie.' },
  { title: 'Marché et commandes', text: 'Annonces, demandes d’achat, offres, commandes, inventaire, avis, transport, facturation et résolution des litiges.' },
  { title: 'Communication et alertes', text: 'Messagerie, notifications, canaux e-mail et SMS avec consentement, alertes agronomiques, quotas et heures silencieuses.' },
  { title: 'Intelligence et données', text: 'Analyses IA, météo, prix de marché, insights anonymisés, fiches de lots QR et synchronisation hors ligne pour les connexions instables.' },
  { title: 'Investissement', text: 'Projets, portefeuille, data room, diligence, reporting d’impact, financement et espace dédié aux investisseurs.' },
  { title: 'International et marchés publics', text: 'Appels d’offres, catalogue public de données, API, fiches agricoles par pays, cultures et taux de change.' },
  { title: 'Administration, modération et confiance', text: 'Vérification des producteurs, modération, signalements, journal d’audit, conformité, monitoring et rôles adaptés à chaque métier.' },
  { title: 'Espace public', text: 'Carte interactive, annuaire de producteurs et coopératives, projets, lots QR, données publiques, actualités, FAQ et informations légales.' },
];
