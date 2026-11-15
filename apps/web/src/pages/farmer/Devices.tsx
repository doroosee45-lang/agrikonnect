import { ResourcePage } from '@/components/pages';
import { iotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { IotDevice } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — capteurs (IOT-01 → IOT-06), état réel et dernière communication. */
export default function FarmerDevices() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<IotDevice>
      title={t('ui.mesCapteurs')}
      subtitle={t('ui.capteursRattachesAVosParcelles')}
      icon="📡"
      queryKey={queryKeys.iot.devices}
      fetch={() => iotApi.devices().then((result) => result.data.items)}
      rowKey={(device) => device.id}
      columns={[
        { key: 'label', label: t('ui.nom'), render: (device) => device.label },
        { key: 'plotId', label: t('ui.parcelle'), render: (device) => device.plotId ?? '—' },
        { key: 'status', label: t('ui.statut'), render: (device) => <Chip label={device.status} tone={device.status === 'ONLINE' ? 'success' : device.status === 'OFFLINE' ? 'error' : 'neutral'} size="sm" /> },
        { key: 'lastSeenAt', label: t('ui.derniereCommunication'), render: (device) => (device.lastSeenAt ? formatDate(device.lastSeenAt, locale) : 'jamais') },
        { key: 'silent', label: t('ui.muet_8bd9f'), render: (device) => (device.silent ? <Chip label={t('ui.oui')} tone="warning" size="sm" /> : <Chip label={t('ui.non')} tone="neutral" size="sm" />) },
      ]}
      emptyTitle={t('ui.aucunCapteur')}
      emptyDescription={t('ui.aucunCapteurNEstRattacheA')}
    />
  );
}
