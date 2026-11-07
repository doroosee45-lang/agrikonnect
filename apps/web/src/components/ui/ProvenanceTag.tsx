import type { HTMLAttributes } from 'react';

import { COLORS } from '@/theme';

export interface ProvenanceTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  kind: 'DECLARED' | 'MEASURED' | 'VERIFIED' | 'AI_GENERATED' | 'MODEL' | 'REMOTE_SENSING' | 'GROUND_TRUTH';
  source?: string;
  method?: string;
  measuredAt?: string;
  confidence?: string;
}

const KINDS: Record<ProvenanceTagProps['kind'], { symbol: string; label: string; color: string }> = {
  MEASURED: { symbol: '✔', label: 'mesuré', color: COLORS.success },
  VERIFIED: { symbol: '✔', label: 'vérifié', color: COLORS.success },
  GROUND_TRUTH: { symbol: '✔', label: 'terrain', color: COLORS.success },
  DECLARED: { symbol: '≈', label: 'déclaré', color: COLORS.warning },
  AI_GENERATED: { symbol: '≈', label: 'IA', color: COLORS.info },
  MODEL: { symbol: '≈', label: 'modèle', color: COLORS.info },
  REMOTE_SENSING: { symbol: '≈', label: 'satellite', color: COLORS.info },
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
