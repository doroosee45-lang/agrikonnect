import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { Button, Card, Chip, ProvenanceTag, Text } from '@/components/ui';
import { satelliteApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { SatelliteObservationList } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';

/**
 * FARMER — observations satellite de la parcelle (GEO-03 → GEO-06).
 *
 * Deux règles non négociables, rappelées par le serveur dans chaque réponse :
 *
 * 1. **Un satellite ne mesure pas le sous-sol.** Il mesure la surface — humidité
 *    de surface, température, vigueur végétale. La vérité du sous-sol vient des
 *    sondes et du géoradar. `measuresSubsurface: false` est donc affiché, pas
 *    seulement transporté.
 * 2. **Une scène refusée n'est pas une absence de donnée.** Le backend renvoie
 *    200 avec `rejected: true` et son motif (couverture nuageuse au-delà du
 *    seuil, acquisition désactivée). Le motif est montré tel quel : en zone
 *    équatoriale, le refus optique est la norme, pas l'exception.
 *
 * Le `mode` de chaque observation est affiché. Une observation `SIMULATED` n'est
 * jamais présentée comme une mesure physique.
 */

const MODE_TONE = { REAL: 'success', CONFIGURATION: 'warning', SIMULATED: 'neutral' } as const;
const MODE_LABEL = {
  REAL: 'mesure réelle',
  CONFIGURATION: 'équipement enregistré, hors service',
  SIMULATED: 'donnée simulée',
} as const;

/** Bouton d'acquisition à la demande — gère le refus (200) comme un refus, pas comme une erreur. */
function AcquireButton({ plotId }: { plotId: string }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const acquire = useMutation({
    mutationFn: () => satelliteApi.acquire(plotId).then((result) => result.data),
    onSuccess: (data) => {
      if (data.acquired) {
        setOutcome({
          tone: 'success',
          text: `Scène acquise (${data.provider ?? 'satellite'}${data.mode === 'SIMULATED' ? ' — simulée' : ''}).`,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.satellite.observations(plotId, {}) });
      } else {
        // Le serveur explique le refus : on reprend son motif, sans le reformuler.
        setOutcome({ tone: 'warning', text: data.reason ?? 'Acquisition refusée.' });
      }
    },
    onError: (error) => {
      setOutcome({ tone: 'warning', text: error instanceof Error ? error.message : 'Acquisition impossible.' });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => acquire.mutate()}
        loading={acquire.isPending}
        label={acquire.isPending ? 'Acquisition en cours…' : 'Demander une nouvelle scène'}
      />
      {outcome ? (
        <Text preset="caption" color={outcome.tone === 'success' ? COLORS.success : COLORS.warning}>
          {outcome.text}
        </Text>
      ) : null}
    </div>
  );
}

export default function FarmerPlotSatellite() {
  const { locale } = useI18n();

  return (
    <PlotModule<SatelliteObservationList>
      title="Satellite"
      subtitle="Observations de surface acquises par satellite. Le sous-sol n'est jamais déduit d'une image."
      icon="🛰️"
      disclaimer="Télédétection : mesure de surface uniquement. L'humidité du sous-sol et la structure du sol ne proviennent que des sondes et du géoradar."
      queryKey={(plotId) => queryKeys.satellite.observations(plotId, {})}
      fetch={(plotId) => satelliteApi.observations(plotId, { limit: 50 }).then((result) => result.data)}
      emptyTitle="Aucune scène exploitable"
      emptyDescription="Aucune image satellite n'a pu être exploitée pour cette parcelle. Une scène refusée pour cause de couverture nuageuse n'est pas enregistrée : une date sans image reste vide, jamais interpolée."
      isEmpty={(data) => data.items.length === 0}
      render={(data, plotId) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              <strong>Ces valeurs décrivent la surface, pas le sous-sol.</strong> Elles complètent les
              sondes là où aucune sonde n'existe, avec une confiance plus faible. Fournisseur{' '}
              <strong>{data.settings.provider}</strong> · source d'humidité primaire{' '}
              <strong>{data.settings.primaryMoistureSource}</strong> · scènes refusées au-delà de{' '}
              {data.settings.cloudCoverRejectPct} % de couverture nuageuse.
            </Text>
            <div style={{ marginTop: 12 }}>
              <AcquireButton plotId={plotId} />
            </div>
          </Card>

          {data.settings.sources?.length ? (
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Sources disponibles
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.settings.sources.map((source) => (
                  <div
                    key={source.id}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                  >
                    <div>
                      <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                        {source.id}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {source.mission} · {source.sensor} · {source.role}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {source.cloudInsensitive ? (
                        <Chip label="insensible aux nuages" tone="success" size="sm" />
                      ) : null}
                      <Chip
                        label={source.measuresSubsurface ? 'sous-sol' : 'surface seule'}
                        tone={source.measuresSubsurface ? 'success' : 'neutral'}
                        size="sm"
                      />
                      <Chip label={`confiance ${source.confidence}`} tone="neutral" size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Text preset="h3">{data.count} observation(s)</Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.items.map((observation, index) => (
              <motion.div
                key={observation.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: DURATION.base / 1000,
                  delay: Math.min(index, 8) * 0.03,
                  ease: EASE.out,
                }}
              >
                <Card tone="white" hover>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <Text preset="h4" style={{ marginBottom: 4 }}>
                        {observation.index} — {observation.value.toFixed(3)}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatDate(observation.observedAt, locale)} · {observation.provider}
                        {observation.cloudCover !== null ? ` · ${observation.cloudCover} % de nuages` : ''}
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <ProvenanceTag
                          kind="REMOTE_SENSING"
                          source={observation.provider}
                          method={observation.index}
                          measuredAt={observation.observedAt}
                          confidence={observation.confidence}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Chip
                        label={MODE_LABEL[observation.mode]}
                        tone={MODE_TONE[observation.mode]}
                        size="sm"
                      />
                      <Chip label={`confiance ${observation.confidence}`} tone="neutral" size="sm" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    />
  );
}
