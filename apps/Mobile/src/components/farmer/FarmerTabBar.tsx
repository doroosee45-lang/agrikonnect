import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { COLORS } from '@/theme/colors';
import { SPRING } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale, Text } from '@/components/ui';

/** Structure minimale attendue d'une barre d'onglets expo-router. */
export interface TabBarProps {
  state: { index: number; routes: Array<{ name: string; key: string }> };
  navigation: { navigate: (name: string) => void };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: unknown } }>;
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'grid-outline',
  farms: 'home-outline',
  plots: 'map-outline',
  productions: 'leaf-outline',
  soil: 'flask-outline',
};

const LABELS: Record<string, string> = {
  index: 'Accueil',
  farms: 'Exploitations',
  plots: 'Parcelles',
  productions: 'Productions',
  soil: 'Sols',
};

/**
 * Barre d'onglets de l'espace producteur.
 *
 * L'indicateur glisse d'un onglet à l'autre avec un ressort (jamais une
 * translation linéaire) et l'icône active remonte légèrement : le retour
 * visuel est immédiat, sans masquer le contenu.
 */
export function FarmerTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const count = state.routes.length;
  const itemWidth = Math.min(width, 640) / count;

  const position = useSharedValue(state.index);

  useEffect(() => {
    position.value = withSpring(state.index, SPRING.card);
  }, [state.index, position]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * itemWidth }],
    width: itemWidth,
  }));

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.bar}>
        <Animated.View style={[styles.indicator, indicator]} />
        {state.routes.map((route, index) => {
          const active = index === state.index;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              active={active}
              position={position}
              index={index}
              onPress={() => navigation.navigate(route.name)}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  name,
  active,
  index,
  position,
  onPress,
}: {
  name: string;
  active: boolean;
  index: number;
  position: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(position.value, [index - 0.5, index, index + 0.5], [0, -3, 0], 'clamp') }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, style]}>
        <Ionicons
          name={active ? (ICONS[name] ?? 'ellipse').replace('-outline', '') as keyof typeof Ionicons.glyphMap : ICONS[name] ?? 'ellipse-outline'}
          size={20}
          color={active ? COLORS.pureWhite : COLORS.slateGray}
        />
        <Text preset="caption" color={active ? COLORS.pureWhite : COLORS.slateGray} style={styles.label}>
          {LABELS[name] ?? name}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.pureWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBorder,
    ...Platform.select({
      ios: { shadowColor: 'rgba(23,77,53,0.10)', shadowOffset: { width: 0, height: -6 }, shadowRadius: 16, shadowOpacity: 1 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  bar: { flexDirection: 'row', maxWidth: 640, alignSelf: 'center', width: '100%', height: 62 },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.forestGreen,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInner: { alignItems: 'center', gap: 2 },
  label: { fontSize: 10 },
});
