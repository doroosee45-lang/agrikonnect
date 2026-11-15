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
  const { t } = useI18n();
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
      <PageHeader index="09" eyebrow={t('ui.annonce')} title={listing?.title ?? t('ui.detailDeLAnnonce')} subtitle={t('ui.coordonneesDuVendeurMasqueesLaMise')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.annonce')} icon="megaphone-outline">
          {query.isLoading ? <LoadingState count={1} height={150} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !listing ? <Text preset="body">{t('ui.annonceIntrouvable')}</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={listing.type} tone={listing.type === 'OFFER' ? 'success' : 'info'} size="sm" />
                  <Chip label={listing.status} tone="neutral" size="sm" />
                </View>
                {listing.description ? <Text preset="bodySm">{listing.description}</Text> : null}
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.quantite_07cfb', { quantity: listing.quantity, unit: listing.unit })}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.qualite_4b0c0')}{' '}{listing.quality ?? t('ui.nonRenseignee')}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.prixIndicatif_02717')}{' '}{listing.indicativePrice !== null ? `${formatCurrency(listing.indicativePrice, listing.currency, locale)} / ${listing.unit}` : t('ui.surDemande')}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.localisation', { countryCode: listing.countryCode, value: listing.province ? ` · ${listing.province}` : '' })}</Text>
                {listing.certifications.length > 0 ? (
                  <View style={styles.chips}>
                    {listing.certifications.map((cert) => (
                      <Chip key={cert} label={cert} tone="neutral" size="sm" />
                    ))}
                  </View>
                ) : null}
                {listing.expiresAt ? <Text preset="caption" color={COLORS.slateGray}>{t('ui.expireLe_75f5d', { expiresAt: formatDate(listing.expiresAt, locale) })}</Text> : null}
              </Card>
              <Card tone="white">
                <View style={styles.form}>
                  <Text preset="h3">{t('ui.demanderUnContact')}</Text>
                  <Input label={t('ui.message')} value={message} onChangeText={setMessage} multiline placeholder={t('ui.precisezVotreBesoin')} />
                  {error ? <ErrorState error={error} /> : null}
                  {sent ? <Text preset="bodySm" color={COLORS.success}>{t('ui.demandeEnvoyeeLeVendeurVousRepondra')}</Text> : null}
                  <Button label={t('ui.envoyerLaDemande')} variant="primary" onPress={() => contact.mutate()} loading={contact.isPending} disabled={sent} />
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
