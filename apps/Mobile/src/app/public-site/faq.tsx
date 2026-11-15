import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Accordion, Card, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const ITEMS = [
  { id: 'verification', get question() { return tr('ui.commentEstVerifieeUneExploitation'); }, get answer() { return tr('ui.uneDemandeDeVerificationEstInstruite_a8141'); } },
  { id: 'provenance', get question() { return tr('ui.queSignifieLeSymboleOu'); }, get answer() { return tr('ui.signaleUneValeurMesureeCapteurLaboratoire'); } },
  { id: 'agregats', get question() { return tr('ui.pourquoiCertainesStatistiquesSontEllesAbsentes'); }, get answer() { return tr('ui.unAgregatEstPublieSeulementSi'); } },
  { id: 'contacts', get question() { return tr('ui.puisJeVoirLeTelephoneD'); }, get answer() { return tr('ui.nonLesCoordonneesSontMasqueesPar'); } },
  { id: 'tracabilite', get question() { return tr('ui.commentFonctionneLaTracabiliteDUn'); }, get answer() { return tr('ui.chaqueLotPorteUnCodeUnique'); } },
  { id: 'ia', get question() { return tr('ui.lesReponsesDIaSontElles'); }, get answer() { return tr('ui.ellesSontToujoursSignaleesCommeSorties'); } },
  { id: 'offline', get question() { return tr('ui.puisJeUtiliserLApplicationHors'); }, get answer() { return tr('ui.faqOfflineAnswer'); } },
];

export default function PublicSiteFaq() {
  const { t } = useI18n();
  return (
    <PublicShell active="faq">
      <PageHeader index="07" eyebrow="FAQ" title={t('ui.questionsFrequentes')} subtitle={t('ui.lesReglesDePreuveDeConfidentialite')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Card tone="white">
          <Accordion items={ITEMS} />
        </Card>
        <Text preset="caption" color={COLORS.slateGray} style={styles.foot}>{t('ui.cesReglesSontAppliqueesCoteServeur')}</Text>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, foot: { marginTop: SPACING.xs } });
