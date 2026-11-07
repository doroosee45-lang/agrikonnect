import { ResourcePage } from '@/components/pages';
import { iotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { IotDevice } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — capteurs (IOT-01 → IOT-06), état réel et dernière communication. */
export default function FarmerDevices() {
  const { locale } = useI18n();
  return (
    <ResourcePage<IotDevice>
      title="Mes capteurs"
      subtitle="Capteurs rattachés à vos parcelles."
      icon="📡"
      queryKey={queryKeys.iot.devices}
      fetch={() => iotApi.devices().then((result) => result.data.items)}
      rowKey={(device) => device.id}
      columns={[
        { key: 'label', label: 'Nom', render: (device) => device.label },
        { key: 'plotId', label: 'Parcelle', render: (device) => device.plotId ?? '—' },
        { key: 'status', label: 'Statut', render: (device) => <Chip label={device.status} tone={device.status === 'ONLINE' ? 'success' : device.status === 'OFFLINE' ? 'error' : 'neutral'} size="sm" /> },
        { key: 'lastSeenAt', label: 'Dernière communication', render: (device) => (device.lastSeenAt ? formatDate(device.lastSeenAt, locale) : 'jamais') },
        { key: 'silent', label: 'Muet', render: (device) => (device.silent ? <Chip label="oui" tone="warning" size="sm" /> : <Chip label="non" tone="neutral" size="sm" />) },
      ]}
      emptyTitle="Aucun capteur"
      emptyDescription="Aucun capteur n'est rattaché à vos parcelles."
    />
  );
}
