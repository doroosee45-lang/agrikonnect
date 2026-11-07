import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Accordion, Button, Card, ChipRow, FilterChip, Reveal, Section, Text } from '@/components/ui';
import { FAQ_ENTRIES } from '@/lib/faq';
import { COLORS, TINTS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const TOPICS = ['Toutes', 'Données', 'Comptes', 'Échanges', 'Technique'] as const;

export default function Faq() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('Toutes');

  const entries = useMemo(
    () => (topic === 'Toutes' ? FAQ_ENTRIES : FAQ_ENTRIES.filter((entry) => entry.topic === topic)),
    [topic],
  );

  return (
    <PublicShell active="faq">
      <PageHeader
        index={1}
        eyebrow="Aide"
        title="Questions fréquentes"
        subtitle="Les règles de la plateforme, écrites clairement : provenance des données, vérification, contacts, limites de l’aide à la décision."
      />

      <Section background={COLORS.naturalWhite} contentStyle={styles.section} bare>
        <Reveal variant="up">
          <ChipRow>
            {TOPICS.map((item) => (
              <FilterChip
                key={item}
                label={item}
                active={topic === item}
                onPress={() => setTopic(item)}
              />
            ))}
          </ChipRow>
        </Reveal>

        <Reveal index={1} variant="up">
          <Accordion
            items={entries.map(({ id, question, answer }) => ({ id, question, answer }))}
            multiple
          />
        </Reveal>

        <Reveal index={2} variant="up">
          <Card tone="pale" style={styles.help}>
            <View style={styles.helpText}>
              <Text preset="h3" color={COLORS.textPrimary}>
                Votre question n’y est pas ?
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                Le formulaire de contact transmet votre message à l’équipe. Pour contacter un producteur
                en particulier, passez par sa fiche publique.
              </Text>
            </View>
            <Button label="Nous écrire" onPress={() => router.push('/contact')} variant="primary" size="sm" />
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.xl },
  lineHeight: { lineHeight: 20 },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    backgroundColor: TINTS.goldBg,
    flexWrap: 'wrap',
  },
  helpText: { flex: 1, gap: SPACING.xs, minWidth: 240 },
});
