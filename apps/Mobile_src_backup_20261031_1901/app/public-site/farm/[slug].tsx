import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import {
  AppImage,
  Button,
  Card,
  Chip,
  Divider,
  ErrorState,
  Input,
  LoadingState,
  PressableScale,
  ProvenanceTag,
  Reveal,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { VERT } from '../../../theme/agrikonnect';

/**
 * Fiche publique d'un producteur (`GET /public/farms/:slug`).
 *
 * Tout ce qui s'affiche vient de la projection publique du serveur : position
 * approximative, contacts selon la visibilité choisie, statut de vérification
 * distinct de la déclaration, et directive d'indexation calculée côté serveur.
 */
export default function FarmProfile() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.public.farm(slug ?? ''),
    queryFn: () => publicApi.farm(slug as string).then((result) => result.data),
    enabled: Boolean(slug),
  });

  const contact = useMutation({
    mutationFn: () =>
      publicApi.contactFarm(slug as string, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim(),
        website: '',
      }),
    onSuccess: () => {
      setMessage('');
      setTouched(false);
    },
  });

  const farm = data?.farm;
  const messageError =
    touched && message.trim().length < 10 ? 'Message trop court (10 caractères minimum).' : null;

  return (
    <PublicShell active="farmers">
      {isLoading ? (
        <Section contentStyle={styles.section}>
          <LoadingState count={2} height={200} />
        </Section>
      ) : isError ? (
        <Section contentStyle={styles.section}>
          <ErrorState error={error} onRetry={() => void refetch()} />
          <Button label="Retour à l’annuaire" onPress={() => router.push('/farmers')} variant="outline" size="sm" />
        </Section>
      ) : farm ? (
        <>
          <View style={styles.header}>
            {farm.gallery[0] ? (
              <AppImage uri={farm.gallery[0].url} style={styles.cover} scrim="bottom" radius={0}>
                <View style={styles.coverContent}>
                  <Text preset="overline" color={COLORS.gold}>
                    Fiche publique
                  </Text>
                  <Text preset="heroDisplay" color={COLORS.pureWhite}>
                    {farm.name}
                  </Text>
                </View>
              </AppImage>
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <View style={styles.coverContent}>
                  <Text preset="overline" color={COLORS.gold}>
                    Fiche publique
                  </Text>
                  <Text preset="heroDisplay" color={COLORS.pureWhite}>
                    {farm.name}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
            <View style={[styles.layout, wide ? styles.layoutWide : null]}>
              <Reveal variant="left" style={styles.main}>
                <View style={styles.badges}>
                  <Chip
                    label={farm.verification.label}
                    tone={farm.verification.verifiedAt ? 'success' : 'neutral'}
                    icon={farm.verification.verifiedAt ? 'shield-checkmark' : 'document-text-outline'}
                  />
                  <Chip label={farm.countryCode} tone="forest" icon="globe-outline" />
                  {farm.source ? <Chip label={`Source : ${farm.source}`} tone="neutral" size="sm" /> : null}
                </View>

                {farm.description ? (
                  <Text preset="lead" color={COLORS.textPrimary} style={styles.lineHeight}>
                    {farm.description}
                  </Text>
                ) : (
                  <Text preset="bodySm" color={COLORS.slateGray}>
                    Aucune description publiée.
                  </Text>
                )}

                <Card tone="white" style={styles.facts}>
                  {[
                    { label: 'Surface déclarée', value: farm.totalAreaHa !== null ? `${formatNumber(farm.totalAreaHa, locale, 1)} ha` : '—', provenance: 'declared' as const },
                    { label: 'Parcelles', value: String(farm.plotsCount), provenance: 'declared' as const },
                    { label: 'Travailleurs', value: farm.workers !== null ? formatNumber(farm.workers, locale) : '—', provenance: 'declared' as const },
                    { label: 'Capacité', value: farm.capacity ?? '—', provenance: 'declared' as const },
                    { label: 'Fondée en', value: farm.foundedYear ? String(farm.foundedYear) : '—', provenance: 'declared' as const },
                  ].map((fact) => (
                    <View key={fact.label} style={styles.factRow}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {fact.label}
                      </Text>
                      <View style={styles.factValue}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {fact.value}
                        </Text>
                        <ProvenanceTag kind={fact.provenance} />
                      </View>
                    </View>
                  ))}
                </Card>

                <Card tone="white" style={styles.block}>
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Localisation publiée
                  </Text>
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {[farm.adminPath.village, farm.adminPath.sector, farm.adminPath.territory, farm.adminPath.province]
                      .filter(Boolean)
                      .join(' · ') || 'Aucun découpage administratif publié.'}
                  </Text>
                  {farm.location ? (
                    <View style={styles.locationRow}>
                      <Ionicons name="locate-outline" size={14} color={COLORS.forestGreen} />
                      <Text preset="caption" color={COLORS.slateGray}>
                        Position {farm.location.precision} — {formatNumber(farm.location.coordinates[1], locale, 2)},{' '}
                        {formatNumber(farm.location.coordinates[0], locale, 2)}
                      </Text>
                    </View>
                  ) : (
                    <Text preset="caption" color={COLORS.slateGray}>
                      Cette exploitation n’a pas publié de position.
                    </Text>
                  )}
                </Card>

                <Card tone="white" style={styles.block}>
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Cultures
                  </Text>
                  {farm.crops.length === 0 ? (
                    <Text preset="bodySm" color={COLORS.slateGray}>
                      Aucune culture déclarée.
                    </Text>
                  ) : (
                    <View style={styles.chips}>
                      {farm.crops.map((crop) => (
                        <Chip key={crop.slug} label={crop.name} tone="living" />
                      ))}
                    </View>
                  )}
                </Card>

                {farm.gallery.length > 0 ? (
                  <View style={styles.block}>
                    <Text preset="overline" color={COLORS.livingGreen}>
                      Galerie
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                      {farm.gallery.map((media, index) => (
                        <Reveal key={`${media.url}-${index}`} index={index} variant="scale">
                          <AppImage uri={media.url} style={styles.galleryImage} />
                        </Reveal>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </Reveal>

              <Reveal index={1} variant="right" style={styles.side}>
                <Card tone="white" style={styles.block}>
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Contact
                  </Text>

                  {farm.contact.masked ? (
                    <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                      Les coordonnées ne sont pas publiées. Votre message sera transmis directement au
                      producteur, sans révéler les vôtres.
                    </Text>
                  ) : (
                    <View style={styles.contactList}>
                      {farm.contact.phone ? <ContactRow icon="call-outline" value={farm.contact.phone} /> : null}
                      {farm.contact.whatsapp ? <ContactRow icon="logo-whatsapp" value={farm.contact.whatsapp} /> : null}
                      {farm.contact.email ? <ContactRow icon="mail-outline" value={farm.contact.email} /> : null}
                    </View>
                  )}

                  <Divider />

                  <Input label="Votre nom" value={name} onChangeText={setName} placeholder="Nom et prénom" icon="person-outline" optionalLabel="facultatif" />
                  <Input label="E-mail de réponse" value={email} onChangeText={setEmail} placeholder="vous@exemple.com" icon="mail-outline" optionalLabel="facultatif" keyboardType="email-address" autoCapitalize="none" />
                  <Input label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+225 07 00 00 00 00" icon="call-outline" optionalLabel="facultatif" keyboardType="phone-pad" />
                  <TextArea
                    label="Message"
                    value={message}
                    onChangeText={setMessage}
                    onBlur={() => setTouched(true)}
                    placeholder="Volume recherché, période, conditions…"
                    error={messageError}
                  />
                  <Button
                    label="Transmettre le message"
                    variant="primary"
                    icon="send-outline"
                    fullWidth
                    loading={contact.isPending}
                    onPress={() => {
                      setTouched(true);
                      if (message.trim().length < 10) return;
                      contact.mutate();
                    }}
                  />

                  {contact.isSuccess ? (
                    <Text preset="caption" color={COLORS.success}>
                      Message transmis au producteur.
                    </Text>
                  ) : null}
                  {contact.isError ? <ErrorState error={contact.error} /> : null}
                </Card>

                <Card tone="ink" style={styles.block}>
                  <Text preset="overline" color={COLORS.gold}>
                    QR du profil
                  </Text>
                  <View style={styles.qrRow}>
                    <AppImage uri={publicApi.farmQrUrl(farm.slug, 'png', 320)} style={styles.qr} radius={RADIUS.sm} />
                    <View style={styles.qrText}>
                      <Text preset="bodySm" color={DARK.textMuted} style={styles.lineHeight}>
                        Le QR encode uniquement l’URL publique de cette fiche. Aucun identifiant technique
                        n’y figure.
                      </Text>
                      <Text preset="caption" color={DARK.textFaint}>
                        Rendu produit par le serveur (PNG 320 px).
                      </Text>
                    </View>
                  </View>
                </Card>

                <Card tone="pale" style={styles.block}>
                  <View style={styles.seoRow}>
                    <Ionicons
                      name={farm.seo.indexable ? 'search-outline' : 'eye-off-outline'}
                      size={16}
                      color={COLORS.forestGreen}
                    />
                    <Text preset="bodySm" color={COLORS.textPrimary} style={styles.lineHeight}>
                      {farm.seo.indexable
                        ? 'Profil vérifié : indexable par les moteurs de recherche.'
                        : 'Profil non vérifié : non indexé par les moteurs de recherche, accessible par lien direct.'}
                    </Text>
                  </View>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Directive produite côté serveur ({farm.seo.robots}).
                  </Text>
                </Card>

                <Card tone="white" style={styles.block}>
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Responsable
                  </Text>
                  {farm.owner ? (
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {farm.owner.firstName} {farm.owner.lastName}
                    </Text>
                  ) : (
                    <Text preset="bodySm" color={COLORS.slateGray}>
                      Non publié.
                    </Text>
                  )}
                  <Text preset="caption" color={COLORS.slateGray}>
                    Mise à jour {formatDate(farm.updatedAt, locale)} · {formatNumber(farm.viewCount, locale)} vues
                  </Text>
                </Card>
              </Reveal>
            </View>
          </Section>
        </>
      ) : null}
    </PublicShell>
  );
}

function ContactRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={15} color={COLORS.forestGreen} />
      <Text preset="bodySm" color={COLORS.textPrimary}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.lg },
  lineHeight: { lineHeight: 21 },
  header: { width: '100%', paddingTop: 64 },
  cover: { width: '100%', height: 260, backgroundColor: VERT[950] },
  coverFallback: {
    backgroundColor: DARK.bg,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: SPACING.xl,
  },
  coverContent: { position: 'absolute', left: SPACING.xl, right: SPACING.xl, bottom: SPACING.lg, gap: SPACING.xs },
  layout: { gap: SPACING.lg },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  main: { flex: 1.5, gap: SPACING.md },
  side: { flex: 1, gap: SPACING.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  facts: { gap: SPACING.sm },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: TINTS.forestGreenBg,
  },
  factValue: { alignItems: 'flex-end', gap: 2 },
  block: { gap: SPACING.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  gallery: { gap: SPACING.sm, paddingRight: SPACING.sm },
  galleryImage: { width: 200, height: 150 },
  contactList: { gap: SPACING.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  qrRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  qr: { width: 96, height: 96, backgroundColor: COLORS.pureWhite },
  qrText: { flex: 1, gap: SPACING.xs },
  seoRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
});

export const FarmBackButton = PressableScale;
