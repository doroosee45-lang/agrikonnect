import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { cooperativeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Cooperatives() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const cooperative = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const cooperativeId = cooperative.data?.id;

  const members = useQuery({
    queryKey: queryKeys.cooperatives.members(cooperativeId!),
    queryFn: () => cooperativeApi.members(cooperativeId!, { limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
  });

  const overview = useQuery({
    queryKey: queryKeys.cooperatives.overview(cooperativeId!),
    queryFn: () => cooperativeApi.overview(cooperativeId!).then((result) => result.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
  });

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Coopérative"
        description="Connectez-vous pour gérer votre coopérative, ses membres et ses volumes."
        icon="👥"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Coopérative
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Membres, consentement et volumes consolidés — rien n'est agrégé sans accord explicite.
          </Text>
        </div>

        {cooperative.isLoading ? (
          <LoadingState count={2} height={120} />
        ) : cooperative.isError || !cooperative.data ? (
          <EmptyState
            title="Aucune coopérative"
            description="Votre organisation n'est pas encore rattachée à une coopérative."
            icon="👥"
          />
        ) : (
          <>
            <Card tone="ink" style={{ marginBottom: 24, padding: 32 }}>
              <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 8 }}>
                Coopérative active
              </Text>
              <Text preset="h2" color={COLORS.pureWhite} style={{ marginBottom: 8 }}>
                {cooperative.data.organization?.name ?? 'Coopérative'}
              </Text>
              <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                {cooperative.data.organization?.countryCode ?? '—'}
                {cooperative.data.province ? ` · ${cooperative.data.province}` : ''}
                {cooperative.data.territory ? ` · ${cooperative.data.territory}` : ''}
                {' · créée le '}
                {formatDate(cooperative.data.createdAt, locale)}
              </Text>
              {cooperative.data.legalStatus || cooperative.data.foundedYear !== null ? (
                <Text preset="caption" color="rgba(246, 247, 242, 0.6)" style={{ marginTop: 8 }}>
                  {[cooperative.data.legalStatus, cooperative.data.foundedYear !== null ? `fondée en ${cooperative.data.foundedYear}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
            </Card>

            {overview.data ? (
              <Card tone="white" style={{ marginBottom: 24 }}>
                <Text preset="h3" style={{ marginBottom: 16 }}>
                  Vue d'ensemble
                </Text>
                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Membres
                    </Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(overview.data.members.total, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {formatNumber(overview.data.members.withPlotsConsent, locale)} ont autorisé la portée « parcelles » ·{' '}
                      {formatNumber(overview.data.members.withProductionsConsent, locale)} la portée « productions »
                    </Text>
                  </div>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Parcelles
                    </Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(overview.data.plots.count, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {formatNumber(overview.data.plots.totalAreaHa, locale)} ha
                    </Text>
                  </div>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Cultures
                    </Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(overview.data.crops.length, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {overview.data.crops.slice(0, 3).map((crop) => crop.name).join(', ') || '—'}
                    </Text>
                  </div>
                </div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 16, lineHeight: 1.7 }}>
                  {overview.data.plots.scope}. Rien n'est agrégé sans consentement explicite de chaque
                  membre : un volume absent du total est un volume non autorisé, pas un volume nul.
                </Text>
              </Card>
            ) : null}

            <Text preset="h3" style={{ marginBottom: 16 }}>
              Membres
            </Text>
            {members.isLoading ? (
              <LoadingState count={2} height={80} />
            ) : members.isError ? (
              <ErrorState error={members.error} onRetry={() => void members.refetch()} />
            ) : (members.data ?? []).length === 0 ? (
              <EmptyState title="Aucun membre" description="Les membres rejoignent la coopérative avec leur consentement." icon="👥" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(members.data ?? []).map((member, index) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
                  >
                    <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600, marginBottom: 4 }}>
                          {member.user ? `${member.user.firstName} ${member.user.lastName}` : member.memberOrganizationId ?? member.memberUserId}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {member.status}
                          {member.joinedAt ? ` · rejoint le ${formatDate(member.joinedAt, locale)}` : ''}
                        </Text>
                      </div>
                      <ChipRow>
                        {(member.consentScopes ?? []).map((scope) => (
                          <Chip key={scope} label={scope} tone="success" size="sm" />
                        ))}
                        {member.consentRecordedAt ? (
                          <Chip label={`Consentement ${formatDate(member.consentRecordedAt, locale)}`} tone="neutral" size="sm" />
                        ) : null}
                      </ChipRow>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </AuthGate>
    </Section>
  );
}
