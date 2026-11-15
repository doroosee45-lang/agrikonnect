import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { CREME, ENCRE, FONCTION, ROUGE, SCIENTIFIQUE, TERRE, VERT } from '@/theme/agrikonnect';
import { cn } from '../lib/utils';
import { useI18n, tr } from '@/i18n';
import { bcpLocale } from '@/lib/format';

/* ============================================================================
 * HORIZON DASHBOARD DESIGN SYSTEM — AGRIKONNECT AFRICA
 *
 * Fidele au prototype Horizon tout en respectant strictement :
 *  - I3 : zero code hexadecimal en dur (uniquement les jetons agrikonnect.ts) ;
 *  - P3 / RG-M1-1 : zero chiffre fictif — chaque composant affiche les donnees
 *    reelles passees par l'API et un etat vide propre quand la serie est vide.
 * ========================================================================== */

export type HorizonTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

const TONE_PALETTE: Record<
  HorizonTone,
  { accent: string; pillBg: string; pillText: string; dot: string }
> = {
  green: {
    accent: VERT[500],
    pillBg: VERT[100],
    pillText: VERT[800],
    dot: VERT[500],
  },
  amber: {
    accent: TERRE[500],
    pillBg: TERRE[100],
    pillText: TERRE[800],
    dot: FONCTION.attention,
  },
  red: {
    accent: ROUGE[500],
    pillBg: ROUGE[50],
    pillText: ROUGE[700],
    dot: ROUGE[500],
  },
  blue: {
    accent: SCIENTIFIQUE[500],
    pillBg: SCIENTIFIQUE[100],
    pillText: SCIENTIFIQUE[900],
    dot: SCIENTIFIQUE[500],
  },
  neutral: {
    accent: CREME[300],
    pillBg: CREME[100],
    pillText: ENCRE[700],
    dot: ENCRE[500],
  },
};

export type HorizonIconName =
  | 'box'
  | 'truck'
  | 'clock'
  | 'check'
  | 'leaf'
  | 'map'
  | 'users'
  | 'alert'
  | 'chart'
  | 'shield'
  | 'layers'
  | 'key';

const MINI_ICONS: Record<HorizonIconName, string[]> = {
  box: ['M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z', 'M4 8 L12 12 L20 8', 'M12 12 V20'],
  truck: ['M2 7 H14 V16 H2 Z', 'M14 10 H18 L21 13 V16 H14 Z', 'M6 17.5 a1.7 1.7 0 1 0 0.01 0', 'M17 17.5 a1.7 1.7 0 1 0 0.01 0'],
  clock: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M12 7 V12 L15.5 14'],
  check: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M8.5 12.5 L11 15 L16 9.5'],
  leaf: ['M5 19 C5 10 12 5 19 5 C19 12 14 19 5 19 Z', 'M6 18 C9 14 12 11 16 9'],
  map: ['M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z', 'M9 4 V17.5', 'M15 6.5 V20'],
  users: ['M9 11 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 0 0 0 7 Z', 'M3 20 c0 -3.5 2.5 -6 6 -6 s6 2.5 6 6', 'M16 4.5 a3 3 0 0 1 0 6'],
  alert: ['M12 4 L21 19 H3 Z', 'M12 10 V14', 'M12 16.8 h0.01'],
  chart: ['M4 19 H20', 'M7 15 V11', 'M12 15 V7', 'M17 15 V9'],
  shield: ['M12 3 L19 6 V11.5 C19 16 15.8 19.5 12 21 C8.2 19.5 5 16 5 11.5 V6 Z'],
  layers: ['M12 3 L21 8 L12 13 L3 8 Z', 'M3 12 L12 17 L21 12', 'M3 16 L12 21 L21 16'],
  key: ['M15 7 a4 4 0 1 1 -4 -4 c0 1 0.4 1.7 1 2.3 L4 13.5 V17 H7.5 V20 H10.5 L12.5 18 V14.5 L14.5 12.5 A4 4 0 0 1 15 7 Z'],
};

export function HorizonMiniIcon({ name, size = 15 }: { name: HorizonIconName; size?: number }) {
  const paths = MINI_ICONS[name] ?? MINI_ICONS.box;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Conteneur principal d'un dashboard Horizon. */
export function HorizonShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1420px] flex-col gap-5 px-4 py-5 lg:px-6', className)}>
      {children}
    </div>
  );
}

