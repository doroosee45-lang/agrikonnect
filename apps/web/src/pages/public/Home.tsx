import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Section, Text } from '@/components/ui';
import { Reveal } from '@/components/ui/Reveal';
import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { HOME_SLIDES } from './homeSlides';
import { publicApi } from '@/services/endpoints';
import { queryClient } from '@/services/query';
import { SERVICES } from '@/lib/platform';
import { COLORS, DURATION, EASE } from '@/theme';
import { VERT, TERRE, CREME, ENCRE } from '@/theme/agrikonnect';

const CULTURE_IMAGES = {
  manioc: new URL('../../assets/cultures/manioc.jpg', import.meta.url).href,
  mais: new URL('../../assets/cultures/mais.jpg', import.meta.url).href,
  riz: new URL('../../assets/cultures/riz.jpg', import.meta.url).href,
  arachide: new URL('../../assets/cultures/arachide.jpg', import.meta.url).href,
  plantain: new URL('../../assets/cultures/bananier.jpg', import.meta.url).href,
  cacao: new URL('../../assets/cultures/cacao.jpg', import.meta.url).href,
  cafe: new URL('../../assets/cultures/cafe.jpg', import.meta.url).href,
  legumes: new URL('../../assets/cultures/haricot.jpg', import.meta.url).href,
};
const CULTURE_IMAGE_LIST = Object.values(CULTURE_IMAGES);

const SECTION_IMAGES = {
  cooperative: new URL('../../assets/partenaires/cooperative.jpg', import.meta.url).href,
  map: new URL('../../assets/partenaires/carte-parcelle.jpg', import.meta.url).href,
  market: new URL('../../assets/partenaires/marche.jpg', import.meta.url).href,
  project: new URL('../../assets/partenaires/hero.jpg', import.meta.url).href,
  training: new URL('../../assets/partenaires/formation.jpg', import.meta.url).href,
  traceability: new URL('../../assets/partenaires/identite.jpg', import.meta.url).href,
  soil: new URL('../../assets/partenaires/sol-sonde.jpg', import.meta.url).href,
};

/* ────────────────────────────────────────────────────────────
 * Données des diapositives Hero — spécifiques à la page d’accueil.
 * Chaque diapositive porte son propre titre, sous-titre et CTA :
 * aucun texte n’est répété d’une page à l’autre.
 * ──────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────
 * Section générique « état vide » pour les données publiques.
 * ──────────────────────────────────────────────────────────── */
function EmptyBlock({ titre, description }: { titre: string; description: string }) {
  return (
    <Section style={{ textAlign: 'center', padding: '80px 24px', backgroundColor: CREME[100] }}>
      <Text preset="h3" color={ENCRE[900]} style={{ marginBottom: 12 }}>
        {titre}
      </Text>
      <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 560, margin: '0 auto' }}>
        {description}
      </Text>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 3 · Exploitations et producteurs — données réelles (/public/farms).
 * ──────────────────────────────────────────────────────────── */
function FarmsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'farms', { limit: 6 }],
    queryFn: async () => {
      const r = await publicApi.farms({ limit: 6 });
      return r.data ?? [];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <Text preset="bodyMd" color={ENCRE[500]}>
          Chargement des exploitations…
        </Text>
      </Section>
    );
  }

  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) {
    return (
      <EmptyBlock
        titre="Aucune exploitation publiée pour le moment"
        description="Les producteurs publient leurs exploitations dès qu’elles sont vérifiées. Revenez bientôt ou créez votre compte pour apparaître ici."
      />
    );
  }

  if (error) {
    return (
      <EmptyBlock
        titre="Les exploitations sont temporairement indisponibles"
        description="Une erreur réseau a empêché le chargement. Réessayez plus tard."
      />
    );
  }

  return (
    <Section>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>
          Exploitations agricoles
        </Text>
        <Text preset="h2" style={{ marginBottom: 8 }}>
          Découvrez les producteurs de la plateforme
        </Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
          Toutes les exploitations ci-dessous sont vérifiées et publient volontairement leurs productions.
        </Text>
      </div>

      <div
        className="home-card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}
      >
        {items.map((farm, index) => {
          const nom =
            typeof farm === 'object' && farm !== null && 'nom' in farm
              ? String((farm as any).nom)
              : 'Exploitation';
          const localisation =
            typeof farm === 'object' && farm !== null && 'localisation' in farm
              ? String((farm as any).localisation)
              : '';
          return (
            <Card
              key={String((farm as any).id ?? nom)}
              tone="white"
              hover
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <img className="home-card-image" src={CULTURE_IMAGE_LIST[index % CULTURE_IMAGE_LIST.length]} alt="Culture produite sur cette exploitation" loading="lazy" decoding="async" />
              <Text preset="h4" color={ENCRE[900]}>
                {nom}
              </Text>
              {localisation && (
                <Text preset="bodySm" color={ENCRE[500]}>
                  {localisation}
                </Text>
              )}
              <Link to={`/public/farms/${encodeURIComponent(String((farm as any).slug ?? nom))}`}>
                <Button label="Voir la fiche" variant="ghost" size="sm" />
              </Link>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 12 · Traçabilité et sols — données réelles (/public/soil-stats).
 * ──────────────────────────────────────────────────────────── */
function SoilsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public', 'soil-stats'],
    queryFn: async () => {
      const r = await publicApi.soilStats();
      return r.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <Text preset="bodyMd" color={ENCRE[500]}>
          Chargement des statistiques de sol…
        </Text>
      </Section>
    );
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (rows.length === 0) {
    return (
      <EmptyBlock
        titre="Aucune statistique de sol disponible"
        description="Les analyses de sol sont publiées par zones dès qu’au moins 10 exploitations contribuent (k-anonymat). Aucune donnée individuelle n’est jamais révélée."
      />
    );
  }

  if (error) {
    return (
      <EmptyBlock
        titre="Les statistiques de sol sont temporairement indisponibles"
        description="Réessayez plus tard."
      />
    );
  }

  return (
    <Section style={{ backgroundColor: CREME[100] }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
          Santé des sols
        </Text>
        <Text preset="h2" style={{ marginBottom: 8 }}>
          Statistiques agrégées par zone
        </Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
          Données agrégées et anonymisées — aucune exploitation n’est identifiable individuellement.
        </Text>
      </div>

      <div
        className="home-card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {rows.map((row, i) => {
          const label =
            typeof row === 'object' && row !== null && 'zone' in row
              ? String((row as any).zone)
              : `Zone ${i + 1}`;
          const valeur =
            typeof row === 'object' && row !== null && 'valeur' in row
              ? (row as any).valeur
              : null;
          return (
            <Card key={String(i)} tone="white" style={{ padding: 16 }}>
              <Text preset="caption" color={TERRE[700]} style={{ textTransform: 'uppercase' }}>
                {label}
              </Text>
              <Text preset="h3" color={ENCRE[900]} style={{ marginTop: 6 }}>
                {valeur !== null ? String(valeur) : '—'}
              </Text>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

export default function Home() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  return (
    <div className="public-home">
      {/* 1 · Hero — carrousel plein largeur avec défilement automatique */}
      <HeroCarousel
        slides={HOME_SLIDES}
        height={520}
        intervalMs={5000}
        className="home-hero"
      />

      {/* 2 · Présentation / proposition de valeur */}
      <Section className="home-intro-section">
        <Reveal>
          <article className="home-intro-card">
            <img
              className="home-intro-image"
              src={SECTION_IMAGES.soil}
              alt="Un agriculteur examine la qualité du sol dans une parcelle cultivée"
              loading="lazy"
              decoding="async"
            />
            <div className="home-intro-content">
              <Text preset="overline" className="home-intro-kicker">
                AGRIKONNECT AFRICA
              </Text>
              <h2 className="home-intro-title">
                {'Tra\u00e7abilit\u00e9, donn\u00e9es et mise en relation pour l’agriculture africaine'}
              </h2>
              <p className="home-intro-description">
                {'AGRIKONNECT connecte les producteurs, les coop\u00e9ratives, les acheteurs et les investisseurs autour d’une seule plateforme. Chaque donn\u00e9e affich\u00e9e provient d’une source citable ; aucune recommandation n’est jamais invent\u00e9e.'}
              </p>
              <Link to="/#services" className="home-intro-cta">
                Découvrir nos services <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </Reveal>
      </Section>
      {/* 3 · Exploitations et producteurs (données réelles) */}
      <FarmsSection />

      {/* 4 · Produits agricoles et productions disponibles */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Catalogue
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Produits agricoles et productions
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Retrouvez les cultures et les productions disponibles auprès des producteurs de la plateforme.
          </Text>
        </div>
        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { label: 'Cassava / Manioc', icon: '🌿', href: '/public/farmers' },
            { label: 'Maïs', icon: '🌽', href: '/public/farmers' },
            { label: 'Riz', icon: '🍚', href: '/public/farmers' },
            { label: 'Arachide', icon: '🥜', href: '/public/farmers' },
            { label: 'Plantain', icon: '🍌', href: '/public/farmers' },
            { label: 'Cacao', icon: '🍫', href: '/public/farmers' },
            { label: 'Café', icon: '☕', href: '/public/farmers' },
            { label: 'Légumes-feuilles', icon: '🥬', href: '/public/farmers' },
          ].map((p, index) => (
            <Card key={p.label} tone="white" hover style={{ textAlign: 'left', padding: 0, overflow: 'hidden' }}>
              <img className="home-product-image" src={CULTURE_IMAGE_LIST[index]} alt={p.label} loading="lazy" decoding="async" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
                <Text preset="h4" color={ENCRE[900]}>{p.label}</Text>
                <Link to={p.href}>
                  <Button label="Voir les producteurs" variant="outline" size="sm" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 5 · Filières agricoles et élevage */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Filières
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Filières végétales et animales
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            De la production à la commercialisation, chaque filière bénéficie d’un suivi de traçabilité complet.
          </Text>
        </div>
        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {[
            {
              titre: 'Filières végétales',
              description: 'Céréales, tubercules, légumineuses et cultures de rente, de la parcelle au marché.',
            },
            {
              titre: 'Élevage et cheptel',
              description: 'Suivi des animaux, déclarations de production et organisation de la vente.',
            },
            {
              titre: 'Aquaculture et pisciculture',
              description: 'Bassins, aliments et traçabilité des poissons élevés.',
            },
            {
              titre: 'Apiculture',
              description: 'Ruchers, production de miel et pollinisation des cultures.',
            },
          ].map((f, index) => (
            <Card key={f.titre} tone="white" hover style={{ padding: 0, overflow: 'hidden' }}>
          <img className="home-card-image" src={[CULTURE_IMAGES.manioc, new URL('../../assets/hero/elevage.jpg', import.meta.url).href, CULTURE_IMAGES.riz, SECTION_IMAGES.training][index]} alt={f.titre} loading="lazy" decoding="async" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
                <Text preset="h4" color={ENCRE[900]}>{f.titre}</Text>
                <Text preset="bodyMd" color={ENCRE[500]} style={{ flex: 1 }}>{f.description}</Text>
                <Link to="/auth/register"><Button label="Explorer" variant="ghost" size="sm" /></Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 6 · Coopératives et organisations agricoles */}
      <Section style={{ backgroundColor: CREME[100] }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>
            Coopératives
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Coopératives et organisations agricoles
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Rejoignez une coopérative pour mutualiser les moyens, négocier collectivement et accéder à de nouveaux marchés.
          </Text>
        </div>
        <img className="home-banner-image" src={SECTION_IMAGES.cooperative} alt="Agricultural cooperative members working together" loading="lazy" decoding="async" />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/cooperatives">
            <Button label="Voir les coopératives" variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label="Créer une coopérative" variant="primary" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 7 · Carte agricole et découverte géographique (données réelles) */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Carte
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Carte agricole et découverte géographique
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Localisez les exploitations et les zones de production sur la carte partagée de la plateforme.
          </Text>
        </div>
        <div
          className="home-map-preview"
          style={{
            height: 340,
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            border: `1px solid ${COLORS.lightBorder}`,
            backgroundColor: CREME[200],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={SECTION_IMAGES.map} alt="Agricultural plots and production areas" loading="lazy" decoding="async" />
          <Text preset="bodyMd" color={ENCRE[500]}>
            Carte interactive — ouvrez la carte complète pour explorer les zones de production.
          </Text>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/public/map">
            <Button label="Ouvrir la carte agricole" variant="outline" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 8 · Opportunités de marché et mise en relation */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Marchés
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Opportunités de marché
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Publiez vos annonces de vente, recevez des offres d’achat et organisez le transport de vos productions.
          </Text>
        </div>
        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              titre: 'Vendre ma production',
              description: 'Publiez une annonce et recevez des offres d’achat vérifiées.',
            },
            {
              titre: 'Acheter en gros',
              description: 'Trouvez des producteurs et coopératives pour vos approvisionnements.',
            },
            {
              titre: 'Organiser le transport',
              description: 'Demandez un devis de transport pour vos expéditions.',
            },
          ].map((o, index) => (
            <Card key={o.titre} tone="white" hover style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <img className="home-card-image" src={[SECTION_IMAGES.market, new URL('../../assets/hero/recolte.jpg', import.meta.url).href, new URL('../../assets/hero/tracabilite-lot.jpg', import.meta.url).href][index]} alt={o.titre} loading="lazy" decoding="async" />
              <Text preset="h4" color={ENCRE[900]}>
                {o.titre}
              </Text>
              <Text preset="bodyMd" color={ENCRE[500]} style={{ flex: 1 }}>
                {o.description}
              </Text>
              <Link to="/auth/register">
                <Button label="Commencer" variant="ghost" size="sm" />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* 9 · Investisseurs, partenaires et coopération */}
      <Section style={{ backgroundColor: CREME[100] }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>
            Investissement
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Investisseurs, partenaires et coopération
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Déposez un projet agricole, trouvez des partenaires de financement et suivez son avancement dans une data room sécurisée.
          </Text>
        </div>
        <img className="home-banner-image" src={SECTION_IMAGES.project} alt="Agricultural project for potential partners" loading="lazy" decoding="async" />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/projects">
            <Button label="Voir les projets" variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label="Déposer un projet" variant="primary" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 10 · Actualités, conseils et ressources agricoles */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Ressources
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Actualités et conseils agricoles
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Calendriers culturales, conseils de rotation, alertes climatiques et bonnes pratiques pour chaque culture.
          </Text>
        </div>
        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              titre: 'Calendriers culturales',
              description: 'Périodes de semis, d’entretien et de récolte par culture et par zone.',
            },
            {
              titre: 'Conseils de rotation',
              description: 'Préservez la fertilité de vos sols avec des rotations adaptées.',
            },
            {
              titre: 'Alertes climatiques',
              description: 'Soyez informé des conditions météorologiques qui affectent vos cultures.',
            },
            {
              titre: 'Bonnes pratiques',
              description: 'Guides techniques pour chaque filière agricole.',
            },
          ].map((r, index) => (
            <Card key={r.titre} tone="white" hover style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <img className="home-card-image" src={[SECTION_IMAGES.training, SECTION_IMAGES.soil, new URL('../../assets/hero/terres-aeriennes.jpg', import.meta.url).href, new URL('../../assets/hero/sol-analyse.jpg', import.meta.url).href][index]} alt={r.titre} loading="lazy" decoding="async" />
              <Text preset="h4" color={ENCRE[900]}>
                {r.titre}
              </Text>
              <Text preset="bodyMd" color={ENCRE[500]} style={{ flex: 1 }}>
                {r.description}
              </Text>
              <Link to="/auth/register">
                <Button label="Lire" variant="ghost" size="sm" />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* 11 · Services et fonctionnalités de la plateforme */}
      <Section id="services">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>
            Services
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Une plateforme complète pour l’agriculture africaine
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            De la parcelle au marché, en passant par l’investissement : traçabilité, données et mise en relation.
          </Text>
        </div>
        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}
        >
          {SERVICES.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: DURATION.base / 1000,
                delay: index * 0.05,
                ease: EASE.out,
              }}
            >
              <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <img className="home-card-image" src={[SECTION_IMAGES.traceability, SECTION_IMAGES.market, SECTION_IMAGES.project, SECTION_IMAGES.map, SECTION_IMAGES.cooperative, new URL('../../assets/hero/technologie-capteurs.jpg', import.meta.url).href][index]} alt={service.title} loading="lazy" decoding="async" />
                <div style={{ fontSize: 32, marginBottom: 8 }}>{service.icon}</div>
                <Text preset="h4" color={COLORS.textPrimary}>
                  {service.title}
                </Text>
                <Text preset="bodyMd" color={COLORS.slateGray} style={{ flex: 1 }}>
                  {service.body}
                </Text>
                <Link to="/services">
                  <Button label="Ouvrir" variant="ghost" size="sm" />
                </Link>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 12 · Traçabilité et sols (données réelles) */}
      <SoilsSection />

      {/* 13 · Traçabilité des lots */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>
            Traçabilité
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Traçabilité de la parcelle au marché
          </Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>
            Chaque lot reçoit un QR code et un historique vérifié : origine, traitements, récolte et destination.
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/auth/register">
            <Button label="Traçer un lot" variant="primary" size="lg" />
          </Link>
          <Link to="/public/lots/demo">
            <Button label="Voir un exemple" variant="outline" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 14 · Appel à l’action destiné aux producteurs */}
      <Section style={{ backgroundColor: VERT[800], color: COLORS.pureWhite, textAlign: 'center', padding: '80px 24px' }}>
        <Text preset="overline" color={COLORS.goldSurface} style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Producteurs
        </Text>
        <Text preset="h2" style={{ marginBottom: 16, color: COLORS.pureWhite }}>
          Rejoignez AGRIKONNECT en tant que producteur
        </Text>
        <Text preset="bodyLg" color="rgba(255,255,255,0.9)" style={{ maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Créez votre compte, publiez vos exploitations et vos productions, et accédez aux marchés et aux investisseurs de la plateforme.
        </Text>
        <Link to="/auth/register">
          <Button label="Créer mon compte producteur" variant="primary" size="lg" style={{ backgroundColor: COLORS.goldSurface, color: COLORS.onGoldSurface, border: 'none' }} />
        </Link>
      </Section>

      {/* 15 · Appel à l’action partenaires + accès utilisateurs */}
      <Section style={{ backgroundColor: CREME[100], textAlign: 'center', padding: '64px 24px' }}>
        <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Partenaires et investisseurs
        </Text>
        <Text preset="h2" style={{ marginBottom: 16 }}>
          Investissez dans l’agriculture africaine
        </Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto 32px' }}>
          Déposez un projet, suivez son avancement et collaborez avec les organisations agricoles de la plateforme.
        </Text>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/projects">
            <Button label="Voir les projets" variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label="Créer un compte" variant="primary" size="lg" />
          </Link>
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: ENCRE[500] }}>
          AGRIKONNECT AFRICA — Traçabilité agricole, marchés et investissement.
        </div>
      </Section>
    </div>
  );
}




