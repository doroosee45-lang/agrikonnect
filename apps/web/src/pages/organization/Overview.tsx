import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { cooperativeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * ORGANIZATION — vue d'ensemble : membres, parcelles, productions.
 *
 * Les agrégats ne couvrent que les membres ayant donné leur consentement pour la
 * portée concernée. La `scope` renvoyée par le serveur est affichée : un total
 * partiel présenté comme un total serait une donnée fausse.
 */
export default function OrganizationOverview() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const cooperative = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const cooperativeId = cooperative.data?.id;

  const overview = useQuery({
    queryKey: queryKeys.cooperatives.overview(cooperativeId ?? ''),
    queryFn: () => cooperativeApi.overview(cooperativeId!).then((result) => result.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
    retry: false,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Vue d'ensemble" icon="📊">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Vue d'ensemble
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Compteurs consolidés sur les membres ayant autorisé chaque portée.
          </Text>

          {cooperative.isLoading || overview.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : cooperative.isError ? (
            <ErrorState error={cooperative.error} onRetry={() => void cooperative.refetch()} showRequestId />
          ) : !cooperativeId ? (
            <EmptyState
              title="Aucune coopérative"
              description="Votre organisation n'est rattachée à aucune coopérative : aucun agrégat n'est calculable."
              icon="👥"
            />
          ) : overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} showRequestId />
          ) : !overview.data ? (
            <EmptyState
              title="Aucun agrégat"
              description="Aucun membre n'a encore donné de consentement : il n'y a rien à consolider."
              icon="📊"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <Card tone="ink" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.gold} style={{ marginBottom: 8 }}>
                    Membres
                  </Text>
                  <Text preset="numeric" color={COLORS.pureWhite} style={{ fontSize: 36 }}>
                    {formatNumber(overview.data.members.total, locale)}
                  </Text>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={{ marginTop: 8 }}>
                    {formatNumber(overview.data.members.withPlotsConsent, locale)} consentement(s) « parcelles »
                  </Text>
                </Card>

                <Card tone="white" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    Parcelles
                  </Text>
                  <Text preset="numeric" color={COLORS.forestGreen} style={{ fontSize: 36 }}>
                    {formatNumber(overview.data.plots.count, locale)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
                    {formatNumber(overview.data.plots.totalAreaHa, locale)} ha cumulées
                  </Text>
                </Card>

                <Card tone="white" style={{ padding: 24 }}>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    Volume déclaré
                  </Text>
                  <Text preset="numeric" color={COLORS.forestGreen} style={{ fontSize: 36 }}>
                    {formatNumber(
                      overview.data.productions.byCrop.reduce((acc, crop) => acc + crop.quantityKg, 0),
                      locale,
                    )}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
                    kg · source « {overview.data.productions.source} »
                  </Text>
                </Card>
              </div>

              <Card tone="pale">
                <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                  <strong>Portée des agrégats.</strong> Parcelles : {overview.data.plots.scope}.
                  Productions : {overview.data.productions.scope}. Un membre qui n'a pas autorisé une
                  portée est absent du total correspondant — son volume n'est pas compté zéro, il n'est
                  pas compté du tout.
                </Text>
              </Card>

              {overview.data.productions.byCrop.length > 0 ? (
                <Card tone="white">
                  <Text preset="h3" style={{ marginBottom: 16 }}>
                    Volumes par culture
                  </Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {overview.data.productions.byCrop.map((crop) => (
                      <div
                        key={crop.cropId}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                      >
                        <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                          {crop.crop}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatNumber(crop.records, locale)} déclaration(s) ·{' '}
                          {formatNumber(crop.quantityKg, locale)} kg
                        </Text>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card tone="white">
                  <Text preset="h3" style={{ marginBottom: 12 }}>
                    Volumes par culture
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
                    Aucune production déclarée par un membre ayant autorisé la portée « productions ».
                  </Text>
                </Card>
              )}

              <div>
                <Text preset="h4" style={{ marginBottom: 12 }}>
                  Cultures suivies
                </Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {overview.data.crops.length === 0 ? (
                    <Text preset="caption" color={COLORS.slateGray}>
                      Aucune culture renseignée sur les parcelles autorisées.
                    </Text>
                  ) : (
                    overview.data.crops.map((crop) => (
                      <Chip key={crop.id} label={crop.name} tone="neutral" size="sm" />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
