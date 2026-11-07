import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { farmApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerFarmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.farms.one(id ?? ''),
    queryFn: () => farmApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const farm = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={farm?.name ?? '—'} subtitle="Fiche de l'exploitation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Exploitation" icon="home-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !farm ? <Text preset="body">Exploitation introuvable.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Nom</Text>
                  <Text preset="bodyMedium">{farm.name}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Pays</Text>
                  <Text preset="bodySm">{farm.countryCode}{farm.province ? ` · ${farm.province}` : ''}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Surface</Text>
                  <Text preset="bodySm">{farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—'}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Publication</Text>
                  <Chip label={farm.isPublic ? 'publique' : 'privée'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Mise à jour</Text>
                  <Text preset="bodySm">{formatDate(farm.updatedAt, locale)}</Text>
                </View>
              </Card>
              <Button label="Voir les parcelles" variant="outline" onPress={() => {}} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
