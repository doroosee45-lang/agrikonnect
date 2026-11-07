import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE, LAYOUT } from '@/theme';
import { ChartCard } from '@/design-system';

/** PUBLIC — carte des exploitations publiées (MAP-01 → MAP-04). Positions approximatives. */
export default function PublicMapPage() {
  const { locale } = useI18n();

  const map = useQuery({
    queryKey: queryKeys.public.map({ limit: 500 }),
    queryFn: () => publicApi.map({ limit: 500 }).then((result) => result.data),
  });

  const features = map.data?.features ?? [];

  const byCountry = features.reduce<Record<string, number>>((acc, feature) => {
    const code = feature.properties.countryCode;
    acc[code] = (acc[code] ?? 0) + 1;
    return acc;
  }, {});

  const points = features.slice(0, 300);
  const bbox = map.data?.meta.bbox ?? null;

  const project = (lng: number, lat: number) => {
    if (!bbox) return { left: '50%', top: '50%' };
    const x = ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng || 1)) * 100;
    const y = (1 - (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat || 1)) * 100;
    return { left: `${Math.min(98, Math.max(2, x))}%`, top: `${Math.min(98, Math.max(2, y))}%` };
  };

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Carte
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Exploitations publiées
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        Les positions sont volontairement approximatives : elles protègent la localisation exacte des parcelles.
        Le regroupement est calculé côté client.
      </Text>

      {map.isLoading ? (
        <LoadingState count={1} height={420} />
      ) : map.isError ? (
        <ErrorState error={map.error} onRetry={() => void map.refetch()} showRequestId />
      ) : features.length === 0 ? (
        <EmptyState title="Aucune exploitation publiée" description="La carte est vide tant qu'aucune exploitation n'est publique." icon="🗺️" />
      ) : (
        <>
          <Card tone="white" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <div
              style={{
                position: 'relative',
                height: 460,
                maxWidth: LAYOUT.maxContentWidth,
                backgroundColor: COLORS.paleGreen,
                backgroundImage: `linear-gradient(${COLORS.lightBorder} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.lightBorder} 1px, transparent 1px)`,
                backgroundSize: '48px 48px',
              }}
            >
              {points.map((feature, index) => {
                const [lng, lat] = feature.geometry.coordinates;
                const position = project(lng, lat);
                return (
                  <motion.div
                    key={feature.properties.slug}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 40) * 0.01, ease: EASE.out }}
                    title={feature.properties.name}
                    style={{
                      position: 'absolute',
                      ...position,
                      width: feature.properties.verified ? 12 : 9,
                      height: feature.properties.verified ? 12 : 9,
                      borderRadius: '50%',
                      backgroundColor: feature.properties.verified ? COLORS.forestGreen : COLORS.livingGreen,
                      border: `2px solid ${COLORS.pureWhite}`,
                      boxShadow: 'var(--shadow-sm)',
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <ChartCard titre="Couverture">
              <ChipRow>
                {Object.entries(byCountry)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => (
                    <Chip key={code} label={`${code} · ${formatNumber(count, locale)}`} tone="neutral" size="sm" />
                  ))}
              </ChipRow>
              <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12, lineHeight: 1.7 }}>
                {map.data?.meta.note}
              </Text>
            </ChartCard>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Légende
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.forestGreen }} />
                  <Text preset="caption" color={COLORS.textPrimary}>
                    Exploitation vérifiée
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: COLORS.livingGreen }} />
                  <Text preset="caption" color={COLORS.textPrimary}>
                    Exploitation déclarée
                  </Text>
                </div>
              </div>
              <Link to="/public/farmers" style={{ marginTop: 16, display: 'inline-block' }}>
                <Button label="Voir l'annuaire" variant="outline" size="sm" />
              </Link>
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}
