import { motion } from 'framer-motion';

import { Card, Section, Text } from '@/components/ui';
import { COLORS, DURATION, EASE } from '@/theme';
import { VERT } from '../../theme/agrikonnect';
import { useI18n, tr } from '@/i18n';

const GROUPS = [
  {
    get title() { return tr('ui.donneesPubliques'); },
    endpoints: [
      { method: 'GET', path: '/public/farms', get description() { return tr('ui.listeDesExploitationsPubliees'); } },
      { method: 'GET', path: '/public/farms/:slug', get description() { return tr('ui.fichePubliqueDUneExploitation'); } },
      { method: 'GET', path: '/public/map', get description() { return tr('ui.carteDesExploitationsPublieesGeojson'); } },
      { method: 'GET', path: '/public/lots/:code', get description() { return tr('ui.fichePubliqueDUnLotDe'); } },
      { method: 'GET', path: '/public/soil-stats', get description() { return tr('ui.statistiquesDeSolAgregeesKAnonymite'); } },
    ],
  },
  {
    get title() { return tr('ui.references'); },
    endpoints: [
      { method: 'GET', path: '/crops', get description() { return tr('ui.referentielDesCultures'); } },
      { method: 'GET', path: '/countries', get description() { return tr('ui.referentielDesPays'); } },
    ],
  },
  {
    get title() { return tr('ui.prixEtMeteo'); },
    endpoints: [
      { method: 'GET', path: '/prices', get description() { return tr('ui.prixDeMarcheParCultureEt'); } },
      { method: 'GET', path: '/weather', get description() { return tr('ui.previsionsMeteorologiques'); } },
    ],
  },
];

/** DEVELOPERS — référence des endpoints publics. */
export default function DevelopersDocs() {
  const { t } = useI18n();
  return (
    <Section>
      <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.documentation')}</Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.endpointsAccessiblesAvecUneCleApi')}</Text>

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
