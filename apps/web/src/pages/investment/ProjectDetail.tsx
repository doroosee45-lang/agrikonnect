import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Project } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/format';
import { useI18n } from '@/i18n';

/** INVESTMENT — fiche projet côté investisseur. */
export default function InvestmentProjectDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Project>
      title={(project) => project.title}
      subtitle={t('ui.ficheDuProjetEtAccesA')}
      backHref="/investment/projects"
      backLabel={t('ui.retourAuxProjets_14c74')}
      queryKey={queryKeys.projects.one(id ?? '')}
      fetch={() => projectApi.get(id ?? '').then((result) => result.data as unknown as Project)}
      actions={() => (
        <Link to={`/farmer/projects/${id}/dataroom`}>
          <Button label={t('ui.salleDeDonnees')} variant="outline" size="sm" />
        </Link>
      )}
      sections={(project) => [
        {
          title: t('ui.identification'),
          fields: [
            { label: t('ui.titre'), value: project.title },
            { label: t('ui.statut'), value: <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
            { label: t('ui.creeLe'), value: formatDate(project.createdAt, locale) },
          ],
        },
        {
          title: t('ui.financement'),
          notice: t('ui.leBesoinEtLApportSont'),
          fields: [
            { label: t('ui.besoin'), value: project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—' },
            { label: t('ui.apportPropre'), value: project.ownContribution !== null ? formatCurrency(project.ownContribution, 'USD') : '—' },
          ],
        },
        { title: t('ui.presentation'), fields: [{ label: t('ui.description'), value: project.description ?? t('ui.aucuneDescriptionRenseignee') }] },
      ]}
    />
  );
}
