import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, CardTitle, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};
const asNombre = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

const ROLES = [
  '', 'FARMER', 'BUYER', 'SUPPLIER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER',
  'AGRICULTURAL_COMPANY', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR', 'MODERATOR',
];

const CANAUX: Record<string, string> = {
  IN_APP: 'dans l application',
  EMAIL: 'e-mail',
  SMS: 'SMS',
};

/** M7 U-M7-1 — annonces internes ciblées (rôle/pays) et historique d'envois. */
export default function AdminNotifications() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [role, setRole] = useState('');
  const [pays, setPays] = useState('');
  const [canaux, setCanaux] = useState<string[]>(['IN_APP']);
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');

  const historique = useQuery({
    queryKey: queryKeys.admin.notificationsHistory,
    queryFn: () => adminApi.notificationsHistory({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000,
  });

  const diffuser = useMutation({
    mutationFn: () =>
      adminApi.broadcastAnnouncement({
        title: titre.trim(),
        body: corps.trim(),
        ...(role ? { role } : {}),
        ...(pays.trim() ? { country: pays.trim().toUpperCase() } : {}),
        channels: canaux.length > 0 ? canaux : ['IN_APP'],
      }),
    onSuccess: (result) => {
      setErreur('');
      const sortie = asDict(result.data);
      setAvis(
        `Annonce diffusée : ${asNombre(sortie.targeted) ?? 0} destinataire(s) ciblé(s), ${asNombre(sortie.delivered) ?? 0} remise(s).`,
      );
      setTitre('');
      setCorps('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.notificationsHistory });
    },
    onError: (error) => {
      const dict = asDict(error);
      setErreur(typeof dict.message === 'string' && dict.message ? dict.message : 'Diffusion impossible');
    },
  });

  const etat = asDict(historique.data);
  const annonces = asArray(etat.annonces).map(asDict);
  const sms = asDict(etat.sms);
  const lots = asArray(sms.batches).map(asDict);
  const messages = asDict(sms.messages);
  const taux = asNombre(messages.deliveryRate);

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Notifications"
        description="Annonces internes ciblées (rôle et/ou pays) et historique d'envois (U-M7-1)."
        icon="📣"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Notifications internes
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Diffusez une annonce ciblée par rôle et/ou par pays (U-M7-1). Chaque envoi est audité
          (admin.notification.broadcast) ; les destinataires sont choisis parmi les adhésions actives.
          Le ciblage est obligatoire : une annonce sans cible est refusée.
        </Text>

        <Card style={{ marginBottom: 24 }}>
          <CardTitle>Nouvelle annonce</CardTitle>
          <CardBody>
            <div style={{ display: 'grid', gap: 12 }}>
              <Input
                label="Titre"
                placeholder="Ex. : Maintenance planifiée"
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
              />
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Message
                </Text>
                <textarea
                  value={corps}
                  onChange={(event) => setCorps(event.target.value)}
                  rows={4}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.lightBorder}`,
                    background: COLORS.surface,
                    color: COLORS.textPrimary,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </label>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Rôle ciblé
                  </Text>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${COLORS.lightBorder}`,
                      background: COLORS.surface,
                      color: COLORS.textPrimary,
                      fontSize: 14,
                    }}
                  >
                    {ROLES.map((valeur) => (
                      <option key={valeur || 'aucun'} value={valeur}>
                        {valeur || 'Aucun rôle'}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Pays ciblé (code ISO 2 lettres)"
                  placeholder="Ex. : CD"
                  value={pays}
                  onChange={(event) => setPays(event.target.value.toUpperCase())}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(CANAUX).map(([cle, libelle]) => (
                  <Chip
                    key={cle}
                    label={`${cle} (${libelle})`}
                    tone={canaux.includes(cle) ? 'forest' : 'neutral'}
                    onPress={() =>
                      setCanaux((actuels) =>
                        actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle],
                      )
                    }
                  />
                ))}
              </div>
              {avis ? (
                <Text preset="bodySm">{avis}</Text>
              ) : null}
              {erreur ? (
                <Text preset="bodySm">{erreur}</Text>
              ) : null}
              <Button
                label="Diffuser l annonce"
                size="sm"
                onClick={() => diffuser.mutate()}
                disabled={diffuser.isPending || titre.trim().length < 3 || corps.trim().length < 3 || canaux.length === 0}
              />
            </div>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>
          Historique des envois
        </Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {historique.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Chargement…
            </Text>
          ) : annonces.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucune annonce diffusée pour l'instant.
            </Text>
          ) : (
            annonces.map((annonce, index) => (
              <Card key={`${asText(annonce.at)}-${String(index)}`}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text preset="h3">{asText(annonce.title)}</Text>
                    <Chip label={`ciblés : ${asNombre(annonce.targeted) ?? 0}`} tone="neutral" />
                    <Chip label={`remis : ${asNombre(annonce.delivered) ?? 0}`} tone="success" />
                  </div>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {formatDate(annonce.at)} · rôle {asText(annonce.role)} · pays {asText(annonce.country)} ·
                    canaux {asArray(annonce.channels).map((c) => asText(c)).join(', ') || '—'}
                  </Text>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>
          Délivrance SMS
        </Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Chip label={`${asNombre(messages.total) ?? 0} message(s) observé(s)`} tone="neutral" />
              <Chip label={`${asNombre(messages.delivered) ?? 0} délivrés`} tone="success" />
              <Chip label={`${asNombre(messages.pending) ?? 0} en cours`} tone="info" />
              <Chip label={`${asNombre(messages.failed) ?? 0} échoués`} tone="error" />
              <Chip
                label={taux !== null ? `taux de délivrance ${(taux * 100).toFixed(1)} %` : 'taux non calculable'}
                tone={taux !== null ? 'forest' : 'neutral'}
              />
            </div>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
              Calculé depuis les états réels de `sms_messages` (échantillon plafonné à {asNombre(messages.sampleCappedAt) ?? 5000}) ;
              les lots `sms_batch_logs` ci-dessous détaillent chaque campagne.
            </Text>
            {lots.length === 0 ? (
              <Text preset="caption" color={COLORS.slateGray}>
                Aucun lot SMS enregistré.
              </Text>
            ) : (
              lots.map((lot) => (
                <Text key={asText(lot.batchId)} preset="caption" color={COLORS.slateGray}>
                  {asText(lot.batchId)} — candidats {asNombre(lot.candidates) ?? 0} · envoyés {asNombre(lot.sent) ?? 0} ·
                  ignorés {asNombre(lot.skipped) ?? 0} · échoués {asNombre(lot.failed) ?? 0} · mode {asText(lot.mode)}
                </Text>
              ))
            )}
          </CardBody>
        </Card>
      </AuthGate>
    </Section>
  );
}
