import { ResourcePage } from '@/components/pages';
import { certificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Certification } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — conformité : certifications déclarées et vérifiées. */
export default function AdminCompliance() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Certification>
      title="Conformité"
      subtitle="Certifications déclarées par les organisations."
      icon="✅"
      queryKey={queryKeys.certifications.all}
      fetch={() => certificationApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(certification) => certification.id}
      columns={[
        { key: 'type', label: 'Type', render: (certification) => `${certification.type} · ${certification.issuer}` },
        { key: 'reference', label: 'Référence', render: (certification) => certification.reference ?? '—' },
        { key: 'status', label: 'Statut', render: (certification) => <StatusChip value={certification.status} /> },
        { key: 'expiresAt', label: 'Expire le', render: (certification) => (certification.expiresAt ? formatDate(certification.expiresAt, locale) : 'sans échéance') },
      ]}
      emptyTitle="Aucune certification"
      emptyDescription="Aucune certification n'a été déclarée."
      notice="Une certification déclarée n'est jamais présentée comme vérifiée tant qu'aucun contrôle n'a eu lieu."
    />
  );
}
