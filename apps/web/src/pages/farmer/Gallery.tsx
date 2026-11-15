import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { mediaApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — médias rattachés aux parcelles (upload en deux temps). */
export default function FarmerGallery() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: [...queryKeys.plots.all, 'media'] as unknown[],
    queryFn: () => mediaApi.list({}).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.galerie')} description={t('ui.mediasRattachesAVosParcelles')} icon="🖼️">
        <Text preset="h1" style={{ marginBottom: 32 }}>{t('ui.galerie')}</Text>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState title={t('ui.aucunMedia')} description={t('ui.lesPhotosEtDocumentsRattachesA')} icon="🖼️" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {query.data.map((media, index) => (
              <motion.div
                key={String(media.id)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <Text preset="bodySm" style={{ marginBottom: 4 }}>
                    {media.caption ?? media.kind}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {media.kind}
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
