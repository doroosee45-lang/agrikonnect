import { ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '@/theme/colors';
import { LAYOUT, SPACING } from '@/theme/space';

import { PressableScale, Reveal, ScrollYProvider, Text } from '@/components/ui';

import { Navbar, type NavItem } from './Navbar';
import { PublicFooter } from './PublicFooter';
import { VERT } from '../../theme/agrikonnect';
import { HeroCarousel } from './home/HeroCarousel';

export interface PublicShellProps {
  children: React.ReactNode;
  /** Clé de navigation active (surligné dans la barre). */
  active?: string;
  /** La barre reste transparente tant que la page n'a pas défilé. */
  transparentNavbar?: boolean;
  /** Désactive les révélations au scroll quand tout le contenu doit rester visible. */
  revealOnScroll?: boolean;
  /** Affiche le carrousel du site sur cette page publique. */
  heroCarousel?: boolean;
  /** Masque le pied de page (écrans de formulaire long). */
  footer?: boolean;
  items?: NavItem[];
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Coquille du site public : barre fixe + défilement + pied de page.
 *
 * La position de défilement est créée ici puis partagée (contexte) : la barre
 * s'en sert pour se densifier, les `Reveal` pour déclencher leurs apparitions.
 */
export function PublicShell({
  children,
  transparentNavbar = true,
  revealOnScroll = true,
  heroCarousel = true,
  footer = true,
  items,
  background = COLORS.naturalWhite,
  contentStyle,
}: PublicShellProps) {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: background }]}>
      <ScrollYProvider value={revealOnScroll ? scrollY : null}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentStyle}
          style={styles.scroll}
        >
          <PublicTopbar />
          {heroCarousel ? <HeroCarousel /> : null}
          {children}
          {footer ? <PublicFooter /> : null}
        </Animated.ScrollView>

        <Navbar scrollY={scrollY} transparentOnTop={transparentNavbar} items={items} />
      </ScrollYProvider>
    </SafeAreaView>
  );
}

const QUICK_LINKS = [
  { label: 'Sol & sous-sol', icon: 'earth-outline' as const, href: '/services/inspection-sols' },
  { label: 'État du sol', icon: 'flask-outline' as const, href: '/services/inspection-sols' },
  { label: 'Quand semer ?', icon: 'calendar-outline' as const, href: '/services/conseils-semis' },
  { label: 'Cultures & parcelles', icon: 'leaf-outline' as const, href: '/services/fermes-productions' },
  { label: 'Carte agricole', icon: 'map-outline' as const, href: '/explore' },
];

function PublicTopbar() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topbar, { marginTop: insets.top }]}>
      {width >= 700 ? (
        <View style={styles.topbarIntro}>
          <Text preset="overline" color={COLORS.forestGreen}>AGRIKONNECT AFRICA</Text>
          <Text preset="caption" color={COLORS.slateGray}>Conseils et données agricoles</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={styles.topbarLinks}>
        {QUICK_LINKS.map((item) => (
          <PressableScale key={item.label} onPress={() => router.push(item.href as never)} accessibilityRole="link" style={styles.topbarLink}>
            <Ionicons name={item.icon} size={15} color={COLORS.forestGreen} />
            <Text preset="caption" color={COLORS.forestGreen} style={styles.topbarLinkText}>{item.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * En-tête de page intérieure : bandeau vert profond, sur-titre numéroté, titre,
 * chapeau. Les pages qui n'ont pas de héros utilisent toutes cet en-tête, ce
 * qui garantit un rythme identique d'une page à l'autre.
 */
export function PageHeader({
  index,
  eyebrow,
  title,
  subtitle,
  children,
  compact = false,
}: {
  index?: number | string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.header,
        { paddingTop: LAYOUT.navbarHeight + (compact ? SPACING.xl : SPACING.xxxl), paddingBottom: compact ? SPACING.xl : SPACING.xxl },
      ]}
    >
      <View style={styles.headerContent}>
        <Reveal index={0} variant="up" distance={14}>
          <View style={styles.eyebrow}>
            {index !== undefined ? (
              <Text preset="overline" color={COLORS.gold}>
                {String(index).padStart(2, '0')}
              </Text>
            ) : null}
            {eyebrow ? (
              <Text preset="overline" color={COLORS.livingGreen}>
                {eyebrow}
              </Text>
            ) : null}
          </View>
        </Reveal>

        <Reveal index={1} variant="up" distance={20}>
          <Text preset="heroDisplay" color={COLORS.naturalWhite} style={styles.title}>
            {title}
          </Text>
        </Reveal>

        {subtitle ? (
          <Reveal index={2} variant="up" distance={20}>
            <Text preset="lead" color="rgba(246, 247, 242, 0.74)" style={styles.subtitle}>
              {subtitle}
            </Text>
          </Reveal>
        ) : null}

        {children ? <Reveal index={3}>{children}</Reveal> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  topbar: { minHeight: 48, flexGrow: 0, flexShrink: 0, width: '100%', flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: LAYOUT.screenPadding, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.lightBorder, backgroundColor: COLORS.naturalWhite },
  topbarIntro: { minWidth: 190, gap: 2 },
  topbarLinks: { minHeight: 36, alignItems: 'center', gap: SPACING.xs },
  topbarLink: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(23, 77, 53, 0.1)', backgroundColor: COLORS.pureWhite },
  topbarLinkText: { fontSize: 11, fontWeight: '600' },
  header: {
    width: '100%',
    backgroundColor: VERT[950],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(246, 247, 242, 0.1)',
  },
  headerContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    gap: SPACING.md,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { maxWidth: 720 },
  subtitle: { maxWidth: 620, marginTop: SPACING.xs },
});
