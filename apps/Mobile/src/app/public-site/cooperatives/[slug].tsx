import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteCooperativeDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.public.farm(slug ?? ''),
    queryFn: () => publicApi.farm(slug ?? '').then((r) => r.data),
    retry: false,
  });
  const farm = query.data?.farm;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={farm?.name ?? '—'} subtitle="Fiche coopérative publique." />
      <Section bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !farm ? <Text preset="body">Coopérative introuvable.</Text> : (
          <Card tone="white" style={styles.card}>
            <Text preset="h3">{farm.name}</Text>
            <View style={styles.chips}>
              <Chip label={farm.countryCode} tone="neutral" size="sm" />
            </View>
            <Text preset="bodySm" color={COLORS.slateGray}>Surface : {farm.totalAreaHa ? `${farm.totalAreaHa} ha` : '—'}</Text>
          </Card>
        )}
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' } });
