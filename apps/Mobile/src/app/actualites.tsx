import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Chip, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * Journal du réseau.
 *
 * La plateforme ne publie pas de contenu éditorial inventé : ce journal liste
 * le périmètre fonctionnel réellement livré (V1 → V5) et renvoie vers les flux
 * opérationnels (prix, appels d’offres, projets) qui, eux, exigent un compte.
 */
export default function Actualites() {
  const { t } = useI18n();
  return (
    <PublicShell active="actualites">
      <PageHeader
        index={1}
        eyebrow={t('ui.journal')}
        title={t('ui.ceQueLaPlateformeSaitFaire')}
        subtitle={t('ui.pasDeCommuniqueSansSubstanceVoici')}
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {RELEASE_TRACK.map((release, index) => (
            <Reveal key={release.tag} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.tagBox}>
                    <Text preset="h3" color={COLORS.forestGreen}>
                      {release.tag}
                    </Text>
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text preset="h3" color={COLORS.textPrimary}>
                      {release.name}
                    </Text>
                    <Chip label={t('ui.livre')} tone="success" size="sm" icon="checkmark-circle" />
                  </View>
                </View>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                  {release.body}
                </Text>
              </Card>
            </Reveal>
          ))}
        </View>

        <Reveal variant="up">
          <Card tone="pale" style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.forestGreen} />
            <View style={styles.noteText}>
              <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.lesPublicationsOperationnellesSontDansVotre')}</Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.relevesDePrixAppelsDOffres')}</Text>
              <View style={styles.noteActions}>
                <Button label={t('ui.prixDeMarche')} onPress={() => router.push('/prices')} variant="outline" size="sm" />
                <Button label={t('ui.appelsDOffres')} onPress={() => router.push('/tenders')} variant="outline" size="sm" />
                <Button label={t('ui.projets')} onPress={() => router.push('/projets')} variant="outline" size="sm" />
              </View>
            </View>
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 48, paddingBottom: 56, gap: SPACING.xl },
  lineHeight: { lineHeight: 21 },
  list: { gap: SPACING.md },
  card: { gap: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  tagBox: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  note: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  noteText: { flex: 1, gap: SPACING.sm },
  noteActions: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
});
