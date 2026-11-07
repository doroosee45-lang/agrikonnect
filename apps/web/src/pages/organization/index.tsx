import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { AuthGate, Card, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

const LINKS = [
  { href: '/organization/overview', icon: '📊', label: 'Vue d\'ensemble' },
  { href: '/organization/profile', icon: '🏢', label: 'Profil' },
  { href: '/organization/members', icon: '👥', label: 'Membres' },
  { href: '/organization/farms', icon: '🏡', label: 'Exploitations' },
  { href: '/organization/production', icon: '🌾', label: 'Synthèse production' },
  { href: '/organization/invitations', icon: '✉️', label: 'Invitations' },
  { href: '/organization/import', icon: '📥', label: 'Import de membres' },
  { href: '/organization/verification', icon: '✅', label: 'Vérification' },
];

/** ORGANIZATION — portail organisation (coopérative, ONG, agrégateur). */
export default function OrganizationHome() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Organisation" description="Gérez votre organisation et ses membres." icon="🏢">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Organisation
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Coopérative, ONG ou agrégateur : gérez vos membres, exploitations et données agrégées.
        </Text>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {LINKS.map((link, index) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
            >
              <Link to={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card tone="white" hover>
                  <Text preset="bodySm">
                    {link.icon} {link.label}
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
