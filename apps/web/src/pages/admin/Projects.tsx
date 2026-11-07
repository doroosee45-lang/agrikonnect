import { ResourcePage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { StatusChip, type Row } from '@/components/pages';

/** ADMIN — projets d'investissement. */
export default function AdminProjects() {
  return (
    <ResourcePage<Row>
      title="Projets"
      subtitle="Projets agricoles publiés sur la plateforme."
      icon="📁"
      queryKey={queryKeys.projects.list({ limit: 100 })}
      fetch={() => projectApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(project) => String(project.id)}
      rowHref={(project) => `/investment/projects/${String(project.id)}`}
      columns={[
        { key: 'title', label: 'Titre', render: (project) => String(project.title ?? '—') },
        { key: 'sector', label: 'Secteur', render: (project) => String(project.sector ?? '—') },
        { key: 'countryCode', label: 'Pays', render: (project) => String(project.countryCode ?? '—') },
        { key: 'status', label: 'Statut', render: (project) => <StatusChip value={project.status} /> },
      ]}
      emptyTitle="Aucun projet"
      emptyDescription="Aucun projet n'a été renvoyé par l'API."
    />
  );
}
