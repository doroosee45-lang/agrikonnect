import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const BLOCKS = [
  {
    title: 'Comptes',
    body: 'L’inscription en libre-service ouvre les rôles opérationnels : producteur, coopérative, société agricole, acheteur, fournisseur, transporteur, agronome, investisseur, agent d’appui. Les rôles de gouvernance (administrateur, modérateur, vérificateur, partenaire laboratoire, client API) sont attribués par un administrateur et ne peuvent jamais être auto-déclarés.',
  },
  {
    title: 'Exactitude des données',
    body: 'Chaque information porte sa provenance : mesurée, vérifiée, estimée ou déclarée. La plateforme ne corrige pas une donnée manquante par une estimation, et ne publie aucun chiffre sans source.',
  },
  {
    title: 'Échanges commerciaux',
    body: 'Les annonces, offres et commandes sont journalisées. Les coordonnées des parties ne sont pas échangées par défaut : la relation passe par la messagerie interne, avec signalement et blocage possibles.',
  },
  {
    title: 'Vérification',
    body: 'Une demande de vérification est instruite puis horodatée. Le statut « vérifié » remplace « déclaré » sur la fiche publique ; il ne vaut pas certification de produit.',
  },
  {
    title: 'Accès aux documents',
    body: 'Une dataroom donne un accès limité dans le temps (30 jours par défaut, 90 au plus), journalisé. L’expiration met fin à l’accès sans action du titulaire.',
  },
  {
    title: 'API et exports',
    body: 'L’API publique fonctionne par clé, avec un périmètre d’autorisation par clé et une journalisation des appels. Les exports sont produits à la demande et tracés.',
  },
];

export default function Conditions() {
  return (
    <PublicShell active="accueil">
      <PageHeader index={1} eyebrow="Légal" title="Conditions d’utilisation" subtitle="Les règles d’usage de la plateforme, écrites à partir de son comportement réel." compact />
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
