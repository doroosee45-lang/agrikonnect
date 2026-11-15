import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE, TINTS } from '@/theme';
import { useI18n, tr } from '@/i18n';

const MODULES = [
  { href: '/admin/dashboard', get label() { return tr('ui.tableauDeBord'); }, icon: '📊' },
  { href: '/admin/users', get label() { return tr('ui.comptes'); }, icon: '👥' },
  { href: '/admin/roles', get label() { return tr('ui.rolesEtPermissions'); }, icon: '🛡️' },
  { href: '/admin/farmers', get label() { return tr('ui.producteurs'); }, icon: '🧑‍🌾' },
  { href: '/admin/producers', get label() { return tr('ui.organisations'); }, icon: '🏭' },
  { href: '/admin/investors', get label() { return tr('ui.investisseurs'); }, icon: '📈' },
  { href: '/admin/partners', get label() { return tr('ui.partenaires'); }, icon: '🤝' },
  { href: '/admin/farms', get label() { return tr('ui.exploitations'); }, icon: '🏡' },
  { href: '/admin/plots', get label() { return tr('ui.parcelles'); }, icon: '🗺️' },
  { href: '/admin/productions', get label() { return tr('ui.recoltes'); }, icon: '🌾' },
  { href: '/admin/lots', get label() { return tr('ui.lots'); }, icon: '📦' },
  { href: '/admin/marketplace', get label() { return tr('ui.annonces'); }, icon: '🛒' },
  { href: '/admin/orders', get label() { return tr('ui.commandes'); }, icon: '🧾' },
  { href: '/admin/prices', get label() { return tr('ui.prix'); }, icon: '💰' },
  { href: '/admin/crops', get label() { return tr('ui.cultures'); }, icon: '🌱' },
  { href: '/admin/countries', get label() { return tr('ui.pays'); }, icon: '🌍' },
  { href: '/admin/cooperatives', get label() { return tr('ui.cooperatives'); }, icon: '👥' },
  { href: '/admin/projects', get label() { return tr('ui.projets'); }, icon: '📁' },
  { href: '/admin/devices', get label() { return tr('ui.appareilsIot'); }, icon: '📡' },
  { href: '/admin/verifications', get label() { return tr('ui.verifications'); }, icon: '🛡️' },
  { href: '/admin/compliance', get label() { return tr('ui.conformite'); }, icon: '✅' },
  { href: '/admin/moderation', get label() { return tr('ui.moderation'); }, icon: '⚖️' },
  { href: '/admin/messages', get label() { return tr('ui.messagerie'); }, icon: '💬' },
  { href: '/admin/api-clients', get label() { return tr('ui.clientsApi'); }, icon: '🔑' },
  { href: '/admin/ai-usage', get label() { return tr('ui.usageIa'); }, icon: '✨' },
  { href: '/admin/data-products', get label() { return tr('ui.produitsDeDonnees'); }, icon: '🗃️' },
  { href: '/admin/reports', get label() { return tr('ui.rapports'); }, icon: '📑' },
  { href: '/admin/rules', get label() { return tr('ui.regles'); }, icon: '📐' },
  { href: '/admin/agronomic-ranges', get label() { return tr('ui.plagesAgronomiques'); }, icon: '🌾' },
  { href: '/admin/audit', get label() { return tr('ui.journalDAudit_52309'); }, icon: '🕒' },
  { href: '/admin/monitoring', get label() { return tr('ui.supervision'); }, icon: '📡' },
  { href: '/admin/jobs', get label() { return tr('ui.tachesPlanifiees_8a786'); }, icon: '⚙️' },
  { href: '/admin/security', get label() { return tr('ui.securite_33e96'); }, icon: '🔐' },
  { href: '/admin/operations', get label() { return tr('ui.operations_8d02b'); }, icon: '🗂️' },
  { href: '/admin/notifications', get label() { return tr('ui.notifications'); }, icon: '📣' },
  { href: '/admin/sync', get label() { return tr('ui.synchronisation'); }, icon: '🔄' },
  { href: '/admin/settings', get label() { return tr('ui.parametres_ef8f0'); }, icon: '🔧' },
];

/** ADMIN — index : navigation vers les modules d'administration. */
export default function Admin() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.administration')} description={t('ui.pilotageDeLaPlateforme')} icon="⚙️">
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.administration')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.chaqueModuleInterrogeLApiReelle')}</Text>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {MODULES.map((module, index) => (
            <motion.div
              key={module.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 12) * 0.025, ease: EASE.out }}
            >
              <Link to={module.href} style={{ textDecoration: 'none' }}>
                <Card tone="white" hover style={{ height: '100%' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: TINTS.forestGreenBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      marginBottom: 12,
                    }}
                  >
                    {module.icon}
                  </div>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                    {module.label}
                  </Text>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </AuthGate>
    </Section>
  );
}
