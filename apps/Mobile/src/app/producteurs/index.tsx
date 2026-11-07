import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  LoadingState,
  PressableCard,
  Progress,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const MODULES = [
  { href: '/farmer/farms', label: 'Exploitations', icon: 'home-outline', hint: 'Identité et publication' },
  { href: '/farmer/plots', label: 'Parcelles', icon: 'map-outline', hint: 'Surface et localisation' },
  { href: '/farmer/productions', label: 'Récoltes', icon: 'leaf-outline', hint: 'Volumes par saison' },
  { href: '/farmer/soil', label: 'Sol', icon: 'flask-outline', hint: 'Analyses et profil' },
  { href: '/ventes', label: 'Mes ventes', icon: 'pricetag-outline', hint: 'Annonces et commandes' },
  { href: '/cooperatives', label: 'Coopérative', icon: 'people-outline', hint: 'Membres et volumes' },
] as const;

/** Espace producteur : dossier, compteurs réels et accès aux modules. */
export default function Producteurs() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const user = useAuthStore((state) => state.user);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const completeness = me.data?.completeness;
  const counts = me.data?.counts;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('farmer.title')} subtitle="Votre dossier, vos données et vos modules de travail." showNotifications />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Espace producteur"
          description="Connectez-vous pour gérer vos exploitations, parcelles, récoltes et analyses de sol."
          icon="leaf-outline"
        >
          {me.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : me.isError ? (
            <ErrorState error={me.error} onRetry={() => void me.refetch()} />
          ) : (
            <>
              <Card tone="ink" style={styles.header}>
                <View style={styles.headerRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="person-outline" size={18} color={COLORS.gold} />
                  </View>
                  <View style={styles.headerText}>
                    <Text preset="overline" color={COLORS.gold}>
                      Compte producteur
                    </Text>
                    <Text preset="h2" color={COLORS.pureWhite}>
                      {user ? `${user.firstName} ${user.lastName}` : '—'}
                    </Text>
                    <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                      {user?.countryCode ?? '—'} · {user?.email ?? user?.phone ?? 'contact non renseigné'}
                    </Text>
                  </View>
                </View>

                {completeness ? (
                  <View style={styles.completeness}>
                    <Text preset="caption" color="rgba(246, 247, 242, 0.8)">
                      Dossier complété à {completeness.percent} % · {completeness.done}/{completeness.total} critères
                    </Text>
                    <Progress value={completeness.percent} tone="gold" />
                    {completeness.missing.length > 0 ? (
                      <ChipRow>
                        {completeness.missing.slice(0, 4).map((item) => (
                          <Chip key={item} label={item} tone="gold" size="sm" />
                        ))}
                      </ChipRow>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.counts}>
                  {[
                    { label: 'Exploitations', value: counts?.farms ?? 0 },
                    { label: 'Parcelles', value: counts?.plots ?? 0 },
                    { label: 'Récoltes', value: counts?.productions ?? 0 },
                  ].map((item) => (
                    <View key={item.label} style={styles.count}>
                      <Text preset="numeric" color={COLORS.pureWhite}>
                        {formatNumber(item.value, locale)}
                      </Text>
                      <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              <View style={[styles.grid, wide ? styles.gridWide : null]}>
                {MODULES.map((module, index) => (
                  <Reveal key={module.href} index={index % 3} variant="up" style={styles.item}>
                    <PressableCard onPress={() => router.push(module.href as never)} style={styles.moduleCard}>
                      <View style={styles.moduleIcon}>
                        <Ionicons name={module.icon} size={17} color={COLORS.forestGreen} />
                      </View>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {module.label}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {module.hint}
                      </Text>
                    </PressableCard>
                  </Reveal>
                ))}
              </View>

              <Card tone="pale" style={styles.note}>
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.info} />
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  Vos données vous appartiennent : chaque valeur porte sa source (déclarée ou mesurée) et sa date.
                  Rien n’est publié sans votre choix explicite, et les coordonnées restent masquées par défaut.
                </Text>
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  header: { gap: SPACING.md },
  headerRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(214, 166, 79, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  completeness: { gap: SPACING.xs },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xl },
  count: { gap: 2 },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 250 },
  moduleCard: { gap: SPACING.xs, alignItems: 'flex-start' },
  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
});
