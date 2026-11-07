import { useEffect, useState } from 'react';
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

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  const base = typeof dict.message === 'string' && dict.message ? dict.message : 'Erreur inattendue';
  const details = asDict(dict.details);
  return details.mfaRequired === true ? `${base} — palier 2 : second facteur (MFA) requis.` : base;
};

const LIBELLES: Record<string, string> = {
  'security.mfaRequiredForGovernance': 'MFA obligatoire pour la gouvernance',
  'security.lockoutMinutes': 'Durée de verrouillage (minutes)',
  'security.sessionTtlHours': 'Durée des sessions (heures)',
  'security.passwordMinLength': 'Longueur minimale des mots de passe',
  'security.passwordRequireSpecial': 'Caractère spécial requis',
};

/** M6 U-M6-2/U-M6-3 — vue sécurité (connexions, verrous, MFA, clés, sessions) et politique de sécurité (palier 2). */
export default function AdminSecurity() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState('');
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');
  const [politiqueVisible, setPolitiqueVisible] = useState(false);
  const [formulaire, setFormulaire] = useState<Record<string, string>>({});

  const vue = useQuery({
    queryKey: queryKeys.admin.securityOverview,
    queryFn: () => adminApi.securityOverview().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000,
  });

  const politique = useQuery({
    queryKey: queryKeys.admin.securityPolicy,
    queryFn: () => adminApi.securityPolicy().then((result) => result.data),
    enabled: isAuthenticated && politiqueVisible,
    retry: false,
  });

  useEffect(() => {
    const valeurs = asDict(asDict(politique.data).values);
    const initiale: Record<string, string> = {};
    for (const cle of Object.keys(LIBELLES)) {
      const valeur = valeurs[cle];
      if (valeur === null || valeur === undefined) continue;
      initiale[cle] = typeof valeur === 'boolean' ? (valeur ? 'true' : 'false') : String(valeur);
    }
    if (Object.keys(initiale).length > 0) setFormulaire(initiale);
  }, [politique.data]);

  const debloquer = useMutation({
    mutationFn: (id: string) => adminApi.unlockUser(id, { reason: motif.trim() || undefined }),
    onSuccess: (_result, id) => {
      setErreur('');
      setAvis(`Compte ${id} déverrouillé — l'action est tracée dans le journal d'audit.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.securityOverview });
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const enregistrerPolitique = useMutation({
    mutationFn: () => {
      const values: Record<string, unknown> = {};
      for (const [cle, texte] of Object.entries(formulaire)) {
        const meta = asDict(asDict(asDict(politique.data).settings)[cle]);
        values[cle] = meta.type === 'boolean' ? texte === 'true' : meta.type === 'number' ? Number(texte) : texte;
      }
      return adminApi.updateSecurityPolicy({
        values,
        reason: motif.trim() || undefined,
      });
    },
    onSuccess: () => {
      setErreur('');
      setAvis('Politique de sécurité mise à jour — la modification est journalisée.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.securityPolicy });
    },
    onError: (caught) => setErreur(messageErreur(caught)),
  });

  const etat = asDict(vue.data);
  const connexions = asDict(etat.connections);
  const echecs = asDict(etat.failures);
  const verrouilles = asArray(etat.lockedAccounts).map(asDict);
  const gouvernance = asDict(etat.governanceMfa);
  const sansMfa = asArray(gouvernance.withoutMfa).map(asDict);
  const cles = asDict(etat.apiKeys);
  const sessions = asDict(etat.sessions);
  const actives = asArray(cles.active).map(asDict);
  const expirees = asArray(cles.expiredStillActive).map(asDict);
  const sessionsActives = asArray(sessions.active).map(asDict);
  const jetons = asDict(sessions.pendingTokens);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Sécurité" subtitle="Connexions, verrous, MFA de gouvernance, clés API, sessions — politique de sécurité (palier 2)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Sécurité" icon="shield-checkmark-outline">
          {vue.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : vue.isError ? (
            <ErrorState error={vue.error} onRetry={() => void vue.refetch()} />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>
                RG-S1 : tout compte de gouvernance doit activer la MFA ; les mutations de gouvernance sont refusées sans
                second facteur (mfa_required). RG-S3 : aucun secret n'apparaît dans cette vue ni dans les journaux.
              </Text>
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

              <Text preset="h3">Comptes verrouillés</Text>
              <Card tone="white">
                <Input
                  label="Motif"
                  placeholder="Motif du déverrouillage (journalisé)"
                  value={motif}
                  onChangeText={setMotif}
                  icon="key-outline"
                />
                {verrouilles.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>Aucun compte verrouillé.</Text>
                ) : (
                  verrouilles.map((compte) => (
                    <View key={asText(compte.id)} style={styles.ligne}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {asText(compte.email)} — verrouillé jusqu'au {formatDate(String(compte.lockedUntil ?? ''))} ·
                        échecs : {asNombre(compte.failedLoginAttempts) ?? 0}
                      </Text>
                      <Button
                        label="Déverrouiller"
                        variant="outline"
                        size="sm"
                        onPress={() => debloquer.mutate(asText(compte.id))}
                        disabled={debloquer.isPending}
                      />
                    </View>
                  ))
                )}
              </Card>

              <Text preset="h3">MFA de gouvernance</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={`${asNombre(gouvernance.total) ?? 0} comptes de gouvernance`} tone="neutral" size="sm" />
                  {sansMfa.length > 0 ? (
                    <Chip label={`${sansMfa.length} sans MFA (RG-S1)`} tone="error" size="sm" />
                  ) : (
                    <Chip label="MFA active partout" tone="success" size="sm" />
                  )}
                </View>
                <Text preset="caption" color={COLORS.slateGray}>{asText(gouvernance.note)}</Text>
                {sansMfa.map((g) => (
                  <Text key={asText(g.userId ?? g.email)} preset="caption" color={COLORS.slateGray}>
                    {asText(g.email)} — rôles : {asArray(g.roles).map((r) => asText(r)).join(', ') || '—'}
                  </Text>
                ))}
              </Card>

              <Text preset="h3">Connexions récentes</Text>
              <Card tone="white">
                {asArray(connexions.recent).length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>Aucune connexion enregistrée.</Text>
                ) : (
                  asArray(connexions.recent).map(asDict).map((ligne, index) => (
                    <Text key={`${asText(ligne.at)}-${String(index)}`} preset="caption" color={COLORS.slateGray}>
                      {formatDate(String(ligne.at ?? ''))} — {asText(ligne.email) || asText(ligne.userId)} · IP{' '}
                      {asText(ligne.ip)}
                    </Text>
                  ))
                )}
                <Text preset="caption" color={COLORS.slateGray}>{asText(connexions.note)}</Text>
              </Card>

              <Text preset="h3">Échecs de connexion</Text>
              <Card tone="white">
                <Chip
                  label={`${asNombre(echecs.last24h) ?? 0} échecs sur 24 h`}
                  tone={(asNombre(echecs.last24h) ?? 0) > 0 ? 'warning' : 'neutral'}
                  size="sm"
                />
                {asArray(echecs.recent).map(asDict).map((ligne, index) => (
                  <Text key={`${asText(ligne.at)}-${String(index)}`} preset="caption" color={COLORS.slateGray}>
                    {formatDate(String(ligne.at ?? ''))} — {asText(ligne.action)} · {asText(ligne.email) || asText(ligne.userId)} ·
                    IP {asText(ligne.ip)}
                  </Text>
                ))}
                <Text preset="caption" color={COLORS.slateGray}>{asText(echecs.note)}</Text>
              </Card>

              <Text preset="h3">Clés API</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={`${actives.length} utilisables`} tone="neutral" size="sm" />
                  {expirees.length > 0 ? <Chip label={`${expirees.length} périmées encore actives`} tone="warning" size="sm" /> : null}
                </View>
                {asArray(cles.recent).map(asDict).map((cle) => (
                  <Text key={asText(cle.id)} preset="caption" color={COLORS.slateGray}>
                    {asText(cle.label)} ({asText(cle.prefix)}) — {asText(cle.status)} · exp.{' '}
                    {formatDate(String(cle.expiresAt ?? ''))} · dernière utilisation {formatDate(String(cle.lastUsedAt ?? ''))}
                  </Text>
                ))}
                <Text preset="caption" color={COLORS.slateGray}>{asText(cles.note)}</Text>
              </Card>

              <Text preset="h3">Sessions</Text>
              <Card tone="white">
                <Text preset="caption" color={COLORS.slateGray}>
                  Fenêtre d'estimation : {asNombre(sessions.ttlHours) ?? 0} h · sessions estimées actives :{' '}
                  {sessionsActives.length} · jetons en attente : {asNombre(jetons.total) ?? 0}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>{asText(sessions.note)}</Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  La révocation immédiate des sessions d'un compte se fait depuis sa fiche (« Révoquer les sessions ») —
                  chaque révocation est tracée dans le journal d'audit.
                </Text>
              </Card>

              <Text preset="h3">Politique de sécurité</Text>
              <Card tone="white">
                <Text preset="caption" color={COLORS.slateGray}>
                  Palier 2 : la lecture et la mise à jour de la politique exigent SUPER_ADMIN + second facteur (MFA).
                </Text>
                {politique.isError ? (
                  <Text preset="caption">{messageErreur(politique.error)}</Text>
                ) : !politiqueVisible ? (
                  <Button label="Charger la politique" variant="outline" size="sm" onPress={() => setPolitiqueVisible(true)} />
                ) : politique.isLoading ? (
                  <LoadingState count={2} height={70} />
                ) : (
                  <View style={styles.list}>
                    {Object.keys(LIBELLES).map((cle) => {
                      const meta = asDict(asDict(asDict(politique.data).settings)[cle]);
                      const valeur = formulaire[cle] ?? '';
                      return meta.type === 'boolean' ? (
                        <View key={cle}>
                          <Text preset="caption" color={COLORS.slateGray}>{LIBELLES[cle]}</Text>
                          <View style={styles.chips}>
                            <FilterChip label="Vrai" active={valeur === 'true'} onPress={() => setFormulaire({ ...formulaire, [cle]: 'true' })} />
                            <FilterChip label="Faux" active={valeur === 'false'} onPress={() => setFormulaire({ ...formulaire, [cle]: 'false' })} />
                          </View>
                        </View>
                      ) : (
                        <Input
                          key={cle}
                          label={LIBELLES[cle]}
                          value={valeur}
                          keyboardType={meta.type === 'number' ? 'numeric' : 'default'}
                          onChangeText={(texte) => setFormulaire({ ...formulaire, [cle]: texte })}
                          icon="options-outline"
                        />
                      );
                    })}
                    <Button
                      label="Enregistrer la politique"
                      size="sm"
                      onPress={() => enregistrerPolitique.mutate()}
                      disabled={enregistrerPolitique.isPending}
                    />
                  </View>
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
  ligne: { gap: SPACING.sm, marginTop: SPACING.sm },
});
