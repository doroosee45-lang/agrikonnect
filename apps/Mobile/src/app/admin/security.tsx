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

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  const base = typeof dict.message === 'string' && dict.message ? dict.message : tr('ui.unexpectedError');
  const details = asDict(dict.details);
  return details.mfaRequired === true ? tr('ui.palier2SecondFacteurMfaRequis', { base }) : base;
};

const LIBELLES: Record<string, string> = {
  get 'security.mfaRequiredForGovernance'() { return tr('ui.mfaObligatoirePourLaGouvernance'); },
  get 'security.lockoutMinutes'() { return tr('ui.dureeDeVerrouillageMinutes'); },
  get 'security.sessionTtlHours'() { return tr('ui.dureeDesSessionsHeures'); },
  get 'security.passwordMinLength'() { return tr('ui.longueurMinimaleDesMotsDePasse'); },
  get 'security.passwordRequireSpecial'() { return tr('ui.caractereSpecialRequis'); },
};

/** M6 U-M6-2/U-M6-3 — vue sécurité (connexions, verrous, MFA, clés, sessions) et politique de sécurité (palier 2). */
export default function AdminSecurity() {
  const { t } = useI18n();
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
      setAvis(t('ui.compteDeverrouilleLActionEstTracee', { id }));
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
      setAvis(t('ui.politiqueDeSecuriteMiseAJour'));
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
      <AppHeader title={t('ui.securite_33e96')} subtitle={t('ui.connexionsVerrousMfaDeGouvernanceCles')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.securite_33e96')} icon="shield-checkmark-outline">
          {vue.isLoading ? (
            <LoadingState count={3} height={100} />
          ) : vue.isError ? (
            <ErrorState error={vue.error} onRetry={() => void vue.refetch()} />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.securityRulesNote')}</Text>
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

              <Text preset="h3">{t('ui.comptesVerrouilles')}</Text>
              <Card tone="white">
                <Input
                  label={t('ui.motif')}
                  placeholder={t('ui.motifDuDeverrouillageJournalise')}
                  value={motif}
                  onChangeText={setMotif}
                  icon="key-outline"
                />
                {verrouilles.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunCompteVerrouille')}</Text>
                ) : (
                  verrouilles.map((compte) => (
                    <View key={asText(compte.id)} style={styles.ligne}>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.verrouilleJusquAuEchecs_b9e5d', { email: asText(compte.email), value: formatDate(String(compte.lockedUntil ?? '')), value2: asNombre(compte.failedLoginAttempts) ?? 0 })}</Text>
                      <Button
                        label={t('ui.deverrouiller')}
                        variant="outline"
                        size="sm"
                        onPress={() => debloquer.mutate(asText(compte.id))}
                        disabled={debloquer.isPending}
                      />
                    </View>
                  ))
                )}
              </Card>

              <Text preset="h3">{t('ui.mfaDeGouvernance')}</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={t('ui.comptesDeGouvernance', { value: asNombre(gouvernance.total) ?? 0 })} tone="neutral" size="sm" />
                  {sansMfa.length > 0 ? (
                    <Chip label={t('ui.sansMfaRgS1', { length: sansMfa.length })} tone="error" size="sm" />
                  ) : (
                    <Chip label={t('ui.mfaActivePartout')} tone="success" size="sm" />
                  )}
                </View>
                <Text preset="caption" color={COLORS.slateGray}>{asText(gouvernance.note)}</Text>
                {sansMfa.map((g) => (
                  <Text key={asText(g.userId ?? g.email)} preset="caption" color={COLORS.slateGray}>{t('ui.roles_eacf9', { email: asText(g.email), value: asArray(g.roles).map((r) => asText(r)).join(', ') || '—' })}</Text>
                ))}
              </Card>

              <Text preset="h3">{t('ui.connexionsRecentes')}</Text>
              <Card tone="white">
                {asArray(connexions.recent).length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneConnexionEnregistree')}</Text>
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

              <Text preset="h3">{t('ui.echecsDeConnexion')}</Text>
              <Card tone="white">
                <Chip
                  label={t('ui.echecsSur24H', { value: asNombre(echecs.last24h) ?? 0 })}
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

              <Text preset="h3">{t('ui.clesApi')}</Text>
              <Card tone="white">
                <View style={styles.chips}>
                  <Chip label={t('ui.countUsableFemPlural', { count: actives.length })} tone="neutral" size="sm" />
                  {expirees.length > 0 ? <Chip label={t('ui.perimeesEncoreActives', { length: expirees.length })} tone="warning" size="sm" /> : null}
                </View>
                {asArray(cles.recent).map(asDict).map((cle) => (
                  <Text key={asText(cle.id)} preset="caption" color={COLORS.slateGray}>{t('ui.expDerniereUtilisation_b01e8', { label: asText(cle.label), prefix: asText(cle.prefix), status: asText(cle.status), value: formatDate(String(cle.expiresAt ?? '')), value2: formatDate(String(cle.lastUsedAt ?? '')) })}</Text>
                ))}
                <Text preset="caption" color={COLORS.slateGray}>{asText(cles.note)}</Text>
              </Card>

              <Text preset="h3">{t('ui.sessions')}</Text>
              <Card tone="white">
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.fenetreDEstimationHSessionsEstimees', { value: asNombre(sessions.ttlHours) ?? 0, length: sessionsActives.length, value2: asNombre(jetons.total) ?? 0 })}</Text>
                <Text preset="caption" color={COLORS.slateGray}>{asText(sessions.note)}</Text>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.laRevocationImmediateDesSessionsD_01b94')}</Text>
              </Card>

              <Text preset="h3">{t('ui.politiqueDeSecurite')}</Text>
              <Card tone="white">
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.palier2LaLectureEtLa')}</Text>
                {politique.isError ? (
                  <Text preset="caption">{messageErreur(politique.error)}</Text>
                ) : !politiqueVisible ? (
                  <Button label={t('ui.chargerLaPolitique')} variant="outline" size="sm" onPress={() => setPolitiqueVisible(true)} />
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
                            <FilterChip label={t('ui.vrai')} active={valeur === 'true'} onPress={() => setFormulaire({ ...formulaire, [cle]: 'true' })} />
                            <FilterChip label={t('ui.faux')} active={valeur === 'false'} onPress={() => setFormulaire({ ...formulaire, [cle]: 'false' })} />
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
                      label={t('ui.enregistrerLaPolitique')}
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
