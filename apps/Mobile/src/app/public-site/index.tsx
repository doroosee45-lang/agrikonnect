import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Card, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const SECTIONS = [
  { key: 'map', get title() { return tr('ui.carteDesExploitations'); }, icon: 'map-outline', route: '/public-site/map' },
  { key: 'farmers', get title() { return tr('ui.producteurs'); }, icon: 'people-outline', route: '/public-site/farmers' },
  { key: 'cooperatives', get title() { return tr('ui.cooperatives'); }, icon: 'business-outline', route: '/public-site/cooperatives' },
  { key: 'annonces', get title() { return tr('ui.annonces'); }, icon: 'megaphone-outline', route: '/public-site/annonces' },
  { key: 'ventes', get title() { return tr('ui.ventes'); }, icon: 'cart-outline', route: '/public-site/ventes' },
  { key: 'projets', get title() { return tr('ui.projets'); }, icon: 'layers-outline', route: '/public-site/projets' },
  { key: 'tenders', get title() { return tr('ui.appelsDOffres_907ea'); }, icon: 'document-text-outline', route: '/public-site/tenders' },
  { key: 'marches', get title() { return tr('ui.marches'); }, icon: 'pricetag-outline', route: '/public-site/marches' },
  { key: 'agriculture', get title() { return tr('ui.agricultureParPays'); }, icon: 'globe-outline', route: '/public-site/agriculture' },
  { key: 'data', get title() { return tr('ui.donnees'); }, icon: 'stats-chart-outline', route: '/public-site/data' },
  { key: 'faq', title: 'FAQ', icon: 'help-circle-outline', route: '/public-site/faq' },
  { key: 'contact', get title() { return tr('ui.contact'); }, icon: 'mail-outline', route: '/public-site/contact' },
  { key: 'a-propos', get title() { return tr('ui.aPropos'); }, icon: 'information-circle-outline', route: '/public-site/a-propos' },
  { key: 'services', get title() { return tr('ui.services'); }, icon: 'briefcase-outline', route: '/public-site/services' },
  { key: 'transporters', get title() { return tr('ui.transporteurs'); }, icon: 'car-outline', route: '/public-site/transporters' },
  { key: 'actualites', get title() { return tr('ui.actualites'); }, icon: 'newspaper-outline', route: '/public-site/actualites' },
];

export default function PublicSiteIndex() {
  const { t } = useI18n();
  return (
    <PublicShell active="accueil">
      <Section index={1} eyebrow={t('ui.decouverte')} title={t('ui.explorezAgrikonnect')} subtitle={t('ui.lesPagesPubliquesDeLaPlateforme')} background={COLORS.naturalWhite} contentStyle={styles.section}>
        <View style={styles.grid}>
          {SECTIONS.map((section, index) => (
            <Reveal key={section.key} index={index} variant="up">
              <PressableCard onPress={() => router.push(section.route as never)}>
                <View style={styles.row}>
                  <Text preset="bodyMedium">{section.title}</Text>
                </View>
              </PressableCard>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, grid: { gap: SPACING.sm }, row: { flexDirection: 'row', alignItems: 'center' } });
