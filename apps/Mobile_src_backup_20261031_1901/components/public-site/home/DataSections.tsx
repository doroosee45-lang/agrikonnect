import { VERT } from '../../../theme/agrikonnect';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';
import { RequestError } from '@/services/api/types';
import { usePublicLot, useSoilStats } from '@/hooks/usePublicData';

import {
  AdvisoryNotice,
  Button,
  Card,
  Chip,
  Divider,
  ErrorState,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Section,
  Text,
} from '@/components/ui';

/**
 * Section 8 — traçabilité d'un lot.
 *
 * La recherche appelle réellement `GET /public/lots/:code`. La fiche renvoyée
 * rappelle elle-même qu'elle n'est pas une certification : on affiche cette
 * mention sans l'édulcorer.
 */
export function TraceSection() {
  const { t, locale } = useI18n();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const { data, isLoading, isError, error, refetch } = usePublicLot(submitted);
  const notFound = error instanceof RequestError && error.status === 404;

  return (
    <Section
      index={6}
      eyebrow="Traçabilité"
      title={t('home.traceTitle')}
      subtitle={t('home.traceSubtitle')}
      background={COLORS.naturalWhite}
    >
      <View style={[styles.traceLayout, wide ? styles.traceLayoutWide : null]}>
        <Reveal variant="left" style={styles.traceForm}>
          <Card tone="white" style={styles.traceCard}>
            <Input
              label="Code de lot"
              value={code}
              onChangeText={(value) => setCode(value.toUpperCase())}
              placeholder={t('home.tracePlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              icon="qr-code-outline"
              helper="Le code figure sur l’étiquette ou le QR collé sur le colis."
              onSubmitEditing={() => setSubmitted(code.trim() || null)}
              returnKeyType="search"
            />
            <Button
              label={t('home.traceCheck')}
              onPress={() => setSubmitted(code.trim() || null)}
              variant="primary"
              icon="search"
              fullWidth
              loading={isLoading}
            />
          </Card>
        </Reveal>

        <Reveal index={1} variant="right" style={styles.traceResult}>
          {submitted === null ? (
            <Card tone="pale" style={styles.traceHint}>
              <Ionicons name="scan-outline" size={22} color={COLORS.forestGreen} />
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                Saisissez un code pour afficher la fiche publique : champs publiés par le producteur,
                filière et journal des étapes.
              </Text>
            </Card>
          ) : isLoading ? (
            <LoadingState count={1} height={180} />
          ) : isError ? (
            notFound ? (
              <Card tone="white" style={styles.traceHint}>
                <Ionicons name="help-circle-outline" size={22} color={COLORS.warning} />
                <Text preset="bodyMedium" color={COLORS.textPrimary}>
                  Aucun lot ne correspond à « {submitted} ».
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                  Vérifiez le code, ou demandez au vendeur le QR figurant sur le colis.
                </Text>
              </Card>
            ) : (
              <ErrorState error={error} onRetry={() => void refetch()} />
            )
          ) : data ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)}>
              <Card tone="ink" style={styles.lotCard}>
                <View style={styles.lotHeader}>
                  <View>
                    <Text preset="overline" color={COLORS.gold}>
                      Lot
                    </Text>
                    <Text preset="h2" color={DARK.text}>
                      {data.code}
                    </Text>
                  </View>
                  <Chip
                    label={data.status}
                    tone={data.status === 'RECALLED' ? 'error' : 'success'}
                    size="sm"
                  />
                </View>

                <View style={styles.lotMeta}>
                  {data.crop ? (
                    <Text preset="caption" color={DARK.textMuted}>
                      Filière : {data.crop.name}
                    </Text>
                  ) : null}
                  <Text preset="caption" color={DARK.textMuted}>
                    Créé {formatRelative(data.createdAt, locale)}
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
                  <View style={styles.publishedList}>
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

                <Card tone="ink" style={styles.lotWarning}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.gold} />
                  <Text preset="caption" color={DARK.textMuted} style={styles.lineHeight}>
                    {data.verification.note}
                  </Text>
                </Card>

                <Text preset="caption" color={DARK.textFaint} style={styles.lineHeight}>
                  {data.disclosure.rule}
                </Text>
              </Card>
            </Animated.View>
          ) : null}
        </Reveal>
      </View>
    </Section>
  );
}

