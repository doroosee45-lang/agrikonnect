import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import {
  AuthGate, Button, Card, ChipRow, ErrorState, FilterChip, Input, LoadingState, Section, Text,
} from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';
import { ChartCard, StatCard } from '@/design-system';

/**
 * ADMIN — Tableau de bord centralisé (SPEC-SUPER-ADMIN M1).
 *
 * Chaque indicateur est servi par `GET /admin/dashboard` : agrégations
 * calculées à la requête (RG-M1-1), filtres pays/période, drill-down vers les
 * listes correspondantes, export CSV audité (RG-M1-4).
 */

type PointSerie = { month: string; count: number };

type DashboardData = {
  series?: { signups?: PointSerie[] };
  filters?: { country?: string | null; from?: string | null; to?: string | null };
  generatedAt?: string;
  note?: string;
} & Record<string, unknown>;

type Kpi = { cle: string; label: string; vers?: string };
type Bloc = { titre: string; vers: string; kpis: Kpi[] };

const BLOCS: Bloc[] = [
  {
    titre: 'Comptes',
    vers: '/admin/users',
    kpis: [
      { cle: 'users', label: 'Comptes créés', vers: '/admin/users' },
      { cle: 'usersActive', label: 'Actifs', vers: '/admin/users' },
      { cle: 'usersSuspended', label: 'Suspendus', vers: '/admin/users' },
      { cle: 'usersUnverifiedEmail', label: 'E-mails non vérifiés', vers: '/admin/users' },
      { cle: 'usersMfa', label: 'MFA active', vers: '/admin/users' },
      { cle: 'usersNewInPeriod', label: 'Nouveaux (période)', vers: '/admin/users' },
    ],
  },
  {
    titre: 'Organisations',
    vers: '/admin/farmers',
    kpis: [
      { cle: 'organizationsIndividual', label: 'Individuelles', vers: '/admin/farmers' },
      { cle: 'organizationsCooperative', label: 'Coopératives', vers: '/admin/cooperatives' },
      { cle: 'organizationsCompany', label: 'Sociétés', vers: '/admin/producers' },
    ],
  },
  {
    titre: 'Activité',
    vers: '/admin/farms',
    kpis: [
      { cle: 'farms', label: 'Exploitations', vers: '/admin/farms' },
      { cle: 'plots', label: 'Parcelles', vers: '/admin/plots' },
      { cle: 'productions', label: 'Productions', vers: '/admin/productions' },
      { cle: 'soilAssessments', label: 'Analyses de sol', vers: '/admin/farms' },
      { cle: 'cooperatives', label: 'Coopératives actives', vers: '/admin/cooperatives' },
    ],
  },
  {
    titre: 'Marché',
    vers: '/admin/marketplace',
    kpis: [
      { cle: 'listingsPublished', label: 'Annonces publiées', vers: '/admin/marketplace' },
      { cle: 'ordersInPeriod', label: 'Commandes (période)', vers: '/admin/orders' },
      { cle: 'disputesOpen', label: 'Litiges ouverts', vers: '/admin/moderation' },
    ],
  },
  {
    titre: 'Qualité',
    vers: '/admin/verifications',
    kpis: [
      { cle: 'pendingVerifications', label: 'Vérifications en attente', vers: '/admin/verifications' },
      { cle: 'openReports', label: 'Signalements ouverts', vers: '/admin/reports' },
    ],
  },
];

const PERIODES = [
  { id: '30', label: '30 jours' },
  { id: '90', label: '90 jours' },
  { id: '365', label: '12 mois' },
  { id: 'all', label: 'Tout' },
];

