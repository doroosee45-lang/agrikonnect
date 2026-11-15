import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, Chip, Input, Section, Text } from '@/components/ui';
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
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.securite_33e96')}
        description={t('ui.connexionsVerrousMfaDeGouvernanceCles')}
        icon="🔐"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <Text preset="h1">{t('ui.securite_33e96')}</Text>
          <Button label={t('ui.actualiser')} variant="outline" size="sm" icon="⟳" onClick={() => void vue.refetch()} />
        </div>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.connexionsVerrousEtatMfaDeLa')}</Text>
        <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.securityRulesNote')}</Text>

        {avis ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{avis}</Text>
            </CardBody>
          </Card>
        ) : null}
        {erreur ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{erreur}</Text>
            </CardBody>
          </Card>
        ) : null}

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.comptesVerrouilles')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <Input
              label={t('ui.motif')}
              placeholder={t('ui.motifDuDeverrouillageJournalise')}
              value={motif}
              onChange={(event) => setMotif(event.target.value)}
            />
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {verrouilles.length === 0 ? (
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.aucunCompteVerrouille')}</Text>
              ) : (
                verrouilles.map((compte) => (
                  <div key={asText(compte.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text preset="bodySm">{t('ui.verrouilleJusquAuEchecs', { email: asText(compte.email), lockedUntil: formatDate(compte.lockedUntil), value: asNombre(compte.failedLoginAttempts) ?? 0 })}</Text>
                    <Button
                      label={t('ui.deverrouiller')}
                      variant="outline"
                      size="sm"
                      onClick={() => debloquer.mutate(asText(compte.id))}
                      disabled={debloquer.isPending}
                    />
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.mfaDeGouvernance')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip label={t('ui.comptesDeGouvernance', { value: asNombre(gouvernance.total) ?? 0 })} tone="neutral" />
              {sansMfa.length > 0 ? (
                <Chip label={t('ui.sansMfaRgS1', { length: sansMfa.length })} tone="error" />
              ) : (
                <Chip label={t('ui.mfaActivePartout')} tone="success" />
              )}
            </div>
            <Text preset="caption" color={COLORS.slateGray}>
              {asText(gouvernance.note)}
            </Text>
            {sansMfa.length > 0 ? (
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {sansMfa.map((g) => (
                  <Text key={asText(g.userId ?? g.email)} preset="bodySm">{t('ui.roles_eacf9', { email: asText(g.email), value: asArray(g.roles).map((r) => asText(r)).join(', ') || '—' })}</Text>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.connexionsRecentes')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'grid', gap: 6 }}>
              {asArray(connexions.recent).map(asDict).map((ligne, index) => (
                <Text key={`${asText(ligne.at)}-${String(index)}`} preset="caption" color={COLORS.slateGray}>
                  {formatDate(ligne.at)} — {asText(ligne.email) || asText(ligne.userId)} · IP {asText(ligne.ip)}
                </Text>
              ))}
              {asArray(connexions.recent).length === 0 ? (
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.aucuneConnexionEnregistree')}</Text>
              ) : null}
            </div>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
              {asText(connexions.note)}
            </Text>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.echecsDeConnexion')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <Chip label={t('ui.echecsSur24H', { value: asNombre(echecs.last24h) ?? 0 })} tone={(asNombre(echecs.last24h) ?? 0) > 0 ? 'warning' : 'neutral'} />
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {asArray(echecs.recent).map(asDict).map((ligne, index) => (
                <Text key={`${asText(ligne.at)}-${String(index)}`} preset="caption" color={COLORS.slateGray}>
                  {formatDate(ligne.at)} — {asText(ligne.action)} · {asText(ligne.email) || asText(ligne.userId)} · IP{' '}
                  {asText(ligne.ip)}
                </Text>
              ))}
            </div>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
              {asText(echecs.note)}
            </Text>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.clesApi')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip label={t('ui.countUsableFemPlural', { count: actives.length })} tone="neutral" />
              {expirees.length > 0 ? <Chip label={t('ui.perimeesEncoreActives', { length: expirees.length })} tone="warning" /> : null}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {asArray(cles.recent).map(asDict).map((cle) => (
                <Text key={asText(cle.id)} preset="caption" color={COLORS.slateGray}>{t('ui.expDerniereUtilisation', { label: asText(cle.label), prefix: asText(cle.prefix), status: asText(cle.status), expiresAt: formatDate(cle.expiresAt), lastUsedAt: formatDate(cle.lastUsedAt) })}</Text>
              ))}
            </div>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
              {asText(cles.note)}
            </Text>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.sessions')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <Text preset="bodySm">{t('ui.fenetreDEstimationHSessionsEstimees', { value: asNombre(sessions.ttlHours) ?? 0, length: sessionsActives.length, value2: asNombre(jetons.total) ?? 0 })}</Text>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
              {asText(sessions.note)}
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>{t('ui.laRevocationImmediateDesSessionsD')}</Text>
          </CardBody>
        </Card>

        <Text preset="h2" style={{ marginBottom: 12 }}>{t('ui.politiqueDeSecurite')}</Text>
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 12 }}>{t('ui.palier2LaLectureEtLa')}</Text>
            {politique.isError ? (
              <Text preset="bodySm">{messageErreur(politique.error)}</Text>
            ) : !politiqueVisible ? (
              <Button label={t('ui.chargerLaPolitique')} variant="outline" size="sm" onClick={() => setPolitiqueVisible(true)} />
            ) : politique.isLoading ? (
              <Text preset="bodySm" color={COLORS.slateGray}>{t('common.loading')}</Text>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {Object.keys(LIBELLES).map((cle) => {
                  const meta = asDict(asDict(asDict(politique.data).settings)[cle]);
                  const valeur = formulaire[cle] ?? '';
                  return meta.type === 'boolean' ? (
                    <label key={cle} style={{ display: 'grid', gap: 6 }}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {LIBELLES[cle]}
                      </Text>
                      <select
                        value={valeur}
                        onChange={(event) => setFormulaire({ ...formulaire, [cle]: event.target.value })}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: `1px solid ${COLORS.lightBorder}`,
                          background: COLORS.surface,
                          color: COLORS.textPrimary,
                          fontSize: 14,
                        }}
                      >
                        <option value="true">{t('ui.vrai')}</option>
                        <option value="false">{t('ui.faux')}</option>
                      </select>
                    </label>
                  ) : (
                    <Input
                      key={cle}
                      label={LIBELLES[cle]}
                      type={meta.type === 'number' ? 'number' : 'text'}
                      value={valeur}
                      onChange={(event) => setFormulaire({ ...formulaire, [cle]: event.target.value })}
                    />
                  );
                })}
                <Button
                  label={t('ui.enregistrerLaPolitique')}
                  size="sm"
                  onClick={() => enregistrerPolitique.mutate()}
                  disabled={enregistrerPolitique.isPending}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </AuthGate>
    </Section>
  );
}
