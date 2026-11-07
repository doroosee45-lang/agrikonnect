import { motion, type HTMLMotionProps } from 'framer-motion';

import { COLORS, DURATION, EASE, RADIUS } from '@/theme';

export type ChipTone = 'neutral' | 'forest' | 'living' | 'gold' | 'success' | 'warning' | 'error' | 'info';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  label: string;
  tone?: ChipTone;
  size?: ChipSize;
  onPress?: () => void;
}

const TONES: Record<ChipTone, { bg: string; color: string }> = {
  neutral: { bg: COLORS.paleGreen, color: COLORS.textPrimary },
  forest: { bg: COLORS.forestGreen, color: COLORS.pureWhite },
  living: { bg: COLORS.livingGreen, color: COLORS.pureWhite },
  gold: { bg: COLORS.gold, color: COLORS.textPrimary },
  success: { bg: COLORS.success, color: COLORS.pureWhite },
  warning: { bg: COLORS.warning, color: COLORS.pureWhite },
  error: { bg: COLORS.error, color: COLORS.pureWhite },
  info: { bg: COLORS.info, color: COLORS.pureWhite },
};

const SIZES: Record<ChipSize, { height: number; padding: string; fontSize: number }> = {
  sm: { height: 24, padding: '0 10px', fontSize: 12 },
  md: { height: 32, padding: '0 14px', fontSize: 13 },
};

export function Chip({ label, tone = 'neutral', size = 'sm', onPress, disabled, ...props }: ChipProps) {
  const t = TONES[tone];
  const s = SIZES[size];

  return (
    <motion.button
      whileHover={onPress && !disabled ? { scale: 1.05 } : undefined}
      whileTap={onPress && !disabled ? { scale: 0.95 } : undefined}
      transition={{ duration: DURATION.fast / 1000, ease: EASE.out }}
      onClick={onPress}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        borderRadius: RADIUS.pill,
        backgroundColor: t.bg,
        color: t.color,
        border: 'none',
        cursor: onPress && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
      {...props}
    >
      {label}
    </motion.button>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
  ...props
}: { label: string; active: boolean; onPress: () => void } & Omit<ChipProps, 'label' | 'onPress'>) {
  return <Chip label={label} tone={active ? 'forest' : 'neutral'} onPress={onPress} {...props} />;
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>{children}</div>
  );
}
