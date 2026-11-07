import { motion } from 'framer-motion';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

const SCOPES = [
  { key: 'profile', label: 'Profil et coordonnées', description: "Identité du producteur, téléphone, email." },
  { key: 'farm', label: 'Exploitations et parcelles', description: "Surfaces, localisation approximative, cultures." },
  { key: 'production', label: 'Productions', description: "Volumes déclarés ou mesurés, rendements." },
  { key: 'soil', label: 'Analyses de sol', description: "Paramètres de sol et enquêtes de terrain." },
  { key: 'market', label: 'Données de marché', description: "Annonces, commandes, prix." },
];

/** AGENT — consentement éclairé du producteur avant toute saisie (AGT-01 → AGT-05). */
export default function AgentConsent() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Consentement" description="Le consentement du producteur doit être enregistré avant toute saisie." icon="🤝">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Consentement du producteur
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            En tant qu'agent de terrain, vous ne pouvez saisir des données pour un producteur qu'après avoir enregistré son consentement explicite,
            périmètre par périmètre. Le consentement est horodaté et révocable à tout moment.
          </Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {SCOPES.map((scope, index) => (
              <motion.div
                key={scope.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 5) * 0.06, ease: EASE.out }}
              >
                <Card tone="white">
                  <Text preset="h4" style={{ marginBottom: 4 }}>
                    {scope.label}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {scope.description}
                  </Text>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card tone="pale" style={{ marginTop: 24 }}>
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              Aucun consentement n'est présumé. Un producteur peut retirer un périmètre à tout moment ; les données déjà transmises restent
              soumises à la politique de conservation affichée dans les conditions d'utilisation.
            </Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
