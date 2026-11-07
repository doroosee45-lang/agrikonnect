import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, LoadingState, Section, Text } from '@/components/ui';
import { alertApi, dashboardApi, farmApi, lotApi, plotApi, productionApi, projectApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { StatCard } from '@/design-system';

const MODULES = [
  { href: '/farmer/farms', icon: '🏡', label: 'Exploitations' },
  { href: '/farmer/plots', icon: '🗺️', label: 'Parcelles' },
  { href: '/farmer/productions', icon: '🌾', label: 'Productions' },
  { href: '/farmer/soil', icon: '🧪', label: 'Analyses de sol' },
  { href: '/farmer/lots', icon: '🏷️', label: 'Lots de traçabilité' },
  { href: '/farmer/export', icon: '🚢', label: 'Exportations' },
  { href: '/farmer/projects', icon: '💼', label: 'Projets' },
  { href: '/farmer/certifications', icon: '📜', label: 'Certifications' },
  { href: '/farmer/devices', icon: '📡', label: 'Capteurs' },
  { href: '/farmer/alerts', icon: '🔔', label: 'Boîte d’alertes' },
  { href: '/farmer/surveys', icon: '📋', label: 'Enquêtes' },
  { href: '/farmer/gallery', icon: '🖼️', label: 'Galerie' },
  { href: '/farmer/sync', icon: '🔄', label: 'Synchronisation' },
  { href: '/farmer/verification', icon: '✅', label: 'Vérification' },
  { href: '/farmer/conflicts', icon: '⚖️', label: 'Litiges' },
  { href: '/farmer/profile', icon: '👤', label: 'Mon profil' },
  { href: '/farmer/settings', icon: '⚙️', label: 'Paramètres' },
];

/** FARMER — tableau de bord producteur : compteurs réels + accès aux modules. */
export default function FarmerHome() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const farms = useQuery({ queryKey: queryKeys.farms.list({ limit: 1 }), queryFn: () => farmApi.list({ limit: 1 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const plots = useQuery({ queryKey: queryKeys.plots.list({ limit: 1 }), queryFn: () => plotApi.list({ limit: 1 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const productions = useQuery({ queryKey: queryKeys.productions.list({ limit: 1 }), queryFn: () => productionApi.list({ limit: 1 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const lots = useQuery({ queryKey: queryKeys.lots.list({ limit: 1 }), queryFn: () => lotApi.list({ limit: 1 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  const projects = useQuery({ queryKey: queryKeys.projects.list({ limit: 1 }), queryFn: () => projectApi.list({ limit: 1 }).then((r) => r.data), enabled: isAuthenticated, retry: false });
  /*
   * Compteur d'alertes non traitées. `openCount` vient de la meta de la liste :
   * un seul aller-retour, pas de requête de comptage supplémentaire.
   * `limit: 1` — on ne veut que le compteur ici.
   */
  const alertes = useQuery({
    queryKey: queryKeys.alerts.list({ open: true, limit: 1, page: 1 }),
    queryFn: () => alertApi.list({ open: true, limit: 1, page: 1 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const counts = [
    { label: 'Exploitations', value: farms.data?.length, href: '/farmer/farms' },
    { label: 'Parcelles', value: plots.data?.length, href: '/farmer/plots' },
    { label: 'Productions', value: productions.data?.length, href: '/farmer/productions' },
    { label: 'Lots', value: lots.data?.length, href: '/farmer/lots' },
    { label: 'Projets', value: projects.data?.length, href: '/farmer/projects' },
    { label: 'Alertes non traitées', value: alertes.data?.openCount, href: '/farmer/alerts' },
  ];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Espace producteur" description="Vos exploitations, parcelles, productions et projets." icon="🌱">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Espace producteur
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Tout ce qui suit vient de vos propres données. Rien n'est simulé.
        </Text>

        {dashboard.isLoading ? <LoadingState count={2} height={110} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
          {counts.map((count, index) => (
            <motion.div
              key={count.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
            >
              <Link to={count.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <StatCard
                  label={count.label}
                  valeur={String(count.value ?? '—')}
                />
              </Link>
            </motion.div>
          ))}
        </div>

        <Text preset="h2" style={{ marginBottom: 16 }}>
          Modules
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {MODULES.map((module, index) => (
            <motion.div
              key={module.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 10) * 0.03, ease: EASE.out }}
            >
              <Link to={module.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card tone="white" hover>
                  <Text preset="bodySm" style={{ marginBottom: 4 }}>
                    {module.icon} {module.label}
                  </Text>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </AuthGate>
    </Section>
  );
}
