/**
 * Questions fréquentes.
 *
 * Chaque réponse décrit le comportement réel de la plateforme (routage,
 * règles de publication, k-anonymat, politique de contacts). Aucune réponse ne
 * promet une fonctionnalité absente du backend.
 */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Rubrique de classement (page FAQ complète). */
  topic: 'Données' | 'Comptes' | 'Échanges' | 'Technique';
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'provenance',
    topic: 'Données',
    question: 'Comment savoir si un chiffre est fiable ?',
    answer:
      'Chaque valeur porte un marqueur : ✔ pour une mesure ou une donnée vérifiée, ≈ pour une estimation ou une déclaration. La source, la date et la méthode sont affichées avec la valeur. Quand une donnée manque, elle manque : la plateforme ne complète jamais un trou par une estimation silencieuse.',
  },
  {
    id: 'verification',
    topic: 'Données',
    question: 'Que signifie exactement « vérifié » ?',
    answer:
      '« Vérifié par AGRIKONNECT » signifie qu’un contrôle a été instruit et horodaté par un vérificateur. « Déclaré par le producteur » signifie que l’information provient d’une saisie, sans contrôle. Les deux mentions sont affichées séparément, y compris sur les fiches publiques.',
  },
  {
    id: 'carte',
    topic: 'Données',
    question: 'Les positions affichées sur la carte sont-elles exactes ?',
    answer:
      'Non, volontairement. Les coordonnées publiées sont arrondies côté serveur avant d’être envoyées. La position exacte d’une parcelle n’est jamais exposée sur une route publique.',
  },
  {
    id: 'statistiques',
    topic: 'Données',
    question: 'Comment sont calculées les statistiques de sol ?',
    answer:
      'Ce sont des moyennes de paramètres mesurés, groupées par pays. Tout groupe de moins de dix analyses est supprimé de la publication — il n’est ni arrondi, ni complété. Les groupes supprimés sont listés sur la page.',
  },
  {
    id: 'prix',
    topic: 'Données',
    question: 'D’où viennent les prix de marché ?',
    answer:
      'De relevés datés, saisis par des agents ou synchronisés depuis un fournisseur identifié. Chaque relevé porte sa source et sa date d’observation. En l’absence de relevé, l’écran indique qu’aucun prix n’est disponible plutôt que d’afficher une valeur approchée.',
  },
  {
    id: 'contacts',
    topic: 'Comptes',
    question: 'Pourquoi les coordonnées des producteurs sont-elles masquées ?',
    answer:
      'Par défaut, téléphone, WhatsApp et e-mail ne sont pas publiés. Le producteur choisit ce qu’il expose. Un visiteur passe par le formulaire de contact de la fiche : le message est transmis sans jamais révéler les coordonnées de l’un ou de l’autre.',
  },
  {
    id: 'compte',
    topic: 'Comptes',
    question: 'Faut-il un compte pour consulter la plateforme ?',
    answer:
      'Non pour les pages publiques : carte, annuaire des producteurs, fiche de lot, statistiques de sol. Oui pour les prix, la météo, les annonces et les appels d’offres, qui sont des espaces de travail réservés aux comptes actifs.',
  },
  {
    id: 'roles',
    topic: 'Comptes',
    question: 'Puis-je créer un compte administrateur ou vérificateur ?',
    answer:
      'Non. L’inscription en libre-service ouvre les rôles opérationnels (producteur, coopérative, acheteur, fournisseur, transporteur, agronome, investisseur, agent d’appui). Les rôles de gouvernance — administrateur, modérateur, vérificateur, partenaire laboratoire, client API — sont attribués par un administrateur.',
  },
  {
    id: 'mfa',
    topic: 'Comptes',
    question: 'La double authentification est-elle obligatoire ?',
    answer:
      'Elle est disponible pour tous les comptes (TOTP, avec codes de secours à usage unique). Dès qu’elle est activée, le mot de passe seul ne suffit plus : aucune session n’est délivrée sans second facteur valide.',
  },
  {
    id: 'messagerie',
    topic: 'Échanges',
    question: 'Comment contacter un vendeur sans connaître ses coordonnées ?',
    answer:
      'Depuis une annonce, le bouton de contact ouvre une conversation interne. Les messages sont horodatés, signalables, et une partie peut bloquer l’autre. Les coordonnées personnelles ne circulent pas dans ce canal par défaut.',
  },
  {
    id: 'commande',
    topic: 'Échanges',
    question: 'Comment se déroule une commande ?',
    answer:
      'Une annonce ou une demande d’achat débouche sur une offre, puis une commande dont chaque changement d’état est journalisé et notifié aux deux organisations. Un litige peut être ouvert et instruit.',
  },
  {
    id: 'ia',
    topic: 'Technique',
    question: 'Le diagnostic de sol est-il automatique ?',
    answer:
      'C’est une aide à la décision. Le moteur fusionne les sources disponibles avec leur fiabilité, affiche ses avertissements et ne déclenche aucune recommandation automatique. La décision agronomique reste humaine.',
  },
  {
    id: 'offline',
    topic: 'Technique',
    question: 'L’application fonctionne-t-elle sans réseau ?',
    answer:
      'Les écrans déjà consultés restent affichés et un bandeau signale que les données peuvent dater. Les saisies créées hors ligne portent un identifiant stable côté client et sont réconciliées à la reconnexion ; les requêtes sensibles portent une clé d’idempotence pour éviter les doublons.',
  },
  {
    id: 'api',
    topic: 'Technique',
    question: 'Existe-t-il une API pour réutiliser les données ?',
    answer:
      'Oui : une API publique à clé, avec des jeux de données (produits, prix, agrégats, régions) et un périmètre d’autorisation par clé. Les exports et les jeux de données sont également disponibles depuis l’espace connecté.',
  },
];
