import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { certificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerCertifications() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.certifications.all,
    queryFn: () => certificationApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Certifications" subtitle="Certifications rattachées à vos exploitations." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Certifications" icon="ribbon-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune certification" description="Aucune certification enregistrée. La mention « certifié » reste désactivée tant qu'aucun certificat validé n'est joint." icon="ribbon-outline" /> : (
            <View style={styles.list}>
              {items.map((certification, index) => (
                <Reveal key={certification.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{certification.type}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {certification.reference ?? '—'} · {certification.issuer}
                        {certification.expiresAt ? ` · expire le ${formatDate(certification.expiresAt, locale)}` : ''}
                      </Text>
                    </View>
                    <Chip label={certification.status} tone={certification.status === 'VALIDATED' ? 'success' : certification.status === 'EXPIRED' ? 'error' : 'warning'} size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
