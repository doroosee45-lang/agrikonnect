import { ResourcePage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { Chip } from '@/components/ui';

/** ADMIN — exploitations enregistrées. */
export default function AdminFarms() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Farm>
      title="Exploitations"
      subtitle="Toutes les exploitations, avec leur statut de publication."
      icon="🏡"
      queryKey={queryKeys.farms.list({ limit: 100 })}
      fetch={() => farmApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(farm) => farm.id}
      rowHref={(farm) => `/app/farms/${farm.id}`}
      columns={[
        { key: 'name', label: 'Nom', render: (farm) => farm.name },
        { key: 'countryCode', label: 'Pays', render: (farm) => `${farm.countryCode}${farm.province ? ` · ${farm.province}` : ''}` },
        { key: 'totalAreaHa', label: 'Surface', render: (farm) => (farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—') },
        { key: 'verificationStatus', label: 'Vérification', render: (farm) => <Chip label={farm.verificationStatus ?? 'non vérifiée'} tone={farm.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm" /> },
        { key: 'isPublic', label: 'Publique', render: (farm) => <Chip label={farm.isPublic ? 'oui' : 'non'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
        { key: 'updatedAt', label: 'Mise à jour', render: (farm) => formatDate(farm.updatedAt, locale) },
      ]}
      emptyTitle="Aucune exploitation"
      emptyDescription="Aucune exploitation n'a été renvoyée par l'API."
      notice="Les coordonnées des exploitants ne sont jamais exposées dans les listes d'administration."
    />
  );
}
