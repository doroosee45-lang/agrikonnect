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
  const { t } = useI18n();
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
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.parcelle')} icon="🗺️">
        <div style={{ marginBottom: 24 }}>
          <a href="/app/plots" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourAuxParcelles')}</a>
        </div>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !plot ? (
          <Text preset="bodyMd">{t('ui.parcelleIntrouvable')}</Text>
        ) : (
          <>
            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h2" style={{ marginBottom: 8 }}>
                {plot.name}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text preset="bodySm">{t('ui.exploitation', { value: plot.farm?.name ?? '—' })}</Text>
                <Text preset="bodySm">{t('ui.surface_1fb7a', { value: plot.areaHa !== null ? `${plot.areaHa} ha` : '—' })}</Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={plot.geometryType} tone="neutral" size="sm" />
                  <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
                  <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" />
                </div>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.miseAJour_03ef7', { updatedAt: formatDate(plot.updatedAt, locale) })}</Text>
              </div>
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.cultureCourante')}</Text>
              {plot.currentCrop ? (
                <Text preset="bodySm">
                  {plot.currentCrop.names?.[locale] ?? plot.currentCrop.names?.fr ?? plot.currentCrop.slug}
                </Text>
              ) : (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneCultureActive')}</Text>
              )}
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.modules')}</Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/farmer/plots/${id}/soil`}>
                  <Button label={t('ui.sol')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/recommendations`}>
                  <Button label={t('ui.compatibilite')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/rotation`}>
                  <Button label={t('ui.rotation')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/plan`}>
                  <Button label={t('ui.plan')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/precision-report`}>
                  <Button label={t('ui.precision')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/zones`}>
                  <Button label={t('ui.zones')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/sensors`}>
                  <Button label={t('ui.capteurs')} variant="outline" size="sm" />
                </Link>
                <Link to={`/farmer/plots/${id}/satellite`}>
                  <Button label={t('ui.satellite_d1ffe')} variant="outline" size="sm" />
                </Link>
              </div>
            </Card>

            {plot.histories.length > 0 ? (
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.historiqueCultural')}</Text>
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
