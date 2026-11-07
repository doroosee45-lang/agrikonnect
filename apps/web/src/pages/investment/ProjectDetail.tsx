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
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<Project>
      title={(project) => project.title}
      subtitle="Fiche du projet et accès à sa salle de données."
      backHref="/investment/projects"
      backLabel="Retour aux projets"
      queryKey={queryKeys.projects.one(id ?? '')}
      fetch={() => projectApi.get(id ?? '').then((result) => result.data as unknown as Project)}
      actions={() => (
        <Link to={`/farmer/projects/${id}/dataroom`}>
          <Button label="Salle de données" variant="outline" size="sm" />
        </Link>
      )}
      sections={(project) => [
        {
          title: 'Identification',
          fields: [
            { label: 'Titre', value: project.title },
            { label: 'Statut', value: <Chip label={project.status} tone={project.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
            { label: 'Créé le', value: formatDate(project.createdAt, locale) },
          ],
        },
        {
          title: 'Financement',
          notice: "Le besoin et l'apport sont des montants déclarés. Ils ne sont pas vérifiés par la plateforme.",
          fields: [
            { label: 'Besoin', value: project.fundingNeed !== null ? formatCurrency(project.fundingNeed, 'USD') : '—' },
            { label: 'Apport propre', value: project.ownContribution !== null ? formatCurrency(project.ownContribution, 'USD') : '—' },
          ],
        },
        { title: 'Présentation', fields: [{ label: 'Description', value: project.description ?? 'Aucune description renseignée.' }] },
      ]}
    />
  );
}
