import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FarmCard } from '@/components/public-site/FarmCard';
import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  Button,
  Card,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { useCountriesFromMap, usePublicFarms } from '@/hooks/usePublicData';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const PAGE_SIZE = 12;

/** Annuaire public des producteurs : recherche, filtre par pays, pagination. */
export default function Farmers() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, isError, error, refetch, isFetching } = usePublicFarms({
    limit,
    search: search.trim() || undefined,
    countryCode: country ?? undefined,
  });

  const { entries } = useCountriesFromMap({ limit: 300 });

  const farms = data?.items ?? [];
  const total = data?.meta?.total ?? 0;
  const countries = useMemo(() => entries.map(([code]) => code).slice(0, 8), [entries]);

  return (
    <PublicShell active="farmers">
      <PageHeader
        index={1}
        eyebrow="Annuaire"
        title="Les producteurs du réseau"
        subtitle="Fiches publiques : surface déclarée, cultures, statut de vérification. Les coordonnées restent masquées tant que le producteur ne les publie pas."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <View style={styles.filters}>
            <Input
              label="Rechercher"
              value={search}
              onChangeText={setSearch}
              placeholder="Nom de l’exploitation"
              icon="search-outline"
              autoCorrect={false}
            />
            {countries.length > 0 ? (
              <ChipRow>
                <FilterChip label="Tous les pays" active={country === null} onPress={() => setCountry(null)} />
                {countries.map((code) => (
                  <FilterChip
                    key={code}
                    label={code}
                    active={country === code}
                    onPress={() => setCountry(country === code ? null : code)}
                  />
                ))}
              </ChipRow>
            ) : null}
          </View>
        </Reveal>

        {isLoading ? (
          <LoadingState count={3} height={170} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : farms.length === 0 ? (
          <EmptyState
            title="Aucun profil ne correspond"
            description="Modifiez la recherche ou le filtre de pays. Les fiches apparaissent dès qu’un producteur publie son profil."
            icon="search-outline"
          />
        ) : (
          <>
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {farms.map((farm, index) => (
                <Reveal key={farm.slug} index={index % 3} variant="up" style={styles.item}>
                  <FarmCard farm={farm} locale={locale} />
                </Reveal>
              ))}
            </View>

            <Card tone="paper" style={styles.pager}>
              <View style={styles.pagerText}>
                <Ionicons name="layers-outline" size={15} color={COLORS.slateGray} />
                <Text preset="caption" color={COLORS.slateGray}>
                  {formatNumber(farms.length, locale)} affichés sur {formatNumber(total, locale)} profils publics
                  {isFetching ? ' · mise à jour…' : ''}
                </Text>
              </View>
              {farms.length < total ? (
                <Button
                  label="Charger plus"
                  onPress={() => setLimit((value) => value + PAGE_SIZE)}
                  variant="outline"
                  size="sm"
                  icon="add"
                />
              ) : null}
            </Card>
          </>
        )}
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.xl },
  filters: { gap: SPACING.md },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 270 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  pagerText: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
