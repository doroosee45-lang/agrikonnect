import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, ChipRow, ErrorState, FilterChip, LoadingState, Section, Text } from '@/components/ui';
import { productionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n, tr } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';
import { ChartCard } from '@/design-system';

/**
 * ORGANIZATION — synthèse de production agrégée.
 *
 * Le backend additionne uniquement les unités convertibles en kilogrammes et
 * renvoie séparément `recordsWithoutKg`. Additionner des sacs, des paniers et des
 * kilogrammes produirait un nombre sans signification : ce qui n'est pas
 * convertible est compté, pas converti de force.
 */
type GroupBy = 'crop' | 'plot' | 'month' | 'year';

const GROUP_LABELS: Record<GroupBy, string> = {
  get crop() { return tr('ui.parCulture'); },
  get plot() { return tr('ui.parParcelle'); },
  get month() { return tr('ui.parMois'); },
  get year() { return tr('ui.parAnnee'); },
};

export default function OrganizationProductionSummary() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [groupBy, setGroupBy] = useState<GroupBy>('crop');

  const stats = useQuery({
    queryKey: queryKeys.productions.stats({ groupBy }),
    queryFn: () => productionApi.stats({ groupBy }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const total = stats.data?.totals;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.syntheseProduction')} icon="🌾">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.syntheseDeProduction')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.volumesAgregesSurLEnsembleDes')}</Text>

          <ChipRow style={{ marginBottom: 24 }}>
            {(Object.keys(GROUP_LABELS) as GroupBy[]).map((key) => (
              <FilterChip
                key={key}
                label={GROUP_LABELS[key]}
                active={groupBy === key}
                onPress={() => setGroupBy(key)}
              />
            ))}
          </ChipRow>

          {stats.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : stats.isError ? (
            <ErrorState error={stats.error} onRetry={() => void stats.refetch()} showRequestId />
          ) : !stats.data ? null : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <Card tone="ink" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.gold} style={{ marginBottom: 8 }}>{t('ui.declarations')}</Text>
                  <Text preset="numeric" color={COLORS.pureWhite} style={{ fontSize: 32 }}>
                    {formatNumber(total?.records ?? 0, locale)}
                  </Text>
                </Card>
                <Card tone="white" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.volumeConvertible')}</Text>
                  <Text preset="numeric" color={COLORS.forestGreen} style={{ fontSize: 32 }}>
                    {formatNumber(total?.quantityKg ?? 0, locale)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>
                    kg
                  </Text>
                </Card>
                <Card tone="white" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.horsConversion')}</Text>
                  <Text preset="numeric" color={COLORS.textPrimary} style={{ fontSize: 32 }}>
                    {formatNumber(total?.recordsWithoutKg ?? 0, locale)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>{t('ui.declarationSNonAdditionneeS')}</Text>
                </Card>
              </div>

              {total && total.recordsWithoutKg > 0 ? (
                <Card tone="pale">
                  <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                    <strong>{t('ui.declarationSNeSontPasIncluses', { recordsWithoutKg: formatNumber(total.recordsWithoutKg, locale) })}</strong>{t('ui.leurUniteSacsPaniersBottesN')}</Text>
                </Card>
              ) : null}

              <ChartCard titre={t('ui.repartition', { value: GROUP_LABELS[groupBy] })} source={stats.data.source}>
                {stats.data.series.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>{t('ui.aucuneProductionDeclareePourCeRegroupement')}</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {stats.data.series.map((row) => (
                      <div
                        key={row.key}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                      >
                        <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                          {row.label}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.declKg', { records: formatNumber(row.records, locale), quantityKg: formatNumber(row.quantityKg, locale) })}{row.convertibleRecords < row.records
                            ? t('ui.horsConversion_563f8', { value: formatNumber(row.records - row.convertibleRecords, locale) })
                            : ''}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>

              {Object.values(stats.data.filters).some((value) => value !== null) ? (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.filtresAppliques', { value: Object.entries(stats.data.filters)
                    .filter(([, value]) => value !== null)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(' · ') })}</Text>
              ) : null}
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
