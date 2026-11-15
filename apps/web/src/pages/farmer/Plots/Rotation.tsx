import { motion } from 'framer-motion';

import { Card, Chip, Text } from '@/components/ui';
import { soilApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { RotationPlanList } from '@/services/types';
import { DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';
import { useI18n } from '@/i18n';

/** FARMER — propositions de rotation versionnées (SOIL-06), décision humaine. */
export default function FarmerPlotRotation() {
  const { t } = useI18n();
  return (
    <PlotModule<RotationPlanList>
      title={t('ui.rotation')}
      subtitle={t('ui.propositionsDeRotationVersionneesChaquePropositi')}
      icon="🔄"
      disclaimer={t('ui.unePropositionDeRotationNEst')}
      queryKey={(plotId) => queryKeys.soil.rotation(plotId)}
      fetch={(plotId) => soilApi.rotationPlans(plotId).then((result) => result.data)}
      emptyTitle={t('ui.aucuneProposition')}
      emptyDescription={t('ui.aucuneRotationNAEteProposee')}
      isEmpty={(data) => data.items.length === 0}
      render={(data) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.items.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
            >
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="h4" style={{ marginBottom: 4 }}>{t('ui.horizonAnS', { horizonYears: plan.horizonYears })}</Text>
                    <Text preset="caption">{t('ui.regles_acad9', { ruleSetVersion: plan.ruleSetVersion })}</Text>
                  </div>
                  <Chip label={plan.status} tone={plan.status === 'ACCEPTED' ? 'success' : plan.status === 'REJECTED' ? 'error' : 'warning'} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.steps.sequence.map((step) => (
                    <div key={`${plan.id}-${step.year}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Chip label={t('ui.annee_69aa1', { year: step.year })} tone="forest" size="sm" />
                      <Text preset="bodySm">{step.cropSlug}</Text>
                      {step.family ? <Chip label={step.family} tone="neutral" size="sm" /> : null}
                      {step.rationale ? <Text preset="caption">{step.rationale}</Text> : null}
                    </div>
                  ))}
                </div>

                {plan.steps.assumptions.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <Text preset="caption" style={{ marginBottom: 8 }}>{t('ui.hypotheses')}</Text>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {plan.steps.assumptions.map((assumption, i) => (
                        <Chip key={`${plan.id}-assumption-${i}`} label={assumption} tone="neutral" size="sm" />
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
