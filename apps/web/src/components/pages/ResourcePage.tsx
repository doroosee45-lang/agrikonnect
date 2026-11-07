import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * Écran liste générique.
 *
 * Il n'affiche que ce que l'endpoint renvoie : aucun jeu de données n'est
 * simulé. Si l'API renvoie une liste vide, l'écran affiche l'état vide réel.
 */
export interface ResourceColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface ResourcePageProps<T> {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Clé TanStack Query — stable et spécifique à l'écran. */
  queryKey: readonly unknown[];
  /** Appel réel à l'API. Doit résoudre la liste affichée. */
  fetch: () => Promise<T[]>;
  columns: Array<ResourceColumn<T>>;
  rowKey: (row: T) => string;
  /** Lien de détail par ligne. */
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Avertissement produit affiché sous le titre (provenance, k-anonymat…). */
  notice?: string;
  /** Action primaire dans l'en-tête. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** L'écran reste accessible anonymement (pages publiques). */
  public?: boolean;
  toolbar?: ReactNode;
}

export function ResourcePage<T>({
  title,
  subtitle,
  icon,
  queryKey,
  fetch,
  columns,
  rowKey,
  rowHref,
  emptyTitle = 'Aucune donnée',
  emptyDescription = "L'API n'a renvoyé aucun enregistrement pour cet écran.",
  notice,
  action,
  public: isPublic = false,
  toolbar,
}: ResourcePageProps<T>) {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: queryKey as unknown[],
    queryFn: fetch,
    enabled: isPublic || isAuthenticated,
  });

 const rows = Array.isArray(query.data) ? query.data : [];

  const body = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              {subtitle}
            </Text>
          ) : null}
        </div>
        {action ? (
          action.href ? (
            <Link to={action.href}>
              <Button label={action.label} size="sm" />
            </Link>
          ) : (
            <Button label={action.label} onClick={action.onClick} size="sm" />
          )
        ) : null}
      </div>

      {notice ? (
        <Card tone="pale" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            {notice}
          </Text>
        </Card>
      ) : null}

      {toolbar ? <div style={{ marginBottom: 24 }}>{toolbar}</div> : null}

      {query.isLoading ? (
        <LoadingState count={3} height={88} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} icon={icon} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row, index) => (
            <motion.div
              key={rowKey(row)}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.03, ease: EASE.out }}
            >
              <Card tone="white" hover style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {columns.map((column, columnIndex) => (
                    <div key={column.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Text
                        preset={columnIndex === 0 ? 'bodyMd' : 'caption'}
                        color={columnIndex === 0 ? COLORS.textPrimary : COLORS.slateGray}
                        style={columnIndex === 0 ? { fontWeight: 600 } : undefined}
                      >
                        {columnIndex === 0 ? null : `${column.label} : `}
                        {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                      </Text>
                    </div>
                  ))}
                </div>
                {rowHref ? (
                  <Link to={rowHref(row)}>
                    <Button label="Ouvrir" variant="outline" size="sm" />
                  </Link>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 24 }}>
        {query.isSuccess ? `${rows.length} enregistrement(s) renvoyé(s) par l'API · ${formatDate(new Date().toISOString(), locale)}` : ''}
      </Text>
    </>
  );

  return (
    <Section>
      {isPublic ? (
        body
      ) : (
        <AuthGate isAuthenticated={isAuthenticated} title={title} description={subtitle} icon={icon}>
          {body}
        </AuthGate>
      )}
    </Section>
  );
}

export { Chip };
