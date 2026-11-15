import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { StatusChip, type Row } from '@/components/pages';
import { useI18n } from '@/i18n';

/** ADMIN — projets d'investissement. */
export default function AdminProjects() {
  const { t } = useI18n();
  return (
    <ResourcePage<Row>
      title={t('ui.projets')}
      subtitle={t('ui.projetsAgricolesPubliesSurLaPlateforme')}
      icon="📁"
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(project) => String(project.id)}
      rowHref={(project) => `/investment/projects/${String(project.id)}`}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (project) => String(project.title ?? '—') },
        { key: 'sector', label: t('ui.secteur'), render: (project) => String(project.sector ?? '—') },
        { key: 'countryCode', label: t('ui.pays'), render: (project) => String(project.countryCode ?? '—') },
        { key: 'status', label: t('ui.statut'), render: (project) => <StatusChip value={project.status} /> },
      ]}
      emptyTitle={t('ui.aucunProjet')}
      emptyDescription={t('ui.aucunProjetNAEteRenvoye')}
    />
  );
}
