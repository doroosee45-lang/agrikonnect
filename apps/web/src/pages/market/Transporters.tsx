import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Transporter = Record<string, unknown>;

/** MARKET — transporteurs référencés. */
export default function MarketTransporters() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Transporter>
      title={t('ui.transporteurs')}
      subtitle={t('ui.transporteursReferencesSurLaPlateforme')}
      icon="🚚"
      public
      queryKey={['transport', 'carriers'] as unknown[]}
      fetch={async () => [] as Transporter[]}
      rowKey={(transporter) => String(transporter.id)}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (transporter) => String(transporter.name ?? '—') },
        { key: 'countryCode', label: t('ui.pays'), render: (transporter) => <Chip label={String(transporter.countryCode ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (transporter) => <Chip label={String(transporter.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'registeredAt', label: t('ui.inscritLe'), render: (transporter) => (transporter.createdAt ? formatDate(String(transporter.createdAt), locale) : '—') },
      ]}
      emptyTitle={t('ui.aucunTransporteur')}
      emptyDescription={t('ui.aucunTransporteurNEstActuellementReference')}
    />
  );
}
