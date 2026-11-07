import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';
import { VERT, ENCRE, BLANC } from '../../theme/agrikonnect';

/** FARMER — préférences : langue, fuseau, notifications, confidentialité. */
export default function FarmerSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);
  const { locale, setLocale } = useI18n();

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres" icon="⚙️">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 32 }}>
            Paramètres
          </Text>

          <Card tone="white" style={{ marginBottom: 16 }}>
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Langue de l'interface
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setLocale('fr')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${locale === 'fr' ? VERT[800] : 'rgba(18, 61, 42, 0.10)'}`,
                  background: locale === 'fr' ? VERT[800] : BLANC[95],
                  color: locale === 'fr' ? BLANC[95] : ENCRE[700],
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${locale === 'en' ? VERT[800] : 'rgba(18, 61, 42, 0.10)'}`,
                  background: locale === 'en' ? VERT[800] : BLANC[95],
                  color: locale === 'en' ? BLANC[95] : ENCRE[700],
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                English
              </button>
            </div>
          </Card>

          <Card tone="white" style={{ marginBottom: 16 }}>
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Compte
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Text preset="bodySm">Email : {me?.email ?? '—'}</Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? 'email vérifié' : 'email non vérifié'} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                <Chip label={me?.phoneVerified ? 'téléphone vérifié' : 'téléphone non vérifié'} tone={me?.phoneVerified ? 'success' : 'warning'} size="sm" />
              </div>
            </div>
          </Card>

          <Card tone="white">
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Confidentialité
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
              Vos coordonnées ne sont jamais affichées publiquement par défaut. Un acheteur doit passer par la messagerie interne. La géolocalisation
              de vos parcelles est volontairement approximative sur les surfaces publiques.
            </Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
