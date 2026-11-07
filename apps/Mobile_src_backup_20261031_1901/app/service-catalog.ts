import type { ImageSourcePropType } from 'react-native';

import { PLATFORM_SERVICES } from './platform';

/**
 * Catalogue de services — miroir mobile de `apps/web/src/lib/service-catalog.ts`
 * (exports `SERVICE_CATALOG` et `SERVICE_DOMAINS`).
 *
 * ⚠ Source des textes : les neuf services de `./platform.ts` (titres, résumés,
 * descriptions déjà validés dans le projet). Les « features » reprennent les
 * phrases exactes du détail de chaque service — aucune phrase n'est inventée.
 *
 * `SERVICE_DOMAINS` reste vide tant que le tableau web n'a pas été recopié ici :
 * les libellés et textes de domaines sont du contenu éditorial qui ne se devine
 * pas. Voir la note de livraison.
 */

/** Un service du catalogue (carte `/services` + fiche `/services/[id]`). */
export interface ServiceCatalogItem {
  id: string;
  title: string;
  /** Une phrase — carte du catalogue. */
  summary: string;
  /** Paragraphe — chapô de la fiche détail. */
  description: string;
  /** « Ce que le service permet » — une phrase du détail par ligne. */
  features: string[];
  image: ImageSourcePropType;
  imageAlt: string;
}

/** Domaine du périmètre de la plateforme (section « PÉRIMÈTRE COMPLET »). */
export interface ServiceDomain {
  title: string;
  text: string;
}

/** Visuels et capacités par service (les autres champs suivent `platform.ts`). */
const PAR_SERVICE: Record<
  string,
  { image: ImageSourcePropType; imageAlt: string; features: string[] }
> = {
  traceability: {
    image: require('../../assets/hero/tracabilite-lot.jpg'),
    imageAlt: 'Illustration du service « Traçabilité des lots »',
    features: [
      'Chaque lot porte un code (ex. AK-CI-2026-00001) et un journal d’étapes horodaté.',
      'Le producteur choisit les champs publiés ; la fiche publique accessible par QR ne contient ni identifiant technique, ni acteur, ni localisation d’événement.',
      'Un rappel de lot est tracé et visible.',
    ],
  },
  mapping: {
    image: require('../../assets/hero/terres-aeriennes.jpg'),
    imageAlt: 'Illustration du service « Cartographie des parcelles »',
    features: [
      'Les parcelles sont créées par point ou par polygone, avec leur surface et leur culture courante.',
      'Les positions publiées sont arrondies côté serveur : la coordonnée exacte ne quitte jamais la plateforme.',
      'Le regroupement des points est laissé au client.',
    ],
  },
  soil: {
    image: require('../../assets/hero/sol-analyse.jpg'),
    imageAlt: 'Illustration du service « Diagnostic de sol »',
    features: [
      'Le moteur géospatial pondère chaque source par sa fiabilité, sa qualité et sa fraîcheur (demi-vie de 365 jours).',
      'Les sources en désaccord restent visibles, les avertissements sont affichés.',
      'Aucune recommandation n’est déclenchée automatiquement.',
    ],
  },
  prices: {
    image: require('../../assets/hero/marche.jpg'),
    imageAlt: 'Illustration du service « Prix de marché »',
    features: [
      'Chaque relevé porte son marché, sa devise, son unité, sa date d’observation et sa source.',
      'En l’absence de relevé, l’écran indique qu’aucun prix n’est disponible — aucun prix estimé n’est publié sans source.',
    ],
  },
  weather: {
    image: require('../../assets/hero/champs-manioc.jpg'),
    imageAlt: 'Illustration du service « Météo agricole »',
    features: [
      'Les données météo sont rattachées à une parcelle ou à des coordonnées explicites, avec leur source et leur niveau de confiance.',
      'Au-delà de 24 heures, un avertissement de fraîcheur s’affiche.',
    ],
  },
  market: {
    image: require('../../assets/hero/recolte.jpg'),
    imageAlt: 'Illustration du service « Marché & mise en relation »',
    features: [
      'Les annonces et demandes d’achat débouchent sur des offres, puis des commandes suivies étape par étape.',
      'Les coordonnées des parties ne transitent pas : la relation passe par la messagerie interne.',
      'Signalement et blocage possibles.',
    ],
  },
  transport: {
    image: require('../../assets/hero/technologie-capteurs.jpg'),
    imageAlt: 'Illustration du service « Transport & logistique »',
    features: [
      'Les demandes de transport sont rattachées à une commande et à un lot, avec suivi du chargement et preuve de livraison horodatée.',
    ],
  },
  invest: {
    image: require('../../assets/hero/investissement-projet.jpg'),
    imageAlt: 'Illustration du service « Investissement & projets »',
    features: [
      'Les dossiers de projet suivent un cycle de soumission et de revue.',
      'La dataroom donne un accès limité dans le temps (30 jours par défaut, 90 au plus), journalisé.',
      'Le reporting d’avancement et d’impact est versionné.',
    ],
  },
  tenders: {
    image: require('../../assets/hero/cooperative.jpg'),
    imageAlt: 'Illustration du service « Appels d’offres »',
    features: [
      'Les acheteurs publient des avis avec quantité, qualité, certifications exigées, destination et délai.',
      'Les réponses sont tracées, l’attribution et la clôture sont journalisées.',
    ],
  },
};

/**
 * Les neuf services, dans l'ordre du catalogue web. Titre, résumé et
 * description suivent `PLATFORM_SERVICES` (source unique de vérité textuelle).
 */
export const SERVICE_CATALOG: ServiceCatalogItem[] = PLATFORM_SERVICES.map((service) => ({
  id: service.id,
  title: service.title,
  summary: service.body,
  description: service.detail,
  features: PAR_SERVICE[service.id]?.features ?? [],
  image: PAR_SERVICE[service.id]?.image ?? require('../../assets/hero/champs-manioc.jpg'),
  imageAlt: PAR_SERVICE[service.id]?.imageAlt ?? `Illustration du service « ${service.title} »`,
}));

/**
 * Domaines du périmètre (section « PÉRIMÈTRE COMPLET », lettres A, B, C…).
 *
 * ⚠ Volontairement vide : les titres et textes de domaines sont ceux du site
 * web (`apps/web/src/lib/service-catalog.ts`) et ne sont pas encore recopiés
 * ici — rien n'est inventé en attendant.
 */
export const SERVICE_DOMAINS: ServiceDomain[] = [];
