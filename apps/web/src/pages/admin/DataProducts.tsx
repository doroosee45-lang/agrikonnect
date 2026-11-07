import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** ADMIN — produits de données : politique de divulgation réelle. */
export default function AdminDataProducts() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const policy = useQuery({
    queryKey: queryKeys.insights.disclosure,
    queryFn: () => insightsApi.disclosurePolicy().then((result) => result.data),
    enabled: isAuthenticated,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Produits de données" description="Jeux de données et politique de divulgation." icon="🗃️">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Produits de données
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Politique de divulgation appliquée aux agrégats publiés.
        </Text>

        {policy.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : policy.isError ? (
          <ErrorState error={policy.error} onRetry={() => void policy.refetch()} showRequestId />
        ) : !policy.data ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card tone="ink" style={{ padding: 32 }}>
              <Text preset="overline" color={COLORS.gold} style={{ marginBottom: 12 }}>
                Seuil de k-anonymat
              </Text>
              <Text preset="numeric" color={COLORS.pureWhite} style={{ marginBottom: 8 }}>
                {policy.data.minGroupSize}
              </Text>
              <Text preset="caption" color="rgba(246, 247, 242, 0.75)" style={{ lineHeight: 1.7 }}>
                Tout groupe plus petit est masqué. Aucune donnée personnelle n'est publiée.
              </Text>
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Règles appliquées
              </Text>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 20 }}>
                {policy.data.rules.map((rule, index) => (
                  <motion.li
                    key={rule}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
                  >
                    <Text preset="bodyMd" color={COLORS.textPrimary}>
                      {rule}
                    </Text>
                  </motion.li>
                ))}
              </ul>
            </Card>

            <Card tone="pale">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Interdictions
              </Text>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 20 }}>
                {policy.data.forbidden.map((item) => (
                  <li key={item}>
                    <Text preset="bodyMd" color={COLORS.error}>
                      {item}
                    </Text>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
