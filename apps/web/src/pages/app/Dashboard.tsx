import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { dashboardApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE, TINTS } from '@/theme';
import { StatCard } from '@/design-system';

const SHORTCUTS = [
  { href: '/app/farms', label: 'Exploitations', icon: '🏡' },
  { href: '/app/plots', label: 'Parcelles', icon: '🗺️' },
  { href: '/app/productions', label: 'Récoltes', icon: '🌾' },
  { href: '/app/season-feedback', label: 'Rendements réels', icon: '📈' },
  { href: '/app/orders', label: 'Commandes', icon: '🧾' },
  { href: '/app/messages', label: 'Messagerie', icon: '💬' },
  { href: '/app/notifications', label: 'Notifications', icon: '🔔' },
];

/** APP — tableau de bord : compteurs réels servis par GET /dashboard. */
export default function AppDashboard() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const entries = Object.entries((dashboard.data ?? {}) as Record<string, unknown>);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Tableau de bord" description="Vue d'ensemble de votre activité." icon="📊">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Tableau de bord
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Compteurs calculés à partir de vos données réelles : aucune projection n'est ajoutée.
        </Text>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {SHORTCUTS.map((shortcut, index) => (
            <motion.div
              key={shortcut.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
            >
              <Link to={shortcut.href} style={{ textDecoration: 'none' }}>
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
                    {shortcut.icon}
                  </div>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                    {shortcut.label}
                  </Text>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Indicateurs
        </Text>
        {dashboard.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : entries.length === 0 ? (
          <Card tone="white">
            <Text preset="bodyMd" color={COLORS.slateGray}>
              L'API n'a renvoyé aucun indicateur.
            </Text>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {entries.map(([key, value], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 10) * 0.03, ease: EASE.out }}
              >
                <StatCard
                  label={key}
                  valeur={typeof value === 'number' ? formatNumber(value, locale) : typeof value === 'string' ? value : JSON.stringify(value)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
