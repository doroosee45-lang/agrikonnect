import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency } from '@/lib/format';
import { listingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Marketplace — les annonces ne font pas partie de la surface anonyme (`/public/*`). */
export default function PublicSiteAnnonces() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.listings.list({ limit: 100 }),
    queryFn: () => listingApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <PublicShell active="annonces">
      <PageHeader index="09" eyebrow={t('ui.marketplace')} title={t('ui.annonces')} subtitle={t('ui.offresEtDemandesPublieesParLes')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.annonces')} icon="megaphone-outline" description={t('ui.laMarketplaceExigeUnCompteLes')}>
          <Button label={t('ui.publierUneAnnonce')} variant="primary" onPress={() => router.push('/public-site/annonces/creer')} />
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title={t('ui.aucuneAnnonce')} description={t('ui.aucuneAnnoncePublieePourLeMoment')} icon="megaphone-outline" /> : (
            <View style={styles.list}>
              {items.map((listing, index) => (
                <Reveal key={listing.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/public-site/annonces/${listing.id}` as never)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{listing.title}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {listing.quantity} {listing.unit}{listing.province ? ` · ${listing.province}` : ''} · {listing.countryCode}
                        </Text>
                      </View>
                      <View style={styles.right}>
                        <Text preset="bodySm">{listing.indicativePrice !== null ? formatCurrency(listing.indicativePrice, listing.currency, locale) : t('ui.surDemande')}</Text>
                        <Chip label={listing.type} tone={listing.type === 'OFFER' ? 'success' : 'info'} size="sm" />
                      </View>
                    </View>
                  </PressableCard>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, right: { alignItems: 'flex-end', gap: 4 } });
