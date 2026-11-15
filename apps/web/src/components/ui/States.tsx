import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { COLORS, RADIUS } from '@/theme';
import { useI18n, type TranslationKey } from '@/i18n';
import { ERROR_KIND_I18N, RequestError } from '@/services/types';

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
  const { t } = useI18n();
  /*
   * I18N-06 — message affiché :
   * - erreur réseau (statut 0) : libellé traduit, jamais « Network Error » brut ;
   * - erreur HTTP : message du serveur, déjà rendu dans la langue demandée
   *   (`Accept-Language`), sinon le libellé traduit de sa famille ;
   * - toute autre erreur : libellé générique traduit.
   */
  const requestError = error instanceof RequestError ? error : null;
  const message = requestError
    ? requestError.status !== 0 && requestError.message
      ? requestError.message
      : t(ERROR_KIND_I18N[requestError.kind] as TranslationKey)
    : t('ui.uneErreurEstSurvenue');
  const requestId = requestError?.requestId ?? null;

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
        <p style={{ fontSize: 12, color: COLORS.slateGray, fontFamily: 'monospace' }}>{t('ui.id', { requestId })}</p>
      ) : null}
      {onRetry ? <Button label={t('common.retry')} onClick={onRetry} variant="outline" size="sm" /> : null}
    </div>
  );
}
