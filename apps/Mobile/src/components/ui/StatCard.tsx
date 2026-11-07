import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TINTS } from '@/theme/colors';
import { ICON_SIZE, RADIUS, SPACING } from '@/theme/space';

import { Card, PressableCard, type CardProps } from './Card';
import { Text } from './Text';

/**
 * MIROIR NATIF du StatCard du design system web.
 *
 * Meme API que la version web (label, valeur, unite, periode, icone, source,
 * tendance, pied) afin qu un meme indicateur se decrive de la meme facon sur
 * les deux plateformes. Aucune valeur par defaut pour la tendance : un
 * indicateur n affiche jamais une evolution inventee.
 */
export interface StatTendance {
  valeur: string;
  sens: 'up' | 'down' | 'flat';
  libelle?: string;
}

export interface StatCardProps {
  label: string;
  valeur: string;
  unite?: string;
  periode?: string;
  icone?: keyof typeof Ionicons.glyphMap;
  source?: string;
  tendance?: StatTendance;
  pied?: ReactNode;
  /** Ton de la surface ; `white` par defaut, comme sur le web. */
  tone?: CardProps['tone'];
  /** Rend la carte cliquable (ressort d appui natif). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const SENS_ICONE: Record<StatTendance['sens'], keyof typeof Ionicons.glyphMap> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'remove',
};

const SENS_FOND: Record<StatTendance['sens'], string> = {
  up: TINTS.successBg,
  down: TINTS.errorBg,
  flat: COLORS.naturalWhite,
};

const SENS_TEXTE: Record<StatTendance['sens'], string> = {
  up: COLORS.forestGreen,
  down: COLORS.error,
  flat: COLORS.slateGray,
};

const SENS_LIBELLE: Record<StatTendance['sens'], string> = {
  up: 'en hausse',
  down: 'en baisse',
  flat: 'stable',
};

export function StatCard({
  label,
  valeur,
  unite,
  periode,
  icone,
  source,
  tendance,
  pied,
  tone = 'white',
  onPress,
  style,
}: StatCardProps) {
  const contenu = (
    <>
      <View style={styles.entete}>
        <Text preset="caption" color={COLORS.slateGray} style={styles.label}>
          {label}
        </Text>
        {icone ? <Ionicons name={icone} size={ICON_SIZE.sm} color={COLORS.forestGreen} /> : null}
      </View>

      <View style={styles.valeurLigne}>
        <Text preset="numeric" color={COLORS.textPrimary}>
          {valeur}
        </Text>
        {unite ? (
          <Text preset="caption" color={COLORS.slateGray}>
            {unite}
          </Text>
        ) : null}
      </View>

      {tendance || periode || source || pied ? (
        <View style={styles.pied}>
          {tendance ? (
            <View
              style={[styles.badge, { backgroundColor: SENS_FOND[tendance.sens] }]}
              accessible
              accessibilityLabel={`Tendance ${SENS_LIBELLE[tendance.sens]} : ${tendance.valeur}`}
            >
              <Ionicons name={SENS_ICONE[tendance.sens]} size={ICON_SIZE.xs} color={SENS_TEXTE[tendance.sens]} />
              <Text preset="caption" color={SENS_TEXTE[tendance.sens]}>
                {tendance.valeur}
              </Text>
              {tendance.libelle ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  {` -- ${tendance.libelle}`}
                </Text>
              ) : null}
            </View>
          ) : null}

          {periode ? (
            <Text preset="caption" color={COLORS.slateGray}>
              {periode}
            </Text>
          ) : null}

          {source ? (
            <Text preset="caption" color={COLORS.slateGray}>
              {`Source : ${source}`}
            </Text>
          ) : null}

          {pied ? <View style={styles.piedPleineLargeur}>{pied}</View> : null}
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <PressableCard onPress={onPress} tone={tone} style={style}>
        {contenu}
      </PressableCard>
    );
  }

  return (
    <Card tone={tone} style={style}>
      {contenu}
    </Card>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  label: { flexShrink: 1 },
  valeurLigne: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  pied: { gap: SPACING.xs, marginTop: SPACING.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  piedPleineLargeur: { width: '100%' },
});
