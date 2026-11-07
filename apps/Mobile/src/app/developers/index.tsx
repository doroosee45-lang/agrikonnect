import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { API_BASE_URL } from '@/lib/config';
import { formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { apiClientApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Espace développeurs : clients API, finalité déclarée, clés et usage réel. */
export default function Developers() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [purposeFor, setPurposeFor] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ label: string; secret: string } | null>(null);
  const [usageFor, setUsageFor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const clients = useQuery({
    queryKey: queryKeys.apiClients.all,
    queryFn: () => apiClientApi.clients().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const usage = useQuery({
    queryKey: queryKeys.apiClients.usage(usageFor ?? 'none', { days: 30 }),
    queryFn: () => apiClientApi.usage(usageFor as string, { days: 30 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(usageFor),
  });

  const create = useMutation({
    mutationFn: () => apiClientApi.create({ name: name.trim(), contactEmail: email.trim() || undefined }),
    onSuccess: () => {
      setCreating(false);
      setError(null);
      setName('');
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const createKey = useMutation({
    mutationFn: (id: string) => apiClientApi.createKey(id, { label: 'clé mobile' }),
    onSuccess: (result) => {
      setError(null);
      setSecret({ label: result.data.key.label, secret: result.data.secret });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const savePurpose = useMutation({
    mutationFn: () => apiClientApi.setPurpose(purposeFor as string, { dataPurpose: purpose.trim() }),
    onSuccess: () => {
      setError(null);
      setPurpose('');
      setPurposeFor(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => apiClientApi.revokeKey(keyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all }),
    onError: (caught) => setError(caught),
  });

  const items = clients.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Développeurs" subtitle="Clients API, finalité de traitement, clés et consommation." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour gérer vos clients API."
          icon="code-slash-outline"
        >
          <Card tone="pale" style={styles.note}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Une clé n’est affichée qu’à sa création. La finalité du traitement doit être déclarée puis approuvée
              avant tout accès aux données : sans finalité, le client reste inactif.
            </Text>
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Base de l’API
            </Text>
            <Text preset="caption" color={COLORS.slateGray} selectable style={styles.mono}>
              {API_BASE_URL}
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Authentification Bearer, en-tête d’idempotence sur les écritures, enveloppe de réponse uniforme
              (success, data, meta) et errors[] field par field en cas d’échec.
            </Text>
          </Card>

          {secret ? (
            <Card tone="gold" style={styles.secret}>
              <Text preset="overline" color={COLORS.forestGreen}>
                Clé « {secret.label} » — à copier maintenant
              </Text>
              <Text preset="bodySm" color={COLORS.textPrimary} selectable style={styles.mono}>
                {secret.secret}
              </Text>
              <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                Elle ne sera plus affichée. Révoquez-la immédiatement en cas de fuite.
              </Text>
              <Button label="Masquer" onPress={() => setSecret(null)} variant="outline" size="sm" icon="eye-off-outline" />
            </Card>
          ) : null}

          <View style={styles.toolbar}>
            <Button
              label={creating ? 'Fermer' : 'Nouveau client API'}
              onPress={() => setCreating((value) => !value)}
              variant={creating ? 'ghost' : 'primary'}
              size="sm"
              icon={creating ? 'close' : 'add'}
            />
          </View>

          {creating ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
              <Card tone="white" style={styles.card}>
                <Input label="Nom du client" value={name} onChangeText={setName} placeholder="Application terrain" icon="apps-outline" autoCapitalize="words" />
                <Input label="E-mail de contact" value={email} onChangeText={setEmail} placeholder="dev@organisation.org" icon="mail-outline" keyboardType="email-address" optionalLabel="facultatif" />
                {error ? <ErrorState error={error} showRequestId /> : null}
                <Button label="Créer le client" onPress={() => create.mutate()} variant="primary" fullWidth loading={create.isPending} disabled={name.trim().length < 2} />
              </Card>
            </Animated.View>
          ) : null}

          {clients.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : clients.isError ? (
            <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun client API"
              description="Créez un client pour obtenir des clés et suivre la consommation route par route."
              icon="code-slash-outline"
              action={{ label: 'Nouveau client API', onPress: () => setCreating(true) }}
            />
          ) : (
            <View style={styles.list}>
              {items.map((client, index) => (
                <Reveal key={client.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {client.name}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          créé le {formatDate(client.createdAt, locale)}
                          {client.contactEmail ? ` · ${client.contactEmail}` : ''}
                          {client.purposeApprovedAt ? ` · finalité approuvée le ${formatDate(client.purposeApprovedAt, locale)}` : ''}
                        </Text>
                      </View>
                      <Chip
                        label={client.status}
                        tone={client.status === 'ACTIVE' ? 'success' : client.status === 'REVOKED' ? 'error' : 'warning'}
                        size="sm"
                      />
                    </View>

                    {client.scopes.length > 0 ? (
                      <ChipRow>
                        {client.scopes.map((scope) => (
                          <Chip key={scope} label={scope} tone="neutral" size="sm" />
                        ))}
                      </ChipRow>
                    ) : null}

                    {purposeFor === client.id ? (
                      <View style={styles.purpose}>
                        <Input
                          label="Finalité du traitement"
                          value={purpose}
                          onChangeText={setPurpose}
                          placeholder="Suivi des parcelles pour nos adhérents…"
                          icon="document-text-outline"
                        />
                        <Button
                          label="Déclarer la finalité"
                          onPress={() => savePurpose.mutate()}
                          variant="primary"
                          size="sm"
                          loading={savePurpose.isPending}
                          disabled={purpose.trim().length < 10}
                        />
                      </View>
                    ) : (
                      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                        Finalité : {client.dataPurpose ?? 'non déclarée'}
                      </Text>
                    )}

                    {error ? <ErrorState error={error} showRequestId /> : null}

                    <View style={styles.actions}>
                      <Button label="Nouvelle clé" onPress={() => createKey.mutate(client.id)} variant="outline" size="sm" icon="key-outline" loading={createKey.isPending} />
                      <Button
                        label={purposeFor === client.id ? 'Annuler' : 'Déclarer la finalité'}
                        onPress={() => setPurposeFor(purposeFor === client.id ? null : client.id)}
                        variant="ghost"
                        size="sm"
                        icon="document-text-outline"
                      />
                      <Button
                        label={usageFor === client.id ? 'Masquer l’usage' : 'Voir l’usage'}
                        onPress={() => setUsageFor(usageFor === client.id ? null : client.id)}
                        variant="ghost"
                        size="sm"
                        icon="bar-chart-outline"
                      />
                    </View>

                    {(client.keys ?? []).length > 0 ? (
                      <View style={styles.keys}>
                        {(client.keys ?? []).map((key) => (
                          <View key={key.id} style={styles.keyRow}>
                            <View style={styles.headText}>
                              <Text preset="caption" color={COLORS.textPrimary}>
                                {key.label} · préfixe {key.prefix}
                              </Text>
                              <Text preset="caption" color={COLORS.slateGray}>
                                {key.status}
                                {key.lastUsedAt ? ` · dernier usage ${formatDate(key.lastUsedAt, locale)}` : ' · jamais utilisée'}
                                {key.expiresAt ? ` · expire le ${formatDate(key.expiresAt, locale)}` : ''}
                              </Text>
                            </View>
                            {key.status === 'ACTIVE' ? (
                              <Button
                                label="Révoquer"
                                onPress={() => revoke.mutate(key.id)}
                                variant="ghost"
                                size="sm"
                                icon="close-circle-outline"
                                loading={revoke.isPending && revoke.variables === key.id}
                              />
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {usageFor === client.id ? (
                      <View style={styles.usage}>
                        {usage.isLoading ? (
                          <LoadingState count={1} height={70} />
                        ) : usage.isError ? (
                          <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />
                        ) : (
                          <>
                            <Text preset="caption" color={COLORS.textPrimary}>
                              {formatNumber(usage.data?.total ?? 0, locale)} appel(s) sur {formatNumber(usage.data?.window.days ?? 30, locale)} jours
                            </Text>
                            {(usage.data?.routes ?? []).length === 0 ? (
                              <Text preset="caption" color={COLORS.slateGray}>
                                Aucun appel enregistré sur la période.
                              </Text>
                            ) : (
                              (usage.data?.routes ?? []).map((route) => (
                                <View key={route.route} style={styles.routeRow}>
                                  <Text preset="caption" color={COLORS.textPrimary} style={styles.routeName}>
                                    {route.route}
                                  </Text>
                                  <Text preset="caption" color={COLORS.slateGray}>
                                    {formatNumber(route.calls, locale)} appel(s)
                                    {route.errors > 0 ? ` · ${formatNumber(route.errors, locale)} erreur(s)` : ''}
                                  </Text>
                                </View>
                              ))
                            )}
                          </>
                        )}
                      </View>
                    ) : null}
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
  lineHeight: { lineHeight: 18 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  secret: { gap: SPACING.sm },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  purpose: { gap: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  keys: { gap: SPACING.sm },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  usage: { gap: SPACING.xs },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  routeName: { flex: 1 },
  list: { gap: SPACING.md },
});
