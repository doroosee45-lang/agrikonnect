import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** PUBLIC — annuaire des exploitations publiées (PUB-01). */
export default function PublicFarmers() {
  const { locale } = useI18n();

  const farms = useQuery({
    queryKey: queryKeys.public.farms({ limit: 50 }),
    queryFn: () => publicApi.farms({ limit: 50 }).then((result) => result.data),
  });

  const items = farms.data ?? [];

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Annuaire
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Exploitations publiées
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        Seules les exploitations dont le producteur a choisi la publication apparaissent ici. Les coordonnées
        restent masquées : le contact passe par la plateforme.
      </Text>

      {farms.isLoading ? (
        <LoadingState count={3} height={140} />
      ) : farms.isError ? (
        <ErrorState error={farms.error} onRetry={() => void farms.refetch()} showRequestId />
      ) : items.length === 0 ? (
        <EmptyState title="Aucune exploitation publiée" description="Aucune exploitation n'a encore choisi d'être publique." icon="🏡" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {items.map((farm, index) => (
            <motion.div
              key={farm.slug}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
            >
              <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <Text preset="h4" color={COLORS.textPrimary} style={{ flex: 1 }}>
                    {farm.name}
                  </Text>
                  {farm.verificationStatus === 'VERIFIED' ? <Chip label="vérifiée" tone="success" size="sm" /> : <Chip label="déclarée" tone="warning" size="sm" />}
                </div>

                <Text preset="caption" color={COLORS.slateGray}>
                  {farm.countryCode}
                  {farm.province ? ` · ${farm.province}` : ''}
                  {farm.totalAreaHa !== null ? ` · ${formatNumber(farm.totalAreaHa, locale, 1)} ha` : ''}
                </Text>

                {farm.description ? (
                  <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.6 }}>
                    {farm.description}
                  </Text>
                ) : null}

                {farm.crops.length > 0 ? (
                  <ChipRow>
                    {farm.crops.slice(0, 4).map((entry) => (
                      <Chip key={entry.crop.slug} label={entry.crop.names?.[locale] ?? entry.crop.names?.fr ?? entry.crop.slug} tone="neutral" size="sm" />
                    ))}
                  </ChipRow>
                ) : null}

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    mise à jour {formatDate(farm.updatedAt, locale)}
                  </Text>
                  <Link to={`/public/farms/${farm.slug}`}>
                    <Button label="Voir la fiche" variant="outline" size="sm" />
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}