/* ───────────────────── 1. BANDEAU 4 KPIs ("Operations overview") ───────────────────── */

export interface HorizonKpiItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  subtitle: string;
  badgeText?: string;
  badgeSubtext?: string;
  tone?: HorizonTone;
  icon?: HorizonIconName;
  href?: string;
}

export interface HorizonOverviewCardProps {
  title: string;
  updatedLabel?: string;
  headerRight?: ReactNode;
  items: HorizonKpiItem[];
}

export function HorizonOverviewCard({
  title,
  updatedLabel,
  headerRight,
  items,
}: HorizonOverviewCardProps) {
  return (
    <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold tracking-tight text-texte" style={{ margin: 0 }}>
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-texte-doux">
          {updatedLabel ? <span>{updatedLabel}</span> : null}
          {headerRight}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const palette = TONE_PALETTE[item.tone ?? 'green'];
          const inner = (
            <div className="group relative flex h-full flex-col justify-between pl-3.5 transition-transform duration-200 hover:-translate-y-0.5">
              {/* Trait vertical colore style Horizon */}
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 left-0 top-0.5 w-[3px] rounded-full"
                style={{ backgroundColor: palette.accent }}
              />

              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-texte-doux">
                {item.icon ? (
                  <span className="text-texte-doux">
                    <HorizonMiniIcon name={item.icon} size={15} />
                  </span>
                ) : null}
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-texte">
                      {item.value}
                    </span>
                    {item.unit ? (
                      <span className="text-xs font-semibold text-texte-doux">{item.unit}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[11.5px] text-texte-doux" style={{ margin: '8px 0 0 0' }}>
                    {item.subtitle}
                  </p>
                </div>

                {item.badgeText ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{ backgroundColor: palette.pillBg, color: palette.pillText }}
                    >
                      {item.badgeText}
                    </span>
                    {item.badgeSubtext ? (
                      <span className="text-[10.5px] text-texte-doux">{item.badgeSubtext}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );

          return item.href ? (
            <Link
              key={item.id}
              to={item.href}
              className="block rounded-xl p-1 hover:bg-fond/60"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {inner}
            </Link>
          ) : (
            <div key={item.id} className="p-1">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────── 2. COURBE DE PERFORMANCE ("Delivery performance") ───────────────────── */

export interface HorizonSeriesPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export interface HorizonAreaChartCardProps {
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  points: HorizonSeriesPoint[];
  headerRight?: ReactNode;
  emptyMessage?: string;
  sourceNote?: string;
}

export function HorizonAreaChartCard({
  title,
  primaryLabel,
  secondaryLabel,
  points,
  headerRight,
  emptyMessage = tr('ui.aucuneSerieTemporelleEnregistreeSurCette'),
  sourceNote,
}: HorizonAreaChartCardProps) {
  const gradId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'secondary'>('all');

  const hasSecondary = Boolean(secondaryLabel && points.some((p) => typeof p.secondary === 'number'));
  const maxVal = useMemo(() => {
    let m = 0;
    for (const p of points) {
      if (activeTab !== 'secondary' && p.primary > m) m = p.primary;
      if (hasSecondary && activeTab !== 'primary' && (p.secondary ?? 0) > m) m = p.secondary ?? 0;
    }
    return m > 0 ? m : 4;
  }, [points, hasSecondary, activeTab]);

  const W = 580;
  const H = 225;
  const padL = 42;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i: number) =>
    points.length <= 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW;
  const yAt = (val: number) => padT + plotH - (Math.max(0, val) / maxVal) * plotH;

  const primaryCoords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.primary), p }));
  const secondaryCoords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.secondary ?? 0), p }));

  const linePath = (coords: { x: number; y: number }[]) =>
    coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  const areaPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    return `${linePath(coords)} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: Math.round(maxVal * t),
    y: padT + plotH - t * plotH,
  }));

  const activePoint = hoveredIdx !== null ? primaryCoords[hoveredIdx] : null;

  return (
    <section className="flex flex-col rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>
          {title}
        </h3>
        {headerRight}
      </header>

      {/* Onglets segmentes style Horizon */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-bordure bg-fond p-1">
        <button
          type="button"
          onClick={() => setActiveTab((prev) => (prev === 'primary' ? 'all' : 'primary'))}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-colors',
            activeTab !== 'secondary' ? 'bg-surface text-texte shadow-2xs' : 'text-texte-doux',
          )}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: VERT[500] }} />
          <span>{primaryLabel}</span>
        </button>
        {hasSecondary ? (
          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === 'secondary' ? 'all' : 'secondary'))}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-colors',
              activeTab !== 'primary' ? 'bg-surface text-texte shadow-2xs' : 'text-texte-doux',
            )}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SCIENTIFIQUE[500] }} />
            <span>{secondaryLabel}</span>
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] text-texte-doux">
            <span>{tr('ui.pointS', { length: points.length })}</span>
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-bordure bg-fond/50 px-4 py-12 text-center">
          <p className="text-xs font-medium text-texte-doux" style={{ margin: 0 }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id={`${gradId}-primary`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VERT[500]} stopOpacity="0.22" />
                <stop offset="100%" stopColor={VERT[500]} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grille horizontale + axe Y */}
            {yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={CREME[200]}
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10.5"
                  fill={ENCRE[500]}
                >
                  {tick.val}
                </text>
              </g>
            ))}

            {/* Serie primaire */}
            {activeTab !== 'secondary' ? (
              <>
                <path d={areaPath(primaryCoords)} fill={`url(#${gradId}-primary)`} />
                <path
                  d={linePath(primaryCoords)}
                  fill="none"
                  stroke={VERT[500]}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : null}

            {/* Serie secondaire */}
            {hasSecondary && activeTab !== 'primary' ? (
              <path
                d={linePath(secondaryCoords)}
                fill="none"
                stroke={SCIENTIFIQUE[500]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Repere de survol style Horizon */}
            {activePoint ? (
              <g>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={padT}
                  y2={padT + plotH}
                  stroke={ENCRE[500]}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={activePoint.y}
                  y2={activePoint.y}
                  stroke={ENCRE[500]}
                  strokeDasharray="2 3"
                  strokeWidth={0.9}
                />
              </g>
            ) : null}

            {/* Points et zones interactives */}
            {primaryCoords.map((coord, idx) => {
              const stepW = plotW / Math.max(1, points.length);
              return (
                <g key={`${coord.p.label}-${idx}`}>
                  {activeTab !== 'secondary' ? (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={hoveredIdx === idx ? 5 : 3.5}
                      fill={hoveredIdx === idx ? VERT[500] : COLORS_PURE_WHITE}
                      stroke={VERT[500]}
                      strokeWidth={2}
                    />
                  ) : null}
                  {hasSecondary && activeTab !== 'primary' ? (
                    <circle
                      cx={secondaryCoords[idx].x}
                      cy={secondaryCoords[idx].y}
                      r={3.2}
                      fill={COLORS_PURE_WHITE}
                      stroke={SCIENTIFIQUE[500]}
                      strokeWidth={1.8}
                    />
                  ) : null}
                  <text
                    x={coord.x}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={hoveredIdx === idx ? '700' : '500'}
                    fill={hoveredIdx === idx ? ENCRE[900] : ENCRE[500]}
                  >
                    {coord.p.label}
                  </text>
                  <rect
                    x={coord.x - stepW / 2}
                    y={padT}
                    width={stepW}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(idx)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Info-bulle flottante style Horizon */}
          {activePoint ? (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-[156px] rounded-xl border border-bordure bg-surface p-3 shadow-md"
              style={{
                left: `${Math.min(72, Math.max(8, (activePoint.x / W) * 100 - 12))}%`,
              }}
            >
              <p className="mb-1.5 text-[11px] font-bold text-texte" style={{ margin: '0 0 6px 0' }}>
                {activePoint.p.label}
              </p>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-texte-doux">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VERT[500] }} />
                  {primaryLabel}
                </span>
                <span className="font-bold tabular-nums text-texte">{activePoint.p.primary}</span>
              </div>
              {hasSecondary && typeof activePoint.p.secondary === 'number' ? (
                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-texte-doux">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SCIENTIFIQUE[500] }} />
                    {secondaryLabel}
                  </span>
                  <span className="font-bold tabular-nums text-texte">{activePoint.p.secondary}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {sourceNote ? (
        <p className="mt-2 text-[11px] text-texte-doux" style={{ margin: '8px 0 0 0' }}>
          {sourceNote}
        </p>
      ) : null}
    </section>
  );
}

const COLORS_PURE_WHITE = 'var(--pure-white)';

/* ───────────────────── 3. CARTE INTERACTIVE ("Map overview") ───────────────────── */

export interface HorizonMapMarker {
  id: string;
  code: string;
  label: string;
  tone: HorizonTone;
  lat?: number | null;
  lng?: number | null;
  countryCode?: string | null;
  href?: string;
  isHub?: boolean;
}

export interface HorizonMapLegendItem {
  label: string;
  tone: HorizonTone;
  count?: number;
}

/** Positions relatives deterministes des pays africains sur le canevas 600x260. */
const COUNTRY_ANCHORS: Record<string, { x: number; y: number }> = {
  CD: { x: 345, y: 162 },
  CG: { x: 312, y: 154 },
  GA: { x: 290, y: 152 },
  CM: { x: 288, y: 128 },
  NG: { x: 262, y: 116 },
  BJ: { x: 242, y: 118 },
  TG: { x: 234, y: 120 },
  GH: { x: 220, y: 122 },
  CI: { x: 198, y: 124 },
  BF: { x: 215, y: 102 },
  ML: { x: 196, y: 88 },
  SN: { x: 154, y: 94 },
  GN: { x: 172, y: 110 },
  MA: { x: 185, y: 44 },
  DZ: { x: 245, y: 48 },
  TN: { x: 282, y: 42 },
  KE: { x: 418, y: 150 },
  RW: { x: 382, y: 162 },
  BI: { x: 382, y: 170 },
  TZ: { x: 408, y: 178 },
};

export function HorizonGeoMapCard({
  title,
  markers,
  legend,
  searchPlaceholder = tr('ui.rechercherSurLaCarte'),
  emptyMessage = tr('ui.aucuneEntiteGeolocaliseeEnregistree'),
}: {
  title: string;
  markers: HorizonMapMarker[];
  legend: HorizonMapLegendItem[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markers.slice(0, 12);
    return markers
      .filter(
        (m) =>
          m.code.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q) ||
          (m.countryCode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [markers, query]);

  const positioned = useMemo(() => {
    const withGps = filtered.filter(
      (m) => typeof m.lat === 'number' && Number.isFinite(m.lat) && typeof m.lng === 'number' && Number.isFinite(m.lng),
    );
    let minLat = -12;
    let maxLat = 16;
    let minLng = -16;
    let maxLng = 32;
    if (withGps.length >= 2) {
      minLat = Math.min(...withGps.map((m) => m.lat!)) - 0.5;
      maxLat = Math.max(...withGps.map((m) => m.lat!)) + 0.5;
      minLng = Math.min(...withGps.map((m) => m.lng!)) - 0.5;
      maxLng = Math.max(...withGps.map((m) => m.lng!)) + 0.5;
    }

    return filtered.map((m, idx) => {
      if (typeof m.lat === 'number' && typeof m.lng === 'number' && Number.isFinite(m.lat) && Number.isFinite(m.lng)) {
        const rx = (m.lng - minLng) / Math.max(0.001, maxLng - minLng);
        const ry = 1 - (m.lat - minLat) / Math.max(0.001, maxLat - minLat);
        return {
          ...m,
          x: 75 + Math.min(0.92, Math.max(0.08, rx)) * 450,
          y: 44 + Math.min(0.86, Math.max(0.12, ry)) * 165,
        };
      }
      const anchor = m.countryCode ? COUNTRY_ANCHORS[m.countryCode.toUpperCase()] : undefined;
      if (anchor) {
        const offsetAngle = (idx * 2.1) % (Math.PI * 2);
        const radius = idx === 0 ? 0 : 18 + (idx % 3) * 12;
        return {
          ...m,
          x: Math.min(535, Math.max(65, anchor.x + Math.cos(offsetAngle) * radius)),
          y: Math.min(208, Math.max(44, anchor.y + Math.sin(offsetAngle) * radius)),
        };
      }
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      return {
        ...m,
        x: 105 + col * 125 + (row % 2) * 24,
        y: 66 + row * 62,
      };
    });
  }, [filtered]);

  const selected = positioned.find((m) => m.id === selectedId) ?? null;

  return (
    <section className="flex flex-col rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>
          {title}
        </h3>
        <div className="flex items-center gap-2 rounded-xl border border-bordure bg-fond px-3 py-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-texte-doux" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20 L16.2 16.2" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-40 border-0 bg-transparent text-xs text-texte outline-none placeholder:text-texte-doux sm:w-48"
          />
        </div>
      </header>

      {/* Canevas cartographique style Horizon */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-bordure bg-fond">
        <svg viewBox="0 0 600 245" className="block h-auto w-full" role="img" aria-label={title}>
          {/* Fond hydrographique et parcellaire stylise */}
          <rect x="0" y="0" width="600" height="245" fill={SCIENTIFIQUE[50]} />
          <path
            d="M 0 25 Q 140 5, 270 32 T 600 18 L 600 245 L 0 245 Z"
            fill={CREME[100]}
          />
          <path
            d="M 45 55 Q 165 38, 255 86 T 485 72 Q 555 95, 580 170 L 420 228 Q 250 210, 95 198 Z"
            fill={VERT[50]}
          />
          <path
            d="M 120 95 Q 210 75, 310 120 T 515 138 L 470 205 Q 315 188, 150 175 Z"
            fill={VERT[100]}
            opacity="0.65"
          />
          {/* Cours d'eau et axes routiers stylises */}
          <path
            d="M 10 155 C 145 125, 240 185, 375 135 C 455 105, 520 140, 595 112"
            fill="none"
            stroke={SCIENTIFIQUE[100]}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 65 20 L 225 118 L 385 108 L 545 195 M 165 230 L 295 114 L 460 35"
            fill="none"
            stroke={CREME[300]}
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />

          {/* Marqueurs reels */}
          {positioned.map((m) => {
            const palette = TONE_PALETTE[m.tone];
            const isSel = selectedId === m.id;
            return (
              <g
                key={m.id}
                transform={`translate(${m.x.toFixed(1)}, ${m.y.toFixed(1)})`}
                className="cursor-pointer"
                onClick={() => setSelectedId((prev) => (prev === m.id ? null : m.id))}
              >
                {m.isHub ? (
                  <g>
                    <rect
                      x="-38"
                      y="-13"
                      width="76"
                      height="24"
                      rx="12"
                      fill={ENCRE[900]}
                    />
                    <text x="0" y="3" textAnchor="middle" fontSize="10" fontWeight="700" fill={COLORS_PURE_WHITE}>
                      {m.code.slice(0, 10)}
                    </text>
                  </g>
                ) : (
                  <g>
                    {/* Etiquette blanche flottante au-dessus du marqueur (style Horizon TRC-042) */}
                    <rect
                      x="-36"
                      y="-36"
                      width="72"
                      height="20"
                      rx="7"
                      fill={COLORS_PURE_WHITE}
                      stroke={isSel ? palette.accent : CREME[300]}
                      strokeWidth={isSel ? 1.6 : 1}
                    />
                    <text x="0" y="-23" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={ENCRE[700]}>
                      {m.code.slice(0, 10)}
                    </text>
                    <circle
                      cx="0"
                      cy="0"
                      r={isSel ? 13 : 11}
                      fill={palette.accent}
                      stroke={COLORS_PURE_WHITE}
                      strokeWidth="2.5"
                    />
                    {/* Fleche directionnelle blanche comme Horizon */}
                    <path d="M -3 3 L 0 -4 L 3 3 L 0 1.4 Z" fill={COLORS_PURE_WHITE} />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {positioned.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/75 px-4 text-center backdrop-blur-[1px]">
            <p className="text-xs font-medium text-texte-doux" style={{ margin: 0 }}>
              {emptyMessage}
            </p>
          </div>
        ) : null}

        {selected ? (
          <div className="absolute left-3 top-3 flex items-center gap-2.5 rounded-xl border border-bordure bg-surface px-3 py-2 text-xs shadow-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: TONE_PALETTE[selected.tone].accent }}
            />
            <div>
              <div className="font-bold text-texte">{selected.label}</div>
              <div className="text-[10.5px] text-texte-doux">
                {selected.code}
                {selected.countryCode ? ` · ${selected.countryCode}` : ''}
              </div>
            </div>
            {selected.href ? (
              <Link
                to={selected.href}
                className="ml-2 rounded-lg bg-marque-clair px-2 py-1 text-[11px] font-semibold text-marque"
                style={{ textDecoration: 'none' }}
              >{t('ui.ouvrir_7fd29')}</Link>
            ) : null}
          </div>
        ) : null}

        {/* Barre de legende 4 colonnes epinglee en bas de la carte (style Horizon) */}
        <div className="grid grid-cols-2 gap-1 border-t border-bordure bg-surface/95 px-3 py-2.5 sm:grid-cols-4">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-texte-doux">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_PALETTE[item.tone].dot }}
              />
              <span className="truncate">{item.label}</span>
              {typeof item.count === 'number' ? (
                <span className="font-bold tabular-nums text-texte">({item.count})</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── 4. LISTE DE SUIVI ("Active fleet") ───────────────────── */

export interface HorizonTrackItem {
  id: string;
  code: string;
  subtitle: string;
  statusLabel: string;
  tone: HorizonTone;
  leftCode: string;
  leftLabel: string;
  rightCode: string;
  rightLabel: string;
  progressPct: number;
  icon?: HorizonIconName;
  href?: string;
}

export function HorizonTrackListCard({
  title,
  items,
  viewAllHref,
  emptyMessage = tr('ui.aucunFluxActifEnCours'),
}: {
  title: string;
  items: HorizonTrackItem[];
  viewAllHref?: string;
  emptyMessage?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>
          {title}
        </h3>
        {viewAllHref ? (
          <Link
            to={viewAllHref}
            className="text-xs font-semibold text-marque hover:underline"
            style={{ textDecoration: 'none' }}
          >{t('ui.toutVoir')}</Link>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-bordure bg-fond/50 px-4 py-10 text-center">
          <p className="text-xs font-medium text-texte-doux" style={{ margin: 0 }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.slice(0, 4).map((item) => {
            const palette = TONE_PALETTE[item.tone];
            const pct = Math.min(100, Math.max(8, Math.round(item.progressPct)));
            const card = (
              <div className="rounded-2xl border border-bordure bg-fond/55 p-3.5 transition-colors hover:bg-fond">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="truncate font-bold text-texte">{item.code}</span>
                    <span className="text-texte-doux">•</span>
                    <span className="truncate text-texte-doux">{item.subtitle}</span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: palette.pillBg, color: palette.pillText }}
                  >
                    {item.statusLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="flex shrink-0 items-center justify-center rounded-xl border border-bordure bg-surface text-marque"
                    style={{ width: 38, height: 38 }}
                  >
                    <HorizonMiniIcon name={item.icon ?? 'truck'} size={18} />
                  </span>

                  <div className="min-w-[54px]">
                    <div className="text-xs font-bold text-texte">{item.leftCode}</div>
                    <div className="truncate text-[10.5px] text-texte-doux">{item.leftLabel}</div>
                  </div>

                  {/* Jauge de progression a curseur circulaire style Horizon */}
                  <div className="relative flex flex-1 items-center">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bordure">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: ENCRE[900] }}
                      />
                    </div>
                    <span
                      className="absolute flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-surface text-surface shadow-xs"
                      style={{
                        left: `${pct}%`,
                        width: 18,
                        height: 18,
                        backgroundColor: ENCRE[900],
                      }}
                    >
                      <svg width="7" height="7" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                        <path d="M3 2 L8 5 L3 8 Z" />
                      </svg>
                    </span>
                  </div>

                  <div className="min-w-[54px] text-right">
                    <div className="text-xs font-bold text-texte">{item.rightCode}</div>
                    <div className="truncate text-[10.5px] text-texte-doux">{item.rightLabel}</div>
                  </div>
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.id} to={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                {card}
              </Link>
            ) : (
              <div key={item.id}>{card}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ───────────────────── 5. GRILLE 2x2 SPARKBARS ("Current loading status") ───────────────────── */

export interface HorizonQuadCell {
  id: string;
  value: string;
  label: string;
  bars?: [number, number, number, number];
  tone?: HorizonTone;
  href?: string;
}

export function HorizonQuadMetricsCard({
  title,
  cells,
}: {
  title: string;
  cells: [HorizonQuadCell, HorizonQuadCell, HorizonQuadCell, HorizonQuadCell];
}) {
  return (
    <section className="flex flex-col rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>
          {title}
        </h3>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-hidden rounded-2xl border border-bordure">
        {cells.map((cell, index) => {
          const palette = TONE_PALETTE[cell.tone ?? 'green'];
          const bars = cell.bars ?? [45, 78, 38, 64];
          const borderClass = cn(
            'flex flex-col justify-between bg-surface p-4 transition-colors hover:bg-fond/50',
            index % 2 === 0 ? 'border-r border-bordure' : '',
            index < 2 ? 'border-b border-bordure' : '',
          );

          const content = (
            <>
              <div>
                <div className="text-2xl font-bold tabular-nums tracking-tight text-texte">
                  {cell.value}
                </div>
                <div className="mt-1 text-[11.5px] text-texte-doux">{cell.label}</div>
              </div>

              {/* 4 mini-colonnes degradees style Horizon */}
              <div className="mt-5 grid grid-cols-4 items-end gap-1.5" style={{ height: 42 }}>
                {bars.map((raw, bIdx) => {
                  const h = Math.min(100, Math.max(16, Math.round(raw)));
                  return (
                    <div
                      key={bIdx}
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        borderTop: `2.5px solid ${palette.accent}`,
                        background: `linear-gradient(180deg, ${palette.pillBg} 0%, transparent 100%)`,
                      }}
                    />
                  );
                })}
              </div>
            </>
          );

          return cell.href ? (
            <Link key={cell.id} to={cell.href} className={borderClass} style={{ textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          ) : (
            <div key={cell.id} className={borderClass}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────── 6. ANNEAU DONUT ("Order status") ───────────────────── */

export interface HorizonDonutSegment {
  label: string;
  value: number;
  tone: HorizonTone;
}

export function HorizonDonutCard({
  title,
  totalValue,
  totalLabel,
  segments,
}: {
  title: string;
  totalValue: string;
  totalLabel: string;
  segments: HorizonDonutSegment[];
}) {
  const sum = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const R = 74;
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
    <section className="flex flex-col justify-between rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>
          {title}
        </h3>
      </header>

      <div className="my-2 flex items-center justify-center">
        <div className="relative flex items-center justify-center" style={{ width: 184, height: 184 }}>
          <svg viewBox="0 0 184 184" className="-rotate-90" width="184" height="184" role="img" aria-label={title}>
            <circle
              cx="92"
              cy="92"
              r={R}
              fill="none"
              stroke={CREME[200]}
              strokeWidth="12"
            />
            {sum > 0
              ? arcs.map((arc) =>
                  arc.length > 0 ? (
                    <circle
                      key={arc.label}
                      cx="92"
                      cy="92"
                      r={R}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth="12"
                      strokeDasharray={`${Math.max(0, arc.length - 2)} ${C}`}
                      strokeDashoffset={arc.offset}
                      strokeLinecap="butt"
                    />
                  ) : null,
                )
              : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-texte">
              {totalValue}
            </span>
            <span className="mt-0.5 text-[11px] text-texte-doux">{totalLabel}</span>
          </div>
        </div>
      </div>

      {/* Legende detaillee style Horizon (point + pourcentage + valeur exacte) */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-bordure pt-3.5">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-texte">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              <span className="truncate">{arc.label}</span>
            </div>
            <span className="pl-3.5 text-[11px] tabular-nums text-texte-doux">
              {arc.pct}% • {arc.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── 7. UTILITAIRES PURS DE TRANSFORMATION DE DONNEES REELLES ───────────────────── */

/** Regroupe des elements reels horodates par mois (YYYY-MM) sans inventer de valeur. */
export function buildMonthlySeries<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  getSecondary?: (item: T) => boolean,
): HorizonSeriesPoint[] {
  const buckets = new Map<string, { primary: number; secondary: number }>();
  for (const item of items) {
    const raw = getDate(item);
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const cur = buckets.get(key) ?? { primary: 0, secondary: 0 };
    cur.primary += 1;
    if (getSecondary && getSecondary(item)) cur.secondary += 1;
    buckets.set(key, cur);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([label, vals]) => ({
      label,
      primary: vals.primary,
      ...(getSecondary ? { secondary: vals.secondary } : {}),
    }));
}

export function formatHorizonTimestamp(iso?: string | null, locale = bcpLocale()): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return tr('ui.misAJour', { d: new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d) });
}
