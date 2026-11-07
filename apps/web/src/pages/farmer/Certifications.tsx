import { ResourcePage } from '@/components/pages';
import { certificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Certification } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — certifications (CERT-01 → CERT-05) : validées, expirées ou en attente. */
export default function FarmerCertifications() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Certification>
      title="Mes certifications"
      subtitle="Certifications rattachées à vos exploitations ou parcelles."
      icon="📜"
      queryKey={queryKeys.certifications.all}
      fetch={() => certificationApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(certification) => certification.id}
      columns={[
        { key: 'type', label: 'Référentiel', render: (certification) => certification.type },
        { key: 'reference', label: 'Numéro', render: (certification) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{certification.reference ?? '—'}</span> },
        { key: 'status', label: 'Statut', render: (certification) => <Chip label={certification.status} tone={certification.status === 'VALIDATED' ? 'success' : certification.status === 'EXPIRED' ? 'error' : 'warning'} size="sm" /> },
        { key: 'expiresAt', label: 'Valide jusqu\'au', render: (certification) => (certification.expiresAt ? formatDate(certification.expiresAt, locale) : '—') },
        { key: 'issuer', label: 'Organisme', render: (certification) => certification.issuer },
      ]}
      emptyTitle="Aucune certification"
      emptyDescription="Aucune certification n'est enregistrée. La mention « certifié » reste désactivée tant qu'aucun certificat validé n'est joint."
    />
  );
}
