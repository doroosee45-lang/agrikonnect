import { motion } from 'framer-motion';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — enquêtes de terrain rattachées aux analyses de sol. */
export default function FarmerSurveys() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Enquêtes" description="Enquêtes de terrain rattachées à vos analyses." icon="📋">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Enquêtes de terrain
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Les enquêtes de terrain sont rattachées aux analyses de sol, parcelle par parcelle.
          </Text>

          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              Accédez aux enquêtes depuis la fiche de chaque parcelle. Une enquête de terrain complète une analyse de sol sans la remplacer.
            </Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
