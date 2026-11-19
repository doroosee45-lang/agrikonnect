import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, LoadingState, Screen, Text } from '@/components/ui';
import { authApi, organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationSettings() {
  const params = useLocalSearchParams<{ id?: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const canWrite = useAuthStore((state) => state.can('organizations.write'));
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });
  const organizationId = params.id ?? me.data?.activeOrganizationId ?? null;
  const organization = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId!).then((result) => result.data),
    enabled: Boolean(organizationId),
  });
  const [defaultLocale, setDefaultLocale] = useState('fr');
  const [publicProfile, setPublicProfile] = useState(false);
  const [memberInvitesAllowed, setMemberInvitesAllowed] = useState(false);

  useEffect(() => {
    if (!organization.data) return;
    setDefaultLocale(organization.data.settings?.defaultLocale ?? 'fr');
    setPublicProfile(organization.data.settings?.publicProfile ?? false);
    setMemberInvitesAllowed(organization.data.settings?.memberInvitesAllowed ?? false);
  }, [organization.data]);

  const save = useMutation({
    mutationFn: () =>
      organizationApi.update(organizationId!, {
        settings: { defaultLocale, publicProfile, memberInvitesAllowed },
      }),
    onSuccess: () => void organization.refetch(),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Paramètres de l’organisation" subtitle="Préférences collectives et accès par rôle" />
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres de l’organisation" icon="settings-outline">
        <View style={styles.body}>
          {organization.isLoading ? (
            <LoadingState count={1} height={120} />
          ) : organization.isError ? (
            <ErrorState error={organization.error} onRetry={() => void organization.refetch()} />
          ) : organizationId ? (
            <Card tone="white" style={styles.card}>
              <Text preset="h3">Préférences collectives</Text>
              <Input label="Langue par défaut de l’organisation" value={defaultLocale} onChangeText={setDefaultLocale} editable={canWrite} />
              <View style={styles.row}>
                <Text preset="bodySm" style={styles.flex}>Profil public</Text>
                <Switch value={publicProfile} onValueChange={setPublicProfile} disabled={!canWrite} />
              </View>
              <View style={styles.row}>
                <Text preset="bodySm" style={styles.flex}>Invitations de membres autorisées</Text>
                <Switch value={memberInvitesAllowed} onValueChange={setMemberInvitesAllowed} disabled={!canWrite} />
              </View>
              {canWrite ? (
                <Button label="Enregistrer les paramètres de l’organisation" loading={save.isPending} onPress={() => save.mutate()} />
              ) : (
                <Text preset="caption" color={COLORS.slateGray}>
                  Lecture seule : seuls les responsables autorisés peuvent modifier ces paramètres.
                </Text>
              )}
              {save.error ? <ErrorState error={save.error} /> : null}
            </Card>
          ) : (
            <Text preset="body">Aucune organisation active.</Text>
          )}
        </View>
      </AuthGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  card: { gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  flex: { flex: 1 },
});
