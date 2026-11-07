import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** ORGANIZATION — profil de l'organisation. */
export default function OrganizationProfile() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const organizations = useAuthStore((state) => state.user?.organizations ?? []);
  const organizationId = organizations[0]?.id;

  const profile = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId!).then((result) => result.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Profil" icon="🏢">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Profil de l'organisation
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Identité déclarée, rôles détenus et rattachement coopératif.
          </Text>

          {profile.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : profile.isError ? (
            <ErrorState error={profile.error} onRetry={() => void profile.refetch()} showRequestId />
          ) : !profile.data ? (
            <EmptyState
              title="Aucune organisation"
              description="Votre compte n'est rattaché à aucune organisation active."
              icon="🏢"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card tone="ink" style={{ padding: 28 }}>
                <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 8 }}>
                  {profile.data.type}
                </Text>
                <Text preset="h2" color={COLORS.pureWhite} style={{ marginBottom: 8 }}>
                  {profile.data.name}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                  {profile.data.slug} · {profile.data.countryCode} · créée le{' '}
                  {formatDate(profile.data.createdAt, locale)}
                </Text>
                {profile.data.description ? (
                  <Text preset="caption" color="rgba(246, 247, 242, 0.65)" style={{ marginTop: 12, lineHeight: 1.7 }}>
                    {profile.data.description}
                  </Text>
                ) : null}
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Vos rôles
                </Text>
                {profile.data.roles.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>
                    Aucun rôle enregistré sur cette organisation.
                  </Text>
                ) : (
                  <ChipRow>
                    {profile.data.roles.map((role) => (
                      <Chip key={role} label={role} tone="info" size="sm" />
                    ))}
                  </ChipRow>
                )}
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12, lineHeight: 1.7 }}>
                  Les rôles déterminent ce que vous pouvez consulter et modifier. Ils sont attribués par
                  l'organisation, jamais déclarés par le compte.
                </Text>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Rattachement coopératif
                </Text>
                {profile.data.cooperative ? (
                  <ChipRow>
                    <Chip label="membre d'une coopérative" tone="success" size="sm" />
                  </ChipRow>
                ) : (
                  <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
                    Cette organisation n'est rattachée à aucune coopérative. Aucun volume n'est agrégé
                    sans rattachement explicite.
                  </Text>
                )}
              </Card>
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
