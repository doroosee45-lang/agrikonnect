export const HOME_SLIDES = [
  {
    image: new URL('../../assets/hero/champs-manioc.jpg', import.meta.url).href,
    titre: 'Traçabilité agricole, marchés et investissement en Afrique',
    sousTitre:
      'Chaque lot porte son origine. Chaque donnée porte sa source. Chaque transaction est traçable, de la parcelle au marché.',
    ctaHref: '/auth/register',
    ctaLabel: 'Créer un compte gratuit',
  },
  {
    image: new URL('../../assets/hero/cooperative.jpg', import.meta.url).href,
    titre: 'Les coopératives au cœur des filières',
    sousTitre:
      'Réunissez vos productions, négociez collectivement et accédez aux marchés grâce à une organisation transparente.',
    ctaHref: '/public/cooperatives',
    ctaLabel: 'Découvrir les coopératives',
  },
  {
    image: new URL('../../assets/hero/marche.jpg', import.meta.url).href,
    titre: 'Opportunités de marché',
    sousTitre:
      'Publiez vos annonces, recevez des offres d’achat et suivez vos expéditions jusqu’à leur destination.',
    ctaHref: '/public/tenders',
    ctaLabel: 'Voir les opportunités',
  },
  {
    image: new URL('../../assets/hero/terres-aeriennes.jpg', import.meta.url).href,
    titre: 'Cartographie agricole',
    sousTitre:
      'Localisez vos exploitations sur une carte partagée, avec les statistiques de sol agrégées par zone.',
    ctaHref: '/public/map',
    ctaLabel: 'Ouvrir la carte',
  },
  {
    image: new URL('../../assets/hero/sol-analyse.jpg', import.meta.url).href,
    titre: 'Analyse des sols et conseils agronomes',
    sousTitre:
      'Déterminez la convenance de vos parcelles pour chaque culture et planifiez vos rotations en toute confiance.',
    ctaHref: '/auth/register',
    ctaLabel: 'Commencer l’analyse',
  },
  {
    image: new URL('../../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    titre: 'Technologie au service des exploitations',
    sousTitre:
      'Capteurs, détections d’anomalies et alertes de seuil : suivez vos cultures en temps réel, partout en RDC.',
    ctaHref: '/auth/register',
    ctaLabel: 'Équiper mon exploitation',
  },
  {
    image: new URL('../../assets/hero/tracabilite-lot.jpg', import.meta.url).href,
    titre: 'Traçabilité de la parcelle au marché',
    sousTitre:
      'Chaque lot reçoit un QR code et un historique vérifié : origine, traitements, récolte et destination.',
    ctaHref: '/public/lots/demo',
    ctaLabel: 'Voir un lot exemple',
  },
  {
    image: new URL('../../assets/hero/investissement-projet.jpg', import.meta.url).href,
    titre: 'Investisseurs et projets agricoles',
    sousTitre:
      'Déposez un projet de développement, trouvez des partenaires et suivez son avancement dans une data room sécurisée.',
    ctaHref: '/public/projects',
    ctaLabel: 'Déposer un projet',
  },
  {
    image: new URL('../../assets/hero/elevage.jpg', import.meta.url).href,
    titre: 'Filières animales et élevage',
    sousTitre:
      'Suivez vos cheptels, enregistrez les productions et organisez la commercialisation avec vos coopératives.',
    ctaHref: '/auth/register',
    ctaLabel: 'Gérer mon élevage',
  },
  {
    image: new URL('../../assets/hero/recolte.jpg', import.meta.url).href,
    titre: 'Récoltes et productions agricoles',
    sousTitre:
      'Déclarez vos rendements, comparez-les aux recommandations et valorisez votre production sur le marché.',
    ctaHref: '/auth/register',
    ctaLabel: 'Déclarer ma récolte',
  },
] as const;

