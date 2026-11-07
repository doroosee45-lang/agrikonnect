import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { HeroBackground, IconButton, Text } from '@/components/ui';
import { Logo } from '@/components/public-site/Logo';
import { COLORS, DARK } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { LAYOUT, SPACING } from '@/theme/space';

/**
 * Coquille des écrans d'authentification.
 *
 * Sur grand écran, un panneau de marque à gauche et le formulaire à droite ;
 * sur mobile, le formulaire seul avec un en-tête compact et un retour possible
 * vers le site public.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      {wide ? (
        <View style={styles.split}>
          <BrandPanel />
          <ScrollView contentContainerStyle={styles.formColumn} showsVerticalScrollIndicator={false}>
            <View style={styles.formInner}>
              <Animated.View entering={FadeInDown.duration(DURATION.slow)} style={styles.formHeader}>
                <Text preset="display" color={COLORS.textPrimary}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text preset="lead" color={COLORS.slateGray} style={styles.lineHeight}>
                    {subtitle}
                  </Text>
                ) : null}
              </Animated.View>
              {children}
              {footer}
            </View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.mobileColumn} showsVerticalScrollIndicator={false}>
          <View style={styles.mobileHeader}>
            <IconButton icon="arrow-back" onPress={() => router.push('/accueil')} accessibilityLabel="Retour" />
            <Logo size={30} />
          </View>

          <Animated.View entering={FadeInDown.duration(DURATION.slow)} style={styles.mobileTitle}>
            <Text preset="display" color={COLORS.textPrimary}>
              {title}
            </Text>
            {subtitle ? (
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                {subtitle}
              </Text>
            ) : null}
          </Animated.View>

          {children}
          {footer}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function BrandPanel() {
  const points = [
    'Une donnée, une origine : mesurée, vérifiée, estimée ou déclarée.',
    'Coordonnées masquées par défaut, positions arrondies.',
    'Session courte, jeton rotatif, double authentification disponible.',
  ];

  return (
    <HeroBackground style={styles.brand}>
      <Animated.View entering={FadeIn.duration(DURATION.slow)} style={styles.brandInner}>
        <Logo light size={40} showTagline />

        <Text preset="display" color={DARK.text} style={styles.brandTitle}>
          La confiance agricole se prouve, elle ne se déclare pas.
        </Text>

        <View style={styles.points}>
          {points.map((point, index) => (
            <Animated.View key={point} entering={FadeIn.delay(220 + index * 140).duration(DURATION.slow)} style={styles.point}>
              <Ionicons name="checkmark-circle" size={15} color={COLORS.livingGreen} />
              <Text preset="bodySm" color="rgba(246, 247, 242, 0.8)" style={styles.lineHeight}>
                {point}
              </Text>
            </Animated.View>
          ))}
        </View>

        <Text preset="caption" color={DARK.textFaint}>
          AGRIKONNECT AFRICA — infrastructure de traçabilité des filières agricoles.
        </Text>
      </Animated.View>
    </HeroBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.naturalWhite },
  split: { flex: 1, flexDirection: 'row' },
  brand: { flex: 1, justifyContent: 'center' },
  brandInner: { padding: SPACING.xxxl, gap: SPACING.lg, maxWidth: 520 },
  brandTitle: { maxWidth: 420 },
  points: { gap: SPACING.md, marginVertical: SPACING.md },
  point: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  formColumn: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xxxl },
  formInner: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: SPACING.lg },
  formHeader: { gap: SPACING.sm },
  mobileColumn: {
    padding: LAYOUT.screenPadding,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
    flexGrow: 1,
  },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  mobileTitle: { gap: SPACING.xs },
  lineHeight: { lineHeight: 21 },
});
