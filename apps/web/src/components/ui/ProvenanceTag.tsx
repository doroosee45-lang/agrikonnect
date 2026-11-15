import type { HTMLAttributes } from 'react';

import { COLORS } from '@/theme';
import { tr } from '@/i18n';

export interface ProvenanceTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  kind: 'DECLARED' | 'MEASURED' | 'VERIFIED' | 'AI_GENERATED' | 'MODEL' | 'REMOTE_SENSING' | 'GROUND_TRUTH';
  source?: string;
  method?: string;
  measuredAt?: string;
  confidence?: string;
}

const KINDS: Record<ProvenanceTagProps['kind'], { symbol: string; label: string; color: string }> = {
  MEASURED: { symbol: '✔', get label() { return tr('ui.mesure'); }, color: COLORS.success },
  VERIFIED: { symbol: '✔', get label() { return tr('ui.verifie'); }, color: COLORS.success },
  GROUND_TRUTH: { symbol: '✔', get label() { return tr('ui.terrain'); }, color: COLORS.success },
  DECLARED: { symbol: '≈', get label() { return tr('ui.declare'); }, color: COLORS.warning },
  AI_GENERATED: { symbol: '≈', label: 'IA', color: COLORS.info },
  MODEL: { symbol: '≈', get label() { return tr('ui.modele'); }, color: COLORS.info },
  REMOTE_SENSING: { symbol: '≈', get label() { return tr('ui.satellite'); }, color: COLORS.info },
};

export function ProvenanceTag({ kind, source, method, measuredAt, confidence, style, ...props }: ProvenanceTagProps) {
  const k = KINDS[kind];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: k.color,
        fontFamily: 'var(--font-body)',
        ...style,
      }}
      title={[source, method, measuredAt, confidence].filter(Boolean).join(' · ') || undefined}
      {...props}
    >
      <span>{k.symbol}</span>
      <span>{k.label}</span>
      {source ? <span style={{ color: COLORS.slateGray, fontWeight: 400 }}>{source}</span> : null}
    </span>
  );
}
