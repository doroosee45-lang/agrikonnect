import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — analyses de sol (SOIL-01 → SOIL-03), règles d'affichage explicites. */
export default function FarmerSoil() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.analysesDeSol')} icon="🧪">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.analysesDeSol')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.lesAnalysesDeSolSontConsultables')}</Text>

          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.accedezAuxAnalysesDeSolDepuis')}</Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
