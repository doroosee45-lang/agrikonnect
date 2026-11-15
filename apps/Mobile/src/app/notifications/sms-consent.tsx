import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { phoneReadiness } from '@/lib/phone';
import { smsConsentApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';
import { bcpLocale } from '@/lib/format';

/**
 * Version du texte de consentement présenté ici.
 *
 * Elle est enregistrée avec l'accord : si ce texte change, l'accord donné sur
 * l'ancienne version ne couvre plus rien, et il faut le redemander. Sans cette
 * version, un accord passé resterait valide pour un texte que la personne n'a
 * jamais lu.
 */
const NOTICE_VERSION = 'v1-2026-10';

/**
 * Usage couvert par cet écran.
 *
 * Un seul pour l'instant : les alertes agronomiques. Le backend distingue déjà
 * les usages (`ALERT`, `OTP`…), donc un second usage aura son propre accord —
 * on ne consent pas « aux SMS » en général, mais à un usage précis.
 */
const ALERT_PURPOSE = 'ALERT';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(bcpLocale(), { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Consentement aux alertes par SMS.
 *
 * Le SMS est le canal d'alerte primaire en RDC : c'est là que l'agriculteur
 * apprend qu'un seuil est franchi. Mais en RDC le fournisseur ne propose pas de
 * SMS bidirectionnel — répondre à un message n'arrive nulle part. Donner son
 * accord, et surtout le retirer, ne peut donc se faire **que dans
 * l'application**. Cet écran est le seul endroit où la désinscription existe.
 */
export default function SmsConsent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  /*
   * Le numéro affiché et jugé ici est **celui que l'envoi utilisera** :
   * `sendAlertBatch` envoie à `membership.user.phone`, et `publicUser()` expose
   * exactement `profile.phone`. Aucune copie locale, donc aucun risque que
   * l'écran valide un numéro différent de celui qui recevrait le message.
   */
  const phone = useAuthStore((state) => state.user?.phone ?? null);
  const phoneVerified = useAuthStore((state) => state.user?.phoneVerified ?? false);
  const readiness = phoneReadiness(phone);

  const consents = useQuery({
    queryKey: queryKeys.sms.consent,
    queryFn: () => smsConsentApi.get().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.sms.consent });

  const grant = useMutation({
    mutationFn: () => smsConsentApi.grant(ALERT_PURPOSE, NOTICE_VERSION),
    onSuccess: invalidate,
  });

  const withdraw = useMutation({
    mutationFn: () => smsConsentApi.withdraw(),
    onSuccess: invalidate,
  });

  const alertConsent = consents.data?.items.find((item) => item.purpose === ALERT_PURPOSE) ?? null;
  const granted = alertConsent?.status === 'GRANTED';
  const pending = grant.isPending || withdraw.isPending;
  const error = grant.error ?? withdraw.error;

  /*
   * Le retrait reste toujours possible, même sans numéro valide : bloquer la
   * désinscription parce que le numéro est malformé serait exactement l'inverse
   * de ce qu'il faut. Seul « donner mon accord » est conditionné au numéro.
   */
  const canAct = granted || readiness.canGrant;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.alertesParSms')}
        subtitle={t('ui.choisissezDeRecevoirLesAlertesPar')}
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourDonnerOuRetirer')}
          isAuthenticated={isAuthenticated}
          icon="chatbox-ellipses-outline"
        >
          {consents.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : consents.isError ? (
            <ErrorState error={consents.error} onRetry={() => void consents.refetch()} />
          ) : (
            <>
              {/*
                ── Le numéro, avant l'accord ────────────────────────
                Le consentement porte sur un numéro précis. S'il manque ou s'il
                n'est pas au format international, l'accord ne servirait à rien :
                l'envoi serait retenu côté serveur. On le dit donc **avant** de
                proposer le bouton, et non après un échec silencieux.
              */}
              {!readiness.valid ? (
                <Card tone="pale" style={styles.card}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    {readiness.present ? t('ui.numeroAuFormatInvalide') : t('ui.aucunNumeroEnregistre')}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {readiness.blocker}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {readiness.present
                      ? t('ui.numeroEnregistre', { phone })
                      : t('ui.ajoutezUnNumeroAuFormatInternational')}
                  </Text>
                </Card>
              ) : (
                <Card tone="white" style={styles.card}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.numeroDestinataire')}</Text>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    {phone}
                  </Text>
                  {/*
                    Le consentement est possible sur un numéro non vérifié, mais
                    on le dit : c'est la porte ouverte au consentement donné pour
                    le numéro d'un autre. La vérification par code est proposée
                    en §4.2 de la doc, pas implémentée.
                  */}
                  <Text
                    preset="caption"
                    color={phoneVerified ? COLORS.success : COLORS.warning}
                    style={styles.lineHeight}
                  >
                    {phoneVerified
                      ? t('ui.numeroVerifie')
                      : t('ui.ceNumeroNAPasEncore')}
                  </Text>
                </Card>
              )}

              {/* ── L'accord lui-même ─────────────────────────── */}
              <Card tone="white" style={styles.card}>
                <View style={styles.head}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.alertesAgronomiques')}</Text>
                  <Chip
                    label={granted ? t('ui.consentementDonne') : t('ui.aucunEnvoi')}
                    tone={granted ? 'forest' : 'neutral'}
                    size="sm"
                  />
                </View>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.unSmsParAlerteSurLe_6de61')}</Text>

                {granted && alertConsent ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.donneLe', { grantedAt: formatDate(alertConsent.grantedAt) })}{alertConsent.noticeVersion ? t('ui.texte', { noticeVersion: alertConsent.noticeVersion }) : ''}
                  </Text>
                ) : null}

                {/*
                  Le retrait est conservé en base plutôt que supprimé : c'est la
                  preuve que l'envoi a cessé, et qu'il avait commencé.
                */}
                {alertConsent?.status === 'WITHDRAWN' && alertConsent.withdrawnAt ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.retireLeAucunNouveauSmsN', { withdrawnAt: formatDate(alertConsent.withdrawnAt) })}</Text>
                ) : null}

                <Button
                  label={
                    granted
                      ? t('ui.retirerMonAccord')
                      : readiness.canGrant
                        ? t('ui.donnerMonAccord')
                        : t('ui.numeroRequis')
                  }
                  onPress={() => (granted ? withdraw.mutate() : grant.mutate())}
                  variant={granted ? 'outline' : 'primary'}
                  fullWidth
                  loading={pending}
                  disabled={!canAct}
                />
              </Card>

              {/* ── Comment se désinscrire : le point non négociable ── */}
              <Card tone="pale" style={styles.note}>
                <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.commentSeDesinscrire')}</Text>
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  {consents.data?.optOutNotice ??
                    t('ui.lesAlertesArriventDUnIdentifiant')}
                </Text>
                {consents.data?.twoWaySupported === false ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.enRepubliqueDemocratiqueDuCongoLe')}</Text>
                ) : null}
              </Card>

              {/* ── Ce que l'accord couvre, et ce qu'il ne couvre pas ── */}
              <Card tone="white" style={styles.card}>
                <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.ceQueCouvreCetAccord')}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.vousAcceptezDeRecevoirSurVotre_54423')}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.vousNeRecevrezPasDePublicite')}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.apresLeRetraitAucunNouveauSms')}</Text>
              </Card>

              {/*
                L'erreur du changement est montrée ici plutôt que dans un
                dialogue : l'état affiché au-dessus vient de la dernière lecture
                réussie, donc il contredit silencieusement l'échec tant qu'on ne
                le dit pas.
              */}
              {error ? <ErrorState error={error} onRetry={() => void consents.refetch()} showRequestId /> : null}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  card: { gap: SPACING.md },
  note: { gap: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
});
