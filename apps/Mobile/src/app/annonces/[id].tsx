import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  Input,
  LoadingState,
  ProvenanceTag,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { listingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Fiche annonce : détails, certifications, contact via messagerie, statut. */
export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [contacting, setContacting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const listing = useQuery({
    queryKey: queryKeys.listings.one(id),
    queryFn: () => listingApi.get(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const contact = useMutation({
    mutationFn: () => listingApi.contact(id, message.trim() || undefined),
    onSuccess: (result) => {
      setContacting(false);
      setError(null);
      setNotice('Conversation ouverte. Les coordonnées du vendeur ne sont jamais transmises.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      if (result.data?.id) router.push(`/messages/${result.data.id}` as never);
    },
    onError: (caught) => setError(caught),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => listingApi.setStatus(id, status),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
    },
    onError: (caught) => setError(caught),
  });

  const data = listing.data;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={data?.title ?? 'Annonce'} subtitle={data ? `${data.countryCode}${data.province ? ` · ${data.province}` : ''}` : undefined} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour consulter le détail d'une annonce et contacter son auteur."
          icon="storefront-outline"
        >
          {listing.isLoading ? (
            <LoadingState count={2} height={140} />
          ) : listing.isError || !data ? (
            <ErrorState error={listing.error} onRetry={() => void listing.refetch()} />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={data.type} tone="forest" size="sm" />
                  <Chip label={data.status} tone="neutral" size="sm" />
                  <ProvenanceTag kind={data.source === 'declared' ? 'declared' : 'measured'} />
                </View>

                <Text preset="h2" color={COLORS.textPrimary}>
                  {data.title}
                </Text>
                {data.description ? (
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {data.description}
                  </Text>
                ) : null}

                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Volume
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {formatNumber(data.quantity, locale, 1)} {data.unit}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Prix indicatif
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.indicativePrice !== null ? formatCurrency(data.indicativePrice, data.currency, locale) : 'non communiqué'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Qualité
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.quality ?? 'non précisée'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Disponibilité
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.availableFrom ? formatDate(data.availableFrom, locale) : '—'}
                      {data.availableTo ? ` → ${formatDate(data.availableTo, locale)}` : ''}
                    </Text>
                  </View>
                </View>

                {data.certifications.length > 0 ? (
                  <View style={styles.block}>
                    <Text preset="caption" color={COLORS.textPrimary}>
                      Certifications déclarées
                    </Text>
                    <ChipRow>
                      {data.certifications.map((certification) => (
                        <Chip key={certification} label={certification} tone="success" size="sm" />
                      ))}
                    </ChipRow>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Déclarées par le vendeur. Une certification n’est affichée comme vérifiée qu’après contrôle
                      documentaire.
                    </Text>
                  </View>
                ) : null}

                {data.conditions ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Conditions : {data.conditions}
                  </Text>
                ) : null}

                <Text preset="caption" color={COLORS.slateGray}>
                  Publiée le {formatDate(data.createdAt, locale)} · mise à jour {formatDate(data.updatedAt, locale)} · version {data.version}
                  {data.expiresAt ? ` · expire le ${formatDate(data.expiresAt, locale)}` : ''}
                </Text>
              </Card>

              {notice ? (
                <Card tone="pale" style={styles.notice}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
                  <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                    {notice}
                  </Text>
                </Card>
              ) : null}

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Contacter l’auteur
                </Text>
                {contacting ? (
                  <>
                    <TextArea
                      label="Message"
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Bonjour, je suis intéressé par ce volume…"
                      minHeight={90}
                      optionalLabel="facultatif"
                    />
                    {error ? <ErrorState error={error} showRequestId /> : null}
                    <View style={styles.actions}>
                      <Button label="Ouvrir la conversation" onPress={() => contact.mutate()} variant="primary" size="sm" loading={contact.isPending} icon="chatbubble-outline" />
                      <Button label="Annuler" onPress={() => setContacting(false)} variant="ghost" size="sm" />
                    </View>
                  </>
                ) : (
                  <>
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      Aucune coordonnée n’est échangée : la discussion passe par la messagerie de la plateforme et
                      reste rattachée à cette annonce.
                    </Text>
                    <Button label="Contacter" onPress={() => setContacting(true)} variant="outline" size="sm" icon="chatbubble-outline" />
                  </>
                )}
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Statut (votre annonce)
                </Text>
                {error ? <ErrorState error={error} showRequestId /> : null}
                <View style={styles.actions}>
                  {['DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD', 'EXPIRED'].map((status) => (
                    <Button
                      key={status}
                      label={status}
                      onPress={() => setStatus.mutate(status)}
                      variant={data.status === status ? 'primary' : 'outline'}
                      size="sm"
                      loading={setStatus.isPending && setStatus.variables === status}
                    />
                  ))}
                </View>
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  Chaque changement de statut est journalisé et notifié aux interlocuteurs concernés.
                </Text>
              </Card>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 140, gap: 2 },
  block: { gap: SPACING.sm },
  notice: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
