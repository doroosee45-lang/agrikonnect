import { ResourcePage } from '@/components/pages';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Verification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — file de vérification. */
export default function AdminVerifications() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Verification>
      title="Vérifications"
      subtitle="Demandes de vérification, tous statuts."
      icon="🛡️"
      queryKey={queryKeys.verifications.queue({ limit: 100 })}
      fetch={() => verificationApi.adminQueue({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(verification) => verification.id}
      columns={[
        { key: 'subjectType', label: 'Sujet', render: (verification) => `${verification.subjectType} · niveau ${verification.level}` },
        { key: 'organizationId', label: 'Organisation', render: (verification) => verification.organizationId },
        { key: 'status', label: 'Statut', render: (verification) => <StatusChip value={verification.status} /> },
        { key: 'createdAt', label: 'Demandée le', render: (verification) => formatDate(verification.createdAt, locale) },
      ]}
      emptyTitle="File vide"
      emptyDescription="Aucune demande de vérification."
      notice="Chaque décision est tracée avec son auteur et son motif. Aucune validation automatique."
    />
  );
}
