import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Input, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const RULES = [
  { title: 'Le producteur choisit', body: 'Seuls les champs qu’il publie apparaissent : le reste n’est jamais exposé, même par déduction.' },
  { title: 'Pas d’acteur, pas de lieu', body: 'Le journal public ne contient que le type d’étape et sa date — ni intervenant, ni coordonnées d’événement.' },
  { title: 'Pas une certification', body: 'La fiche publique est déclarative : elle ne vaut ni preuve d’origine, ni certification.' },
];

/** Recherche d'un lot par son code. */
export default function LotSearch() {
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = touched && code.trim().length < 6;

  return (
    <PublicShell active="accueil">
      <PageHeader
        index={1}
        eyebrow="Traçabilité"
        title="Vérifier un lot"
        subtitle="Saisissez le code figurant sur l’étiquette ou scannez le QR du colis pour afficher la fiche publique."
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <Card tone="white" style={styles.form}>
            <Input
              label="Code de lot"
              value={code}
              onChangeText={(value) => {
                setCode(value.toUpperCase());
                setTouched(false);
              }}
              onBlur={() => setTouched(true)}
              placeholder="AK-CI-2026-00001"
              autoCapitalize="characters"
              autoCorrect={false}
              icon="qr-code-outline"
              error={invalid ? 'Le code semble incomplet (6 caractères minimum).' : null}
              helper="Format observé : AK-<pays>-<année>-<séquence>."
              returnKeyType="search"
              onSubmitEditing={() => {
                if (code.trim().length < 6) {
                  setTouched(true);
                  return;
                }
                router.push(`/public-site/lot/${code.trim()}` as never);
              }}
            />
            <Button
              label="Afficher la fiche"
              variant="primary"
              icon="search"
              fullWidth
              onPress={() => {
                if (code.trim().length < 6) {
                  setTouched(true);
                  return;
                }
                router.push(`/public-site/lot/${code.trim()}` as never);
              }}
            />
          </Card>
        </Reveal>

        <View style={styles.rules}>
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} index={index} variant="up">
              <Card tone="pale" style={styles.rule}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.forestGreen} />
                <View style={styles.ruleBody}>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    {rule.title}
                  </Text>
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {rule.body}
                  </Text>
                </View>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, paddingBottom: 56, gap: SPACING.xl },
  lineHeight: { lineHeight: 20 },
  form: { gap: SPACING.md },
  rules: { gap: SPACING.md },
  rule: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  ruleBody: { flex: 1, gap: 2 },
});
