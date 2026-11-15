import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

const SCOPES = [
  { key: 'profile', icon: 'person-outline' as const, get label() { return tr('ui.profilEtCoordonnees'); }, get description() { return tr('ui.identiteDuProducteurTelephoneEmail'); } },
  { key: 'farm', icon: 'home-outline' as const, get label() { return tr('ui.exploitationsEtParcelles'); }, get description() { return tr('ui.surfacesLocalisationApproximativeCultures'); } },
  { key: 'production', icon: 'leaf-outline' as const, get label() { return tr('ui.productions'); }, get description() { return tr('ui.volumesDeclaresOuMesuresRendements'); } },
  { key: 'soil', icon: 'flask-outline' as const, get label() { return tr('ui.analysesDeSol'); }, get description() { return tr('ui.parametresDeSolEtEnquetesDe'); } },
  { key: 'market', icon: 'cart-outline' as const, get label() { return tr('ui.donneesDeMarche'); }, get description() { return tr('ui.annoncesCommandesPrix'); } },
];

export default function AgentConsent() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.consentement')} subtitle={t('ui.leConsentementDuProducteurDoitEtre')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.consentementDuProducteur')} description={t('ui.enTantQuAgentDeTerrain_6d3ca')} icon="hand-left-outline">
          <View style={styles.list}>
            {SCOPES.map((scope, index) => (
              <Reveal key={scope.key} index={index} variant="up">
                <Card tone="white" style={styles.scope}>
                  <Ionicons name={scope.icon} size={22} color={COLORS.forestGreen} />
                  <View style={styles.scopeBody}>
                    <Text preset="bodyMedium">{scope.label}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>{scope.description}</Text>
                  </View>
                </Card>
              </Reveal>
            ))}
          </View>
          <Card tone="pale" style={styles.note}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.aucunConsentementNEstPresumeUn')}</Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, scope: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' }, scopeBody: { flex: 1, gap: 2 }, note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }, lineHeight: { lineHeight: 18 } });
