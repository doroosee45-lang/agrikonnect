import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** ADMIN — référentiel pays (devises, langues, fuseaux) exposé par le backend. */
export default function AdminCountries() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.countries.all,
    queryFn: () => referenceApi.countries().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Pays" subtitle="Référentiel pays, devises et langues." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Pays" icon="globe-outline">
          {query.isLoading ? <LoadingState count={4} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun pays" description="Le référentiel est vide." icon="globe-outline" /> : (
            <View style={styles.list}>
              {items.map((country, index) => (
                <Reveal key={country.code} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/admin/countries/${country.code}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{country.name}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{country.defaultCurrency} · {country.locales.join(', ')}</Text>
                      </View>
                      <Chip label={country.status} tone="neutral" size="sm" />
                    </View>
                  </PressableCard>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
