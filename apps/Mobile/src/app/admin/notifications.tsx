import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, FilterChip, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n, tr } from '@/i18n';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};
const asNombre = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const ROLES = ['', 'FARMER', 'BUYER', 'SUPPLIER', 'COOPERATIVE_ADMIN', 'TRANSPORTER', 'INVESTOR'];

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
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.notifications')} subtitle={t('ui.annoncesInternesCibleesRoleEtOu')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.notifications')} icon="megaphone-outline">
          {historique.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : historique.isError ? (
            <ErrorState error={historique.error} onRetry={() => void historique.refetch()} />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.diffusezUneAnnonceCibleeParRole')}</Text>

              <Text preset="h3">{t('ui.nouvelleAnnonce')}</Text>
              <Input
                label={t('ui.titre')}
                placeholder={t('ui.exMaintenancePlanifiee')}
                value={titre}
                onChangeText={setTitre}
                icon="text-outline"
              />
              <Input
                label={t('ui.message')}
                placeholder={t('ui.corpsDeLAnnonce')}
                value={corps}
                onChangeText={setCorps}
                icon="document-text-outline"
              />
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.roleCible')}</Text>
              <View style={styles.chips}>
                {ROLES.map((valeur) => (
                  <FilterChip
                    key={valeur || 'aucun'}
                    label={valeur || t('ui.aucunRole')}
                    active={role === valeur}
                    onPress={() => setRole(valeur)}
                  />
                ))}
              </View>
              <Input
                label={t('ui.paysCibleCodeIso2Lettres')}
                placeholder={t('ui.exCd')}
                value={pays}
                onChangeText={(texte) => setPays(texte.toUpperCase())}
                icon="globe-outline"
              />
              <View style={styles.chips}>
                {Object.entries(CANAUX).map(([cle, libelle]) => (
                  <FilterChip
                    key={cle}
                    label={`${cle} (${libelle})`}
                    active={canaux.includes(cle)}
                    onPress={() =>
                      setCanaux((actuels) =>
                        actuels.includes(cle) ? actuels.filter((c) => c !== cle) : [...actuels, cle],
                      )
                    }
                  />
                ))}
              </View>
              {avis ? (
                <Card tone="white">
                  <Text preset="caption">{avis}</Text>
                </Card>
              ) : null}
              {erreur ? (
                <Card tone="white">
                  <Text preset="caption" color={COLORS.slateGray}>{erreur}</Text>
                </Card>
              ) : null}
              <Button
                label={t('ui.diffuserLAnnonce')}
                size="sm"
                icon="megaphone-outline"
                onPress={() => diffuser.mutate()}
                disabled={diffuser.isPending || titre.trim().length < 3 || corps.trim().length < 3 || canaux.length === 0}
              />

              <Text preset="h3">{t('ui.historiqueDesEnvois')}</Text>
              {annonces.length === 0 ? (
                <EmptyState title={t('ui.aucuneAnnonce')} description={t('ui.aucuneAnnonceDiffuseePourLInstant_9973f')} icon="megaphone-outline" />
              ) : (
                annonces.map((annonce, index) => (
                  <Card key={`${asText(annonce.at)}-${String(index)}`} tone="white">
                    <View style={styles.rowHead}>
                      <Text preset="bodySm">{asText(annonce.title)}</Text>
                      <Chip label={t('ui.cibles', { value: asNombre(annonce.targeted) ?? 0 })} tone="neutral" size="sm" />
                      <Chip label={t('ui.deliveredCount', { count: asNombre(annonce.delivered) ?? 0 })} tone="success" size="sm" />
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.rolePaysCanaux_522d7', { value: formatDate(String(annonce.at ?? '')), role: asText(annonce.role), country: asText(annonce.country), value2: asArray(annonce.channels).map((c) => asText(c)).join(', ') || '—' })}</Text>
                  </Card>
                ))
              )}

              <Text preset="h3">{t('ui.delivranceSms')}</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={t('ui.messageSObserveS', { value: asNombre(messages.total) ?? 0 })} tone="neutral" size="sm" />
                  <Chip label={t('ui.delivres', { value: asNombre(messages.delivered) ?? 0 })} tone="success" size="sm" />
                  <Chip label={t('ui.enCours_37f85', { value: asNombre(messages.pending) ?? 0 })} tone="info" size="sm" />
                  <Chip label={t('ui.echoues', { value: asNombre(messages.failed) ?? 0 })} tone="error" size="sm" />
                  <Chip
                    label={taux !== null ? t('ui.tauxDeDelivrance', { value: (taux * 100).toFixed(1) }) : t('ui.tauxNonCalculable')}
                    tone={taux !== null ? 'forest' : 'neutral'}
                    size="sm"
                  />
                </View>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.calculeDepuisLesEtatsReelsDe_89917', { value: asNombre(messages.sampleCappedAt) ?? 5000 })}</Text>
                {lots.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunLotSmsEnregistre')}</Text>
                ) : (
                  lots.map((lot) => (
                    <Text key={asText(lot.batchId)} preset="caption" color={COLORS.slateGray}>{t('ui.candidatsEnvoyesIgnoresEchouesMode', { batchId: asText(lot.batchId), value: asNombre(lot.candidates) ?? 0, value2: asNombre(lot.sent) ?? 0, value3: asNombre(lot.skipped) ?? 0, value4: asNombre(lot.failed) ?? 0, mode: asText(lot.mode) })}</Text>
                  ))
                )}
              </Card>
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
});
