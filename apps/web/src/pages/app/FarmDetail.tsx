import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — fiche d'une exploitation. */
export default function AppFarmDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Farm>
      title={(farm) => farm.name}
      subtitle={t('ui.ficheDeLExploitation')}
      backHref="/app/farms"
      backLabel={t('ui.retourAuxExploitations')}
      queryKey={queryKeys.farms.one(id ?? '')}
      fetch={() => farmApi.get(id ?? '').then((result) => result.data)}
      actions={(farm) => (
        <>
          <Link to={`/app/plots?farmId=${farm.id}`}>
            <Button label={t('ui.voirLesParcelles')} variant="outline" size="sm" />
          </Link>
          <Link to={`/public/farms/${farm.slug}`}>
            <Button label={t('ui.fichePublique')} variant="ghost" size="sm" />
          </Link>
        </>
      )}
      sections={(farm) => [
        {
          title: t('ui.identification'),
          fields: [
            { label: t('ui.nom'), value: farm.name },
            { label: t('ui.slug'), value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{farm.slug}</span> },
            { label: t('ui.pays'), value: farm.countryCode },
            { label: t('ui.province'), value: farm.province ?? '—' },
            { label: t('ui.surfaceTotale'), value: farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—' },
            { label: t('ui.miseAJour'), value: formatDate(farm.updatedAt, locale) },
          ],
        },
        {
          title: t('ui.publicationEtVerification'),
          notice: t('ui.uneExploitationVerifieeAFaitL'),
          fields: [
            { label: t('ui.publication'), value: <Chip label={farm.isPublic ? t('ui.publique_9eb2b') : t('ui.privee')} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
            { label: t('ui.verification_bb27a'), value: <Chip label={farm.verificationStatus ?? t('ui.nonVerifiee')} tone={farm.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="sm" /> },
            { label: t('ui.source_6da13'), value: <Chip label={farm.source} tone={farm.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
          ],
        },
        {
          title: t('ui.description'),
          fields: [{ label: t('ui.presentation'), value: farm.description ?? t('ui.aucuneDescriptionRenseignee') }],
        },
      ]}
    />
  );
}
