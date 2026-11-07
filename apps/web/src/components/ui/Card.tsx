import { motion, type HTMLMotionProps } from 'framer-motion';
import type { HTMLAttributes, ReactNode } from 'react';

import { COLORS, DURATION, EASE, RADIUS, TINTS } from '@/theme';

export type CardTone = 'paper' | 'white' | 'pale' | 'forest' | 'ink' | 'gold';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  tone?: CardTone;
  children: ReactNode;
  hover?: boolean;
}

const TONES: Record<CardTone, { bg: string; border: string; color: string }> = {
  paper: { bg: COLORS.naturalWhite, border: COLORS.lightBorder, color: COLORS.textPrimary },
  white: { bg: COLORS.pureWhite, border: COLORS.lightBorder, color: COLORS.textPrimary },
  pale: { bg: COLORS.paleGreen, border: COLORS.lightBorder, color: COLORS.textPrimary },
  forest: { bg: COLORS.forestGreen, border: 'transparent', color: COLORS.pureWhite },
  ink: { bg: COLORS.textPrimary, border: 'transparent', color: COLORS.pureWhite },
  gold: { bg: COLORS.gold, border: 'transparent', color: COLORS.textPrimary },
};

export function Card({ tone = 'white', children, hover = false, style, ...props }: CardProps) {
  const t = TONES[tone];

  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.01 } : undefined}
      transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
      style={{
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: RADIUS.lg,
        padding: 20,
        color: t.color,
        boxShadow: hover ? 'var(--shadow-sm)' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ children, style, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      style={{
        fontSize: 18,
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        marginBottom: 8,
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardBody({ children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.slateGray, ...style }} {...props}>
      {children}
    </div>
  );
}
