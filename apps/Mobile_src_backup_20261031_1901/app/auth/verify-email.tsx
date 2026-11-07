import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { Button, Card, Divider, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Vérification de l'adresse e-mail.
 *
 * L'écran précédent ne proposait **que le renvoi du lien** : un jeton reçu
 * n'avait nulle part où être saisi, et `POST /auth/verify-email` n'était appelé
 * par aucun écran. Sur mobile le problème est plus aigu que sur le web — un
 * lien reçu dans une autre application ne ramène pas toujours le jeton ici.
 *
 * Deux voies : le jeton porté par l'URL (`?token=…`), prérempli, et la saisie
 * manuelle.
 *
 * Aucun secret n'est affiché ni journalisé : le jeton n'est écrit ni dans un
 * `console.*` ni dans un log applicatif.
 */
export default function AuthVerifyEmail() {
  const params = useLocalSearchParams<{ token?: string }>();
  const jetonUrl = typeof params.token === 'string' ? params.token : '';

  const [tokenHash, setTokenHash] = useState(jetonUrl);
  const [renvoye, setRenvoye] = useState(false);

  const verifier = useMutation({
    mutationFn: () => authApi.verifyEmail(tokenHash.trim()),
  });

  const renvoyer = useMutation({
    mutationFn: () => authApi.resendVerification(),
    onSuccess: () => setRenvoye(true),
  });

  const verifie = verifier.isSuccess;
  const peutVerifier = tokenHash.trim().length > 0 && !verifier.isPending && !verifie;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title="Vérification d'email"
        subtitle={
          verifie
            ? 'Votre adresse est vérifiée.'
            : 'Collez le jeton reçu, ou demandez un nouveau lien.'
        }
      />
      <Section bare contentStyle={styles.section}>
        <Card tone="white">
          {verifie ? (
            <View style={styles.success}>
              <Text preset="h3" color={COLORS.success} style={styles.mb}>
                ✓ Adresse vérifiée
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.mb}>
                Vous pouvez maintenant vous connecter.
              </Text>
              <Button label="Se connecter" variant="primary" onPress={() => router.push('/auth/login')} />
            </View>
          ) : (
            <View style={styles.form}>
              <Text preset="bodySm" color={COLORS.slateGray}>
                {jetonUrl
                  ? 'Le jeton de votre lien est prérempli. Vérifiez-le, ou collez-en un autre.'
                  : 'Le jeton figure dans l’email de vérification.'}
              </Text>

              {/*
                `autoCorrect={false}` et `autoCapitalize="none"` : un jeton n'est
                pas du texte à corriger, et la capitalisation automatique le
                casserait silencieusement.
              */}
              <Input
                label="Jeton de vérification"
                value={tokenHash}
                onChangeText={setTokenHash}
                placeholder="Collez le jeton reçu par email"
                icon="key-outline"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
              />

              {verifier.isError ? <ErrorState error={verifier.error} /> : null}

              <Button
                label="Vérifier mon adresse"
                variant="primary"
                fullWidth
                loading={verifier.isPending}
                disabled={!peutVerifier}
                onPress={() => verifier.mutate()}
              />

              <Divider />

              <Text preset="caption" color={COLORS.slateGray}>
                {renvoye
                  ? 'Nouveau lien envoyé. Vérifiez votre boîte de réception, et le dossier indésirables.'
                  : 'Lien expiré ou introuvable ?'}
              </Text>
              {renvoyer.isError ? <ErrorState error={renvoyer.error} /> : null}
              <Button
                label={renvoye ? 'Renvoyer un lien' : 'Renvoyer le lien'}
                variant="outline"
                loading={renvoyer.isPending}
                onPress={() => renvoyer.mutate()}
              />
            </View>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  form: { gap: SPACING.md },
  success: { gap: SPACING.md, alignItems: 'center', paddingVertical: SPACING.lg },
  mb: { marginBottom: SPACING.sm },
});
