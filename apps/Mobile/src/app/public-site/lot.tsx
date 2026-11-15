import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Input, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const RULES = [
  { get title() { return tr('ui.leProducteurChoisit'); }, get body() { return tr('ui.seulsLesChampsQuIlPublie'); } },
  { get title() { return tr('ui.pasDActeurPasDeLieu'); }, get body() { return tr('ui.leJournalPublicNeContientQue'); } },
  { get title() { return tr('ui.pasUneCertification'); }, get body() { return tr('ui.laFichePubliqueEstDeclarativeElle'); } },
];

/** Recherche d'un lot par son code. */
export default function LotSearch() {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = touched && code.trim().length < 6;

  return (
    <PublicShell active="accueil">
      <PageHeader
        index={1}
        eyebrow={t('ui.tracabilite')}
        title={t('ui.verifierUnLot')}
        subtitle={t('ui.saisissezLeCodeFigurantSurL')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.form}>
            <Input
              label={t('ui.codeDeLot')}
              value={code}
              onChangeText={(value) => {
                setCode(value.toUpperCase());
                setTouched(false);
              }}
              onBlur={() => setTouched(true)}
              placeholder="AK-CI-2026-00001"
              autoCapitalize="characters"
              autoCorrect={false}
              icon="qr-code-outline"
              error={invalid ? t('ui.lotCodeIncomplete') : null}
              helper={t('ui.formatObserveAkPaysAnneeSequence')}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (code.trim().length < 6) {
                  setTouched(true);
                  return;
                }
                router.push(`/public-site/lot/${code.trim()}` as never);
              }}
            />
            <Button
              label={t('ui.afficherLaFiche')}
              variant="primary"
              icon="search"
              fullWidth
              onPress={() => {
                if (code.trim().length < 6) {
                  setTouched(true);
                  return;
                }
                router.push(`/public-site/lot/${code.trim()}` as never);
              }}
            />
          </Card>
        </Reveal>

        <View style={styles.rules}>
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} index={index} variant="up">
              <Card tone="pale" style={styles.rule}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.forestGreen} />
                <View style={styles.ruleBody}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    {rule.title}
                  </Text>
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {rule.body}
                  </Text>
                </View>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.xl },
  lineHeight: { lineHeight: 20 },
  form: { gap: SPACING.md },
  rules: { gap: SPACING.md },
  rule: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  ruleBody: { flex: 1, gap: 2 },
});
