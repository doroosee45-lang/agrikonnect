import { ResourcePage } from '@/components/pages';
import { certificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Certification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — conformité : certifications déclarées et vérifiées. */
export default function AdminCompliance() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Certification>
      title={t('ui.conformite')}
      subtitle={t('ui.certificationsDeclareesParLesOrganisations')}
      icon="✅"
      queryKey={queryKeys.certifications.all}
      fetch={() => certificationApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(certification) => certification.id}
      columns={[
        { key: 'type', label: t('ui.type'), render: (certification) => `${certification.type} · ${certification.issuer}` },
        { key: 'reference', label: t('ui.reference'), render: (certification) => certification.reference ?? '—' },
        { key: 'status', label: t('ui.statut'), render: (certification) => <StatusChip value={certification.status} /> },
        { key: 'expiresAt', label: t('ui.expireLe'), render: (certification) => (certification.expiresAt ? formatDate(certification.expiresAt, locale) : t('ui.sansEcheance')) },
      ]}
      emptyTitle={t('ui.aucuneCertification')}
      emptyDescription={t('ui.aucuneCertificationNAEteDeclaree')}
      notice={t('ui.uneCertificationDeclareeNEstJamais')}
    />
  );
}
