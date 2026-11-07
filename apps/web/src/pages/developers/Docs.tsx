import { motion } from 'framer-motion';

import { Card, Section, Text } from '@/components/ui';
import { COLORS, DURATION, EASE } from '@/theme';
import { VERT } from '../../theme/agrikonnect';

const GROUPS = [
  {
    title: 'Données publiques',
    endpoints: [
      { method: 'GET', path: '/public/farms', description: 'Liste des exploitations publiées.' },
      { method: 'GET', path: '/public/farms/:slug', description: 'Fiche publique d\'une exploitation.' },
      { method: 'GET', path: '/public/map', description: 'Carte des exploitations publiées (GeoJSON).' },
      { method: 'GET', path: '/public/lots/:code', description: 'Fiche publique d\'un lot de traçabilité.' },
      { method: 'GET', path: '/public/soil-stats', description: 'Statistiques de sol agrégées (k-anonymité).' },
    ],
  },
  {
    title: 'Références',
    endpoints: [
      { method: 'GET', path: '/crops', description: 'Référentiel des cultures.' },
      { method: 'GET', path: '/countries', description: 'Référentiel des pays.' },
    ],
  },
  {
    title: 'Prix et météo',
    endpoints: [
      { method: 'GET', path: '/prices', description: 'Prix de marché par culture et zone.' },
      { method: 'GET', path: '/weather', description: 'Prévisions météorologiques.' },
    ],
  },
];

/** DEVELOPERS — référence des endpoints publics. */
export default function DevelopersDocs() {
  return (
    <Section>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Documentation
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
        Endpoints accessibles avec une clé API. Les endpoints authentifiés ne sont pas exposés ici.
      </Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {GROUPS.map((group, index) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 4) * 0.08, ease: EASE.out }}
          >
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                {group.title}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {group.endpoints.map((endpoint) => (
                  <div key={`${endpoint.method}-${endpoint.path}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <Text preset="caption" style={{ fontWeight: 700, minWidth: 40, color: VERT[800] }}>
                      {endpoint.method}
                    </Text>
                    <Text preset="caption" style={{ fontFamily: 'monospace', minWidth: 180 }}>
                      {endpoint.path}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {endpoint.description}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
