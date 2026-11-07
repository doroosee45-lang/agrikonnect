import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — analyses de sol (SOIL-01 → SOIL-03), règles d'affichage explicites. */
export default function FarmerSoil() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Analyses de sol" icon="🧪">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Analyses de sol
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Les analyses de sol sont consultables parcelle par parcelle.
          </Text>

          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              Accédez aux analyses de sol depuis la fiche de chaque parcelle. Une analyse déclarée n'est pas une mesure. Le symbole ≈ signale une
              valeur déclarée ou estimée ; ✔ une valeur mesurée.
            </Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
