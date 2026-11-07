import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
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

const formatDuree = (secondes: number): string => {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${secondes} s`;
};

const formatOctets = (value: unknown): string => {
  const n = asNombre(value);
  if (n === null) return '—';
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} Go`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} Mo`;
  return `${n} o`;
};

const NIVEAU_TONE: Record<string, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  degrade: 'warning',
  incomplet: 'error',
};

const NIVEAU_LABEL: Record<string, string> = {
  ok: 'ok',
  degrade: 'dégradé',
  incomplet: 'incomplet',
};

/** M5 U-M5-1/U-M5-3/U-M5-4 — services externes, santé technique et alertes (RG-M5-1 : état lu en direct). */
export default function AdminMonitoring() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const services = useQuery({
    queryKey: queryKeys.admin.monitoringServices,
    queryFn: () => adminApi.monitoringServices().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 15000,
  });

  const sante = useQuery({
    queryKey: queryKeys.admin.monitoringHealth,
    queryFn: () => adminApi.monitoringHealth().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 15000,
  });

  const etatServices = asDict(services.data);
  const resume = asDict(etatServices.summary);
  const listeServices = asArray(etatServices.services).map(asDict);
  const etatSante = asDict(sante.data);
  const apiInfo = asDict(etatSante.api);
  const base = asDict(etatSante.database);
  const stockage = asDict(etatSante.storage);
  const tempsReel = asDict(etatSante.realtime);
  const usage = asDict(etatSante.usage);
  const jobsResume = asDict(etatSante.jobs);
  const alertes = asArray(etatSante.alerts).map(asDict);
  const topRoutes = asArray(usage.topRoutes24h).map(asDict);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Supervision" subtitle="Services externes, santé technique et alertes — état lu en direct (RG-M5-1)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Supervision" icon="pulse-outline">
          {services.isLoading || sante.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : services.isError || sante.isError ? (
            <ErrorState
              error={services.error ?? sante.error}
              onRetry={() => {
                void services.refetch();
                void sante.refetch();
              }}
            />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>
                Dernière évaluation : {formatDate(String(etatServices.generatedAt ?? etatSante.generatedAt ?? ''))} —
                actualisation automatique toutes les 15 secondes.
              </Text>
              <View style={styles.chips}>
                <Chip label={`${asNombre(resume.total) ?? 0} services`} tone="neutral" size="sm" />
                <Chip label={`${asNombre(resume.ok) ?? 0} ok`} tone="success" size="sm" />
                <Chip label={`${asNombre(resume.degrade) ?? 0} dégradés`} tone="warning" size="sm" />
                <Chip label={`${asNombre(resume.incomplet) ?? 0} incomplets`} tone="error" size="sm" />
              </View>

              <Text preset="h3">Services externes</Text>
              {listeServices.length === 0 ? (
                <EmptyState title="Aucun service évalué" description="Aucun service évalué." icon="pulse-outline" />
              ) : (
                listeServices.map((item) => (
                  <Card key={asText(item.service, 'service')} tone="white">
                    <View style={styles.rowHead}>
                      <Text preset="bodySm">{asText(item.service)}</Text>
                      <Chip
                        label={NIVEAU_LABEL[asText(item.niveau, '')] ?? asText(item.niveau)}
                        tone={NIVEAU_TONE[asText(item.niveau, '')] ?? 'neutral'}
                        size="sm"
                      />
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>Mode : {asText(item.mode)}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>Conséquence : {asText(item.consequence)}</Text>
                    {typeof item.pourRetablir === 'string' && item.pourRetablir ? (
                      <Text preset="caption" color={COLORS.slateGray}>Marche à suivre : {item.pourRetablir}</Text>
                    ) : null}
                  </Card>
                ))
              )}

              <Text preset="h3">Santé technique</Text>
              <Card tone="white">
                <Text preset="bodySm">API</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  Disponibilité : {asNombre(apiInfo.uptimeSeconds) !== null ? formatDuree(asNombre(apiInfo.uptimeSeconds) as number) : '—'} ·
                  Node.js : {asText(apiInfo.node)} · Environnement : {asText(apiInfo.environment)}
                </Text>
              </Card>
              <Card tone="white">
                <Text preset="bodySm">Base de données</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  Connexion : {base.ok === true ? 'établie' : base.ok === false ? 'en échec' : '—'}
                  {asNombre(base.latencyMs) !== null ? ` · latence ${asNombre(base.latencyMs)} ms` : ''}
                </Text>
              </Card>
              <Card tone="white">
                <Text preset="bodySm">Stockage</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  Pilote : {asText(stockage.driver)} · Répertoire : {asText(stockage.dir)} · Écriture :{' '}
                  {stockage.writable === true ? 'autorisée' : 'refusée'} · Espace libre : {formatOctets(stockage.freeBytes)}{' '}
                  / {formatOctets(stockage.totalBytes)}
                </Text>
              </Card>
              <Card tone="white">
                <Text preset="bodySm">Temps réel</Text>
                {Object.entries(tempsReel).map(([cle, valeur]) => (
                  <Text key={cle} preset="caption" color={COLORS.slateGray}>
                    {cle} : {typeof valeur === 'number' ? valeur : asText(valeur)}
                  </Text>
                ))}
              </Card>
              <Card tone="white">
                <Text preset="bodySm">Usage API (24 h)</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  Appels API (24 h) : {asNombre(usage.apiCalls24h) ?? 0} · Octets de ressources :{' '}
                  {formatOctets(usage.resourceBytes)}
                </Text>
                {topRoutes.length > 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>
                    Routes les plus appelées : {topRoutes.map((r) => `${asText(r.route)} (${asNombre(r.calls) ?? 0})`).join(', ')}
                  </Text>
                ) : null}
              </Card>
              <Card tone="white">
                <Text preset="bodySm">Tâches planifiées</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  Total : {asNombre(jobsResume.total) ?? 0} · En cours : {asNombre(jobsResume.running) ?? 0} · En pause :{' '}
                  {asNombre(jobsResume.paused) ?? 0} · En erreur : {asNombre(jobsResume.inError) ?? 0}
                </Text>
              </Card>

              <Text preset="h3">Alertes de supervision</Text>
              {alertes.length === 0 ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Aucune alerte : tous les services et tâches sont dans leur état nominal.
                </Text>
              ) : (
                alertes.map((alerte, index) => (
                  <Card key={`${asText(alerte.service, 'alerte')}-${String(index)}`} tone="white">
                    <View style={styles.rowHead}>
                      <Chip label={alerte.severity === 'error' ? 'erreur' : 'alerte'} tone={alerte.severity === 'error' ? 'error' : 'warning'} size="sm" />
                      <Text preset="bodySm">{asText(alerte.service)} · {asText(alerte.mode)}</Text>
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>{asText(alerte.message)}</Text>
                    {typeof alerte.howToFix === 'string' && alerte.howToFix ? (
                      <Text preset="caption" color={COLORS.slateGray}>Marche à suivre : {alerte.howToFix}</Text>
                    ) : null}
                  </Card>
                ))
              )}
              <Button
                label="Actualiser"
                variant="outline"
                size="sm"
                icon="refresh-outline"
                onPress={() => {
                  void services.refetch();
                  void sante.refetch();
                }}
              />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
});
