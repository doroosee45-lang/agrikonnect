import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** INVESTMENT — profil investisseur et préférences d'investissement. */
export default function InvestmentProfile() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Mon profil investisseur" icon="💼">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 32 }}>
            Profil investisseur
          </Text>

          <Card tone="white" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text preset="bodySm">
                Nom : {me?.firstName} {me?.lastName}
              </Text>
              <Text preset="bodySm">Email : {me?.email ?? '—'}</Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? 'email vérifié' : 'email non vérifié'} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                <Chip label={me?.status ?? '—'} tone="neutral" size="sm" />
              </div>
            </div>
          </Card>

          <Card tone="white">
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Accès à la salle de données
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
              Chaque consultation d'un document dans une salle de données est journalisée. Le producteur peut voir qui a consulté quel document et
              quand. Aucun document n'est accessible sans demande d'accès acceptée.
            </Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
