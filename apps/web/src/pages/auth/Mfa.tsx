import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { COLORS, DURATION, EASE } from '@/theme';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';

type Setup = Awaited<ReturnType<typeof authApi.mfaSetup>>['data'];

/**
 * AUTH — double authentification (NFR-01).
 *
 * Le web n'avait **aucun** écran MFA : les routes `setup`, `confirm`, `verify`
 * et `disable` n'étaient appelées nulle part côté web, et `POST /auth/mfa/verify`
 * ne l'était sur aucun client. Sans écran, le point de contrôle NFR-01 — celui
 * qui re-demande un code avant une opération sensible — n'était pas reachable.
 *
 * ## Aucun secret affiché ni journalisé
 *
 * Le secret TOTP n'est **jamais rendu**. L'ajout du compte à une application
 * d'authentification passe par le **QR code généré côté serveur**
 * (`qrDataUri`). Le secret reste utilisable en saisie manuelle de secours via
 * un bouton qui le copie dans le presse-papiers, sans l'afficher.
 *
 * Rien n'est écrit dans la console non plus : aucun `console.*` ne porte le
 * secret, l'`otpauthUrl` ni le code saisi.
 */
export default function AuthMfa() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [copie, setCopie] = useState(false);
  /*
   * Codes de secours renvoyés par `confirm`, **et rien d'autre**.
   *
   * Le serveur n'en garde que les empreintes : une fois cette valeur quittée,
   * aucune requête ne peut les restituer. L'écran précédent les jetait
   * simplement (`onSuccess: () => { setSetup(null); }`) — un utilisateur qui
   * perdait son téléphone était définitivement dehors. D'où ce bloc dédié,
   * l'acquittement explicite, et le fait qu'il n'y ait **aucun** bouton de
   * ré-affichage : `setSecours(null)` est la seule sortie.
   */
  const [secours, setSecours] = useState<{ codes: string[]; warning: string } | null>(null);

  const statut = useQuery({
    queryKey: ['auth', 'mfa', 'status'],
    queryFn: () => authApi.mfaStatus().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const demarrer = useMutation({
    mutationFn: () => authApi.mfaSetup().then((result) => result.data),
    onSuccess: (donnees) => {
      setSetup(donnees);
      setCode('');
    },
  });

  const invalider = () => void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa', 'status'] });

  const confirmer = useMutation({
    // `.then((result) => result.data)` comme `demarrer` : sans ce déballage,
    // `onSuccess` reçoit l'enveloppe `RequestResult` et non la charge utile.
    mutationFn: () => authApi.mfaConfirm(code.trim()).then((result) => result.data),
    onSuccess: (donnees) => {
      setSetup(null);
      setCode('');
      // Les codes ne transitent que par cette réponse : on les garde en mémoire
      // le temps de l'affichage unique, jamais dans le stockage local.
      setSecours({ codes: donnees.backupCodes ?? [], warning: donnees.warning });
      invalider();
    },
  });

  const verifier = useMutation({
    mutationFn: () => authApi.mfaVerify(code.trim()),
    onSuccess: () => setCode(''),
  });

  const desactiver = useMutation({
    mutationFn: () => authApi.mfaDisable(code.trim()),
    onSuccess: () => {
      setCode('');
      invalider();
    },
  });

  const active = statut.data?.enabled === true;
  const codePret = code.trim().length >= 6;

  /**
   * Copie de secours du secret, **sans l'afficher**.
   *
   * Certains gestionnaires de mots de passe n'ont pas de lecteur de QR. Copier
   * dans le presse-papiers répond au besoin sans mettre le secret à l'écran, où
   * il serait lisible par-dessus l'épaule et capturable.
   */
  /**
   * Copie des codes de secours.
   *
   * Un seul `console.*` n'est ajouté : copier dans le presse-papiers ne doit
   * **pas** passer par la console, où les codes resteraient dans l'historique
   * du navigateur et dans les outils de développement.
   */
  const copierSecours = async () => {
    if (!secours) return;
    try {
      await navigator.clipboard.writeText(secours.codes.join('\n'));
      setCopie(true);
      window.setTimeout(() => setCopie(false), 4000);
    } catch {
      setCopie(false);
    }
  };

  const copierSecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 4000);
    } catch {
      setCopie(false);
    }
  };

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.doubleAuthentification')}
      description={t('ui.connectezVousPourGererVotreDouble')}
      icon="🔐"
    >
      <Section>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 520, margin: '0 auto' }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.doubleAuthentification')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.unCodeA6ChiffresGenere')}</Text>

          <Card tone="white" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Codes de secours : affichage unique ──────────── */}
            {secours ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  padding: 20,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.gold}`,
                  backgroundColor: COLORS.goldSurface,
                }}
              >
                <Text preset="h3" style={{ color: COLORS.onGoldSurface }}>{t('ui.codesDeSecours')}</Text>
                {/*
                  L'avertissement **vient de l'API** (`warning`), il n'est pas
                  recopié ici : si le backend change la formulation, l'écran
                  suit au lieu d'afficher un texte périmé.
                */}
                <Text preset="bodySm" style={{ color: COLORS.onGoldSurface }}>
                  {secours.warning}
                </Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 8,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: COLORS.pureWhite,
                    border: `1px solid ${COLORS.lightBorder}`,
                  }}
                >
                  {secours.codes.map((codeSecours) => (
                    /*
                     * Pas d'index dans la clé : les codes sont uniques et
                     * stables pendant tout l'affichage.
                     */
                    <code
                      key={codeSecours}
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 14,
                        letterSpacing: 1,
                        color: COLORS.onGoldSurface,
                      }}
                    >
                      {codeSecours}
                    </code>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button
                    label={copie ? t('ui.copies') : t('ui.copierLesCodes')}
                    variant="outline"
                    onClick={() => void copierSecours()}
                  />
                  <Button
                    label={t('ui.jAiConserveMesCodes')}
                    onClick={() => setSecours(null)}
                  />
                </div>
                <Text preset="caption" style={{ color: COLORS.onGoldSurface }}>{t('ui.uneFoisFermesIlsNeSeront')}</Text>
              </div>
            ) : null}

            {/* ── État ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Chip
                label={statut.isLoading ? t('ui.verification') : active ? t('ui.activee') : t('ui.desactivee')}
                tone={statut.isLoading ? 'neutral' : active ? 'success' : 'warning'}
              />
              {active ? (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.methode', { value: statut.data?.method ?? 'TOTP' })}</Text>
              ) : null}
            </div>

            {/* ── Activation ───────────────────────────────────── */}
            {!active && !setup ? (
              <>
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.vousScannerezUnQrCodeAvec')}</Text>
                {demarrer.isError ? <ErrorState error={demarrer.error} showRequestId /> : null}
                <Button
                  label={t('ui.commencerLActivation')}
                  loading={demarrer.isPending}
                  onClick={() => demarrer.mutate()}
                  fullWidth
                />
              </>
            ) : null}

            {/* ── QR code : le secret n'est jamais affiché ─────── */}
            {setup ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Text preset="h3">{t('ui.n1ScannezCeQrCode')}</Text>
                {/*
                  `referrerPolicy="no-referrer"` : l'image est une data URI, mais
                  la précaution vaut si elle est un jour servie par URL.
                  Texte alternatif descriptif : H5, l'image porte une information.
                */}
                <img
                  src={setup.qrDataUri}
                  alt={t('ui.qrCodeAScannerAvecVotre')}
                  width={240}
                  height={240}
                  referrerPolicy="no-referrer"
                  style={{ borderRadius: 12, border: `1px solid ${COLORS.lightBorder}`, backgroundColor: COLORS.pureWhite }}
                />
                <Text preset="caption" color={COLORS.slateGray} style={{ textAlign: 'center' }}>{t('ui.n2SaisissezCiDessousLeCode', { digits: setup.digits })}</Text>
                <button
                  type="button"
                  onClick={() => void copierSecret()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.forestGreen,
                    fontSize: 13,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 4,
                    minHeight: 44,
                  }}
                >
                  {copie ? t('ui.secretCopieDansLePressePapiers') : t('ui.saisieManuelleCopierLeSecret')}
                </button>
              </div>
            ) : null}

            {/* ── Saisie du code ───────────────────────────────── */}
            {setup || active ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label={setup ? t('ui.codeA6Chiffres') : t('ui.codeDeVerification')}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={14}
                  hint={t('ui.n6ChiffresTotpOuUnCode')}
                />

                {setup ? (
                  <>
                    {confirmer.isError ? <ErrorState error={confirmer.error} showRequestId /> : null}
                    <Button
                      label={t('ui.activerLaDoubleAuthentification')}
                      loading={confirmer.isPending}
                      disabled={!codePret}
                      onClick={() => confirmer.mutate()}
                      fullWidth
                    />
                  </>
                ) : (
                  <>
                    {/*
                      Vérification ponctuelle : c'est le point de contrôle NFR-01.
                      Distincte de l'activation — elle prouve que vous avez bien
                      votre second facteur en main, ici et maintenant.
                    */}
                    {verifier.isSuccess ? (
                      <Text preset="bodySm" color={COLORS.success}>{t('ui.codeValideVotreSecondFacteurFonctionne')}</Text>
                    ) : null}
                    {verifier.isError ? <ErrorState error={verifier.error} showRequestId /> : null}
                    <Button
                      label={t('ui.verifierUnCode')}
                      variant="outline"
                      loading={verifier.isPending}
                      disabled={!codePret}
                      onClick={() => verifier.mutate()}
                      fullWidth
                    />

                    <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {desactiver.isError ? <ErrorState error={desactiver.error} showRequestId /> : null}
                      <Button
                        label={t('ui.desactiverLaDoubleAuthentification')}
                        variant="danger"
                        size="sm"
                        loading={desactiver.isPending}
                        disabled={!codePret}
                        onClick={() => desactiver.mutate()}
                      />
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.laDesactivationExigeElleAussiUn')}</Text>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {!active ? (
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesCodesDeSecoursSontA')}</Text>
            ) : null}
          </Card>
        </motion.div>
      </Section>
    </AuthGate>
  );
}
