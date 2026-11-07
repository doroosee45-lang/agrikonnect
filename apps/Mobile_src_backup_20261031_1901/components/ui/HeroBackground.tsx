import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COLORS, DARK } from '@/theme/colors';
import { VERT } from '../../theme/agrikonnect';

interface OrbConfig {
  size: number;
  top: string;
  left: string;
  color: string;
  duration: number;
  drift: number;
}

const ORBS: OrbConfig[] = [
  { size: 320, top: '-12%', left: '-18%', color: 'rgba(101, 166, 75, 0.28)', duration: 9_000, drift: 26 },
  { size: 240, top: '22%', left: '62%', color: 'rgba(214, 166, 79, 0.2)', duration: 11_000, drift: -20 },
  { size: 180, top: '58%', left: '8%', color: 'rgba(101, 166, 75, 0.18)', duration: 13_000, drift: 18 },
  { size: 260, top: '66%', left: '70%', color: 'rgba(23, 77, 53, 0.55)', duration: 15_000, drift: -14 },
];

function Orb({ size, top, left, color, duration, drift }: OrbConfig) {
  const progress = useSharedValue(0);

  progress.value = withRepeat(
    withSequence(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
    ),
    -1,
    false,
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * drift },
      { scale: 1 + progress.value * 0.08 },
    ],
    opacity: 0.55 + progress.value * 0.45,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, left },
        style,
      ]}
    />
  );
}

/**
 * Fond des sections d'ouverture.
 *
 * Un dégradé vert forêt profond, quatre halos qui dérivent lentement (10 à 15 s
 * l'aller-retour) et un voile de lisibilité. Le mouvement est assez lent pour
 * ne jamais distraire de la lecture, et il tourne sur le thread UI.
 */
export function HeroBackground({
  children,
  style,
  orbs = true,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  orbs?: boolean;
}) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[VERT[950], DARK.bg, VERT[900]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {orbs ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ORBS.map((orb) => (
            <Orb key={`${orb.top}-${orb.left}`} {...orb} />
          ))}
        </View>
      ) : null}

      {/* Liseré doré : signature de la marque, posé en bas de section. */}
      <LinearGradient
        colors={['rgba(214, 166, 79, 0)', 'rgba(214, 166, 79, 0.65)', 'rgba(214, 166, 79, 0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.goldLine}
        pointerEvents="none"
      />

      {children}
    </View>
  );
}

/** Fond clair équivalent, pour les sections intérieures premium. */
export function PaperBackground({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[COLORS.pureWhite, COLORS.naturalWhite, COLORS.paleGreen]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  orb: { position: 'absolute' },
  goldLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5 },
});
