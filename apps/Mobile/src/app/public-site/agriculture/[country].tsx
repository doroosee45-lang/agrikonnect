import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { insightsApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * INS-01/INS-02 — indicateurs agrégés par pays.
 *
 * Un indicateur `null` signifie « non publiable » (groupe sous le seuil de
 * k-anonymat) : il est affiché comme tel, jamais remplacé par zéro.
 */
export default function PublicSiteAgricultureCountry() {
  const { t } = useI18n();
  const { country } = useLocalSearchParams<{ country: string }>();
  const { locale } = useI18n();
  const countryCode = (country ?? '').toUpperCase();
  const overview = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode }),
    queryFn: () => insightsApi.overview({ countryCode }).then((r) => r.data),
    enabled: countryCode.length > 0,
    retry: false,
  });
  const crops = useQuery({
    queryKey: queryKeys.insights.crops({ countryCode }),
    queryFn: () => insightsApi.crops({ countryCode }).then((r) => r.data),
    enabled: countryCode.length > 0,
    retry: false,
  });
  const loading = overview.isLoading || crops.isLoading;
  const error = overview.error ?? crops.error;
  const indicators = Object.entries(overview.data?.indicators ?? {});
  const cropRows = crops.data?.crops ?? [];
  return (
    <PublicShell active="agriculture">
      <PageHeader index="03" eyebrow={t('ui.agriculture')} title={countryCode || t('ui.pays')} subtitle={t('ui.indicateursAgregesEtVolumesParCulture')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {loading ? <LoadingState count={3} height={120} /> : error ? <ErrorState error={error} onRetry={() => { void overview.refetch(); void crops.refetch(); }} /> : (
          <>
            {overview.data?.disclosure.message ? (
              <Card tone="pale">
                <Text preset="caption" color={COLORS.warning}>{overview.data.disclosure.message}</Text>
              </Card>
            ) : null}
            <Text preset="h3">{t('ui.indicateurs')}</Text>
            {indicators.length === 0 ? <EmptyState title={t('ui.aucunIndicateur')} description={t('ui.aucunIndicateurPubliablePourCePays')} icon="stats-chart-outline" /> : (
              <View style={styles.list}>
                {indicators.map(([key, indicator], index) => (
                  <Reveal key={key} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{key}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{indicator.method} · {indicator.source}</Text>
                        {indicator.reason ? <Text preset="caption" color={COLORS.warning}>{indicator.reason}</Text> : null}
                      </View>
                      <Text preset="bodyMedium">
                        {indicator.value !== null ? `${formatNumber(indicator.value, locale)}${indicator.unit ? ` ${indicator.unit}` : ''}` : t('ui.nonPubliable')}
                      </Text>
                    </Card>
                  </Reveal>
                ))}
              </View>
            )}
            <Text preset="h3" style={styles.mt}>{t('ui.volumesParCulture')}</Text>
            {crops.data && crops.data.suppressed > 0 ? (
              <Card tone="pale">
                <Text preset="caption" color={COLORS.warning}>{t('ui.cultureSNonPublieeSGroupe', { suppressed: crops.data.suppressed, minGroupSize: crops.data.minGroupSize, value: crops.data.suppressedNote ?? '' })}</Text>
              </Card>
            ) : null}
            {cropRows.length === 0 ? <EmptyState title={t('ui.aucuneCulture')} description={t('ui.lesCulturesSousLeSeuilNe')} icon="leaf-outline" /> : (
              <View style={styles.list}>
                {cropRows.map((row, index) => (
                  <Reveal key={row.crop.id} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{row.crop.names?.[locale] ?? row.crop.slug ?? row.crop.id}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.organisationS_a9673', { organizations: row.organizations, source: row.source })}</Text>
                      </View>
                      <Chip label={`${formatNumber(row.volumeKg, locale)} kg`} tone="neutral" size="sm" />
                    </Card>
                  </Reveal>
                ))}
              </View>
            )}
          </>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, mt: { marginTop: SPACING.sm } });
