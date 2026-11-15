import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerPlotDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.plots.one(id ?? ''),
    queryFn: () => plotApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const plot = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={plot?.name ?? '—'} subtitle={t('ui.ficheParcelle')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.parcelle')} icon="map-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !plot ? <Text preset="body">{t('ui.parcelleIntrouvable')}</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.surface')}</Text>
                  <Text preset="bodyMedium">{plot.areaHa !== null ? `${plot.areaHa} ha` : t('ui.nonRenseignee')}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.cultureCourante')}</Text>
                  <Text preset="bodySm">{plot.currentCrop?.names?.[locale] ?? plot.currentCropId ?? 'aucune'}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.statut')}</Text>
                  <Chip label={plot.status} tone="neutral" size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.miseAJour')}</Text>
                  <Text preset="bodySm">{formatDate(plot.updatedAt, locale)}</Text>
                </View>
              </Card>
              <Button label={t('ui.analysesDeSol')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/soil`)} />
              <Button label={t('ui.zonesDeGestion')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/zones`)} />
              <Button label={t('ui.planDeCulture')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/plan`)} />
              <Button label={t('ui.rotation')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/rotation`)} />
              <Button label={t('ui.satellite_d1ffe')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/satellite`)} />
              <Button label={t('ui.capteurs')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/sensors`)} />
              <Button label={t('ui.rapportDePrecision')} variant="outline" onPress={() => router.push(`/farmer/plots/${id}/precision-report`)} />
              <Button label={t('ui.recommandations')} variant="ghost" onPress={() => router.push(`/farmer/plots/${id}/recommendations`)} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
