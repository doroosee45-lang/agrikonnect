import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, ChipRow, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { syncApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * FARMER — état de synchronisation (SYNC-01 → SYNC-05).
 *
 * Trois faits affichés, tous fournis par le serveur :
 * - **les collections synchronisables** et leurs règles (idempotence par `opId`,
 *   concurrence par version optimiste) ;
 * - **les conflits ouverts** — le backend refuse le « dernier écrivant gagne », un
 *   conflit reste ouvert jusqu'à arbitrage humain ;
 * - **le dernier incrément disponible**, avec son curseur.
 *
 * Un conflit n'est jamais présenté comme résolu : le masquer ferait perdre une
 * saisie de l'agriculteur.
 */
export default function FarmerSyncStatus() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const collections = useQuery({
    queryKey: queryKeys.sync.collections,
    queryFn: () => syncApi.collections().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const conflicts = useQuery({
    queryKey: queryKeys.sync.conflicts({ days: 30 }),
    queryFn: () => syncApi.conflicts({ days: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const pending = useQuery({
    queryKey: queryKeys.sync.pull({ limit: 1 }),
    queryFn: () => syncApi.pull({ limit: 1 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const openConflicts = conflicts.data?.conflicts.length ?? 0;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Synchronisation"
        description="État de synchronisation de vos données."
        icon="🔄"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 760 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Synchronisation
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Les modifications hors ligne sont conservées localement puis réconciliées avec le serveur.
            Aucune n'est écrasée en silence.
          </Text>

          {collections.isLoading || conflicts.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : collections.isError ? (
            <ErrorState error={collections.error} onRetry={() => void collections.refetch()} showRequestId />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card tone={openConflicts > 0 ? 'pale' : 'white'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <Text preset="h3">Conflits ouverts</Text>
                  <Chip
                    label={openConflicts > 0 ? `${openConflicts} à arbitrer` : 'aucun'}
                    tone={openConflicts > 0 ? 'warning' : 'success'}
                    size="sm"
                  />
                </div>
                <Text preset="caption" color={COLORS.textPrimary} style={{ marginTop: 12, lineHeight: 1.7 }}>
                  {conflicts.data?.policy ??
                    'Aucune résolution silencieuse : les conflits restent ouverts jusqu’à arbitrage.'}
                </Text>
                {conflicts.data && conflicts.data.operations.length > 0 ? (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {conflicts.data.operations.slice(0, 8).map((operation) => (
                      <div
                        key={operation.opId}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                      >
                        <Text preset="caption" color={COLORS.textPrimary}>
                          {operation.collection} · {operation.operation}
                          {operation.entityId ? ` · ${operation.entityId}` : ''}
                        </Text>
                        <Chip
                          label={operation.result}
                          tone={operation.result === 'CONFLICT' ? 'warning' : 'neutral'}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Dernier incrément disponible
                </Text>
                {pending.data ? (
                  <>
                    <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.8 }}>
                      Depuis le {formatDate(pending.data.since, locale)}
                      {pending.data.hasMore ? ' · d’autres changements suivent' : ' · à jour'}
                    </Text>
                    <div style={{ marginTop: 12 }}>
                      <ChipRow>
                        {Object.entries(pending.data.counts)
                          .filter(([, count]) => count > 0)
                          .map(([name, count]) => (
                            <Chip key={name} label={`${name} : ${count}`} tone="info" size="sm" />
                          ))}
                        {Object.values(pending.data.counts).every((count) => count === 0) ? (
                          <Chip label="aucun changement" tone="neutral" size="sm" />
                        ) : null}
                      </ChipRow>
                    </div>
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12, lineHeight: 1.7 }}>
                      {pending.data.policy.tombstones}. {pending.data.policy.conflictResolution}
                    </Text>
                  </>
                ) : (
                  <Text preset="caption" color={COLORS.slateGray}>
                    État non disponible.
                  </Text>
                )}
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>
                  Collections synchronisables
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(collections.data?.collections ?? []).map((collection) => (
                    <div
                      key={collection.name}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                    >
                      <div>
                        <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                          {collection.name}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {collection.operations.join(' · ')}
                        </Text>
                      </div>
                      <ChipRow>
                        <Chip
                          label={collection.softDelete ? 'suppression logique' : 'suppression définitive'}
                          tone="neutral"
                          size="sm"
                        />
                        <Chip label={`idempotence : ${collection.idempotentBy}`} tone="neutral" size="sm" />
                        <Chip label={collection.concurrency} tone="neutral" size="sm" />
                      </ChipRow>
                    </div>
                  ))}
                </div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 16, lineHeight: 1.7 }}>
                  Chaque opération porte un identifiant unique : rejouer un envoi après une coupure réseau ne
                  crée pas de doublon. La concurrence est résolue par version, jamais par écrasement.
                </Text>
              </Card>
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
