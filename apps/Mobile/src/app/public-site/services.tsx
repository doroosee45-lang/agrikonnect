import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Chip, PressableScale, Reveal, Section, Text } from '@/components/ui';
import { PLATFORM_SERVICES } from '@/lib/platform';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const TONE_BG: Record<string, string> = {
  forest: TINTS.forestGreenBg,
  gold: TINTS.goldBg,
  living: TINTS.livingGreenBg,
  info: TINTS.infoBg,
};

/** Périmètre fonctionnel réellement livré, service par service (exigences CDC incluses). */
export default function PublicSiteServices() {
  return (
    <PublicShell active="services">
      <PageHeader index="04" eyebrow="Services" title="Ce que la plateforme fait" subtitle="Chaque service est rattaché aux exigences du cahier des charges qu'il couvre." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {PLATFORM_SERVICES.map((service, index) => (
            <Reveal key={service.id} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <View style={styles.head}>
                  <View style={[styles.iconBox, { backgroundColor: TONE_BG[service.tone] ?? TINTS.forestGreenBg }]}>
                    <Ionicons name={service.icon} size={22} color={COLORS.forestGreen} />
                  </View>
                  <View style={styles.headText}>
                    <Text preset="h3">{service.title}</Text>
                    <Text preset="bodySm" color={COLORS.slateGray}>{service.body}</Text>
                  </View>
                </View>
                <Text preset="caption" color={COLORS.slateGray}>{service.detail}</Text>
                <View style={styles.chips}>
                  {service.cdc.map((code) => (
                    <Chip key={code} label={code} tone="neutral" size="sm" />
                  ))}
                  <Chip label={service.requiresAuth ? 'compte requis' : 'accès anonyme'} tone={service.requiresAuth ? 'warning' : 'success'} size="sm" />
                </View>
                <PressableScale onPress={() => router.push(service.href as never)} style={styles.link}>
                  <Text preset="bodySm" color={COLORS.forestGreen}>Ouvrir le service →</Text>
                </PressableScale>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  list: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  head: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  iconBox: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  link: { alignSelf: 'flex-start' },
});
