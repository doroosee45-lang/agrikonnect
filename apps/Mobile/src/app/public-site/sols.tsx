import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  AdvisoryNotice,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { useSoilStats } from '@/hooks/usePublicData';
import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { VERT } from '../../theme/agrikonnect';

/** Statistiques de sol agrégées (`GET /public/soil-stats`), avec la règle de k-anonymat. */
export default function Soils() {
  const { locale } = useI18n();
  const { data, isLoading, isError, error, refetch } = useSoilStats();

  return (
    <PublicShell active="accueil">
      <PageHeader
        index={1}
        eyebrow="Données"
        title="Statistiques de sol"
        subtitle="Moyennes de paramètres mesurés, groupées par pays. Aucun rattachement à une parcelle ou à une exploitation identifiable."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {isLoading ? (
          <LoadingState count={2} height={120} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            title="Aucune statistique publiable"
            description={`Chaque groupe de moins de ${data?.kAnonymity ?? 10} analyses est supprimé plutôt qu’arrondi ou complété.`}
            icon="flask-outline"
          />
        ) : (
          <>
            <Reveal variant="up">
              <Card tone="ink" style={styles.rule}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.gold} />
                <View style={styles.ruleBody}>
                  <Text preset="bodyMedium" color={DARK.text}>
                    {data.provenance.rule}
                  </Text>
                  <Text preset="caption" color={DARK.textMuted} style={styles.lineHeight}>
                    {data.provenance.method} — {data.provenance.individuals}.
                  </Text>
                </View>
              </Card>
            </Reveal>

            {data.rows.map((row, index) => (
              <Reveal key={row.countryCode} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text preset="h2" color={COLORS.textPrimary}>
                      {row.countryCode}
                    </Text>
                    <Chip label={`${formatNumber(row.assessments, locale)} analyses`} tone="forest" size="sm" />
                  </View>

                  {row.parameters.length === 0 ? (
                    <Text preset="bodySm" color={COLORS.slateGray}>
                      Aucun paramètre n’atteint le seuil de publication.
                    </Text>
                  ) : (
                    <View style={styles.params}>
                      {row.parameters.map((parameter) => (
                        <View key={parameter.parameter} style={styles.paramRow}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {parameter.parameter}
                          </Text>
                          <View style={styles.paramValue}>
                            <Text preset="numeric" color={COLORS.forestGreen} style={styles.paramNumber}>
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

            {data.suppressedGroups.length > 0 ? (
              <Card tone="paper" style={styles.suppressed}>
                <Text preset="overline" color={COLORS.warning}>
                  Groupes supprimés
                </Text>
                {data.suppressedGroups.map((group) => (
                  <Text key={group.countryCode} preset="bodySm" color={COLORS.slateGray}>
                    {group.countryCode} — {group.assessments} analyses ({group.reason})
                  </Text>
                ))}
              </Card>
            ) : null}

            <AdvisoryNotice text="Ces moyennes décrivent un pays, pas un champ : elles ne remplacent pas une analyse de parcelle." />
          </>
        )}
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.md },
  lineHeight: { lineHeight: 20 },
  rule: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  ruleBody: { flex: 1, gap: SPACING.xs },
  card: { gap: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  params: { gap: SPACING.sm },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: VERT[100],
  },
  paramValue: { alignItems: 'flex-end', gap: 2 },
  paramNumber: { fontSize: 20, lineHeight: 24 },
  suppressed: { gap: SPACING.xs },
});
