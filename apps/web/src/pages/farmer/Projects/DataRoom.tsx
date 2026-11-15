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
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<Document>
      title={t('ui.salleDeDonnees')}
      subtitle={t('ui.documentsPartagesAvecLesInvestisseursChaque')}
      icon="🗄️"
      queryKey={[...queryKeys.projects.one(id ?? ''), 'documents'] as unknown[]}
      fetch={() => projectDataApi.documents(id ?? '').then((result) => result.data as unknown as Document[])}
      rowKey={(document) => String(document.id)}
      notice={t('ui.lesAccesSontTracesChaqueConsultation')}
      columns={[
        { key: 'name', label: t('ui.fichier'), render: (document) => String(document.name ?? '—') },
        { key: 'kind', label: t('ui.type'), render: (document) => <Chip label={String(document.kind ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (document) => <Chip label={String(document.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: t('ui.ajouteLe'), render: (document) => (document.createdAt ? formatDate(String(document.createdAt), locale) : '—') },
        {
          key: 'access',
          label: t('ui.acces'),
          render: (document) => (
            <Link to={`/farmer/projects/${id}/dataroom/${String(document.id)}`} style={{ color: VERT[800], fontSize: 13 }}>
              consulter
            </Link>
          ),
        },
      ]}
      emptyTitle={t('ui.salleVide')}
      emptyDescription={t('ui.aucunDocumentNAEncoreEte')}
    />
  );
}
