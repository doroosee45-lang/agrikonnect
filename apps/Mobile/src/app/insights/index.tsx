import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { insightsApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const INDICATOR_LABELS: Record<string, string> = {
  producers: 'Organisations productrices',
  cultivatedAreaHa: 'Surface cultivée',
  volumeKg: 'Volume déclaré',
  listings: 'Annonces publiées',
  projects: 'Projets publiés',
  exportValue: 'Valeur export',
};

/**
 * Insights pays (INS-01 → INS-04).
 *
 * Chaque indicateur porte sa source, sa méthode et son horodatage. Un groupe
 * sous le seuil de k-anonymat renvoie `null` avec son motif : aucune valeur
 * n'est inventée et aucun zéro de complaisance n'est affiché.
 */
export default function Insights() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [countryCode, setCountryCode] = useState('CI');

  const enabled = isAuthenticated && /^[A-Za-z]{2}$/.test(countryCode);
  const code = countryCode.toUpperCase();

  const overview = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode: code }),
    queryFn: () => insightsApi.overview({ countryCode: code }).then((result) => result.data),
    enabled,
  });
  const crops = useQuery({
    queryKey: queryKeys.insights.crops({ countryCode: code }),
    queryFn: () => insightsApi.crops({ countryCode: code }).then((result) => result.data),
    enabled,
  });
  const activity = useQuery({
    queryKey: [...queryKeys.insights.activity, code],
    queryFn: () => insightsApi.activity({ countryCode: code, months: 6 }).then((result) => result.data),
    enabled,
  });
  const policy = useQuery({
    queryKey: queryKeys.insights.disclosure,
    queryFn: () => insightsApi.disclosurePolicy().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const indicators = Object.entries(overview.data?.indicators ?? {});

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Insights pays" subtitle="Agrégats publiés sous k-anonymat, avec source et méthode." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour consulter les agrégats par pays."
          icon="bar-chart-outline"
        >
          <Card tone="white" style={styles.card}>
            <Input
              label="Pays (code ISO à 2 lettres)"
              value={countryCode}
              onChangeText={(value) => setCountryCode(value.toUpperCase().slice(0, 2))}
              placeholder="CI"
              icon="globe-outline"
              maxLength={2}
              error={countryCode.length === 2 ? null : 'Deux lettres attendues (ex. CI, SN, CD).'}
            />
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Seuil de publication : {policy.data?.minGroupSize ?? '—'} organisations minimum par agrégat. En
              dessous, la valeur est masquée avec son motif.
            </Text>
          </Card>

          {overview.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
          ) : overview.data?.disclosure?.empty ? (
            <EmptyState
              title="Aucun indicateur publiable"
              description={overview.data.disclosure.message ?? 'Aucune organisation enregistrée pour ce pays.'}
              icon="bar-chart-outline"
            />
          ) : indicators.length === 0 ? (
            <EmptyState title="Aucun indicateur" description="Saisissez un code pays valide." icon="search-outline" />
          ) : (
            <View style={styles.list}>
              {indicators.map(([key, indicator], index) => (
                <Reveal key={key} index={index % 3} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        {INDICATOR_LABELS[key] ?? key}
                      </Text>
                      <ProvenanceTag kind="measured" />
                    </View>
                    <Text preset="numeric" color={COLORS.forestGreen} style={styles.value}>
                      {indicator.value !== null
                        ? `${formatNumber(indicator.value, locale, 0)}${indicator.unit ? ` ${indicator.unit}` : ''}`
                        : 'non publié'}
                    </Text>
                    {indicator.value === null && indicator.reason ? (
                      <Chip label={indicator.reason} tone="warning" size="sm" />
                    ) : null}
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      Source : {indicator.source} · méthode : {indicator.method}
                    </Text>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Volumes par culture
          </Text>
          {crops.isLoading ? (
            <LoadingState count={2} height={90} />
          ) : crops.isError ? (
            <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
          ) : (crops.data?.crops ?? []).length === 0 ? (
            <EmptyState
              title="Aucune culture publiable"
              description={
                crops.data?.suppressedNote ??
                'Les cultures représentées par moins d’organisations que le seuil ne sont pas publiées.'
              }
              icon="leaf-outline"
            />
          ) : (
            <View style={styles.list}>
              {(crops.data?.crops ?? []).map((row, index) => (
                <Reveal key={row.crop.id} index={index % 3} variant="up">
                  <Card tone="white" style={styles.cropRow}>
                    <View style={styles.cropBody}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {row.crop.names?.fr ?? row.crop.slug ?? row.crop.id}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatNumber(row.organizations, locale)} organisation(s) · {row.method}
                      </Text>
                    </View>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(row.volumeKg, locale, 0)} kg
                    </Text>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          {crops.data?.suppressed ? (
            <Text preset="caption" color={COLORS.warning}>
              {crops.data.suppressedNote}
            </Text>
          ) : null}
          {crops.data?.disclosure ? (
            <Text preset="caption" color={COLORS.slateGray}>
              Données personnelles : {crops.data.disclosure.personalData} · {crops.data.disclosure.caveat}
            </Text>
          ) : null}

          <Text preset="overline" color={COLORS.forestGreen}>
            Activité mensuelle
          </Text>
          {activity.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
          ) : (activity.data?.series ?? []).length === 0 ? (
            <EmptyState
              title="Série non publiée"
              description={activity.data?.suppressedReason ?? 'Pas assez d’organisations actives sur la fenêtre pour publier une série.'}
              icon="trending-up-outline"
            />
          ) : (
            <Card tone="white" style={styles.card}>
              {activity.data?.series.map((row) => (
                <View key={row.period} style={styles.activityRow}>
                  <Text preset="caption" color={COLORS.textPrimary} style={styles.activityPeriod}>
                    {row.period}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {formatNumber(row.listings, locale)} annonce(s) · {formatNumber(row.orders, locale)} commande(s) ·{' '}
                    {formatNumber(row.projects, locale)} projet(s)
                  </Text>
                </View>
              ))}
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                {activity.data?.provenance.method}
              </Text>
            </Card>
          )}

          {policy.data ? (
            <Card tone="ink" style={styles.policy}>
              <Text preset="overline" color={COLORS.gold}>
                Politique de divulgation
              </Text>
              {policy.data.rules.map((rule) => (
                <View key={rule} style={styles.ruleRow}>
                  <Ionicons name="checkmark-outline" size={13} color={COLORS.gold} />
                  <Text preset="caption" color="rgba(246, 247, 242, 0.85)" style={styles.lineHeight}>
                    {rule}
                  </Text>
                </View>
              ))}
              <ChipRow>
                {policy.data.forbidden.map((item) => (
                  <Chip key={item} label={item} tone="gold" size="sm" />
                ))}
              </ChipRow>
            </Card>
          ) : null}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  card: { gap: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  value: { fontSize: 24, lineHeight: 28 },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cropBody: { flex: 1, gap: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  activityPeriod: { width: 62 },
  policy: { gap: SPACING.sm },
  ruleRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  list: { gap: SPACING.md },
});
