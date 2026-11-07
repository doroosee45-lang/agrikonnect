import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Project } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

/** FARMER — mes projets de financement agricole. */
export default function FarmerProjects() {
  return (
    <ResourcePage<Project>
      title="Mes projets"
      subtitle="Projets ouverts au financement, avec leur salle de données."
      icon="💼"
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data as unknown as Project[])}
      rowKey={(project) => project.id}
      rowHref={(project) => `/farmer/projects/${project.id}`}
      action={{ label: 'Nouveau projet', href: '/farmer/projects/create' }}
      columns={[
        { key: 'title', label: 'Titre', render: (project) => project.title },
        { key: 'status', label: 'Statut', render: (project) => <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'fundingNeed', label: 'Besoin', render: (project) => (project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—') },
        { key: 'ownContribution', label: 'Apport', render: (project) => (project.ownContribution !== null ? formatCurrency(project.ownContribution, 'USD') : '—') },
      ]}
      emptyTitle="Aucun projet"
      emptyDescription="Créez un projet pour ouvrir une salle de données aux investisseurs."
    />
  );
}
