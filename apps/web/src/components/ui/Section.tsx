import type { HTMLAttributes, ReactNode } from 'react';

import { LAYOUT } from '@/theme';
import { useReveal } from '@/hooks/useReveal';

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode;
  bare?: boolean;
  contentStyle?: React.CSSProperties;
  reveal?: boolean;
}

export function Section({ children, bare = false, contentStyle, reveal = true, style, className = '', ...props }: SectionProps) {
  const [revealRef, visible] = useReveal<HTMLElement>();

  return (
    <section
      ref={reveal ? revealRef : undefined}
      className={`${reveal ? `reveal ${visible ? 'is-visible' : ''}` : ''} ${className}`.trim() || undefined}
      style={{
        padding: bare ? 0 : '64px 24px',
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          maxWidth: LAYOUT.maxContentWidth,
          margin: '0 auto',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </section>
  );
}
