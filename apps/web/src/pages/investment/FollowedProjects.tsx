import { ResourcePage } from '@/components/pages';
import { investApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Project } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { useI18n } from '@/i18n';

/** INVESTMENT — projets suivis par l'investisseur. */
export default function InvestmentFollowedProjects() {
  const { t } = useI18n();
  return (
    <ResourcePage<Project>
      title={t('ui.projetsSuivis')}
      subtitle={t('ui.projetsQueVousSuivezOuDans')}
      icon="👁️"
      queryKey={queryKeys.invest.followed}
      fetch={() => investApi.followed().then((result) => result.data as unknown as Project[])}
      rowKey={(project) => project.id}
      rowHref={(project) => `/investment/projects/${project.id}`}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (project) => project.title },
        { key: 'status', label: t('ui.statut'), render: (project) => <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'fundingNeed', label: t('ui.besoin'), render: (project) => (project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—') },
      ]}
      emptyTitle={t('ui.aucunProjetSuivi')}
      emptyDescription={t('ui.lesProjetsQueVousSuivezApparaitront')}
    />
  );
}
