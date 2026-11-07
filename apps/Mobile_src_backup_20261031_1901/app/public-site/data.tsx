import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * SOIL-16 — statistiques agrégées publiques.
 *
 * La règle de k-anonymat est appliquée côté serveur : un groupe sous le seuil est
 * supprimé (`suppressedGroups`) et les paramètres retenus sont marqués
 * `published: false`. Rien n'est arrondi ni complété côté client.
 */
export default function PublicSiteData() {
  const { locale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.public.soilStats({}),
    queryFn: () => publicApi.soilStats({}).then((r) => r.data),
    retry: false,
  });
  const data = query.data;
  return (
    <PublicShell active="data">
      <PageHeader index="03" eyebrow="Données" title="Statistiques publiques" subtitle="Moyennes de paramètres mesurés, groupées par pays, sans rattachement à une exploitation identifiable." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={2} height={130} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !data || data.rows.length === 0 ? (
          <EmptyState
            title="Aucune statistique publiable"
            description={`Chaque groupe de moins de ${data?.kAnonymity ?? 10} analyses est supprimé plutôt qu\u2019arrondi ou complété.`}
            icon="stats-chart-outline"
          />
        ) : (
          <>
            <Card tone="pale">
              <Text preset="caption" color={COLORS.slateGray}>
                Seuil de k-anonymat : {data.kAnonymity} analyses. Méthode : {data.provenance.method}. Règle : {data.provenance.rule}
              </Text>
            </Card>
            <View style={styles.list}>
              {data.rows.map((row, index) => (
                <Reveal key={row.countryCode} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.row}>
                      <Text preset="h3">{row.countryCode}</Text>
                      <Chip label={`${row.assessments} analyses`} tone="neutral" size="sm" />
                    </View>
                    {row.parameters.filter((p) => p.published).map((parameter) => (
                      <View key={parameter.parameter} style={styles.param}>
                        <Text preset="bodySm">{parameter.parameter}</Text>
                        <Text preset="bodySm">{formatNumber(parameter.mean, locale, 1)} ({parameter.samples} échantillons)</Text>
                      </View>
                    ))}
                    {row.withheldParameters.length > 0 ? (
                      <Text preset="caption" color={COLORS.warning}>
                        Paramètres non publiés (groupe trop petit) : {row.withheldParameters.join(', ')}
                      </Text>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
            {data.suppressedGroups.length > 0 ? (
              <Card tone="pale">
                <Text preset="caption" color={COLORS.warning}>
                  {data.suppressedGroups.length} groupe(s) supprimé(s) : {data.suppressedGroups.map((g) => `${g.countryCode} (${g.reason})`).join(' · ')}
                </Text>
              </Card>
            ) : null}
          </>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, card: { gap: SPACING.xs }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, param: { flexDirection: 'row', justifyContent: 'space-between' } });
