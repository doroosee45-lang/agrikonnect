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
      <FarmerHeader title={plot?.name ?? '—'} subtitle="Fiche parcelle." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Parcelle" icon="map-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !plot ? <Text preset="body">Parcelle introuvable.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Surface</Text>
                  <Text preset="bodyMedium">{plot.areaHa !== null ? `${plot.areaHa} ha` : 'non renseignée'}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Culture courante</Text>
                  <Text preset="bodySm">{plot.currentCrop?.names?.[locale] ?? plot.currentCropId ?? 'aucune'}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                  <Chip label={plot.status} tone="neutral" size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Mise à jour</Text>
                  <Text preset="bodySm">{formatDate(plot.updatedAt, locale)}</Text>
                </View>
              </Card>
              <Button label="Analyses de sol" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/soil`)} />
              <Button label="Zones de gestion" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/zones`)} />
              <Button label="Plan de culture" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/plan`)} />
              <Button label="Rotation" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/rotation`)} />
              <Button label="Satellite" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/satellite`)} />
              <Button label="Capteurs" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/sensors`)} />
              <Button label="Rapport de précision" variant="outline" onPress={() => router.push(`/farmer/plots/${id}/precision-report`)} />
              <Button label="Recommandations" variant="ghost" onPress={() => router.push(`/farmer/plots/${id}/recommendations`)} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
