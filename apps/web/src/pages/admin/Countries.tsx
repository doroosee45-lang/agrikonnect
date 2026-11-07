import { ResourcePage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';

type Country = { code: string; name: string; currencies: string[]; defaultCurrency: string; locales: string[]; timezone: string; status: string };

/** ADMIN — pays couverts par la plateforme. */
export default function AdminCountries() {
  return (
    <ResourcePage<Country>
      title="Pays"
      subtitle="Pays couverts, avec leurs devises et locales."
      icon="🌍"
      queryKey={queryKeys.countries.all}
      fetch={() => referenceApi.countries().then((result) => result.data)}
      rowKey={(country) => country.code}
      rowHref={(country) => `/admin/countries/${country.code}`}
      columns={[
        { key: 'code', label: 'Code', render: (country) => country.code },
        { key: 'name', label: 'Nom', render: (country) => country.name },
        { key: 'defaultCurrency', label: 'Devise', render: (country) => country.defaultCurrency },
        { key: 'locales', label: 'Locales', render: (country) => country.locales.join(', ') },
        { key: 'status', label: 'Statut', render: (country) => <Chip label={country.status} tone={country.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucun pays"
      emptyDescription="Le référentiel n'a renvoyé aucun pays."
    />
  );
}
