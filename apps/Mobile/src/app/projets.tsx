import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  AuthGate,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const PROCESS = [
  { get title() { return tr('ui.depot'); }, get body() { return tr('ui.lePorteurDecritLeProjetPerimetre'); } },
  { get title() { return tr('ui.instruction'); }, get body() { return tr('ui.leDossierEstRevuChaqueDecision'); } },
  { get title() { return tr('ui.dataroom'); }, get body() { return tr('ui.lesPiecesSontAccessiblesPourUne'); } },
  { get title() { return tr('ui.suivi'); }, get body() { return tr('ui.rapportsDAvancementEtDImpact_07060'); } },
];

/** Projets d’investissement (espace authentifié) + explication publique du cycle. */
export default function Projets() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const projects = useQuery({
    queryKey: queryKeys.projects.list({ limit: 20 }),
    queryFn: () => projectApi.list({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = (projects.data ?? []) as Array<Record<string, unknown>>;

  return (
    <PublicShell active="projets">
      <PageHeader
        index={1}
        eyebrow={t('ui.investissement')}
        title={t('ui.projetsAgricoles')}
        subtitle={t('ui.dossiersStructuresAccesAuxPiecesLimite')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.lesDossiersSontReservesAuxComptes')}
          description={t('ui.unDossierDInvestissementContientDes')}
          icon="briefcase-outline"
        >
          {projects.isLoading ? (
            <LoadingState count={2} height={140} />
          ) : projects.isError ? (
            <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucunDossierVisible')}
              description={t('ui.lesProjetsAuxquelsVotreOrganisationA')}
              icon="briefcase-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((project, index) => (
                <Reveal key={String(project.id)} index={index % 2} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Chip
                        label={String(project.status ?? 'DRAFT')}
                        tone={project.status === 'APPROVED' ? 'success' : 'neutral'}
                        size="sm"
                      />
                      {typeof project.updatedAt === 'string' ? (
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.misAJour_ad4e7', { updatedAt: formatDate(project.updatedAt, locale) })}</Text>
                      ) : null}
                    </View>
                    <Text preset="h3" color={COLORS.textPrimary}>
                      {String(project.title ?? t('ui.projet'))}
                    </Text>
                    {typeof project.province === 'string' ? (
                      <Text preset="caption" color={COLORS.slateGray}>
                        {project.province}
                      </Text>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>

      <Section
        index={2}
        eyebrow={t('ui.cycle')}
        title={t('ui.duDepotAuReporting')}
        subtitle={t('ui.quatreEtapesToutesJournalisees')}
        background={COLORS.pureWhite}
      >
        <View style={[styles.process, wide ? styles.processWide : null]}>
          {PROCESS.map((step, index) => (
            <Reveal key={step.title} index={index} variant="up" style={styles.stepItem}>
              <Card tone="ink" style={styles.stepCard}>
                <Text preset="overline" color={COLORS.gold}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text preset="h3" color={DARK.text}>
                  {step.title}
                </Text>
                <Text preset="bodySm" color={DARK.textMuted} style={styles.lineHeight}>
                  {step.body}
                </Text>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>

      <Section index={3} eyebrow={t('ui.gardeFous')} title={t('ui.ceQueLaDataroomNeFait')} background={COLORS.naturalWhite}>
        <View style={styles.guards}>
          {[
            t('ui.elleNeDonnePasUnAcces'),
            t('ui.elleNePermetPasLeTelechargement'),
            t('ui.elleNeRendPasUnDossier'),
          ].map((item) => (
            <View key={item} style={styles.guardRow}>
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.forestGreen} />
              <Text preset="bodySm" color={COLORS.textPrimary} style={styles.lineHeight}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 24 },
  lineHeight: { lineHeight: 20 },
  list: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  process: { gap: SPACING.md },
  processWide: { flexDirection: 'row', flexWrap: 'wrap' },
  stepItem: { flex: 1, minWidth: 240 },
  stepCard: { gap: SPACING.sm, height: '100%' },
  guards: { gap: SPACING.md },
  guardRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
});
