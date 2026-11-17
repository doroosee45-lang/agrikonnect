import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  MobileHorizonTrackCard,
  Screen,
  Section,
} from '@/components/ui';
import type { MobileHorizonTrack } from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const FILTERS = [
  { key: '', get label() { return tr('ui.toutes'); } },
  { key: 'PENDING', get label() { return tr('ui.enAttente'); } },
  { key: 'CONFIRMED', get label() { return tr('ui.confirmees'); } },
  { key: 'DELIVERED', get label() { return tr('ui.livrees'); } },
  { key: 'CANCELLED', get label() { return tr('ui.annulees'); } },
] as const;

/** Espace Marche & Commandes Mobile (/marketplace) — Design Horizon 100 % API reelle. */
export default function Marketplace() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [status, setStatus] = useState('');

  const orders = useQuery({
    queryKey: queryKeys.orders.list({ status, limit: 50 }),
    queryFn: () => orderApi.list({ status: status || undefined, limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = orders.data ?? [];
  const delivered = items.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const inProgress = items.filter((o) => o.status === 'CONFIRMED' || o.status === 'SHIPPED');
  const pending = items.filter((o) => o.status === 'PENDING');
  const cancelled = items.filter((o) => o.status === 'CANCELLED' || o.status === 'DISPUTED');

  const tracks: MobileHorizonTrack[] = useMemo(
    () =>
      items.slice(0, 6).map((order) => {
        const isDone = order.status === 'DELIVERED' || order.status === 'COMPLETED';
        const isErr = order.status === 'CANCELLED' || order.status === 'DISPUTED';
        return {
          id: order.id,
          code: order.number || `CMD-${order.id.slice(0, 6).toUpperCase()}`,
          subtitle:
            order.totalAmount !== null
              ? formatCurrency(order.totalAmount, order.currency, locale)
              : formatDate(order.createdAt, locale),
          statusLabel: order.status,
          tone: isDone ? 'green' : isErr ? 'red' : 'amber',
          leftCode: order.paymentStatus.slice(0, 7),
          rightCode: isDone ? t('ui.trackCodeDelivered') : t('ui.trackCodeInProgress'),
          progressPct: isDone ? 100 : isErr ? 25 : 62,
          icon: 'cube-outline',
          onPress: () => router.push(`/marketplace/orders/${order.id}` as never),
        };
      }),
    [items, locale],
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.commandesMarche')}
        subtitle={t('ui.suiviDExecutionPaiementsEtLivraisons')}
        ctaLabel={t('ui.annonces')}
        onCtaPress={() => router.push('/annonces')}
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourSuivreVosCommandes_97188')}
          icon="receipt-outline"
        >
          <View style={styles.filters}>
            <ChipRow>
              {FILTERS.map((item) => (
                <FilterChip
                  key={item.key || 'all'}
                  label={item.label}
                  active={status === item.key}
                  onPress={() => setStatus(item.key)}
                />
              ))}
            </ChipRow>
            <View style={styles.quickRow}>
              <Button
                label={t('ui.stocksMouvements_6062c')}
                onPress={() => router.push('/marketplace/inventory')}
                variant="outline"
                size="sm"
                icon="cube-outline"
              />
              <Button
                label={t('ui.demandesDAchat')}
                onPress={() => router.push('/requests')}
                variant="ghost"
                size="sm"
                icon="pricetag-outline"
              />
            </View>
          </View>

          {orders.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <>
              <MobileHorizonOverviewCard
                title={t('ui.vueDEnsembleCommerciale')}
                items={[
                  {
                    id: 'total',
                    label: t('ui.totalCommandes'),
                    value: formatNumber(items.length, locale),
                    subtitle: t('ui.surLeFiltreCourant'),
                    badge: t('ui.actives'),
                    tone: 'green',
                    icon: 'receipt-outline',
                  },
                  {
                    id: 'in-progress',
                    label: t('ui.enExecution'),
                    value: formatNumber(inProgress.length, locale),
                    subtitle: t('ui.confirmeesOuExpediees'),
                    tone: 'blue',
                    icon: 'car-outline',
                  },
                  {
                    id: 'delivered',
                    label: t('ui.livrees'),
                    value: formatNumber(delivered.length, locale),
                    subtitle: t('ui.clotureesAvecSucces'),
                    tone: 'green',
                    icon: 'checkmark-circle-outline',
                  },
                  {
                    id: 'issues',
                    label: t('ui.attenteLitiges'),
                    value: formatNumber(pending.length + cancelled.length, locale),
                    subtitle: t('ui.litigeS_4ad9b', { length: formatNumber(cancelled.length, locale) }),
                    tone: cancelled.length > 0 ? 'red' : 'amber',
                    icon: 'alert-circle-outline',
                  },
                ]}
              />

              {items.length === 0 ? (
                <EmptyState
                  title={t('ui.aucuneCommande')}
                  description={t('ui.lesCommandesPasseesSurLeMarche')}
                  icon="receipt-outline"
                  action={{ label: t('ui.parcourirLesAnnonces'), onPress: () => router.push('/annonces') }}
                />
              ) : (
                <MobileHorizonTrackCard title={t('ui.suiviDesCommandesExpeditions')} items={tracks} />
              )}

              <MobileHorizonDonutCard
                title={t('ui.statutDesCommandes')}
                totalValue={formatNumber(items.length, locale)}
                totalLabel={t('ui.commandes')}
                segments={[
                  { label: t('ui.livrees'), value: delivered.length, tone: 'green' },
                  { label: t('ui.enCours_bc9b5'), value: inProgress.length, tone: 'blue' },
                  { label: t('ui.enAttente'), value: pending.length, tone: 'amber' },
                  { label: t('ui.annuleesLitiges'), value: cancelled.length, tone: 'red' },
                ]}
              />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  filters: { gap: SPACING.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
