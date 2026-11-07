import { View, type StyleProp, type ViewStyle } from 'react-native';

import { translate, useI18n } from '@/i18n';
import { provenanceOf, type ProvenanceKind } from '@/lib/format';
import { SPACING } from '@/theme/space';

import { Text } from './Text';
import { ENCRE } from '../../theme/agrikonnect';

export interface ProvenanceTagProps {
  /** Origine de la valeur affichée : mesure, capteur, satellite, déclaration… */
  kind: ProvenanceKind;
  /** Libellé court optionnel (sinon celui du dictionnaire i18n). */
  label?: string;
  size?: 'sm' | 'md';
  /** Fond clair pour les sections sombres. */
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Marqueur de provenance — exigence transversale du CDC.
 *
 * ✔ = mesuré ou vérifié, ≈ = estimé ou déclaré. Toute donnée chiffrée affichée
 * dans l'application doit porter ce marqueur : un utilisateur ne doit jamais
 * devoir deviner si un chiffre sort d'un laboratoire ou d'une déclaration.
 */
export function ProvenanceTag({ kind, label, size = 'sm', light = false, style }: ProvenanceTagProps) {
  const { locale } = useI18n();
  const meta = provenanceOf(kind);
  const text = label ?? translate(locale, meta.labelKey as never);
  const muted = light ? 'rgba(246, 247, 242, 0.72)' : meta.color;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }, style]}>
      <Text preset="caption" color={muted} style={{ fontSize: size === 'sm' ? 12 : 14 }}>
        {meta.symbol}
      </Text>
      <Text preset="caption" color={muted} style={{ fontSize: size === 'sm' ? 11 : 12 }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Valeur chiffrée + sa provenance, indissociables.
 * À utiliser partout où un chiffre métier est affiché (rendement, prix, pH…).
 */
export function ProvenanceValue({
  value,
  unit,
  kind,
  preset = 'numeric',
  color,
  note,
}: {
  value: string;
  unit?: string;
  kind: ProvenanceKind;
  preset?: 'numeric' | 'h2' | 'body';
  color?: string;
  note?: string;
}) {
  const { locale } = useI18n();
  const meta = provenanceOf(kind);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs }}>
        <Text preset={preset} color={color ?? ENCRE[700]}>
          {value}
        </Text>
        {unit ? (
          <Text preset="caption" color={ENCRE[500]}>
            {unit}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 }}>
        <Text preset="caption" color={meta.color}>
          {meta.symbol} {translate(locale, meta.labelKey as never)}
        </Text>
        {note ? (
          <Text preset="caption" color={ENCRE[500]}>
            · {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
