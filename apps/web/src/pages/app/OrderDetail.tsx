import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
};

/** APP — détail d'une commande : statut, paiement, litige, événements. */
export default function AppOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const order = useQuery({
    queryKey: queryKeys.orders.one(id ?? ''),
    queryFn: () => orderApi.get(id ?? '').then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const events = useQuery({
    queryKey: [...queryKeys.orders.one(id ?? ''), 'events'] as unknown[],
    queryFn: () => orderApi.events(id ?? '').then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => orderApi.setStatus(id ?? '', status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.one(id ?? '') });
    },
  });

  const data = order.data;
  const nextStatus = data ? NEXT_STATUS[data.status] : undefined;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Commande" icon="📦">
        <div style={{ marginBottom: 24 }}>
          <a href="/app/orders" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux commandes
          </a>
        </div>

        {order.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : order.isError ? (
          <ErrorState error={order.error} onRetry={() => void order.refetch()} showRequestId />
        ) : !data ? (
          <Text preset="bodyMd">Commande introuvable.</Text>
        ) : (
          <>
            <Card tone="white" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <Text preset="h2" style={{ marginBottom: 4 }}>
                    {data.number}
                  </Text>
                  <Text preset="caption">{formatDate(data.createdAt, locale)}</Text>
                </div>
                <Chip label={data.status} tone={data.status === 'DISPUTED' ? 'error' : 'neutral'} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text preset="bodySm">
                  Montant : {data.totalAmount !== null ? `${data.totalAmount} ${data.currency}` : '—'}
                </Text>
                <Text preset="bodySm">
                  Paiement : <Chip label={data.paymentStatus} tone={data.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm" />
                </Text>
              </div>

              {nextStatus ? (
                <div style={{ marginTop: 16 }}>
                  <Button
                    label={`Passer à ${nextStatus}`}
                    variant="outline"
                    size="sm"
                    loading={updateStatus.isPending}
                    onClick={() => updateStatus.mutate(nextStatus)}
                  />
                </div>
              ) : null}
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Historique
              </Text>
              {events.isLoading ? (
                <LoadingState count={1} height={60} />
              ) : events.isError ? (
                <ErrorState error={events.error} showRequestId />
              ) : !events.data || events.data.length === 0 ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Aucun événement.
                </Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {events.data.map((event) => (
                    <div key={event.id} style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Text preset="caption" style={{ minWidth: 96 }}>
                        {formatDate(event.at, locale)}
                      </Text>
                      <Text preset="bodySm">{event.to}</Text>
                      {event.reason ? <Text preset="caption">{event.reason}</Text> : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </AuthGate>
    </Section>
  );
}
