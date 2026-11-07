import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { COLORS, RADIUS } from '@/theme';

export function LoadingState({ count = 3, height = 100 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            height,
            backgroundColor: COLORS.paleGreen,
            borderRadius: RADIUS.md,
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {icon ? <div style={{ fontSize: 48, opacity: 0.3 }}>{icon}</div> : null}
      <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)', color: COLORS.textPrimary }}>
        {title}
      </h3>
      {description ? (
        <p style={{ fontSize: 14, color: COLORS.slateGray, maxWidth: 400 }}>{description}</p>
      ) : null}
      {action ? <Button label={action.label} onClick={action.onPress} variant="outline" size="sm" /> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  showRequestId = false,
}: {
  error: unknown;
  onRetry?: () => void;
  showRequestId?: boolean;
}) {
  const message = error instanceof Error ? error.message : 'Une erreur est survenue';
  const requestId = error && typeof error === 'object' && 'requestId' in error ? String((error as any).requestId) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '32px 24px',
        textAlign: 'center',
        backgroundColor: 'rgba(180, 68, 47, 0.05)',
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.error}`,
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.5 }}>⚠</div>
      <p style={{ fontSize: 14, color: COLORS.error, maxWidth: 400 }}>{message}</p>
      {showRequestId && requestId ? (
        <p style={{ fontSize: 12, color: COLORS.slateGray, fontFamily: 'monospace' }}>ID : {requestId}</p>
      ) : null}
      {onRetry ? <Button label="Réessayer" onClick={onRetry} variant="outline" size="sm" /> : null}
    </div>
  );
}
