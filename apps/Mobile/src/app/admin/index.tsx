import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
import { formatDate, formatNumber } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Administration : tableau de bord, comptes, journal d'audit, tâches planifiées. */
export default function Admin() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [tab, setTab] = useState<'dashboard' | 'users' | 'audit' | 'jobs'>('dashboard');

  const dashboard = useQuery({
    queryKey: queryKeys.admin.dashboard({}),
    queryFn: () => adminApi.dashboard().then((result) => result.data),
    enabled: isAuthenticated && tab === 'dashboard',
  });
  const users = useQuery({
    queryKey: queryKeys.admin.users({ limit: 30 }),
    queryFn: () => adminApi.users({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated && tab === 'users',
  });
  const audit = useQuery({
    queryKey: queryKeys.admin.audit({ limit: 40 }),
    queryFn: () => adminApi.audit({ limit: 40 }).then((result) => result.data),
    enabled: isAuthenticated && tab === 'audit',
  });
  const jobs = useQuery({
    queryKey: queryKeys.admin.jobs,
    queryFn: () => adminApi.jobs().then((result) => result.data),
    enabled: isAuthenticated && tab === 'jobs',
  });

  /*
   * M2 U-M2-4 : le changement de statut exige un motif (RG-M2-2). La gestion
   * se fait depuis la fiche du compte, qui porte le formulaire de motif et
   * les garde-fous (protection du compte courant et des SUPER_ADMIN).
   */

  const runJob = useMutation({
    mutationFn: (name: string) => adminApi.runJob(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.jobs }),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Administration" subtitle="Pilotage, comptes, audit et tâches planifiées." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Accès administrateur"
          description="Connectez-vous avec un rôle administrateur pour accéder à cet espace."
          icon="settings-outline"
        >
          <ChipRow>
            {([
              { key: 'dashboard', label: 'Tableau de bord' },
              { key: 'users', label: 'Comptes' },
              { key: 'audit', label: 'Journal d’audit' },
              { key: 'jobs', label: 'Tâches' },
            ] as const).map((item) => (
              <FilterChip key={item.key} label={item.label} active={tab === item.key} onPress={() => setTab(item.key)} />
            ))}
          </ChipRow>

          {tab === 'dashboard' ? (
            dashboard.isLoading ? (
              <LoadingState count={2} height={120} />
            ) : dashboard.isError ? (
              <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
            ) : (
              <Card tone="ink" style={styles.card}>
                <Text preset="overline" color={COLORS.gold}>
                  Vue d’ensemble
                </Text>
                <View style={styles.grid}>
                  {Object.entries((dashboard.data ?? {}) as Record<string, unknown>).map(([key, value]) => (
                    <View key={key} style={styles.stat}>
                      <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                        {key}
                      </Text>
                      <Text preset="numeric" color={COLORS.pureWhite}>
                        {typeof value === 'number' ? formatNumber(value, locale) : typeof value === 'string' ? value : JSON.stringify(value)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={styles.lineHeight}>
                  Compteurs servis par GET /admin/dashboard. Aucune donnée personnelle n’y figure.
                </Text>
              </Card>
            )
          ) : null}

          {tab === 'users' ? (
            users.isLoading ? (
              <LoadingState count={3} height={90} />
            ) : users.isError ? (
              <ErrorState error={users.error} onRetry={() => void users.refetch()} />
            ) : (users.data ?? []).length === 0 ? (
              <EmptyState title="Aucun compte" description="Aucun utilisateur à afficher." icon="people-outline" />
            ) : (
              <View style={styles.list}>
                {(users.data ?? []).map((row, index) => {
                  const user = row as Record<string, unknown>;
                  const id = String(user.id ?? index);
                  const status = String(user.status ?? 'UNKNOWN');
                  return (
                    <Reveal key={id} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {String(user.email ?? user.phone ?? id)}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {String(user.firstName ?? '')} {String(user.lastName ?? '')}
                            {user.countryCode ? ` · ${String(user.countryCode)}` : ''}
                            {user.createdAt ? ` · créé le ${formatDate(String(user.createdAt), locale)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.rowAside}>
                          <Chip label={status} tone={status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'error' : 'warning'} size="sm" />
                          <Button label="Gérer" onPress={() => router.push(`/admin/users/${id}`)} variant="ghost" size="sm" icon="options-outline" />
                        </View>
                      </Card>
                    </Reveal>
                  );
                })}
              </View>
            )
          ) : null}

          {tab === 'audit' ? (
            audit.isLoading ? (
              <LoadingState count={3} height={70} />
            ) : audit.isError ? (
              <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
            ) : (audit.data ?? []).length === 0 ? (
              <EmptyState title="Journal vide" description="Aucune entrée d’audit sur la période." icon="time-outline" />
            ) : (
              <View style={styles.list}>
                {(audit.data ?? []).map((row, index) => {
                  const entry = row as Record<string, unknown>;
                  return (
                    <Reveal key={String(entry.id ?? index)} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodySm" color={COLORS.textPrimary}>
                            {String(entry.action ?? '—')}
                            {entry.resource ? ` · ${String(entry.resource)}` : ''}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {entry.at ? formatDate(String(entry.at), locale) : entry.createdAt ? formatDate(String(entry.createdAt), locale) : '—'}
                            {entry.actorId ? ` · acteur ${String(entry.actorId)}` : ''}
                          </Text>
                        </View>
                        <Chip label="tracé" tone="neutral" size="sm" />
                      </Card>
                    </Reveal>
                  );
                })}
              </View>
            )
          ) : null}

          {tab === 'jobs' ? (
            jobs.isLoading ? (
              <LoadingState count={2} height={80} />
            ) : jobs.isError ? (
              <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
            ) : (jobs.data ?? []).length === 0 ? (
              <EmptyState title="Aucune tâche" description="Aucune tâche planifiée exposée." icon="cog-outline" />
            ) : (
              <View style={styles.list}>
                {(jobs.data ?? []).map((row, index) => {
                  const job = row as Record<string, unknown>;
                  const name = String(job.name ?? index);
                  return (
                    <Reveal key={name} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodySm" color={COLORS.textPrimary}>
                            {name}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {job.schedule ? `planification ${String(job.schedule)}` : 'planification non exposée'}
                            {job.lastRunAt ? ` · dernier run ${formatDate(String(job.lastRunAt), locale)}` : ''}
                          </Text>
                        </View>
                        <Button label="Lancer" onPress={() => runJob.mutate(name)} variant="outline" size="sm" icon="play-outline" loading={runJob.isPending && runJob.variables === name} />
                      </Card>
                    </Reveal>
                  );
                })}
              </View>
            )
          ) : null}

          <Card tone="pale" style={styles.note}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Toute action administrative est journalisée avec son auteur et son horodatage. Les suspensions de
              compte doivent rester motivées et réversibles.
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  stat: { minWidth: 140, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowBody: { flex: 1, gap: 2 },
  rowAside: { alignItems: 'flex-end', gap: 4 },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  list: { gap: SPACING.sm },
});
