import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { router } from 'expo-router';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** PROF-01 — aperçu du profil : complétude, compteurs et vérifications en attente. */
export default function PublicSiteProfil() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const me = query.data;
  return (
    <PublicShell active="profil" heroCarousel={false}>
      <PageHeader index="14" eyebrow="Profil" title="Mon profil" subtitle="Complétude, compteurs et éléments manquants." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Mon profil" icon="person-outline" description="Connectez-vous pour consulter et compléter votre profil.">
          {query.isLoading ? <LoadingState count={2} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !me ? null : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="h2">{me.user.firstName} {me.user.lastName}</Text>
                <View style={styles.chips}>
                  <Chip label={me.user.countryCode} tone="neutral" size="sm" />
                  <Chip label={me.user.emailVerified ? 'email vérifié' : 'email non vérifié'} tone={me.user.emailVerified ? 'success' : 'warning'} size="sm" />
                  <Chip label={me.user.phoneVerified ? 'téléphone vérifié' : 'téléphone non vérifié'} tone={me.user.phoneVerified ? 'success' : 'warning'} size="sm" />
                </View>
                <Text preset="bodySm" color={COLORS.slateGray}>Complétude : {me.completeness.percent} % ({me.completeness.done}/{me.completeness.total} critères)</Text>
                {me.completeness.missing.length > 0 ? (
                  <Text preset="caption" color={COLORS.warning}>Manquant : {me.completeness.missing.join(', ')}</Text>
                ) : null}
              </Card>
              <Card tone="white" style={styles.card}>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text preset="numeric">{me.counts.farms}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>exploitations</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text preset="numeric">{me.counts.plots}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>parcelles</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text preset="numeric">{me.counts.productions}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>productions</Text>
                  </View>
                </View>
              </Card>
              <Button label="Compléter mon profil" variant="primary" onPress={() => router.push('/farmer/profile')} />
              <Button label="Ma fiche publique" variant="outline" onPress={() => router.push('/farmer/public-profile')} />
            </>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, stats: { flexDirection: 'row', gap: SPACING.lg }, stat: { gap: 2 } });
