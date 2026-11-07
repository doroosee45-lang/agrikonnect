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
  ProvenanceTag,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Profil connecté : identité, complétude réelle, organisations, sécurité. */
export default function Profil() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const logout = useAuthStore((state) => state.logout);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const permissions = useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => authApi.permissions().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const mfa = useQuery({
    queryKey: ['auth', 'mfa', 'status'],
    queryFn: () => authApi.mfaStatus().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const user = me.data?.user;
  const completeness = me.data?.completeness;

  return (
    <PublicShell active="profil" heroCarousel={false}>
      <PageHeader
        index={1}
        eyebrow="Compte"
        title="Mon profil"
        subtitle="Identité, complétude du dossier, organisations et sécurité. Les informations affichées proviennent de votre espace, pas d’une estimation."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connectez-vous pour voir votre profil"
          description="Votre profil regroupe votre identité, l’état de vérification de vos contacts et l’avancement de votre dossier."
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
                        label={user.emailVerified ? 'E-mail vérifié' : 'E-mail non vérifié'}
                        tone={user.emailVerified ? 'success' : 'warning'}
                        size="sm"
                        icon={user.emailVerified ? 'checkmark-circle' : 'alert-circle'}
                      />
                      <Chip
                        label={user.phoneVerified ? 'Téléphone vérifié' : 'Téléphone non vérifié'}
                        tone={user.phoneVerified ? 'success' : 'warning'}
                        size="sm"
                        icon={user.phoneVerified ? 'checkmark-circle' : 'alert-circle'}
                      />
                    </View>
                    <Text preset="caption" color={DARK.textFaint}>
                      {user.email ?? 'Aucun e-mail'} · {user.phone ?? 'Aucun téléphone'}
                    </Text>
                  </View>
                </Card>

                {completeness ? (
                  <Card tone="white" style={styles.completeness}>
                    <View style={styles.completenessHeader}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        Complétude du dossier
                      </Text>
                      <Text preset="numeric" color={COLORS.forestGreen} style={styles.percent}>
                        {completeness.percent} %
                      </Text>
                    </View>

                    <Progress value={completeness.percent} />

                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      {completeness.done} critères sur {completeness.total} remplis. Ce pourcentage est
                      indicatif : il mesure le remplissage, pas la fiabilité.
                    </Text>

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
                      { label: 'Exploitations', value: me.data.counts.farms, icon: 'home-outline' as const },
                      { label: 'Parcelles', value: me.data.counts.plots, icon: 'map-outline' as const },
                      { label: 'Productions', value: me.data.counts.productions, icon: 'leaf-outline' as const },
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
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Organisations
                  </Text>
                  {user.organizations.length === 0 ? (
                    <Text preset="bodySm" color={COLORS.slateGray}>
                      Aucune organisation rattachée.
                    </Text>
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

                <Card tone="white" style={styles.sideCard}>
                  <Text preset="overline" color={COLORS.livingGreen}>
                    Sécurité
                  </Text>
                  <View style={styles.securityRow}>
                    <Ionicons
                      name={mfa.data?.enabled ? 'shield-checkmark' : 'shield-outline'}
                      size={16}
                      color={mfa.data?.enabled ? COLORS.success : COLORS.warning}
                    />
                    <View style={styles.securityBody}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        Double authentification
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {mfa.isLoading
                          ? 'Vérification…'
                          : mfa.data?.enabled
                            ? `Activée (${mfa.data.method ?? 'TOTP'})`
                            : 'Désactivée — recommandée pour les comptes qui publient.'}
                      </Text>
                    </View>
                  </View>
                  <ProvenanceTag kind="verified" label="Session gérée par jeton rotatif (≤ 15 min)" />
                </Card>

                {permissions.data ? (
                  <Card tone="white" style={styles.sideCard}>
                    <Text preset="overline" color={COLORS.livingGreen}>
                      Permissions effectives
                    </Text>
                    <View style={styles.permissionList}>
                      {permissions.data.roles.map((role) => (
                        <Chip key={role} label={role} tone="forest" size="sm" />
                      ))}
                    </View>
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      {permissions.data.permissions.length} permissions accordées sur ce rôle.
                    </Text>
                  </Card>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    label={t('farmer.title')}
                    onPress={() => router.push('/farmer')}
                    variant="primary"
                    icon="leaf"
                    fullWidth
                  />
                  <Button
                    label={t('auth.logout')}
                    onPress={() => void logout()}
                    variant="outline"
                    icon="log-out-outline"
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
  securityRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  securityBody: { flex: 1, gap: 1 },
  permissionList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  actions: { gap: SPACING.sm },
});
