import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, Button, ErrorState, LoadingState } from '@/components/ui';
import {
  HorizonAreaChartCard,
  HorizonDonutCard,
  HorizonGeoMapCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  formatHorizonTimestamp,
} from '@/design-system';
import type {
  HorizonMapMarker,
  HorizonSeriesPoint,
  HorizonTrackItem,
} from '@/design-system';
import { useI18n, tr } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { adminApi, farmApi, queryKeys, referenceApi, verificationApi } from '@/services';
import { useAuthStore } from '@/store/auth';

type SignupPoint = { month: string; count: number };
type DashboardData = Record<string, unknown> & {
  series?: { signups?: SignupPoint[] };
  generatedAt?: string;
  note?: string;
};

const PERIODES = [
  { id: '30', get label() { return tr('ui.n30Jours'); } },
  { id: '90', get label() { return tr('ui.n90Jours'); } },
  { id: '365', get label() { return tr('ui.n12Mois'); } },
  { id: 'all', get label() { return tr('ui.tout'); } },
];

const bornesPeriode = (periode: string): { from?: string; to?: string } => {
  if (periode === 'all') return {};
  const debut = new Date();
  debut.setDate(debut.getDate() - Number(periode));
  return { from: debut.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
};

const toBars = (v: number, total: number): [number, number, number, number] => {
  const ratio = total > 0 ? Math.min(100, Math.round((v / total) * 100)) : v > 0 ? 72 : 18;
  return [
    Math.max(18, Math.round(ratio * 0.55)),
    Math.max(22, Math.round(ratio * 0.85)),
    Math.max(18, Math.round(ratio * 0.65)),
    Math.max(24, ratio),
  ];
};

/** M1 — Tableau de bord Super-Admin & Gouvernance (Design Horizon, 100 % API reelle). */
export default function AdminDashboard() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [pays, setPays] = useState('');
  const [periode, setPeriode] = useState('30');
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const filtres = useMemo(
    () => ({
      ...(pays.trim().length === 2 ? { country: pays.trim().toUpperCase() } : {}),
      ...bornesPeriode(periode),
    }),
    [pays, periode],
  );

  const dashboard = useQuery({
    queryKey: queryKeys.admin.dashboard(filtres),
    queryFn: () => adminApi.dashboard(filtres).then((result) => result.data as DashboardData),
    enabled: isAuthenticated,
  });

  const countriesQuery = useQuery({
    queryKey: ['admin', 'horizon', 'countries'],
    queryFn: () => referenceApi.countries().then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const farmsQuery = useQuery({
    queryKey: ['admin', 'horizon', 'farms', filtres.country ?? 'ALL'],
    queryFn: () => farmApi.list({ limit: 12 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const verificationsQuery = useQuery({
    queryKey: ['admin', 'horizon', 'verifications'],
    queryFn: () => verificationApi.adminQueue({ limit: 4 }).then((r) => r.data?.items ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const data = dashboard.data ?? {};
  const num = (key: string) => Number(data[key] ?? 0) || 0;

  const exporter = async () => {
    setExportEnCours(true);
    setExportErreur(null);
    try {
      const result = await adminApi.dashboardExport(filtres);
      const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = result.data.filename;
      lien.click();
      URL.revokeObjectURL(url);
    } catch (erreur) {
      setExportErreur(erreur instanceof Error ? erreur.message : t('ui.lExportCsvAEchoue'));
    } finally {
      setExportEnCours(false);
    }
  };

  const signupPoints: HorizonSeriesPoint[] = useMemo(() => {
    const raw = data.series?.signups ?? [];
    return raw.slice(-8).map((pt) => ({
      label: String(pt.month).slice(2),
      primary: Number(pt.count) || 0,
    }));
  }, [data.series?.signups]);

  const mapMarkers: HorizonMapMarker[] = useMemo(() => {
    const farms = farmsQuery.data ?? [];
    if (farms.length > 0) {
      return farms.map((f) => ({
        id: f.id,
        code: f.slug.slice(0, 9).toUpperCase(),
        label: f.name,
        countryCode: f.countryCode,
        tone:
          f.verificationStatus === 'VERIFIED'
            ? 'green'
            : f.verificationStatus === 'PENDING'
              ? 'amber'
              : 'blue',
        href: '/admin/farms',
      }));
    }
    return (countriesQuery.data ?? []).slice(0, 10).map((c) => ({
      id: c.code,
      code: `PAYS-${c.code}`,
      label: c.name,
      countryCode: c.code,
      tone: c.status === 'ACTIVE' ? 'green' : 'neutral',
      href: '/admin/countries',
      isHub: c.code === 'CD' || c.code === 'CI',
    }));
  }, [farmsQuery.data, countriesQuery.data]);

  const queueItems: HorizonTrackItem[] = useMemo(() => {
    const list = verificationsQuery.data ?? [];
    return list.slice(0, 4).map((v) => ({
      id: v.id,
      code: `${v.subjectType.slice(0, 4).toUpperCase()}-${v.id.slice(0, 5).toUpperCase()}`,
      subtitle: new Date(v.createdAt).toLocaleDateString(locale),
      statusLabel: v.status === 'VERIFIED' ? t('common.verified') : v.status === 'REJECTED' ? t('ui.rejete') : t('ui.enAttente'),
      tone: v.status === 'VERIFIED' ? 'green' : v.status === 'REJECTED' ? 'red' : 'amber',
      leftCode: v.level || 'N1',
      leftLabel: v.subjectType,
      rightCode: v.status === 'VERIFIED' ? 'OK' : t('ui.trackCodeReview'),
      rightLabel: t('ui.conformite'),
      progressPct: v.status === 'VERIFIED' ? 100 : v.status === 'REJECTED' ? 100 : 52,
      icon: 'shield',
      href: '/admin/verifications',
    }));
  }, [verificationsQuery.data, locale]);

  const totalOrgs =
    num('organizationsIndividual') + num('organizationsCooperative') + num('organizationsCompany');

  return (
    <AuthGate isAuthenticated={isAuthenticated} title={t('ui.administration')} description={t('ui.pilotageDeLaPlateforme')} icon="⚙️">
      <HorizonShell>
        {/* Barre de filtres temps reel + Export audite (RG-M1-1 / RG-M1-4) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-4 py-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-bordure bg-fond px-3 py-1.5 text-xs">
              <span className="font-semibold text-texte-doux">{t('ui.paysIso')}</span>
              <input
                type="text"
                value={pays}
                maxLength={2}
                placeholder={t('ui.tousExCd')}
                onChange={(e) => setPays(e.target.value.toUpperCase().slice(0, 2))}
                className="w-24 border-0 bg-transparent font-mono text-xs font-semibold text-texte outline-none placeholder:font-sans placeholder:font-normal placeholder:text-texte-doux"
              />
            </label>

            <div className="flex items-center gap-1 rounded-xl border border-bordure bg-fond p-1">
              {PERIODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriode(item.id)}
                  className={
                    periode === item.id
                      ? 'rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-texte shadow-2xs'
                      : 'rounded-lg px-2.5 py-1 text-xs font-medium text-texte-doux hover:text-texte'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {exportErreur ? (
              <span className="text-xs font-medium text-danger">{exportErreur}</span>
            ) : null}
            <Button
              label={exportEnCours ? t('ui.exportCsv') : t('ui.exporterCsv')}
              onClick={() => void exporter()}
              variant="outline"
              size="sm"
            />
          </div>
        </div>

        {dashboard.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : (
          <>
            {/* RANGE 1 : Vue d'ensemble des operations (4 colonnes Horizon) */}
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleDesOperations')}
              updatedLabel={formatHorizonTimestamp(data.generatedAt, locale)}
              items={[
                {
                  id: 'users',
                  label: t('ui.utilisateursInscrits'),
                  value: formatNumber(num('users'), locale),
                  subtitle: t('ui.actifsMfa', { value: formatNumber(num('usersActive'), locale), value2: formatNumber(num('usersMfa'), locale) }),
                  badgeText: `+${formatNumber(num('usersNewInPeriod'), locale)}`,
                  badgeSubtext: t('ui.surLaPeriode'),
                  tone: 'green',
                  icon: 'users',
                  href: '/admin/users',
                },
                {
                  id: 'farms',
                  label: t('ui.exploitationsAgricoles'),
                  value: formatNumber(num('farms'), locale),
                  subtitle: t('ui.parcellesProducteurs', { value: formatNumber(num('plots'), locale), value2: formatNumber(num('farmers'), locale) }),
                  badgeText: t('ui.coop', { value: formatNumber(num('cooperatives'), locale) }),
                  badgeSubtext: t('ui.kpiSubActiveFemPlural'),
                  tone: 'blue',
                  icon: 'leaf',
                  href: '/admin/farms',
                },
                {
                  id: 'market',
                  label: t('ui.annoncesCommandes'),
                  value: formatNumber(num('listingsPublished'), locale),
                  subtitle: t('ui.commandeSSurLaPeriode', { value: formatNumber(num('ordersInPeriod'), locale) }),
                  badgeText: t('ui.litigeS', { value: formatNumber(num('disputesOpen'), locale) }),
                  badgeSubtext: t('ui.kpiSubOpenMascPlural'),
                  tone: num('disputesOpen') > 0 ? 'amber' : 'green',
                  icon: 'truck',
                  href: '/admin/marketplace',
                },
                {
                  id: 'quality',
                  label: t('ui.verificationsAlertes'),
                  value: formatNumber(num('pendingVerifications'), locale),
                  subtitle: t('ui.signalementSAInstruire', { value: formatNumber(num('openReports'), locale) }),
                  badgeText: num('pendingVerifications') > 0 ? t('ui.aInstruire') : t('ui.aJour'),
                  badgeSubtext: t('ui.fileQualite'),
                  tone: num('pendingVerifications') > 0 || num('openReports') > 0 ? 'red' : 'green',
                  icon: 'shield',
                  href: '/admin/verifications',
                },
              ]}
            />

            {/* RANGE 2 : Courbe des inscriptions (50 %) + Carte des exploitations/pays (50 %) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HorizonAreaChartCard
                title={t('ui.dynamiqueDesInscriptions12Mois')}
                primaryLabel={t('ui.nouveauxComptes')}
                points={signupPoints}
                emptyMessage={t('ui.aucuneInscriptionEnregistreeSurLaFenetre')}
                sourceNote={data.note ? String(data.note) : t('ui.agregationTempsReelGetAdminDashboard')}
              />

              <HorizonGeoMapCard
                title={t('ui.couvertureGeographiqueExploitations')}
                markers={mapMarkers}
                searchPlaceholder={t('ui.filtrerPaysOuExploitation')}
                emptyMessage={t('ui.aucuneExploitationOuJuridictionActiveTrouvee')}
                legend={[
                  { label: t('ui.exploitations'), tone: 'green', count: num('farms') },
                  { label: t('ui.parcelles'), tone: 'blue', count: num('plots') },
                  { label: t('ui.aVerifier'), tone: 'amber', count: num('pendingVerifications') },
                  { label: t('ui.signalements'), tone: 'red', count: num('openReports') },
                ]}
              />
            </div>

            {/* RANGE 3 : File active + Grille 2x2 Sparkbars + Anneau Donut */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={t('ui.fileDeVerificationEnCours')}
                items={queueItems}
                viewAllHref="/admin/verifications"
                emptyMessage={t('ui.aucuneDemandeDeVerificationEnAttente')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.indicateursMetierSecurite')}
                cells={[
                  {
                    id: 'productions',
                    value: formatNumber(num('productions'), locale),
                    label: t('ui.recoltesEnregistrees'),
                    bars: toBars(num('productions'), Math.max(10, num('plots'))),
                    tone: 'green',
                    href: '/admin/productions',
                  },
                  {
                    id: 'soils',
                    value: formatNumber(num('soilAssessments'), locale),
                    label: t('ui.analysesDeSol'),
                    bars: toBars(num('soilAssessments'), Math.max(10, num('plots'))),
                    tone: 'blue',
                    href: '/admin/farms',
                  },
                  {
                    id: 'unverified',
                    value: formatNumber(num('usersUnverifiedEmail'), locale),
                    label: t('ui.eMailsNonVerifies'),
                    bars: toBars(num('usersUnverifiedEmail'), Math.max(1, num('users'))),
                    tone: 'amber',
                    href: '/admin/users',
                  },
                  {
                    id: 'suspended',
                    value: formatNumber(num('usersSuspended'), locale),
                    label: t('ui.comptesSuspendus'),
                    bars: toBars(num('usersSuspended'), Math.max(1, num('users'))),
                    tone: 'red',
                    href: '/admin/security',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.structureDesOrganisations')}
                totalValue={formatNumber(totalOrgs, locale)}
                totalLabel={t('ui.organisations')}
                segments={[
                  { label: t('ui.individuelles'), value: num('organizationsIndividual'), tone: 'green' },
                  { label: t('ui.cooperatives'), value: num('organizationsCooperative'), tone: 'blue' },
                  { label: t('ui.entreprises'), value: num('organizationsCompany'), tone: 'amber' },
                  { label: t('ui.litigesOuverts'), value: num('disputesOpen'), tone: 'red' },
                ]}
              />
            </div>

            {/* Raccourcis rapides vers les modules de gouvernance */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-bordure bg-surface px-4 py-3 text-xs text-texte-doux">
              <span>{t('ui.accesDirectGouvernance')}{' '}<Link to="/admin/audit" className="font-semibold text-marque hover:underline">{t('ui.journalDAudit_d7747')}</Link>{' '}
                ·{' '}
                <Link to="/admin/monitoring" className="font-semibold text-marque hover:underline">{t('ui.supervision')}</Link>{' '}
                ·{' '}
                <Link to="/admin/jobs" className="font-semibold text-marque hover:underline">{t('ui.tachesPlanifiees_8a786')}</Link>{' '}
                ·{' '}
                <Link to="/admin/roles" className="font-semibold text-marque hover:underline">{t('ui.rolesMfa')}</Link>
              </span>
              <span>{t('ui.getAdminDashboard')}</span>
            </div>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
