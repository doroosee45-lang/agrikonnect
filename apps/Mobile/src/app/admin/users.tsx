import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate, Card, Chip, EmptyState, ErrorState, Input, LoadingState,
  PressableCard, Reveal, Screen, Section, Text,
} from '@/components/ui';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * ADMIN M2 — comptes utilisateurs (SPEC-SUPER-ADMIN U-M2-1), miroir de
 * `apps/web/src/pages/admin/Users.tsx`.
 *
 * Recherche (e-mail, nom, téléphone) + filtres statut/MFA ; chaque ligne ouvre
 * la fiche complète (`/admin/users/[id]`, U-M2-2). Aucune valeur simulée.
 */

const FILTRES_STATUT = [
  { valeur: '', label: 'Tous' },
  { valeur: 'ACTIVE', label: 'Actifs' },
  { valeur: 'SUSPENDED', label: 'Suspendus' },
] as const;

export default function AdminUsers() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [mfa, setMfa] = useState<string>('');

  const filtres = useMemo(
    () => ({
      limit: 100,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status ? { status } : {}),
      ...(mfa ? { mfa } : {}),
    }),
    [q, status, mfa],
  );

  const query = useQuery({
    queryKey: queryKeys.admin.users(filtres),
    queryFn: () => adminApi.users(filtres).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Comptes" subtitle="Utilisateurs, administrateurs et rôles." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Comptes" icon="people-outline">
          <Input
            label="Recherche"
            placeholder="E-mail, nom, téléphone…"
            value={q}
            onChangeText={setQ}
            icon="search-outline"
          />
          <View style={styles.filtres}>
            {FILTRES_STATUT.map((f) => (
              <Text
                key={`act-${f.valeur || 'tous'}`}
                preset="caption"
                color={status === f.valeur ? COLORS.forestGreen : COLORS.slateGray}
                onPress={() => setStatus(f.valeur)}
                style={styles.lienFiltre}
              >
                {f.label}
              </Text>
            ))}
            <Text
              preset="caption"
              color={mfa === 'true' ? COLORS.forestGreen : COLORS.slateGray}
              onPress={() => setMfa(mfa === 'true' ? '' : 'true')}
              style={styles.lienFiltre}
            >
              MFA active
            </Text>
            <Text
              preset="caption"
              color={COLORS.forestGreen}
              onPress={() => router.push('/admin/roles')}
              style={styles.lienFiltre}
            >
              Rôles et permissions →
            </Text>
          </View>

          {query.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun compte"
              description="L'API d'administration n'a renvoyé aucun compte pour ces filtres."
              icon="people-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const user = row as Record<string, unknown>;
                const roles = Array.isArray(user.memberships)
                  ? [...new Set(user.memberships.flatMap((m: { roles?: string[] }) => m.roles ?? []))]
                  : [];
                return (
                  <Reveal key={String(user.id ?? index)} index={index} variant="up">
                    <PressableCard onPress={() => router.push(`/admin/users/${String(user.id)}`)}>
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium">
                            {String(user.firstName ?? '')} {String(user.lastName ?? '')}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {String(user.email ?? user.phone ?? '—')}
                          </Text>
                          {roles.length > 0 && (
                            <Text preset="caption" color={COLORS.slateGray}>
                              {roles.join(', ')}
                            </Text>
                          )}
                        </View>
                        <View style={styles.rowBadges}>
                          <Chip
                            label={String(user.status ?? '—')}
                            tone={String(user.status) === 'ACTIVE' ? 'success' : 'neutral'}
                            size="sm"
                          />
                          {user.mfaEnabled ? <Chip label="MFA" tone="success" size="sm" /> : null}
                        </View>
                      </Card>
                    </PressableCard>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  lienFiltre: { textDecorationLine: 'underline', marginRight: SPACING.sm },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowBadges: { gap: 4, alignItems: 'flex-end' },
});
