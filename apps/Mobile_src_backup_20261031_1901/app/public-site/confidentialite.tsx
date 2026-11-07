import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const BLOCKS = [
  {
    title: 'Ce qui est publié par défaut',
    body: 'Rien de personnel. Une fiche publique expose le nom de l’exploitation, son découpage administratif, sa surface déclarée, ses cultures et son statut de vérification. Les coordonnées restent masquées tant que le producteur ne les publie pas.',
  },
  {
    title: 'Positions',
    body: 'Les coordonnées affichées sur les routes publiques sont arrondies côté serveur avant l’envoi. La position exacte d’une parcelle n’est jamais exposée publiquement.',
  },
  {
    title: 'Statistiques',
    body: 'Les agrégats sont soumis au k-anonymat : tout groupe de moins de dix analyses est supprimé de la publication, sans arrondi ni complétion.',
  },
  {
    title: 'Jetons et session',
    body: 'Les jetons d’accès sont stockés dans le trousseau sécurisé de l’appareil (Keychain / Keystore), jamais dans les journaux. L’accès dure au plus quinze minutes et le rafraîchissement est rotatif.',
  },
  {
    title: 'Médias',
    body: 'Les images sont servies par URL signée à durée limitée (5 minutes par défaut). Un lien partagé expire de lui-même.',
  },
  {
    title: 'Messagerie',
    body: 'Les échanges commerciaux passent par la messagerie interne. Les messages sont horodatés, signalables, et une partie peut bloquer l’autre.',
  },
];

export default function Confidentialite() {
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow="Légal" title="Confidentialité" subtitle="Les règles appliquées par la plateforme, telles qu’elles sont implémentées." compact />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {BLOCKS.map((block, index) => (
          <Reveal key={block.title} index={index % 3} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="h3" color={COLORS.textPrimary}>
                {block.title}
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                {block.body}
              </Text>
            </Card>
          </Reveal>
        ))}
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.md },
  lineHeight: { lineHeight: 21 },
  card: { gap: SPACING.sm },
});
