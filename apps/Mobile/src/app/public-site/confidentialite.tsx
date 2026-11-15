import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const BLOCKS = [
  {
    get title() { return tr('ui.ceQuiEstPublieParDefaut'); },
    get body() { return tr('ui.rienDePersonnelUneFichePublique'); },
  },
  {
    get title() { return tr('ui.positions'); },
    get body() { return tr('ui.lesCoordonneesAfficheesSurLesRoutes'); },
  },
  {
    get title() { return tr('ui.statistiques'); },
    get body() { return tr('ui.lesAgregatsSontSoumisAuK'); },
  },
  {
    get title() { return tr('ui.jetonsEtSession'); },
    get body() { return tr('ui.lesJetonsDAccesSontStockes'); },
  },
  {
    get title() { return tr('ui.medias'); },
    get body() { return tr('ui.lesImagesSontServiesParUrl'); },
  },
  {
    get title() { return tr('ui.messagerie'); },
    get body() { return tr('ui.lesEchangesCommerciauxPassentParLa'); },
  },
];

export default function Confidentialite() {
  const { t } = useI18n();
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow={t('ui.legal')} title={t('ui.confidentialite')} subtitle={t('ui.lesReglesAppliqueesParLaPlateforme')} compact />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {BLOCKS.map((block, index) => (
          <Reveal key={block.title} index={index % 3} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="h3" color={COLORS.textPrimary}>
                {block.title}
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                {block.body}
              </Text>
            </Card>
          </Reveal>
        ))}
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.md },
  lineHeight: { lineHeight: 21 },
  card: { gap: SPACING.sm },
});
