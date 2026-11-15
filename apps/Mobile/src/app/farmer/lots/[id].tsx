import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { lotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerLotDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.lots.one(id ?? ''),
    queryFn: () => lotApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const lot = query.data as Record<string, unknown> | undefined;
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={String(lot?.code ?? '—')} subtitle={t('ui.ficheDeTracabiliteDuLot')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.lot')} icon="pricetag-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !lot ? <Text preset="body">{t('ui.lotIntrouvable_704a3')}</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.code')}</Text>
                  <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>{String(lot.code ?? '—')}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.statut')}</Text>
                  <Chip label={String(lot.status ?? '—')} tone="neutral" size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.creeLe')}</Text>
                  <Text preset="bodySm">{lot.createdAt ? formatDate(String(lot.createdAt), locale) : '—'}</Text>
                </View>
              </Card>
              <Button label={t('ui.qrCode')} variant="outline" onPress={() => {}} />
              <Button label={t('ui.fichePublique')} variant="ghost" onPress={() => {}} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
