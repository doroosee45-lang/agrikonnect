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
  ErrorState,
  LoadingState,
  Progress,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { getUserProfileRoute, getUserSettingsRoute, resolveActiveContext } from '@/lib/redirects';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Profil connecté : identité, complétude réelle, organisations, sécurité. */
export default function Profil() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const authUser = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const roles = resolveActiveContext(authUser).roles;
  const profileRoute = getUserProfileRoute(roles);
  const settingsRoute = getUserSettingsRoute(roles, permissions);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const user = me.data?.user;
  const completeness = me.data?.completeness;

  return (
    <PublicShell active="profil" heroCarousel={false}>
      <PageHeader
        index={1}
        eyebrow={t('ui.compte')}
        title={t('ui.monProfil')}
        subtitle={t('ui.identiteCompletudeDuDossierOrganisationsEt')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connectezVousPourVoirVotreProfil')}
          description={t('ui.votreProfilRegroupeVotreIdentiteL')}
          icon="person-outline"
        >
          {me.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : me.isError ? (
            <ErrorState error={me.error} onRetry={() => void me.refetch()} />
          ) : user ? (
            <View style={[styles.layout, wide ? styles.layoutWide : null]}>
              <Reveal variant="left" style={styles.mainColumn}>
                <Card tone="ink" style={styles.identity}>
                  <View style={styles.avatar}>
                    <Text preset="h2" color={COLORS.forestGreen}>
                      {`${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.identityBody}>
                    <Text preset="display" color={DARK.text}>
                      {user.firstName} {user.lastName}
                    </Text>
                    <View style={styles.identityMeta}>
                      <Chip label={user.countryCode} tone="neutral" size="sm" icon="globe-outline" />
                      <Chip
                        label={user.emailVerified ? t('ui.eMailVerifie_aa657') : t('ui.eMailNonVerifie')}
                        tone={user.emailVerified ? 'success' : 'warning'}
                        size="sm"
                        icon={user.emailVerified ? 'checkmark-circle' : 'alert-circle'}
                      />
                      <Chip
                        label={user.phoneVerified ? t('ui.telephoneVerifie_8a357') : t('ui.telephoneNonVerifie_f890f')}
                        tone={user.phoneVerified ? 'success' : 'warning'}
                        size="sm"
                        icon={user.phoneVerified ? 'checkmark-circle' : 'alert-circle'}
                      />
                    </View>
                    <Text preset="caption" color={DARK.textFaint}>
                      {user.email ?? t('ui.aucunEMail')} · {user.phone ?? t('ui.aucunTelephone')}
                    </Text>
                  </View>
                </Card>

                {completeness ? (
                  <Card tone="white" style={styles.completeness}>
                    <View style={styles.completenessHeader}>
                      <Text preset="h3" color={COLORS.textPrimary}>{t('ui.completudeDuDossier')}</Text>
                      <Text preset="numeric" color={COLORS.forestGreen} style={styles.percent}>
                        {completeness.percent} %
                      </Text>
                    </View>

                    <Progress value={completeness.percent} />

                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.criteresSurRemplisCePourcentageEst', { done: completeness.done, total: completeness.total })}</Text>

                    <View style={styles.criteria}>
                      {completeness.criteria.map((criterion) => (
                        <View key={criterion.key} style={styles.criterion}>
                          <Ionicons
                            name={criterion.done ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={criterion.done ? COLORS.success : COLORS.slateGray}
                          />
                          <Text preset="bodySm" color={criterion.done ? COLORS.textPrimary : COLORS.slateGray}>
                            {criterion.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : null}

                {me.data?.counts ? (
                  <Card tone="white" style={styles.counts}>
                    {[
                      { label: t('ui.exploitations'), value: me.data.counts.farms, icon: 'home-outline' as const },
                      { label: t('ui.parcelles'), value: me.data.counts.plots, icon: 'map-outline' as const },
                      { label: t('ui.productions'), value: me.data.counts.productions, icon: 'leaf-outline' as const },
                    ].map((item) => (
                      <View key={item.label} style={styles.countItem}>
                        <Ionicons name={item.icon} size={16} color={COLORS.livingGreen} />
                        <Text preset="numeric" color={COLORS.textPrimary} style={styles.countValue}>
                          {item.value}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </Card>
                ) : null}
              </Reveal>

              <Reveal index={1} variant="right" style={styles.sideColumn}>
                <Card tone="white" style={styles.sideCard}>
                  <Text preset="overline" color={COLORS.livingGreen}>{t('ui.organisations')}</Text>
                  {user.organizations.length === 0 ? (
                    <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.aucuneOrganisationRattachee')}</Text>
                  ) : (
                    user.organizations.map((organization) => (
                      <View key={organization.id} style={styles.orgRow}>
                        <View style={styles.orgBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {organization.name}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {organization.type}
                          </Text>
                        </View>
                        <View style={styles.orgRoles}>
                          {(organization.roles ?? []).map((role) => (
                            <Chip key={role} label={role} tone="forest" size="sm" />
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </Card>

                <View style={styles.actions}>
                  {profileRoute !== '/profil' ? (
                    <Button
                      label={t('ui.monProfil')}
                      onPress={() => router.push(profileRoute as never)}
                      variant="primary"
                      icon="person-outline"
                      fullWidth
                    />
                  ) : null}
                  {roles.some((role) => ['COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY'].includes(role)) ? (
                    <Button
                      label={t('ui.profilOrganisation')}
                      onPress={() => router.push('/organization/profile')}
                      variant="outline"
                      icon="business-outline"
                      fullWidth
                    />
                  ) : null}
                  <Button
                    label={t('ui.parametres_ef8f0')}
                    onPress={() => router.push(settingsRoute as never)}
                    variant="outline"
                    icon="settings-outline"
                    fullWidth
                  />
                </View>
              </Reveal>
            </View>
          ) : null}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56 },
  lineHeight: { lineHeight: 19 },
  layout: { gap: SPACING.md },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1.4, gap: SPACING.md },
  sideColumn: { flex: 1, gap: SPACING.md },
  identity: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'center' },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: RADIUS.lg,
    backgroundColor: TINTS.livingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBody: { flex: 1, gap: SPACING.xs },
  identityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  completeness: { gap: SPACING.md },
  completenessHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  percent: { fontSize: 24, lineHeight: 28 },
  track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: TINTS.forestGreenBg, overflow: 'hidden' },
  fill: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.livingGreen },
  criteria: { gap: SPACING.sm },
  criterion: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  counts: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  countItem: { alignItems: 'center', gap: 2, flex: 1 },
  countValue: { fontSize: 24, lineHeight: 28 },
  sideCard: { gap: SPACING.sm },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  orgBody: { flex: 1, gap: 1 },
  orgRoles: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  actions: { gap: SPACING.sm },
});
