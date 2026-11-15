import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate, Card, Chip, ErrorState, LoadingState, Reveal, Screen, Section, Text,
} from '@/components/ui';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * ADMIN M2 — rôles de gouvernance et matrice de permissions (U-M2-6), miroir
 * de `apps/web/src/pages/admin/Roles.tsx`.
 *
 * La matrice est lue dans `PERMISSIONS` côté serveur (GET /admin/roles) :
 * aucun rôle ni permission n'est écrit dans cet écran. La nomination se fait
 * depuis la fiche de chaque compte (palier 2 — Super Admin).
 */
export default function AdminRoles() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const roles = useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: () => adminApi.roles().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const matrice = roles.data as
    | { roles: Array<{ role: string; permissions: string[] }>; permissions: Record<string, string[]> }
    | undefined;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.rolesEtPermissions')} subtitle={t('ui.matriceEffectiveDeLaPlateforme')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.roles')} icon="shield-checkmark-outline">
          <Text preset="caption" color={COLORS.forestGreen} onPress={() => router.push('/admin/users')} style={styles.retour}>{t('ui.retourAuxComptes')}</Text>

          {roles.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : roles.isError ? (
            <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
          ) : !matrice ? (
            <Card tone="white">
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunRoleExpose')}</Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {matrice.roles.map((entree, index) => (
                <Reveal key={entree.role} index={index} variant="up">
                  <Card tone="white" style={styles.bloc}>
                    <View style={styles.entete}>
                      <Text preset="bodyMedium">{entree.role}</Text>
                      {entree.role === 'SUPER_ADMIN' && <Chip label={t('ui.palier2')} tone="warning" size="sm" />}
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.permissionSEffectiveS', { length: entree.permissions.length })}</Text>
                    <View style={styles.permissions}>
                      {entree.permissions.map((permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          tone={entree.role === 'SUPER_ADMIN' ? 'success' : 'neutral'}
                          size="sm"
                        />
                      ))}
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  retour: { textDecorationLine: 'underline' },
  list: { gap: SPACING.sm },
  bloc: { gap: SPACING.xs },
  entete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  permissions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
