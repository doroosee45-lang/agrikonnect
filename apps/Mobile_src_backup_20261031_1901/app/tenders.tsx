import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { tenderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Appels d’offres : avis d’acheteurs, réponses tracées (espace authentifié). */
export default function Tenders() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const tenders = useQuery({
    queryKey: queryKeys.tenders.list({ limit: 20 }),
    queryFn: () => tenderApi.list({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = tenders.data ?? [];

  return (
    <PublicShell active="tenders">
      <PageHeader
        index={1}
        eyebrow="International"
        title="Appels d’offres"
        subtitle="Avis d’acheteurs avec volumes, exigences de qualité, certifications et délais. Les réponses sont tracées, l’attribution est journalisée."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Les appels d’offres sont réservés aux comptes actifs"
          description="Consulter un avis et y répondre suppose une organisation identifiée : c’est la condition de la traçabilité des échanges."
          icon="globe-outline"
        >
          {tenders.isLoading ? (
            <LoadingState count={3} height={150} />
          ) : tenders.isError ? (
            <ErrorState error={tenders.error} onRetry={() => void tenders.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun appel d’offres ouvert"
              description="Les avis publiés par les acheteurs apparaîtront ici, avec leur date limite."
              icon="globe-outline"
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((tender, index) => (
                <Reveal key={tender.id} index={index % 2} variant="up" style={styles.item}>
                  <Card tone="white" style={styles.card}>
                    <View style={styles.header}>
                      <Chip
                        label={tender.status}
                        tone={tender.status === 'OPEN' ? 'success' : tender.status === 'AWARDED' ? 'info' : 'neutral'}
                        size="sm"
                      />
                      <Chip label={tender.destinationCountry} tone="forest" size="sm" icon="navigate-outline" />
                    </View>

                    <Text preset="h3" color={COLORS.textPrimary}>
                      {tender.title}
                    </Text>

                    {tender.description ? (
                      <Text preset="bodySm" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {tender.description}
                      </Text>
                    ) : null}

                    <View style={styles.facts}>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Volume
                        </Text>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {formatNumber(tender.quantity, locale, 1)} {tender.unit}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Échéance
                        </Text>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {tender.deadline ? formatDate(tender.deadline, locale) : 'Non précisée'}
                        </Text>
                      </View>
                      {tender.quality ? (
                        <View style={styles.fact}>
                          <Text preset="caption" color={COLORS.slateGray}>
                            Qualité
                          </Text>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {tender.quality}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {tender.certifications.length > 0 ? (
                      <View style={styles.chips}>
                        {tender.certifications.map((certification) => (
                          <Chip key={certification} label={certification} tone="gold" size="sm" />
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.footer}>
                      <View style={styles.footerMeta}>
                        <Ionicons name="time-outline" size={13} color={COLORS.slateGray} />
                        <Text preset="caption" color={COLORS.slateGray}>
                          Publié {formatRelative(tender.createdAt, locale)}
                        </Text>
                      </View>
                      <Button
                        label="Répondre"
                        variant="outline"
                        size="sm"
                        icon="send-outline"
                        onPress={() => router.push('/requests')}
                      />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56 },
  lineHeight: { lineHeight: 20 },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 320 },
  card: { gap: SPACING.sm, height: '100%' },
  header: { flexDirection: 'row', gap: SPACING.xs },
  facts: { flexDirection: 'row', gap: SPACING.lg, flexWrap: 'wrap' },
  fact: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: 'auto',
    paddingTop: SPACING.sm,
  },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
