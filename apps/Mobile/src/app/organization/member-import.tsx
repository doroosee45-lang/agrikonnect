import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi, cooperativeApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Import de membres en masse.
 *
 * Le backend expose l'import sur la coopérative (`POST /cooperatives/:id/members/import`)
 * et renvoie `{ imported, skipped }` : les lignes rejetées sont comptées, jamais
 * ignorées en silence.
 */
export default function OrganizationMemberImport() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const current = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const cooperativeId = current.data?.id ?? null;

  const importMembers = useMutation({
    mutationFn: () => {
      const members = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, firstName = '', lastName = ''] = line.split(',').map((part) => part.trim());
          return { email, firstName, lastName };
        });
      return cooperativeApi.importMembers(cooperativeId ?? '', { members });
    },
    onSuccess: (response) => { setResult(response.data); setError(null); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Import de membres" subtitle="Ajoutez plusieurs membres à la fois." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Import de membres" icon="cloud-upload-outline">
          <Card tone="pale">
            <Text preset="caption" color={COLORS.slateGray}>
              Une ligne par membre, au format : email, prénom, nom. Les lignes invalides sont comptées comme ignorées.
            </Text>
          </Card>
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Liste des membres" value={raw} onChangeText={setRaw} multiline helper="email, prénom, nom" />
              {error ? <ErrorState error={error} /> : null}
              {result ? (
                <Card tone="pale">
                  <Text preset="bodySm">{result.imported} membre(s) importé(s) · {result.skipped} ignoré(s)</Text>
                </Card>
              ) : null}
              <Button
                label="Importer"
                onPress={() => importMembers.mutate()}
                loading={importMembers.isPending}
                disabled={!cooperativeId || raw.trim().length === 0}
              />
              {!cooperativeId ? <Text preset="caption" color={COLORS.slateGray}>Aucune coopérative rattachée à votre organisation.</Text> : null}
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md } });
