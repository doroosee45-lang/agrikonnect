import { ResourcePage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { Chip } from '@/components/ui';

/** ADMIN — exploitations enregistrées. */
export default function AdminFarms() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Farm>
      title={t('ui.exploitations')}
      subtitle={t('ui.toutesLesExploitationsAvecLeurStatut')}
      icon="🏡"
      queryKey={queryKeys.farms.list({ limit: 100 })}
      fetch={() => farmApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(farm) => farm.id}
      rowHref={(farm) => `/app/farms/${farm.id}`}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (farm) => farm.name },
        { key: 'countryCode', label: t('ui.pays'), render: (farm) => `${farm.countryCode}${farm.province ? ` · ${farm.province}` : ''}` },
        { key: 'totalAreaHa', label: t('ui.surface'), render: (farm) => (farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—') },
        { key: 'verificationStatus', label: t('ui.verification_bb27a'), render: (farm) => <Chip label={farm.verificationStatus ?? t('ui.nonVerifiee')} tone={farm.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm" /> },
        { key: 'isPublic', label: t('ui.publique'), render: (farm) => <Chip label={farm.isPublic ? t('ui.oui') : t('ui.non')} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
        { key: 'updatedAt', label: t('ui.miseAJour'), render: (farm) => formatDate(farm.updatedAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneExploitation')}
      emptyDescription={t('ui.aucuneExploitationNAEteRenvoyee')}
      notice={t('ui.lesCoordonneesDesExploitantsNeSont')}
    />
  );
}
