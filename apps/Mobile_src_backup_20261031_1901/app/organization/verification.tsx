import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Vérifications de l'organisation : une donnée déclarée n'est jamais présentée comme vérifiée. */
export default function OrganizationVerification() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.verifications.mine,
    queryFn: () => verificationApi.mine().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Vérification" subtitle="Niveau de preuve de votre organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Vérification" icon="shield-checkmark-outline">
          {query.isLoading ? <LoadingState count={2} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune vérification" description="Aucune demande de vérification enregistrée." icon="shield-checkmark-outline" /> : (
            <View style={styles.list}>
              {items.map((verification, index) => (
                <Reveal key={verification.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.field}>
                      <Text preset="caption" color={COLORS.slateGray}>Objet</Text>
                      <Text preset="bodyMedium">{verification.subjectType}</Text>
                    </View>
                    <View style={styles.field}>
                      <Text preset="caption" color={COLORS.slateGray}>Niveau</Text>
                      <Text preset="bodySm">{verification.level}</Text>
                    </View>
                    <View style={styles.field}>
                      <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                      <Chip label={verification.status} tone={verification.status === 'APPROVED' ? 'success' : verification.status === 'REJECTED' ? 'error' : 'neutral'} size="sm" />
                    </View>
                    <View style={styles.field}>
                      <Text preset="caption" color={COLORS.slateGray}>Examiné le</Text>
                      <Text preset="bodySm">{verification.reviewedAt ? formatDate(verification.reviewedAt, locale) : 'en attente'}</Text>
                    </View>
                    {verification.reason ? <Text preset="caption" color={COLORS.slateGray}>Motif : {verification.reason}</Text> : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, card: { gap: SPACING.sm }, field: { gap: 4 } });
