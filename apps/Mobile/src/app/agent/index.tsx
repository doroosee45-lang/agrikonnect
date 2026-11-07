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
  EmptyState,
  ErrorState,
  LoadingState,
  PressableCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { aiApi, verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const TOOLS = [
  { href: '/reviewer', label: 'File de vérification', icon: 'shield-checkmark-outline' },
  { href: '/admin', label: 'Administration', icon: 'settings-outline' },
  { href: '/messages', label: 'Messagerie', icon: 'chatbubbles-outline' },
  { href: '/notifications', label: 'Notifications', icon: 'notifications-outline' },
] as const;

/** Agent de terrain / support : charge réelle, escalades et outils. */
export default function Agent() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const queue = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 20 }),
    queryFn: () => verificationApi.adminQueue({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const escalations = useQuery({
    queryKey: queryKeys.ai.list({ status: 'ESCALATED' }),
    queryFn: () => aiApi.list({ status: 'ESCALATED', limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const pending = (queue.data ?? []).filter((item) => item.status === 'PENDING');
  const escalated = escalations.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Agent de terrain" subtitle="Charge de travail réelle, escalades et outils de support." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Accès agent"
          description="Connectez-vous avec un rôle agent ou support pour accéder à cet espace."
          icon="people-outline"
        >
          <Card tone="ink" style={styles.summary}>
            <Text preset="overline" color={COLORS.gold}>
              Charge en cours
            </Text>
            <View style={styles.counts}>
              <View style={styles.count}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(pending.length, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  vérifications en attente
                </Text>
              </View>
              <View style={styles.count}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(escalated.length, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  analyses IA escaladées
                </Text>
              </View>
            </View>
            <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={styles.lineHeight}>
              Compteurs issus des files réelles : rien n’est estimé ni lissé.
            </Text>
          </Card>

          <View style={styles.tools}>
            {TOOLS.map((tool, index) => (
              <Reveal key={tool.href} index={index} variant="up" style={styles.toolItem}>
                <PressableCard onPress={() => router.push(tool.href as never)} style={styles.tool}>
                  <View style={styles.toolIcon}>
                    <Ionicons name={tool.icon} size={17} color={COLORS.forestGreen} />
                  </View>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    {tool.label}
                  </Text>
                </PressableCard>
              </Reveal>
            ))}
          </View>

          <Text preset="overline" color={COLORS.forestGreen}>
            Demandes prioritaires
          </Text>
          {queue.isLoading ? (
            <LoadingState count={2} height={90} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : pending.length === 0 ? (
            <EmptyState title="Aucune demande en attente" description="La file de vérification est à jour." icon="checkmark-done-outline" />
          ) : (
            <View style={styles.list}>
              {pending.slice(0, 6).map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {item.subjectType} · niveau {item.level}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        en attente depuis le {formatDate(item.createdAt, locale)}
                      </Text>
                    </View>
                    <Chip label={item.status} tone="warning" size="sm" />
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Escalades IA à traiter
          </Text>
          {escalations.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : escalations.isError ? (
            <ErrorState error={escalations.error} onRetry={() => void escalations.refetch()} />
          ) : escalated.length === 0 ? (
            <EmptyState title="Aucune escalade" description="Aucune analyse IA n’attend une revue humaine." icon="sparkles-outline" />
          ) : (
            <View style={styles.list}>
              {escalated.slice(0, 6).map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={2}>
                        {item.prompt ?? `Analyse ${item.type}`}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {item.type} · escaladée le {item.escalatedAt ? formatDate(item.escalatedAt, locale) : formatDate(item.createdAt, locale)}
                      </Text>
                    </View>
                    <Chip label="à revoir" tone="info" size="sm" />
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Button label="Ouvrir la file complète" onPress={() => router.push('/reviewer')} variant="outline" size="sm" icon="arrow-forward-outline" />
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  summary: { gap: SPACING.md },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xl },
  count: { gap: 2 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  toolItem: { flex: 1, minWidth: 200 },
  tool: { gap: SPACING.xs, alignItems: 'flex-start' },
  toolIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowBody: { flex: 1, gap: 2 },
  list: { gap: SPACING.sm },
});
