import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { ContactCta } from '@/components/public-site/home/ClosingSections';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PressableCard,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { listingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const RULES = [
  {
    icon: 'chatbox-ellipses-outline' as const,
    title: 'Les coordonnées ne circulent pas',
    body: 'Le contact passe par la messagerie interne. Ni téléphone ni e-mail ne sont échangés par défaut.',
  },
  {
    icon: 'time-outline' as const,
    title: 'Chaque annonce a une durée',
    body: 'Une annonce porte une disponibilité et une expiration. Passé ce délai, elle n’est plus présentée.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'La modération laisse une trace',
    body: 'Une annonce signalée est instruite ; chaque changement de statut est journalisé et notifié.',
  },
];

/** Marché : annonces et demandes d’achat (espace de travail, compte requis). */
export default function Marches() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const listings = useQuery({
    queryKey: queryKeys.listings.list({ limit: 24 }),
    queryFn: () => listingApi.list({ limit: 24 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = listings.data ?? [];

  return (
    <PublicShell active="marches">
      <PageHeader
        index={1}
        eyebrow="Marché"
        title="Annonces, demandes et commandes"
        subtitle="Le marché est un espace de travail : les annonces y sont datées, les échanges tracés, les commandes suivies étape par étape."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Le marché est réservé aux comptes actifs"
          description="Créez un compte producteur, coopérative ou acheteur pour consulter les annonces, répondre à une demande et suivre vos commandes."
          icon="storefront-outline"
        >
          {listings.isLoading ? (
            <LoadingState count={3} height={140} />
          ) : listings.isError ? (
            <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune annonce publiée"
              description="Les annonces apparaissent dès qu’un membre publie un volume disponible ou une demande d’achat."
              icon="storefront-outline"
              action={{ label: 'Publier une annonce', onPress: () => router.push('/ventes') }}
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((item, index) => {
                const { title, quantity, unit, indicativePrice: price, currency, status, countryCode: country, certifications, availableFrom } = item;

                return (
                  <Reveal key={item.id} index={index % 3} variant="up" style={styles.item}>
                    <Card tone="white" style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Chip
                          label={status}
                          tone={status === 'PUBLISHED' ? 'success' : status === 'CLOSED' ? 'neutral' : 'warning'}
                          size="sm"
                        />
                        <Chip label={item.type} tone="forest" size="sm" />
                      </View>

                      <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                        {title}
                      </Text>

                      <View style={styles.metaRow}>
                        <Ionicons name="scale-outline" size={13} color={COLORS.slateGray} />
                        <Text preset="caption" color={COLORS.slateGray}>
                          {quantity !== null ? `${formatNumber(quantity, locale, 1)} ${unit}` : 'Volume non précisé'}
                          {country ? ` · ${country}` : ''}
                        </Text>
                      </View>

                      <View style={styles.priceRow}>
                        {price !== null ? (
                          <Text preset="numeric" color={COLORS.forestGreen} style={styles.price}>
                            {formatCurrency(price, currency, locale)}
                          </Text>
                        ) : (
                          <Text preset="bodySm" color={COLORS.slateGray}>
                            Prix indicatif non communiqué
                          </Text>
                        )}
                        <Text preset="caption" color={COLORS.slateGray}>
                          {availableFrom ? `Disponible ${formatDate(availableFrom, locale)}` : ''}
                        </Text>
                      </View>

                      {certifications.length > 0 ? (
                        <View style={styles.chipRow}>
                          {certifications.map((certification) => (
                            <Chip key={certification} label={certification} tone="gold" size="sm" />
                          ))}
                        </View>
                      ) : null}

                      <Button
                        label="Ouvrir la discussion"
                        variant="outline"
                        size="sm"
                        icon="chatbubble-ellipses-outline"
                        onPress={() => router.push('/messages')}
                      />
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>

      <Section
        index={2}
        eyebrow="Règles"
        title="Comment le marché protège les deux parties"
        background={COLORS.pureWhite}
      >
        <View style={[styles.rules, wide ? styles.rulesWide : null]}>
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} index={index} variant="up" style={styles.ruleItem}>
              <Card tone="pale" style={styles.ruleCard}>
                <Ionicons name={rule.icon} size={18} color={COLORS.forestGreen} />
                <Text preset="h3" color={COLORS.textPrimary}>
                  {rule.title}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                  {rule.body}
                </Text>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>

      {!isAuthenticated ? <ContactCta /> : null}
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 24 },
  lineHeight: { lineHeight: 20 },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 280 },
  card: { gap: SPACING.sm, height: '100%' },
  cardHeader: { flexDirection: 'row', gap: SPACING.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.sm },
  price: { fontSize: 22, lineHeight: 26 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  rules: { gap: SPACING.md },
  rulesWide: { flexDirection: 'row', flexWrap: 'wrap' },
  ruleItem: { flex: 1, minWidth: 250 },
  ruleCard: { gap: SPACING.sm, height: '100%' },
});

export const MARKET_TINT = TINTS.livingGreenBg;
