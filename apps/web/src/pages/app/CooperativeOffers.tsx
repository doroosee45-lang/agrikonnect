import { ResourcePage } from '@/components/pages';
import { cooperativeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useQuery } from '@tanstack/react-query';
import { StatusChip, type Row } from '@/components/pages';
import { useI18n } from '@/i18n';

/** APP — offres groupées de la coopérative. */
export default function AppCooperativeOffers() {
  const { t } = useI18n();
  const cooperative = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    retry: false,
  });
  const cooperativeId = cooperative.data?.id ?? '';

  return (
    <ResourcePage<Row>
      title={t('ui.offresGroupees')}
      subtitle={t('ui.offresConsolideesAPartirDesVolumes')}
      icon="🤝"
      queryKey={queryKeys.cooperatives.groupOffers(cooperativeId)}
      fetch={() => cooperativeApi.groupOffers(cooperativeId).then((result) => result.data as Row[])}
      rowKey={(offer) => String(offer.id)}
      columns={[
        { key: 'status', label: t('ui.statut'), render: (offer) => <StatusChip value={offer.status} /> },
        { key: 'createdAt', label: t('ui.creeeLe'), render: (offer) => String(offer.createdAt ?? '—') },
      ]}
      emptyTitle={t('ui.aucuneOffreGroupee')}
      emptyDescription={t('ui.aucuneOffreGroupeeNAEte')}
      notice={t('ui.aucunVolumeNEstConsolideSans')}
    />
  );
}
