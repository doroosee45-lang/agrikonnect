import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { cooperativeApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Fiche coopérative.
 *
 * Le backend n'expose que la coopérative de l'organisation active
 * (`GET /cooperatives/current`) : le slug de l'URL sert d'ancre de navigation,
 * mais la donnée affichée est bien celle de la coopérative courante.
 */
export default function CooperativeDetail() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const cooperative = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={cooperative?.organization?.name ?? 'Coopérative'} subtitle="Fiche de la coopérative active." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Coopérative" icon="people-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !cooperative ? <Text preset="body">Aucune coopérative rattachée à votre organisation.</Text> : (
            <Card tone="white" style={styles.card}>
              <Text preset="h3">{cooperative.organization?.name ?? 'Coopérative'}</Text>
              <View style={styles.chips}>
                {cooperative.province ? <Chip label={cooperative.province} tone="neutral" size="sm" /> : null}
                {cooperative.territory ? <Chip label={cooperative.territory} tone="neutral" size="sm" /> : null}
              </View>
              <Text preset="bodySm" color={COLORS.slateGray}>Statut juridique : {cooperative.legalStatus ?? 'non renseigné'}</Text>
              <Text preset="bodySm" color={COLORS.slateGray}>Année de création : {cooperative.foundedYear ?? 'non renseignée'}</Text>
              {cooperative.description ? <Text preset="bodySm">{cooperative.description}</Text> : null}
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' } });
