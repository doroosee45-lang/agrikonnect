import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PressableCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatNumber, formatRelative } from '@/lib/format';
import { messagingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const SUBJECT_LABELS: Record<string, string> = {
  get LISTING() { return tr('ui.annonce'); },
  get ORDER() { return tr('ui.commande'); },
  get TRANSPORT() { return tr('ui.transport'); },
  get DISPUTE() { return tr('ui.litige'); },
  get PROJECT() { return tr('ui.projet'); },
};

/** Messagerie (MSG-01) : conversations rattachées à un objet métier. */
export default function Messages() {
  const { t, locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const conversations = useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => messagingApi.conversations({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = conversations.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('nav.messages')} subtitle={t('ui.echangesLiesAUneAnnonceUne')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.messagerieReserveeAuxComptesActifs')}
          description={t('ui.connectezVousPourEchangerAvecUn')}
          icon="chatbubbles-outline"
        >
          {conversations.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : conversations.isError ? (
            <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
          ) : (
            <>
              <Card tone="white" style={styles.summary}>
                <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.conversationSMessageSNonLu', { length: formatNumber(items.length, locale), value: formatNumber(conversations.data?.totalUnread ?? 0, locale) })}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.uneConversationEstToujoursRattacheeA')}</Text>
              </Card>

              {items.length === 0 ? (
                <EmptyState
                  title={t('ui.aucuneConversation')}
                  description={t('ui.contactezUnVendeurDepuisUneAnnonce_ac1ee')}
                  icon="chatbubbles-outline"
                  action={{ label: t('ui.voirLesAnnonces'), onPress: () => router.push('/annonces') }}
                />
              ) : (
                <View style={styles.list}>
                  {items.map((conversation, index) => (
                    <Reveal key={conversation.id} index={index} variant="up">
                      <PressableCard
                        onPress={() => router.push(`/messages/${conversation.id}` as never)}
                        style={styles.card}
                      >
                        <View style={styles.icon}>
                          <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.forestGreen} />
                        </View>
                        <View style={styles.body}>
                          <View style={styles.head}>
                            <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                              {conversation.subjectType
                                ? `${SUBJECT_LABELS[conversation.subjectType] ?? conversation.subjectType} · ${conversation.subjectId}`
                                : t('ui.conversation')}
                            </Text>
                            <Chip label={conversation.status} tone={conversation.status === 'BLOCKED' ? 'error' : 'neutral'} size="sm" />
                          </View>
                          <Text preset="caption" color={COLORS.slateGray} numberOfLines={2} style={styles.lineHeight}>
                            {conversation.lastMessage?.body ?? t('ui.aucunMessagePourLeMoment')}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {formatRelative(conversation.updatedAt, locale)}
                            {conversation.unread > 0 ? t('ui.nonLuS_4c803', { unread: formatNumber(conversation.unread, locale) }) : ''}
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
  summary: { gap: 4 },
  card: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  list: { gap: SPACING.sm },
});
