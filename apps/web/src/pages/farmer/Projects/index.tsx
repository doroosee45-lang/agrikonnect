import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Project } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — mes projets de financement agricole. */
export default function FarmerProjects() {
  const { t } = useI18n();
  return (
    <ResourcePage<Project>
      title={t('ui.mesProjets')}
      subtitle={t('ui.projetsOuvertsAuFinancementAvecLeur')}
      icon="💼"
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data as unknown as Project[])}
      rowKey={(project) => project.id}
      rowHref={(project) => `/farmer/projects/${project.id}`}
      action={{ label: t('ui.nouveauProjet'), href: '/farmer/projects/create' }}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (project) => project.title },
        { key: 'status', label: t('ui.statut'), render: (project) => <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'fundingNeed', label: t('ui.besoin'), render: (project) => (project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—') },
        { key: 'ownContribution', label: t('ui.apport'), render: (project) => (project.ownContribution !== null ? formatCurrency(project.ownContribution, 'USD') : '—') },
      ]}
      emptyTitle={t('ui.aucunProjet')}
      emptyDescription={t('ui.creezUnProjetPourOuvrirUne')}
    />
  );
}
