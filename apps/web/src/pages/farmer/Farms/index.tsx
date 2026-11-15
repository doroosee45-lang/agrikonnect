import { ResourcePage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — mes exploitations. */
export default function FarmerFarms() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Farm>
      title={t('ui.mesExploitations')}
      subtitle={t('ui.exploitationsRattacheesAVotreOrganisation')}
      icon="🏡"
      queryKey={queryKeys.farms.list({ limit: 100 })}
      fetch={() => farmApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(farm) => farm.id}
      rowHref={(farm) => `/farmer/farms/${farm.id}`}
      action={{ label: t('ui.nouvelleExploitation'), href: '/farmer/farms/create' }}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (farm) => farm.name },
        { key: 'countryCode', label: t('ui.pays'), render: (farm) => `${farm.countryCode}${farm.province ? ` · ${farm.province}` : ''}` },
        { key: 'totalAreaHa', label: t('ui.surface'), render: (farm) => (farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—') },
        { key: 'isPublic', label: t('ui.publication'), render: (farm) => <Chip label={farm.isPublic ? t('ui.publique_9eb2b') : t('ui.privee')} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
        { key: 'updatedAt', label: t('ui.miseAJour'), render: (farm) => formatDate(farm.updatedAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneExploitation')}
      emptyDescription={t('ui.creezVotrePremiereExploitationPourCommencer')}
    />
  );
}
