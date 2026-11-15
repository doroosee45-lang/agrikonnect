import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { listingApi, orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Ventes : mes annonces et mes commandes, côté vendeur. */
export default function Ventes() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const listings = useQuery({
    queryKey: queryKeys.listings.list({ limit: 30 }),
    queryFn: () => listingApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const orders = useQuery({
    queryKey: queryKeys.orders.list({ limit: 30 }),
    queryFn: () => orderApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const announcements = listings.data ?? [];
  const sales = orders.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.mesVentes')} subtitle={t('ui.annoncesPublieesEtCommandesEnCours')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourPublierVosVolumes')}
          icon="pricetag-outline"
        >
          <View style={styles.toolbar}>
            <Button label={t('ui.publierUneAnnonce')} onPress={() => router.push('/annonces/creer')} variant="primary" size="sm" icon="add" />
            <Button label={t('ui.voirLeMarche')} onPress={() => router.push('/annonces')} variant="ghost" size="sm" icon="storefront-outline" />
          </View>

          <Card tone="ink" style={styles.summary}>
            <Text preset="overline" color={COLORS.gold}>{t('ui.activiteDeVente')}</Text>
            <View style={styles.counts}>
              <View style={styles.count}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(announcements.length, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  annonces
                </Text>
              </View>
              <View style={styles.count}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(sales.length, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  commandes
                </Text>
              </View>
              <View style={styles.count}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(sales.filter((order) => order.status === 'DELIVERED' || order.status === 'COMPLETED').length, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">{t('ui.finalisees')}</Text>
              </View>
            </View>
            <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={styles.lineHeight}>{t('ui.compteursCalculesAPartirDeVos')}</Text>
          </Card>

          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.mesAnnonces')}</Text>
          {listings.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : listings.isError ? (
            <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
          ) : announcements.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneAnnonce')}
              description={t('ui.publiezUnVolumeDisponiblePourEtre')}
              icon="pricetag-outline"
              action={{ label: t('ui.publierUneAnnonce'), onPress: () => router.push('/annonces/creer') }}
            />
          ) : (
            <View style={styles.list}>
              {announcements.map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.publieeLe_1d428', { quantity: formatNumber(item.quantity, locale, 1), unit: item.unit, countryCode: item.countryCode, createdAt: formatDate(item.createdAt, locale) })}</Text>
                      </View>
                      <Chip
                        label={item.status}
                        tone={item.status === 'PUBLISHED' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    <View style={styles.foot}>
                      <Text preset="bodyMedium" color={COLORS.forestGreen}>
                        {item.indicativePrice !== null ? formatCurrency(item.indicativePrice, item.currency, locale) : t('ui.prixNonCommunique')}
                      </Text>
                      <Button label={t('ui.ouvrir')} onPress={() => router.push(`/annonces/${item.id}` as never)} variant="outline" size="sm" />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.commandes')}</Text>
          {orders.isLoading ? (
            <LoadingState count={2} height={100} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : sales.length === 0 ? (
            <EmptyState title={t('ui.aucuneCommande')} description={t('ui.lesCommandesNaissentDUneOffre')} icon="receipt-outline" />
          ) : (
            <View style={styles.list}>
              {sales.map((order, index) => (
                <Reveal key={order.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {order.number}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.paiement_70a0e', { createdAt: formatDate(order.createdAt, locale), paymentStatus: order.paymentStatus })}</Text>
                      </View>
                      <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" />
                    </View>
                    <View style={styles.foot}>
                      <Text preset="bodyMedium" color={COLORS.forestGreen}>
                        {order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : t('ui.montantAConfirmer_2c077')}
                      </Text>
                      <Button label={t('ui.suivre')} onPress={() => router.push(`/marketplace/${order.id}` as never)} variant="outline" size="sm" icon="arrow-forward-outline" />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Card tone="pale" style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.lePrixDUneCommandeEst')}</Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  toolbar: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  summary: { gap: SPACING.md },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xl },
  count: { gap: 2 },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, flexWrap: 'wrap' },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  list: { gap: SPACING.sm },
});
