import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { plotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

/** APP — fiche parcelle et ses modules. */
export default function AppPlotDetail() {
  const { id } = useParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.plots.one(id ?? ''),
    queryFn: () => plotApi.get(id ?? '').then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const plot = query.data;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Parcelle" icon="🗺️">
        <div style={{ marginBottom: 24 }}>
          <a href="/app/plots" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux parcelles
          </a>
        </div>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !plot ? (
          <Text preset="bodyMd">Parcelle introuvable.</Text>
        ) : (
          <>
            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h2" style={{ marginBottom: 8 }}>
                {plot.name}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text preset="bodySm">
                  Exploitation : {plot.farm?.name ?? '—'}
                </Text>
                <Text preset="bodySm">
                  Surface : {plot.areaHa !== null ? `${plot.areaHa} ha` : '—'}
                </Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={plot.geometryType} tone="neutral" size="sm" />
                  <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
                  <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" />
                </div>
                <Text preset="caption" color={COLORS.slateGray}>
                  Mise à jour : {formatDate(plot.updatedAt, locale)}
                </Text>
              </div>
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Culture courante
              </Text>
              {plot.currentCrop ? (
                <Text preset="bodySm">
                  {plot.currentCrop.names?.[locale] ?? plot.currentCrop.names?.fr ?? plot.currentCrop.slug}
                </Text>
              ) : (
                <Text preset="caption" color={COLORS.slateGray}>
                  Aucune culture active.
                </Text>
              )}
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Modules
              </Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/farmer/plots/${id}/soil`}>
                  <Button label="Sol" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/recommendations`}>
                  <Button label="Compatibilité" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/rotation`}>
                  <Button label="Rotation" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/plan`}>
                  <Button label="Plan" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/precision-report`}>
                  <Button label="Précision" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/zones`}>
                  <Button label="Zones" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/sensors`}>
                  <Button label="Capteurs" variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/satellite`}>
                  <Button label="Satellite" variant="outline" size="sm" />
                </Link>
              </div>
            </Card>

            {plot.histories.length > 0 ? (
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Historique cultural
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plot.histories.map((history) => (
                    <div key={history.id} style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Text preset="bodySm" style={{ fontWeight: 600 }}>
                        {history.cropId}
                      </Text>
                      <Text preset="caption">{history.season}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}
      </AuthGate>
    </Section>
  );
}
