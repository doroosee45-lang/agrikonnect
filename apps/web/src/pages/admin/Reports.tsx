import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** ADMIN — rapports et exports disponibles. */
export default function AdminReports() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const dashboard = useQuery({
        queryKey: queryKeys.admin.dashboard({}),
    queryFn: () => adminApi.dashboard().then((result) => result.data),
    enabled: isAuthenticated,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Rapports" description="Exports et rapports disponibles." icon="📑">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Rapports
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Exports générés à la demande. Chaque export est tracé dans le journal d'audit.
        </Text>

        {dashboard.isLoading ? (
          <LoadingState count={1} height={100} />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base / 1000, ease: EASE.out }}>
              <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                    Export des exploitations
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    GET /admin/export/farms — fichier généré à la demande, accès tracé.
                  </Text>
                </div>
                <Button label="Télécharger" onClick={() => window.open(adminApi.exportFarms(), '_blank')} variant="outline" size="sm" />
              </Card>
            </motion.div>

            <Card tone="pale" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                Les exports ne contiennent jamais de coordonnées personnelles non nécessaires. Chaque téléchargement
                est journalisé avec son auteur et son horodatage.
              </Text>
            </Card>
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