const bornesPeriode = (periode: string): { from?: string; to?: string } => {
  if (periode === 'all') return {};
  const debut = new Date();
  debut.setDate(debut.getDate() - Number(periode));
  return { from: debut.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
};

export default function AdminDashboard() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [pays, setPays] = useState('');
  const [periode, setPeriode] = useState('30');
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const filtres = {
    ...(pays.trim().length === 2 ? { country: pays.trim().toUpperCase() } : {}),
    ...bornesPeriode(periode),
  };

  const dashboard = useQuery({
    queryKey: queryKeys.admin.dashboard(filtres),
    queryFn: () => adminApi.dashboard(filtres).then((result) => result.data as DashboardData),
    enabled: isAuthenticated,
  });

  const data = dashboard.data ?? {};
  const serie = data.series?.signups ?? [];
  const maxSerie = Math.max(1, ...serie.map((point) => Number(point.count) || 0));

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
      setExportErreur(erreur instanceof Error ? erreur.message : "L'export a échoué.");
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Administration" description="Pilotage de la plateforme." icon="⚙️">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Tableau de bord
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Vue consolidée de la plateforme. Toutes les valeurs sont des agrégations calculées à la
          requête — aucune donnée personnelle ni aucune valeur figée.
        </Text>

        {/* ── Filtres (RG-M1-1) ── */}
        <Card tone="white" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ width: 160 }}>
              <Input
                label="Pays (ISO)"
                value={pays}
                onChange={(event) => setPays(event.target.value.toUpperCase().slice(0, 2))}
                placeholder="ex. CD"
                maxLength={2}
              />
            </div>
            <div>
              <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 6 }}>
                Période
              </Text>
              <ChipRow>
                {PERIODES.map((item) => (
                  <FilterChip
                    key={item.id}
                    label={item.label}
                    active={periode === item.id}
                    onPress={() => setPeriode(item.id)}
                  />
                ))}
              </ChipRow>
            </div>
            <Button
              label={exportEnCours ? 'Export en cours…' : 'Exporter CSV'}
              onClick={() => void exporter()}
              variant="outline"
              size="sm"
            />
          </div>
          {exportErreur ? (
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>
              {exportErreur}
            </Text>
          ) : null}
        </Card>

        {dashboard.isLoading ? (
          <LoadingState count={3} height={120} />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : (
          <>
            {BLOCS.map((bloc) => (
              <div key={bloc.titre} style={{ marginBottom: 28 }}>
                <Text preset="h2" style={{ marginBottom: 12 }}>
                  {bloc.titre}
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {bloc.kpis.map((kpi, index) => (
                    <motion.div
                      key={kpi.cle}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 10) * 0.03, ease: EASE.out }}
                    >
                      <Link to={kpi.vers ?? bloc.vers} style={{ textDecoration: 'none' }}>
                        <StatCard
                          label={kpi.label}
                          valeur={formatNumber(Number(data[kpi.cle] ?? 0), locale)}
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Série des inscriptions (graphe + tableau alternatif, §4.2) ── */}
            <ChartCard titre="Inscriptions — 12 derniers mois" className="mb-6">
              {serie.length === 0 ? (
                <Text preset="bodyMd" color={COLORS.slateGray}>
                  Aucune inscription sur la période.
                </Text>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginBottom: 16 }}>
                    {serie.map((point) => (
                      <div
                        key={point.month}
                        title={`${point.month} : ${point.count}`}
                        style={{
                          flex: 1,
                          height: `${Math.max(6, (Number(point.count) / maxSerie) * 100)}%`,
                          backgroundColor: COLORS.forestGreen,
                          borderRadius: 4,
                          minWidth: 8,
                        }}
                      />
                    ))}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {serie.map((point) => (
                        <tr key={point.month}>
                          <td style={{ padding: '4px 0', color: COLORS.slateGray }}>{point.month}</td>
                          <td style={{ padding: '4px 0', textAlign: 'right' }}>
                            {formatNumber(Number(point.count) || 0, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </ChartCard>

            <Text preset="caption" color={COLORS.slateGray}>
              {data.note ? `${String(data.note)} — ` : ''}
              Calculé le {data.generatedAt ? new Date(String(data.generatedAt)).toLocaleString(locale) : '—'}.
            </Text>
          </>
        )}
      </AuthGate>
    </Section>
  );
}