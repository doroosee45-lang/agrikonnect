import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const BLOCKS = [
  {
    get title() { return tr('ui.comptes'); },
    get body() { return tr('ui.lInscriptionEnLibreServiceOuvre'); },
  },
  {
    get title() { return tr('ui.exactitudeDesDonnees'); },
    get body() { return tr('ui.chaqueInformationPorteSaProvenanceMesuree'); },
  },
  {
    get title() { return tr('ui.echangesCommerciaux'); },
    get body() { return tr('ui.lesAnnoncesOffresEtCommandesSont'); },
  },
  {
    get title() { return tr('ui.verification_bb27a'); },
    get body() { return tr('ui.uneDemandeDeVerificationEstInstruite'); },
  },
  {
    get title() { return tr('ui.accesAuxDocuments'); },
    get body() { return tr('ui.uneDataroomDonneUnAccesLimite'); },
  },
  {
    get title() { return tr('ui.apiEtExports'); },
    get body() { return tr('ui.lApiPubliqueFonctionneParCle'); },
  },
];

export default function Conditions() {
  const { t } = useI18n();
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow={t('ui.legal')} title={t('ui.conditionsDUtilisation_9074e')} subtitle={t('ui.lesReglesDUsageDeLa')} compact />
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
