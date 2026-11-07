import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const GROUPS = [
  { title: 'Données publiques', endpoints: [
    { method: 'GET', path: '/public/farms', description: 'Liste des exploitations publiées.' },
    { method: 'GET', path: '/public/farms/:slug', description: 'Fiche publique d\'une exploitation.' },
    { method: 'GET', path: '/public/map', description: 'Carte des exploitations publiées (GeoJSON).' },
    { method: 'GET', path: '/public/lots/:code', description: 'Fiche publique d\'un lot de traçabilité.' },
    { method: 'GET', path: '/public/soil-stats', description: 'Statistiques de sol agrégées (k-anonymité).' },
  ]},
  { title: 'Références', endpoints: [
    { method: 'GET', path: '/crops', description: 'Référentiel des cultures.' },
    { method: 'GET', path: '/countries', description: 'Référentiel des pays.' },
  ]},
  { title: 'Prix et météo', endpoints: [
    { method: 'GET', path: '/prices', description: 'Prix de marché par culture et zone.' },
    { method: 'GET', path: '/weather', description: 'Prévisions météorologiques.' },
  ]},
];

export default function DevelopersDocs() {
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Documentation" subtitle="Endpoints accessibles avec une clé API." />
      <Section bare contentStyle={styles.section}>
        {GROUPS.map((group, gi) => (
          <Reveal key={group.title} index={gi} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="h3" style={styles.mb}>{group.title}</Text>
              <View style={styles.list}>
                {group.endpoints.map((endpoint) => (
                  <View key={`${endpoint.method}-${endpoint.path}`} style={styles.endpoint}>
                    <Text preset="caption" style={styles.method} color={COLORS.forestGreen}>{endpoint.method}</Text>
                    <View style={styles.endpointBody}>
                      <Text preset="caption" style={styles.path}>{endpoint.path}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{endpoint.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </Reveal>
        ))}
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, mb: { marginBottom: SPACING.sm }, list: { gap: SPACING.sm }, endpoint: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }, method: { fontWeight: '700', minWidth: 40 }, endpointBody: { flex: 1, gap: 2 }, path: { fontFamily: 'monospace' } });
