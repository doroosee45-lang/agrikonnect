import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  Button,
  Card,
  Chip,
  Divider,
  ErrorState,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { usePublicLot } from '@/hooks/usePublicData';
import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Fiche publique d'un lot (`GET /public/lots/:code`). */
export default function LotDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { locale } = useI18n();
  const router = useRouter();

  const { data, isLoading, isError, error, refetch } = usePublicLot(code ?? null);

  return (
    <PublicShell active="accueil">
      <PageHeader
        index={1}
        eyebrow="Traçabilité"
        title={code ?? 'Lot'}
        subtitle="Fiche publique : champs publiés par le producteur, filière et journal des étapes."
        compact
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Button
          label="Chercher un autre lot"
          onPress={() => router.push('/public-site/lot')}
          variant="ghost"
          size="sm"
          icon="arrow-back"
        />

        {isLoading ? (
          <LoadingState count={1} height={200} />
        ) : isError ? (
          <Card tone="white" style={styles.error}>
            <Ionicons name="help-circle-outline" size={20} color={COLORS.warning} />
            <Text preset="bodyMedium" color={COLORS.textPrimary}>
              Aucun lot ne correspond à « {code} ».
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Vérifiez le code figurant sur l’étiquette, ou demandez au vendeur le QR du colis.
            </Text>
            <ErrorState error={error} onRetry={() => void refetch()} />
          </Card>
        ) : data ? (
          <Reveal variant="up">
            <Card tone="ink" style={styles.card}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text preset="overline" color={COLORS.gold}>
                    Lot
                  </Text>
                  <Text preset="display" color={DARK.text}>
                    {data.code}
                  </Text>
                </View>
                <Chip label={data.status} tone={data.status === 'RECALLED' ? 'error' : 'success'} />
              </View>

              <View style={styles.meta}>
                {data.crop ? <Chip label={`Filière : ${data.crop.name}`} tone="living" size="sm" /> : null}
                <Text preset="caption" color={DARK.textFaint}>
                  Créé le {formatDate(data.createdAt, locale, 'datetime')}
                </Text>
              </View>

              <Divider light />

              <Text preset="overline" color={COLORS.gold}>
                Champs publiés
              </Text>
              {Object.keys(data.published).length === 0 ? (
                <Text preset="bodySm" color={DARK.textFaint}>
                  Le producteur n’a publié aucun champ pour ce lot.
                </Text>
              ) : (
                <View style={styles.published}>
                  {Object.entries(data.published).map(([key, value]) => (
                    <View key={key} style={styles.publishedRow}>
                      <Text preset="caption" color={DARK.textMuted}>
                        {key}
                      </Text>
                      <Text preset="bodyMedium" color={DARK.text}>
                        {String(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Divider light />

              <Text preset="overline" color={COLORS.gold}>
                Journal des étapes
              </Text>
              {data.timeline.length === 0 ? (
                <Text preset="bodySm" color={DARK.textFaint}>
                  Aucune étape enregistrée.
                </Text>
              ) : (
                <View style={styles.timeline}>
                  {data.timeline.map((event, index) => (
                    <View key={`${event.type}-${event.at}`} style={styles.timelineRow}>
                      <View style={styles.timelineDotColumn}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: index === 0 ? COLORS.livingGreen : 'rgba(246,247,242,0.35)' },
                          ]}
                        />
                        {index < data.timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineBody}>
                        <Text preset="bodyMedium" color={DARK.text}>
                          {event.type}
                        </Text>
                        <Text preset="caption" color={DARK.textFaint}>
                          {formatDate(event.at, locale, 'datetime')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Card tone="ink" style={styles.notice}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.gold} />
                <Text preset="caption" color={DARK.textMuted} style={styles.lineHeight}>
                  {data.verification.note}
                </Text>
              </Card>

              <Text preset="caption" color={DARK.textFaint} style={styles.lineHeight}>
                {data.disclosure.rule} Champs non exposés : {data.disclosure.hiddenFields.join(', ')}.
              </Text>
            </Card>
          </Reveal>
        ) : null}
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.lg },
  lineHeight: { lineHeight: 19 },
  error: { gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  headerText: { gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  published: { gap: SPACING.sm },
  publishedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
  },
  timeline: { gap: SPACING.md },
  timelineRow: { flexDirection: 'row', gap: SPACING.md },
  timelineDotColumn: { alignItems: 'center', width: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineLine: { flex: 1, width: 1, backgroundColor: DARK.border, marginTop: 4 },
  timelineBody: { flex: 1, gap: 2 },
  notice: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
});
