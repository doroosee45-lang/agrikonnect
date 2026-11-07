import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { authApi, farmApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerPublicProfile() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const farms = useQuery({ queryKey: queryKeys.farms.list({ limit: 50 }), queryFn: () => farmApi.list({ limit: 50 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const published = farms.data?.filter((f) => f.isPublic) ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Ma fiche publique" subtitle="Ce que les visiteurs voient." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Fiche publique" icon="globe-outline">
          {me.isLoading || farms.isLoading ? <LoadingState count={2} height={110} /> : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="h3">{me.data?.user.firstName} {me.data?.user.lastName}</Text>
                <View style={styles.chips}>
                  <Chip label={me.data?.user.countryCode ?? '—'} tone="neutral" size="sm" />
                </View>
              </Card>
              <Text preset="h3" style={styles.mb}>Exploitations publiées</Text>
              {published.length === 0 ? (
                <Card tone="pale">
                  <Text preset="bodySm" color={COLORS.slateGray}>Aucune exploitation publiée.</Text>
                </Card>
              ) : (
                <View style={styles.list}>
                  {published.map((farm) => (
                    <Card key={farm.id} tone="white">
                      <Text preset="bodyMedium">{farm.name}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{farm.countryCode}</Text>
                    </Card>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs }, mb: { marginBottom: SPACING.sm }, list: { gap: SPACING.sm } });
