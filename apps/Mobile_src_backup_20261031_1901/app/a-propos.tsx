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

const PRINCIPLES = [
  {
    icon: 'finger-print-outline' as const,
    title: 'Une donnée, une origine',
    body: 'Mesure, capteur, satellite ou déclaration : la provenance est affichée avec la valeur. Une donnée absente reste absente.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Déclaré n’est pas vérifié',
    body: 'Les deux statuts sont distincts et visibles partout, y compris sur les fiches publiques et dans les exports.',
  },
  {
    icon: 'eye-off-outline' as const,
    title: 'La confidentialité par défaut',
    body: 'Coordonnées masquées, positions arrondies, statistiques soumises au k-anonymat, contacts transmis sans révélation.',
  },
  {
    icon: 'information-circle-outline' as const,
    title: 'L’aide à la décision reste une aide',
    body: 'Les sorties du moteur géospatial affichent leurs sources, leurs avertissements et ne déclenchent aucune action automatique.',
  },
];

export default function APropos() {
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
        eyebrow="À propos"
        title="Une infrastructure de confiance"
        subtitle="AGRIKONNECT AFRICA relie producteurs, coopératives, acheteurs et investisseurs autour de données agricoles vérifiables — et assume publiquement les limites de ce qu’elle publie."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.mission}>
            <Text preset="overline" color={COLORS.livingGreen}>
              Notre conviction
            </Text>
            <Text preset="display" color={COLORS.textPrimary} style={styles.missionTitle}>
              La valeur d’une filière se prouve, elle ne se déclare pas.
            </Text>
            <Text preset="lead" color={COLORS.slateGray} style={styles.lineHeight}>
              Sur les marchés agricoles africains, l’information circule mal : surfaces approximatives, prix
              sans source, origines invérifiables. Chaque acteur paie cette opacité. Notre réponse n’est pas
              d’ajouter des promesses, mais de rendre chaque information traçable jusqu’à son origine — et
              de dire clairement quand elle manque.
            </Text>
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
        eyebrow="Périmètre"
        title="Ce que la plateforme couvre"
        subtitle="Cinq versions fonctionnelles livrées, de la parcelle à l’appel d’offres international."
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
        eyebrow="Gouvernance"
        title="Qui peut faire quoi"
        subtitle="Les rôles opérationnels s’obtiennent en libre-service. Les rôles de contrôle sont attribués — jamais auto-déclarés."
        background={COLORS.naturalWhite}
      >
        <View style={[styles.roles, wide ? styles.rolesWide : null]}>
          <Card tone="ink" style={styles.roleCard}>
            <Text preset="overline" color={COLORS.gold}>
              Libre-service
            </Text>
            <Text preset="bodySm" color={DARK.textMuted} style={styles.lineHeight}>
              Producteur, coopérative, société agricole, acheteur, fournisseur, transporteur, agronome,
              investisseur, agent d’appui.
            </Text>
            <Button
              label="Créer un compte"
              onPress={() => router.push('/auth/register')}
              variant="gold"
              size="sm"
            />
          </Card>

          <Card tone="white" style={styles.roleCard}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Attribués par un administrateur
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Administrateur, modérateur, vérificateur, partenaire laboratoire, client API. Ces rôles
              donnent accès à des données sensibles : ils ne sont jamais accordés à l’inscription.
            </Text>
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
