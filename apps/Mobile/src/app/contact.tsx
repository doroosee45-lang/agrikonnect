import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Input,
  LoadingState,
  PressableScale,
  Reveal,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { usePublicFarms } from '@/hooks/usePublicData';
import { publicApi } from '@/services/api/endpoints';
import type { RequestError } from '@/services/api/types';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/**
 * Contact.
 *
 * Le seul canal public exposé par le backend est le formulaire d’une fiche
 * producteur (`POST /public/farms/:slug/contact`) : il transmet le message sans
 * révéler les coordonnées. Cette page s’appuie donc dessus, en laissant le
 * visiteur choisir le destinataire.
 */
export default function Contact() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [slug, setSlug] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = usePublicFarms({ limit: 50 });
  const farms = useMemo(() => data?.items ?? [], [data]);
  const selected = farms.find((farm) => farm.slug === slug) ?? null;

  const messageError = touched && message.trim().length < 10 ? 'Message trop court (10 caractères minimum).' : null;

  const mutation = useMutation({
    mutationFn: () =>
      publicApi.contactFarm(slug as string, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim(),
        // Pot de miel : ce champ doit rester vide (validation côté serveur).
        website: '',
      }),
    onSuccess: () => {
      setMessage('');
      setTouched(false);
    },
  });

  const submit = () => {
    setTouched(true);
    if (!slug || message.trim().length < 10) return;
    mutation.mutate();
  };

  return (
    <PublicShell active="contact">
      <PageHeader
        index={1}
        eyebrow="Contact"
        title="Écrire à un producteur"
        subtitle="Le message est transmis au producteur sans révéler vos coordonnées ni les siennes. Pour une mise en relation commerciale, la messagerie interne de votre espace reste le canal privilégié."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={[styles.layout, wide ? styles.layoutWide : null]}>
          <Reveal variant="left" style={styles.formColumn}>
            <Card tone="white" style={styles.form}>
              <Text preset="overline" color={COLORS.livingGreen}>
                Destinataire
              </Text>

              {isLoading ? (
                <LoadingState count={2} height={60} />
              ) : farms.length === 0 ? (
                <Card tone="pale">
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    Aucun profil public n’est publié pour le moment : il n’y a donc aucun destinataire
                    disponible. Revenez plus tard, ou créez votre propre profil.
                  </Text>
                </Card>
              ) : (
                <View style={styles.farmList}>
                  {farms.slice(0, 8).map((farm) => {
                    const active = farm.slug === slug;
                    return (
                      <PressableScale
                        key={farm.slug}
                        onPress={() => setSlug(farm.slug)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[styles.farmRow, active ? styles.farmRowActive : null]}
                      >
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={active ? COLORS.forestGreen : COLORS.slateGray}
                        />
                        <View style={styles.farmRowBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                            {farm.name}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {farm.countryCode}
                            {farm.province ? ` · ${farm.province}` : ''}
                          </Text>
                        </View>
                        {farm.verificationStatus ? <Chip label="Vérifié" tone="success" size="sm" /> : null}
                      </PressableScale>
                    );
                  })}
                </View>
              )}

              <Input
                label="Votre nom"
                value={name}
                onChangeText={setName}
                placeholder="Nom et prénom"
                icon="person-outline"
                optionalLabel="facultatif"
                autoCapitalize="words"
              />
              <Input
                label="E-mail de réponse"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                icon="mail-outline"
                optionalLabel="facultatif"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Téléphone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+225 07 00 00 00 00"
                icon="call-outline"
                optionalLabel="facultatif"
                keyboardType="phone-pad"
              />
              <TextArea
                label="Message"
                value={message}
                onChangeText={setMessage}
                onBlur={() => setTouched(true)}
                placeholder="Volume recherché, période, conditions de livraison…"
                error={messageError}
                helper="10 caractères minimum. Le message est transmis tel quel."
              />

              <Button
                label="Envoyer le message"
                onPress={submit}
                variant="primary"
                icon="send-outline"
                fullWidth
                loading={mutation.isPending}
                disabled={!slug}
              />

              {mutation.isSuccess ? (
                <Card tone="pale" style={styles.feedback}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    Message transmis au producteur. Il vous répondra directement sur vos coordonnées.
                  </Text>
                </Card>
              ) : null}

              {mutation.isError ? (
                <ErrorState error={mutation.error as RequestError} onRetry={submit} />
              ) : null}
            </Card>
          </Reveal>

          <Reveal index={1} variant="right" style={styles.asideColumn}>
            <Card tone="ink" style={styles.aside}>
              <Text preset="overline" color={COLORS.gold}>
                Ce que ce formulaire ne fait pas
              </Text>
              {[
                'Il ne révèle ni votre numéro ni celui du producteur.',
                'Il n’ajoute aucun destinataire à une liste : il n’y a pas d’abonnement caché.',
                'Il ne garantit pas de réponse : le producteur reste libre de répondre.',
              ].map((item) => (
                <View key={item} style={styles.asideRow}>
                  <Ionicons name="close-circle-outline" size={14} color={COLORS.gold} />
                  <Text preset="bodySm" color="rgba(246, 247, 242, 0.8)" style={styles.lineHeight}>
                    {item}
                  </Text>
                </View>
              ))}
            </Card>

            <Card tone="white" style={styles.aside}>
              <Text preset="h3" color={COLORS.textPrimary}>
                Vous cherchez à acheter ou à vendre ?
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                Les annonces, demandes d’achat et commandes passent par un compte : c’est ce qui permet de
                tracer les échanges et de protéger les deux parties.
              </Text>
              <View style={styles.asideActions}>
                <Button label="Créer un compte" onPress={() => router.push('/auth/register')} variant="primary" size="sm" />
                <Button label="Voir l’annuaire" onPress={() => router.push('/farmers')} variant="outline" size="sm" />
              </View>
            </Card>

            {selected ? (
              <Card tone="pale" style={styles.aside}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Destinataire sélectionné
                </Text>
                <Text preset="h3" color={COLORS.textPrimary}>
                  {selected.name}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  {selected.countryCode}
                  {selected.province ? ` · ${selected.province}` : ''} · fiche /{selected.slug}
                </Text>
              </Card>
            ) : null}
          </Reveal>
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56 },
  lineHeight: { lineHeight: 20 },
  layout: { gap: SPACING.lg },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  formColumn: { flex: 1.3 },
  asideColumn: { flex: 1, gap: SPACING.md },
  form: { gap: SPACING.md },
  farmList: { gap: SPACING.xs, maxHeight: 260 },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    backgroundColor: COLORS.pureWhite,
  },
  farmRowActive: { borderColor: COLORS.forestGreen, backgroundColor: TINTS.forestGreenBg },
  farmRowBody: { flex: 1, gap: 1 },
  feedback: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  aside: { gap: SPACING.sm },
  asideRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  asideActions: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
});
