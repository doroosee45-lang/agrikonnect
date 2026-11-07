import type { HTMLAttributes, ReactNode } from 'react';

import { useReveal } from '@/hooks/useReveal';

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay?: number;
}

export function Reveal({ children, delay = 0, className = '', style, ...props }: RevealProps) {
  const [ref, visible] = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
