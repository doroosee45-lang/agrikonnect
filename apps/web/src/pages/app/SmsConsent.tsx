import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AuthGate,
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  Section,
  Text,
} from '@/components/ui';
import { phoneReadiness } from '@/lib/phone';
import { smsConsentApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { useI18n, tr } from '@/i18n';
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

const PURPOSE_LABELS: Record<string, string> = {
  get ALERT() { return tr('ui.alertesAgronomiques'); },
  get OTP() { return tr('ui.codesDeVerification'); },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(bcpLocale(), { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Consentement aux alertes par SMS.
 *
 * Le SMS est le canal d'alerte primaire en RDC : c'est là que l'agriculteur
 * apprend qu'un seuil est franchi. Mais en RDC Twilio ne propose pas de SMS
 * bidirectionnel — répondre à un message n'arrive nulle part. Donner son
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
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.alertesParSms')}
        description={t('ui.connectezVousPourChoisirDeRecevoir')}
        icon="📱"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.alertesParSms')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.recevezUnSmsQuandUnSeuil')}</Text>
        </div>

        {consents.isLoading ? (
          <LoadingState count={2} height={120} />
        ) : consents.isError ? (
          <ErrorState error={consents.error} onRetry={() => void consents.refetch()} />
        ) : (
          <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
            {/*
              ── Le numéro, avant l'accord ──────────────────────────
              Le consentement porte sur un numéro précis. S'il manque ou s'il
              n'est pas au format international, l'accord ne servirait à rien :
              l'envoi serait retenu côté serveur. On le dit donc **avant** de
              proposer le bouton, et non après un échec silencieux.
            */}
            {!readiness.valid ? (
              <Card style={{ borderLeft: `3px solid ${COLORS.warning}` }}>
                <Text preset="h3" style={{ marginBottom: 8 }}>
                  {readiness.present ? t('ui.numeroAuFormatInvalide') : t('ui.aucunNumeroEnregistre')}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                  {readiness.blocker}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray}>
                  {readiness.present
                    ? t('ui.numeroEnregistre', { phone })
                    : t('ui.ajoutezUnNumeroAuFormatInternational')}
                </Text>
              </Card>
            ) : (
              <Card>
                <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.numeroDestinataire')}</Text>
                <Text preset="bodyMd" style={{ marginBottom: 8 }}>
                  {phone}
                </Text>
                {/*
                  Le consentement est possible sur un numéro non vérifié, mais
                  on le dit : c'est la porte ouverte au consentement donné pour
                  le numéro d'un autre. La vérification par code est proposée
                  en §4.2 de la doc, pas implémentée.
                */}
                <Text preset="caption" color={phoneVerified ? COLORS.success : COLORS.warning}>
                  {phoneVerified
                    ? t('ui.numeroVerifie')
                    : t('ui.ceNumeroNAPasEncore')}
                </Text>
              </Card>
            )}

            {/* ── L'accord lui-même ─────────────────────────────── */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <Text preset="h3" style={{ marginBottom: 4 }}>
                    {PURPOSE_LABELS[ALERT_PURPOSE] ?? ALERT_PURPOSE}
                  </Text>
                  <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 12 }}>{t('ui.unSmsParAlerteSurLe')}</Text>
                  <Chip label={granted ? t('ui.consentementDonne') : t('ui.aucunEnvoiEnCours')} tone={granted ? 'success' : 'neutral'} />
                </div>
                <Button
                  label={
                    granted
                      ? t('ui.retirerMonAccord')
                      : readiness.canGrant
                        ? t('ui.donnerMonAccord')
                        : t('ui.numeroRequis')
                  }
                  onClick={() => (granted ? withdraw.mutate() : grant.mutate())}
                  variant={granted ? 'outline' : 'primary'}
                  size="sm"
                  loading={pending}
                  disabled={!canAct}
                />
              </div>

              {granted && alertConsent ? (
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>{t('ui.donneLe', { grantedAt: formatDate(alertConsent.grantedAt) })}{alertConsent.noticeVersion ? t('ui.texte', { noticeVersion: alertConsent.noticeVersion }) : ''}
                </Text>
              ) : null}

              {/*
                Le retrait est conservé en base plutôt que supprimé : c'est la
                preuve que l'envoi a cessé, et qu'il avait commencé.
              */}
              {alertConsent?.status === 'WITHDRAWN' && alertConsent.withdrawnAt ? (
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>{t('ui.retireLeAucunNouveauSmsN', { withdrawnAt: formatDate(alertConsent.withdrawnAt) })}</Text>
              ) : null}
            </Card>

            {/* ── Comment se désinscrire : le point non négociable ── */}
            <Card style={{ borderLeft: `3px solid ${COLORS.gold}` }}>
              <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.commentSeDesinscrire')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray}>
                {consents.data?.optOutNotice ??
                  t('ui.lesAlertesArriventDUnIdentifiant')}
              </Text>
              {consents.data?.twoWaySupported === false ? (
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>{t('ui.enRepubliqueDemocratiqueDuCongoLe')}</Text>
              ) : null}
            </Card>

            {/* ── Ce que l'accord couvre, et ce qu'il ne couvre pas ── */}
            <Card>
              <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.ceQueCouvreCetAccord')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.vousAcceptezDeRecevoirSurVotre')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.vousNeRecevrezPasDePublicite')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.apresLeRetraitAucunNouveauSms')}</Text>
            </Card>

            {/*
              L'erreur du changement est montrée ici plutôt que dans un
              dialogue : l'état affiché au-dessus vient de la dernière lecture
              réussie, donc il contredit silencieusement l'échec tant qu'on ne
              le dit pas.
            */}
            {error ? (
              <ErrorState error={error} onRetry={() => void consents.refetch()} />
            ) : null}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
