import { motion } from 'framer-motion';

import { Card, ProvenanceTag, Text } from '@/components/ui';
import { soilApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { SoilProfileResult } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';

/** FARMER — profil de sol fusionné (SOIL-10 → SOIL-13). */
export default function FarmerPlotSoil() {
  const { locale } = useI18n();

  return (
    <PlotModule<SoilProfileResult>
      title="Sol"
      subtitle="Profil fusionné à partir de vos analyses. Les paramètres manquants sont signalés, jamais estimés."
      icon="🧪"
      queryKey={(plotId) => queryKeys.soil.profile(plotId)}
      fetch={(plotId) => soilApi.profile(plotId).then((result) => result.data)}
      emptyTitle="Aucun paramètre"
      emptyDescription="Aucune analyse de sol n'est enregistrée pour cette parcelle."
      isEmpty={(data) => Object.keys(data.fusedProfile).length === 0}
      render={(data) => (
        <>
          {data.missingParameters.length > 0 ? (
            <Card tone="white" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                Paramètres manquants : {data.missingParameters.join(', ')}. Aucune valeur n'est inventée pour les compléter.
              </Text>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {Object.entries(data.fusedProfile).map(([key, parameter], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    {key}
                  </Text>
                  <Text preset="numeric" color={COLORS.forestGreen}>
                    {String(parameter.value ?? '—')}
                    {parameter.unit ? <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{parameter.unit}</span> : null}
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <ProvenanceTag
                      kind={parameter.source === 'declared' ? 'DECLARED' : parameter.source.startsWith('measured') ? 'MEASURED' : 'MODEL'}
                      source={parameter.source}
                      measuredAt={parameter.measuredAt ? formatDate(parameter.measuredAt, locale) : undefined}
                    />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    />
  );
}
