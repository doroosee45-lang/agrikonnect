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
import { useI18n } from '@/i18n';

/**
 * Contact.
 *
 * Le seul canal public exposé par le backend est le formulaire d’une fiche
 * producteur (`POST /public/farms/:slug/contact`) : il transmet le message sans
 * révéler les coordonnées. Cette page s’appuie donc dessus, en laissant le
 * visiteur choisir le destinataire.
 */
export default function Contact() {
  const { t } = useI18n();
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

  const messageError = touched && message.trim().length < 10 ? t('ui.messageTropCourt10CaracteresMinimum') : null;

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
        eyebrow={t('ui.contact')}
        title={t('ui.ecrireAUnProducteur')}
        subtitle={t('ui.leMessageEstTransmisAuProducteur')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={[styles.layout, wide ? styles.layoutWide : null]}>
          <Reveal variant="left" style={styles.formColumn}>
            <Card tone="white" style={styles.form}>
              <Text preset="overline" color={COLORS.livingGreen}>{t('ui.destinataire')}</Text>

              {isLoading ? (
                <LoadingState count={2} height={60} />
              ) : farms.length === 0 ? (
                <Card tone="pale">
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.aucunProfilPublicNEstPublie')}</Text>
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
                        {farm.verificationStatus ? <Chip label={t('common.verified')} tone="success" size="sm" /> : null}
                      </PressableScale>
                    );
                  })}
                </View>
              )}

              <Input
                label={t('ui.votreNom')}
                value={name}
                onChangeText={setName}
                placeholder={t('ui.nomEtPrenom')}
                icon="person-outline"
                optionalLabel={t('common.optional')}
                autoCapitalize="words"
              />
              <Input
                label={t('ui.eMailDeReponse')}
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                icon="mail-outline"
                optionalLabel={t('common.optional')}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label={t('ui.telephone_d3b02')}
                value={phone}
                onChangeText={setPhone}
                placeholder="+225 07 00 00 00 00"
                icon="call-outline"
                optionalLabel={t('common.optional')}
                keyboardType="phone-pad"
              />
              <TextArea
                label={t('ui.message')}
                value={message}
                onChangeText={setMessage}
                onBlur={() => setTouched(true)}
                placeholder={t('ui.volumeRecherchePeriodeConditionsDeLivraison')}
                error={messageError}
                helper={t('ui.n10CaracteresMinimumLeMessageEst')}
              />

              <Button
                label={t('ui.envoyerLeMessage')}
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
                  <Text preset="bodySm" color={COLORS.textPrimary}>{t('ui.messageTransmisAuProducteurIlVous')}</Text>
                </Card>
              ) : null}

              {mutation.isError ? (
                <ErrorState error={mutation.error as RequestError} onRetry={submit} />
              ) : null}
            </Card>
          </Reveal>

          <Reveal index={1} variant="right" style={styles.asideColumn}>
            <Card tone="ink" style={styles.aside}>
              <Text preset="overline" color={COLORS.gold}>{t('ui.ceQueCeFormulaireNeFait')}</Text>
              {[
                t('ui.ilNeReveleNiVotreNumero'),
                t('ui.ilNAjouteAucunDestinataireA'),
                t('ui.ilNeGarantitPasDeReponse'),
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
              <Text preset="h3" color={COLORS.textPrimary}>{t('ui.vousCherchezAAcheterOuA')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.lesAnnoncesDemandesDAchatEt')}</Text>
              <View style={styles.asideActions}>
                <Button label={t('ui.creerUnCompte')} onPress={() => router.push('/auth/register')} variant="primary" size="sm" />
                <Button label={t('ui.voirLAnnuaire_21320')} onPress={() => router.push('/farmers')} variant="outline" size="sm" />
              </View>
            </Card>

            {selected ? (
              <Card tone="pale" style={styles.aside}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.destinataireSelectionne')}</Text>
                <Text preset="h3" color={COLORS.textPrimary}>
                  {selected.name}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.fiche_f5c1c', { countryCode: selected.countryCode, value: selected.province ? ` · ${selected.province}` : '', slug: selected.slug })}</Text>
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
