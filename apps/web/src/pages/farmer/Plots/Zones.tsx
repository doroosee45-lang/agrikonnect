import { motion } from 'framer-motion';

import { Card, Chip, Text } from '@/components/ui';
import { precisionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ManagementZoneList } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';

/** FARMER — zones de gestion (PRE-03 → PRE-05), versions archivées, jamais écrasées. */
export default function FarmerPlotZones() {
  const { locale } = useI18n();

  return (
    <PlotModule<ManagementZoneList>
      title="Zones de gestion"
      subtitle="Zones intra-parcellaires calculées par le moteur. Les versions antérieures sont archivées, jamais écrasées."
      icon="🧩"
      disclaimer="Une zone de gestion est une hypothèse de travail calculée à partir de séries historiques. Elle doit être confrontée au terrain avant d'orienter une décision d'investissement."
      queryKey={(plotId) => [...queryKeys.plots.one(plotId), 'zones'] as unknown[]}
      fetch={(plotId) => precisionApi.zones(plotId).then((result) => result.data)}
      emptyTitle="Aucune zone"
      emptyDescription="Aucune zone de gestion n'a été calculée pour cette parcelle."
      isEmpty={(data) => data.versions.length === 0}
      render={(data) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card tone="pale">
            <Text preset="caption">
              Politique de versionnage : {data.versioning}
            </Text>
          </Card>

          {data.versions.map((version, index) => (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
            >
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Text preset="h4">
                    Version {version.methodVersion}
                  </Text>
                  <Text preset="caption">
                    {formatDate(version.computedAt, locale)}
                  </Text>
                </div>
                <Text preset="caption">
                  {version.zones.length} zone(s)
                </Text>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {version.zones.map((zone) => (
                    <div key={`${version.id}-${zone.index}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Chip label={`Zone ${zone.index}`} tone="forest" size="sm" />
                      <Text preset="bodySm" style={{ fontWeight: 600 }}>
                        {zone.label}
                      </Text>
                      {zone.recommendation ? <Text preset="caption">{zone.recommendation}</Text> : null}
                    </div>
                  ))}
                </div>
                {version.sources.missing.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <Text preset="caption" style={{ marginBottom: 8 }}>
                      Sources manquantes :
                    </Text>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {version.sources.missing.map((source) => (
                        <Chip key={source} label={source} tone="neutral" size="sm" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    />
  );
}
