import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { investApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const FILTERS = [
  { key: 'all', label: 'Tous les projets' },
  { key: 'followed', label: 'Suivis' },
  { key: 'matches', label: 'Correspondances' },
] as const;

/** Espace investisseur (V4) : projets publiés, suivi et correspondances. */
export default function Investment() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [filter, setFilter] = useState<'all' | 'followed' | 'matches'>('all');

  const projects = useQuery({
    queryKey: queryKeys.invest.projects({ limit: 30 }),
    queryFn: () => investApi.projects({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated && filter === 'all',
  });
  const followed = useQuery({
    queryKey: queryKeys.invest.followed,
    queryFn: () => investApi.followed().then((result) => result.data),
    enabled: isAuthenticated && filter === 'followed',
  });
  const matches = useQuery({
    queryKey: queryKeys.invest.matches,
    queryFn: () => investApi.matches().then((result) => result.data),
    enabled: isAuthenticated && filter === 'matches',
  });
  const dashboard = useQuery({
    queryKey: queryKeys.invest.dashboard,
    queryFn: () => investApi.dashboard().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const follow = useMutation({
    mutationFn: (id: string) => investApi.follow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.followed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.dashboard });
    },
  });

  const active = filter === 'all' ? projects : filter === 'followed' ? followed : matches;
  const items = active.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Investissement" subtitle="Projets publiés, données liées et suivi de portefeuille." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous avec un compte investisseur pour consulter les projets et leurs données."
          icon="trending-up-outline"
        >
          <Card tone="pale" style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Les documents sensibles passent par une data room à accès tracé : chaque consultation est
              journalisée. Un contact avec le porteur de projet passe par une demande acceptée, jamais par une
              coordonnée publiée.
            </Text>
          </Card>

          {dashboard.data ? (
            <Card tone="ink" style={styles.dashboard}>
              <Text preset="overline" color={COLORS.gold}>
                Tableau de bord investisseur
              </Text>
              <Text preset="caption" color="rgba(246, 247, 242, 0.75)" style={styles.lineHeight}>
                {Object.keys(dashboard.data as Record<string, unknown>).length} indicateur(s) chargé(s) depuis GET
                /invest. Les valeurs affichées proviennent des projets suivis et des demandes d’accès traitées.
              </Text>
            </Card>
          ) : null}

          <ChipRow>
            {FILTERS.map((item) => (
              <FilterChip key={item.key} label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />
            ))}
          </ChipRow>

          {active.isLoading ? (
            <LoadingState count={3} height={140} />
          ) : active.isError ? (
            <ErrorState error={active.error} onRetry={() => void active.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun projet"
              description={
                filter === 'followed'
                  ? 'Suivez des projets pour les retrouver ici et recevoir leurs rapports.'
                  : filter === 'matches'
                    ? 'Aucune correspondance avec votre profil investisseur pour le moment.'
                    : 'Aucun projet publié actuellement.'
              }
              icon="briefcase-outline"
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((project, index) => (
                <Reveal key={project.id} index={index % 3} variant="up" style={styles.item}>
                  <Card tone="white" style={styles.card}>
                    <View style={styles.chips}>
                      <Chip label={project.sector} tone="forest" size="sm" />
                      <Chip label={project.countryCode} tone="neutral" size="sm" />
                      <Chip label={project.status} tone={project.status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm" />
                    </View>

                    <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                      {project.title}
                    </Text>
                    {project.description ? (
                      <Text preset="caption" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {project.description}
                      </Text>
                    ) : null}

                    <View style={styles.facts}>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Surface existante
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.existingAreaHa !== null ? `${formatNumber(project.existingAreaHa, locale, 0)} ha` : '—'}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Besoin de financement
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.fundingNeed !== null ? formatNumber(project.fundingNeed, locale, 0) : '—'}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Apport propre
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.ownContribution !== null ? formatNumber(project.ownContribution, locale, 0) : '—'}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Durée
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.durationMonths !== null ? `${formatNumber(project.durationMonths, locale, 0)} mois` : '—'}
                        </Text>
                      </View>
                    </View>

                    <Chip label={project.fieldStatus} tone="info" size="sm" />

                    <View style={styles.actions}>
                      <Button label="Ouvrir le projet" onPress={() => router.push(`/investment/projects/${project.id}` as never)} variant="outline" size="sm" icon="arrow-forward-outline" />
                      <Button
                        label="Suivre"
                        onPress={() => follow.mutate(project.id)}
                        variant="ghost"
                        size="sm"
                        icon="bookmark-outline"
                        loading={follow.isPending && follow.variables === project.id}
                      />
                    </View>
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
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  dashboard: { gap: SPACING.sm },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 300 },
  card: { gap: SPACING.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 130, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
