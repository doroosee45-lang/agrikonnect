import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { productionApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * PROD — synthèse de production.
 *
 * Les unités non convertibles ne sont jamais additionnées : le backend renvoie
 * `recordsWithoutKg` séparément et ce compteur est affiché tel quel.
 */
export default function OrganizationProductionSummary() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.productions.stats({ groupBy: 'crop' }),
    queryFn: () => productionApi.stats({ groupBy: 'crop' }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const stats = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.syntheseDeProduction')} subtitle={t('ui.volumesConsolidesParCulture')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.syntheseDeProduction')} icon="stats-chart-outline">
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !stats ? <EmptyState title={t('ui.aucuneDonnee')} description={t('ui.aucuneProductionEnregistree')} icon="stats-chart-outline" /> : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.slateGray}>{t('ui.totaux')}</Text>
                <Text preset="bodyMedium">{t('ui.kgSurEnregistrementS', { quantityKg: formatNumber(stats.totals.quantityKg, locale), records: stats.totals.records })}</Text>
                {stats.totals.recordsWithoutKg > 0 ? (
                  <Text preset="caption" color={COLORS.warning}>{t('ui.enregistrementSEnUniteNonConvertible', { recordsWithoutKg: stats.totals.recordsWithoutKg })}</Text>
                ) : null}
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.source', { source: stats.source })}</Text>
              </Card>
              {stats.series.length === 0 ? <EmptyState title={t('ui.aucuneSerie')} description={t('ui.aucuneProductionPourCesFiltres')} icon="stats-chart-outline" /> : (
                <View style={styles.list}>
                  {stats.series.map((row, index) => (
                    <Reveal key={row.key} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium">{row.label}</Text>
                          <Text preset="caption" color={COLORS.slateGray}>{t('ui.enregistrementSConvertibleS', { records: row.records, convertibleRecords: row.convertibleRecords })}</Text>
                        </View>
                        <Text preset="bodyMedium">{formatNumber(row.quantityKg, locale)} kg</Text>
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.xs }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
