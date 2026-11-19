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
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const farms = useQuery({ queryKey: queryKeys.farms.list({ limit: 50 }), queryFn: () => farmApi.list({ limit: 50 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const published = farms.data?.filter((f) => f.isPublic) ?? [];
  const professional = me.data?.user.professionalProfile;
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.maFichePublique')} subtitle={t('ui.ceQueLesVisiteursVoient')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.fichePublique')} icon="globe-outline">
          {me.isLoading || farms.isLoading ? <LoadingState count={2} height={110} /> : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="h3">{me.data?.user.firstName} {me.data?.user.lastName}</Text>
                <View style={styles.chips}>
                  <Chip label={me.data?.user.countryCode ?? '—'} tone="neutral" size="sm" />
                  <Chip label={professional?.publicProfile ? 'Profil public' : 'Profil privé'} tone={professional?.publicProfile ? 'success' : 'warning'} size="sm" />
                </View>
                {professional?.publicProfile && professional.jobTitle ? <Text preset="bodyMedium">{professional.jobTitle}</Text> : null}
                {professional?.publicProfile && professional.biography ? (
                  <Text preset="caption" color={COLORS.slateGray}>{professional.biography}</Text>
                ) : null}
                {professional?.publicProfile && (professional.services?.length ?? 0) > 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>Services : {professional.services?.join(', ')}</Text>
                ) : null}
                <Text preset="caption" color={COLORS.slateGray}>Les coordonnées privées ne sont pas affichées.</Text>
              </Card>
              <Text preset="h3" style={styles.mb}>{t('ui.exploitationsPubliees')}</Text>
              {published.length === 0 ? (
                <Card tone="pale">
                  <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.aucuneExploitationPubliee_3f768')}</Text>
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
