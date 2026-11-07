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
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const PROCESS = [
  { title: 'Dépôt', body: 'Le porteur décrit le projet : périmètre, surfaces, production existante et projetée.' },
  { title: 'Instruction', body: 'Le dossier est revu ; chaque décision de revue est enregistrée avec son auteur.' },
  { title: 'Dataroom', body: 'Les pièces sont accessibles pour une durée limitée (30 jours par défaut, 90 au plus), avec journal des accès.' },
  { title: 'Suivi', body: 'Rapports d’avancement et d’impact versionnés, consultables par les parties autorisées.' },
];

/** Projets d’investissement (espace authentifié) + explication publique du cycle. */
export default function Projets() {
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
        eyebrow="Investissement"
        title="Projets agricoles"
        subtitle="Dossiers structurés, accès aux pièces limité dans le temps, reporting d’avancement et d’impact. Rien n’est rendu public sans décision explicite."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Les dossiers sont réservés aux comptes actifs"
          description="Un dossier d’investissement contient des données sensibles : sa consultation suppose un compte et des droits explicites."
          icon="briefcase-outline"
        >
          {projects.isLoading ? (
            <LoadingState count={2} height={140} />
          ) : projects.isError ? (
            <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun dossier visible"
              description="Les projets auxquels votre organisation a accès apparaîtront ici."
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
                        <Text preset="caption" color={COLORS.slateGray}>
                          Mis à jour {formatDate(project.updatedAt, locale)}
                        </Text>
                      ) : null}
                    </View>
                    <Text preset="h3" color={COLORS.textPrimary}>
                      {String(project.title ?? 'Projet')}
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
        eyebrow="Cycle"
        title="Du dépôt au reporting"
        subtitle="Quatre étapes, toutes journalisées."
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

      <Section index={3} eyebrow="Garde-fous" title="Ce que la dataroom ne fait pas" background={COLORS.naturalWhite}>
        <View style={styles.guards}>
          {[
            'Elle ne donne pas un accès permanent : l’expiration est fixée à l’ouverture.',
            'Elle ne permet pas le téléchargement massif : chaque accès est journalisé.',
            'Elle ne rend pas un dossier public : la publication reste une décision explicite.',
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
