import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { cooperativeApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const MEMBER_TONES: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  INVITED: 'warning',
  REMOVED: 'neutral',
  LEFT: 'neutral',
};

/** Coopérative : identité, membres et consentement enregistré. */
export default function Cooperatives() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const current = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    enabled: isAuthenticated,
    /** 404 = organisation sans coopérative : état vide, pas une erreur à retenter. */
    retry: false,
  });

  const cooperativeId = current.data?.id ?? null;

  const members = useQuery({
    queryKey: queryKeys.cooperatives.members(cooperativeId ?? 'none'),
    queryFn: () => cooperativeApi.members(cooperativeId as string, { limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
  });

  const overview = useQuery({
    queryKey: queryKeys.cooperatives.overview(cooperativeId ?? 'none'),
    queryFn: () => cooperativeApi.overview(cooperativeId as string).then((result) => result.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
  });

  const rows = members.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Coopérative" subtitle="Identité, membres et agrégation des volumes." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous avec un compte coopérative pour gérer vos membres et vos offres groupées."
          icon="people-outline"
        >
          {current.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : current.isError || !current.data ? (
            <EmptyState
              title="Aucune coopérative"
              description="Votre organisation n'a pas encore de fiche coopérative. Créez-la depuis l'espace organisation pour fédérer vos membres."
              icon="people-outline"
              action={{ label: 'Espace organisation', onPress: () => undefined }}
            />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.head}>
                  <View style={styles.icon}>
                    <Ionicons name="people-outline" size={17} color={COLORS.forestGreen} />
                  </View>
                  <View style={styles.headText}>
                    <Text preset="h2" color={COLORS.textPrimary}>
                      {current.data.organization?.name ?? 'Coopérative'}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {current.data.organization?.countryCode ?? '—'}
                      {current.data.province ? ` · ${current.data.province}` : ''}
                      {current.data.territory ? ` · ${current.data.territory}` : ''}
                      {current.data.foundedYear ? ` · fondée en ${current.data.foundedYear}` : ''}
                    </Text>
                  </View>
                </View>

                {current.data.legalStatus ? <Chip label={current.data.legalStatus} tone="neutral" size="sm" /> : null}

                {current.data.description ? (
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {current.data.description}
                  </Text>
                ) : null}

                {overview.data ? (
                  <View style={styles.facts}>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Membres
                      </Text>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {formatNumber(Number(overview.data.members?.total ?? 0), locale)}
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Actifs
                      </Text>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {formatNumber(Number(overview.data.members?.active ?? 0), locale)}
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        En attente
                      </Text>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {formatNumber(Number(overview.data.members?.pending ?? 0), locale)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Card>

              <Text preset="overline" color={COLORS.forestGreen}>
                Membres
              </Text>

              {members.isLoading ? (
                <LoadingState count={2} height={80} />
              ) : members.isError ? (
                <ErrorState error={members.error} onRetry={() => void members.refetch()} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Aucun membre"
                  description="Invitez vos producteurs : chaque adhésion enregistre le consentement et sa date."
                  icon="person-add-outline"
                />
              ) : (
                <View style={styles.list}>
                  {rows.map((member, index) => (
                    <Reveal key={member.id} index={index} variant="up">
                      <Card tone="white" style={styles.memberCard}>
                        <View style={styles.memberBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {member.user ? `${member.user.firstName} ${member.user.lastName}` : member.memberUserId}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {member.joinedAt ? `adhésion ${formatDate(member.joinedAt, locale)}` : 'adhésion en attente'}
                            {member.consentRecordedAt ? ` · consentement ${formatDate(member.consentRecordedAt, locale)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.memberAside}>
                          <Chip label={member.status} tone={MEMBER_TONES[member.status] ?? 'neutral'} size="sm" />
                          {member.consentScopes.length > 0 ? (
                            <ChipRow>
                              {member.consentScopes.slice(0, 3).map((scope) => (
                                <Chip key={scope} label={scope} tone="neutral" size="sm" />
                              ))}
                            </ChipRow>
                          ) : null}
                        </View>
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}

              <Card tone="pale" style={styles.note}>
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  L’agrégation de volumes (offre groupée) calcule un aperçu avant toute création : aucun volume
                  n’est additionné sans l’accord enregistré du membre concerné.
                </Text>
                <Button label="Voir les offres groupées" onPress={() => undefined} variant="outline" size="sm" icon="layers-outline" />
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
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 110, gap: 2 },
  list: { gap: SPACING.sm },
  memberCard: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  memberBody: { flex: 1, gap: 2 },
  memberAside: { alignItems: 'flex-end', gap: 4 },
  note: { gap: SPACING.sm },
});
