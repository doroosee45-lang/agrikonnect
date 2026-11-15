import { motion } from 'framer-motion';

import { Card, Chip, Text } from '@/components/ui';
import { soilApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { FarmingPlanList } from '@/services/types';
import { DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';
import { useI18n } from '@/i18n';

const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

/** FARMER — calendrier agricole issu du jeu de règles (SOIL-07). */
export default function FarmerPlotPlan() {
  const { t } = useI18n();
  return (
    <PlotModule<FarmingPlanList>
      title={t('ui.planAgricole')}
      subtitle={t('ui.calendrierDesActivitesGenereParLe')}
      icon="🗓️"
      disclaimer={t('ui.leCalendrierEstUnePropositionCalculee')}
      queryKey={(plotId) => queryKeys.soil.farmingPlans(plotId)}
      fetch={(plotId) => soilApi.farmingPlans(plotId).then((result) => result.data)}
      emptyTitle={t('ui.aucunPlan')}
      emptyDescription={t('ui.aucunCalendrierNAEteGenere')}
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
                <Text preset="h4" style={{ marginBottom: 16 }}>{t('ui.plan_bc1c2', { ruleSetVersion: plan.calendar.ruleSetVersion })}</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.calendar.entries.map((entry, entryIndex) => (
                    <div key={`${plan.id}-${entryIndex}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Chip label={t('ui.annee_69aa1', { year: entry.year })} tone="forest" size="sm" />
                      <Text preset="bodySm" style={{ fontWeight: 600, minWidth: 140 }}>
                        {entry.activity}
                      </Text>
                      <Text preset="caption">
                        {MONTHS[entry.window.startMonth - 1] ?? '?'} → {MONTHS[entry.window.endMonth - 1] ?? '?'}
                      </Text>
                      {entry.cropSlug ? <Chip label={entry.cropSlug} tone="neutral" size="sm" /> : null}
                      {entry.rationale ? <Text preset="caption">{entry.rationale}</Text> : null}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    />
  );
}
