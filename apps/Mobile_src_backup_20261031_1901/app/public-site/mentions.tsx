import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function Mentions() {
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow="Légal" title="Mentions légales" subtitle="Ce que cette application publie, et ce qu’elle ne publie pas." compact />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>
              Éditeur
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              AGRIKONNECT AFRICA — plateforme de mise en relation et de traçabilité des filières agricoles.
              Les coordonnées de l’éditeur ne sont pas publiées dans l’application : le canal de contact
              est le formulaire de la page Contact, qui transmet les messages sans révéler d’adresse.
            </Text>
          </Card>
        </Reveal>
        <Reveal index={1} variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>
              Contenu publié
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Les fiches de producteurs, les cartes et les statistiques affichées proviennent des données
              enregistrées sur la plateforme, avec leur provenance. Les profils non vérifiés ne sont pas
              indexés par les moteurs de recherche : la directive est calculée côté serveur.
            </Text>
          </Card>
        </Reveal>
        <Reveal index={2} variant="up">
          <Card tone="white" style={styles.card}>
            <Text preset="h3" color={COLORS.textPrimary}>
              Limites
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Une fiche publique de lot est déclarative : elle ne constitue ni une certification, ni une
              preuve d’origine. Les sorties du moteur de diagnostic sont des aides à la décision et ne
              remplacent pas l’avis d’un agronome.
            </Text>
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.md },
  lineHeight: { lineHeight: 21 },
  card: { gap: SPACING.sm },
});
