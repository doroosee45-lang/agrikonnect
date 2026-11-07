import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { aiApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AiAnalysisDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.ai.one(id ?? ''),
    queryFn: () => aiApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const analysis = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Analyse" subtitle="Détail de l'analyse." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Analyse" icon="sparkles-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !analysis ? <Text preset="body">Analyse introuvable.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Type</Text>
                  <Chip label={analysis.type} tone="neutral" size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                  <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Créée le</Text>
                  <Text preset="bodySm">{formatDate(analysis.createdAt, locale)}</Text>
                </View>
                {analysis.escalatedAt ? (
                  <View style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>Escaladée le</Text>
                    <Text preset="bodySm">{formatDate(analysis.escalatedAt, locale)}</Text>
                  </View>
                ) : null}
              </Card>
              <Card tone="white" style={styles.card}>
                <Text preset="caption" color={COLORS.slateGray} style={styles.mb}>Question</Text>
                <Text preset="bodySm" style={styles.lineHeight}>{analysis.prompt}</Text>
              </Card>
              <Card tone="pale">
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  {analysis.disclaimer ?? 'Cette réponse est générée par une IA. Elle ne constitue pas un avis agronomique et ne remplace pas un contrôle de terrain.'}
                </Text>
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 }, mb: { marginBottom: SPACING.xs }, lineHeight: { lineHeight: 20 } });
