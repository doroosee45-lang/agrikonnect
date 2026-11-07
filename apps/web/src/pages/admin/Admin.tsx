import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE, TINTS } from '@/theme';

const MODULES = [
  { href: '/admin/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/admin/users', label: 'Comptes', icon: '👥' },
  { href: '/admin/roles', label: 'Rôles et permissions', icon: '🛡️' },
  { href: '/admin/farmers', label: 'Producteurs', icon: '🧑‍🌾' },
  { href: '/admin/producers', label: 'Organisations', icon: '🏭' },
  { href: '/admin/investors', label: 'Investisseurs', icon: '📈' },
  { href: '/admin/partners', label: 'Partenaires', icon: '🤝' },
  { href: '/admin/farms', label: 'Exploitations', icon: '🏡' },
  { href: '/admin/plots', label: 'Parcelles', icon: '🗺️' },
  { href: '/admin/productions', label: 'Récoltes', icon: '🌾' },
  { href: '/admin/lots', label: 'Lots', icon: '📦' },
  { href: '/admin/marketplace', label: 'Annonces', icon: '🛒' },
  { href: '/admin/orders', label: 'Commandes', icon: '🧾' },
  { href: '/admin/prices', label: 'Prix', icon: '💰' },
  { href: '/admin/crops', label: 'Cultures', icon: '🌱' },
  { href: '/admin/countries', label: 'Pays', icon: '🌍' },
  { href: '/admin/cooperatives', label: 'Coopératives', icon: '👥' },
  { href: '/admin/projects', label: 'Projets', icon: '📁' },
  { href: '/admin/devices', label: 'Appareils IoT', icon: '📡' },
  { href: '/admin/verifications', label: 'Vérifications', icon: '🛡️' },
  { href: '/admin/compliance', label: 'Conformité', icon: '✅' },
  { href: '/admin/moderation', label: 'Modération', icon: '⚖️' },
  { href: '/admin/messages', label: 'Messagerie', icon: '💬' },
  { href: '/admin/api-clients', label: 'Clients API', icon: '🔑' },
  { href: '/admin/ai-usage', label: 'Usage IA', icon: '✨' },
  { href: '/admin/data-products', label: 'Produits de données', icon: '🗃️' },
  { href: '/admin/reports', label: 'Rapports', icon: '📑' },
  { href: '/admin/rules', label: 'Règles', icon: '📐' },
  { href: '/admin/agronomic-ranges', label: 'Plages agronomiques', icon: '🌾' },
  { href: '/admin/audit', label: "Journal d'audit", icon: '🕒' },
  { href: '/admin/monitoring', label: 'Supervision', icon: '📡' },
  { href: '/admin/jobs', label: 'Tâches planifiées', icon: '⚙️' },
  { href: '/admin/security', label: 'Sécurité', icon: '🔐' },
  { href: '/admin/operations', label: 'Opérations', icon: '🗂️' },
  { href: '/admin/notifications', label: 'Notifications', icon: '📣' },
  { href: '/admin/sync', label: 'Synchronisation', icon: '🔄' },
  { href: '/admin/settings', label: 'Paramètres', icon: '🔧' },
];

/** ADMIN — index : navigation vers les modules d'administration. */
export default function Admin() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Administration" description="Pilotage de la plateforme." icon="⚙️">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Administration
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Chaque module interroge l'API réelle : aucun jeu de données n'est simulé.
        </Text>

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
