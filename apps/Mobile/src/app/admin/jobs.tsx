import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};
const asNombre = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  const base = typeof dict.message === 'string' && dict.message ? dict.message : 'Erreur inattendue';
  const details = asDict(dict.details);
  return details.mfaRequired === true ? `${base} — palier 2 : second facteur (MFA) requis.` : base;
};

/** M5 U-M5-2 — console des tâches planifiées : exécution manuelle audité (RG-M5-2), pause/reprise (palier 2). */
export default function AdminJobs() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState('');
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');

  const jobs = useQuery({
    queryKey: queryKeys.admin.jobs,
    queryFn: () => adminApi.jobs().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 15000,
  });

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.jobs });

  const executer = useMutation({
    mutationFn: (name: string) => adminApi.runJob(name, motif.trim() ? { reason: motif.trim() } : {}),
    onSuccess: (result, name) => {
      setErreur('');
      const sortie = asDict(result.data);
      if (sortie.skipped === true) {
        setAvis(`Tâche « ${name} » non exécutée : ${asText(sortie.reason, 'déjà en cours')}`);
      } else {
        setAvis(`Tâche « ${name} » exécutée en ${asNombre(sortie.durationMs) ?? 0} ms.`);
      }
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const mettreEnPause = useMutation({
    mutationFn: (name: string) => adminApi.pauseJob(name),
    onSuccess: (_result, name) => {
      setErreur('');
      setAvis(`Tâche « ${name} » mise en pause.`);
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const reprendre = useMutation({
    mutationFn: (name: string) => adminApi.resumeJob(name),
    onSuccess: (_result, name) => {
      setErreur('');
      setAvis(`Tâche « ${name} » reprise.`);
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const liste = asArray(jobs.data).map(asDict);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Tâches planifiées" subtitle="Console des jobs : état, exécution manuelle audité (RG-M5-2), pause/reprise (palier 2)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Tâches planifiées" icon="timer-outline">
          {jobs.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
          ) : (
            <View style={styles.list}>
              <Input
                label="Motif (facultatif)"
                placeholder="Ex. : purge demandée par l'exploitation"
                value={motif}
                onChangeText={setMotif}
                icon="document-text-outline"
              />
              {avis ? (
                <Card tone="white">
                  <Text preset="caption">{avis}</Text>
                </Card>
              ) : null}
              {erreur ? (
                <Card tone="white">
                  <Text preset="caption" color={COLORS.slateGray}>{erreur}</Text>
                </Card>
              ) : null}
              {liste.length === 0 ? (
                <EmptyState title="Aucune tâche" description="Aucune tâche planifiée exposée par l'API." icon="timer-outline" />
              ) : (
                liste.map((job) => {
                  const name = asText(job.name, 'tâche');
                  return (
                    <Card key={name} tone="white">
                      <View style={styles.rowHead}>
                        <Text preset="bodySm">{name}</Text>
                        {job.running === true ? <Chip label="en cours" tone="warning" size="sm" /> : null}
                        {job.paused === true ? <Chip label="en pause" tone="neutral" size="sm" /> : null}
                        {job.running !== true && job.paused !== true && job.lastOk === false ? <Chip label="en échec" tone="error" size="sm" /> : null}
                        {job.running !== true && job.paused !== true && job.lastOk === true ? <Chip label="ok" tone="success" size="sm" /> : null}
                      </View>
                      {typeof job.description === 'string' && job.description ? (
                        <Text preset="caption" color={COLORS.slateGray}>{job.description}</Text>
                      ) : null}
                      <Text preset="caption" color={COLORS.slateGray}>
                        Cadence : {asText(job.intervalHuman)} · Dernière exécution : {formatDate(String(job.lastRunAt ?? ''))} ·
                        Durée : {asNombre(job.lastDurationMs) !== null ? `${asNombre(job.lastDurationMs)} ms` : '—'}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Prochaine échéance : {formatDate(String(job.nextRunAt ?? ''))}
                      </Text>
                      {asNombre(job.consecutiveFailures) !== null && (asNombre(job.consecutiveFailures) as number) > 0 ? (
                        <Text preset="caption" color={COLORS.slateGray}>Échecs consécutifs : {asNombre(job.consecutiveFailures)}</Text>
                      ) : null}
                      {typeof job.lastError === 'string' && job.lastError ? (
                        <Text preset="caption" color={COLORS.slateGray}>Dernière erreur : {job.lastError}</Text>
                      ) : null}
                      {job.lastResult !== null && job.lastResult !== undefined ? (
                        <Text preset="caption" color={COLORS.slateGray}>Résultat : {JSON.stringify(job.lastResult)}</Text>
                      ) : null}
                      <View style={styles.actions}>
                        <Button
                          label="Exécuter"
                          size="sm"
                          onPress={() => executer.mutate(name)}
                          disabled={executer.isPending || job.paused === true || job.running === true}
                        />
                        <Button
                          label="Mettre en pause"
                          variant="outline"
                          size="sm"
                          onPress={() => mettreEnPause.mutate(name)}
                          disabled={mettreEnPause.isPending || job.paused === true}
                        />
                        <Button
                          label="Reprendre"
                          variant="outline"
                          size="sm"
                          onPress={() => reprendre.mutate(name)}
                          disabled={reprendre.isPending || job.paused !== true}
                        />
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
});
