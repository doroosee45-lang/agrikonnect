import { COLORS } from '@/theme/colors';

export type Locale = 'fr' | 'en';

const BCP: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' };

/** Devise par défaut du réseau (zone UEMOA/CEMAC) ; l'API renvoie la devise du pays. */
export const DEFAULT_CURRENCY = 'XOF';

export function formatNumber(value: number | null | undefined, locale: Locale = 'fr', digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(BCP[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompact(value: number | null | undefined, locale: Locale = 'fr'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(BCP[locale], { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = DEFAULT_CURRENCY,
  locale: Locale = 'fr',
  compact = false,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(BCP[locale], {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(value);
  } catch {
    // Devise inconnue du moteur Intl : on retombe sur un affichage lisible.
    return `${formatNumber(value, locale)} ${currency}`;
  }
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale: Locale = 'fr',
  style: 'short' | 'medium' | 'long' | 'datetime' = 'medium',
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: '2-digit', year: '2-digit' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : style === 'datetime'
          ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(BCP[locale], options).format(date);
}

export function formatRelative(value: string | number | Date | null | undefined, locale: Locale = 'fr'): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const absDays = Math.abs(diffMs) / 86_400_000;
  if (absDays > 60) return formatDate(date, locale);
  try {
    return new Intl.RelativeTimeFormat(BCP[locale], { numeric: 'auto' }).format(
      Math.round(diffMs / 86_400_000),
      'day',
    );
  } catch {
    return formatDate(date, locale);
  }
}

export function formatPercent(value: number | null | undefined, locale: Locale = 'fr', digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${formatNumber(normalized, locale, digits)} %`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function initials(value: string | null | undefined, max = 2): string {
  if (!value) return '··';
  return value
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Provenance : le contrat CDC impose de distinguer une mesure d'une estimation
 * (✔ / ≈) et une donnée déclarée d'une donnée vérifiée. Aucun écran ne peut
 * afficher une valeur sans ce marqueur.
 */
export type ProvenanceKind =
  | 'measured'
  | 'estimated'
  | 'declared'
  | 'verified'
  | 'lab'
  | 'sensor'
  | 'drone'
  | 'satellite'
  | 'camera';

export const PROVENANCE: Record<
  ProvenanceKind,
  { symbol: string; labelKey: string; color: string; reliability?: number }
> = {
  measured: { symbol: '✔', labelKey: 'provenance.measured', color: COLORS.success },
  verified: { symbol: '✔', labelKey: 'provenance.verified', color: COLORS.success },
  lab: { symbol: '✔', labelKey: 'provenance.lab', color: COLORS.success, reliability: 0.95 },
  sensor: { symbol: '✔', labelKey: 'provenance.sensor', color: COLORS.success, reliability: 0.85 },
  drone: { symbol: '✔', labelKey: 'provenance.drone', color: COLORS.info, reliability: 0.8 },
  satellite: { symbol: '≈', labelKey: 'provenance.satellite', color: COLORS.info, reliability: 0.7 },
  camera: { symbol: '≈', labelKey: 'provenance.camera', color: COLORS.warning, reliability: 0.55 },
  estimated: { symbol: '≈', labelKey: 'provenance.estimated', color: COLORS.warning },
  declared: { symbol: '≈', labelKey: 'provenance.declared', color: COLORS.slateGray, reliability: 0.4 },
};

export function provenanceOf(kind: ProvenanceKind | null | undefined) {
  return PROVENANCE[kind ?? 'declared'];
}

/** Poids d'une source dans une fusion : fiabilité × qualité × fraîcheur (demi-vie 365 j). */
export function fusionWeight(
  reliability: number,
  quality: number,
  capturedAt: string | Date | null | undefined,
  now = Date.now(),
): number {
  if (!capturedAt) return 0;
  const captured = capturedAt instanceof Date ? capturedAt.getTime() : new Date(capturedAt).getTime();
  if (Number.isNaN(captured)) return 0;
  const ageDays = Math.max(0, (now - captured) / 86_400_000);
  const freshness = Math.pow(0.5, ageDays / 365);
  return reliability * quality * freshness;
}
