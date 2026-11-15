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
import { useI18n, tr } from '@/i18n';

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
  const base = typeof dict.message === 'string' && dict.message ? dict.message : tr('ui.unexpectedError');
  const details = asDict(dict.details);
  return details.mfaRequired === true ? tr('ui.palier2SecondFacteurMfaRequis', { base }) : base;
};

/** M5 U-M5-2 — console des tâches planifiées : exécution manuelle audité (RG-M5-2), pause/reprise (palier 2). */
export default function AdminJobs() {
  const { t } = useI18n();
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
        setAvis(t('ui.jobSkipped', { name, reason: asText(sortie.reason, t('ui.alreadyRunning')) }));
      } else {
        setAvis(t('ui.tacheExecuteeEnMs', { name, value: asNombre(sortie.durationMs) ?? 0 }));
      }
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const mettreEnPause = useMutation({
    mutationFn: (name: string) => adminApi.pauseJob(name),
    onSuccess: (_result, name) => {
      setErreur('');
      setAvis(t('ui.tacheMiseEnPause', { name }));
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const reprendre = useMutation({
    mutationFn: (name: string) => adminApi.resumeJob(name),
    onSuccess: (_result, name) => {
      setErreur('');
      setAvis(t('ui.tacheReprise', { name }));
      void rafraichir();
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const liste = asArray(jobs.data).map(asDict);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.tachesPlanifiees_8a786')} subtitle={t('ui.consoleDesJobsEtatExecutionManuelle')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.tachesPlanifiees_8a786')} icon="timer-outline">
          {jobs.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
          ) : (
            <View style={styles.list}>
              <Input
                label={t('ui.motifFacultatif')}
                placeholder={t('ui.exPurgeDemandeeParLExploitation')}
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
                <EmptyState title={t('ui.aucuneTache')} description={t('ui.aucuneTachePlanifieeExposeeParL')} icon="timer-outline" />
              ) : (
                liste.map((job) => {
                  const name = asText(job.name, 'tâche');
                  return (
                    <Card key={name} tone="white">
                      <View style={styles.rowHead}>
                        <Text preset="bodySm">{name}</Text>
                        {job.running === true ? <Chip label={t('ui.enCours')} tone="warning" size="sm" /> : null}
                        {job.paused === true ? <Chip label={t('ui.enPause')} tone="neutral" size="sm" /> : null}
                        {job.running !== true && job.paused !== true && job.lastOk === false ? <Chip label={t('ui.enEchec')} tone="error" size="sm" /> : null}
                        {job.running !== true && job.paused !== true && job.lastOk === true ? <Chip label="ok" tone="success" size="sm" /> : null}
                      </View>
                      {typeof job.description === 'string' && job.description ? (
                        <Text preset="caption" color={COLORS.slateGray}>{job.description}</Text>
                      ) : null}
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.cadenceDerniereExecutionDuree', { intervalHuman: asText(job.intervalHuman), value: formatDate(String(job.lastRunAt ?? '')), value2: asNombre(job.lastDurationMs) !== null ? `${asNombre(job.lastDurationMs)} ms` : '—' })}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.prochaineEcheance', { value: formatDate(String(job.nextRunAt ?? '')) })}</Text>
                      {asNombre(job.consecutiveFailures) !== null && (asNombre(job.consecutiveFailures) as number) > 0 ? (
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.echecsConsecutifs', { consecutiveFailures: asNombre(job.consecutiveFailures) })}</Text>
                      ) : null}
                      {typeof job.lastError === 'string' && job.lastError ? (
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.derniereErreur', { lastError: job.lastError })}</Text>
                      ) : null}
                      {job.lastResult !== null && job.lastResult !== undefined ? (
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.resultat', { lastResult: JSON.stringify(job.lastResult) })}</Text>
                      ) : null}
                      <View style={styles.actions}>
                        <Button
                          label={t('ui.executer')}
                          size="sm"
                          onPress={() => executer.mutate(name)}
                          disabled={executer.isPending || job.paused === true || job.running === true}
                        />
                        <Button
                          label={t('ui.mettreEnPause')}
                          variant="outline"
                          size="sm"
                          onPress={() => mettreEnPause.mutate(name)}
                          disabled={mettreEnPause.isPending || job.paused === true}
                        />
                        <Button
                          label={t('ui.reprendre')}
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
