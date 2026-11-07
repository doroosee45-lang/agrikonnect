import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Card, Chip, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { listingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteAnnonceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: queryKeys.listings.one(id ?? ''),
    queryFn: () => listingApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const contact = useMutation({
    mutationFn: () => listingApi.contact(id ?? '', message.trim() || undefined),
    onSuccess: () => { setSent(true); setError(null); },
    onError: (caught) => setError(caught),
  });

  const listing = query.data;
  return (
    <PublicShell active="annonces">
      <PageHeader index="09" eyebrow="Annonce" title={listing?.title ?? 'Détail de l\u2019annonce'} subtitle="Coordonnées du vendeur masquées : la mise en relation est tracée." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Annonce" icon="megaphone-outline">
          {query.isLoading ? <LoadingState count={1} height={150} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !listing ? <Text preset="body">Annonce introuvable.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={listing.type} tone={listing.type === 'OFFER' ? 'success' : 'info'} size="sm" />
                  <Chip label={listing.status} tone="neutral" size="sm" />
                </View>
                {listing.description ? <Text preset="bodySm">{listing.description}</Text> : null}
                <Text preset="bodySm" color={COLORS.slateGray}>Quantité : {listing.quantity} {listing.unit}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>Qualité : {listing.quality ?? 'non renseignée'}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>
                  Prix indicatif : {listing.indicativePrice !== null ? `${formatCurrency(listing.indicativePrice, listing.currency, locale)} / ${listing.unit}` : 'sur demande'}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray}>
                  Localisation : {listing.countryCode}{listing.province ? ` · ${listing.province}` : ''}
                </Text>
                {listing.certifications.length > 0 ? (
                  <View style={styles.chips}>
                    {listing.certifications.map((cert) => (
                      <Chip key={cert} label={cert} tone="neutral" size="sm" />
                    ))}
                  </View>
                ) : null}
                {listing.expiresAt ? <Text preset="caption" color={COLORS.slateGray}>Expire le {formatDate(listing.expiresAt, locale)}</Text> : null}
              </Card>
              <Card tone="white">
                <View style={styles.form}>
                  <Text preset="h3">Demander un contact</Text>
                  <Input label="Message" value={message} onChangeText={setMessage} multiline placeholder="Précisez votre besoin…" />
                  {error ? <ErrorState error={error} /> : null}
                  {sent ? <Text preset="bodySm" color={COLORS.success}>Demande envoyée. Le vendeur vous répondra via la messagerie.</Text> : null}
                  <Button label="Envoyer la demande" variant="primary" onPress={() => contact.mutate()} loading={contact.isPending} disabled={sent} />
                </View>
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, form: { gap: SPACING.md } });
