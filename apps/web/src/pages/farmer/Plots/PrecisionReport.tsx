import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Button, Card, Chip, Text } from '@/components/ui';
import { precisionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PrecisionReportList } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';

/** FARMER — rapports de précision (PRE-06 → PRE-14), génération PDF et validation humaine. */
export default function FarmerPlotPrecisionReport() {
  const { locale } = useI18n();

  return (
    <PlotModule<PrecisionReportList>
      title="Rapport de précision"
      subtitle="Rapports générés par le moteur de géo-intelligence. Une analyse générée par IA reste soumise à une validation humaine avant toute utilisation."
      icon="📐"
      disclaimer="Contenu généré par une IA. Ce rapport n'est pas un avis agronomique et ne remplace pas un contrôle de terrain. Il doit être validé par un expert avant toute décision."
      queryKey={(plotId) => [...queryKeys.plots.one(plotId), 'precision-reports'] as unknown[]}
      fetch={(plotId) => precisionApi.reports(plotId).then((result) => result.data)}
      emptyTitle="Aucun rapport"
      emptyDescription="Aucun rapport de précision n'a été généré pour cette parcelle."
      isEmpty={(data) => data.reports.length === 0}
      render={(data) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.reports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
            >
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="h4" style={{ marginBottom: 4 }}>
                      Rapport {report.status}
                    </Text>
                    <Text preset="caption">
                      {formatDate(report.generatedAt, locale)}
                      {report.methodVersion ? ` · méthode ${report.methodVersion}` : ''}
                      {report.ruleSetVersion ? ` · règles ${report.ruleSetVersion}` : ''}
                    </Text>
                  </div>
                  <Chip label={report.validated ? 'validé' : 'non validé'} tone={report.validated ? 'success' : 'warning'} size="sm" />
                </div>

                {report.pdfKey ? (
                  <div style={{ marginTop: 12 }}>
                    <Link to={`/api/v1/files/${report.pdfKey}`}>
                      <Button label="Télécharger le PDF" variant="outline" size="sm" />
                    </Link>
                  </div>
                ) : null}

                {report.validatedAt ? (
                  <Text preset="caption" style={{ marginTop: 12 }}>
                    Validé le {formatDate(report.validatedAt, locale)}
                    {report.validatedBy ? ` par ${report.validatedBy}` : ''}
                  </Text>
                ) : (
                  <Text preset="caption" style={{ marginTop: 12 }}>
                    En attente de validation par un expert.
                  </Text>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    />
  );
}
