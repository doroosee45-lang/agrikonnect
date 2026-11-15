import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthShell } from '@/components/auth/AuthShell';
import { AppImage, Button, Card, Divider, ErrorState, Input, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';

type Setup = Awaited<ReturnType<typeof authApi.mfaSetup>>['data'];

/**
 * Double authentification (NFR-01).
 *
 * Cycle réel côté serveur : `setup` génère un secret TOTP à confirmer, `confirm`
 * l’active après un code valide, `verify` valide un code ponctuel, `disable`
 * exige également un code. Sans second facteur valide, aucune session n’est
 * délivrée à la connexion suivante.
 */
export default function Mfa() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  /*
   * Codes de secours renvoyés par `confirm`, **et rien d'autre**.
   *
   * Le serveur n'en conserve que les empreintes : aucune requête ne peut les
   * restituer. L'écran les jetait (`onSuccess` vidait seulement `setup`) — un
   * utilisateur perdant son téléphone restait définitivement dehors.
   */
  const [secours, setSecours] = useState<{ codes: string[]; warning: string } | null>(null);

  const status = useQuery({
    queryKey: ['auth', 'mfa', 'status'],
    queryFn: () => authApi.mfaStatus().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const startSetup = useMutation({
    mutationFn: () => authApi.mfaSetup().then((result) => result.data),
    onSuccess: (data) => setSetup(data),
  });

  const confirm = useMutation({
    // `.then((result) => result.data)` comme `startSetup` : sans ce déballage,
    // `onSuccess` reçoit l'enveloppe `RequestResult`, pas la charge utile.
    mutationFn: () => authApi.mfaConfirm(code.trim()).then((result) => result.data),
    onSuccess: (data) => {
      setSetup(null);
      setCode('');
      setSecours({ codes: data.backupCodes ?? [], warning: data.warning });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa', 'status'] });
    },
  });

  /**
   * Validation ponctuelle d'un code — le point de contrôle NFR-01, distinct de
   * `confirm` qui active la 2FA. `POST /auth/mfa/verify` n'était appelé par
   * aucun écran, sur aucun client.
   */
  const verify = useMutation({
    mutationFn: () => authApi.mfaVerify(code.trim()),
    onSuccess: () => setCode(''),
  });

  const disable = useMutation({
    mutationFn: () => authApi.mfaDisable(code.trim()),
    onSuccess: () => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa', 'status'] });
    },
  });

  if (!isAuthenticated) {
    return (
      <AuthShell title={t('auth.mfaTitle')} subtitle={t('ui.connectezVousPourGererVotreDouble')}>
        <Card tone="pale">
          <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.cettePageEstReserveeAuxComptes')}</Text>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.mfaTitle')} subtitle={t('auth.mfaSubtitle')}>
      <View style={styles.form}>
        <Card tone={status.data?.enabled ? 'pale' : 'white'} style={styles.statusCard}>
          <Ionicons
            name={status.data?.enabled ? 'shield-checkmark' : 'shield-outline'}
            size={20}
            color={status.data?.enabled ? COLORS.success : COLORS.warning}
          />
          <View style={styles.statusBody}>
            <Text preset="bodyMedium" color={COLORS.textPrimary}>
              {status.isLoading ? t('ui.verification') : status.data?.enabled ? t('ui.activee') : t('ui.desactivee')}
            </Text>
            <Text preset="caption" color={COLORS.slateGray}>
              {status.data?.enabled
                ? t('ui.methode', { value: status.data.method ?? 'TOTP' })
                : t('ui.recommandeeDesQueVousPubliezDes')}
            </Text>
          </View>
        </Card>

        {/* ── Codes de secours : affichage unique ─────────────── */}
        {secours ? (
          <Card tone="white" style={styles.secours}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.onGoldSurface} />
            <Text preset="overline" color={COLORS.onGoldSurface}>{t('ui.codesDeSecours')}</Text>
            {/*
              L'avertissement **vient de l'API** (`warning`) : si le backend
              change la formulation, l'écran suit au lieu d'afficher un texte
              périmé recopié ici.
            */}
            <Text preset="bodySm" color={COLORS.onGoldSurface} style={styles.lineHeight}>
              {secours.warning}
            </Text>
            <View style={styles.secoursListe}>
              {secours.codes.map((codeSecours) => (
                /* Les codes sont uniques : pas d'index en clé. */
                <Text key={codeSecours} preset="bodyMedium" color={COLORS.onGoldSurface} style={styles.secoursCode}>
                  {codeSecours}
                </Text>
              ))}
            </View>
            <Text preset="caption" color={COLORS.onGoldSurface} style={styles.lineHeight}>{t('ui.recopiezLesMaintenantSurUnSupport')}</Text>
            {/*
              Pas de copie dans le presse-papiers : l'application mobile n'a
              aucune dépendance de presse-papiers installée, et en ajouter une
              pour cet écran sort du périmètre. L'affichage unique suffit au
              besoin — recopier ou capturer l'écran.
            */}
            <Button
              label={t('ui.jAiConserveMesCodes_196fa')}
              onPress={() => setSecours(null)}
              variant="primary"
              fullWidth
            />
          </Card>
        ) : null}

        {!status.data?.enabled ? (
          setup ? (
            /*
             * ## Aucun secret affiché
             *
             * L'écran affichait auparavant `setup.secret` en clair, ainsi que
             * l'`otpauthUrl` complet — qui **contient** le secret. Un secret à
             * l'écran est lisible par-dessus l'épaule, capturable, et se
             * retrouve dans les captures d'écran et les journaux
             * d'accessibilité.
             *
             * Il est remplacé par le **QR code généré côté serveur**
             * (`qrDataUri`) : la même information, mais qui se scanne au lieu de
             * se lire. La saisie manuelle de secours reste disponible depuis la
             * version web.
             */
            <Card tone="white" style={styles.qr}>
              <Text preset="overline" color={COLORS.forestGreen}>{t('ui.n1ScannezCeQrCode')}</Text>
              <AppImage
                uri={setup.qrDataUri}
                style={styles.qrImage}
                radius={12}
                accessible
                accessibilityLabel={t('ui.qrCodeAScannerAvecVotre_03f06')}
                fallbackLabel={t('ui.qrCodeIndisponible')}
              />
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.n2SaisissezCiDessousLeCode_1545c', { digits: setup.digits })}</Text>
            </Card>
          ) : (
            <Button
              label={t('ui.genererUnSecret')}
              onPress={() => startSetup.mutate()}
              variant="primary"
              icon="key-outline"
              fullWidth
              loading={startSetup.isPending}
            />
          )
        ) : null}

        {setup || status.data?.enabled ? (
          <>
            <Input
              label={t('auth.mfaCode')}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              icon="keypad-outline"
              keyboardType="number-pad"
              maxLength={14}
              helper={t('ui.n6ChiffresTotpOuUnCode_3001f')}
            />

            {setup ? (
              <Button
                label={t('ui.activerLaDoubleAuthentification')}
                onPress={() => confirm.mutate()}
                variant="primary"
                fullWidth
                loading={confirm.isPending}
              />
            ) : (
              <>
                {verify.isSuccess ? (
                  <Text preset="bodySm" color={COLORS.success}>{t('ui.codeValideVotreSecondFacteurFonctionne')}</Text>
                ) : null}
                <Button
                  label={t('ui.verifierUnCode')}
                  onPress={() => verify.mutate()}
                  variant="outline"
                  fullWidth
                  loading={verify.isPending}
                />

                <Divider />

                <Button
                  label={t('ui.desactiver')}
                  onPress={() => disable.mutate()}
                  variant="outline"
                  fullWidth
                  loading={disable.isPending}
                />
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.laDesactivationExigeElleAussiUn')}</Text>
              </>
            )}
          </>
        ) : null}

        {confirm.isError ? <ErrorState error={confirm.error} /> : null}
        {verify.isError ? <ErrorState error={verify.error} /> : null}
        {disable.isError ? <ErrorState error={disable.error} /> : null}

        <Divider />

        <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.lesCodesDeSecoursSontA_054dd')}</Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  lineHeight: { lineHeight: 19 },
  statusCard: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  statusBody: { flex: 1, gap: 2 },
  secours: {
    backgroundColor: COLORS.goldSurface,
    borderColor: COLORS.gold,
    gap: SPACING.xs,
  },
  secoursListe: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  secoursCode: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  qr: { gap: SPACING.sm, alignItems: 'center' },
  qrImage: { width: 220, height: 220, backgroundColor: COLORS.pureWhite },
});
