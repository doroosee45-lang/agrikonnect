import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};
const asNombre = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

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
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Tâches planifiées"
        description="Console des jobs : état, exécution manuelle audité (RG-M5-2), pause/reprise (palier 2)."
        icon="⚙️"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <Text preset="h1">Tâches planifiées</Text>
          <Button label="Actualiser" variant="outline" size="sm" icon="⟳" onClick={() => void rafraichir()} />
        </div>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Le déclenchement manuel est audité (admin.job.run) et verrouillé contre les doubles exécutions (RG-M5-2).
          La pause et la reprise exigent le palier 2 (SUPER_ADMIN + MFA).
        </Text>

        <div style={{ marginBottom: 16 }}>
          <Input
            label="Motif (facultatif)"
            placeholder="Ex. : purge demandée par l'exploitation"
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
          />
        </div>

        {avis ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{avis}</Text>
            </CardBody>
          </Card>
        ) : null}
        {erreur ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm" color={COLORS.slateGray}>
                {erreur}
              </Text>
            </CardBody>
          </Card>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {jobs.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Chargement…
            </Text>
          ) : liste.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucune tâche planifiée exposée par l'API.
            </Text>
          ) : (
            liste.map((job) => {
              const name = asText(job.name, 'tâche');
              return (
                <Card key={name}>
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <Text preset="h3">{name}</Text>
                      {job.running === true ? <Chip label="en cours" tone="gold" /> : null}
                      {job.paused === true ? <Chip label="en pause" tone="warning" /> : null}
                      {job.running !== true && job.paused !== true && job.lastOk === false ? <Chip label="en échec" tone="error" /> : null}
                      {job.running !== true && job.paused !== true && job.lastOk === true ? <Chip label="ok" tone="success" /> : null}
                      <Text preset="caption" color={COLORS.slateGray}>
                        Cadence : {asText(job.intervalHuman)}
                      </Text>
                    </div>
                    {typeof job.description === 'string' && job.description ? (
                      <Text preset="bodySm" style={{ marginBottom: 6 }}>
                        {job.description}
                      </Text>
                    ) : null}
                    <Text preset="caption" color={COLORS.slateGray}>
                      Dernière exécution : {formatDate(job.lastRunAt)} · Durée : {asNombre(job.lastDurationMs) !== null ? `${asNombre(job.lastDurationMs)} ms` : '—'} ·
                      Prochaine échéance : {formatDate(job.nextRunAt)}
                    </Text>
                    {asNombre(job.consecutiveFailures) !== null && (asNombre(job.consecutiveFailures) as number) > 0 ? (
                      <Text preset="caption" color={COLORS.slateGray}>
                        Échecs consécutifs : {asNombre(job.consecutiveFailures)}
                      </Text>
                    ) : null}
                    {typeof job.lastError === 'string' && job.lastError ? (
                      <Text preset="caption" color={COLORS.slateGray}>
                        Dernière erreur : {job.lastError}
                      </Text>
                    ) : null}
                    {job.lastResult !== null && job.lastResult !== undefined ? (
                      <Text preset="caption" color={COLORS.slateGray}>
                        Résultat : {JSON.stringify(job.lastResult)}
                      </Text>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Button
                        label="Exécuter"
                        size="sm"
                        onClick={() => executer.mutate(name)}
                        disabled={executer.isPending || job.paused === true || job.running === true}
                      />
                      <Button
                        label="Mettre en pause"
                        variant="outline"
                        size="sm"
                        onClick={() => mettreEnPause.mutate(name)}
                        disabled={mettreEnPause.isPending || job.paused === true}
                      />
                      <Button
                        label="Reprendre"
                        variant="outline"
                        size="sm"
                        onClick={() => reprendre.mutate(name)}
                        disabled={reprendre.isPending || job.paused !== true}
                      />
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </AuthGate>
    </Section>
  );
}
