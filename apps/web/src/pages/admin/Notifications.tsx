import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, CardTitle, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { useI18n, tr } from '@/i18n';
import { bcpLocale } from '@/lib/format';

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
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(bcpLocale());
};

const ROLES = [
  '', 'FARMER', 'BUYER', 'SUPPLIER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER',
  'AGRICULTURAL_COMPANY', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR', 'MODERATOR',
];

const CANAUX: Record<string, string> = {
  get IN_APP() { return tr('ui.dansLApplication'); },
  EMAIL: 'e-mail',
  SMS: 'SMS',
};

/** M7 U-M7-1 — annonces internes ciblées (rôle/pays) et historique d'envois. */
export default function AdminNotifications() {
  const { t } = useI18n();
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
        t('ui.annonceDiffuseeDestinataireSCibleS', { value: asNombre(sortie.targeted) ?? 0, value2: asNombre(sortie.delivered) ?? 0 }),
      );
      setTitre('');
      setCorps('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.notificationsHistory });
    },
    onError: (error) => {
      const dict = asDict(error);
      setErreur(typeof dict.message === 'string' && dict.message ? dict.message : t('ui.diffusionImpossible'));
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
        title={t('ui.notifications')}
        description={t('ui.annoncesInternesCibleesRoleEtOu')}
        icon="📣"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.notificationsInternes')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.broadcastIntro')}</Text>

        <Card style={{ marginBottom: 24 }}>
          <CardTitle>{t('ui.nouvelleAnnonce')}</CardTitle>
          <CardBody>
            <div style={{ display: 'grid', gap: 12 }}>
              <Input
                label={t('ui.titre')}
                placeholder={t('ui.exMaintenancePlanifiee')}
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
              />
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.message')}</Text>
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
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.roleCible')}</Text>
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
                        {valeur || t('ui.aucunRole')}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label={t('ui.paysCibleCodeIso2Lettres')}
                  placeholder={t('ui.exCd')}
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
                label={t('ui.diffuserLAnnonce')}
                size="sm"
                onClick={() => diffuser.mutate()}
                disabled={diffuser.isPending || titre.trim().length < 3 || corps.trim().length < 3 || canaux.length === 0}
              />
            </div>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.historiqueDesEnvois')}</Text>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {historique.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('common.loading')}</Text>
          ) : annonces.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucuneAnnonceDiffuseePourLInstant')}</Text>
          ) : (
            annonces.map((annonce, index) => (
              <Card key={`${asText(annonce.at)}-${String(index)}`}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text preset="h3">{asText(annonce.title)}</Text>
                    <Chip label={t('ui.cibles', { value: asNombre(annonce.targeted) ?? 0 })} tone="neutral" />
                    <Chip label={t('ui.deliveredCount', { count: asNombre(annonce.delivered) ?? 0 })} tone="success" />
                  </div>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.rolePaysCanaux', { at: formatDate(annonce.at), role: asText(annonce.role), country: asText(annonce.country), value: asArray(annonce.channels).map((c) => asText(c)).join(', ') || '—' })}</Text>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.delivranceSms')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Chip label={t('ui.messageSObserveS', { value: asNombre(messages.total) ?? 0 })} tone="neutral" />
              <Chip label={t('ui.delivres', { value: asNombre(messages.delivered) ?? 0 })} tone="success" />
              <Chip label={t('ui.enCours_37f85', { value: asNombre(messages.pending) ?? 0 })} tone="info" />
              <Chip label={t('ui.echoues', { value: asNombre(messages.failed) ?? 0 })} tone="error" />
              <Chip
                label={taux !== null ? t('ui.tauxDeDelivrance', { value: (taux * 100).toFixed(1) }) : t('ui.tauxNonCalculable')}
                tone={taux !== null ? 'forest' : 'neutral'}
              />
            </div>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.calculeDepuisLesEtatsReelsDe', { value: asNombre(messages.sampleCappedAt) ?? 5000 })}</Text>
            {lots.length === 0 ? (
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunLotSmsEnregistre')}</Text>
            ) : (
              lots.map((lot) => (
                <Text key={asText(lot.batchId)} preset="caption" color={COLORS.slateGray}>{t('ui.candidatsEnvoyesIgnoresEchouesMode', { batchId: asText(lot.batchId), value: asNombre(lot.candidates) ?? 0, value2: asNombre(lot.sent) ?? 0, value3: asNombre(lot.skipped) ?? 0, value4: asNombre(lot.failed) ?? 0, mode: asText(lot.mode) })}</Text>
              ))
            )}
          </CardBody>
        </Card>
      </AuthGate>
    </Section>
  );
}
