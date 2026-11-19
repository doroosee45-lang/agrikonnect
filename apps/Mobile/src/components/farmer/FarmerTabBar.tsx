import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { COLORS } from '@/theme/colors';
import { SPRING } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale, Text } from '@/components/ui';
import { tr } from '@/i18n';

import { appuyerOnglet, ongletsVisibles, type NavigationOnglets } from './farmerTabs';

/**
 * Props réellement reçues d'Expo Router 58 : `navigateToTab` et `emitter`
 * (pas de `navigation`, voir farmerTabs.ts).
 */
export interface TabBarProps extends NavigationOnglets {
  state: { index: number; routes: Array<{ name: string; key: string }> };
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
  get index() { return tr('ui.accueil'); },
  get farms() { return tr('ui.exploitations'); },
  get plots() { return tr('ui.parcelles'); },
  get productions() { return tr('ui.productions'); },
  get soil() { return tr('ui.sols'); },
};

/**
 * Barre d'onglets de l'espace producteur.
 *
 * L'indicateur glisse d'un onglet à l'autre avec un ressort (jamais une
 * translation linéaire) et l'icône active remonte légèrement : le retour
 * visuel est immédiat, sans masquer le contenu.
 *
 * Seuls les cinq onglets de `farmerTabs.ts` sont affichés (filtre défensif ;
 * le groupe `(tabs)` ne contient plus que ceux-là).
 */
export function FarmerTabBar({ state, emitter, navigateToTab, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { onglets, actif } = ongletsVisibles(state.routes, state.index);
  const nombre = Math.max(onglets.length, 1);

  // Largeur intérieure réelle de la capsule (mesurée), estimée avant la première mesure.
  const estimation = Math.min(width, MAX_LARGEUR) - 2 * MARGE_CAPSULE - 2 * RETRAIT;
  const [interieur, setInterieur] = useState(estimation);
  const itemWidth = interieur / nombre;

  const position = useSharedValue(Math.max(actif, 0));

  useEffect(() => {
    if (actif >= 0) position.value = withSpring(actif, SPRING.card);
  }, [actif, position]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * itemWidth }],
    width: itemWidth,
  }));

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom - 6, SPACING.sm) }]}>
      <View
        style={styles.capsule}
        onLayout={(event) => {
          const mesure = event.nativeEvent.layout.width - 2 * RETRAIT;
          if (mesure > 0 && Math.abs(mesure - interieur) > 0.5) setInterieur(mesure);
        }}
      >
        {actif >= 0 ? <Animated.View style={[styles.pastille, indicator]} /> : null}
        {onglets.map((route, index) => {
          const active = index === actif;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              active={active}
              onPress={() => {
                appuyerOnglet(route, active, { emitter, navigateToTab, navigation });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ name, active, onPress }: { name: string; active: boolean; onPress: () => void }) {
  const libelle = LABELS[name] ?? name;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: active }}
      style={styles.item}
    >
      <View style={styles.itemInner}>
        <Ionicons
          name={active ? (ICONS[name] ?? 'ellipse').replace('-outline', '') as keyof typeof Ionicons.glyphMap : ICONS[name] ?? 'ellipse-outline'}
          size={22}
          color={active ? COLORS.pureWhite : COLORS.slateGray}
        />
        <Text
          preset="caption"
          color={active ? COLORS.pureWhite : COLORS.slateGray}
          style={[styles.label, active ? styles.labelActif : null]}
          numberOfLines={1}
        >
          {libelle}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Capsule flottante : marges latérales, retrait intérieur de la pastille, largeur maximale (tablette). */
const MARGE_CAPSULE = 12;
const RETRAIT = 5;
const MAX_LARGEUR = 560;
const HAUTEUR = 66;

const styles = StyleSheet.create({
  // Fond identique aux écrans : la capsule semble flotter au-dessus du contenu.
  wrapper: {
    backgroundColor: COLORS.naturalWhite,
    paddingHorizontal: MARGE_CAPSULE,
    paddingTop: SPACING.xs,
  },
  capsule: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_LARGEUR,
    height: HAUTEUR,
    padding: RETRAIT,
    borderRadius: HAUTEUR / 2,
    backgroundColor: COLORS.pureWhite,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    ...Platform.select({
      ios: { shadowColor: 'rgba(12, 30, 21, 0.18)', shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, shadowOpacity: 1 },
      android: { elevation: 10 },
      default: { boxShadow: '0 8px 24px rgba(12, 30, 21, 0.14)' },
    }),
  },
  // Pastille de l'onglet actif, inscrite dans la capsule.
  pastille: {
    position: 'absolute',
    top: RETRAIT,
    bottom: RETRAIT,
    left: RETRAIT,
    borderRadius: (HAUTEUR - 2 * RETRAIT) / 2,
    backgroundColor: COLORS.forestGreen,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  itemInner: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11 },
  labelActif: { fontWeight: '600' },
});
