import { Link, useParams } from 'react-router-dom';

import { ResourcePage } from '@/components/pages';
import { projectDataApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { VERT } from '../../../theme/agrikonnect';

type Document = Record<string, unknown>;

/** FARMER — salle de données du projet : documents, accès tracé. */
export default function FarmerProjectDataRoom() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<Document>
      title="Salle de données"
      subtitle="Documents partagés avec les investisseurs. Chaque consultation est journalisée."
      icon="🗄️"
      queryKey={[...queryKeys.projects.one(id ?? ''), 'documents'] as unknown[]}
      fetch={() => projectDataApi.documents(id ?? '').then((result) => result.data as unknown as Document[])}
      rowKey={(document) => String(document.id)}
      notice="Les accès sont tracés : chaque consultation d'un document est enregistrée avec sa date et son auteur."
      columns={[
        { key: 'name', label: 'Fichier', render: (document) => String(document.name ?? '—') },
        { key: 'kind', label: 'Type', render: (document) => <Chip label={String(document.kind ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (document) => <Chip label={String(document.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: 'Ajouté le', render: (document) => (document.createdAt ? formatDate(String(document.createdAt), locale) : '—') },
        {
          key: 'access',
          label: 'Accès',
          render: (document) => (
            <Link to={`/farmer/projects/${id}/dataroom/${String(document.id)}`} style={{ color: VERT[800], fontSize: 13 }}>
              consulter
            </Link>
          ),
        },
      ]}
      emptyTitle="Salle vide"
      emptyDescription="Aucun document n'a encore été partagé avec les investisseurs."
    />
  );
}
