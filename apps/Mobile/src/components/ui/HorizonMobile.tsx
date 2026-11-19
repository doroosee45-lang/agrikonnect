import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  CREME,
  ENCRE,
  FONCTION,
  RAYON,
  ROUGE,
  SCIENTIFIQUE,
  TACTILE,
  TERRE,
  VERT,
} from '@/theme/agrikonnect';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { Text } from './Text';
import { tr } from '@/i18n';

/* ============================================================================
 * HORIZON MOBILE BENTO PRIMITIVES — AGRIKONNECT AFRICA
 *
 * Adaptation mobile/tablette du prototype Horizon :
 *  - Zero code hexadecimal en dur (regle I3) ;
 *  - Zones tactiles >= 48pt (TACTILE.mobileMin) ;
 *  - Courbes et anneaux Donut natifs via react-native-svg ;
 *  - 100 % pilote par les donnees reelles de l'API.
 * ========================================================================== */

export type MobileHorizonTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TONE_PALETTE: Record<
  MobileHorizonTone,
  { accent: string; pillBg: string; pillText: string }
> = {
  green: { accent: VERT[500], pillBg: VERT[100], pillText: VERT[800] },
  amber: { accent: FONCTION.attention, pillBg: TERRE[100], pillText: TERRE[800] },
  red: { accent: ROUGE[500], pillBg: ROUGE[50], pillText: ROUGE[700] },
  blue: { accent: SCIENTIFIQUE[500], pillBg: SCIENTIFIQUE[100], pillText: SCIENTIFIQUE[900] },
  neutral: { accent: ENCRE[500], pillBg: CREME[100], pillText: ENCRE[700] },
};

/* ───────────── 1. Carte Operations Overview (4 KPIs a barre verticale) ───────────── */

export interface MobileHorizonKpi {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  badge?: string;
  tone?: MobileHorizonTone;
  icon?: IoniconName;
  onPress?: () => void;
}

