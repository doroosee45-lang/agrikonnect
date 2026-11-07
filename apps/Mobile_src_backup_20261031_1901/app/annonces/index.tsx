import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { listingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const TYPES = [
  { key: '', label: 'Toutes' },
  { key: 'OFFER', label: 'Offres' },
  { key: 'DEMAND', label: 'Demandes' },
] as const;

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  RESERVED: 'info',
  SOLD: 'neutral',
  EXPIRED: 'warning',
  CLOSED: 'neutral',
  MODERATED: 'warning',
};

/** Annonces du marché : volumes disponibles, prix indicatifs, statuts datés. */
export default function Annonces() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  const listings = useQuery({
    queryKey: queryKeys.listings.list({ type, limit: 50 }),
    queryFn: () => listingApi.list({ type: type || undefined, limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = (listings.data ?? []).filter((item) =>
    search.trim() ? item.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Annonces" subtitle="Volumes disponibles, prix indicatifs et disponibilité datée." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Le marché est réservé aux comptes actifs"
          description="Connectez-vous pour consulter les annonces et contacter un vendeur via la messagerie intégrée."
          icon="storefront-outline"
        >
          <View style={styles.filters}>
            <ChipRow>
              {TYPES.map((item) => (
                <FilterChip key={item.key || 'all'} label={item.label} active={type === item.key} onPress={() => setType(item.key)} />
              ))}
            </ChipRow>
            <Input label="" value={search} onChangeText={setSearch} placeholder="Rechercher dans les titres" icon="search-outline" />
            <Button label="Publier" onPress={() => router.push('/annonces/creer')} variant="primary" size="sm" icon="add" />
          </View>

          {listings.isLoading ? (
            <LoadingState count={3} height={140} />
          ) : listings.isError ? (
            <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune annonce"
              description="Publiez un volume disponible ou une demande d’achat : les annonces sont datées et modifiables, jamais anonymes."
              icon="storefront-outline"
              action={{ label: 'Publier une annonce', onPress: () => router.push('/annonces/creer') }}
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((item, index) => (
                <Reveal key={item.id} index={index % 3} variant="up" style={styles.item}>
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <Chip label={item.type} tone="forest" size="sm" />
                      <Chip label={item.status} tone={STATUS_TONES[item.status] ?? 'neutral'} size="sm" />
                    </View>

                    <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text preset="caption" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={styles.meta}>
                      <Ionicons name="scale-outline" size={13} color={COLORS.slateGray} />
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatNumber(item.quantity, locale, 1)} {item.unit} · {item.countryCode}
                        {item.province ? ` · ${item.province}` : ''}
                      </Text>
                    </View>

                    <View style={styles.priceRow}>
                      {item.indicativePrice !== null ? (
                        <Text preset="numeric" color={COLORS.forestGreen} style={styles.price}>
                          {formatCurrency(item.indicativePrice, item.currency, locale)}
                        </Text>
                      ) : (
                        <Text preset="bodySm" color={COLORS.slateGray}>
                          Prix indicatif non communiqué
                        </Text>
                      )}
                      <ProvenanceTag kind={item.source === 'declared' ? 'declared' : 'measured'} />
                    </View>

                    <View style={styles.foot}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {item.availableFrom ? `Disponible le ${formatDate(item.availableFrom, locale)}` : 'Disponibilité non précisée'}
                        {item.expiresAt ? ` · expire le ${formatDate(item.expiresAt, locale)}` : ''}
                      </Text>
                      <Button label="Ouvrir" onPress={() => router.push(`/annonces/${item.id}` as never)} variant="outline" size="sm" />
                    </View>

                    {item.certifications.length > 0 ? (
                      <ChipRow>
                        {item.certifications.map((certification) => (
                          <Chip key={certification} label={certification} tone="success" size="sm" />
                        ))}
                      </ChipRow>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  filters: { gap: SPACING.sm },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 280 },
  card: { gap: SPACING.sm },
  head: { flexDirection: 'row', gap: SPACING.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  price: { fontSize: 20 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, flexWrap: 'wrap' },
});
