import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, CardTitle, Chip, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { useI18n, tr } from '@/i18n';
import { bcpLocale } from '@/lib/format';

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
  if (h > 0) return tr('ui.hMin', { h, m });
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
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(bcpLocale());
};

const NIVEAU_TONE: Record<string, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  degrade: 'warning',
  incomplet: 'error',
};

const NIVEAU_LABEL: Record<string, string> = {
  ok: 'ok',
  get degrade() { return tr('ui.degrade'); },
  incomplet: 'incomplet',
};

/** M5 U-M5-1/U-M5-3/U-M5-4 — services externes, santé technique et alertes (RG-M5-1 : état lu en direct). */
export default function AdminMonitoring() {
  const { t } = useI18n();
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
        title={t('ui.supervision')}
        description={t('ui.servicesExternesSanteTechniqueEtAlertes')}
        icon="📡"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <Text preset="h1">{t('ui.supervision')}</Text>
          <Button
            label={t('ui.actualiser')}
            variant="outline"
            size="sm"
            icon="⟳"
            onClick={() => {
              void services.refetch();
              void sante.refetch();
            }}
          />
        </div>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 4 }}>{t('ui.servicesExternesSanteTechniqueEtAlertes_f8d29')}</Text>
        <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.derniereEvaluationActualisationAutomatiqueToutes', { value: formatDate(etatServices.generatedAt ?? etatSante.generatedAt) })}</Text>

        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={`${asNombre(resume.total) ?? 0} services`} tone="neutral" />
              <Chip label={`${asNombre(resume.ok) ?? 0} ok`} tone="success" />
              <Chip label={t('ui.degrades', { value: asNombre(resume.degrade) ?? 0 })} tone="warning" />
              <Chip label={t('ui.countIncompleteMascPlural', { count: asNombre(resume.incomplet) ?? 0 })} tone="error" />
            </div>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.servicesExternes')}</Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {services.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('common.loading')}</Text>
          ) : listeServices.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucunServiceEvalue')}</Text>
          ) : (
            listeServices.map((item) => (
              <Card key={asText(item.service, 'service')}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text preset="h3">{asText(item.service)}</Text>
                    <Chip label={NIVEAU_LABEL[asText(item.niveau, '')] ?? asText(item.niveau)} tone={NIVEAU_TONE[asText(item.niveau, '')] ?? 'neutral'} />
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.mode', { mode: asText(item.mode) })}</Text>
                  </div>
                  <Text preset="bodySm">{t('ui.consequence', { consequence: asText(item.consequence) })}</Text>
                  {typeof item.pourRetablir === 'string' && item.pourRetablir ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>{t('ui.marcheASuivre', { pourRetablir: item.pourRetablir })}</Text>
                  ) : null}
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.santeTechnique')}</Text>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginBottom: 24 }}>
          <Card>
            <CardTitle>API</CardTitle>
            <CardBody>
              <Text preset="bodySm">{t('ui.disponibilite', { value: asNombre(apiInfo.uptimeSeconds) !== null ? formatDuree(asNombre(apiInfo.uptimeSeconds) as number) : '—' })}</Text>
              <Text preset="bodySm">{t('ui.nodeJs', { node: asText(apiInfo.node) })}</Text>
              <Text preset="bodySm">{t('ui.environnement', { environment: asText(apiInfo.environment) })}</Text>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('ui.baseDeDonnees')}</CardTitle>
            <CardBody>
              <Text preset="bodySm">{t('ui.connexion_18944')}{' '}{base.ok === true ? t('ui.etablie') : base.ok === false ? t('ui.enEchec') : '—'}
                {asNombre(base.latencyMs) !== null ? t('ui.latenceMs', { latencyMs: asNombre(base.latencyMs) }) : ''}
              </Text>
              {typeof base.error === 'string' && base.error ? (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.erreur', { error: base.error })}</Text>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('ui.stockage')}</CardTitle>
            <CardBody>
              <Text preset="bodySm">{t('ui.pilote_abce1', { driver: asText(stockage.driver) })}</Text>
              <Text preset="bodySm">{t('ui.repertoire', { dir: asText(stockage.dir) })}</Text>
              <Text preset="bodySm">{t('ui.ecriture')}{' '}{stockage.writable === true ? t('ui.autorisee') : t('ui.refusee')}</Text>
              <Text preset="bodySm">{t('ui.espaceLibre', { freeBytes: formatOctets(stockage.freeBytes), totalBytes: formatOctets(stockage.totalBytes) })}</Text>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('ui.tempsReel')}</CardTitle>
            <CardBody>
              {Object.entries(tempsReel).map(([cle, valeur]) => (
                <Text key={cle} preset="bodySm">
                  {cle} : {typeof valeur === 'number' ? valeur : asText(valeur)}
                </Text>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('ui.usageApi24H')}</CardTitle>
            <CardBody>
              <Text preset="bodySm">{t('ui.appelsApi24H', { value: asNombre(usage.apiCalls24h) ?? 0 })}</Text>
              <Text preset="bodySm">{t('ui.octetsDeRessources', { resourceBytes: formatOctets(usage.resourceBytes) })}</Text>
              {topRoutes.length > 0 ? (
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>{t('ui.routesLesPlusAppelees', { value: topRoutes.map((r) => `${asText(r.route)} (${asNombre(r.calls) ?? 0})`).join(', ') })}</Text>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('ui.tachesPlanifiees_8a786')}</CardTitle>
            <CardBody>
              <Text preset="bodySm">{t('ui.total', { value: asNombre(jobsResume.total) ?? 0 })}</Text>
              <Text preset="bodySm">{t('ui.enCours_b7ff9', { value: asNombre(jobsResume.running) ?? 0 })}</Text>
              <Text preset="bodySm">{t('ui.enPause_5c570', { value: asNombre(jobsResume.paused) ?? 0 })}</Text>
              <Text preset="bodySm">{t('ui.enErreur', { value: asNombre(jobsResume.inError) ?? 0 })}</Text>
            </CardBody>
          </Card>
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.alertesDeSupervision')}</Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {alertes.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucuneAlerteTousLesServicesEt')}</Text>
          ) : (
            alertes.map((alerte, index) => (
              <Card key={`${asText(alerte.service, 'alerte')}-${String(index)}`}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Chip label={alerte.severity === 'error' ? t('ui.erreur_c1f85') : t('ui.alerte')} tone={alerte.severity === 'error' ? 'error' : 'warning'} />
                    <Text preset="h3">{asText(alerte.service)}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {asText(alerte.mode)}
                    </Text>
                  </div>
                  <Text preset="bodySm">{asText(alerte.message)}</Text>
                  {typeof alerte.howToFix === 'string' && alerte.howToFix ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 6 }}>{t('ui.marcheASuivre_ec658', { howToFix: alerte.howToFix })}</Text>
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
