import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.organizations.one(id ?? ''),
    queryFn: () => organizationApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const org = query.data as Record<string, unknown> | undefined;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={String(org?.name ?? '—')} subtitle="Fiche organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Organisation" icon="business-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !org ? <Text preset="body">Organisation introuvable.</Text> : (
            <Card tone="white" style={styles.card}>
              <Text preset="h3">{String(org.name ?? '—')}</Text>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Type</Text>
                <Text preset="bodySm">{String(org.type ?? '—')}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                <Chip label={String(org.status ?? '—')} tone="neutral" size="sm" />
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Pays</Text>
                <Text preset="bodySm">{String(org.countryCode ?? '—')}</Text>
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, field: { gap: 4 } });
