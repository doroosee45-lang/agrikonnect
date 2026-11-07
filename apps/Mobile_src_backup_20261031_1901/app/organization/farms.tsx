import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { farmApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Exploitations rattachées à l'organisation active. */
export default function OrganizationFarms() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.farms.list({ limit: 100 }),
    queryFn: () => farmApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Exploitations" subtitle="Sites rattachés à votre organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Exploitations" icon="home-outline">
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune exploitation" description="Créez une exploitation pour démarrer." icon="home-outline" /> : (
            <View style={styles.list}>
              {items.map((farm, index) => (
                <Reveal key={farm.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/farmer/farms/${farm.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{farm.name}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{farm.countryCode}{farm.province ? ` · ${farm.province}` : ''}{farm.totalAreaHa !== null ? ` · ${farm.totalAreaHa} ha` : ''}</Text>
                      </View>
                      <View style={styles.right}>
                        <Chip label={farm.isPublic ? 'publiée' : 'privée'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" />
                        {farm.verificationStatus ? <Chip label={farm.verificationStatus} tone="neutral" size="sm" /> : null}
                      </View>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, right: { alignItems: 'flex-end', gap: 4 } });
