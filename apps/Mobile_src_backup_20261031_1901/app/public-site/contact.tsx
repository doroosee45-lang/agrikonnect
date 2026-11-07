import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Contact plateforme.
 *
 * Aucun endpoint public de contact générique n'existe : le seul canal exposé est
 * la demande de mise en relation rattachée à une exploitation
 * (`POST /public/farms/:slug/contact`). Ce formulaire oriente donc vers ce canal
 * plutôt que de simuler un envoi.
 */
export default function PublicSiteContact() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState(false);

  return (
    <PublicShell active="contact" footer={false}>
      <PageHeader index="06" eyebrow="Contact" title="Nous écrire" subtitle="Pour contacter un producteur, passez par sa fiche : la mise en relation est tracée et ses coordonnées restent masquées." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Card tone="white">
          <View style={styles.form}>
            <Input label="Sujet" value={subject} onChangeText={setSubject} />
            <Input label="Message" value={message} onChangeText={setMessage} multiline />
            {hint ? (
              <ErrorState error={new Error('Le dépôt direct de message n\u2019est pas ouvert. Utilisez la demande de contact depuis la fiche du producteur.')} />
            ) : null}
            <Text preset="caption" color={COLORS.slateGray}>
              Les demandes de mise en relation se font depuis la fiche d\u2019une exploitation (bouton « Demander un contact »).
            </Text>
            <Button label="Envoyer" variant="primary" onPress={() => setHint(true)} disabled={subject.trim().length === 0 || message.trim().length === 0} />
          </View>
        </Card>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
