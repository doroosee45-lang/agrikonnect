import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, ChipRow, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, DURATION, EASE } from '@/theme';

/** PUBLIC — catalogue des jeux de données et politique de divulgation. */
export default function PublicDataCatalog() {
  const policy = useQuery({
    queryKey: queryKeys.insights.disclosure,
    queryFn: () => insightsApi.disclosurePolicy().then((result) => result.data),
  });

  const datasets = [
    { name: 'Référentiel des cultures', endpoint: 'GET /crops', auth: 'session' },
    { name: 'Pays et devises', endpoint: 'GET /countries', auth: 'session' },
    { name: 'Carte des exploitations publiées', endpoint: 'GET /public/map', auth: 'anonyme' },
    { name: 'Annuaire des exploitations publiées', endpoint: 'GET /public/farms', auth: 'anonyme' },
    { name: 'Statistiques de sol agrégées', endpoint: 'GET /public/soil-stats', auth: 'anonyme' },
    { name: 'Fiche publique de lot', endpoint: 'GET /public/lots/:code', auth: 'anonyme' },
    { name: 'Indicateurs agrégés par pays', endpoint: 'GET /insights/overview', auth: 'session' },
    { name: 'Prix de marché', endpoint: 'GET /prices', auth: 'session' },
  ];

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Données
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Catalogue de données
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        Jeux de données exposés par la plateforme, avec leur périmètre d'accès. Chaque clé API porte une finalité
        de traitement déclarée puis approuvée.
      </Text>

      {policy.isLoading ? (
        <LoadingState count={1} height={120} />
      ) : policy.isError ? (
        <ErrorState error={policy.error} onRetry={() => void policy.refetch()} showRequestId />
      ) : policy.data ? (
        <Card tone="ink" style={{ marginBottom: 24, padding: 32 }}>
          <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 12 }}>
            Seuil de k-anonymat
          </Text>
          <Text preset="numeric" color={COLORS.pureWhite} style={{ marginBottom: 8 }}>
            {policy.data.minGroupSize}
          </Text>
          <Text preset="caption" color="rgba(246, 247, 242, 0.75)" style={{ lineHeight: 1.7 }}>
            Tout agrégat portant sur un groupe plus petit est masqué, avec son motif. Aucune donnée personnelle
            n'est publiée.
          </Text>
        </Card>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {datasets.map((dataset, index) => (
          <motion.div
            key={dataset.endpoint}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
          >
            <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                  {dataset.name}
                </Text>
                <Text preset="caption" color={COLORS.slateGray} style={{ fontFamily: 'monospace' }}>
                  {dataset.endpoint}
                </Text>
              </div>
              <ChipRow>
                <Chip label={dataset.auth} tone={dataset.auth === 'anonyme' ? 'success' : 'info'} size="sm" />
              </ChipRow>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
