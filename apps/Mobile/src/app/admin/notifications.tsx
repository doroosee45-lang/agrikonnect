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
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Notifications" subtitle="Annonces internes ciblées (rôle et/ou pays) et historique d'envois (U-M7-1)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Notifications" icon="megaphone-outline">
          {historique.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : historique.isError ? (
            <ErrorState error={historique.error} onRetry={() => void historique.refetch()} />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>
                Diffusez une annonce ciblée par rôle et/ou par pays (U-M7-1). Chaque envoi est audité
                (admin.notification.broadcast) ; le ciblage est obligatoire.
              </Text>

              <Text preset="h3">Nouvelle annonce</Text>
              <Input
                label="Titre"
                placeholder="Ex. : Maintenance planifiée"
                value={titre}
                onChangeText={setTitre}
                icon="text-outline"
              />
              <Input
                label="Message"
                placeholder="Corps de l annonce"
                value={corps}
                onChangeText={setCorps}
                icon="document-text-outline"
              />
              <Text preset="caption" color={COLORS.slateGray}>Rôle ciblé</Text>
              <View style={styles.chips}>
                {ROLES.map((valeur) => (
                  <FilterChip
                    key={valeur || 'aucun'}
                    label={valeur || 'Aucun rôle'}
                    active={role === valeur}
                    onPress={() => setRole(valeur)}
                  />
                ))}
              </View>
              <Input
                label="Pays ciblé (code ISO 2 lettres)"
                placeholder="Ex. : CD"
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
                label="Diffuser l annonce"
                size="sm"
                icon="megaphone-outline"
                onPress={() => diffuser.mutate()}
                disabled={diffuser.isPending || titre.trim().length < 3 || corps.trim().length < 3 || canaux.length === 0}
              />

              <Text preset="h3">Historique des envois</Text>
              {annonces.length === 0 ? (
                <EmptyState title="Aucune annonce" description="Aucune annonce diffusée pour l instant." icon="megaphone-outline" />
              ) : (
                annonces.map((annonce, index) => (
                  <Card key={`${asText(annonce.at)}-${String(index)}`} tone="white">
                    <View style={styles.rowHead}>
                      <Text preset="bodySm">{asText(annonce.title)}</Text>
                      <Chip label={`ciblés : ${asNombre(annonce.targeted) ?? 0}`} tone="neutral" size="sm" />
                      <Chip label={`remis : ${asNombre(annonce.delivered) ?? 0}`} tone="success" size="sm" />
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {formatDate(String(annonce.at ?? ''))} · rôle {asText(annonce.role)} · pays {asText(annonce.country)} ·
                      canaux {asArray(annonce.channels).map((c) => asText(c)).join(', ') || '—'}
                    </Text>
                  </Card>
                ))
              )}

              <Text preset="h3">Délivrance SMS</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={`${asNombre(messages.total) ?? 0} message(s) observé(s)`} tone="neutral" size="sm" />
                  <Chip label={`${asNombre(messages.delivered) ?? 0} délivrés`} tone="success" size="sm" />
                  <Chip label={`${asNombre(messages.pending) ?? 0} en cours`} tone="info" size="sm" />
                  <Chip label={`${asNombre(messages.failed) ?? 0} échoués`} tone="error" size="sm" />
                  <Chip
                    label={taux !== null ? `taux de délivrance ${(taux * 100).toFixed(1)} %` : 'taux non calculable'}
                    tone={taux !== null ? 'forest' : 'neutral'}
                    size="sm"
                  />
                </View>
                <Text preset="caption" color={COLORS.slateGray}>
                  Calculé depuis les états réels de sms_messages (échantillon plafonné à {asNombre(messages.sampleCappedAt) ?? 5000}) ;
                  les lots sms_batch_logs ci-dessous détaillent chaque campagne.
                </Text>
                {lots.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>Aucun lot SMS enregistré.</Text>
                ) : (
                  lots.map((lot) => (
                    <Text key={asText(lot.batchId)} preset="caption" color={COLORS.slateGray}>
                      {asText(lot.batchId)} — candidats {asNombre(lot.candidates) ?? 0} · envoyés {asNombre(lot.sent) ?? 0} ·
                      ignorés {asNombre(lot.skipped) ?? 0} · échoués {asNombre(lot.failed) ?? 0} · mode {asText(lot.mode)}
                    </Text>
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
