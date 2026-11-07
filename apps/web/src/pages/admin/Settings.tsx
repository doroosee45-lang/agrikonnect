import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** ADMIN — paramètres plateforme (lecture ; l'écriture passe par PUT /admin/settings). */
export default function AdminSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const settings = useQuery({
        queryKey: [...queryKeys.admin.dashboard({}), 'settings'],
    queryFn: () => adminApi.settings().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const entries = Object.entries((settings.data ?? {}) as Record<string, unknown>);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres" description="Configuration de la plateforme." icon="⚙️">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Paramètres
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Valeurs de configuration servies par GET /admin/settings.
        </Text>

        {settings.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : settings.isError ? (
          <ErrorState error={settings.error} onRetry={() => void settings.refetch()} showRequestId />
        ) : entries.length === 0 ? (
          <Card tone="white">
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucun paramètre exposé.
            </Text>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {entries.map(([key, value], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 10) * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 6 }}>
                    {key}
                  </Text>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Text>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
