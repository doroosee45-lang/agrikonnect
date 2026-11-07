import { PublicShell } from '@/components/public-site/PublicShell';
import { HeroCarousel } from '@/components/public-site/home/HeroCarousel';
import { FarmersSection, MapSection } from '@/components/public-site/home/MapAndFarmers';
import { SoilSection } from '@/components/public-site/home/DataSections';
import {
  CooperativesSection,
  HomeServicesSection,
  HomeIntroSection,
  InvestmentSection,
  MarketSection,
  PartnerCtaSection,
  ProductsSection,
  ProducerCtaSection,
  ResourcesSection,
  TraceabilityCtaSection,
  ValueChainsSection,
} from '@/components/public-site/home/WebHomeSections';

/**
 * Accueil du site public — miroir mobile de la page web
 * (`apps/web/src/pages/public/Home.tsx`).
 *
 * Quinze sections dans le même ordre que le site web :
 *  1 Hero (carrousel) · 2 Présentation · 3 Exploitations · 4 Produits ·
 *  5 Filières · 6 Coopératives · 7 Carte · 8 Marchés · 9 Investissement ·
 * 10 Ressources · 11 Services · 12 Sols · 13 Traçabilité ·
 * 14 CTA producteurs · 15 CTA partenaires.
 *
 * Toutes les données affichées viennent des routes anonymes du backend
 * (`/public/farms`, `/public/map`, `/public/soil-stats`, `/public/lots/:code`).
 * Aucun chiffre de mise en page, aucun témoignage fictif, aucun partenaire
 * inventé : quand une information n'existe pas côté serveur, la section le dit.
 */
export default function Accueil() {
  return (
    <PublicShell active="accueil">
      {/* 1 · Hero — carrousel plein largeur avec défilement automatique */}

      {/* 2 · Présentation / proposition de valeur */}
      <HomeIntroSection />

      {/* 3 · Exploitations et producteurs (données réelles) */}
      <FarmersSection />

      {/* 4 · Produits agricoles et productions disponibles */}
      <ProductsSection />

      {/* 5 · Filières agricoles et élevage */}
      <ValueChainsSection />

      {/* 6 · Coopératives et organisations agricoles */}
      <CooperativesSection />

      {/* 7 · Carte agricole et découverte géographique (données réelles) */}
      <MapSection />

      {/* 8 · Opportunités de marché et mise en relation */}
      <MarketSection />

      {/* 9 · Investisseurs, partenaires et coopération */}
      <InvestmentSection />

      {/* 10 · Actualités, conseils et ressources agricoles */}
      <ResourcesSection />

      {/* 11 · Services et fonctionnalités de la plateforme */}
      <HomeServicesSection />

      {/* 12 · Traçabilité et sols (données réelles) */}
      <SoilSection />

      {/* 13 · Traçabilité des lots */}
      <TraceabilityCtaSection />

      {/* 14 · Appel à l’action destiné aux producteurs */}
      <ProducerCtaSection />

      {/* 15 · Appel à l’action partenaires + accès utilisateurs */}
      <PartnerCtaSection />
    </PublicShell>
  );
}