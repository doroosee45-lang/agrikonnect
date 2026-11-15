import { motion } from 'framer-motion';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n, tr } from '@/i18n';

const SCOPES = [
  { key: 'profile', get label() { return tr('ui.profilEtCoordonnees'); }, get description() { return tr('ui.identiteDuProducteurTelephoneEmail'); } },
  { key: 'farm', get label() { return tr('ui.exploitationsEtParcelles'); }, get description() { return tr('ui.surfacesLocalisationApproximativeCultures'); } },
  { key: 'production', get label() { return tr('ui.productions'); }, get description() { return tr('ui.volumesDeclaresOuMesuresRendements'); } },
  { key: 'soil', get label() { return tr('ui.analysesDeSol'); }, get description() { return tr('ui.parametresDeSolEtEnquetesDe'); } },
  { key: 'market', get label() { return tr('ui.donneesDeMarche'); }, get description() { return tr('ui.annoncesCommandesPrix'); } },
];

/** AGENT — consentement éclairé du producteur avant toute saisie (AGT-01 → AGT-05). */
export default function AgentConsent() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.consentement')} description={t('ui.leConsentementDuProducteurDoitEtre')} icon="🤝">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.consentementDuProducteur')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.enTantQuAgentDeTerrain')}</Text>

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
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.aucunConsentementNEstPresumeUn')}</Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
