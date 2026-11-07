import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, CardTitle, Chip, Section, Text } from '@/components/ui';
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

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
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
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Supervision"
        description="Services externes, santé technique et alertes — état lu en direct (RG-M5-1)."
        icon="📡"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <Text preset="h1">Supervision</Text>
          <Button
            label="Actualiser"
            variant="outline"
            size="sm"
            icon="⟳"
            onClick={() => {
              void services.refetch();
              void sante.refetch();
            }}
          />
        </div>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
          Services externes, santé technique et alertes de supervision — évalués à chaque appel, jamais figés.
        </Text>
        <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Dernière évaluation : {formatDate(etatServices.generatedAt ?? etatSante.generatedAt)} — actualisation
          automatique toutes les 15 secondes.
        </Text>

        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={`${asNombre(resume.total) ?? 0} services`} tone="neutral" />
              <Chip label={`${asNombre(resume.ok) ?? 0} ok`} tone="success" />
              <Chip label={`${asNombre(resume.degrade) ?? 0} dégradés`} tone="warning" />
              <Chip label={`${asNombre(resume.incomplet) ?? 0} incomplets`} tone="error" />
            </div>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>
          Services externes
        </Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {services.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Chargement…
            </Text>
          ) : listeServices.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucun service évalué.
            </Text>
          ) : (
            listeServices.map((item) => (
              <Card key={asText(item.service, 'service')}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text preset="h3">{asText(item.service)}</Text>
                    <Chip label={NIVEAU_LABEL[asText(item.niveau, '')] ?? asText(item.niveau)} tone={NIVEAU_TONE[asText(item.niveau, '')] ?? 'neutral'} />
                    <Text preset="caption" color={COLORS.slateGray}>
                      Mode : {asText(item.mode)}
                    </Text>
                  </div>
                  <Text preset="bodySm">Conséquence : {asText(item.consequence)}</Text>
                  {typeof item.pourRetablir === 'string' && item.pourRetablir ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>
                      Marche à suivre : {item.pourRetablir}
                    </Text>
                  ) : null}
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>
          Santé technique
        </Text>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginBottom: 24 }}>
          <Card>
            <CardTitle>API</CardTitle>
            <CardBody>
              <Text preset="bodySm">Disponibilité : {asNombre(apiInfo.uptimeSeconds) !== null ? formatDuree(asNombre(apiInfo.uptimeSeconds) as number) : '—'}</Text>
              <Text preset="bodySm">Node.js : {asText(apiInfo.node)}</Text>
              <Text preset="bodySm">Environnement : {asText(apiInfo.environment)}</Text>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Base de données</CardTitle>
            <CardBody>
              <Text preset="bodySm">
                Connexion : {base.ok === true ? 'établie' : base.ok === false ? 'en échec' : '—'}
                {asNombre(base.latencyMs) !== null ? ` · latence ${asNombre(base.latencyMs)} ms` : ''}
              </Text>
              {typeof base.error === 'string' && base.error ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Erreur : {base.error}
                </Text>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Stockage</CardTitle>
            <CardBody>
              <Text preset="bodySm">Pilote : {asText(stockage.driver)}</Text>
              <Text preset="bodySm">Répertoire : {asText(stockage.dir)}</Text>
              <Text preset="bodySm">Écriture : {stockage.writable === true ? 'autorisée' : 'refusée'}</Text>
              <Text preset="bodySm">Espace libre : {formatOctets(stockage.freeBytes)} / {formatOctets(stockage.totalBytes)}</Text>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Temps réel</CardTitle>
            <CardBody>
              {Object.entries(tempsReel).map(([cle, valeur]) => (
                <Text key={cle} preset="bodySm">
                  {cle} : {typeof valeur === 'number' ? valeur : asText(valeur)}
                </Text>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Usage API (24 h)</CardTitle>
            <CardBody>
              <Text preset="bodySm">Appels API (24 h) : {asNombre(usage.apiCalls24h) ?? 0}</Text>
              <Text preset="bodySm">Octets de ressources : {formatOctets(usage.resourceBytes)}</Text>
              {topRoutes.length > 0 ? (
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>
                  Routes les plus appelées : {topRoutes.map((r) => `${asText(r.route)} (${asNombre(r.calls) ?? 0})`).join(', ')}
                </Text>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Tâches planifiées</CardTitle>
            <CardBody>
              <Text preset="bodySm">Total : {asNombre(jobsResume.total) ?? 0}</Text>
              <Text preset="bodySm">En cours : {asNombre(jobsResume.running) ?? 0}</Text>
              <Text preset="bodySm">En pause : {asNombre(jobsResume.paused) ?? 0}</Text>
              <Text preset="bodySm">En erreur : {asNombre(jobsResume.inError) ?? 0}</Text>
            </CardBody>
          </Card>
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>
          Alertes de supervision
        </Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {alertes.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucune alerte : tous les services et tâches sont dans leur état nominal.
            </Text>
          ) : (
            alertes.map((alerte, index) => (
              <Card key={`${asText(alerte.service, 'alerte')}-${String(index)}`}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Chip label={alerte.severity === 'error' ? 'erreur' : 'alerte'} tone={alerte.severity === 'error' ? 'error' : 'warning'} />
                    <Text preset="h3">{asText(alerte.service)}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {asText(alerte.mode)}
                    </Text>
                  </div>
                  <Text preset="bodySm">{asText(alerte.message)}</Text>
                  {typeof alerte.howToFix === 'string' && alerte.howToFix ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>
                      Marche à suivre : {alerte.howToFix}
                    </Text>
                  ) : null}
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </AuthGate>
    </Section>
  );
}
