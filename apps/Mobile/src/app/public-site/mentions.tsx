import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function Mentions() {
  const { t } = useI18n();
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow={t('ui.legal')} title={t('ui.mentionsLegales')} subtitle={t('ui.ceQueCetteApplicationPublieEt')} compact />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>{t('ui.editeur')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.agrikonnectAfricaPlateformeDeMiseEn')}</Text>
          </Card>
        </Reveal>
        <Reveal index={1} variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>{t('ui.contenuPublie')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.lesFichesDeProducteursLesCartes')}</Text>
          </Card>
        </Reveal>
        <Reveal index={2} variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>{t('ui.limites')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.uneFichePubliqueDeLotEst')}</Text>
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.md },
  lineHeight: { lineHeight: 21 },
  card: { gap: SPACING.sm },
});
