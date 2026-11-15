import { ResourcePage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

type Country = { code: string; name: string; currencies: string[]; defaultCurrency: string; locales: string[]; timezone: string; status: string };

/** ADMIN — pays couverts par la plateforme. */
export default function AdminCountries() {
  const { t } = useI18n();
  return (
    <ResourcePage<Country>
      title={t('ui.pays')}
      subtitle={t('ui.paysCouvertsAvecLeursDevisesEt')}
      icon="🌍"
      queryKey={queryKeys.countries.all}
      fetch={() => referenceApi.countries().then((result) => result.data)}
      rowKey={(country) => country.code}
      rowHref={(country) => `/admin/countries/${country.code}`}
      columns={[
        { key: 'code', label: t('ui.code'), render: (country) => country.code },
        { key: 'name', label: t('ui.nom'), render: (country) => country.name },
        { key: 'defaultCurrency', label: t('ui.devise'), render: (country) => country.defaultCurrency },
        { key: 'locales', label: t('ui.locales'), render: (country) => country.locales.join(', ') },
        { key: 'status', label: t('ui.statut'), render: (country) => <Chip label={country.status} tone={country.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunPays')}
      emptyDescription={t('ui.leReferentielNARenvoyeAucun')}
    />
  );
}
