import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationIndex() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: () => organizationApi.list().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Mon organisation" subtitle="Vos organisations." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Mon organisation" icon="business-outline">
          <Button label="Créer une organisation" variant="primary" onPress={() => router.push('/organization/create')} />
          {query.isLoading ? <LoadingState count={2} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune organisation" description="Créez une organisation pour gérer votre activité." icon="business-outline" /> : (
            <View style={styles.list}>
              {items.map((org, index) => (
                <Reveal key={org.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/organization/${org.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{org.name}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{org.countryCode}</Text>
                      </View>
                      <Chip label={org.type} tone="neutral" size="sm" />
                    </View>
                  </PressableCard>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
