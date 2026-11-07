import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, ErrorState, LoadingState, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';

/** PUB-02 — fiche publique d'exploitation : coordonnées masquées par défaut. */
export default function PublicSiteProducteurDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useQuery({
    queryKey: queryKeys.public.farm(slug ?? ''),
    queryFn: () => publicApi.farm(slug ?? '').then((r) => r.data),
    retry: false,
  });
  const farm = query.data?.farm;
  return (
    <PublicShell active="producteurs">
      <PageHeader index="02" eyebrow="Producteur" title={farm?.name ?? 'Fiche producteur'} subtitle="Informations publiées par le producteur." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={1} height={150} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !farm ? <Text preset="body">Producteur introuvable.</Text> : (
          <Reveal index={0} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="h2">{farm.name}</Text>
              <View style={styles.chips}>
                <Chip label={farm.countryCode} tone="neutral" size="sm" />
                {farm.verification?.label ? <Chip label={farm.verification.label} tone={farm.verification.status === 'VERIFIED' ? 'success' : 'neutral'} size="sm" /> : null}
              </View>
              {farm.description ? <Text preset="bodySm">{farm.description}</Text> : null}
              <Text preset="bodySm" color={COLORS.slateGray}>Surface : {farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : 'non renseignée'}</Text>
              <Text preset="bodySm" color={COLORS.slateGray}>Parcelles publiées : {farm.plotsCount}</Text>
              {farm.crops.length > 0 ? (
                <View style={styles.chips}>
                  {farm.crops.map((crop) => (
                    <Chip key={crop.slug} label={crop.name || crop.slug} tone="neutral" size="sm" />
                  ))}
                </View>
              ) : null}
              <Card tone="pale">
                <Text preset="caption" color={COLORS.slateGray}>
                  Contact : {farm.contact?.masked ?? 'non publié'}
                  {farm.contact?.requestAvailable ? ' — une demande de mise en relation est possible.' : ''}
                </Text>
              </Card>
            </Card>
          </Reveal>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' } });
