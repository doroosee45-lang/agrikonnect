import { motion } from 'framer-motion';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — enquêtes de terrain rattachées aux analyses de sol. */
export default function FarmerSurveys() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.enquetes')} description={t('ui.enquetesDeTerrainRattacheesAVos')} icon="📋">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.enquetesDeTerrain')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.lesEnquetesDeTerrainSontRattachees')}</Text>

          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.accedezAuxEnquetesDepuisLaFiche')}</Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
