import { StyleSheet } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Accordion, Card, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const ITEMS = [
  { id: 'verification', question: 'Comment est vérifiée une exploitation ?', answer: 'Une demande de vérification est instruite par un vérificateur habilité. Tant qu\u2019elle n\u2019est pas approuvée, l\u2019exploitation reste affichée comme déclarée, jamais comme vérifiée.' },
  { id: 'provenance', question: 'Que signifie le symbole ✔ ou ≈ ?', answer: '✔ signale une valeur mesurée (capteur, laboratoire, satellite). ≈ signale une valeur déclarée par le producteur ou estimée. Les deux ne sont jamais mélangées dans un même indicateur.' },
  { id: 'agregats', question: 'Pourquoi certaines statistiques sont-elles absentes ?', answer: 'Un agrégat est publié seulement si le groupe compte assez de producteurs (k-anonymat). En dessous du seuil, la valeur est supprimée : elle n\u2019est ni arrondie ni remplacée par zéro.' },
  { id: 'contacts', question: 'Puis-je voir le téléphone d\u2019un producteur ?', answer: 'Non. Les coordonnées sont masquées par défaut. La mise en relation passe par une demande tracée que le producteur accepte ou refuse.' },
  { id: 'tracabilite', question: 'Comment fonctionne la traçabilité d\u2019un lot ?', answer: 'Chaque lot porte un code unique et un journal d\u2019étapes horodaté. La fiche publique accessible par QR ne contient ni identifiant technique, ni acteur, ni localisation d\u2019événement.' },
  { id: 'ia', question: 'Les réponses d\u2019IA sont-elles fiables ?', answer: 'Elles sont toujours signalées comme sorties d\u2019IA, soumises à consentement explicite, et peuvent être escaladées à un humain avant toute décision.' },
  { id: 'offline', question: 'Puis-je utiliser l\u2019application hors ligne ?', answer: 'Oui pour la saisie. Les opérations sont poussées à la reconnexion ; en cas de conflit, aucune résolution silencieuse n\u2019est appliquée : le conflit reste à arbitrer.' },
];

export default function PublicSiteFaq() {
  return (
    <PublicShell active="faq">
      <PageHeader index="07" eyebrow="FAQ" title="Questions fréquentes" subtitle="Les règles de preuve, de confidentialité et de publication de la plateforme." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Card tone="white">
          <Accordion items={ITEMS} />
        </Card>
        <Text preset="caption" color={COLORS.slateGray} style={styles.foot}>
          Ces règles sont appliquées côté serveur : l\u2019affichage mobile ne les assouplit jamais.
        </Text>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, foot: { marginTop: SPACING.xs } });
