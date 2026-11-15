import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { exportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * FARMER — pièces d'un dossier d'exportation.
 *
 * Les documents viennent du dossier (`GET /exports/:id` → `exportOrder.documents`),
 * pas des données d'un projet. La pièce n'a pas de statut propre : la conformité
 * est calculée côté serveur à partir des quatre `type` obligatoires.
 */
export default function FarmerExportDocuments() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.exports.one(id ?? ''),
    queryFn: () => exportApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const detail = query.data;
  const items = detail?.exportOrder.documents ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.documents')} subtitle={t('ui.piecesRattacheesACeDossier')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.documents')} icon="document-attach-outline">
          {query.isLoading ? (
            <LoadingState count={2} height={80} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !detail ? (
            <EmptyState
              title={t('ui.dossierIntrouvable')}
              description={t('ui.ceDossierDExportationNExiste')}
              icon="document-attach-outline"
            />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>{t('ui.piecesObligatoires')}</Text>
                {detail.compliance.required.map((item) => (
                  <View key={item.type} style={styles.row}>
                    <Text preset="bodySm" color={COLORS.textPrimary} style={{ flex: 1 }}>
                      {item.label}
                    </Text>
                    <Chip
                      label={item.present ? t('ui.present') : t('ui.manquant')}
                      tone={item.present ? 'success' : 'error'}
                      size="sm"
                    />
                  </View>
                ))}
                <Text
                  preset="caption"
                  color={detail.compliance.canBeCertified ? COLORS.success : COLORS.warning}
                  style={styles.lineHeight}
                >
                  {detail.compliance.canBeCertified
                    ? t('ui.dossierCompletLaCertificationEstPossible')
                    : t('ui.certificationImpossibleTantQueManqueNt_64668', { value: detail.compliance.missing.join(', ') })}
                </Text>
              </Card>

              {items.length === 0 ? (
                <EmptyState
                  title={t('ui.aucunDocument')}
                  description={t('ui.aucunePieceNEstRattacheeA_d7a45')}
                  icon="document-attach-outline"
                />
              ) : (
                <View style={styles.list}>
                  {items.map((document, index) => (
                    <Reveal key={document.id} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium">{document.name}</Text>
                          <Text preset="caption" color={COLORS.slateGray}>{t('ui.emisLe_b72c7', { type: document.type, issuedAt: formatDate(document.issuedAt, locale) })}{document.storageKey ? '' : t('ui.referenceSeule_68856')}
                          </Text>
                        </View>
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.sm },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  lineHeight: { lineHeight: 18 },
});
