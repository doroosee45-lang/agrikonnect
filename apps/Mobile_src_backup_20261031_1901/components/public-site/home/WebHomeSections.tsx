import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, PressableScale, Reveal, Section, Text } from '@/components/ui';
import type { ButtonVariant } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { CREME, ENCRE, VERT } from '@/theme/agrikonnect';
import { RADIUS, SPACING } from '@/theme/space';

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
  return (
    <Section bare background={COLORS.naturalWhite}>
      <Reveal variant="up">
        <View style={styles.introCard}>
          <Image
            source={SECTION_IMAGES.soil}
            contentFit="cover"
            style={styles.introImage}
            accessibilityLabel="Un agriculteur examine la qualité du sol dans une parcelle cultivée"
            transition={200}
          />
          <View style={styles.introContent}>
            <Text preset="overline" color={VERT[600]} style={styles.introKicker}>
              AGRIKONNECT AFRICA
            </Text>
            <Text preset="h2" color={ENCRE[900]} style={styles.introTitle}>
              Traçabilité, données et mise en relation pour l’agriculture africaine
            </Text>
            <Text preset="body" color={COLORS.slateGray} style={styles.introBody}>
              AGRIKONNECT connecte les producteurs, les coopératives, les acheteurs et les
              investisseurs autour d’une seule plateforme. Chaque donnée affichée provient
              d’une source citable ; aucune recommandation n’est jamais inventée.
            </Text>
            <PressableScale
              onPress={() => router.push('/services' as never)}
              accessibilityRole="button"
              style={styles.introCta}
            >
              <Text preset="bodyMedium" color={VERT[600]}>
                Découvrir nos services →
              </Text>
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
  { label: 'Cassava / Manioc', image: CULTURE_IMAGES.manioc },
  { label: 'Maïs', image: CULTURE_IMAGES.mais },
  { label: 'Riz', image: CULTURE_IMAGES.riz },
  { label: 'Arachide', image: CULTURE_IMAGES.arachide },
  { label: 'Plantain', image: CULTURE_IMAGES.plantain },
  { label: 'Cacao', image: CULTURE_IMAGES.cacao },
  { label: 'Café', image: CULTURE_IMAGES.cafe },
  { label: 'Légumes-feuilles', image: CULTURE_IMAGES.legumes },
];

export function ProductsSection() {
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow="Catalogue"
      title="Produits agricoles et productions"
      subtitle="Retrouvez les cultures et les productions disponibles auprès des producteurs de la plateforme."
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
              ctaLabel="Voir les producteurs"
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
    titre: 'Filières végétales',
    description: 'Céréales, tubercules, légumineuses et cultures de rente, de la parcelle au marché.',
    image: CULTURE_IMAGES.manioc,
  },
  {
    titre: 'Élevage et cheptel',
    description: 'Suivi des animaux, déclarations de production et organisation de la vente.',
    image: HERO_IMAGES.elevage,
  },
  {
    titre: 'Aquaculture et pisciculture',
    description: 'Bassins, aliments et traçabilité des poissons élevés.',
    image: CULTURE_IMAGES.riz,
  },
  {
    titre: 'Apiculture',
    description: 'Ruchers, production de miel et pollinisation des cultures.',
    image: SECTION_IMAGES.training,
  },
];

export function ValueChainsSection() {
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow="Filières"
      title="Filières végétales et animales"
      subtitle="De la production à la commercialisation, chaque filière bénéficie d’un suivi de traçabilité complet."
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
              ctaLabel="Explorer"
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
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow="Coopératives"
      title="Coopératives et organisations agricoles"
      subtitle="Rejoignez une coopérative pour mutualiser les moyens, négocier collectivement et accéder à de nouveaux marchés."
    >
      <Reveal variant="up">
        <Image
          source={SECTION_IMAGES.cooperative}
          contentFit="cover"
          style={styles.bannerImage}
          accessibilityLabel="Membres d’une coopérative agricole au travail"
          transition={200}
        />
      </Reveal>
      <Reveal index={1} variant="up">
        <View style={styles.ctaRow}>
          <Button
            label="Voir les coopératives"
            variant="outline"
            size="lg"
            onPress={() => router.push('/cooperatives' as never)}
          />
          <Button
            label="Créer une coopérative"
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
    titre: 'Vendre ma production',
    description: 'Publiez une annonce et recevez des offres d’achat vérifiées.',
    image: SECTION_IMAGES.market,
  },
  {
    titre: 'Acheter en gros',
    description: 'Trouvez des producteurs et coopératives pour vos approvisionnements.',
    image: HERO_IMAGES.recolte,
  },
  {
    titre: 'Organiser le transport',
    description: 'Demandez un devis de transport pour vos expéditions.',
    image: HERO_IMAGES.tracabiliteLot,
  },
];

export function MarketSection() {
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow="Marchés"
      title="Opportunités de marché"
      subtitle="Publiez vos annonces de vente, recevez des offres d’achat et organisez le transport de vos productions."
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
              ctaLabel="Commencer"
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
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow="Investissement"
      title="Investisseurs, partenaires et coopération"
      subtitle="Déposez un projet agricole, trouvez des partenaires de financement et suivez son avancement dans une data room sécurisée."
    >
      <Reveal variant="up">
        <Image
          source={SECTION_IMAGES.project}
          contentFit="cover"
          style={styles.bannerImage}
          accessibilityLabel="Projet agricole présenté à des partenaires potentiels"
          transition={200}
        />
      </Reveal>
      <Reveal index={1} variant="up">
        <View style={styles.ctaRow}>
          <Button
            label="Voir les projets"
            variant="outline"
            size="lg"
            onPress={() => router.push('/projets' as never)}
          />
          <Button
            label="Déposer un projet"
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
    titre: 'Calendriers culturales',
    description: 'Périodes de semis, d’entretien et de récolte par culture et par zone.',
    image: SECTION_IMAGES.training,
  },
  {
    titre: 'Conseils de rotation',
    description: 'Préservez la fertilité de vos sols avec des rotations adaptées.',
    image: SECTION_IMAGES.soil,
  },
  {
    titre: 'Alertes climatiques',
    description: 'Soyez informé des conditions météorologiques qui affectent vos cultures.',
    image: HERO_IMAGES.terresAeriennes,
  },
  {
    titre: 'Bonnes pratiques',
    description: 'Guides techniques pour chaque filière agricole.',
    image: HERO_IMAGES.solAnalyse,
  },
];

export function ResourcesSection() {
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow="Ressources"
      title="Actualités et conseils agricoles"
      subtitle="Calendriers culturales, conseils de rotation, alertes climatiques et bonnes pratiques pour chaque culture."
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
              ctaLabel="Lire"
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
    title: 'Traçabilité et origine',
    body: 'Chaque lot porte son exploitation, sa parcelle, sa saison et ses contrôles.',
    image: SECTION_IMAGES.traceability,
  },
  {
    id: 'market',
    icon: 'storefront-outline',
    title: 'Marché et commandes',
    body: 'Annonces, demandes d’achat, offres et commandes avec paiement et litiges.',
    image: SECTION_IMAGES.market,
  },
  {
    id: 'investment',
    icon: 'trending-up-outline',
    title: 'Investissement et projets',
    body: 'Portefeuille de projets, data room, rapports d’impact et financement.',
    image: SECTION_IMAGES.project,
  },
  {
    id: 'insights',
    icon: 'bar-chart-outline',
    title: 'Données de marché',
    body: 'Prix, volumes et activité agrégés avec seuil de k-anonymat.',
    image: SECTION_IMAGES.map,
  },
  {
    id: 'cooperative',
    icon: 'people-outline',
    title: 'Coopératives',
    body: 'Regroupement de producteurs, volumes consolidés et offres groupées.',
    image: SECTION_IMAGES.cooperative,
  },
  {
    id: 'ai',
    icon: 'sparkles-outline',
    title: 'Assistance IA',
    body: 'Analyses de cultures, documents et copilote, avec escalade humaine.',
    image: HERO_IMAGES.technologieCapteurs,
  },
];

export function HomeServicesSection() {
  const columns = useGridColumns();

  return (
    <Section
      centered
      eyebrow="Services"
      title="Une plateforme complète pour l’agriculture africaine"
      subtitle="De la parcelle au marché, en passant par l’investissement : traçabilité, données et mise en relation."
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
                  label="Ouvrir"
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
  return (
    <Section
      centered
      eyebrow="Traçabilité"
      title="Traçabilité de la parcelle au marché"
      subtitle="Chaque lot reçoit un QR code et un historique vérifié : origine, traitements, récolte et destination."
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label="Traçer un lot"
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
          <Button
            label="Voir un exemple"
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
  return (
    <Section
      centered
      light
      background={VERT[800]}
      eyebrow="Producteurs"
      title="Rejoignez AGRIKONNECT en tant que producteur"
      subtitle="Créez votre compte, publiez vos exploitations et vos productions, et accédez aux marchés et aux investisseurs de la plateforme."
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label="Créer mon compte producteur"
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
  return (
    <Section
      centered
      background={CREME[100]}
      eyebrow="Partenaires et investisseurs"
      title="Investissez dans l’agriculture africaine"
      subtitle="Déposez un projet, suivez son avancement et collaborez avec les organisations agricoles de la plateforme."
    >
      <Reveal variant="up">
        <View style={styles.ctaRow}>
          <Button
            label="Voir les projets"
            variant="outline"
            size="lg"
            onPress={() => router.push('/projets' as never)}
          />
          <Button
            label="Créer un compte"
            variant="primary"
            size="lg"
            onPress={() => router.push('/auth/register' as never)}
          />
        </View>
      </Reveal>
      <Reveal index={1} variant="up">
        <Text preset="caption" color={COLORS.slateGray} style={styles.footerLine}>
          AGRIKONNECT AFRICA — Traçabilité agricole, marchés et investissement.
        </Text>
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