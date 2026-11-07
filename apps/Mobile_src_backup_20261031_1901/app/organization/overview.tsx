import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const SHORTCUTS = [
  { href: '/organization/profile', label: 'Profil', hint: 'Identité de l\u2019organisation', icon: 'business-outline' },
  { href: '/organization/members', label: 'Membres', hint: 'Accès et rôles', icon: 'people-outline' },
  { href: '/organization/farms', label: 'Exploitations', hint: 'Sites rattachés', icon: 'home-outline' },
  { href: '/organization/orders', label: 'Commandes', hint: 'Ventes et achats', icon: 'receipt-outline' },
  { href: '/organization/offers', label: 'Offres', hint: 'Offres groupées', icon: 'pricetag-outline' },
  { href: '/organization/production-summary', label: 'Production', hint: 'Volumes consolidés', icon: 'stats-chart-outline' },
  { href: '/organization/transport', label: 'Transport', hint: 'Logistique', icon: 'car-outline' },
  { href: '/organization/verification', label: 'Vérification', hint: 'Niveau de preuve', icon: 'shield-checkmark-outline' },
  { href: '/organization/invitations', label: 'Invitations', hint: 'Membres en attente', icon: 'mail-outline' },
  { href: '/organization/member-import', label: 'Import', hint: 'Ajout en masse', icon: 'cloud-upload-outline' },
] as const;

export default function OrganizationOverview() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const organizationId = me.data?.activeOrganizationId ?? null;
  const org = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });
  const counts = me.data?.counts;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Organisation" subtitle="Pilotage de votre organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Organisation" icon="business-outline">
          {me.isLoading ? <LoadingState count={2} height={110} /> : me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : !organizationId ? (
            <Card tone="pale">
              <Text preset="bodySm" color={COLORS.slateGray}>Aucune organisation active sur ce compte.</Text>
              <Button label="Créer une organisation" variant="primary" onPress={() => router.push('/organization/create')} style={styles.mt} />
            </Card>
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="h3">{me.data?.user.organizations.find((o) => o.id === organizationId)?.name ?? 'Organisation active'}</Text>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text preset="numeric">{counts?.farms ?? 0}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>exploitations</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text preset="numeric">{counts?.plots ?? 0}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>parcelles</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text preset="numeric">{counts?.productions ?? 0}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>productions</Text>
                  </View>
                </View>
                <Text preset="caption" color={COLORS.slateGray}>Complétude du profil : {me.data?.completeness.percent ?? 0} %</Text>
              </Card>
              <View style={styles.grid}>
                {SHORTCUTS.map((item, index) => (
                  <Reveal key={item.href} index={index} variant="up">
                    <PressableCard onPress={() => router.push(item.href as never)}>
                      <Text preset="bodyMedium">{item.label}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{item.hint}</Text>
                    </PressableCard>
                  </Reveal>
                ))}
              </View>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, mt: { marginTop: SPACING.sm }, stats: { flexDirection: 'row', gap: SPACING.lg }, stat: { gap: 2 }, grid: { gap: SPACING.sm } });
