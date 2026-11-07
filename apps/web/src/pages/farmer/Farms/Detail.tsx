import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — fiche d'une exploitation. */
export default function FarmerFarmDetail() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Farm>
      title={(farm) => farm.name}
      subtitle="Fiche de l'exploitation."
      backHref="/farmer/farms"
      backLabel="Retour aux exploitations"
      queryKey={queryKeys.farms.one(id ?? '')}
      fetch={() => farmApi.get(id ?? '').then((result) => result.data)}
      actions={(farm) => (
        <>
          <Link to={`/farmer/plots?farmId=${farm.id}`}>
            <Button label="Parcelles" variant="outline" size="sm" />
          </Link>
          <Link to={`/public/farms/${farm.slug}`}>
            <Button label="Fiche publique" variant="ghost" size="sm" />
          </Link>
        </>
      )}
      sections={(farm) => [
        {
          title: 'Identification',
          fields: [
            { label: 'Nom', value: farm.name },
            { label: 'Slug', value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{farm.slug}</span> },
            { label: 'Pays', value: farm.countryCode },
            { label: 'Province', value: farm.province ?? '—' },
            { label: 'Surface totale', value: farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—' },
            { label: 'Mise à jour', value: formatDate(farm.updatedAt, locale) },
          ],
        },
        {
          title: 'Publication et vérification',
          notice: 'Une exploitation vérifiée a fait l’objet d’un contrôle horodaté. Une exploitation déclarée repose sur une saisie.',
          fields: [
            { label: 'Publication', value: <Chip label={farm.isPublic ? 'publique' : 'privée'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
            { label: 'Vérification', value: <Chip label={farm.verificationStatus ?? 'non vérifiée'} tone={farm.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm" /> },
            { label: 'Source', value: <Chip label={farm.source} tone={farm.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
          ],
        },
        { title: 'Description', fields: [{ label: 'Présentation', value: farm.description ?? 'Aucune description renseignée.' }] },
      ]}
    />
  );
}
