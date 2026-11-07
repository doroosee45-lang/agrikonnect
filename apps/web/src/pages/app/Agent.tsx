import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { aiApi, verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE, TINTS } from '@/theme';

const TOOLS = [
  { href: '/reviewer/missions', label: 'File de vérification', icon: '🛡️' },
  { href: '/admin', label: 'Administration', icon: '⚙️' },
  { href: '/messages', label: 'Messagerie', icon: '💬' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
];

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

  const pending = (queue.data?.items ?? []).filter((item) => item.status === 'PENDING');
  const escalated = escalations.data ?? [];

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Accès agent"
        description="Connectez-vous avec un rôle agent ou support pour accéder à cet espace."
        icon="🧑‍🌾"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Agent de terrain
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Charge de travail réelle, escalades et outils de support.
          </Text>
        </div>

        <Card tone="ink" style={{ marginBottom: 32, padding: 32 }}>
          <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 20 }}>
            Charge en cours
          </Text>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div>
              <Text preset="numeric" color={COLORS.pureWhite}>
                {formatNumber(pending.length, locale)}
              </Text>
              <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                vérifications en attente
              </Text>
            </div>
            <div>
              <Text preset="numeric" color={COLORS.pureWhite}>
                {formatNumber(escalated.length, locale)}
              </Text>
              <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                analyses IA escaladées
              </Text>
            </div>
          </div>
          <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={{ marginTop: 20, lineHeight: 1.7 }}>
            Compteurs issus des files réelles : rien n'est estimé ni lissé.
          </Text>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {TOOLS.map((tool, index) => (
            <motion.div
              key={tool.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: index * 0.04, ease: EASE.out }}
            >
              <Link to={tool.href} style={{ textDecoration: 'none' }}>
                <Card tone="white" hover style={{ height: '100%' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: TINTS.forestGreenBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      marginBottom: 12,
                    }}
                  >
                    {tool.icon}
                  </div>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                    {tool.label}
                  </Text>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Demandes prioritaires
        </Text>
        {queue.isLoading ? (
          <LoadingState count={2} height={80} />
        ) : queue.isError ? (
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState title="Aucune demande en attente" description="La file de vérification est à jour." icon="✅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {pending.slice(0, 6).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      {item.subjectType} · niveau {item.level}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      en attente depuis le {formatDate(item.createdAt, locale)}
                    </Text>
                  </div>
                  <Chip label={item.status} tone="warning" size="sm" />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Escalades IA à traiter
        </Text>
        {escalations.isLoading ? (
          <LoadingState count={1} height={80} />
        ) : escalations.isError ? (
          <ErrorState error={escalations.error} onRetry={() => void escalations.refetch()} />
        ) : escalated.length === 0 ? (
          <EmptyState title="Aucune escalade" description="Aucune analyse IA n'attend une revue humaine." icon="✨" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {escalated.slice(0, 6).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      {item.prompt ?? `Analyse ${item.type}`}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.type} · escaladée le {item.escalatedAt ? formatDate(item.escalatedAt, locale) : formatDate(item.createdAt, locale)}
                    </Text>
                  </div>
                  <Chip label="à revoir" tone="info" size="sm" />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Link to="/reviewer/missions">
          <Button label="Ouvrir la file complète" variant="outline" />
        </Link>
      </AuthGate>
    </Section>
  );
}
