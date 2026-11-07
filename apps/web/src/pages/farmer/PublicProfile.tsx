import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, LoadingState, Section, Text } from '@/components/ui';
import { authApi, farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — aperçu de la fiche publique et contrôle de publication. */
export default function FarmerPublicProfile() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((result) => result.data), enabled: isAuthenticated, retry: false });
  const farms = useQuery({ queryKey: queryKeys.farms.list({ limit: 50 }), queryFn: () => farmApi.list({ limit: 50 }).then((result) => result.data), enabled: isAuthenticated, retry: false });

  const published = farms.data?.filter((farm) => farm.isPublic) ?? [];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Ma fiche publique" icon="🌍">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Ma fiche publique
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Ce que les visiteurs voient. Les contacts restent masqués tant que vous ne les rendez pas publics.
        </Text>

        {me.isLoading || farms.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : (
          <>
            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>
                {me.data?.user.firstName} {me.data?.user.lastName}
              </Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <Chip label={me.data?.user.countryCode ?? '—'} tone="neutral" size="sm" />
              </div>
            </Card>

            <Text preset="h3" style={{ marginBottom: 12 }}>
              Exploitations publiées
            </Text>
            {published.length === 0 ? (
              <Card tone="pale">
                <Text preset="bodySm" color={COLORS.slateGray}>
                  Aucune exploitation n'est publiée. Publiez une exploitation pour apparaître dans l'annuaire.
                </Text>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {published.map((farm, index) => (
                  <motion.div
                    key={farm.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
                  >
                    <Card tone="white" hover>
                      <Text preset="h4" style={{ marginBottom: 4 }}>
                        {farm.name}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {farm.countryCode} · mise à jour {formatDate(farm.updatedAt, locale)}
                      </Text>
                      <div style={{ marginTop: 12 }}>
                        <Link to={`/public/farms/${farm.slug}`}>
                          <Button label="Voir la fiche" variant="outline" size="sm" />
                        </Link>
                      </div>
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
