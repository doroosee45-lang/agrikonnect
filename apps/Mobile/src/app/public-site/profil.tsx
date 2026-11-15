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
import { useI18n } from '@/i18n';

/** PROF-01 — aperçu du profil : complétude, compteurs et vérifications en attente. */
export default function PublicSiteProfil() {
  const { t } = useI18n();
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
      <PageHeader index="14" eyebrow={t('ui.profil')} title={t('ui.monProfil')} subtitle={t('ui.completudeCompteursEtElementsManquants')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="person-outline" description={t('ui.connectezVousPourConsulterEtCompleter')}>
          {query.isLoading ? <LoadingState count={2} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !me ? null : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="h2">{me.user.firstName} {me.user.lastName}</Text>
                <View style={styles.chips}>
                  <Chip label={me.user.countryCode} tone="neutral" size="sm" />
                  <Chip label={me.user.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me.user.emailVerified ? 'success' : 'warning'} size="sm" />
                  <Chip label={me.user.phoneVerified ? t('ui.telephoneVerifie_4fdf8') : t('ui.telephoneNonVerifie')} tone={me.user.phoneVerified ? 'success' : 'warning'} size="sm" />
                </View>
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.completudeCriteres', { percent: me.completeness.percent, done: me.completeness.done, total: me.completeness.total })}</Text>
                {me.completeness.missing.length > 0 ? (
                  <Text preset="caption" color={COLORS.warning}>{t('ui.manquant_45da8', { value: me.completeness.missing.join(', ') })}</Text>
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
              <Button label={t('ui.completerMonProfil')} variant="primary" onPress={() => router.push('/farmer/profile')} />
              <Button label={t('ui.maFichePublique')} variant="outline" onPress={() => router.push('/farmer/public-profile')} />
            </>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, stats: { flexDirection: 'row', gap: SPACING.lg }, stat: { gap: 2 } });
