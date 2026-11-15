import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function AdminCountryDetail() {
  const { t } = useI18n();
  const { code } = useLocalSearchParams<{ code: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.countries.one(code ?? ''),
    queryFn: () => referenceApi.country(code ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(code),
    retry: false,
  });
  const country = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={country?.name ?? (code ?? '—')} subtitle={t('ui.fichePays')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.pays')} icon="globe-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !country ? <Text preset="body">{t('ui.paysIntrouvable')}</Text> : (
            <Card tone="white" style={styles.card}>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.code')}</Text>
                <Text preset="bodyMedium">{country.code}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.nom')}</Text>
                <Text preset="bodySm">{country.name}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.deviseParDefaut')}</Text>
                <Chip label={country.defaultCurrency} tone="neutral" size="sm" />
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, field: { gap: 4 } });
