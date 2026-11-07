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
      <AppHeader title="Mes ventes" subtitle="Annonces publiées et commandes en cours, côté vendeur." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour publier vos volumes et suivre vos ventes."
          icon="pricetag-outline"
        >
          <View style={styles.toolbar}>
            <Button label="Publier une annonce" onPress={() => router.push('/annonces/creer')} variant="primary" size="sm" icon="add" />
            <Button label="Voir le marché" onPress={() => router.push('/annonces')} variant="ghost" size="sm" icon="storefront-outline" />
          </View>

          <Card tone="ink" style={styles.summary}>
            <Text preset="overline" color={COLORS.gold}>
              Activité de vente
            </Text>
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
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  finalisées
                </Text>
              </View>
            </View>
            <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={styles.lineHeight}>
              Compteurs calculés à partir de vos annonces et commandes réelles : aucune projection n’est ajoutée.
            </Text>
          </Card>

          <Text preset="overline" color={COLORS.forestGreen}>
            Mes annonces
          </Text>
          {listings.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : listings.isError ? (
            <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
          ) : announcements.length === 0 ? (
            <EmptyState
              title="Aucune annonce"
              description="Publiez un volume disponible pour être contacté par des acheteurs."
              icon="pricetag-outline"
              action={{ label: 'Publier une annonce', onPress: () => router.push('/annonces/creer') }}
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
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatNumber(item.quantity, locale, 1)} {item.unit} · {item.countryCode} · publiée le{' '}
                          {formatDate(item.createdAt, locale)}
                        </Text>
                      </View>
                      <Chip
                        label={item.status}
                        tone={item.status === 'PUBLISHED' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    <View style={styles.foot}>
                      <Text preset="bodyMedium" color={COLORS.forestGreen}>
                        {item.indicativePrice !== null ? formatCurrency(item.indicativePrice, item.currency, locale) : 'Prix non communiqué'}
                      </Text>
                      <Button label="Ouvrir" onPress={() => router.push(`/annonces/${item.id}` as never)} variant="outline" size="sm" />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Commandes
          </Text>
          {orders.isLoading ? (
            <LoadingState count={2} height={100} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : sales.length === 0 ? (
            <EmptyState title="Aucune commande" description="Les commandes naissent d'une offre acceptée." icon="receipt-outline" />
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
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatDate(order.createdAt, locale)} · paiement {order.paymentStatus}
                        </Text>
                      </View>
                      <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" />
                    </View>
                    <View style={styles.foot}>
                      <Text preset="bodyMedium" color={COLORS.forestGreen}>
                        {order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : 'Montant à confirmer'}
                      </Text>
                      <Button label="Suivre" onPress={() => router.push(`/marketplace/${order.id}` as never)} variant="outline" size="sm" icon="arrow-forward-outline" />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Card tone="pale" style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Le prix d’une commande est figé dans un instantané à la validation : les variations de marché
              ultérieures ne modifient pas une commande conclue.
            </Text>
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
