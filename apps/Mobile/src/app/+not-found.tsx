import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <PublicShell active="accueil">
      <Section contentStyle={styles.section}>
        <Reveal variant="scale">
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.gold}>{t('ui.erreur404')}</Text>
            <Text preset="display" color={COLORS.textPrimary}>{t('ui.cettePageNExistePas')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.leCheminNeCorrespondAAucun', { pathname })}</Text>
            <View style={styles.actions}>
              <Button label={t('ui.retourALAccueil_ff242')} onPress={() => router.replace('/accueil')} variant="primary" icon="home-outline" />
              <Button label={t('ui.voirLAnnuaire_21320')} onPress={() => router.push('/farmers')} variant="outline" />
            </View>
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 120, paddingBottom: 80 },
  lineHeight: { lineHeight: 20 },
  card: { gap: SPACING.sm, maxWidth: 520, alignSelf: 'center', width: '100%' },
  actions: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap', marginTop: SPACING.sm },
});
