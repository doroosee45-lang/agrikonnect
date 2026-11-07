import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { COLORS, SURFACES, TINTS } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

import { Card, Chip, PressableScale, Reveal, Section, Text } from '@/components/ui';
import { PLATFORM_SERVICES, type PlatformService } from '@/lib/platform';
import { VERT, TERRE } from '../../../theme/agrikonnect';

const TONES: Record<PlatformService['tone'], { background: string; color: string }> = {
  forest: { background: TINTS.forestGreenBg, color: COLORS.forestGreen },
  gold: { background: TINTS.goldBg, color: TERRE[700] },
  living: { background: TINTS.livingGreenBg, color: VERT[600] },
  info: { background: TINTS.infoBg, color: COLORS.info },
};

/**
 * Section 4 — les neuf services de la plateforme.
 *
 * Chaque carte dit clairement si le service est consultable sans compte ou s'il
 * exige une session : c'est la réalité du routage backend (`/public/*` contre
 * les routes protégées), pas une promesse marketing.
 */
export function ServicesSection() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 640 ? 2 : 1;

  const services: PlatformService[] = PLATFORM_SERVICES;
  void 0;

  return (
    <Section
      index={2}
      eyebrow="Services"
      title={t('home.servicesTitle')}
      subtitle={t('home.servicesSubtitle')}
      background={COLORS.naturalWhite}
    >
      <View style={styles.grid}>
        {services.map((service, index) => (
          <Reveal
            key={service.title}
            index={index % columns}
            variant="up"
            style={[styles.cell, { width: `${100 / columns}%` }]}
          >
            <ServiceCard service={service} />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function ServiceCard({ service }: { service: PlatformService }) {
  const hover = useSharedValue(0);
  const tone = TONES[service.tone];

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: hover.value * -4 }],
    borderColor: hover.value > 0.5 ? 'rgba(23, 77, 53, 0.35)' : SURFACES.borderSoft,
  }));

  return (
    <Animated.View style={[styles.cardWrap, animated]}>
      <PressableScale
        onPress={() => router.push(service.href as never)}
        accessibilityRole="button"
        onHoverIn={() => {
          hover.value = withTiming(1, { duration: DURATION.fast, easing: EASE.out });
        }}
        onHoverOut={() => {
          hover.value = withTiming(0, { duration: DURATION.fast, easing: EASE.out });
        }}
      >
        <Card tone="white" style={styles.card}>
          <View style={styles.cardTop}>
            <View style={[styles.iconBox, { backgroundColor: tone.background }]}>
              <Ionicons name={service.icon} size={20} color={tone.color} />
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.slateGray} />
          </View>

          <Text preset="h3" color={COLORS.textPrimary}>
            {service.title}
          </Text>
          <Text preset="bodySm" color={COLORS.slateGray} style={styles.body}>
            {service.body}
          </Text>

          <View style={styles.cardFooter}>
            <Chip
              label={service.requiresAuth ? 'Compte requis' : 'Accès libre'}
              tone={service.requiresAuth ? 'neutral' : 'success'}
              icon={service.requiresAuth ? 'lock-closed-outline' : 'checkmark-circle-outline'}
              size="sm"
            />
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

/** Section 5 — ce que chaque rôle vient chercher sur la plateforme. */
export function RolesSection() {
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const roles = [
    {
      icon: 'leaf-outline' as const,
      role: 'Producteur',
      body: 'Déclarer ses parcelles, suivre ses productions, obtenir un diagnostic de sol et publier un profil vérifiable.',
      href: '/auth/register',
    },
    {
      icon: 'people-outline' as const,
      role: 'Coopérative',
      body: 'Consolider les volumes de ses membres, préparer les lots et répondre aux appels d’offres.',
      href: '/cooperatives',
    },
    {
      icon: 'cart-outline' as const,
      role: 'Acheteur & transformateur',
      body: 'Sourcer par filière et par saison, vérifier l’origine d’un lot avant d’acheter, suivre la commande.',
      href: '/marches',
    },
    {
      icon: 'briefcase-outline' as const,
      role: 'Investisseur',
      body: 'Consulter des dossiers de projet, accéder à une dataroom à durée limitée, suivre le reporting d’impact.',
      href: '/projets',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      role: 'Vérificateur',
      body: 'Instruire les demandes de vérification terrain et horodater chaque contrôle.',
      href: '/reviewer',
    },
    {
      icon: 'walk-outline' as const,
      role: 'Agent de terrain',
      body: 'Saisir des observations hors ligne, relever des prix de marché, accompagner les inscriptions.',
      href: '/agent',
    },
  ];

  return (
    <Section index={3} eyebrow="Réseau" title="Un outil par métier" subtitle="La même donnée, des usages différents selon le rôle." background={COLORS.pureWhite}>
      <View style={[styles.rolesGrid, wide ? styles.rolesGridWide : null]}>
        {roles.map((role, index) => (
          <Reveal key={role.role} index={index % 3} variant="up" style={styles.roleItem}>
            <PressableScale onPress={() => router.push(role.href as never)} accessibilityRole="button">
              <Card tone="paper" style={styles.roleCard}>
                <Ionicons name={role.icon} size={18} color={COLORS.forestGreen} />
                <Text preset="bodyMedium" color={COLORS.textPrimary}>
                  {role.role}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.body}>
                  {role.body}
                </Text>
              </Card>
            </PressableScale>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  cell: { minWidth: 260 },
  cardWrap: { height: '100%' },
  card: { gap: SPACING.sm, height: '100%' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  body: { lineHeight: 20 },
  cardFooter: { marginTop: 'auto', paddingTop: SPACING.sm },
  rolesGrid: { gap: SPACING.md },
  rolesGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  roleItem: { flex: 1, minWidth: 250 },
  roleCard: { gap: SPACING.xs, height: '100%' },
});
