import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { CREME } from '../../theme/agrikonnect';

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Autorise plusieurs panneaux ouverts. */
  multiple?: boolean;
  initialOpenId?: string;
  light?: boolean;
}

/**
 * Accordéon (FAQ, mentions).
 *
 * La hauteur est mesurée au rendu puis animée : pas de `LayoutAnimation`
 * globale, donc aucune interférence avec les autres animations de l'écran.
 */
export function Accordion({ items, multiple = false, initialOpenId, light = false }: AccordionProps) {
  const [open, setOpen] = useState<string[]>(initialOpenId ? [initialOpenId] : []);

  const toggle = (id: string) =>
    setOpen((current) => {
      const isOpen = current.includes(id);
      if (multiple) return isOpen ? current.filter((item) => item !== id) : [...current, id];
      return isOpen ? [] : [id];
    });

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <AccordionRow
          key={item.id}
          item={item}
          index={index}
          open={open.includes(item.id)}
          onToggle={() => toggle(item.id)}
          light={light}
        />
      ))}
    </View>
  );
}

function AccordionRow({
  item,
  index,
  open,
  onToggle,
  light,
}: {
  item: AccordionItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  light: boolean;
}) {
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  progress.value = withTiming(open ? 1 : 0, {
    duration: DURATION.slow,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const bodyStyle = useAnimatedStyle(() => ({
    height: height * progress.value,
    opacity: 0.25 + progress.value * 0.75,
  }));

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const titleColor = light ? COLORS.naturalWhite : COLORS.textPrimary;
  const answerColor = light ? 'rgba(246, 247, 242, 0.75)' : COLORS.slateGray;

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: light ? 'rgba(246, 247, 242, 0.14)' : open ? 'rgba(23, 77, 53, 0.28)' : COLORS.lightBorder,
          backgroundColor: light ? 'rgba(246, 247, 242, 0.04)' : open ? CREME[50] : COLORS.pureWhite,
        },
      ]}
    >
      <PressableScale onPress={onToggle} style={styles.header} accessibilityRole="button">
        <Text preset="caption" color={COLORS.gold} style={styles.index}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text preset="bodyMedium" color={titleColor} style={styles.question}>
          {item.question}
        </Text>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={16} color={open ? COLORS.livingGreen : COLORS.slateGray} />
        </Animated.View>
      </PressableScale>

      <Animated.View style={[styles.body, bodyStyle]}>
        <View
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          style={styles.answerWrap}
        >
          <Text preset="bodySm" color={answerColor}>
            {item.answer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.md },
  row: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg },
  index: { width: 22 },
  question: { flex: 1 },
  body: { overflow: 'hidden' },
  answerWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingLeft: SPACING.lg + 22 + SPACING.md },
});
