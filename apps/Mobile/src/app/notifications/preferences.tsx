import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  FilterChip,
  LoadingState,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { notificationApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import type { NotificationChannel } from '@/services/api/types';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL', 'PUSH', 'SMS'];

/** Types de notification connus du backend (NOTIF-03). */
const TYPES = [
  'order.status',
  'order.dispute',
  'message.new',
  'verification.request',
  'verification.decision',
  'soil.diagnosis',
  'price.alert',
  'tender.deadline',
] as const;

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: 'Dans l’app',
  EMAIL: 'E-mail',
  PUSH: 'Notification push',
  SMS: 'SMS',
};

/** Préférences de notification par type × canal (opt-out explicite). */
export default function NotificationPreferences() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const preferences = useQuery({
    queryKey: [...queryKeys.notifications.all, 'preferences'],
    queryFn: () => notificationApi.preferences().then((result) => result.data),
  });

  useEffect(() => {
    if (!preferences.data) return;
    const next: Record<string, boolean> = {};
    for (const type of TYPES) {
      for (const channel of CHANNELS) {
        const row = preferences.data.preferences.find((item) => item.type === type && item.channel === channel);
        next[`${type}::${channel}`] = row ? row.enabled : preferences.data.default.enabled;
      }
    }
    setDraft(next);
  }, [preferences.data]);

  const save = useMutation({
    mutationFn: () =>
      notificationApi.setPreferences(
        Object.entries(draft).map(([key, enabled]) => {
          const [type, channel] = key.split('::') as [string, NotificationChannel];
          return { type, channel, enabled };
        }),
      ),
    onSuccess: () => {
      setSaved('Préférences enregistrées.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const toggle = (key: string) => setDraft((current) => ({ ...current, [key]: !current[key] }));

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Préférences" subtitle="Choisissez le canal de chaque type d’alerte." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          title="Connexion requise"
          description="Connectez-vous pour consulter vos notifications et régler vos préférences."
          isAuthenticated={isAuthenticated}
          icon="notifications-outline"
        >
          {preferences.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : preferences.isError ? (
            <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />
          ) : (
            <>
              <Card tone="pale" style={styles.note}>
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  Une préférence absente vaut « activée » : le système fonctionne en opt-out explicite. Désactiver
                  un canal ne supprime pas les alertes de sécurité obligatoires.
                </Text>
              </Card>

              {TYPES.map((type) => (
                <Card key={type} tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {type}
                    </Text>
                    <Chip label="type" tone="neutral" size="sm" />
                  </View>
                  <ChipRow>
                    {CHANNELS.map((channel) => (
                      <FilterChip
                        key={channel}
                        label={CHANNEL_LABELS[channel]}
                        active={draft[`${type}::${channel}`] === true}
                        onPress={() => toggle(`${type}::${channel}`)}
                      />
                    ))}
                  </ChipRow>
                  <View style={styles.switches}>
                    {CHANNELS.map((channel) => (
                      <View key={`switch-${type}-${channel}`} style={styles.switchRow}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {CHANNEL_LABELS[channel]}
                        </Text>
                        <Switch
                          value={draft[`${type}::${channel}`] === true}
                          onValueChange={() => toggle(`${type}::${channel}`)}
                          trackColor={{ false: COLORS.lightBorder, true: COLORS.livingGreen }}
                          thumbColor={COLORS.pureWhite}
                          accessibilityLabel={`${type} ${CHANNEL_LABELS[channel]}`}
                        />
                      </View>
                    ))}
                  </View>
                </Card>
              ))}

              {save.isError ? <ErrorState error={save.error} showRequestId /> : null}
              {saved ? (
                <Text preset="caption" color={COLORS.success} style={styles.lineHeight}>
                  {saved}
                </Text>
              ) : null}

              <Button
                label="Enregistrer les préférences"
                onPress={() => save.mutate()}
                variant="primary"
                fullWidth
                loading={save.isPending}
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
  lineHeight: { lineHeight: 18 },
  note: { gap: SPACING.xs },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  switches: { gap: SPACING.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
});
