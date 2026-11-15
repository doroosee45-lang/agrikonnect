import { ResourcePage } from '@/components/pages';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Verification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — mes demandes de vérification. */
export default function AppVerification() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Verification>
      title={t('ui.mesVerifications')}
      subtitle={t('ui.demandesDeVerificationDeposeesParVotre')}
      icon="🛡️"
      queryKey={queryKeys.verifications.mine}
      fetch={() => verificationApi.mine().then((result) => result.data.items)}
      rowKey={(verification) => verification.id}
      action={{ label: t('ui.nouvelleDemande'), href: '/organization' }}
      columns={[
        { key: 'subjectType', label: t('ui.sujet'), render: (verification) => t('ui.niveau', { subjectType: verification.subjectType, level: verification.level }) },
        { key: 'status', label: t('ui.statut'), render: (verification) => <StatusChip value={verification.status} /> },
        { key: 'createdAt', label: t('ui.demandeeLe'), render: (verification) => formatDate(verification.createdAt, locale) },
        { key: 'reviewedAt', label: t('ui.instruiteLe'), render: (verification) => (verification.reviewedAt ? formatDate(verification.reviewedAt, locale) : '—') },
      ]}
      emptyTitle={t('ui.aucuneDemande')}
      emptyDescription={t('ui.vousNAvezDeposeAucuneDemande')}
      notice={t('ui.chaqueDecisionEstTraceeAvecSon_f0d7a')}
    />
  );
}
