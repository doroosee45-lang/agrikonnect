import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const GROUPS = [
  { get title() { return tr('ui.donneesPubliques'); }, endpoints: [
    { method: 'GET', path: '/public/farms', get description() { return tr('ui.listeDesExploitationsPubliees'); } },
    { method: 'GET', path: '/public/farms/:slug', get description() { return tr('ui.fichePubliqueDUneExploitation'); } },
    { method: 'GET', path: '/public/map', get description() { return tr('ui.carteDesExploitationsPublieesGeojson'); } },
    { method: 'GET', path: '/public/lots/:code', get description() { return tr('ui.fichePubliqueDUnLotDe'); } },
    { method: 'GET', path: '/public/soil-stats', get description() { return tr('ui.statistiquesDeSolAgregeesKAnonymite'); } },
  ]},
  { get title() { return tr('ui.references'); }, endpoints: [
    { method: 'GET', path: '/crops', get description() { return tr('ui.referentielDesCultures'); } },
    { method: 'GET', path: '/countries', get description() { return tr('ui.referentielDesPays'); } },
  ]},
  { get title() { return tr('ui.prixEtMeteo'); }, endpoints: [
    { method: 'GET', path: '/prices', get description() { return tr('ui.prixDeMarcheParCultureEt'); } },
    { method: 'GET', path: '/weather', get description() { return tr('ui.previsionsMeteorologiques'); } },
  ]},
];

export default function DevelopersDocs() {
  const { t } = useI18n();
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.documentation')} subtitle={t('ui.endpointsAccessiblesAvecUneCleApi_8aa90')} />
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
