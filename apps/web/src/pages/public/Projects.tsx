import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import type { Row } from '@/components/pages';
import { useI18n } from '@/i18n';

/** PUBLIC — projets agricoles publiés. */
export default function PublicProjects() {
  const { t } = useI18n();
  return (
    <ResourcePage<Row>
      title={t('ui.projets')}
      subtitle={t('ui.projetsAgricolesPubliesOuvertsAL')}
      icon="📁"
      public
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(project) => String(project.id)}
      rowHref={(project) => `/public/projects/${String(project.id)}`}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (project) => String(project.title ?? '—') },
        { key: 'sector', label: t('ui.secteur'), render: (project) => <Chip label={String(project.sector ?? '—')} tone="neutral" size="sm" /> },
        { key: 'countryCode', label: t('ui.pays'), render: (project) => String(project.countryCode ?? '—') },
        { key: 'status', label: t('ui.statut'), render: (project) => <Chip label={String(project.status ?? '—')} tone="info" size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunProjetPublie')}
      emptyDescription={t('ui.aucunProjetNEstPubliePour')}
      notice={t('ui.aucunRendementNEstGarantiPar')}
    />
  );
}
