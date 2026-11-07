import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { insightsApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * INS-01 — indicateurs agrégés.
 *
 * Le backend n'agrège qu'au niveau pays : la région figure dans l'URL et dans le
 * titre, mais les chiffres affichés restent ceux du pays. Un indicateur `null`
 * signifie « non publiable » (groupe trop petit) et n'est jamais remplacé par 0.
 */
export default function InsightsRegion() {
  const { country, region } = useLocalSearchParams<{ country: string; region: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const countryCode = (country ?? '').toUpperCase();
  const query = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode }),
    queryFn: () => insightsApi.overview({ countryCode }).then((r) => r.data),
    enabled: isAuthenticated && countryCode.length > 0,
    retry: false,
  });
  const overview = query.data;
  const entries = Object.entries(overview?.indicators ?? {});
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={`${countryCode || '—'}${region ? ` · ${region}` : ''}`} subtitle="Indicateurs agrégés (niveau pays)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Indicateurs" icon="stats-chart-outline">
          {query.isLoading ? <LoadingState count={2} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !overview ? <Text preset="body">Données indisponibles.</Text> : (
            <>
              {overview.disclosure.empty || overview.disclosure.message ? (
                <Card tone="pale">
                  <Text preset="caption" color={COLORS.warning}>
                    {overview.disclosure.message ?? `Seuil minimal de ${overview.disclosure.minGroupSize} producteurs non atteint : certaines valeurs ne sont pas publiées.`}
                  </Text>
                </Card>
              ) : null}
              <Card tone="white" style={styles.card}>
                {entries.length === 0 ? <Text preset="bodySm" color={COLORS.slateGray}>Aucun indicateur publiable.</Text> : entries.map(([key, indicator]) => (
                  <View key={key} style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>{key}</Text>
                    <Text preset="bodyMedium">
                      {indicator.value !== null ? `${formatNumber(indicator.value, locale)}${indicator.unit ? ` ${indicator.unit}` : ''}` : 'non publiable'}
                    </Text>
                    {indicator.reason ? <Text preset="caption" color={COLORS.slateGray}>{indicator.reason}</Text> : null}
                  </View>
                ))}
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
