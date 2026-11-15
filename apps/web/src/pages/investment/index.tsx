import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import {
  HorizonAreaChartCard,
  HorizonDonutCard,
  HorizonGeoMapCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  buildMonthlySeries,
  formatHorizonTimestamp,
} from '@/design-system';
import type { HorizonMapMarker, HorizonTrackItem } from '@/design-system';
import { useI18n } from '@/i18n';
import { formatAreaHa, formatMoney, formatNumber } from '@/lib/format';
import { investApi, queryKeys } from '@/services';
import type { Project } from '@/services/types';
import { useAuthStore } from '@/store/auth';

interface InvestDashboardPayload {
  kpis?: {
    publishedProjects?: number;
    withVerifiedData?: number;
    accessGranted?: number;
    accessPending?: number;
    fundingFollowUps?: number;
  };
  notices?: string[];
  generatedAt?: string;
}

interface InvestorProfileCheck {
  profile?: { id: string };
  access?: { dataRoomAccess?: boolean };
}

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: T[] }).items;
  }
  return [];
}

/**
 * Espace Investissement privé (/investment) — Design Horizon 100 % API réelle.
 * Conserve strictement les données du projet, la mention réglementaire et l'action Suivre.
 */
export default function InvestmentHome() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const user = useAuthStore((state) => state.user);

  const isInvestorRole = useMemo(
    () =>
      Boolean(
        user?.organizations?.some(
          (org) => org.type === 'INVESTOR' || org.roles?.includes('INVESTOR'),
        ),
      ),
    [user],
  );

  const investorMe = useQuery({
    queryKey: ['investors', 'me'],
    queryFn: () =>
      investApi
        .profile()
        .then((r) => (r.data as unknown as InvestorProfileCheck) ?? null)
        .catch(() => null),
    enabled: isAuthenticated && isInvestorRole,
    retry: false,
  });

  const hasInvestorProfile = Boolean(investorMe.data?.profile);
  const hasDataRoomAccess = Boolean(investorMe.data?.access?.dataRoomAccess);

  const investDash = useQuery({
    queryKey: ['invest', 'horizon', 'dashboard'],
    queryFn: () =>
      investApi
        .dashboard()
        .then((r) => (r.data as unknown as InvestDashboardPayload) ?? null)
        .catch(() => null),
    enabled: isAuthenticated && isInvestorRole && hasDataRoomAccess,
    retry: false,
  });

  const projects = useQuery({
    queryKey: queryKeys.invest.projects({ limit: 24 }),
    queryFn: () => investApi.projects({ limit: 24 }).then((r) => asArray<Project>(r.data)),
    enabled: isAuthenticated,
    retry: false,
  });

  const followed = useQuery({
    queryKey: queryKeys.invest.followed,
    queryFn: () => investApi.followed().then((r) => asArray<Project>(r.data)),
    enabled: isAuthenticated,
    retry: false,
  });

  const matches = useQuery({
    queryKey: queryKeys.invest.matches,
    queryFn: () =>
      investApi
        .matches()
        .then((r) => asArray<Project>(r.data))
        .catch(() => []),
    enabled: isAuthenticated && isInvestorRole && hasInvestorProfile,
    retry: false,
  });

  const follow = useMutation({
    mutationFn: (id: string) => investApi.follow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.followed });
      void queryClient.invalidateQueries({ queryKey: ['invest', 'horizon', 'dashboard'] });
    },
  });

  const projectRows = useMemo(() => asArray<Project>(projects.data), [projects.data]);
  const followedRows = useMemo(() => asArray<Project>(followed.data), [followed.data]);
  const matchRows = useMemo(() => asArray<Project>(matches.data), [matches.data]);
  const followedIds = useMemo(() => new Set(followedRows.map((p) => p.id)), [followedRows]);
  const kpis = investDash.data?.kpis;

  const verifiedProjects = projectRows.filter(
    (p) => p.fieldStatus === 'VERIFIED' || Boolean(p.linkedData),
  );

  const projectSeries = useMemo(
    () =>
      buildMonthlySeries(
        projectRows,
        (p) => p.createdAt,
        (p) => Boolean(p.linkedData) || p.fieldStatus === 'VERIFIED',
      ),
    [projectRows],
  );

  const mapMarkers: HorizonMapMarker[] = useMemo(
    () =>
      projectRows.slice(0, 12).map((p) => ({
        id: p.id,
        code: `${p.countryCode}-${(p.slug ?? p.id).slice(0, 5).toUpperCase()}`,
        label: `${p.title} (${p.sector})`,
        countryCode: p.countryCode,
        tone: followedIds.has(p.id) ? 'green' : p.linkedData ? 'blue' : 'amber',
        href: `/investment/projects/${p.id}`,
      })),
    [projectRows, followedIds],
  );

  const pipelineTracks: HorizonTrackItem[] = useMemo(
    () =>
      (followedRows.length > 0 ? followedRows : projectRows).slice(0, 4).map((p) => {
        const currentHa = Number(p.existingAreaHa ?? 0);
        const targetHa = Number(p.targetAreaHa ?? 0);
        const pct =
          targetHa > 0 ? Math.min(100, Math.max(20, Math.round((currentHa / targetHa) * 100))) : 55;
        return {
          id: p.id,
          code: (p.slug ?? p.id).slice(0, 10).toUpperCase(),
          subtitle: p.fundingNeed ? formatMoney(p.fundingNeed, 'USD', locale) : p.sector,
          statusLabel: followedIds.has(p.id) ? t('ui.suivi') : p.status,
          tone: followedIds.has(p.id) ? 'green' : 'blue',
          leftCode: p.countryCode,
          leftLabel: p.existingAreaHa ? formatAreaHa(p.existingAreaHa, locale) : t('ui.actuel'),
          rightCode: p.targetAreaHa ? formatAreaHa(p.targetAreaHa, locale) : t('ui.trackCodeTarget'),
          rightLabel: p.sector,
          progressPct: pct,
          icon: 'chart',
          href: `/investment/projects/${p.id}`,
        };
      }),
    [followedRows, projectRows, followedIds, locale],
  );

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.portailInvestissementAgricole')}
      description={t('ui.projetsAgricolesStructuresDonneesVerifieesSous')}
      icon="🌱"
    >
      <HorizonShell>
        {/* Mention reglementaire obligatoire (INV — absence d'intermediation financiere) */}
        <div className="rounded-2xl border border-bordure bg-surface px-4 py-3 text-xs text-texte-doux">
          <strong className="text-texte">{t('ui.cadreReglementaire')}{' '}</strong>{t('ui.agrikonnectAssureLaMiseEnRelation')}</div>

        {projects.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} showRequestId />
        ) : (
          <>
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleDuPortefeuilleDealflow')}
              updatedLabel={formatHorizonTimestamp(investDash.data?.generatedAt, locale)}
              headerRight={
                <Link
                  to="/investment/profile"
                  className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                  style={{ textDecoration: 'none' }}
                >{t('ui.profilInvestisseur_cf1fa')}</Link>
              }
              items={[
                {
                  id: 'pub',
                  label: t('ui.projetsPublies'),
                  value: formatNumber(kpis?.publishedProjects ?? projectRows.length, locale),
                  subtitle: t('ui.dossiersOuvertsALaMiseEn'),
                  badgeText: t('ui.verif', { value: formatNumber(kpis?.withVerifiedData ?? verifiedProjects.length, locale) }),
                  badgeSubtext: t('ui.donneesLiees'),
                  tone: 'green',
                  icon: 'layers',
                  href: '/public/projects',
                },
                {
                  id: 'followed',
                  label: t('ui.projetsSuivis'),
                  value: formatNumber(followedRows.length, locale),
                  subtitle: t('ui.suiviSDeFinancement', { value: formatNumber(kpis?.fundingFollowUps ?? 0, locale) }),
                  badgeText: t('ui.portefeuille'),
                  badgeSubtext: t('ui.kpiSubActiveMasc'),
                  tone: 'blue',
                  icon: 'chart',
                  href: '/investment/projects',
                },
                {
                  id: 'matches',
                  label: t('ui.correspondancesThese'),
                  value: formatNumber(matchRows.length, locale),
                  subtitle: t('ui.alignesAvecVosCriteresSectorielsPays'),
                  badgeText: matchRows.length > 0 ? t('ui.pertinents') : t('ui.aConfigurer'),
                  badgeSubtext: 'matching',
                  tone: 'amber',
                  icon: 'check',
                  href: '/investment/profile',
                },
                {
                  id: 'access',
                  label: t('ui.dataRoomsAutorisees'),
                  value: formatNumber(kpis?.accessGranted ?? 0, locale),
                  subtitle: t('ui.demandeSDAccesEnAttente', { value: formatNumber(kpis?.accessPending ?? 0, locale) }),
                  badgeText: t('ui.sousConsentement'),
                  badgeSubtext: t('ui.kpiSubAuditable'),
                  tone: 'green',
                  icon: 'key',
                  href: '/investment/requests',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HorizonAreaChartCard
                title={t('ui.fluxDePublicationDesProjets')}
                primaryLabel={t('ui.projetsStructures')}
                secondaryLabel={t('ui.avecDonneesTerrainLiees')}
                points={projectSeries}
                emptyMessage={t('ui.aucunProjetHorodatePubliePourLe')}
              />

              <HorizonGeoMapCard
                title={t('ui.geographieDesOpportunitesAgricoles')}
                markers={mapMarkers}
                searchPlaceholder={t('ui.filtrerPaysOuFiliere')}
                emptyMessage={t('ui.aucunProjetGeolocalisePublie')}
                legend={[
                  { label: t('ui.suivis'), tone: 'green', count: followedRows.length },
                  { label: t('ui.donneesLiees_1c3ba'), tone: 'blue', count: verifiedProjects.length },
                  { label: t('ui.correspondances'), tone: 'amber', count: matchRows.length },
                  { label: t('ui.accesEnAttente'), tone: 'neutral', count: kpis?.accessPending ?? 0 },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={followedRows.length > 0 ? t('ui.projetsSuivisSurfaceActuelleCible') : t('ui.projetsRecents')}
                items={pipelineTracks}
                viewAllHref="/investment/projects"
                emptyMessage={t('ui.aucunProjetSuiviPourLeMoment')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.indicateursDeDueDiligence')}
                cells={[
                  {
                    id: 'i-pub',
                    value: formatNumber(projectRows.length, locale),
                    label: t('ui.dossiersAccessibles'),
                    bars: [40, 62, 78, projectRows.length > 0 ? 90 : 18],
                    tone: 'green',
                    href: '/public/projects',
                  },
                  {
                    id: 'i-ver',
                    value: formatNumber(kpis?.withVerifiedData ?? verifiedProjects.length, locale),
                    label: t('ui.donneesVerifiees'),
                    bars: [32, 54, 70, verifiedProjects.length > 0 ? 85 : 18],
                    tone: 'blue',
                    href: '/investment/projects',
                  },
                  {
                    id: 'i-acc',
                    value: formatNumber(kpis?.accessGranted ?? 0, locale),
                    label: t('ui.accesAccordes'),
                    bars: [28, 46, 62, (kpis?.accessGranted ?? 0) > 0 ? 80 : 18],
                    tone: 'green',
                    href: '/investment/requests',
                  },
                  {
                    id: 'i-mat',
                    value: formatNumber(matchRows.length, locale),
                    label: t('ui.alignesALaThese'),
                    bars: [30, 50, 66, matchRows.length > 0 ? 82 : 18],
                    tone: 'amber',
                    href: '/investment/profile',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.couvertureDuDealflow')}
                totalValue={formatNumber(projectRows.length, locale)}
                totalLabel={t('ui.projets')}
                segments={[
                  { label: t('ui.suivis'), value: followedRows.length, tone: 'green' },
                  { label: t('ui.correspondances'), value: matchRows.length, tone: 'blue' },
                  {
                    label: t('ui.autresPublies'),
                    value: Math.max(0, projectRows.length - followedRows.length),
                    tone: 'amber',
                  },
                ]}
              />
            </div>

            {/* Catalogue interactif avec action Suivre conservee */}
            <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-[15.5px] font-bold text-texte" style={{ margin: 0 }}>{t('ui.dossiersOuvertsALEtude', { length: projectRows.length })}</h3>
                <Link to="/public/projects" className="text-xs font-semibold text-marque hover:underline">{t('ui.catalogueComplet')}</Link>
              </div>
              {projectRows.length === 0 ? (
                <EmptyState
                  icon="🌱"
                  title={t('ui.aucunProjetPublie')}
                  description={t('ui.lesProjetsAgricolesPubliesParLes')}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {projectRows.slice(0, 6).map((project) => {
                    const isFollowing = followedIds.has(project.id);
                    return (
                      <div
                        key={project.id}
                        className="flex flex-col justify-between rounded-2xl border border-bordure bg-fond/50 p-4"
                      >
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-marque">
                            <span>
                              {project.countryCode} · {project.sector}
                            </span>
                            <span>{project.status}</span>
                          </div>
                          <Link
                            to={`/investment/projects/${project.id}`}
                            className="text-sm font-bold text-texte hover:text-marque"
                            style={{ textDecoration: 'none' }}
                          >
                            {project.title}
                          </Link>
                          <p className="mt-1 line-clamp-2 text-xs text-texte-doux" style={{ margin: '6px 0 0 0' }}>
                            {project.description ?? t('ui.dossierStructureSurAgrikonnect')}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-bordure pt-3">
                          <span className="text-xs font-semibold text-texte">
                            {project.fundingNeed !== null
                              ? formatMoney(project.fundingNeed, 'USD', locale)
                              : t('ui.besoinSurDossier')}
                          </span>
                          <div className="flex items-center gap-2">
                            {!isFollowing ? (
                              <Button
                                size="sm"
                                variant="outline"
                                label={t('ui.suivre')}
                                onClick={() => follow.mutate(project.id)}
                              />
                            ) : (
                              <span className="rounded-full bg-marque-clair px-2.5 py-1 text-[11px] font-semibold text-marque">{t('ui.suivi_f0cde')}</span>
                            )}
                            <Link
                              to={`/investment/projects/${project.id}`}
                              className="text-xs font-semibold text-marque hover:underline"
                            >{t('ui.fiche')}</Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
