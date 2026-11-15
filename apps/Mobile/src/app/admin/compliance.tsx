import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function AdminCompliance() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.conformite')} subtitle={t('ui.rgpdConservationDesDonneesDroitsDes')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.conformite')} icon="shield-checkmark-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>{t('ui.registreDesTraitements')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.chaqueTraitementDeDonneesPersonnellesEst')}</Text>
          </Card>
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>{t('ui.droitsDesPersonnes')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.accesRectificationEffacementOppositionPortabilit')}</Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.lesDureesDeConservationParDefaut')}</Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
