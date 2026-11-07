import { ResourcePage } from '@/components/pages';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Verification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — mes demandes de vérification. */
export default function AppVerification() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Verification>
      title="Mes vérifications"
      subtitle="Demandes de vérification déposées par votre organisation."
      icon="🛡️"
      queryKey={queryKeys.verifications.mine}
      fetch={() => verificationApi.mine().then((result) => result.data.items)}
      rowKey={(verification) => verification.id}
      action={{ label: 'Nouvelle demande', href: '/organization' }}
      columns={[
        { key: 'subjectType', label: 'Sujet', render: (verification) => `${verification.subjectType} · niveau ${verification.level}` },
        { key: 'status', label: 'Statut', render: (verification) => <StatusChip value={verification.status} /> },
        { key: 'createdAt', label: 'Demandée le', render: (verification) => formatDate(verification.createdAt, locale) },
        { key: 'reviewedAt', label: 'Instruite le', render: (verification) => (verification.reviewedAt ? formatDate(verification.reviewedAt, locale) : '—') },
      ]}
      emptyTitle="Aucune demande"
      emptyDescription="Vous n'avez déposé aucune demande de vérification."
      notice="Chaque décision est tracée avec son auteur, sa date et son motif."
    />
  );
}
