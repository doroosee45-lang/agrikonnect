import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Chip, PressableScale, Reveal, Section, Text } from '@/components/ui';
import { SELF_SERVICE_ROLES } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * Création de profil.
 *
 * L\u2019inscription réelle passe par `POST /auth/register`, qui exige un type de
 * compte et un pays : cet écran présente les rôles en libre-service puis renvoie
 * vers le formulaire d\u2019inscription authentifié.
 */
export default function PublicSiteCreerProfil() {
  const { t } = useI18n();
  return (
    <PublicShell active="creer-profil" footer={false}>
      <PageHeader index="13" eyebrow={t('ui.inscription')} title={t('ui.creerUnProfil')} subtitle={t('ui.choisissezLeRoleQuiCorrespondA')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {SELF_SERVICE_ROLES.map((role, index) => (
            <Reveal key={role.id} index={index} variant="up">
              <Card tone="white" style={styles.row}>
                <View style={styles.rowBody}>
                  <Text preset="bodyMedium">{role.label}</Text>
                  <Text preset="caption" color={COLORS.slateGray}>{role.id}</Text>
                </View>
                <Chip label="libre-service" tone="success" size="sm" />
              </Card>
            </Reveal>
          ))}
        </View>
        <Card tone="pale">
          <Text preset="caption" color={COLORS.slateGray}>{t('ui.lInscriptionDemandeUnTypeDe')}</Text>
        </Card>
        <PressableScale onPress={() => router.push('/auth/register')}>
          <Button label={t('ui.continuerLInscription')} variant="primary" onPress={() => router.push('/auth/register')} />
        </PressableScale>
        <Button label={t('ui.jAiDejaUnCompte')} variant="ghost" onPress={() => router.push('/auth/login')} />
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
