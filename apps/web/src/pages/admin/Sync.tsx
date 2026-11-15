import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** ADMIN — état de synchronisation : santé de l'API et du moteur géospatial. */
export default function AdminSync() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => publicApi.health().then((result) => result.data),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.synchronisation')} description={t('ui.etatDesServices_dc57a')} icon="🔄">
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.synchronisation')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.etatReelDesServicesTelQue')}</Text>

        {health.isLoading ? (
          <LoadingState count={1} height={120} />
        ) : health.isError ? (
          <ErrorState error={health.error} onRetry={() => void health.refetch()} showRequestId />
        ) : !health.data ? null : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}>
            <Card tone="ink" style={{ padding: 32, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <Text preset="h3" color={COLORS.pureWhite}>
                  API
                </Text>
                <Chip label={health.data.status} tone={health.data.status === 'ok' ? 'success' : 'error'} />
              </div>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                <div>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.7)">{t('ui.version')}</Text>
                  <Text preset="bodyLg" color={COLORS.pureWhite}>
                    {health.data.version}
                  </Text>
                </div>
                <div>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.7)">{t('ui.uptime')}</Text>
                  <Text preset="bodyLg" color={COLORS.pureWhite}>
                    {Math.round(health.data.uptime)} s
                  </Text>
                </div>
                <div>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.7)">{t('ui.horodatage')}</Text>
                  <Text preset="bodyLg" color={COLORS.pureWhite}>
                    {formatDate(health.data.timestamp, locale)}
                  </Text>
                </div>
              </div>
            </Card>

            <Card tone="pale" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>ℹ️</span>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.lesSynchronisationsHorsLigneUssdWhatsapp')}</Text>
            </Card>
          </motion.div>
        )}
      </AuthGate>
    </Section>
  );
}
