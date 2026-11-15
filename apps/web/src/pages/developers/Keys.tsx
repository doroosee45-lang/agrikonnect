import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { apiClientApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Developers() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [purposeFor, setPurposeFor] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ clientId: string; value: string } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const clients = useQuery({
    queryKey: queryKeys.apiClients.all,
    queryFn: () => apiClientApi.clients().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const createClient = useMutation({
    mutationFn: () => apiClientApi.create({ name: name.trim(), contactEmail: contactEmail.trim() || undefined }),
    onSuccess: (result) => {
      setError(null);
      setName('');
      setContactEmail('');
      if (result.data.secret) setSecret({ clientId: result.data.id, value: result.data.secret });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const setClientPurpose = useMutation({
    mutationFn: ({ id, dataPurpose }: { id: string; dataPurpose: string }) => apiClientApi.setPurpose(id, { dataPurpose }),
    onSuccess: () => {
      setError(null);
      setPurpose('');
      setPurposeFor(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const createKey = useMutation({
    mutationFn: (id: string) => apiClientApi.createKey(id, { label: t('ui.cle') }),
    onSuccess: (result) => {
      setError(null);
      setSecret({ clientId: result.data.key.clientId, value: result.data.secret });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all });
    },
    onError: (caught) => setError(caught),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => apiClientApi.revokeKey(keyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.apiClients.all }),
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.espaceDeveloppeurs')}
        description={t('ui.connectezVousPourGererVosClients')}
        icon="🔑"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.apiPublique')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.chaqueClePorteUneFinaliteDe')}</Text>
        </div>

        <Card tone="white" style={{ marginBottom: 24 }}>
          <Text preset="h3" style={{ marginBottom: 16 }}>{t('ui.nouveauClientApi')}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Input label={t('ui.nom')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ui.monIntegration')} required />
            <Input label={t('ui.emailDeContact')} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} optionalLabel={t('ui.optionnel')} />
          </div>
          {error ? (
            <div style={{ marginTop: 16 }}>
              <ErrorState error={error} showRequestId />
            </div>
          ) : null}
          <Button label={t('ui.creerLeClient')} onClick={() => createClient.mutate()} loading={createClient.isPending} disabled={!name.trim()} style={{ marginTop: 16 }} />
        </Card>

        {secret ? (
          <Card tone="gold" style={{ marginBottom: 24 }}>
            <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.secretAUsageUnique')}</Text>
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7, marginBottom: 12 }}>{t('ui.copiezCeSecretMaintenantIlNe')}</Text>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                padding: '12px 14px',
                backgroundColor: 'rgba(36, 53, 43, 0.08)',
                borderRadius: 'var(--radius-md)',
                wordBreak: 'break-all',
              }}
            >
              {secret.value}
            </div>
            <Button label={t('ui.jAiCopieCeSecret')} onClick={() => setSecret(null)} variant="ghost" size="sm" style={{ marginTop: 12 }} />
          </Card>
        ) : null}

        <Text preset="h3" style={{ marginBottom: 16 }}>{t('ui.mesClients')}</Text>
        {clients.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : clients.isError ? (
          <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        ) : (clients.data ?? []).length === 0 ? (
          <EmptyState title={t('ui.aucunClient')} description={t('ui.creezUnClientApiPourObtenir')} icon="🔑" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(clients.data ?? []).map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                    <div>
                      <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                        {client.name}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {client.contactEmail ?? t('ui.contactNonRenseigne')}{' '}{t('ui.creeLe_65163', { createdAt: formatDate(client.createdAt, locale) })}</Text>
                    </div>
                    <Chip label={client.status} tone={client.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" />
                  </div>

                  <ChipRow style={{ marginBottom: 12 }}>
                    {client.scopes.map((scope) => (
                      <Chip key={scope} label={scope} tone="neutral" size="sm" />
                    ))}
                  </ChipRow>

                  <div style={{ marginBottom: 12 }}>
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>{t('ui.finaliteDeTraitement')}</Text>
                    {client.dataPurpose ? (
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {client.dataPurpose}
                        {client.purposeApprovedAt ? t('ui.approuveeLe', { purposeApprovedAt: formatDate(client.purposeApprovedAt, locale) }) : t('ui.enAttenteDApprobation')}
                      </Text>
                    ) : (
                      <Text preset="caption" color={COLORS.warning}>{t('ui.nonDeclareeRequiredAvantToutUsage')}</Text>
                    )}
                  </div>

                  {purposeFor === client.id ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <Input label={t('ui.finalite')} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('ui.exTableauDeBordInterneDes')} />
                      </div>
                      <Button label={t('ui.declarer')} onClick={() => setClientPurpose.mutate({ id: client.id, dataPurpose: purpose.trim() })} loading={setClientPurpose.isPending} disabled={!purpose.trim()} />
                      <Button label={t('common.cancel')} onClick={() => setPurposeFor(null)} variant="ghost" />
                    </div>
                  ) : (
                    <Button label={client.dataPurpose ? t('ui.modifierLaFinalite') : t('ui.declarerLaFinalite')} onClick={() => setPurposeFor(client.id)} variant="outline" size="sm" style={{ marginBottom: 12 }} />
                  )}

                  <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>{t('ui.cles')}</Text>
                  {(client.keys ?? []).length === 0 ? (
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneCleCreezEnUnePour')}</Text>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(client.keys ?? []).map((key) => (
                        <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <Text preset="bodySm" color={COLORS.textPrimary}>
                              {key.label}
                            </Text>
                            <Text preset="caption" color={COLORS.slateGray}>{t('ui.creeeLe_99161', { prefix: key.prefix, createdAt: formatDate(key.createdAt, locale) })}{key.expiresAt ? t('ui.expireLe_e1021', { expiresAt: formatDate(key.expiresAt, locale) }) : ''}
                              {key.lastUsedAt ? t('ui.dernierUsage', { lastUsedAt: formatDate(key.lastUsedAt, locale) }) : t('ui.jamaisUtilisee')}
                            </Text>
                          </div>
                          <Button label={t('ui.revoquer_9c67a')} onClick={() => revokeKey.mutate(key.id)} variant="danger" size="sm" loading={revokeKey.isPending && revokeKey.variables === key.id} />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button label={t('ui.creerUneCle')} onClick={() => createKey.mutate(client.id)} variant="outline" size="sm" style={{ marginTop: 12 }} loading={createKey.isPending && createKey.variables === client.id} />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Card tone="pale" style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.lesClesSontLimiteesEnDebit')}</Text>
        </Card>
      </AuthGate>
    </Section>
  );
}
