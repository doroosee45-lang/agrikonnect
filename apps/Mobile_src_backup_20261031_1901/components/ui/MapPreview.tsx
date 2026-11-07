import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { CREME } from '../../theme/agrikonnect';

export interface MapPin {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  crops?: string[];
  totalAreaHa?: number | null;
}

export interface MapBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Emprise par défaut : le continent africain et ses marges. */
export const AFRICA_BOUNDS: MapBounds = { minLng: -20, minLat: -36, maxLng: 54, maxLat: 38 };

function Pulse({ color, delay }: { color: string; delay: number }) {
  const progress = useSharedValue(0);

  progress.value = withRepeat(
    withSequence(
      withTiming(0, { duration: delay }),
      withTiming(1, { duration: 2_400, easing: Easing.out(Easing.quad) }),
    ),
    -1,
    false,
  );

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 2.6 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulse, { backgroundColor: color }, style]}
    />
  );
}

/**
 * Carte de situation.
 *
 * Projection équirectangulaire dans une emprise connue, fond en trame de
 * points et méridiens/parallèles : aucun fond de carte tiers n'est chargé, donc
 * aucune requête vers un service de tuiles et aucune dépendance réseau.
 *
 * Les points viennent de `GET /public/map`, dont les coordonnées sont déjà
 * arrondies côté serveur (MAP-04). La note de précision du serveur est affichée
 * telle quelle sous la carte.
 */
export function MapPreview({
  pins,
  bounds = AFRICA_BOUNDS,
  height = 300,
  note,
  onSelect,
}: {
  pins: MapPin[];
  bounds?: MapBounds;
  height?: number;
  note?: string;
  onSelect?: (slug: string) => void;
}) {
  const [size, setSize] = useState({ width: 0, height });

  const project = (latitude: number, longitude: number) => {
    const x = ((longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * size.width;
    const y = ((bounds.maxLat - latitude) / (bounds.maxLat - bounds.minLat)) * size.height;
    return { x, y };
  };

  const meridians: number[] = [];
  for (let lng = Math.ceil(bounds.minLng / 10) * 10; lng <= bounds.maxLng; lng += 10) meridians.push(lng);
  const parallels: number[] = [];
  for (let lat = Math.ceil(bounds.minLat / 10) * 10; lat <= bounds.maxLat; lat += 10) parallels.push(lat);

  return (
    <View>
      <View
        onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height })}
        style={[styles.map, { height }]}
      >
        {size.width > 0 ? (
          <Svg width={size.width} height={size.height}>
            <Defs>
              <Pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
                <Circle cx="1.4" cy="1.4" r="1.1" fill="rgba(23, 77, 53, 0.14)" />
              </Pattern>
            </Defs>
            <Rect width={size.width} height={size.height} fill="url(#dots)" />
            {meridians.map((lng) => {
              const { x } = project(0, lng);
              return <Line key={`m${lng}`} x1={x} y1={0} x2={x} y2={size.height} stroke="rgba(23, 77, 53, 0.10)" strokeWidth={1} />;
            })}
            {parallels.map((lat) => {
              const { y } = project(lat, 0);
              return <Line key={`p${lat}`} x1={0} y1={y} x2={size.width} y2={y} stroke="rgba(23, 77, 53, 0.10)" strokeWidth={1} />;
            })}
          </Svg>
        ) : null}

        {size.width > 0 &&
          pins.map((pin, index) => {
            const { x, y } = project(pin.latitude, pin.longitude);
            const color = pin.verified ? COLORS.forestGreen : COLORS.gold;
            return (
              <PressableScale
                key={pin.slug}
                onPress={() => onSelect?.(pin.slug)}
                accessibilityRole="button"
                accessibilityLabel={pin.name}
                style={[styles.pinWrap, { left: x - 9, top: y - 9 }]}
              >
                <Pulse color={color} delay={index * 380} />
                <View
                  style={[
                    styles.pin,
                    {
                      backgroundColor: pin.verified ? COLORS.forestGreen : COLORS.pureWhite,
                      borderColor: color,
                    },
                  ]}
                />
              </PressableScale>
            );
          })}

        {size.width > 0 && pins.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.centered}>
              Aucun point publié dans cette emprise.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.forestGreen }]} />
          <Text preset="caption" color={COLORS.slateGray}>
            Vérifié
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.pureWhite, borderWidth: 2, borderColor: COLORS.gold }]} />
          <Text preset="caption" color={COLORS.slateGray}>
            Déclaré
          </Text>
        </View>
      </View>

      {note ? (
        <Text preset="caption" color={COLORS.slateGray} style={styles.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    backgroundColor: CREME[50],
    overflow: 'hidden',
  },
  pinWrap: { position: 'absolute', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  pulse: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  emptyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center', paddingHorizontal: SPACING.lg },
  legend: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  note: { marginTop: SPACING.sm, lineHeight: 17 },
});
