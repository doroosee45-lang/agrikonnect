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
  const { t } = useI18n();
  const { locale } = useI18n();

  return (
    <PlotModule<PrecisionReportList>
      title={t('ui.rapportDePrecision')}
      subtitle={t('ui.rapportsGeneresParLeMoteurDe')}
      icon="📐"
      disclaimer={t('ui.contenuGenereParUneIaCe')}
      queryKey={(plotId) => [...queryKeys.plots.one(plotId), 'precision-reports'] as unknown[]}
      fetch={(plotId) => precisionApi.reports(plotId).then((result) => result.data)}
      emptyTitle={t('ui.aucunRapport')}
      emptyDescription={t('ui.aucunRapportDePrecisionNA')}
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
                    <Text preset="h4" style={{ marginBottom: 4 }}>{t('ui.rapport', { status: report.status })}</Text>
                    <Text preset="caption">
                      {formatDate(report.generatedAt, locale)}
                      {report.methodVersion ? t('ui.methode_50590', { methodVersion: report.methodVersion }) : ''}
                      {report.ruleSetVersion ? t('ui.regles_7416f', { ruleSetVersion: report.ruleSetVersion }) : ''}
                    </Text>
                  </div>
                  <Chip label={report.validated ? t('ui.valide') : t('ui.nonValide')} tone={report.validated ? 'success' : 'warning'} size="sm" />
                </div>

                {report.pdfKey ? (
                  <div style={{ marginTop: 12 }}>
                    <Link to={`/api/v1/files/${report.pdfKey}`}>
                      <Button label={t('ui.telechargerLePdf')} variant="outline" size="sm" />
                    </Link>
                  </div>
                ) : null}

                {report.validatedAt ? (
                  <Text preset="caption" style={{ marginTop: 12 }}>{t('ui.valideLe', { validatedAt: formatDate(report.validatedAt, locale), value: report.validatedBy ? ` par ${report.validatedBy}` : '' })}</Text>
                ) : (
                  <Text preset="caption" style={{ marginTop: 12 }}>{t('ui.enAttenteDeValidationParUn')}</Text>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    />
  );
}
