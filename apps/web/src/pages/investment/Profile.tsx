import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** INVESTMENT — profil investisseur et préférences d'investissement. */
export default function InvestmentProfile() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfilInvestisseur')} icon="💼">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 32 }}>{t('ui.profilInvestisseur')}</Text>

          <Card tone="white" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text preset="bodySm">{t('ui.nom_91f8c', { firstName: me?.firstName, lastName: me?.lastName })}</Text>
              <Text preset="bodySm">{t('ui.email_946f4', { value: me?.email ?? '—' })}</Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                <Chip label={me?.status ?? '—'} tone="neutral" size="sm" />
              </div>
            </div>
          </Card>

          <Card tone="white">
            <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.accesALaSalleDeDonnees')}</Text>
            <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>{t('ui.chaqueConsultationDUnDocumentDans')}</Text>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
