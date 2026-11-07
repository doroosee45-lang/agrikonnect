import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { authApi, organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationProfile() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const organizationId = me.data?.activeOrganizationId ?? null;
  const query = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () => organizationApi.update(organizationId ?? '', {
      name: name.trim() || undefined,
      description: description.trim() || undefined,
    }),
    onSuccess: () => { setError(null); void query.refetch(); },
    onError: (caught) => setError(caught),
  });

  const org = query.data;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Profil organisation" subtitle="Identité publique de votre organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Profil organisation" icon="business-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !org ? <Text preset="body">Aucune organisation active.</Text> : (
            <Card tone="white">
              <View style={styles.form}>
                <Text preset="caption" color={COLORS.slateGray}>Type : {org.type} · Pays : {org.countryCode}</Text>
                <Input label="Nom" value={name || org.name} onChangeText={setName} />
                <Input label="Description" value={description || (org.description ?? '')} onChangeText={setDescription} multiline />
                {error ? <ErrorState error={error} /> : null}
                <Button label="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} />
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