/**
 * Section 9 — statistiques de sol agrégées.
 *
 * Affichage brut de `GET /public/soil-stats`, y compris les groupes supprimés
 * par le k-anonymat : la règle de protection fait partie de l'information.
 */
export function SoilSection() {
  const { t, locale } = useI18n();
  const { data, isLoading, isError, error, refetch } = useSoilStats();

  return (
    <Section
      index={7}
      eyebrow="Données de sol"
      title="Ce que le réseau sait des sols"
      subtitle="Moyennes de paramètres mesurés, groupées par pays. Aucun rattachement à une parcelle ou à une exploitation identifiable."
      background={COLORS.pureWhite}
    >
      {isLoading ? (
        <LoadingState count={2} height={120} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <Card tone="paper">
          <Text preset="bodySm" color={COLORS.slateGray}>
            Aucune statistique publiable : chaque groupe de moins de {data?.kAnonymity ?? 10} analyses est
            supprimé plutôt qu’arrondi ou complété.
          </Text>
        </Card>
      ) : (
        <View style={styles.soilLayout}>
          {data.rows.map((row, index) => (
            <Reveal key={row.countryCode} index={index} variant="up">
              <Card tone="white" style={styles.soilCard}>
                <View style={styles.soilHeader}>
                  <Text preset="h2" color={COLORS.textPrimary}>
                    {row.countryCode}
                  </Text>
                  <Chip label={`${formatNumber(row.assessments, locale)} analyses`} tone="forest" size="sm" />
                </View>

                {row.parameters.length === 0 ? (
                  <Text preset="bodySm" color={COLORS.slateGray}>
                    Aucun paramètre atteint le seuil de publication.
                  </Text>
                ) : (
                  <View style={styles.paramList}>
                    {row.parameters.map((parameter) => (
                      <View key={parameter.parameter} style={styles.paramRow}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {parameter.parameter}
                        </Text>
                        <View style={styles.paramValueRow}>
                          <Text preset="numeric" color={COLORS.forestGreen} style={styles.paramValue}>
                            {formatNumber(parameter.mean, locale, 2)}
                          </Text>
                          <ProvenanceTag kind="measured" label={`${parameter.samples} échantillons`} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {row.withheldParameters.length > 0 ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Non publiés (trop peu de mesures) : {row.withheldParameters.join(', ')}
                  </Text>
                ) : null}
              </Card>
            </Reveal>
          ))}

          <Reveal variant="fade">
            <Card tone="pale" style={styles.soilRule}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.forestGreen} />
              <View style={styles.soilRuleBody}>
                <Text preset="bodyMedium" color={COLORS.textPrimary}>
                  {data.provenance.rule}
                </Text>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  {data.provenance.method} — {data.provenance.individuals}.
                </Text>
                {data.suppressedGroups.length > 0 ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Groupes supprimés : {data.suppressedGroups.map((g) => `${g.countryCode} (${g.assessments})`).join(', ')}.
                  </Text>
                ) : null}
              </View>
            </Card>
          </Reveal>
        </View>
      )}
    </Section>
  );
}

/**
 * Section 10 — le moteur de diagnostic.
 *
 * Les fiabilités affichées sont les constantes réelles du moteur géospatial ;
 * l'avertissement final est obligatoire : la sortie est une aide à la décision.
 */
export function AiSection() {
  const { t } = useI18n();

  const ladder = [
    { label: 'Laboratoire', value: 0.95, color: COLORS.success },
    { label: 'Capteur terrain', value: 0.85, color: COLORS.success },
    { label: 'Drone', value: 0.8, color: COLORS.info },
    { label: 'Satellite', value: 0.7, color: COLORS.info },
    { label: 'Photo terrain', value: 0.55, color: COLORS.warning },
    { label: 'Déclaré', value: 0.4, color: COLORS.slateGray },
  ];

  return (
    <View style={styles.aiWrapper}>
      <View style={styles.aiInner}>
        <View style={styles.aiGrid}>
          <Reveal variant="left" style={styles.aiText}>
            <Text preset="overline" color={COLORS.gold}>
              Aide à la décision
            </Text>
            <Text preset="display" color={DARK.text} style={styles.aiTitle}>
              {t('home.aiTitle')}
            </Text>
            <Text preset="lead" color="rgba(246, 247, 242, 0.74)" style={styles.lineHeight}>
              {t('home.aiSubtitle')}
            </Text>

            <View style={styles.aiBullets}>
              {[
                'Poids d’une source = fiabilité × qualité × fraîcheur (demi-vie 365 jours).',
                'Les sources en désaccord sont affichées, pas moyennées en silence.',
                'Le moteur ne déclenche aucune recommandation automatique.',
              ].map((item) => (
                <View key={item} style={styles.aiBullet}>
                  <Ionicons name="checkmark" size={13} color={COLORS.livingGreen} />
                  <Text preset="bodySm" color="rgba(246, 247, 242, 0.8)" style={styles.lineHeight}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              label="Ouvrir mon diagnostic"
              onPress={() => router.push('/farmer/soil')}
              variant="gold"
              icon="flask-outline"
            />
          </Reveal>

          <Reveal index={1} variant="right" style={styles.aiLadder}>
            <Card tone="ink" style={styles.ladderCard}>
              <Text preset="overline" color={COLORS.gold}>
                Échelle de fiabilité
              </Text>
              {ladder.map((step) => (
                <View key={step.label} style={styles.ladderRow}>
                  <Text preset="caption" color={DARK.textMuted} style={styles.ladderLabel}>
                    {step.label}
                  </Text>
                  <View style={styles.ladderTrack}>
                    <View
                      style={[
                        styles.ladderFill,
                        { width: `${step.value * 100}%`, backgroundColor: step.color },
                      ]}
                    />
                  </View>
                  <Text preset="caption" color={DARK.text}>
                    {step.value.toFixed(2)}
                  </Text>
                </View>
              ))}
              <Text preset="caption" color={DARK.textFaint} style={styles.lineHeight}>
                Constantes du moteur géospatial (fiabilité de la source, avant pondération par la qualité
                et la fraîcheur de la mesure).
              </Text>
            </Card>
          </Reveal>
        </View>

        <Reveal variant="fade">
          <AdvisoryNotice text={t('home.aiWarning')} />
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineHeight: { lineHeight: 20 },
  traceLayout: { gap: SPACING.lg },
  traceLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  traceForm: { flex: 1 },
  traceResult: { flex: 1.2 },
  traceCard: { gap: SPACING.md },
  traceHint: { gap: SPACING.sm, alignItems: 'flex-start' },
  lotCard: { gap: SPACING.md },
  lotHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  lotMeta: { gap: 2 },
  publishedList: { gap: SPACING.sm },
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
  lotWarning: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  soilLayout: { gap: SPACING.md },
  soilCard: { gap: SPACING.md },
  soilHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paramList: { gap: SPACING.sm },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: VERT[100],
  },
  paramValueRow: { alignItems: 'flex-end', gap: 2 },
  paramValue: { fontSize: 20, lineHeight: 24 },
  soilRule: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  soilRuleBody: { flex: 1, gap: SPACING.xs },
  aiWrapper: { backgroundColor: DARK.bg, width: '100%' },
  aiInner: {
    paddingHorizontal: 20,
    paddingVertical: 56,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: SPACING.xl,
  },
  aiGrid: { gap: SPACING.xl },
  aiText: { gap: SPACING.md, flex: 1 },
  aiTitle: { maxWidth: 520 },
  aiBullets: { gap: SPACING.sm, marginVertical: SPACING.sm },
  aiBullet: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  aiLadder: { flex: 1 },
  ladderCard: { gap: SPACING.md },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  ladderLabel: { width: 104 },
  ladderTrack: { flex: 1, height: 6, borderRadius: RADIUS.pill, backgroundColor: 'rgba(246,247,242,0.12)' },
  ladderFill: { height: 6, borderRadius: RADIUS.pill },
});

export const SOIL_TINT = TINTS.successBg;
