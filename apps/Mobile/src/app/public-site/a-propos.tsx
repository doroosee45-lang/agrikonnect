import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const PRINCIPLES = [
  { get title() { return tr('ui.mesureDeclare'); }, get body() { return tr('ui.uneValeurMesureePorteUneValeur'); } },
  { get title() { return tr('ui.aucuneStatistiqueInventee'); }, get body() { return tr('ui.unIndicateurNonPubliableResteVide'); } },
  { get title() { return tr('ui.contactsMasquesParDefaut'); }, get body() { return tr('ui.lesCoordonneesNeSontJamaisExposees'); } },
  { get title() { return tr('ui.anonymatParSeuil'); }, get body() { return tr('ui.lesAgregatsSousLeSeuilDe'); } },
  { get title() { return tr('ui.iaEncadree'); }, get body() { return tr('ui.touteSortieDIaEstSignalee'); } },
];

export default function PublicSiteAbout() {
  const { t } = useI18n();
  return (
    <PublicShell active="a-propos">
      <PageHeader index="05" eyebrow={t('ui.aPropos')} title={t('ui.laConfianceAgricoleMesuree')} subtitle={t('ui.agrikonnectAfricaRelieProducteursCooperativesAch_d9441')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {PRINCIPLES.map((principle, index) => (
            <Reveal key={principle.title} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <Text preset="h3">{principle.title}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>{principle.body}</Text>
              </Card>
            </Reveal>
          ))}
        </View>
        <Text preset="h3" style={styles.mt}>{t('ui.perimetreLivre')}</Text>
        <View style={styles.list}>
          {RELEASE_TRACK.map((release, index) => (
            <Reveal key={release.tag} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={release.tag} tone="success" size="sm" />
                  <Chip label={release.name} tone="neutral" size="sm" />
                </View>
                <Text preset="bodySm" color={COLORS.slateGray}>{release.body}</Text>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, list: { gap: SPACING.sm }, card: { gap: SPACING.xs }, mt: { marginTop: SPACING.lg, marginBottom: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs } });
