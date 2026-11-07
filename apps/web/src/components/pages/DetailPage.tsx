import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AuthGate, Button, Card, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * Écran de détail générique : un objet, ses champs, ses sections.
 *
 * La 404 réelle de l'API est affichée telle quelle — l'écran ne reconstruit
 * jamais un objet absent.
 */
export interface DetailField {
  label: string;
  value: ReactNode;
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
  notice?: string;
}

export interface DetailPageProps<T> {
  title: (data: T) => string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  queryKey: readonly unknown[];
  fetch: () => Promise<T>;
  /** Renvoie `null` quand l'objet n'existe pas (404 réelle). */
  sections: (data: T) => DetailSection[];
  actions?: (data: T) => ReactNode;
  public?: boolean;
  notFoundTitle?: string;
  notFoundDescription?: string;
}

export function DetailPage<T>({
  title,
  subtitle,
  backHref,
  backLabel,
  queryKey,
  fetch,
  sections,
  actions,
  public: isPublic = false,
  notFoundTitle = 'Introuvable',
  notFoundDescription = "L'API a renvoyé une 404 : cet enregistrement n'existe pas ou n'est pas accessible.",
}: DetailPageProps<T>) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: queryKey as unknown[],
    queryFn: fetch,
    enabled: isPublic || isAuthenticated,
    retry: false,
  });

  const data = query.data ?? null;

  const body = (
    <>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => (backHref.startsWith('http') ? navigate(backHref) : navigate(backHref))}
          style={{ fontSize: 13, color: COLORS.slateGray, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← {backLabel}
        </button>
      </div>

      {query.isLoading ? (
        <LoadingState count={2} height={140} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
      ) : !data ? (
        <EmptyState title={notFoundTitle} description={notFoundDescription} icon="🔍" />
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <Text preset="h1" style={{ marginBottom: 8 }}>
                {title(data)}
              </Text>
              {subtitle ? (
                <Text preset="bodyMd" color={COLORS.slateGray}>
                  {subtitle}
                </Text>
              ) : null}
            </div>
            {actions ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions(data)}</div> : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sections(data).map((section) => (
              <Card key={section.title} tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>
                  {section.title}
                </Text>
                {section.notice ? (
                  <Text preset="caption" color={COLORS.warning} style={{ marginBottom: 16, lineHeight: 1.7 }}>
                    {section.notice}
                  </Text>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {section.fields.map((field) => (
                    <div key={field.label}>
                      <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                        {field.label}
                      </Text>
                      <Text preset="bodyMd" color={COLORS.textPrimary}>
                        {field.value ?? '—'}
                      </Text>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </>
  );

  return (
    <Section>
      {isPublic ? (
        body
      ) : (
        <AuthGate isAuthenticated={isAuthenticated} title={subtitle ?? 'Accès requis'} icon="🔒">
          {body}
        </AuthGate>
      )}
    </Section>
  );
}
