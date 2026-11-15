import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  FilterChip,
  LoadingState,
  PressableCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatNumber, formatRelative } from '@/lib/format';
import { notificationApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const FILTERS = [
  { key: 'all', get label() { return tr('ui.toutes'); } },
  { key: 'unread', get label() { return tr('ui.nonLues'); } },
] as const;

/** Boîte de réception (NOTIF-01) : notifications in-app de l'utilisateur courant. */
export default function Notifications() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const list = useQuery({
    queryKey: queryKeys.notifications.list({ filter, limit: 50 }),
    queryFn: () => notificationApi.list({ limit: 50, unread: filter === 'unread' }).then((result) => result.data),
  });

  const readAll = useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.read(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });

  const items = list.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('nav.notifications')} subtitle={t('ui.alertesDeCommandeDeVerificationEt')} showNotifications={false} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourConsulterVosNotifications')}
          isAuthenticated={isAuthenticated}
          icon="notifications-outline"
        >
          <View style={styles.toolbar}>
            <ChipRow>
              {FILTERS.map((item) => (
                <FilterChip key={item.key} label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />
              ))}
            </ChipRow>
            <Button
              label={t('ui.alertesSms')}
              onPress={() => router.push('/notifications/sms-consent')}
              variant="ghost"
              size="sm"
              icon="chatbox-ellipses-outline"
            />
            <Button
              label={t('ui.preferences')}
              onPress={() => router.push('/notifications/preferences')}
              variant="ghost"
              size="sm"
              icon="settings-outline"
            />
          </View>

          {list.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <>
              <Card tone="white" style={styles.summary}>
                <View style={styles.summaryBody}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.notificationSNonLueS', { value: formatNumber(list.data?.unreadCount ?? 0, locale) })}</Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.canalInAppUniquementLesPreferences')}</Text>
                </View>
                <Button
                  label={t('ui.toutMarquerLu')}
                  onPress={() => readAll.mutate()}
                  variant="outline"
                  size="sm"
                  icon="checkmark-done-outline"
                  loading={readAll.isPending}
                  disabled={(list.data?.unreadCount ?? 0) === 0}
                />
              </Card>

              {items.length === 0 ? (
                <EmptyState
                  title={filter === 'unread' ? t('ui.aucuneNotificationNonLue') : t('ui.aucuneNotification')}
                  description={t('ui.vousSerezAlerteIciDesEvenements')}
                  icon="notifications-off-outline"
                />
              ) : (
                <View style={styles.list}>
                  {items.map((item, index) => (
                    <Reveal key={item.id} index={index} variant="up">
                      <PressableCard
                        onPress={() => (item.readAt ? undefined : markRead.mutate(item.id))}
                        style={[styles.card, item.readAt ? styles.cardRead : null]}
                      >
                        <View style={[styles.dot, item.readAt ? null : styles.dotUnread]} />
                        <View style={styles.cardBody}>
                          <View style={styles.cardHead}>
                            <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <Chip label={item.type} tone="neutral" size="sm" />
                          </View>
                          {item.body ? (
                            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                              {item.body}
                            </Text>
                          ) : null}
                          <Text preset="caption" color={COLORS.slateGray}>
                            {formatRelative(item.createdAt, locale)} · {item.readAt ? `lu ${formatRelative(item.readAt, locale)}` : t('ui.nonLu')}
                          </Text>
                        </View>
                      </PressableCard>
                    </Reveal>
                  ))}
                </View>
              )}
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
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, flexWrap: 'wrap' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  summaryBody: { flex: 1, minWidth: 200, gap: 2 },
  card: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  cardRead: { opacity: 0.72 },
  dot: { width: 8, height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.lightBorder, marginTop: 7 },
  dotUnread: { backgroundColor: COLORS.livingGreen },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  list: { gap: SPACING.sm },
});
