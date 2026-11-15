import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Section, Text } from '@/components/ui';
import { Reveal } from '@/components/ui/Reveal';
import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { HOME_SLIDES } from './homeSlides';
import { publicApi } from '@/services/endpoints';
import { BlogNewsSection } from './BlogNewsSection';
import { queryClient } from '@/services/query';
import { SERVICES } from '@/lib/platform';
import { COLORS, DURATION, EASE } from '@/theme';
import { VERT, TERRE, CREME, ENCRE } from '@/theme/agrikonnect';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
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
        <Text preset="bodyMd" color={ENCRE[500]}>{t('ui.chargementDesExploitations')}</Text>
      </Section>
    );
  }

  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) {
    return (
      <EmptyBlock
        titre={t('ui.aucuneExploitationPublieePourLeMoment')}
        description={t('ui.lesProducteursPublientLeursExploitationsDes')}
      />
    );
  }

  if (error) {
    return (
      <EmptyBlock
        titre={t('ui.lesExploitationsSontTemporairementIndisponibles')}
        description={t('ui.uneErreurReseauAEmpecheLe')}
      />
    );
  }

  return (
    <Section>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>{t('ui.exploitationsAgricoles')}</Text>
        <Text preset="h2" style={{ marginBottom: 8 }}>{t('ui.decouvrezLesProducteursDeLaPlateforme')}</Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.toutesLesExploitationsCiDessousSont')}</Text>
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
              <img className="home-card-image" src={CULTURE_IMAGE_LIST[index % CULTURE_IMAGE_LIST.length]} alt={t('ui.cultureProduiteSurCetteExploitation')} loading="lazy" decoding="async" />
              <Text preset="h4" color={ENCRE[900]}>
                {nom}
              </Text>
              {localisation && (
                <Text preset="bodySm" color={ENCRE[500]}>
                  {localisation}
                </Text>
              )}
              <Link to={`/public/farms/${encodeURIComponent(String((farm as any).slug ?? nom))}`}>
                <Button label={t('ui.voirLaFiche')} variant="ghost" size="sm" />
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
  const { t } = useI18n();
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
        <Text preset="bodyMd" color={ENCRE[500]}>{t('ui.chargementDesStatistiquesDeSol')}</Text>
      </Section>
    );
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (rows.length === 0) {
    return (
      <EmptyBlock
        titre={t('ui.aucuneStatistiqueDeSolDisponible')}
        description={t('ui.lesAnalysesDeSolSontPubliees')}
      />
    );
  }

  if (error) {
    return (
      <EmptyBlock
        titre={t('ui.lesStatistiquesDeSolSontTemporairement')}
        description={t('ui.reessayezPlusTard')}
      />
    );
  }

  return (
    <Section style={{ backgroundColor: CREME[100] }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.santeDesSols')}</Text>
        <Text preset="h2" style={{ marginBottom: 8 }}>{t('ui.statistiquesAgregeesParZone')}</Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.donneesAgregeesEtAnonymiseesAucuneExploitation')}</Text>
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
              : t('ui.zone_cd82b', { value: i + 1 });
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
  const { t } = useI18n();
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
              alt={t('ui.unAgriculteurExamineLaQualiteDu')}
              loading="lazy"
              decoding="async"
            />
            <div className="home-intro-content">
              <Text preset="overline" className="home-intro-kicker">{t('common.appName')}</Text>
              <h2 className="home-intro-title">
                {t('ui.tracabiliteDonneesEtMiseEnRelation')}
              </h2>
              <p className="home-intro-description">
                {t('ui.agrikonnectConnecteLesProducteursLesCooperatives')}
              </p>
              <Link to="/#services" className="home-intro-cta">{t('ui.decouvrirNosServices')}{' '}<span aria-hidden="true">→</span>
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
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.catalogue')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.produitsAgricolesEtProductions')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.retrouvezLesCulturesEtLesProductions')}</Text>
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
            { label: t('ui.cassavaManioc'), icon: '🌿', href: '/public/farmers' },
            { label: t('ui.mais'), icon: '🌽', href: '/public/farmers' },
            { label: t('ui.riz'), icon: '🍚', href: '/public/farmers' },
            { label: t('ui.arachide'), icon: '🥜', href: '/public/farmers' },
            { label: t('ui.plantain'), icon: '🍌', href: '/public/farmers' },
            { label: t('ui.cacao'), icon: '🍫', href: '/public/farmers' },
            { label: t('ui.cafe'), icon: '☕', href: '/public/farmers' },
            { label: t('ui.legumesFeuilles'), icon: '🥬', href: '/public/farmers' },
          ].map((p, index) => (
            <Card key={p.label} tone="white" hover style={{ textAlign: 'left', padding: 0, overflow: 'hidden' }}>
              <img className="home-product-image" src={CULTURE_IMAGE_LIST[index]} alt={p.label} loading="lazy" decoding="async" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
                <Text preset="h4" color={ENCRE[900]}>{p.label}</Text>
                <Link to={p.href}>
                  <Button label={t('ui.voirLesProducteurs')} variant="outline" size="sm" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 5 · Filières agricoles et élevage */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.filieres')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.filieresVegetalesEtAnimales')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.deLaProductionALaCommercialisation')}</Text>
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
              titre: t('ui.filieresVegetales'),
              description: t('ui.cerealesTuberculesLegumineusesEtCulturesDe'),
            },
            {
              titre: t('ui.elevageEtCheptel'),
              description: t('ui.suiviDesAnimauxDeclarationsDeProduction'),
            },
            {
              titre: t('ui.aquacultureEtPisciculture'),
              description: t('ui.bassinsAlimentsEtTracabiliteDesPoissons'),
            },
            {
              titre: t('ui.apiculture'),
              description: t('ui.ruchersProductionDeMielEtPollinisation'),
            },
          ].map((f, index) => (
            <Card key={f.titre} tone="white" hover style={{ padding: 0, overflow: 'hidden' }}>
          <img className="home-card-image" src={[CULTURE_IMAGES.manioc, new URL('../../assets/hero/elevage.jpg', import.meta.url).href, CULTURE_IMAGES.riz, SECTION_IMAGES.training][index]} alt={f.titre} loading="lazy" decoding="async" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
                <Text preset="h4" color={ENCRE[900]}>{f.titre}</Text>
                <Text preset="bodyMd" color={ENCRE[500]} style={{ flex: 1 }}>{f.description}</Text>
                <Link to="/auth/register"><Button label={t('ui.explorer')} variant="ghost" size="sm" /></Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 6 · Coopératives et organisations agricoles */}
      <Section style={{ backgroundColor: CREME[100] }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>{t('ui.cooperatives')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.cooperativesEtOrganisationsAgricoles')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.rejoignezUneCooperativePourMutualiserLes')}</Text>
        </div>
        <img className="home-banner-image" src={SECTION_IMAGES.cooperative} alt={t('ui.agriculturalCooperativeMembersWorkingTogether')} loading="lazy" decoding="async" />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/cooperatives">
            <Button label={t('ui.voirLesCooperatives')} variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label={t('ui.creerUneCooperative')} variant="primary" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 7 · Carte agricole et découverte géographique (données réelles) */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.carte')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.carteAgricoleEtDecouverteGeographique')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.localisezLesExploitationsEtLesZones')}</Text>
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
          <img src={SECTION_IMAGES.map} alt={t('ui.agriculturalPlotsAndProductionAreas')} loading="lazy" decoding="async" />
          <Text preset="bodyMd" color={ENCRE[500]}>{t('ui.carteInteractiveOuvrezLaCarteComplete')}</Text>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/public/map">
            <Button label={t('ui.ouvrirLaCarteAgricole')} variant="outline" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 8 · Opportunités de marché et mise en relation */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.marches')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.opportunitesDeMarche')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.publiezVosAnnoncesDeVenteRecevez')}</Text>
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
              titre: t('ui.vendreMaProduction'),
              description: t('ui.publiezUneAnnonceEtRecevezDes'),
            },
            {
              titre: t('ui.acheterEnGros'),
              description: t('ui.trouvezDesProducteursEtCooperativesPour'),
            },
            {
              titre: t('ui.organiserLeTransport'),
              description: t('ui.demandezUnDevisDeTransportPour'),
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
                <Button label={t('ui.commencer')} variant="ghost" size="sm" />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* 9 · Investisseurs, partenaires et coopération */}
      <Section style={{ backgroundColor: CREME[100] }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>{t('ui.investissement')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.investisseursPartenairesEtCooperation')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.deposezUnProjetAgricoleTrouvezDes')}</Text>
        </div>
        <img className="home-banner-image" src={SECTION_IMAGES.project} alt={t('ui.agriculturalProjectForPotentialPartners')} loading="lazy" decoding="async" />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/projects">
            <Button label={t('ui.voirLesProjets')} variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label={t('ui.deposerUnProjet')} variant="primary" size="lg" />
          </Link>
        </div>
      </Section>

      <BlogNewsSection />

      {/* 11 · Services et fonctionnalités de la plateforme */}
      <Section id="services">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Text preset="overline" color={VERT[600]} style={{ marginBottom: 12 }}>{t('ui.services')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.unePlateformeCompletePourLAgriculture')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.deLaParcelleAuMarcheEn')}</Text>
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
                  <Button label={t('ui.ouvrir')} variant="ghost" size="sm" />
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
          <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12 }}>{t('ui.tracabilite')}</Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.tracabiliteDeLaParcelleAuMarche')}</Text>
          <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.chaqueLotRecoitUnQrCode')}</Text>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/auth/register">
            <Button label={t('ui.tracerUnLot')} variant="primary" size="lg" />
          </Link>
          <Link to="/public/lots/demo">
            <Button label={t('ui.voirUnExemple')} variant="outline" size="lg" />
          </Link>
        </div>
      </Section>

      {/* 14 · Appel à l’action destiné aux producteurs */}
      <Section style={{ backgroundColor: VERT[800], color: COLORS.pureWhite, textAlign: 'center', padding: '80px 24px' }}>
        <Text preset="overline" color={COLORS.goldSurface} style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('ui.producteurs')}</Text>
        <Text preset="h2" style={{ marginBottom: 16, color: COLORS.pureWhite }}>{t('ui.rejoignezAgrikonnectEnTantQueProducteur')}</Text>
        <Text preset="bodyLg" color="rgba(255,255,255,0.9)" style={{ maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.7 }}>{t('ui.creezVotreComptePubliezVosExploitations')}</Text>
        <Link to="/auth/register">
          <Button label={t('ui.creerMonCompteProducteur')} variant="primary" size="lg" style={{ backgroundColor: COLORS.goldSurface, color: COLORS.onGoldSurface, border: 'none' }} />
        </Link>
      </Section>

      {/* 15 · Appel à l’action partenaires + accès utilisateurs */}
      <Section style={{ backgroundColor: CREME[100], textAlign: 'center', padding: '64px 24px' }}>
        <Text preset="overline" color={TERRE[700]} style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('ui.partenairesEtInvestisseurs')}</Text>
        <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.investissezDansLAgricultureAfricaine')}</Text>
        <Text preset="bodyMd" color={ENCRE[500]} style={{ maxWidth: 600, margin: '0 auto 32px' }}>{t('ui.deposezUnProjetSuivezSonAvancement')}</Text>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/public/projects">
            <Button label={t('ui.voirLesProjets')} variant="outline" size="lg" />
          </Link>
          <Link to="/auth/register">
            <Button label={t('ui.creerUnCompte')} variant="primary" size="lg" />
          </Link>
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: ENCRE[500] }}>{t('ui.agrikonnectAfricaTracabiliteAgricoleMarchesEt')}</div>
      </Section>
    </div>
  );
}




