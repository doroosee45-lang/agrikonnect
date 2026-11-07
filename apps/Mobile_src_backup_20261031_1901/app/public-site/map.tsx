import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteMap() {
  const { locale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.public.map({ locale }),
    queryFn: () => publicApi.map({ locale }).then((r) => r.data),
    retry: false,
  });
  const features = query.data?.features ?? [];
  return (
    <PublicShell active="explore">
      <Section index={6} eyebrow="Carte" title="Carte des exploitations" subtitle="Exploitations agricoles publiées et données agrégées." background={COLORS.naturalWhite} contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={2} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (
          <Card tone="white" style={styles.card}>
            <Text preset="h3">{query.data?.meta?.count ?? 0} exploitations</Text>
            <Text preset="caption" color={COLORS.slateGray}>{query.data?.meta?.note ?? 'Données agrégées'}</Text>
            {features.length > 0 ? (
              <View style={styles.list}>
                {features.slice(0, 5).map((feature, index) => (
                  <Card key={index} tone="pale">
                    <Text preset="bodySm">{String(feature.properties?.name ?? '—')}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>{String(feature.properties?.countryCode ?? '—')}</Text>
                  </Card>
                ))}
              </View>
            ) : null}
          </Card>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, list: { gap: SPACING.xs, marginTop: SPACING.sm } });
