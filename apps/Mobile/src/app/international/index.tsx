import { StyleSheet, View } from 'react-native';
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
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useCountriesFromMap } from '@/hooks/usePublicData';
import { formatDate, formatNumber } from '@/lib/format';
import { tenderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  OPEN: 'success',
  PUBLISHED: 'success',
  CLOSED: 'neutral',
  AWARDED: 'info',
  EXPIRED: 'warning',
};

/** International : appels d'offres export et couverture pays réelle. */
export default function International() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const tenders = useQuery({
    queryKey: queryKeys.tenders.list({ limit: 30 }),
    queryFn: () => tenderApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const { countries, entries, isLoading: mapLoading } = useCountriesFromMap();

  const items = tenders.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="International" subtitle="Appels d'offres, destinations et couverture réelle par pays." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour consulter les appels d'offres et y répondre."
          icon="globe-outline"
        >
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Couverture constatée
            </Text>
            {mapLoading ? (
              <LoadingState count={1} height={60} />
            ) : countries.length === 0 ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                Aucune exploitation publiée pour le moment : la carte publique ne renvoie aucun pays.
              </Text>
            ) : (
              <>
                <ChipRow>
                  {entries.map(([code, count]) => (
                    <Chip key={code} label={`${code} · ${formatNumber(count, locale)}`} tone="neutral" size="sm" />
                  ))}
                </ChipRow>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  Décompte issu de la carte publique, positions arrondies. Aucun pays n’est affiché s’il n’a aucune
                  exploitation publiée.
                </Text>
              </>
            )}
          </Card>

          <Text preset="overline" color={COLORS.forestGreen}>
            Appels d’offres
          </Text>

          {tenders.isLoading ? (
            <LoadingState count={3} height={120} />
          ) : tenders.isError ? (
            <ErrorState error={tenders.error} onRetry={() => void tenders.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun appel d’offres"
              description="Les appels d'offres publiés par des acheteurs apparaîtront ici, avec leur échéance."
              icon="document-attach-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((tender, index) => (
                <Reveal key={tender.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                          {tender.title}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatNumber(tender.quantity, locale, 0)} {tender.unit} · destination {tender.destinationCountry}
                          {tender.deadline ? ` · échéance ${formatDate(tender.deadline, locale)}` : ''}
                        </Text>
                      </View>
                      <Chip label={tender.status} tone={STATUS_TONES[tender.status] ?? 'neutral'} size="sm" />
                    </View>

                    {tender.description ? (
                      <Text preset="caption" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {tender.description}
                      </Text>
                    ) : null}

                    {tender.certifications.length > 0 ? (
                      <ChipRow>
                        {tender.certifications.map((certification) => (
                          <Chip key={certification} label={certification} tone="success" size="sm" />
                        ))}
                      </ChipRow>
                    ) : null}

                    <View style={styles.actions}>
                      <Button label="Répondre" onPress={() => router.push('/tenders')} variant="outline" size="sm" icon="send-outline" />
                      <Text preset="caption" color={COLORS.slateGray}>
                        publiée le {formatDate(tender.createdAt, locale)}
                      </Text>
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Card tone="pale" style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Les documents d’export (certificats, listes de colisage) sont versionnés et horodatés. Une réponse à
              un appel d’offres engage sur les volumes déclarés : ils restent marqués comme déclarés tant qu’aucun
              contrôle n’a eu lieu.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  list: { gap: SPACING.md },
});
