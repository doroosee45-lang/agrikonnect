import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Card, PressableScale, Reveal, Section, Text } from '@/components/ui';
import { SERVICE_CATALOG, SERVICE_DOMAINS } from '@/lib/service-catalog';
import { COLORS, TINTS } from '@/theme/colors';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';
import { VERT, TERRE } from '@/theme/agrikonnect';

/**
 * Services de la plateforme — miroir mobile de `apps/web/src/pages/Services.tsx`.
 * Textes identiques au web ; « Ouvrir » mène à `/services/[serviceId]`.
 */
export default function Services() {
  return (
    <PublicShell active="services" background={COLORS.naturalWhite}>
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.catalogHeader}>
          <Text preset="overline" color={COLORS.forestGreen}>AGRIKONNECT AFRICA</Text>
          <Text preset="h2" color={COLORS.textPrimary} accessibilityRole="header">
            Les services de la plateforme
          </Text>
          <Text preset="body" color={COLORS.slateGray}>
            Des outils connectés pour inspecter les sols, suivre les productions, accéder aux marchés et prendre des décisions éclairées.
          </Text>
        </View>

        <View style={styles.grid}>
          {SERVICE_CATALOG.map((service, index) => (
            <Reveal key={service.id} index={index} variant="up" style={styles.cell}>
              <Card tone="white" style={styles.card}>
                <View style={styles.cardImage}>
                  <Image
                    source={service.image}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityRole="image"
                    accessibilityLabel={service.imageAlt}
                  />
                  <LinearGradient
                    colors={['rgba(8, 39, 28, 0.02)', 'rgba(8, 39, 28, 0.82)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.cardImageBadge}>
                    <Text preset="caption" color={COLORS.pureWhite}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={styles.cardImageCopy}>
                    <Text preset="h3" color={COLORS.pureWhite} style={styles.cardImageTitle} accessibilityRole="header">
                      {service.title}
                    </Text>
                    <Text preset="bodySm" color="rgba(255,255,255,0.94)" style={styles.cardSummary}>
                      {service.summary}
                    </Text>
                    <PressableScale
                      onPress={() =>
                        router.push({
                          pathname: '/services/[serviceId]',
                          params: { serviceId: service.id },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Ouvrir le service ${service.title}`}
                      style={styles.openButton}
                    >
                      <Text preset="button" color={COLORS.pureWhite} style={styles.openButtonLabel}>
                        Ouvrir
                      </Text>
                      <Text preset="button" color={COLORS.pureWhite} style={styles.openButtonArrow}>
                        →
                      </Text>
                    </PressableScale>
                  </View>
                </View>
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>

      <Section
        index={2}
        eyebrow="Périmètre complet"
        title="Une plateforme pour toute la chaîne agricole"
        subtitle="Les services s’appuient sur des domaines complémentaires, de la gestion des accès aux outils publics."
        background={COLORS.paleGreen}
      >
        <View style={styles.domainGrid}>
          {SERVICE_DOMAINS.map((domain, index) => (
            <Reveal key={domain.title} index={index} variant="up" style={styles.domainItem}>
              <Card tone="white" style={styles.domainCard}>
                <View style={styles.domainCardTop}>
                  <View style={styles.domainLetter}>
                    <Text preset="button" color={COLORS.forestGreen}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text preset="overline" color={TERRE[700]}>
                    DOMAINE {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text preset="bodyMedium" color={COLORS.textPrimary} accessibilityRole="header">
                  {domain.title}
                </Text>
                <Text preset="bodySm" color={COLORS.slateGray} style={styles.domainText}>
                  {domain.text}
                </Text>
                <Ionicons
                  name="arrow-up-outline"
                  size={16}
                  color={COLORS.forestGreen}
                  style={styles.domainArrow}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </Card>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: LAYOUT.screenPadding, paddingTop: SPACING.xxl, paddingBottom: SPACING.xxxl },
  catalogHeader: { gap: SPACING.sm, marginBottom: SPACING.xl },
  grid: { flexDirection: 'column', gap: SPACING.lg },
  cell: { width: '100%', minWidth: 0 },
  card: { padding: 0, overflow: 'hidden', alignItems: 'stretch' },
  cardImage: {
    width: '100%',
    height: 390,
    justifyContent: 'flex-end',
    padding: SPACING.md,
    overflow: 'hidden',
    backgroundColor: TINTS.forestGreenBg,
  },
  cardImageBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(10, 52, 36, 0.82)',
  },
  cardImageCopy: { gap: SPACING.sm },
  cardImageTitle: { fontSize: 19, lineHeight: 24, fontFamily: 'serif' },
  cardSummary: { lineHeight: 20 },
  openButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 26,
    borderRadius: RADIUS.pill,
    backgroundColor: TERRE[600],
    marginTop: SPACING.xs,
  },
  openButtonLabel: { fontSize: 16, fontWeight: '700' },
  openButtonArrow: { fontSize: 20, fontWeight: '600', lineHeight: 22 },
  domainGrid: { flexDirection: 'column', gap: SPACING.md },
  domainItem: { width: '100%' },
  domainCard: {
    position: 'relative',
    gap: SPACING.sm,
    minHeight: 168,
    alignItems: 'flex-start',
    padding: SPACING.lg,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: VERT[600],
  },
  domainCardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xs },
  domainLetter: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paleGreen,
    borderWidth: 1,
    borderColor: 'rgba(23, 77, 53, 0.12)',
  },
  domainText: { lineHeight: 20 },
  domainArrow: { position: 'absolute', top: SPACING.lg, right: SPACING.lg, transform: [{ rotate: '45deg' }] },
});