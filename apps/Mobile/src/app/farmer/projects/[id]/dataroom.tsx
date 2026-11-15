import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectDataApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerProjectDataRoom() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.projects.one(id ?? ''), 'dataroom'] as unknown[],
    queryFn: () => projectDataApi.documents(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.dataRoom')} subtitle={t('ui.documentsPartagesAvecLesInvestisseurs')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.dataRoom')} icon="folder-open-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title={t('ui.dataRoomVide')} description={t('ui.ajoutezDesDocumentsPourLesPartager')} icon="folder-open-outline" /> : (
            <View style={styles.list}>
              {items.map((document, index) => {
                const doc = document as Record<string, unknown>;
                const label = String(doc.name ?? doc.kind ?? t('ui.document'));
                const kind = String(doc.kind ?? '—');
                const createdAt = typeof doc.createdAt === 'string' ? doc.createdAt : null;
                return (
                  <Reveal key={String(doc.id ?? index)} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodySm">{label}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{createdAt ? formatDate(createdAt, locale) : t('ui.dateInconnue')}</Text>
                      </View>
                      <Chip label={kind} tone="neutral" size="sm" />
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