export function MobileHorizonOverviewCard({
  title,
  updatedLabel,
  items,
}: {
  title: string;
  updatedLabel?: string;
  items: MobileHorizonKpi[];
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 820;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text preset="h3" color={COLORS.textPrimary} style={styles.flex1}>
          {title}
        </Text>
        {updatedLabel ? (
          <Text preset="caption" color={COLORS.slateGray}>
            {updatedLabel}
          </Text>
        ) : null}
      </View>

      <View style={[styles.kpiGrid, isWide ? styles.kpiGridWide : null]}>
        {items.map((item) => {
          const palette = TONE_PALETTE[item.tone ?? 'green'];
          const inner = (
            <View style={styles.kpiInner}>
              <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />
              <View style={styles.kpiContent}>
                <View style={styles.kpiLabelRow}>
                  {item.icon ? (
                    <Ionicons name={item.icon} size={14} color={COLORS.slateGray} />
                  ) : null}
                  <Text preset="caption" color={COLORS.slateGray} numberOfLines={1} style={styles.flex1}>
                    {item.label}
                  </Text>
                </View>

                <View style={styles.kpiBottomRow}>
                  <View style={styles.flex1}>
                    <Text preset="numeric" color={COLORS.textPrimary} style={styles.kpiNumber}>
                      {item.value}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  {item.badge ? (
                    <View style={[styles.pill, { backgroundColor: palette.pillBg }]}>
                      <Text preset="caption" color={palette.pillText} style={styles.pillText}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );

          return item.onPress ? (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.value}`}
              style={({ pressed }) => [
                styles.kpiCell,
                isWide ? styles.kpiCellWide : styles.kpiCellMobile,
                pressed ? styles.pressed : null,
              ]}
            >
              {inner}
            </Pressable>
          ) : (
            <View
              key={item.id}
              style={[styles.kpiCell, isWide ? styles.kpiCellWide : styles.kpiCellMobile]}
            >
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────────── 2. Courbe de performance SVG (Area + Line Chart) ───────────── */

export interface MobileHorizonPoint {
  label: string;
  value: number;
}

export function MobileHorizonAreaCard({
  title,
  seriesLabel,
  points,
  emptyMessage = tr('ui.aucuneSerieTemporelleSurCettePeriode'),
}: {
  title: string;
  seriesLabel: string;
  points: MobileHorizonPoint[];
  emptyMessage?: string;
}) {
  const W = 320;
  const H = 148;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(1, ...points.map((p) => p.value));
  const coords = points.map((p, idx) => ({
    x: points.length <= 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW,
    y: padT + plotH - (Math.max(0, p.value) / maxVal) * plotH,
    p,
  }));

  const lineD = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaD =
    coords.length > 0
      ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text preset="h3" color={COLORS.textPrimary} style={styles.flex1}>
          {title}
        </Text>
        <View style={[styles.pill, { backgroundColor: VERT[100] }]}>
          <Text preset="caption" color={VERT[800]} style={styles.pillText}>
            {seriesLabel}
          </Text>
        </View>
      </View>

      {points.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text preset="caption" color={COLORS.slateGray}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={156}>
          <Defs>
            <LinearGradient id="akHorizonGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={VERT[500]} stopOpacity="0.24" />
              <Stop offset="100%" stopColor={VERT[500]} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((t) => {
            const y = padT + plotH - t * plotH;
            return (
              <Line
                key={t}
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke={CREME[200]}
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          <Path d={areaD} fill="url(#akHorizonGrad)" />
          <Path
            d={lineD}
            fill="none"
            stroke={VERT[500]}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map((c, idx) => (
            <Circle
              key={`${c.p.label}-${idx}`}
              cx={c.x}
              cy={c.y}
              r="3.2"
              fill={COLORS.pureWhite}
              stroke={VERT[500]}
              strokeWidth="2"
            />
          ))}

          {coords.map((c, idx) =>
            idx === 0 || idx === coords.length - 1 || idx === Math.floor(coords.length / 2) ? (
              <SvgText
                key={`lbl-${idx}`}
                x={c.x}
                y={H - 6}
                fontSize="9.5"
                fill={ENCRE[500]}
                textAnchor="middle"
              >
                {c.p.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

/* ───────────── 3. Liste de progression active ("Active fleet") ───────────── */

export interface MobileHorizonTrack {
  id: string;
  code: string;
  subtitle: string;
  statusLabel: string;
  tone: MobileHorizonTone;
  leftCode: string;
  rightCode: string;
  progressPct: number;
  icon?: IoniconName;
  onPress?: () => void;
}

export function MobileHorizonTrackCard({
  title,
  items,
  emptyMessage = tr('ui.aucunFluxActifEnregistre'),
}: {
  title: string;
  items: MobileHorizonTrack[];
  emptyMessage?: string;
}) {
  return (
    <View style={styles.card}>
      <Text preset="h3" color={COLORS.textPrimary}>
        {title}
      </Text>

      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text preset="caption" color={COLORS.slateGray}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <View style={styles.trackStack}>
          {items.slice(0, 4).map((item) => {
            const palette = TONE_PALETTE[item.tone];
            const pct = Math.min(100, Math.max(12, Math.round(item.progressPct)));
            const body = (
              <View style={styles.trackBox}>
                <View style={styles.trackTop}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1} style={styles.flex1}>
                    {item.code} ·{' '}
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.subtitle}
                    </Text>
                  </Text>
                  <View style={[styles.pill, { backgroundColor: palette.pillBg }]}>
                    <Text preset="caption" color={palette.pillText} style={styles.pillText}>
                      {item.statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.trackProgressRow}>
                  <View style={styles.trackIconTile}>
                    <Ionicons name={item.icon ?? 'cube-outline'} size={16} color={VERT[800]} />
                  </View>
                  <Text preset="caption" color={COLORS.textPrimary} style={styles.stageText}>
                    {item.leftCode}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text preset="caption" color={COLORS.textPrimary} style={styles.stageTextRight}>
                    {item.rightCode}
                  </Text>
                </View>
              </View>
            );

            return item.onPress ? (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.minTouch, pressed ? styles.pressed : null]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={item.id}>{body}</View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ───────────── 4. Anneau Donut multi-segments ("Order status") ───────────── */

export interface MobileHorizonSegment {
  label: string;
  value: number;
  tone: MobileHorizonTone;
}

export function MobileHorizonDonutCard({
  title,
  totalValue,
  totalLabel,
  segments,
}: {
  title: string;
  totalValue: string;
  totalLabel: string;
  segments: MobileHorizonSegment[];
}) {
  const sum = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let cumulative = 0;

  const arcs = segments.map((s) => {
    const val = Math.max(0, s.value);
    const ratio = sum > 0 ? val / sum : 0;
    const length = ratio * C;
    const offset = -cumulative * C;
    cumulative += ratio;
    return {
      ...s,
      pct: sum > 0 ? Math.round(ratio * 100) : 0,
      length,
      offset,
      color: TONE_PALETTE[s.tone].accent,
    };
  });

  return (
    <View style={styles.card}>
      <Text preset="h3" color={COLORS.textPrimary}>
        {title}
      </Text>

      <View style={styles.donutRow}>
        <View style={styles.donutWrap}>
          <Svg width={136} height={136} viewBox="0 0 136 136">
            <Circle cx="68" cy="68" r={R} stroke={CREME[200]} strokeWidth="11" fill="none" />
            {sum > 0
              ? arcs.map((arc) =>
                  arc.length > 0 ? (
                    <Circle
                      key={arc.label}
                      cx="68"
                      cy="68"
                      r={R}
                      stroke={arc.color}
                      strokeWidth="11"
                      fill="none"
                      strokeDasharray={`${Math.max(0, arc.length - 2)} ${C}`}
                      strokeDashoffset={arc.offset}
                      // Rotation SVG standard (centre inclus) : identique sur iOS, Android et web.
                      // `rotation` + `origin` produisait sur le web l'attribut invalide `transform-origin`.
                      transform="rotate(-90 68 68)"
                    />
                  ) : null,
                )
              : null}
          </Svg>
          <View style={styles.donutCenter} pointerEvents="none">
            <Text preset="numeric" color={COLORS.textPrimary} style={styles.donutValue}>
              {totalValue}
            </Text>
            <Text preset="caption" color={COLORS.slateGray}>
              {totalLabel}
            </Text>
          </View>
        </View>

        <View style={styles.legendCol}>
          {arcs.map((arc) => (
            <View key={arc.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: arc.color }]} />
              <View style={styles.flex1}>
                <Text preset="caption" color={COLORS.textPrimary} numberOfLines={1} style={styles.pillText}>
                  {arc.label}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  {arc.pct}% • {arc.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.pureWhite,
    borderRadius: RAYON.carte,
    borderWidth: 1,
    borderColor: CREME[200],
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  flex1: { flex: 1 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  kpiGridWide: {
    flexWrap: 'nowrap',
  },
  kpiCell: {
    minHeight: TACTILE.mobile,
    backgroundColor: CREME[50],
    borderRadius: RAYON.champ,
    borderWidth: 1,
    borderColor: CREME[200],
    padding: SPACING.sm,
  },
  kpiCellMobile: {
    width: '48%',
    flexGrow: 1,
  },
  kpiCellWide: {
    flex: 1,
  },
  kpiInner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'stretch',
  },
  accentBar: {
    width: 3.5,
    borderRadius: RAYON.pilule,
  },
  kpiContent: {
    flex: 1,
    gap: 6,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kpiBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  kpiNumber: {
    fontSize: 22,
    lineHeight: 26,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RAYON.pilule,
  },
  pillText: {
    fontWeight: '700',
  },
  emptyBox: {
    borderRadius: RAYON.champ,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CREME[300],
    backgroundColor: CREME[50],
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  trackStack: {
    gap: SPACING.sm,
  },
  trackBox: {
    borderRadius: RAYON.champ,
    borderWidth: 1,
    borderColor: CREME[200],
    backgroundColor: CREME[50],
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  trackTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  trackProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  trackIconTile: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: CREME[200],
    backgroundColor: COLORS.pureWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    fontWeight: '700',
    minWidth: 46,
  },
  stageTextRight: {
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: RAYON.pilule,
    backgroundColor: CREME[200],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: RAYON.pilule,
    backgroundColor: ENCRE[900],
  },
  minTouch: {
    minHeight: TACTILE.mobile,
  },
  pressed: {
    opacity: 0.85,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  donutWrap: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutValue: {
    fontSize: 20,
    lineHeight: 24,
  },
  legendCol: {
    flex: 1,
    minWidth: 140,
    gap: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: RAYON.pilule,
  },
});
