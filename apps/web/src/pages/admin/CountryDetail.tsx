import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

type Country = { code: string; name: string; defaultCurrency: string };

/** ADMIN — détail d'un pays du référentiel. */
export default function AdminCountryDetail() {
  const { code } = useParams<{ code: string }>();

  return (
    <DetailPage<Country>
      title={(country) => country.name}
      subtitle="Fiche pays du référentiel."
      backHref="/admin/countries"
      backLabel="Retour aux pays"
      queryKey={queryKeys.countries.one(code ?? '')}
      fetch={() => referenceApi.country(code ?? '').then((result) => result.data)}
      sections={(country) => [
        {
          title: 'Identité',
          fields: [
            { label: 'Code ISO', value: country.code },
            { label: 'Nom', value: country.name },
            { label: 'Devise par défaut', value: country.defaultCurrency },
          ],
        },
      ]}
    />
  );
}
