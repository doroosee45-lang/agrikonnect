import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { getUserInitialRoute } from '@/lib/redirects';
import { useI18n } from '@/i18n';

/**
 * AUTH — vérification de l'adresse e-mail.
 *
 * Deux voies d'entrée, parce qu'une seule ne suffit pas :
 *
 *  1. le **lien** reçu par e-mail porte le jeton dans l'URL (`?token=…`) : il
 *     est **prérempli dans le champ**, puis vérifié **au clic sur le bouton**.
 *     Aucune vérification automatique à l'arrivée : il n'y a pas de
 *     `useEffect`, et `verifier.mutate()` n'est appelé que par le bouton. C'est
 *     voulu — un simple préchargement de la page ne doit pas consommer un
 *     jeton à usage unique, et l'utilisateur doit pouvoir corriger un jeton
 *     tronqué par son client de messagerie avant l'envoi ;
 *  2. la **saisie manuelle** : si le lien est cassé par un client de
 *     messagerie, recopié à la main, ou ouvert sur un autre appareil,
 *     l'utilisateur doit pouvoir coller le jeton lui-même.
 *
 * L'écran précédent ne proposait que le renvoi du lien : sans champ de saisie,
 * un jeton reçu n'avait **nulle part où être entré**, et la route
 * `POST /auth/verify-email` n'était appelée par aucun écran.
 *
 * Le **renvoi** exige l'adresse cible : l'API refuse un renvoi sans adresse
 * (`POST /auth/resend-verification`), et c'est normal — sans elle, Supabase
 * répond « Type provided requires an email address » et aucun e-mail ne part.
 * L'adresse est préremplie depuis `?email=…` (arrivée depuis l'inscription),
 * ou saisie à la main.
 *
 * Aucun secret n'est affiché ni journalisé : le jeton est une preuve à usage
 * unique, il n'est jamais écrit dans la console ni dans un log applicatif.
 */
export default function AuthVerifyEmail() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const jetonUrl = params.get('token_hash') ?? params.get('token') ?? '';
  const emailUrl = params.get('email') ?? '';

  const [email, setEmail] = useState(emailUrl);
  const [tokenHash, setTokenHash] = useState(jetonUrl);
  const [renvoye, setRenvoye] = useState(false);

  const verifier = useMutation({
    mutationFn: () => authApi.verifyEmail(tokenHash.trim()),
  });

  const renvoyer = useMutation({
    mutationFn: () => authApi.resendVerification(email.trim()),
    onSuccess: () => setRenvoye(true),
  });

  const verifie = verifier.isSuccess;
  const navigate = useNavigate();

  /*
   * Parcours post-verification (CAA) : si une session existe deja, partir
   * tout de suite vers l espace du role (Situation A = configuration
   * initiale si identite manquante, Situation B = espace direct). Sans
   * session, le bouton de connexion enchaîne vers la destination centrale.
   */
  useEffect(() => {
    if (!verifie) return;
    const etat = useAuthStore.getState();
    if (etat.status === 'authenticated' && etat.user) {
      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
    }
  }, [verifie, navigate]);
  const peutVerifier = tokenHash.trim().length > 0 && !verifier.isPending && !verifie;
  const peutRenvoyer = /.+@.+\..+/.test(email.trim()) && !renvoyer.isPending;

  return (
    <Section style={{ minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        style={{ width: '100%', maxWidth: 460 }}
      >
        <Card tone="white" style={{ padding: 32 }}>
          <Text preset="h2" style={{ marginBottom: 8, textAlign: 'center' }}>{t('ui.verificationDEmail')}</Text>

          {verifie ? (
            /*
             * État de succès : aucun bouton « Renvoyer » ici, ce serait inviter
             * à consommer un second jeton alors que l'adresse est déjà vérifiée.
             */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.adresseVerifiee')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 20 }}>{t('ui.connectezVousPourAccederAVotre')}</Text>
              <Link to="/auth/login">
                <Button label={t('ui.seConnecter')} variant="primary" size="sm" />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Text preset="bodySm" color={COLORS.slateGray} style={{ textAlign: 'center' }}>
                {jetonUrl
                  ? t('ui.leJetonContenuDansVotreLien')
                  : t('ui.collezLeJetonRecuParEmail')}
              </Text>

              <Input
                label={t('ui.adresseEMailAVerifier')}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
              />

              {/*
                `autoComplete="off"` et `spellCheck={false}` : un jeton n'est pas
                un texte à corriger, et le laisser passer par l'autocomplétion du
                navigateur l'enverrait dans l'historique de saisie.
              */}
              <Input
                label={t('ui.jetonDeVerification')}
                value={tokenHash}
                onChange={(event) => setTokenHash(event.target.value)}
                placeholder={t('ui.collezLeJetonRecuParEmail_91532')}
                autoComplete="off"
                spellCheck={false}
              />

              {verifier.isError ? <ErrorState error={verifier.error} showRequestId /> : null}

              <Button
                label={t('ui.verifierMonAdresse')}
                loading={verifier.isPending}
                disabled={!peutVerifier}
                onClick={() => verifier.mutate()}
                fullWidth
              />

              <div style={{ borderTop: `1px solid ${COLORS.lightBorder}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text preset="caption" color={COLORS.slateGray} style={{ textAlign: 'center' }}>
                  {renvoye
                    ? t('ui.nouveauLienEnvoyeVerifiezVotreBoite')
                    : t('ui.lienExpireOuIntrouvable')}
                </Text>
                {renvoyer.isError ? <ErrorState error={renvoyer.error} showRequestId /> : null}
                <Button
                  label={renvoye ? t('ui.renvoyerUnLien') : t('ui.renvoyerLeLien')}
                  variant="outline"
                  size="sm"
                  loading={renvoyer.isPending}
                  disabled={!peutRenvoyer}
                  onClick={() => renvoyer.mutate()}
                />
              </div>
            </div>
          )}

          {!verifie ? (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link to="/auth/login" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourALaConnexion_b56d3')}</Link>
            </div>
          ) : null}
        </Card>
      </motion.div>
    </Section>
  );
}
