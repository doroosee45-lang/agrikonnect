import { ResourcePage } from '@/components/pages';
import { certificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Certification } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — certifications (CERT-01 → CERT-05) : validées, expirées ou en attente. */
export default function FarmerCertifications() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Certification>
      title={t('ui.mesCertifications')}
      subtitle={t('ui.certificationsRattacheesAVosExploitationsOu')}
      icon="📜"
      queryKey={queryKeys.certifications.all}
      fetch={() => certificationApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(certification) => certification.id}
      columns={[
        { key: 'type', label: t('ui.referentiel'), render: (certification) => certification.type },
        { key: 'reference', label: t('ui.numero'), render: (certification) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{certification.reference ?? '—'}</span> },
        { key: 'status', label: t('ui.statut'), render: (certification) => <Chip label={certification.status} tone={certification.status === 'VALIDATED' ? 'success' : certification.status === 'EXPIRED' ? 'error' : 'warning'} size="sm" /> },
        { key: 'expiresAt', label: t('ui.valideJusquAu'), render: (certification) => (certification.expiresAt ? formatDate(certification.expiresAt, locale) : '—') },
        { key: 'issuer', label: t('ui.organisme'), render: (certification) => certification.issuer },
      ]}
      emptyTitle={t('ui.aucuneCertification')}
      emptyDescription={t('ui.aucuneCertificationNEstEnregistreeLa')}
    />
  );
}
