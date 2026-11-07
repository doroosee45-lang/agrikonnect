import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Marketplace() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const orders = useQuery({
    queryKey: queryKeys.orders.list({ limit: 30 }),
    queryFn: () => orderApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = orders.data ?? [];

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Mes commandes"
        description="Connectez-vous pour suivre vos commandes, paiements et litiges."
        icon="🧾"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Commandes
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Chaque commande fige un instantané de prix et de quantités : les variations ultérieures du marché ne la modifient pas.
          </Text>
        </div>

        {orders.isLoading ? (
          <LoadingState count={3} height={100} />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="Aucune commande" description="Les commandes naissent d'une offre acceptée." icon="🧾" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white" hover style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                        {order.number}
                      </Text>
                      <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" />
                      <Chip label={`Paiement : ${order.paymentStatus}`} tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" />
                    </div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {formatDate(order.createdAt, locale)}
                      {order.totalAmount !== null ? ` · ${formatCurrency(order.totalAmount, order.currency, locale)}` : ' · montant à confirmer'}
                    </Text>
                  </div>
                  <Link to={`/marketplace/${order.id}`}>
                    <Button label="Suivre" variant="outline" size="sm" />
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
