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
  MobileHorizonOverviewCard,
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
  const { t } = useI18n();
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
    mutationFn: (id: string) => apiClientApi.createKey(id, { label: t('ui.cleMobile') }),
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
  const totalKeys = items.reduce((acc, c) => acc + (c.keys?.length ?? 0), 0);
  const approvedCount = items.filter((c) => Boolean(c.purposeApprovedAt)).length;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.developpeurs')}
        subtitle={t('ui.clientsApiFinaliteDeTraitementCles')}
        ctaLabel={t('ui.nouveau')}
        onCtaPress={() => setCreating((v) => !v)}
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourGererVosClients_a40a2')}
          icon="code-slash-outline"
        >
          <MobileHorizonOverviewCard
            title={t('ui.vueDEnsembleIntegrationsApi')}
            items={[
              {
                id: 'clients',
                label: t('ui.clientsApi'),
                value: formatNumber(items.length, locale),
                subtitle: t('ui.applicationsDeclarees'),
                tone: 'green',
                icon: 'apps-outline',
              },
              {
                id: 'approved',
                label: t('ui.finaliteApprouvee'),
                value: formatNumber(approvedCount, locale),
                subtitle: t('ui.conformiteDonnees'),
                tone: approvedCount > 0 ? 'green' : 'amber',
                icon: 'shield-checkmark-outline',
              },
              {
                id: 'keys',
                label: t('ui.clesEmises'),
                value: formatNumber(totalKeys, locale),
                subtitle: t('ui.sha256Revocables'),
                tone: 'blue',
                icon: 'key-outline',
              },
              {
                id: 'base',
                label: t('ui.passerelleRest'),
                value: 'v1',
                subtitle: API_BASE_URL,
                tone: 'neutral',
                icon: 'code-slash-outline',
              },
            ]}
          />
          <Card tone="pale" style={styles.note}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.uneCleNEstAfficheeQu')}</Text>
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>{t('ui.baseDeLApi')}</Text>
            <Text preset="caption" color={COLORS.slateGray} selectable style={styles.mono}>
              {API_BASE_URL}
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.authentificationBearerEnTeteDIdempotence')}</Text>
          </Card>

          {secret ? (
            <Card tone="gold" style={styles.secret}>
              <Text preset="overline" color={COLORS.forestGreen}>{t('ui.cleACopierMaintenant', { label: secret.label })}</Text>
              <Text preset="bodySm" color={COLORS.textPrimary} selectable style={styles.mono}>
                {secret.secret}
              </Text>
              <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.elleNeSeraPlusAfficheeRevoquez')}</Text>
              <Button label={t('ui.masquer')} onPress={() => setSecret(null)} variant="outline" size="sm" icon="eye-off-outline" />
            </Card>
          ) : null}

          <View style={styles.toolbar}>
            <Button
              label={creating ? t('common.close') : t('ui.nouveauClientApi')}
              onPress={() => setCreating((value) => !value)}
              variant={creating ? 'ghost' : 'primary'}
              size="sm"
              icon={creating ? 'close' : 'add'}
            />
          </View>

          {creating ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
              <Card tone="white" style={styles.card}>
                <Input label={t('ui.nomDuClient')} value={name} onChangeText={setName} placeholder={t('ui.applicationTerrain')} icon="apps-outline" autoCapitalize="words" />
                <Input label={t('ui.eMailDeContact')} value={email} onChangeText={setEmail} placeholder="dev@organisation.org" icon="mail-outline" keyboardType="email-address" optionalLabel={t('common.optional')} />
                {error ? <ErrorState error={error} showRequestId /> : null}
                <Button label={t('ui.creerLeClient')} onPress={() => create.mutate()} variant="primary" fullWidth loading={create.isPending} disabled={name.trim().length < 2} />
              </Card>
            </Animated.View>
          ) : null}

          {clients.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : clients.isError ? (
            <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucunClientApi')}
              description={t('ui.creezUnClientPourObtenirDes')}
              icon="code-slash-outline"
              action={{ label: t('ui.nouveauClientApi'), onPress: () => setCreating(true) }}
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
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.creeLe_d6107', { createdAt: formatDate(client.createdAt, locale), value: client.contactEmail ? ` · ${client.contactEmail}` : '' })}{client.purposeApprovedAt ? t('ui.finaliteApprouveeLe', { purposeApprovedAt: formatDate(client.purposeApprovedAt, locale) }) : ''}
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
                          label={t('ui.finaliteDuTraitement')}
                          value={purpose}
                          onChangeText={setPurpose}
                          placeholder={t('ui.suiviDesParcellesPourNosAdherents')}
                          icon="document-text-outline"
                        />
                        <Button
                          label={t('ui.declarerLaFinalite')}
                          onPress={() => savePurpose.mutate()}
                          variant="primary"
                          size="sm"
                          loading={savePurpose.isPending}
                          disabled={purpose.trim().length < 10}
                        />
                      </View>
                    ) : (
                      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.finalite_8fdd7')}{' '}{client.dataPurpose ?? t('ui.nonDeclaree')}
                      </Text>
                    )}

                    {error ? <ErrorState error={error} showRequestId /> : null}

                    <View style={styles.actions}>
                      <Button label={t('ui.nouvelleCle')} onPress={() => createKey.mutate(client.id)} variant="outline" size="sm" icon="key-outline" loading={createKey.isPending} />
                      <Button
                        label={purposeFor === client.id ? t('common.cancel') : t('ui.declarerLaFinalite')}
                        onPress={() => setPurposeFor(purposeFor === client.id ? null : client.id)}
                        variant="ghost"
                        size="sm"
                        icon="document-text-outline"
                      />
                      <Button
                        label={usageFor === client.id ? t('ui.masquerLUsage') : t('ui.voirLUsage')}
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
                              <Text preset="caption" color={COLORS.textPrimary}>{t('ui.prefixe', { label: key.label, prefix: key.prefix })}</Text>
                              <Text preset="caption" color={COLORS.slateGray}>
                                {key.status}
                                {key.lastUsedAt ? t('ui.dernierUsage', { lastUsedAt: formatDate(key.lastUsedAt, locale) }) : t('ui.jamaisUtilisee')}
                                {key.expiresAt ? t('ui.expireLe_e1021', { expiresAt: formatDate(key.expiresAt, locale) }) : ''}
                              </Text>
                            </View>
                            {key.status === 'ACTIVE' ? (
                              <Button
                                label={t('ui.revoquer_9c67a')}
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
                            <Text preset="caption" color={COLORS.textPrimary}>{t('ui.appelSSurJours', { value: formatNumber(usage.data?.total ?? 0, locale), value2: formatNumber(usage.data?.window.days ?? 30, locale) })}</Text>
                            {(usage.data?.routes ?? []).length === 0 ? (
                              <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunAppelEnregistreSurLaPeriode')}</Text>
                            ) : (
                              (usage.data?.routes ?? []).map((route) => (
                                <View key={route.route} style={styles.routeRow}>
                                  <Text preset="caption" color={COLORS.textPrimary} style={styles.routeName}>
                                    {route.route}
                                  </Text>
                                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.appelS', { calls: formatNumber(route.calls, locale) })}{route.errors > 0 ? t('ui.erreurS', { errors: formatNumber(route.errors, locale) }) : ''}
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
