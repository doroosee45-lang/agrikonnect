import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { notificationApi } from '@/services/endpoints';
import type { NotificationChannel } from '@/services/types';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';

const types = [
  'order.status',
  'order.dispute',
  'message.new',
  'verification.request',
  'verification.decision',
  'soil.diagnosis',
  'price.alert',
  'tender.deadline',
];
const channels: NotificationChannel[] = ['IN_APP', 'EMAIL', 'PUSH', 'SMS'];

export default function NotificationPreferences() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const query = useQuery({
    queryKey: [...queryKeys.notifications.all, 'preferences'],
    queryFn: () => notificationApi.preferences().then((result) => result.data),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!query.data) return;
    const next: Record<string, boolean> = {};
    for (const type of types) {
      for (const channel of channels) {
        const preference = query.data.preferences.find((item) => item.type === type && item.channel === channel);
        next[`${type}::${channel}`] = preference?.enabled ?? query.data.default.enabled;
      }
    }
    setDraft(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      notificationApi.setPreferences(
        Object.entries(draft).map(([key, enabled]) => {
          const [type, channel] = key.split('::') as [string, NotificationChannel];
          return { type, channel, enabled };
        }),
      ),
    onSuccess: () => void query.refetch(),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Préférences de notification" icon="🔔">
        <div style={{ maxWidth: 820 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>Préférences de notification</Text>
          <Text preset="bodyMd" style={{ marginBottom: 24 }}>Choisissez le canal de chaque événement. Une préférence absente est active par défaut.</Text>
          {query.isLoading ? (
            <LoadingState count={4} height={80} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {types.map((type) => (
                <Card key={type} tone="white">
                  <Text preset="h3" style={{ marginBottom: 12 }}>{type}</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    {channels.map((channel) => {
                      const key = `${type}::${channel}`;
                      return (
                        <label key={channel} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={draft[key] === true}
                            onChange={() => setDraft((current) => ({ ...current, [key]: !current[key] }))}
                          />
                          {channel}
                        </label>
                      );
                    })}
                  </div>
                </Card>
              ))}
              {save.error ? <ErrorState error={save.error} /> : null}
              <Button label="Enregistrer les préférences" loading={save.isPending} onClick={() => save.mutate()} />
            </div>
          )}
        </div>
      </AuthGate>
    </Section>
  );
}
