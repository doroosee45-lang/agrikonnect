import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import type { Row } from '@/components/pages';

/** PUBLIC — fiche publique d'un projet. */
export default function PublicProjectProfile() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Row>
      public
      title={(project) => String(project.title ?? t('ui.projet'))}
      subtitle={t('ui.fichePubliqueDuProjet')}
      backHref="/public/projects"
      backLabel={t('ui.retourAuxProjets_14c74')}
      queryKey={queryKeys.projects.one(id ?? '')}
      fetch={() => projectApi.get(id ?? '').then((result) => result.data)}
      sections={(project) => [
        {
          title: t('ui.identification'),
          fields: [
            { label: t('ui.secteur'), value: <Chip label={String(project.sector ?? '—')} tone="neutral" size="sm" /> },
            { label: t('ui.pays'), value: String(project.countryCode ?? '—') },
            { label: t('ui.province'), value: String(project.province ?? '—') },
            { label: t('ui.statut'), value: <Chip label={String(project.status ?? '—')} tone="info" size="sm" /> },
          ],
        },
        {
          title: t('ui.description'),
          fields: [{ label: t('ui.presentation'), value: String(project.description ?? t('ui.aucuneDescriptionPubliee')) }],
        },
        {
          title: t('ui.chiffresDeclares'),
          notice: t('ui.cesValeursSontDeclareesParLe'),
          fields: [
            { label: t('ui.surfaceExistante'), value: project.existingAreaHa !== null && project.existingAreaHa !== undefined ? `${formatNumber(Number(project.existingAreaHa), locale, 1)} ha` : '—' },
            { label: t('ui.surfaceCible'), value: project.targetAreaHa !== null && project.targetAreaHa !== undefined ? `${formatNumber(Number(project.targetAreaHa), locale, 1)} ha` : '—' },
            { label: t('ui.besoinDeFinancement'), value: project.fundingNeed !== null && project.fundingNeed !== undefined ? formatNumber(Number(project.fundingNeed), locale) : '—' },
            { label: t('ui.contributionPropre'), value: project.ownContribution !== null && project.ownContribution !== undefined ? formatNumber(Number(project.ownContribution), locale) : '—' },
            { label: t('ui.duree'), value: project.durationMonths !== null && project.durationMonths !== undefined ? `${String(project.durationMonths)} mois` : '—' },
          ],
        },
      ]}
      notFoundTitle={t('ui.projetIntrouvable')}
      notFoundDescription={t('ui.ceProjetNEstPasPublie')}
    />
  );
}
