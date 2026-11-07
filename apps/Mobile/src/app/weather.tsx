import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  AdvisoryNotice,
  AuthGate,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi, weatherApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { CREME } from '../theme/agrikonnect';

/**
 * Météo par parcelle.
 *
 * La donnée est toujours rattachée à une parcelle (ou à des coordonnées
 * explicites) et porte sa source, sa date et son niveau de confiance. Au-delà de
 * 24 heures, le serveur renvoie un avertissement de fraîcheur : on l’affiche.
 */
export default function Weather() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [plotId, setPlotId] = useState<string | null>(null);

  const plots = useQuery({
    queryKey: queryKeys.plots.list({}),
    queryFn: () => plotApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const activePlotId = plotId ?? plots.data?.[0]?.id ?? null;

  const weather = useQuery({
    queryKey: queryKeys.weather.forPlot(activePlotId ?? '', { limit: 24 }),
    queryFn: () => weatherApi.forPlot(activePlotId as string, { limit: 24 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(activePlotId),
  });

  const items = plots.data ?? [];

  return (
    <PublicShell active="weather">
      <PageHeader
        index={1}
        eyebrow="Données"
        title="Météo agricole"
        subtitle="Observations rattachées à vos parcelles, avec leur source et leur âge. Aucune prévision n’est inventée pour combler un manque de donnée."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="La météo est rattachée à vos parcelles"
          description="Connectez-vous pour sélectionner une parcelle et consulter les observations enregistrées."
          icon="partly-sunny-outline"
        >
          {plots.isLoading ? (
            <LoadingState count={1} height={70} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune parcelle"
              description="La météo s’appuie sur la localisation d’une parcelle. Créez-en une pour activer ce service."
              icon="map-outline"
              action={{ label: 'Créer une parcelle', onPress: () => router.push('/farmer/plots') }}
            />
          ) : (
            <>
              <Reveal variant="up">
                <ChipRow>
                  {items.map((plot) => (
                    <FilterChip
                      key={plot.id}
                      label={plot.name}
                      active={plot.id === activePlotId}
                      onPress={() => setPlotId(plot.id)}
                    />
                  ))}
                </ChipRow>
              </Reveal>

              {weather.isLoading ? (
                <LoadingState count={2} height={110} />
              ) : weather.isError ? (
                <ErrorState error={weather.error} onRetry={() => void weather.refetch()} />
              ) : weather.data && weather.data.available === false ? (
                <Card tone="pale" style={styles.notice}>
                  <Ionicons name="cloud-offline-outline" size={18} color={COLORS.warning} />
                  <View style={styles.noticeText}>
                    <Text preset="bodySm" color={COLORS.textPrimary} style={styles.lineHeight}>
                      {weather.data.message}
                    </Text>
                    {weather.data.actionSuggestion ? (
                      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                        {weather.data.actionSuggestion}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ) : weather.data ? (
                <View style={[styles.layout, wide ? styles.layoutWide : null]}>
                  <Reveal variant="left" style={styles.column}>
                    <Card tone="ink" style={styles.latest}>
                      <View style={styles.latestHeader}>
                        <Text preset="overline" color={COLORS.gold}>
                          Dernière observation
                        </Text>
                        <Chip
                          label={weather.data.freshness?.stale ? 'Donnée ancienne' : 'Fraîche'}
                          tone={weather.data.freshness?.stale ? 'warning' : 'success'}
                          size="sm"
                        />
                      </View>

                      <Text preset="display" color={CREME[100]}>
                        {weather.data.latest ? formatDate(weather.data.latest.observedAt, locale, 'datetime') : '—'}
                      </Text>

                      <View style={styles.latestMeta}>
                        <Chip label={`Source : ${weather.data.latest?.source ?? '—'}`} tone="neutral" size="sm" />
                        <Chip
                          label={`Confiance : ${weather.data.latest?.confidence ?? 'non précisée'}`}
                          tone="neutral"
                          size="sm"
                        />
                        {weather.data.freshness ? (
                          <Chip
                            label={`${weather.data.freshness.ageHours} h`}
                            tone={weather.data.freshness.stale ? 'warning' : 'success'}
                            size="sm"
                            icon="time-outline"
                          />
                        ) : null}
                      </View>

                      {weather.data.freshness?.warning ? (
                        <View style={styles.warning}>
                          <Ionicons name="alert-circle-outline" size={15} color={COLORS.gold} />
                          <Text preset="caption" color={CREME[100]} style={styles.lineHeight}>
                            {weather.data.freshness.warning}
                          </Text>
                        </View>
                      ) : null}

                      {weather.data.latest?.payload ? (
                        <View style={styles.payload}>
                          {Object.entries(weather.data.latest.payload).map(([key, value]) => (
                            <View key={key} style={styles.payloadRow}>
                              <Text preset="caption" color="rgba(246, 247, 242, 0.65)">
                                {key}
                              </Text>
                              <Text preset="bodyMedium" color={CREME[100]}>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </Card>
                  </Reveal>

                  <Reveal index={1} variant="right" style={styles.column}>
                    <Card tone="white" style={styles.history}>
                      <Text preset="overline" color={COLORS.livingGreen}>
                        Historique
                      </Text>
                      {(weather.data.records ?? []).length === 0 ? (
                        <Text preset="bodySm" color={COLORS.slateGray}>
                          Aucune observation enregistrée.
                        </Text>
                      ) : (
                        (weather.data.records ?? []).map((record) => (
                          <View key={record.id} style={styles.historyRow}>
                            <View style={styles.historyDot} />
                            <View style={styles.historyBody}>
                              <Text preset="bodyMedium" color={COLORS.textPrimary}>
                                {formatDate(record.observedAt, locale, 'datetime')}
                              </Text>
                              <Text preset="caption" color={COLORS.slateGray}>
                                {record.source}
                                {record.confidence ? ` · confiance ${record.confidence}` : ''}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </Card>
                  </Reveal>
                </View>
              ) : null}

              <AdvisoryNotice text="Une observation météo est datée et localisée : elle ne constitue pas une prévision de rendement." />
            </>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.lg },
  lineHeight: { lineHeight: 20 },
  notice: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  noticeText: { flex: 1, gap: SPACING.xs },
  layout: { gap: SPACING.md },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, gap: SPACING.md },
  latest: { gap: SPACING.md },
  latestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  latestMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  warning: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  payload: { gap: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(246,247,242,0.12)', paddingTop: SPACING.md },
  payloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: 4,
  },
  history: { gap: SPACING.md },
  historyRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: TINTS.livingGreenBg,
    marginTop: 6,
  },
  historyBody: { flex: 1, gap: 1 },
});
