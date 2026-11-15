import { Linking, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/** ADMIN — rapports et exports disponibles. */
export default function AdminReports() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.rapports')} subtitle={t('ui.exportsGeneresALaDemandeTraces')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.rapports')} icon="document-text-outline">
          <View style={styles.list}>
            <Reveal index={0} variant="up">
              <Card tone="white" style={styles.row}>
                <View style={styles.rowBody}>
                  <Text preset="bodyMedium">{t('ui.exportDesExploitations')}</Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.getAdminExportFarmsFichierGenere')}</Text>
                </View>
                <Button label={t('ui.telecharger')} onPress={() => void Linking.openURL(adminApi.exportFarms())} variant="outline" size="sm" />
              </Card>
            </Reveal>

            <Card tone="pale">
              <Text preset="caption" color={COLORS.textPrimary}>{t('ui.lesExportsNeContiennentJamaisDe')}</Text>
            </Card>
          </View>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowBody: { flex: 1, gap: 2 },
});
