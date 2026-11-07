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
      <FarmerHeader title="Documents" subtitle="Pièces rattachées à ce dossier." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Documents" icon="document-attach-outline">
          {query.isLoading ? (
            <LoadingState count={2} height={80} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !detail ? (
            <EmptyState
              title="Dossier introuvable"
              description="Ce dossier d’exportation n’existe pas ou ne vous est pas accessible."
              icon="document-attach-outline"
            />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Pièces obligatoires
                </Text>
                {detail.compliance.required.map((item) => (
                  <View key={item.type} style={styles.row}>
                    <Text preset="bodySm" color={COLORS.textPrimary} style={{ flex: 1 }}>
                      {item.label}
                    </Text>
                    <Chip
                      label={item.present ? 'présent' : 'manquant'}
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
                    ? 'Dossier complet : la certification est possible.'
                    : `Certification impossible tant que ${detail.compliance.missing.join(', ')} manque(nt).`}
                </Text>
              </Card>

              {items.length === 0 ? (
                <EmptyState
                  title="Aucun document"
                  description="Aucune pièce n'est rattachée à ce dossier."
                  icon="document-attach-outline"
                />
              ) : (
                <View style={styles.list}>
                  {items.map((document, index) => (
                    <Reveal key={document.id} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium">{document.name}</Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {document.type} · émis le {formatDate(document.issuedAt, locale)}
                            {document.storageKey ? '' : ' · référence seule'}
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
