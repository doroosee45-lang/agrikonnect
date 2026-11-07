import { type StyleProp, type ViewStyle } from 'react-native';
import { useState } from 'react';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { resolveMediaUrl } from '@/lib/config';
import { COLORS, DARK } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { RADIUS } from '@/theme/space';

import { Text } from './Text';

export interface AppImageProps extends Omit<ImageProps, 'source' | 'style'> {
  /** URL absolue, URL signée (TTL 300 s) ou chemin relatif rebasé automatiquement. */
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  fit?: ImageContentFit;
  /** Libellé de repli si l'image est absente ou en erreur. */
  fallbackLabel?: string;
  /** Dégradé posé sur l'image pour garantir la lisibilité du texte. */
  scrim?: 'bottom' | 'top' | 'none';
  children?: React.ReactNode;
}

const SCRIMS: Record<'bottom' | 'top', readonly [string, string]> = {
  bottom: ['rgba(16, 38, 27, 0)', 'rgba(16, 38, 27, 0.78)'],
  top: ['rgba(16, 38, 27, 0.55)', 'rgba(16, 38, 27, 0)'],
};

/**
 * Image de l'application.
 *
 * - fond vert pâle pendant le chargement (pas de squelette gris qui clignote) ;
 * - fondu d'apparition court ;
 * - repli explicite si l'URL est absente ou en erreur : on n'affiche jamais une
 *   image cassée ni une photo d'illustration qui ne correspond pas au sujet.
 */
export function AppImage({
  uri,
  style,
  radius = RADIUS.lg,
  fit = 'cover',
  fallbackLabel,
  scrim = 'none',
  children,
  transition = DURATION.slow,
  ...rest
}: AppImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(uri);
  const missing = !resolved || failed;

  return (
    <Animated.View entering={FadeIn.duration(DURATION.base)} style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: COLORS.paleGreen }, style]}>
      {missing ? (
        <Fallback radius={radius} label={fallbackLabel} />
      ) : (
        <Image
          {...rest}
          source={{ uri: resolved }}
          contentFit={fit}
          transition={transition}
          recyclingKey={resolved}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%' }}
        />
      )}

      {scrim !== 'none' && !missing ? (
        <LinearGradient
          colors={[...SCRIMS[scrim]]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      {children}
    </Animated.View>
  );
}

function Fallback({ radius, label }: { radius: number; label?: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base)}
      exiting={FadeOut.duration(DURATION.fast)}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: radius,
        backgroundColor: COLORS.paleGreen,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name="leaf-outline" size={26} color="rgba(23, 77, 53, 0.35)" />
      {label ? (
        <Text preset="caption" color={DARK.textFaint}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
}
