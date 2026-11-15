import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { exportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * FARMER — dossier d'exportation (EXP-02).
 *
 * `GET /exports/:id` renvoie le dossier, sa conformité documentaire et la
 * conversion de change. `canBeCertified` est calculé côté serveur : l'écran ne
 * le redevine pas. Sans taux daté et sourcé, la conversion reste `null` et le
 * message du serveur est repris tel quel.
 */

const STATUS_TONE = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  IN_CONTROL: 'warning',
  CERTIFIED: 'info',
  IN_TRANSIT: 'warning',
  DELIVERED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'error',
} as const;

export default function FarmerExportDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: queryKeys.exports.one(id ?? ''),
    queryFn: () => exportApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const detail = query.data;
  const order = detail?.exportOrder;

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={order?.reference ?? '—'} subtitle={t('ui.dossierDExportation')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.exportation')} icon="boat-outline">
          {query.isLoading ? (
            <LoadingState count={1} height={120} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !detail || !order ? (
            <Text preset="body">{t('ui.dossierDExportationIntrouvable')}</Text>
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.reference')}</Text>
                  <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>
                    {order.reference}
                  </Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.statut')}</Text>
                  <Chip label={order.status} tone={STATUS_TONE[order.status]} size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.destination')}</Text>
                  <Text preset="bodySm">{order.destinationCountry}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.incoterm')}</Text>
                  <Text preset="bodySm">{order.incoterm ?? t('ui.nonPrecise')}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.creeLe')}</Text>
                  <Text preset="bodySm">{formatDate(order.createdAt, locale)}</Text>
                </View>
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>{t('ui.conformiteDocumentaire')}</Text>
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
                    ? t('ui.lesQuatrePiecesObligatoiresSontPresentes')
                    : t('ui.certificationImpossibleTantQueManqueNt_d2a08', { value: detail.compliance.missing.join(', ') })}
                </Text>
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>{t('ui.montantEtChange')}</Text>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.montant')}</Text>
                  <Text preset="bodySm">
                    {detail.finance.totalAmount !== null
                      ? `${detail.finance.totalAmount} ${detail.finance.currency}`
                      : t('ui.nonRenseigne')}
                  </Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.conversion')}</Text>
                  <Text preset="bodySm">
                    {detail.finance.conversion.amount !== null
                      ? String(detail.finance.conversion.amount)
                      : t('ui.nonConverti')}
                  </Text>
                </View>
                {/* Aucune conversion n'est inventée : le message du serveur est repris. */}
                {detail.finance.conversion.error ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {detail.finance.conversion.error}
                  </Text>
                ) : null}
              </Card>

              <Button
                label={
                  order.documents.length > 0
                    ? t('ui.documentsDuDossier_26c4f', { length: order.documents.length })
                    : t('ui.documentsDuDossier')
                }
                variant="outline"
                onPress={() => router.push(`/farmer/export/${order.id}/documents`)}
              />
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
  field: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  lineHeight: { lineHeight: 18 },
});
