import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { COLORS } from '@/theme';

export type TextPreset = 'h1' | 'h2' | 'h3' | 'h4' | 'bodyLg' | 'bodyMd' | 'bodySm' | 'caption' | 'overline' | 'numeric';

export interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  preset?: TextPreset;
  color?: string;
  children: ReactNode;
}

const PRESETS: Record<TextPreset, CSSProperties> = {
  h1: { fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.1, letterSpacing: '-0.02em' },
  h2: { fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.2, letterSpacing: '-0.01em' },
  h3: { fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.3 },
  h4: { fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.4 },
  bodyLg: { fontSize: 18, fontWeight: 400, lineHeight: 1.6 },
  bodyMd: { fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
  bodySm: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: 13, fontWeight: 400, lineHeight: 1.5, color: COLORS.slateGray },
  overline: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' },
  numeric: { fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
};

export function Text({ preset = 'bodyMd', color, children, style, ...props }: TextProps) {
  const presetStyle = PRESETS[preset];
  const Tag = preset.startsWith('h') ? (preset as 'h1' | 'h2' | 'h3' | 'h4') : 'p';

  return (
    <Tag
      style={{
        ...presetStyle,
        color: color ?? (preset === 'caption' ? COLORS.slateGray : COLORS.textPrimary),
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
