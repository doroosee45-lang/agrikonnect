import { ResourcePage } from '@/components/pages';
import { investApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Project } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

/** INVESTMENT — projets suivis par l'investisseur. */
export default function InvestmentFollowedProjects() {
  return (
    <ResourcePage<Project>
      title="Projets suivis"
      subtitle="Projets que vous suivez ou dans lesquels vous avez investi."
      icon="👁️"
      queryKey={queryKeys.invest.followed}
      fetch={() => investApi.followed().then((result) => result.data as unknown as Project[])}
      rowKey={(project) => project.id}
      rowHref={(project) => `/investment/projects/${project.id}`}
      columns={[
        { key: 'title', label: 'Titre', render: (project) => project.title },
        { key: 'status', label: 'Statut', render: (project) => <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'fundingNeed', label: 'Besoin', render: (project) => (project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—') },
      ]}
      emptyTitle="Aucun projet suivi"
      emptyDescription="Les projets que vous suivez apparaîtront ici."
    />
  );
}
