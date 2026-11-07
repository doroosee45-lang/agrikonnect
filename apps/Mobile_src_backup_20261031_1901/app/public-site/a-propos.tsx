import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const PRINCIPLES = [
  { title: 'Mesuré ≠ déclaré', body: 'Une valeur mesurée porte ✔ ; une valeur déclarée ou estimée porte ≈ et n\u2019est jamais présentée comme vérifiée.' },
  { title: 'Aucune statistique inventée', body: 'Un indicateur non publiable reste vide. Il n\u2019est ni arrondi, ni complété, ni remplacé par zéro.' },
  { title: 'Contacts masqués par défaut', body: 'Les coordonnées ne sont jamais exposées : la mise en relation passe par une demande tracée.' },
  { title: 'Anonymat par seuil', body: 'Les agrégats sous le seuil de k-anonymat sont supprimés plutôt que publiés.' },
  { title: 'IA encadrée', body: 'Toute sortie d\u2019IA est signalée comme telle, avec consentement explicite et escalade humaine possible.' },
];

export default function PublicSiteAbout() {
  return (
    <PublicShell active="a-propos">
      <PageHeader index="05" eyebrow="À propos" title="La confiance agricole, mesurée" subtitle="AGRIKONNECT AFRICA relie producteurs, coopératives, acheteurs et investisseurs autour d\u2019une donnée dont l\u2019origine est toujours affichée." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {PRINCIPLES.map((principle, index) => (
            <Reveal key={principle.title} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <Text preset="h3">{principle.title}</Text>
                <Text preset="bodySm" color={COLORS.slateGray}>{principle.body}</Text>
              </Card>
            </Reveal>
          ))}
        </View>
        <Text preset="h3" style={styles.mt}>Périmètre livré</Text>
        <View style={styles.list}>
          {RELEASE_TRACK.map((release, index) => (
            <Reveal key={release.tag} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={release.tag} tone="success" size="sm" />
                  <Chip label={release.name} tone="neutral" size="sm" />
                </View>
                <Text preset="bodySm" color={COLORS.slateGray}>{release.body}</Text>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, list: { gap: SPACING.sm }, card: { gap: SPACING.xs }, mt: { marginTop: SPACING.lg, marginBottom: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs } });
