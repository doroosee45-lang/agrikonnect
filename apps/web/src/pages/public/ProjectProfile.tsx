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
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Row>
      public
      title={(project) => String(project.title ?? 'Projet')}
      subtitle="Fiche publique du projet."
      backHref="/public/projects"
      backLabel="Retour aux projets"
      queryKey={queryKeys.projects.one(id ?? '')}
      fetch={() => projectApi.get(id ?? '').then((result) => result.data)}
      sections={(project) => [
        {
          title: 'Identification',
          fields: [
            { label: 'Secteur', value: <Chip label={String(project.sector ?? '—')} tone="neutral" size="sm" /> },
            { label: 'Pays', value: String(project.countryCode ?? '—') },
            { label: 'Province', value: String(project.province ?? '—') },
            { label: 'Statut', value: <Chip label={String(project.status ?? '—')} tone="info" size="sm" /> },
          ],
        },
        {
          title: 'Description',
          fields: [{ label: 'Présentation', value: String(project.description ?? 'Aucune description publiée.') }],
        },
        {
          title: 'Chiffres déclarés',
          notice: 'Ces valeurs sont déclarées par le porteur de projet. Elles ne constituent pas une garantie de rendement.',
          fields: [
            { label: 'Surface existante', value: project.existingAreaHa !== null && project.existingAreaHa !== undefined ? `${formatNumber(Number(project.existingAreaHa), locale, 1)} ha` : '—' },
            { label: 'Surface cible', value: project.targetAreaHa !== null && project.targetAreaHa !== undefined ? `${formatNumber(Number(project.targetAreaHa), locale, 1)} ha` : '—' },
            { label: 'Besoin de financement', value: project.fundingNeed !== null && project.fundingNeed !== undefined ? formatNumber(Number(project.fundingNeed), locale) : '—' },
            { label: 'Contribution propre', value: project.ownContribution !== null && project.ownContribution !== undefined ? formatNumber(Number(project.ownContribution), locale) : '—' },
            { label: 'Durée', value: project.durationMonths !== null && project.durationMonths !== undefined ? `${String(project.durationMonths)} mois` : '—' },
          ],
        },
      ]}
      notFoundTitle="Projet introuvable"
      notFoundDescription="Ce projet n'est pas publié ou n'existe pas."
    />
  );
}
