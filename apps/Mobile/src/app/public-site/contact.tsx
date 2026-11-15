import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * Contact plateforme.
 *
 * Aucun endpoint public de contact générique n'existe : le seul canal exposé est
 * la demande de mise en relation rattachée à une exploitation
 * (`POST /public/farms/:slug/contact`). Ce formulaire oriente donc vers ce canal
 * plutôt que de simuler un envoi.
 */
export default function PublicSiteContact() {
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState(false);

  return (
    <PublicShell active="contact" footer={false}>
      <PageHeader index="06" eyebrow={t('ui.contact')} title={t('ui.nousEcrire')} subtitle={t('ui.pourContacterUnProducteurPassezPar')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Card tone="white">
          <View style={styles.form}>
            <Input label={t('ui.sujet')} value={subject} onChangeText={setSubject} />
            <Input label={t('ui.message')} value={message} onChangeText={setMessage} multiline />
            {hint ? (
              <ErrorState error={new Error(t('ui.leDepotDirectDeMessageN'))} />
            ) : null}
            <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesDemandesDeMiseEnRelation')}</Text>
            <Button label={t('ui.envoyer')} variant="primary" onPress={() => setHint(true)} disabled={subject.trim().length === 0 || message.trim().length === 0} />
          </View>
        </Card>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
