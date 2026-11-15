import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useI18n } from '@/i18n';

type Country = { code: string; name: string; defaultCurrency: string };

/** ADMIN — détail d'un pays du référentiel. */
export default function AdminCountryDetail() {
  const { t } = useI18n();
  const { code } = useParams<{ code: string }>();

  return (
    <DetailPage<Country>
      title={(country) => country.name}
      subtitle={t('ui.fichePaysDuReferentiel')}
      backHref="/admin/countries"
      backLabel={t('ui.retourAuxPays')}
      queryKey={queryKeys.countries.one(code ?? '')}
      fetch={() => referenceApi.country(code ?? '').then((result) => result.data)}
      sections={(country) => [
        {
          title: t('ui.identite'),
          fields: [
            { label: t('ui.codeIso'), value: country.code },
            { label: t('ui.nom'), value: country.name },
            { label: t('ui.deviseParDefaut'), value: country.defaultCurrency },
          ],
        },
      ]}
    />
  );
}
