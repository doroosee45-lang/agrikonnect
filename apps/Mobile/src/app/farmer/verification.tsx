import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerVerification() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.verifications.mine,
    queryFn: () => verificationApi.mine().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const verifications = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Vérification" subtitle="Statut de vérification de votre exploitation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Vérification" icon="shield-checkmark-outline">
          {query.isLoading ? <LoadingState count={2} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : verifications.length === 0 ? (
            <Card tone="pale">
              <Text preset="bodySm" color={COLORS.slateGray}>Aucune demande de vérification en cours.</Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {verifications.map((verification, index) => (
                <Card key={String(verification.id ?? index)} tone="white" style={styles.card}>
                  <View style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>Niveau</Text>
                    <Text preset="bodySm">{verification.level}</Text>
                  </View>
                  <View style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                    <Chip label={verification.status} tone={verification.status === 'APPROVED' ? 'success' : 'neutral'} size="sm" />
                  </View>
                  <View style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>Mis à jour</Text>
                    <Text preset="bodySm">{verification.reviewedAt ? formatDate(verification.reviewedAt, locale) : '—'}</Text>
                  </View>
                  {verification.reason ? <Text preset="caption" color={COLORS.slateGray}>Motif : {verification.reason}</Text> : null}
                </Card>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, card: { gap: SPACING.sm }, field: { gap: 4 } });
