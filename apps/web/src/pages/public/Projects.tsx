import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import type { Row } from '@/components/pages';

/** PUBLIC — projets agricoles publiés. */
export default function PublicProjects() {
  return (
    <ResourcePage<Row>
      title="Projets"
      subtitle="Projets agricoles publiés, ouverts à l'investissement."
      icon="📁"
      public
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(project) => String(project.id)}
      rowHref={(project) => `/public/projects/${String(project.id)}`}
      columns={[
        { key: 'title', label: 'Titre', render: (project) => String(project.title ?? '—') },
        { key: 'sector', label: 'Secteur', render: (project) => <Chip label={String(project.sector ?? '—')} tone="neutral" size="sm" /> },
        { key: 'countryCode', label: 'Pays', render: (project) => String(project.countryCode ?? '—') },
        { key: 'status', label: 'Statut', render: (project) => <Chip label={String(project.status ?? '—')} tone="info" size="sm" /> },
      ]}
      emptyTitle="Aucun projet publié"
      emptyDescription="Aucun projet n'est publié pour le moment."
      notice="Aucun rendement n'est garanti par la plateforme : les projections portent leur source et leur méthode."
    />
  );
}
