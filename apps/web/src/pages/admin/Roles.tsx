import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, ChipRow, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * ADMIN M2 — rôles de gouvernance et matrice de permissions (U-M2-6).
 *
 * La matrice est **lue** dans `PERMISSIONS` côté serveur (GET /admin/roles) :
 * aucun rôle ni permission n'est écrit dans cet écran. Le palier 2
 * (nomination/révocation) se fait depuis la fiche utilisateur.
 */
export default function AdminRoles() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const roles = useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: () => adminApi.roles().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const matrice = roles.data as
    | { roles: Array<{ role: string; permissions: string[] }>; permissions: Record<string, string[]> }
    | undefined;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Rôles"
        description="Rôles de gouvernance et permissions effectives."
        icon="🛡️"
      >
        <Text preset="h1" style={{ fontSize: 32, marginBottom: 8 }}>
          Rôles et permissions
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Matrice effective servie par GET /admin/roles. La nomination des rôles de gouvernance
          se fait depuis la fiche de chaque compte (palier 2 — Super Admin, second facteur exigé).
        </Text>

        {roles.isLoading ? (
          <LoadingState count={3} height={120} />
        ) : roles.isError ? (
          <ErrorState error={roles.error} onRetry={() => void roles.refetch()} showRequestId />
        ) : !matrice ? (
          <Card tone="white">
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucun rôle exposé.
            </Text>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {matrice.roles.map((entree, index) => (
              <motion.div
                key={entree.role}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 10) * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <Text preset="h2" style={{ fontSize: 20 }}>
                      {entree.role}
                    </Text>
                    {entree.role === 'SUPER_ADMIN' && <Chip label="Palier 2" tone="warning" />}
                  </div>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    {entree.permissions.length} permission(s) effective(s)
                  </Text>
                  <ChipRow>
                    {entree.permissions.map((permission) => (
                      <Chip
                        key={permission}
                        label={permission}
                        tone={
                          matrice.permissions[permission]?.includes('*')
                            ? 'neutral'
                            : entree.role === 'SUPER_ADMIN'
                              ? 'success'
                              : 'neutral'
                        }
                      />
                    ))}
                  </ChipRow>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
