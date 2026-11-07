import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { projectDataApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

type ReportEntry = Record<string, unknown>;
interface Reports {
  progress: ReportEntry[];
  impact: ReportEntry[];
}

/** FARMER — rapports d'avancement et d'impact du projet. */
export default function FarmerProjectReports() {
  const { id } = useParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: [...queryKeys.projects.one(id ?? ''), 'reports'] as unknown[],
    queryFn: () => projectDataApi.reports(id ?? '').then((result) => result.data as unknown as Reports),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const renderList = (entries: ReportEntry[], kind: string) =>
    entries.length === 0 ? (
      <Text preset="caption" color={COLORS.slateGray}>
        Aucun rapport {kind}.
      </Text>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map((entry, index) => (
          <motion.div
            key={String(entry.id ?? index)}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.04, ease: EASE.out }}
          >
            <Card tone="white">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
                <Text preset="h4">{String(entry.title ?? `Rapport ${index + 1}`)}</Text>
                {entry.createdAt ? <Text preset="caption">{formatDate(String(entry.createdAt), locale)}</Text> : null}
              </div>
              {entry.summary ? <Text preset="bodySm" style={{ lineHeight: 1.7 }}>{String(entry.summary)}</Text> : null}
              {entry.period ? (
                <div style={{ marginTop: 8 }}>
                  <Chip label={`Période ${String(entry.period)}`} tone="neutral" size="sm" />
                </div>
              ) : null}
            </Card>
          </motion.div>
        ))}
      </div>
    );

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Rapports" description="Rapports d'avancement et d'impact du projet." icon="📊">
        <div style={{ marginBottom: 24 }}>
          <a href={`/farmer/projects/${id}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour au projet
          </a>
        </div>

        <Text preset="h1" style={{ marginBottom: 32 }}>
          Rapports
        </Text>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !query.data || (query.data.progress.length === 0 && query.data.impact.length === 0) ? (
          <EmptyState title="Aucun rapport" description="Les rapports d'avancement et d'impact apparaîtront ici." icon="📊" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Avancement
              </Text>
              {renderList(query.data.progress, "d'avancement")}
            </div>
            <div>
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Impact
              </Text>
              {renderList(query.data.impact, "d'impact")}
            </div>
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
