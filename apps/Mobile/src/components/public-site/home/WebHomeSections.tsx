import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, PressableScale, Reveal, Section, Text } from '@/components/ui';
import type { ButtonVariant } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { CREME, ENCRE, VERT } from '@/theme/agrikonnect';
import { RADIUS, SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

/**
 * Sections de l'accueil mobile — miroir exact du site web
 * (`apps/web/src/pages/public/Home.tsx`).
 *
 * Onze sections y sont définies ; les trois autres sections « données réelles »
 * restent dans leurs modules d'origine (`MapAndFarmers`, `DataSections`) et le
 * carrousel Hero garde le sien (`HeroCarousel`).
 *
 * Règle de contenu identique au web : aucun chiffre de mise en page, aucun
 * témoignage fictif, aucun partenaire inventé. Chaque libellé est repris mot
 * pour mot de la page web afin que les deux plateformes disent la même chose.
 *
 * Images : mêmes visuels que le site web — `assets/cultures/` (8 photos de
 * cultures), `assets/partenaires/` (7 photos de sections) et `assets/hero/`
 * (visuels du carrousel, déjà présents dans le projet mobile).
 */

/* ── Visuels ──────────────────────────────────────────────────
 * require() statique : Metro ne résout que des chemins littéraux.
 * Depuis `src/components/public-site/home/`, les assets sont à
 * `../../../../assets/` (racine du projet mobile).
 * ──────────────────────────────────────────────────────────── */
const CULTURE_IMAGES = {
  manioc: require('../../../../assets/cultures/manioc.jpg'),
  mais: require('../../../../assets/cultures/mais.jpg'),
  riz: require('../../../../assets/cultures/riz.jpg'),
  arachide: require('../../../../assets/cultures/arachide.jpg'),
  plantain: require('../../../../assets/cultures/bananier.jpg'),
  cacao: require('../../../../assets/cultures/cacao.jpg'),
  cafe: require('../../../../assets/cultures/cafe.jpg'),
  legumes: require('../../../../assets/cultures/haricot.jpg'),
};
const CULTURE_IMAGE_LIST = Object.values(CULTURE_IMAGES);

const SECTION_IMAGES = {
  cooperative: require('../../../../assets/partenaires/cooperative.jpg'),
  map: require('../../../../assets/partenaires/carte-parcelle.jpg'),
  market: require('../../../../assets/partenaires/marche.jpg'),
  project: require('../../../../assets/partenaires/hero.jpg'),
  training: require('../../../../assets/partenaires/formation.jpg'),
  traceability: require('../../../../assets/partenaires/identite.jpg'),
  soil: require('../../../../assets/partenaires/sol-sonde.jpg'),
};

const HERO_IMAGES = {
  elevage: require('../../../../assets/hero/elevage.jpg'),
  recolte: require('../../../../assets/hero/recolte.jpg'),
  tracabiliteLot: require('../../../../assets/hero/tracabilite-lot.jpg'),
  terresAeriennes: require('../../../../assets/hero/terres-aeriennes.jpg'),
  solAnalyse: require('../../../../assets/hero/sol-analyse.jpg'),
  technologieCapteurs: require('../../../../assets/hero/technologie-capteurs.jpg'),
};

/* ────────────────────────────────────────────────────────────
 * Petits outils de mise en page (grille responsive, carte illustrée).
 * ──────────────────────────────────────────────────────────── */
function useGridColumns(): number {
  const { width } = useWindowDimensions();
  return width >= 1000 ? 3 : width >= 640 ? 2 : 1;
}

interface MediaCardProps {
  image: number;
  title: string;
  body?: string;
  ctaLabel: string;
  ctaVariant?: ButtonVariant;
  onPress: () => void;
}

/** Carte illustrée : image pleine largeur, titre, texte court, un bouton. */
function MediaCard({ image, title, body, ctaLabel, ctaVariant = 'ghost', onPress }: MediaCardProps) {
  return (
    <Card tone="white" style={styles.card}>
      <Image
        source={image}
        contentFit="cover"
        style={styles.cardImage}
        accessibilityLabel={title}
        transition={200}
      />
      <View style={styles.cardBody}>
        <Text preset="h3" color={ENCRE[900]}>
          {title}
        </Text>
        {body ? (
          <Text preset="bodySm" color={COLORS.slateGray} style={styles.cardText}>
            {body}
          </Text>
        ) : null}
        <Button label={ctaLabel} variant={ctaVariant} size="sm" onPress={onPress} style={styles.cardButton} />
      </View>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
 * 2 · Présentation / proposition de valeur.
 * ──────────────────────────────────────────────────────────── */
export function HomeIntroSection() {
  const { t } = useI18n();
  return (
    <Section bare background={COLORS.naturalWhite}>
      <Reveal variant="up">
        <View style={styles.introCard}>
          <Image
            source={SECTION_IMAGES.soil}
            contentFit="cover"
            style={styles.introImage}
            accessibilityLabel={t('ui.unAgriculteurExamineLaQualiteDu')}
            transition={200}
          />
          <View style={styles.introContent}>
            <Text preset="overline" color={VERT[600]} style={styles.introKicker}>{t('common.appName')}</Text>
            <Text preset="h2" color={ENCRE[900]} style={styles.introTitle}>{t('ui.tracabiliteDonneesEtMiseEnRelation')}</Text>
            <Text preset="body" color={COLORS.slateGray} style={styles.introBody}>{t('ui.agrikonnectConnecteLesProducteursLesCooperatives')}</Text>
            <PressableScale
              onPress={() => router.push('/services' as never)}
              accessibilityRole="button"
              style={styles.introCta}
            >
              <Text preset="bodyMedium" color={VERT[600]}>{t('ui.decouvrirNosServices_72197')}</Text>
            </PressableScale>
          </View>
        </View>
      </Reveal>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 4 · Produits agricoles et productions disponibles.
 * ──────────────────────────────────────────────────────────── */
const PRODUCTS: { label: string; image: number }[] = [
  { get label() { return tr('ui.cassavaManioc'); }, image: CULTURE_IMAGES.manioc },
  { get label() { return tr('ui.mais'); }, image: CULTURE_IMAGES.mais },
  { get label() { return tr('ui.riz'); }, image: CULTURE_IMAGES.riz },
  { get label() { return tr('ui.arachide'); }, image: CULTURE_IMAGES.arachide },
  { get label() { return tr('ui.plantain'); }, image: CULTURE_IMAGES.plantain },
  { get label() { return tr('ui.cacao'); }, image: CULTURE_IMAGES.cacao },
  { get label() { return tr('ui.cafe'); }, image: CULTURE_IMAGES.cafe },
  { get label() { return tr('ui.legumesFeuilles'); }, image: CULTURE_IMAGES.legumes },
];

export function ProductsSection() {
  const { t } = useI18n();
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow={t('ui.catalogue')}
      title={t('ui.produitsAgricolesEtProductions')}
      subtitle={t('ui.retrouvezLesCulturesEtLesProductions')}
    >
      <View style={styles.grid}>
        {PRODUCTS.map((produit, index) => (
          <Reveal
            key={produit.label}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <MediaCard
              image={produit.image}
              title={produit.label}
              ctaLabel={t('ui.voirLesProducteurs')}
              ctaVariant="outline"
              onPress={() => router.push('/farmers' as never)}
            />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 5 · Filières agricoles et élevage.
 * ──────────────────────────────────────────────────────────── */
const VALUE_CHAINS: { titre: string; description: string; image: number }[] = [
  {
    get titre() { return tr('ui.filieresVegetales'); },
    get description() { return tr('ui.cerealesTuberculesLegumineusesEtCulturesDe'); },
    image: CULTURE_IMAGES.manioc,
  },
  {
    get titre() { return tr('ui.elevageEtCheptel'); },
    get description() { return tr('ui.suiviDesAnimauxDeclarationsDeProduction'); },
    image: HERO_IMAGES.elevage,
  },
  {
    get titre() { return tr('ui.aquacultureEtPisciculture'); },
    get description() { return tr('ui.bassinsAlimentsEtTracabiliteDesPoissons'); },
    image: CULTURE_IMAGES.riz,
  },
  {
    get titre() { return tr('ui.apiculture'); },
    get description() { return tr('ui.ruchersProductionDeMielEtPollinisation'); },
    image: SECTION_IMAGES.training,
  },
];

export function ValueChainsSection() {
  const { t } = useI18n();
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow={t('ui.filieres')}
      title={t('ui.filieresVegetalesEtAnimales')}
      subtitle={t('ui.deLaProductionALaCommercialisation')}
    >
      <View style={styles.grid}>
        {VALUE_CHAINS.map((filiere, index) => (
          <Reveal
            key={filiere.titre}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <MediaCard
              image={filiere.image}
              title={filiere.titre}
              body={filiere.description}
              ctaLabel={t('ui.explorer')}
              onPress={() => router.push('/auth/register' as never)}
            />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 6 · Coopératives et organisations agricoles.
 * ──────────────────────────────────────────────────────────── */
export function CooperativesSection() {
  const { t } = useI18n();
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow={t('ui.cooperatives')}
      title={t('ui.cooperativesEtOrganisationsAgricoles')}
      subtitle={t('ui.rejoignezUneCooperativePourMutualiserLes')}
    >
      <Reveal variant="up">
        <Image
          source={SECTION_IMAGES.cooperative}
          contentFit="cover"
          style={styles.bannerImage}
          accessibilityLabel={t('ui.membresDUneCooperativeAgricoleAu')}
          transition={200}
        />
      </Reveal>
      <Reveal index={1} variant="up">
        <View style={styles.ctaRow}>
          <Button
            label={t('ui.voirLesCooperatives')}
            variant="outline"
            size="lg"
            onPress={() => router.push('/cooperatives' as never)}
          />
          <Button
            label={t('ui.creerUneCooperative')}
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
        </View>
      </Reveal>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 8 · Opportunités de marché et mise en relation.
 * ──────────────────────────────────────────────────────────── */
const MARKET_OPPORTUNITIES: { titre: string; description: string; image: number }[] = [
  {
    get titre() { return tr('ui.vendreMaProduction'); },
    get description() { return tr('ui.publiezUneAnnonceEtRecevezDes'); },
    image: SECTION_IMAGES.market,
  },
  {
    get titre() { return tr('ui.acheterEnGros'); },
    get description() { return tr('ui.trouvezDesProducteursEtCooperativesPour'); },
    image: HERO_IMAGES.recolte,
  },
  {
    get titre() { return tr('ui.organiserLeTransport'); },
    get description() { return tr('ui.demandezUnDevisDeTransportPour'); },
    image: HERO_IMAGES.tracabiliteLot,
  },
];

export function MarketSection() {
  const { t } = useI18n();
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow={t('ui.marches')}
      title={t('ui.opportunitesDeMarche')}
      subtitle={t('ui.publiezVosAnnoncesDeVenteRecevez')}
    >
      <View style={styles.grid}>
        {MARKET_OPPORTUNITIES.map((opportunite, index) => (
          <Reveal
            key={opportunite.titre}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <MediaCard
              image={opportunite.image}
              title={opportunite.titre}
              body={opportunite.description}
              ctaLabel={t('ui.commencer')}
              onPress={() => router.push('/auth/register' as never)}
            />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 9 · Investisseurs, partenaires et coopération.
 * ──────────────────────────────────────────────────────────── */
export function InvestmentSection() {
  const { t } = useI18n();
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow={t('ui.investissement')}
      title={t('ui.investisseursPartenairesEtCooperation')}
      subtitle={t('ui.deposezUnProjetAgricoleTrouvezDes')}
    >
      <Reveal variant="up">
        <Image
          source={SECTION_IMAGES.project}
          contentFit="cover"
          style={styles.bannerImage}
          accessibilityLabel={t('ui.projetAgricolePresenteADesPartenaires')}
          transition={200}
        />
      </Reveal>
      <Reveal index={1} variant="up">
        <View style={styles.ctaRow}>
          <Button
            label={t('ui.voirLesProjets')}
            variant="outline"
            size="lg"
            onPress={() => router.push('/projets' as never)}
          />
          <Button
            label={t('ui.deposerUnProjet')}
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
        </View>
      </Reveal>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 10 · Actualités, conseils et ressources agricoles.
 * ──────────────────────────────────────────────────────────── */
const RESOURCES: { titre: string; description: string; image: number }[] = [
  {
    get titre() { return tr('ui.calendriersCulturales'); },
    get description() { return tr('ui.periodesDeSemisDEntretienEt_c335e'); },
    image: SECTION_IMAGES.training,
  },
  {
    get titre() { return tr('ui.conseilsDeRotation'); },
    get description() { return tr('ui.preservezLaFertiliteDeVosSols'); },
    image: SECTION_IMAGES.soil,
  },
  {
    get titre() { return tr('ui.alertesClimatiques'); },
    get description() { return tr('ui.soyezInformeDesConditionsMeteorologiquesQui'); },
    image: HERO_IMAGES.terresAeriennes,
  },
  {
    get titre() { return tr('ui.bonnesPratiques'); },
    get description() { return tr('ui.guidesTechniquesPourChaqueFiliereAgricole'); },
    image: HERO_IMAGES.solAnalyse,
  },
];

export function ResourcesSection() {
  const { t } = useI18n();
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow={t('ui.ressources')}
      title={t('ui.actualitesEtConseilsAgricoles')}
      subtitle={t('ui.calendriersCulturalesConseilsDeRotationAlertes')}
    >
      <View style={styles.grid}>
        {RESOURCES.map((ressource, index) => (
          <Reveal
            key={ressource.titre}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <MediaCard
              image={ressource.image}
              title={ressource.titre}
              body={ressource.description}
              ctaLabel={t('ui.lire')}
              onPress={() => router.push('/auth/register' as never)}
            />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 11 · Services et fonctionnalités de la plateforme.
 * Mêmes six services que la page web (libellés et textes identiques).
 * ──────────────────────────────────────────────────────────── */
const PLATFORM_FEATURES: {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  image: number;
}[] = [
  {
    id: 'traceability',
    icon: 'shield-checkmark-outline',
    get title() { return tr('ui.tracabiliteEtOrigine'); },
    get body() { return tr('ui.chaqueLotPorteSonExploitationSa'); },
    image: SECTION_IMAGES.traceability,
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    get title() { return tr('ui.marcheEtCommandes'); },
    get body() { return tr('ui.annoncesDemandesDAchatOffresEt'); },
    image: SECTION_IMAGES.market,
  },
  {
    id: 'investment',
    icon: 'trending-up-outline',
    get title() { return tr('ui.investissementEtProjets'); },
    get body() { return tr('ui.portefeuilleDeProjetsDataRoomRapports'); },
    image: SECTION_IMAGES.project,
  },
  {
    id: 'insights',
    icon: 'bar-chart-outline',
    get title() { return tr('ui.donneesDeMarche'); },
    get body() { return tr('ui.prixVolumesEtActiviteAgregesAvec'); },
    image: SECTION_IMAGES.map,
  },
  {
    id: 'cooperative',
    icon: 'people-outline',
    get title() { return tr('ui.cooperatives'); },
    get body() { return tr('ui.regroupementDeProducteursVolumesConsolidesEt'); },
    image: SECTION_IMAGES.cooperative,
  },
  {
    id: 'ai',
    icon: 'sparkles-outline',
    get title() { return tr('ui.assistanceIa'); },
    get body() { return tr('ui.analysesDeCulturesDocumentsEtCopilote'); },
    image: HERO_IMAGES.technologieCapteurs,
  },
];

export function HomeServicesSection() {
  const { t } = useI18n();
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow={t('ui.services')}
      title={t('ui.unePlateformeCompletePourLAgriculture')}
      subtitle={t('ui.deLaParcelleAuMarcheEn')}
    >
      <View style={styles.grid}>
        {PLATFORM_FEATURES.map((service, index) => (
          <Reveal
            key={service.id}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <Card tone="white" style={styles.card}>
              <Image
                source={service.image}
                contentFit="cover"
                style={styles.cardImage}
                accessibilityLabel={service.title}
                transition={200}
              />
              <View style={styles.cardBody}>
                <View style={styles.serviceIcon}>
                  <Ionicons name={service.icon} size={20} color={COLORS.forestGreen} />
                </View>
                <Text preset="h3" color={COLORS.textPrimary}>
                  {service.title}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.cardText}>
                  {service.body}
                </Text>
                <Button
                  label={t('ui.ouvrir')}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push('/services' as never)}
                  style={styles.cardButton}
                />
              </View>
            </Card>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 13 · Traçabilité des lots.
 * ──────────────────────────────────────────────────────────── */
export function TraceabilityCtaSection() {
  const { t } = useI18n();
  return (
    <Section
      centered
      eyebrow={t('ui.tracabilite')}
      title={t('ui.tracabiliteDeLaParcelleAuMarche')}
      subtitle={t('ui.chaqueLotRecoitUnQrCode')}
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label={t('ui.tracerUnLot')}
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
          <Button
            label={t('ui.voirUnExemple')}
            variant="outline"
            size="lg"
            onPress={() => router.push('/public-site/lot' as never)}
          />
        </View>
      </Reveal>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 14 · Appel à l’action destiné aux producteurs (section sombre).
 * ──────────────────────────────────────────────────────────── */
export function ProducerCtaSection() {
  const { t } = useI18n();
  return (
    <Section
      centered
      light
      background={VERT[800]}
      eyebrow={t('ui.producteurs')}
      title={t('ui.rejoignezAgrikonnectEnTantQueProducteur')}
      subtitle={t('ui.creezVotreComptePubliezVosExploitations')}
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label={t('ui.creerMonCompteProducteur')}
            variant="gold"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
        </View>
      </Reveal>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────
 * 15 · Appel à l’action partenaires + accès utilisateurs.
 * ──────────────────────────────────────────────────────────── */
export function PartnerCtaSection() {
  const { t } = useI18n();
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow={t('ui.partenairesEtInvestisseurs')}
      title={t('ui.investissezDansLAgricultureAfricaine')}
      subtitle={t('ui.deposezUnProjetSuivezSonAvancement')}
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label={t('ui.voirLesProjets')}
            variant="outline"
            size="lg"
            onPress={() => router.push('/projets' as never)}
          />
          <Button
            label={t('ui.creerUnCompte')}
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
        </View>
      </Reveal>
      <Reveal index={1} variant="up">
        <Text preset="caption" color={COLORS.slateGray} style={styles.footerLine}>{t('ui.agrikonnectAfricaTracabiliteAgricoleMarchesEt')}</Text>
      </Reveal>
    </Section>
  );
}

const styles = StyleSheet.create({
  /* Grille responsive : une, deux ou trois colonnes. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.sm,
  },
  cell: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  /* Carte illustrée commune. */
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 132,
  },
  cardBody: {
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  cardText: {
    flex: 1,
  },
  cardButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  /* Carte d’introduction (section 2). */
  introCard: {
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.pureWhite,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  introImage: {
    width: '100%',
    height: 200,
  },
  introContent: {
    padding: SPACING.xl,
  },
  introKicker: {
    marginBottom: SPACING.xs,
  },
  introTitle: {
    marginBottom: SPACING.sm,
  },
  introBody: {
    marginBottom: SPACING.sm,
  },
  introCta: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  /* Bandeaux illustrés (sections 6 et 9). */
  bannerImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'center',
  },
  footerLine: {
    marginTop: SPACING.xxl,
    textAlign: 'center',
  },
});