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
    mutationFn: (id: string) => apiClientApi.createKey(id, { label: 'clé' }),
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
        title="Espace développeurs"
        description="Connectez-vous pour gérer vos clients API, leurs finalités et leurs clés."
        icon="🔑"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            API publique
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Chaque clé porte une finalité de traitement déclarée puis approuvée. Les secrets ne sont affichés qu'une fois.
          </Text>
        </div>

        <Card tone="white" style={{ marginBottom: 24 }}>
          <Text preset="h3" style={{ marginBottom: 16 }}>
            Nouveau client API
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon intégration" required />
            <Input label="Email de contact" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} optionalLabel="optionnel" />
          </div>
          {error ? (
            <div style={{ marginTop: 16 }}>
              <ErrorState error={error} showRequestId />
            </div>
          ) : null}
          <Button label="Créer le client" onClick={() => createClient.mutate()} loading={createClient.isPending} disabled={!name.trim()} style={{ marginTop: 16 }} />
        </Card>

        {secret ? (
          <Card tone="gold" style={{ marginBottom: 24 }}>
            <Text preset="h3" style={{ marginBottom: 8 }}>
              Secret à usage unique
            </Text>
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7, marginBottom: 12 }}>
              Copiez ce secret maintenant : il ne sera plus jamais affiché. Une rotation génère un nouveau secret
              et révoque l'ancien.
            </Text>
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
            <Button label="J'ai copié ce secret" onClick={() => setSecret(null)} variant="ghost" size="sm" style={{ marginTop: 12 }} />
          </Card>
        ) : null}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Mes clients
        </Text>
        {clients.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : clients.isError ? (
          <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        ) : (clients.data ?? []).length === 0 ? (
          <EmptyState title="Aucun client" description="Créez un client API pour obtenir une clé." icon="🔑" />
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
                        {client.contactEmail ?? 'contact non renseigné'} · créé le {formatDate(client.createdAt, locale)}
                      </Text>
                    </div>
                    <Chip label={client.status} tone={client.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" />
                  </div>

                  <ChipRow style={{ marginBottom: 12 }}>
                    {client.scopes.map((scope) => (
                      <Chip key={scope} label={scope} tone="neutral" size="sm" />
                    ))}
                  </ChipRow>

                  <div style={{ marginBottom: 12 }}>
                    <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                      Finalité de traitement
                    </Text>
                    {client.dataPurpose ? (
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {client.dataPurpose}
                        {client.purposeApprovedAt ? ` · approuvée le ${formatDate(client.purposeApprovedAt, locale)}` : ' · en attente d’approbation'}
                      </Text>
                    ) : (
                      <Text preset="caption" color={COLORS.warning}>
                        Non déclarée — required avant tout usage en production.
                      </Text>
                    )}
                  </div>

                  {purposeFor === client.id ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <Input label="Finalité" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex. : tableau de bord interne des prix" />
                      </div>
                      <Button label="Déclarer" onClick={() => setClientPurpose.mutate({ id: client.id, dataPurpose: purpose.trim() })} loading={setClientPurpose.isPending} disabled={!purpose.trim()} />
                      <Button label="Annuler" onClick={() => setPurposeFor(null)} variant="ghost" />
                    </div>
                  ) : (
                    <Button label={client.dataPurpose ? 'Modifier la finalité' : 'Déclarer la finalité'} onClick={() => setPurposeFor(client.id)} variant="outline" size="sm" style={{ marginBottom: 12 }} />
                  )}

                  <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>
                    Clés
                  </Text>
                  {(client.keys ?? []).length === 0 ? (
                    <Text preset="caption" color={COLORS.slateGray}>
                      Aucune clé. Créez-en une pour appeler l'API.
                    </Text>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(client.keys ?? []).map((key) => (
                        <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <Text preset="bodySm" color={COLORS.textPrimary}>
                              {key.label}
                            </Text>
                            <Text preset="caption" color={COLORS.slateGray}>
                              {key.prefix}… · créée le {formatDate(key.createdAt, locale)}
                              {key.expiresAt ? ` · expire le ${formatDate(key.expiresAt, locale)}` : ''}
                              {key.lastUsedAt ? ` · dernier usage ${formatDate(key.lastUsedAt, locale)}` : ' · jamais utilisée'}
                            </Text>
                          </div>
                          <Button label="Révoquer" onClick={() => revokeKey.mutate(key.id)} variant="danger" size="sm" loading={revokeKey.isPending && revokeKey.variables === key.id} />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button label="Créer une clé" onClick={() => createKey.mutate(client.id)} variant="outline" size="sm" style={{ marginTop: 12 }} loading={createKey.isPending && createKey.variables === client.id} />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Card tone="pale" style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            Les clés sont limitées en débit et en périmètre. Toute finalité non approuvée bloque l'accès aux jeux
            de données sensibles. Les usages par route sont journalisés.
          </Text>
        </Card>
      </AuthGate>
    </Section>
  );
}
