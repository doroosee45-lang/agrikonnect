import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

import { COLORS, DURATION, EASE } from '@/theme';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, { bg: string; color: string; border: string; hover: string }> = {
  primary: { bg: COLORS.forestGreen, color: COLORS.pureWhite, border: 'transparent', hover: COLORS.livingGreen },
  outline: { bg: 'transparent', color: COLORS.forestGreen, border: COLORS.forestGreen, hover: COLORS.paleGreen },
  ghost: { bg: 'transparent', color: COLORS.forestGreen, border: 'transparent', hover: COLORS.paleGreen },
  danger: { bg: COLORS.error, color: COLORS.pureWhite, border: 'transparent', hover: '#9a3a26' },
};

const SIZES: Record<ButtonSize, { height: number; padding: string; fontSize: number }> = {
  /*
   * 44 px minimum, y compris pour la petite taille (A10, §7.2). L'ancienne
   * valeur était 36 px : en dessous du seuil, les appuis à côté du bouton sont
   * fréquents, surtout au doigt. On réduit le padding et la police, pas la zone.
   */
  sm: { height: 44, padding: '0 14px', fontSize: 13 },
  md: { height: 44, padding: '0 20px', fontSize: 14 },
  lg: { height: 52, padding: '0 28px', fontSize: 16 },
};

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: DURATION.fast / 1000, ease: EASE.out }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: v.bg,
        color: v.color,
        border: `1.5px solid ${v.border}`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        width: fullWidth ? '100%' : 'auto',
        transition: `background-color ${DURATION.fast}ms`,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) e.currentTarget.style.backgroundColor = v.hover;
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) e.currentTarget.style.backgroundColor = v.bg;
      }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : null}
      {label}
    </motion.button>
  );
}
