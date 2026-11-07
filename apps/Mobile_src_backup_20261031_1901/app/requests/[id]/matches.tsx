import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency } from '@/lib/format';
import { requestApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Offres correspondant à une demande d'achat.
 *
 * Le backend renvoie des annonces (`Listing[]`) : il ne calcule ni score de
 * correspondance ni nom d'organisation côté liste, donc aucun pourcentage n'est
 * affiché — seule la donnée réellement renvoyée l'est.
 */
export default function RequestMatches() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.requests.matches(id ?? ''),
    queryFn: () => requestApi.matches(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Correspondances" subtitle="Annonces correspondant à votre demande." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Correspondances" icon="git-compare-outline">
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune correspondance" description="Aucune annonce ne correspond actuellement à votre demande." icon="search-outline" /> : (
            <View style={styles.list}>
              {items.map((listing, index) => (
                <Reveal key={listing.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{listing.title}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {listing.organization?.name ?? 'organisation non renseignée'} · {listing.countryCode}
                        {listing.province ? ` · ${listing.province}` : ''} · {listing.quantity} {listing.unit}
                      </Text>
                    </View>
                    <View style={styles.right}>
                      {listing.indicativePrice !== null ? (
                        <Text preset="bodySm">{formatCurrency(listing.indicativePrice, listing.currency, locale)}</Text>
                      ) : (
                        <Text preset="caption" color={COLORS.slateGray}>prix sur demande</Text>
                      )}
                      <Chip label={listing.status} tone="neutral" size="sm" />
                    </View>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, right: { alignItems: 'flex-end', gap: 4 } });
