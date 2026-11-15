import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { Button, Card, Chip, ProvenanceTag, Text } from '@/components/ui';
import { satelliteApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { SatelliteObservationList } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n, tr } from '@/i18n';
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
  get REAL() { return tr('ui.mesureReelle'); },
  get CONFIGURATION() { return tr('ui.equipementEnregistreHorsService'); },
  get SIMULATED() { return tr('ui.donneeSimulee'); },
} as const;

/** Bouton d'acquisition à la demande — gère le refus (200) comme un refus, pas comme une erreur. */
function AcquireButton({ plotId }: { plotId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const acquire = useMutation({
    mutationFn: () => satelliteApi.acquire(plotId).then((result) => result.data),
    onSuccess: (data) => {
      if (data.acquired) {
        setOutcome({
          tone: 'success',
          text: t('ui.sceneAcquiredProvider', { provider: data.provider ?? 'satellite', simulated: data.mode === 'SIMULATED' ? t('ui.simulatedSuffix') : '' }),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.satellite.observations(plotId, {}) });
      } else {
        // Le serveur explique le refus : on reprend son motif, sans le reformuler.
        setOutcome({ tone: 'warning', text: data.reason ?? t('ui.acquisitionRefusee') });
      }
    },
    onError: (error) => {
      setOutcome({ tone: 'warning', text: error instanceof Error ? error.message : t('ui.acquisitionImpossible') });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => acquire.mutate()}
        loading={acquire.isPending}
        label={acquire.isPending ? t('ui.acquisitionEnCours') : t('ui.demanderUneNouvelleScene')}
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
  const { t } = useI18n();
  const { locale } = useI18n();

  return (
    <PlotModule<SatelliteObservationList>
      title={t('ui.satellite_d1ffe')}
      subtitle={t('ui.observationsDeSurfaceAcquisesParSatellite')}
      icon="🛰️"
      disclaimer={t('ui.teledetectionMesureDeSurfaceUniquementL')}
      queryKey={(plotId) => queryKeys.satellite.observations(plotId, {})}
      fetch={(plotId) => satelliteApi.observations(plotId, { limit: 50 }).then((result) => result.data)}
      emptyTitle={t('ui.aucuneSceneExploitable')}
      emptyDescription={t('ui.aucuneImageSatelliteNAPu')}
      isEmpty={(data) => data.items.length === 0}
      render={(data, plotId) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              <strong>{t('ui.cesValeursDecriventLaSurfacePas')}</strong>{' '}{t('ui.ellesCompletentLesSondesLaOu')}{' '}<strong>{data.settings.provider}</strong>{' '}{t('ui.sourceDHumiditePrimaire')}{' '}<strong>{data.settings.primaryMoistureSource}</strong>{' '}{t('ui.scenesRefuseesAuDelaDeDe', { cloudCoverRejectPct: data.settings.cloudCoverRejectPct })}</Text>
            <div style={{ marginTop: 12 }}>
              <AcquireButton plotId={plotId} />
            </div>
          </Card>

          {data.settings.sources?.length ? (
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.sourcesDisponibles')}</Text>
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
                        <Chip label={t('ui.insensibleAuxNuages')} tone="success" size="sm" />
                      ) : null}
                      <Chip
                        label={source.measuresSubsurface ? 'sous-sol' : t('ui.surfaceSeule')}
                        tone={source.measuresSubsurface ? 'success' : 'neutral'}
                        size="sm"
                      />
                      <Chip label={t('ui.confidenceInline', { value: source.confidence })} tone="neutral" size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Text preset="h3">{t('ui.observationS', { count: data.count })}</Text>

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
                        {observation.cloudCover !== null ? t('ui.deNuages', { cloudCover: observation.cloudCover }) : ''}
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
                      <Chip label={t('ui.confidenceInline', { value: observation.confidence })} tone="neutral" size="sm" />
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
