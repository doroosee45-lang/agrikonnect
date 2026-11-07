import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, ErrorState, LoadingState, PressableScale, Reveal, Section, Text } from '@/components/ui';
import { SUPPORTED_LOCALES, useI18n } from '@/i18n';
import { referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Préférences de pays et de langue. Le choix de langue est local ; le référentiel pays vient du backend. */
export default function PublicSiteCountryLanguage() {
  const { locale, setLocale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.countries.all,
    queryFn: () => referenceApi.countries().then((r) => r.data),
    retry: false,
  });
  const countries = query.data ?? [];
  return (
    <PublicShell active="country-language">
      <PageHeader index="12" eyebrow="Préférences" title="Pays et langue" subtitle="La langue s\u2019applique immédiatement à l\u2019interface ; le pays filtre les données affichées." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Card tone="white">
          <Text preset="h3" style={styles.mb}>Langue de l\u2019interface</Text>
          <View style={styles.chips}>
            {SUPPORTED_LOCALES.map((option) => {
              const active = locale === option.code;
              return (
                <PressableScale key={option.code} onPress={() => setLocale(option.code)} style={[styles.chip, active ? styles.chipActive : null]}>
                  <Text preset="bodySm" color={active ? COLORS.pureWhite : COLORS.textPrimary}>{option.native}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Card>
        <Text preset="h3">Pays disponibles</Text>
        {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (
          <View style={styles.list}>
            {countries.map((country, index) => (
              <Reveal key={country.code} index={index} variant="up">
                <PressableScale onPress={() => router.push(`/public-site/agriculture/${country.code}` as never)}>
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{country.name}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{country.locales.join(', ')} · {country.timezone}</Text>
                    </View>
                    <Chip label={country.defaultCurrency} tone="neutral" size="sm" />
                  </Card>
                </PressableScale>
              </Reveal>
            ))}
          </View>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  mb: { marginBottom: SPACING.sm },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.lightBorder, backgroundColor: COLORS.naturalWhite },
  chipActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
});
