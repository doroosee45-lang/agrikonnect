import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { ContactCta } from '@/components/public-site/home/ClosingSections';
import { StatsBand } from '@/components/public-site/home/TrustAndStats';
import { Button, Card, Chip, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { usePublicFarms, usePublicMap, useSoilStats } from '@/hooks/usePublicData';
import { useMemo } from 'react';
import { useI18n, tr } from '@/i18n';

const PRINCIPLES = [
  {
    icon: 'finger-print-outline' as const,
    get title() { return tr('ui.uneDonneeUneOrigine'); },
    get body() { return tr('ui.mesureCapteurSatelliteOuDeclarationLa_72d2f'); },
  },
  {
    icon: 'shield-checkmark-outline' as const,
    get title() { return tr('ui.declareNEstPasVerifie'); },
    get body() { return tr('ui.lesDeuxStatutsSontDistinctsEt'); },
  },
  {
    icon: 'eye-off-outline' as const,
    get title() { return tr('ui.laConfidentialiteParDefaut'); },
    get body() { return tr('ui.coordonneesMasqueesPositionsArrondiesStatistique'); },
  },
  {
    icon: 'information-circle-outline' as const,
    get title() { return tr('ui.lAideALaDecisionReste'); },
    get body() { return tr('ui.lesSortiesDuMoteurGeospatialAffichent'); },
  },
];

export default function APropos() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const farms = usePublicFarms({ limit: 1 });
  const map = usePublicMap({ limit: 500 });
  const soil = useSoilStats();

  const stats = useMemo(() => {
    const features = map.data?.features ?? [];
    return {
      farms: farms.data?.meta?.total ?? null,
      located: map.data?.meta.count ?? null,
      soilAssessments: soil.data
        ? soil.data.rows.reduce((total, row) => total + row.assessments, 0)
        : null,
      countries: map.data ? new Set(features.map((f) => f.properties.countryCode)).size : null,
      loading: farms.isLoading || map.isLoading || soil.isLoading,
    };
  }, [farms.data, farms.isLoading, map.data, map.isLoading, soil.data, soil.isLoading]);

  return (
    <PublicShell active="a-propos">
      <PageHeader
        index={1}
        eyebrow={t('ui.aPropos')}
        title={t('ui.uneInfrastructureDeConfiance')}
        subtitle={t('ui.agrikonnectAfricaRelieProducteursCooperativesAch')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.mission}>
            <Text preset="overline" color={COLORS.livingGreen}>{t('ui.notreConviction_16469')}</Text>
            <Text preset="display" color={COLORS.textPrimary} style={styles.missionTitle}>{t('ui.laValeurDUneFiliereSe')}</Text>
            <Text preset="lead" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.surLesMarchesAgricolesAfricainsL')}</Text>
          </Card>
        </Reveal>

        <View style={[styles.principles, wide ? styles.principlesWide : null]}>
          {PRINCIPLES.map((principle, index) => (
            <Reveal key={principle.title} index={index} variant="up" style={styles.principleItem}>
              <Card tone="pale" style={styles.principleCard}>
                <View style={styles.principleIcon}>
                  <Ionicons name={principle.icon} size={18} color={COLORS.forestGreen} />
                </View>
                <Text preset="h3" color={COLORS.textPrimary}>
                  {principle.title}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                  {principle.body}
                </Text>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>

      <StatsBand stats={stats} />

      <Section
        index={2}
        eyebrow={t('ui.perimetre_b5d08')}
        title={t('ui.ceQueLaPlateformeCouvre')}
        subtitle={t('ui.cinqVersionsFonctionnellesLivreesDeLa')}
        background={COLORS.pureWhite}
      >
        <View style={styles.track}>
          {RELEASE_TRACK.map((release, index) => (
            <Reveal key={release.tag} index={index} variant="left">
              <View style={styles.trackRow}>
                <View style={styles.trackTag}>
                  <Text preset="overline" color={COLORS.gold}>
                    {release.tag}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {release.name}
                  </Text>
                </View>
                <Text preset="bodySm" color={COLORS.textPrimary} style={styles.trackBody}>
                  {release.body}
                </Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Section>

      <Section
        index={3}
        eyebrow={t('ui.gouvernance')}
        title={t('ui.quiPeutFaireQuoi')}
        subtitle={t('ui.lesRolesOperationnelsSObtiennentEn')}
        background={COLORS.naturalWhite}
      >
        <View style={[styles.roles, wide ? styles.rolesWide : null]}>
          <Card tone="ink" style={styles.roleCard}>
            <Text preset="overline" color={COLORS.gold}>{t('ui.libreService_c6f0e')}</Text>
            <Text preset="bodySm" color={DARK.textMuted} style={styles.lineHeight}>{t('ui.producteurCooperativeSocieteAgricoleAcheteurFour_c7950')}</Text>
            <Button
              label={t('ui.creerUnCompte')}
              onPress={() => router.push('/auth/register')}
              variant="gold"
              size="sm"
            />
          </Card>

          <Card tone="white" style={styles.roleCard}>
            <Text preset="overline" color={COLORS.forestGreen}>{t('ui.attribuesParUnAdministrateur_1517b')}</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.administrateurModerateurVerificateurPartenaireLa')}</Text>
            <View style={styles.chipRow}>
              <Chip label="ADMIN" tone="neutral" size="sm" />
              <Chip label="MODERATOR" tone="neutral" size="sm" />
              <Chip label="VERIFIER" tone="neutral" size="sm" />
              <Chip label="LAB_PARTNER" tone="neutral" size="sm" />
              <Chip label="API_CLIENT" tone="neutral" size="sm" />
            </View>
          </Card>
        </View>
      </Section>

      <ContactCta />
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 48, paddingBottom: 24, gap: SPACING.xl },
  lineHeight: { lineHeight: 22 },
  mission: { gap: SPACING.md },
  missionTitle: { maxWidth: 620 },
  principles: { gap: SPACING.md },
  principlesWide: { flexDirection: 'row', flexWrap: 'wrap' },
  principleItem: { flex: 1, minWidth: 250 },
  principleCard: { gap: SPACING.sm, height: '100%' },
  principleIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { gap: SPACING.lg },
  trackRow: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'flex-start' },
  trackTag: { width: 96, gap: 2 },
  trackBody: { flex: 1, lineHeight: 21 },
  roles: { gap: SPACING.md },
  rolesWide: { flexDirection: 'row' },
  roleCard: { gap: SPACING.md, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
});
