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
import { useI18n, tr } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { insightsApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const INDICATOR_LABELS: Record<string, string> = {
  get producers() { return tr('ui.organisationsProductrices'); },
  get cultivatedAreaHa() { return tr('ui.surfaceCultivee'); },
  get volumeKg() { return tr('ui.volumeDeclare'); },
  get listings() { return tr('ui.annoncesPubliees'); },
  get projects() { return tr('ui.projetsPublies'); },
  get exportValue() { return tr('ui.valeurExport'); },
};

/**
 * Insights pays (INS-01 → INS-04).
 *
 * Chaque indicateur porte sa source, sa méthode et son horodatage. Un groupe
 * sous le seuil de k-anonymat renvoie `null` avec son motif : aucune valeur
 * n'est inventée et aucun zéro de complaisance n'est affiché.
 */
export default function Insights() {
  const { t } = useI18n();
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
      <AppHeader title={t('ui.insightsPays')} subtitle={t('ui.agregatsPubliesSousKAnonymatAvec')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourConsulterLesAgregats')}
          icon="bar-chart-outline"
        >
          <Card tone="white" style={styles.card}>
            <Input
              label={t('ui.paysCodeIsoA2Lettres')}
              value={countryCode}
              onChangeText={(value) => setCountryCode(value.toUpperCase().slice(0, 2))}
              placeholder="CI"
              icon="globe-outline"
              maxLength={2}
              error={countryCode.length === 2 ? null : t('ui.countryCodeTwoLetters')}
            />
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.seuilDePublicationOrganisationsMinimumPar', { value: policy.data?.minGroupSize ?? '—' })}</Text>
          </Card>

          {overview.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
          ) : overview.data?.disclosure?.empty ? (
            <EmptyState
              title={t('ui.aucunIndicateurPubliable')}
              description={overview.data.disclosure.message ?? t('ui.aucuneOrganisationEnregistreePourCePays')}
              icon="bar-chart-outline"
            />
          ) : indicators.length === 0 ? (
            <EmptyState title={t('ui.aucunIndicateur')} description={t('ui.saisissezUnCodePaysValide')} icon="search-outline" />
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
                        : t('ui.nonPublie')}
                    </Text>
                    {indicator.value === null && indicator.reason ? (
                      <Chip label={indicator.reason} tone="warning" size="sm" />
                    ) : null}
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.sourceMethode', { source: indicator.source, method: indicator.method })}</Text>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.volumesParCulture')}</Text>
          {crops.isLoading ? (
            <LoadingState count={2} height={90} />
          ) : crops.isError ? (
            <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
          ) : (crops.data?.crops ?? []).length === 0 ? (
            <EmptyState
              title={t('ui.aucuneCulturePubliable')}
              description={
                crops.data?.suppressedNote ??
                t('ui.lesCulturesRepresenteesParMoinsD')
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
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.organisationS', { organizations: formatNumber(row.organizations, locale), method: row.method })}</Text>
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
            <Text preset="caption" color={COLORS.slateGray}>{t('ui.donneesPersonnelles', { personalData: crops.data.disclosure.personalData, caveat: crops.data.disclosure.caveat })}</Text>
          ) : null}

          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.activiteMensuelle')}</Text>
          {activity.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
          ) : (activity.data?.series ?? []).length === 0 ? (
            <EmptyState
              title={t('ui.serieNonPubliee')}
              description={activity.data?.suppressedReason ?? t('ui.pasAssezDOrganisationsActivesSur')}
              icon="trending-up-outline"
            />
          ) : (
            <Card tone="white" style={styles.card}>
              {activity.data?.series.map((row) => (
                <View key={row.period} style={styles.activityRow}>
                  <Text preset="caption" color={COLORS.textPrimary} style={styles.activityPeriod}>
                    {row.period}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.annonceSCommandeSProjetS', { listings: formatNumber(row.listings, locale), orders: formatNumber(row.orders, locale), projects: formatNumber(row.projects, locale) })}</Text>
                </View>
              ))}
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                {activity.data?.provenance.method}
              </Text>
            </Card>
          )}

          {policy.data ? (
            <Card tone="ink" style={styles.policy}>
              <Text preset="overline" color={COLORS.gold}>{t('ui.politiqueDeDivulgation')}</Text>
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
