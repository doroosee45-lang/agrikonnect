import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Card, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const SECTIONS = [
  { key: 'map', title: 'Carte des exploitations', icon: 'map-outline', route: '/public-site/map' },
  { key: 'farmers', title: 'Producteurs', icon: 'people-outline', route: '/public-site/farmers' },
  { key: 'cooperatives', title: 'Coopératives', icon: 'business-outline', route: '/public-site/cooperatives' },
  { key: 'annonces', title: 'Annonces', icon: 'megaphone-outline', route: '/public-site/annonces' },
  { key: 'ventes', title: 'Ventes', icon: 'cart-outline', route: '/public-site/ventes' },
  { key: 'projets', title: 'Projets', icon: 'layers-outline', route: '/public-site/projets' },
  { key: 'tenders', title: 'Appels d\'offres', icon: 'document-text-outline', route: '/public-site/tenders' },
  { key: 'marches', title: 'Marchés', icon: 'pricetag-outline', route: '/public-site/marches' },
  { key: 'agriculture', title: 'Agriculture par pays', icon: 'globe-outline', route: '/public-site/agriculture' },
  { key: 'data', title: 'Données', icon: 'stats-chart-outline', route: '/public-site/data' },
  { key: 'faq', title: 'FAQ', icon: 'help-circle-outline', route: '/public-site/faq' },
  { key: 'contact', title: 'Contact', icon: 'mail-outline', route: '/public-site/contact' },
  { key: 'a-propos', title: 'À propos', icon: 'information-circle-outline', route: '/public-site/a-propos' },
  { key: 'services', title: 'Services', icon: 'briefcase-outline', route: '/public-site/services' },
  { key: 'transporters', title: 'Transporteurs', icon: 'car-outline', route: '/public-site/transporters' },
  { key: 'actualites', title: 'Actualités', icon: 'newspaper-outline', route: '/public-site/actualites' },
];

export default function PublicSiteIndex() {
  const { t } = useI18n();
  return (
    <PublicShell active="accueil">
      <Section index={1} eyebrow="Découverte" title="Explorez AGRIKONNECT" subtitle="Les pages publiques de la plateforme, accessibles sans compte." background={COLORS.naturalWhite} contentStyle={styles.section}>
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
