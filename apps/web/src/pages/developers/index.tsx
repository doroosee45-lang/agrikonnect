import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Card, Section, Text } from '@/components/ui';
import { COLORS, DURATION, EASE } from '@/theme';

const LINKS = [
  { href: '/developers/keys', icon: '🔑', label: 'Clés API', description: 'Créez et révoquez vos clés.' },
  { href: '/developers/usage', icon: '📊', label: 'Consommation', description: 'Quotas et historique des appels.' },
  { href: '/developers/docs', icon: '📚', label: 'Documentation', description: 'Référence des endpoints publics.' },
];

/** DEVELOPERS — portail développeur. */
export default function DevelopersHome() {
  return (
    <Section>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Développeurs
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
        Accédez à l'API publique, gérez vos clés et suivez votre consommation.
      </Text>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {LINKS.map((link, index) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 3) * 0.08, ease: EASE.out }}
          >
            <Link to={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card tone="white" hover>
                <Text preset="h4" style={{ marginBottom: 8 }}>
                  {link.icon} {link.label}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  {link.description}
                </Text>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
