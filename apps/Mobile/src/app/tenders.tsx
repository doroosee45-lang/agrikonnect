import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { tenderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Appels d’offres : avis d’acheteurs, réponses tracées (espace authentifié). */
export default function Tenders() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const tenders = useQuery({
    queryKey: queryKeys.tenders.list({ limit: 20 }),
    queryFn: () => tenderApi.list({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = tenders.data ?? [];

  return (
    <PublicShell active="tenders">
      <PageHeader
        index={1}
        eyebrow={t('ui.international')}
        title={t('ui.appelsDOffres')}
        subtitle={t('ui.avisDAcheteursAvecVolumesExigences')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.lesAppelsDOffresSontReserves_90701')}
          description={t('ui.consulterUnAvisEtYRepondre')}
          icon="globe-outline"
        >
          {tenders.isLoading ? (
            <LoadingState count={3} height={150} />
          ) : tenders.isError ? (
            <ErrorState error={tenders.error} onRetry={() => void tenders.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucunAppelDOffresOuvert')}
              description={t('ui.lesAvisPubliesParLesAcheteurs')}
              icon="globe-outline"
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((tender, index) => (
                <Reveal key={tender.id} index={index % 2} variant="up" style={styles.item}>
                  <Card tone="white" style={styles.card}>
                    <View style={styles.header}>
                      <Chip
                        label={tender.status}
                        tone={tender.status === 'OPEN' ? 'success' : tender.status === 'AWARDED' ? 'info' : 'neutral'}
                        size="sm"
                      />
                      <Chip label={tender.destinationCountry} tone="forest" size="sm" icon="navigate-outline" />
                    </View>

                    <Text preset="h3" color={COLORS.textPrimary}>
                      {tender.title}
                    </Text>

                    {tender.description ? (
                      <Text preset="bodySm" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {tender.description}
                      </Text>
                    ) : null}

                    <View style={styles.facts}>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.volume')}</Text>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {formatNumber(tender.quantity, locale, 1)} {tender.unit}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.echeance')}</Text>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {tender.deadline ? formatDate(tender.deadline, locale) : t('ui.nonPrecisee_d47b0')}
                        </Text>
                      </View>
                      {tender.quality ? (
                        <View style={styles.fact}>
                          <Text preset="caption" color={COLORS.slateGray}>{t('ui.qualite')}</Text>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {tender.quality}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {tender.certifications.length > 0 ? (
                      <View style={styles.chips}>
                        {tender.certifications.map((certification) => (
                          <Chip key={certification} label={certification} tone="gold" size="sm" />
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.footer}>
                      <View style={styles.footerMeta}>
                        <Ionicons name="time-outline" size={13} color={COLORS.slateGray} />
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.publie_037d4', { createdAt: formatRelative(tender.createdAt, locale) })}</Text>
                      </View>
                      <Button
                        label={t('ui.repondre')}
                        variant="outline"
                        size="sm"
                        icon="send-outline"
                        onPress={() => router.push('/requests')}
                      />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56 },
  lineHeight: { lineHeight: 20 },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 320 },
  card: { gap: SPACING.sm, height: '100%' },
  header: { flexDirection: 'row', gap: SPACING.xs },
  facts: { flexDirection: 'row', gap: SPACING.lg, flexWrap: 'wrap' },
  fact: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: 'auto',
    paddingTop: SPACING.sm,
  },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
