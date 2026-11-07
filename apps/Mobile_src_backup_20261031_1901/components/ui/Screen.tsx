import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { COLORS } from '@/theme/colors';
import { LAYOUT } from '@/theme/space';

import { ScrollYProvider } from './Reveal';

export interface ScreenProps {
  children: ReactNode;
  /** false = écran à défilement géré par l'enfant (FlatList, PagerView…). */
  scroll?: boolean;
  /** Marge horizontale `LAYOUT.screenPadding`. */
  padded?: boolean;
  /** Bords protégés par la safe area. */
  edges?: Edge[];
  background?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Largeur max centrée : le site public reste lisible sur tablette. */
  maxContentWidth?: number;
  showsScrollIndicator?: boolean;
  contentInsetAdjustmentBehavior?: 'automatic' | 'never' | 'scrollableAxes';
}

/**
 * Conteneur d'écran.
 *
 * Il publie la position de défilement aux `Reveal` descendants (voir
 * `Reveal.tsx`) et applique la safe area. Un écran qui gère lui-même son
 * défilement récupère `useScreenScrollProps()` pour brancher sa FlatList sur le
 * même mécanisme de révélation.
 */
export function Screen({
  children,
  scroll = true,
  padded = false,
  edges = ['top', 'bottom'],
  background = COLORS.naturalWhite,
  style,
  contentStyle,
  maxContentWidth,
  showsScrollIndicator = false,
  contentInsetAdjustmentBehavior = 'automatic',
}: ScreenProps) {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const content = (
    <View style={[styles.fill, padded ? styles.padded : null, style]}>
      {maxContentWidth ? <View style={[styles.centered, { maxWidth: maxContentWidth }]}>{children}</View> : children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      <ScrollYProvider value={scrollY}>
        {scroll ? (
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={showsScrollIndicator}
            contentContainerStyle={contentStyle}
            contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
            style={styles.fill}
          >
            {content}
          </Animated.ScrollView>
        ) : (
          content
        )}
      </ScrollYProvider>
    </SafeAreaView>
  );
}

/** À étaler sur une FlatList interne pour alimenter les `Reveal`. */
export function useScreenScrollProps() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  return { scrollY, onScroll, scrollEventThrottle: 16 } as const;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  padded: { paddingHorizontal: LAYOUT.screenPadding },
  centered: { width: '100%', alignSelf: 'center' },
});
