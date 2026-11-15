import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, ChipRow, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** PUBLIC — catalogue des jeux de données et politique de divulgation. */
export default function PublicDataCatalog() {
  const { t } = useI18n();
  const policy = useQuery({
    queryKey: queryKeys.insights.disclosure,
    queryFn: () => insightsApi.disclosurePolicy().then((result) => result.data),
  });

  const datasets = [
    { name: t('ui.referentielDesCultures_2fb2a'), endpoint: t('ui.getCrops'), auth: 'session' },
    { name: t('ui.paysEtDevises'), endpoint: t('ui.getCountries'), auth: 'session' },
    { name: t('ui.carteDesExploitationsPubliees'), endpoint: t('ui.getPublicMap'), auth: 'anonyme' },
    { name: t('ui.annuaireDesExploitationsPubliees'), endpoint: t('ui.getPublicFarms'), auth: 'anonyme' },
    { name: t('ui.statistiquesDeSolAgregees'), endpoint: t('ui.getPublicSoilStats'), auth: 'anonyme' },
    { name: t('ui.fichePubliqueDeLot'), endpoint: t('ui.getPublicLotsCode'), auth: 'anonyme' },
    { name: t('ui.indicateursAgregesParPays'), endpoint: t('ui.getInsightsOverview'), auth: 'session' },
    { name: t('ui.prixDeMarche'), endpoint: t('ui.getPrices'), auth: 'session' },
  ];

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>{t('ui.donnees')}</Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.catalogueDeDonnees')}</Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>{t('ui.jeuxDeDonneesExposesParLa')}</Text>

      {policy.isLoading ? (
        <LoadingState count={1} height={120} />
      ) : policy.isError ? (
        <ErrorState error={policy.error} onRetry={() => void policy.refetch()} showRequestId />
      ) : policy.data ? (
        <Card tone="ink" style={{ marginBottom: 24, padding: 32 }}>
          <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 12 }}>{t('ui.seuilDeKAnonymat')}</Text>
          <Text preset="numeric" color={COLORS.pureWhite} style={{ marginBottom: 8 }}>
            {policy.data.minGroupSize}
          </Text>
          <Text preset="caption" color="rgba(246, 247, 242, 0.75)" style={{ lineHeight: 1.7 }}>{t('ui.toutAgregatPortantSurUnGroupe')}</Text>
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
