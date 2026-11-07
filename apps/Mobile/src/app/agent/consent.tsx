import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const SCOPES = [
  { key: 'profile', icon: 'person-outline' as const, label: 'Profil et coordonnées', description: 'Identité du producteur, téléphone, email.' },
  { key: 'farm', icon: 'home-outline' as const, label: 'Exploitations et parcelles', description: 'Surfaces, localisation approximative, cultures.' },
  { key: 'production', icon: 'leaf-outline' as const, label: 'Productions', description: 'Volumes déclarés ou mesurés, rendements.' },
  { key: 'soil', icon: 'flask-outline' as const, label: 'Analyses de sol', description: 'Paramètres de sol et enquêtes de terrain.' },
  { key: 'market', icon: 'cart-outline' as const, label: 'Données de marché', description: 'Annonces, commandes, prix.' },
];

export default function AgentConsent() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Consentement" subtitle="Le consentement du producteur doit être enregistré avant toute saisie." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Consentement du producteur" description="En tant qu'agent de terrain, vous ne pouvez saisir des données pour un producteur qu'après avoir enregistré son consentement explicite, périmètre par périmètre." icon="hand-left-outline">
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
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Aucun consentement n'est présumé. Un producteur peut retirer un périmètre à tout moment ; les données déjà transmises restent soumises à la politique de conservation affichée dans les conditions d'utilisation.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, scope: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' }, scopeBody: { flex: 1, gap: 2 }, note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }, lineHeight: { lineHeight: 18 } });
