import { ResourcePage } from '@/components/pages';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Verification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — file de vérification. */
export default function AdminVerifications() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Verification>
      title={t('ui.verifications')}
      subtitle={t('ui.demandesDeVerificationTousStatuts')}
      icon="🛡️"
      queryKey={queryKeys.verifications.queue({ limit: 100 })}
      fetch={() => verificationApi.adminQueue({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(verification) => verification.id}
      columns={[
        { key: 'subjectType', label: t('ui.sujet'), render: (verification) => t('ui.niveau', { subjectType: verification.subjectType, level: verification.level }) },
        { key: 'organizationId', label: t('ui.organisation_6e99c'), render: (verification) => verification.organizationId },
        { key: 'status', label: t('ui.statut'), render: (verification) => <StatusChip value={verification.status} /> },
        { key: 'createdAt', label: t('ui.demandeeLe'), render: (verification) => formatDate(verification.createdAt, locale) },
      ]}
      emptyTitle={t('ui.fileVide')}
      emptyDescription={t('ui.aucuneDemandeDeVerification')}
      notice={t('ui.chaqueDecisionEstTraceeAvecSon')}
    />
  );
}
