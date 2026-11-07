import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Transporter = Record<string, unknown>;

/** MARKET — transporteurs référencés. */
export default function MarketTransporters() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Transporter>
      title="Transporteurs"
      subtitle="Transporteurs référencés sur la plateforme."
      icon="🚚"
      public
      queryKey={['transport', 'carriers'] as unknown[]}
      fetch={async () => [] as Transporter[]}
      rowKey={(transporter) => String(transporter.id)}
      columns={[
        { key: 'name', label: 'Nom', render: (transporter) => String(transporter.name ?? '—') },
        { key: 'countryCode', label: 'Pays', render: (transporter) => <Chip label={String(transporter.countryCode ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (transporter) => <Chip label={String(transporter.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'registeredAt', label: 'Inscrit le', render: (transporter) => (transporter.createdAt ? formatDate(String(transporter.createdAt), locale) : '—') },
      ]}
      emptyTitle="Aucun transporteur"
      emptyDescription="Aucun transporteur n'est actuellement référencé."
    />
  );
}
