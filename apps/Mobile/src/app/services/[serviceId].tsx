import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { PressableScale, Reveal, Text } from '@/components/ui';
import { SERVICE_CATALOG } from '@/lib/service-catalog';
import { COLORS } from '@/theme/colors';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';
import { TERRE } from '@/theme/agrikonnect';

/**
 * Fiche détail d'un service — miroir mobile de `apps/web/src/pages/ServiceDetail.tsx`
 * (route web `/services/:serviceId`).
 */
export default function ServiceDetail() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const service = SERVICE_CATALOG.find((item) => item.id === serviceId);

  // Miroir de <Navigate to="/services" replace /> : id inconnu → catalogue.
  if (!service) {
    return <Redirect href="/services" />;
  }

  const goBackToServices = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/services');
  };

  return (
    <PublicShell active="services" background={COLORS.naturalWhite}>
      <View style={styles.page}>
        <Reveal variant="up">
          <PressableScale
            onPress={goBackToServices}
            accessibilityRole="button"
            accessibilityLabel="Fermer et revenir aux services"
            style={styles.backLink}
          >
            <Text preset="bodyMedium" color={COLORS.forestGreen}>← Retour aux services</Text>
          </PressableScale>
        </Reveal>

        <Reveal index={1} variant="up">
          <View style={styles.card}>
            <View style={styles.imageWrap}>
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
              <View style={styles.imageLabel}>
                <Text preset="caption" color={COLORS.pureWhite}>AGRIKONNECT AFRICA · SERVICES</Text>
              </View>
            </View>

            <View style={styles.copy}>
              <Text preset="overline" color={COLORS.forestGreen}>SERVICE AGRICOLE</Text>
              <Text preset="h1" color={COLORS.textPrimary} accessibilityRole="header">
                {service.title}
              </Text>
              <Text preset="lead" color={COLORS.slateGray}>{service.description}</Text>

              <Text preset="h2" color={COLORS.textPrimary} style={styles.featuresTitle} accessibilityRole="header">
                Ce que le service permet
              </Text>
              <View style={styles.features}>
                {service.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={COLORS.forestGreen}
                      style={styles.featureIcon}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <Text preset="body" color={COLORS.textPrimary} style={styles.featureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              <PressableScale
                onPress={goBackToServices}
                accessibilityRole="button"
                accessibilityLabel="Fermer le détail du service"
                style={styles.closeButton}
              >
                <Text preset="button" color={COLORS.pureWhite} style={styles.closeButtonLabel}>
                  Fermer le détail
                </Text>
                <Text preset="button" color={COLORS.pureWhite} style={styles.closeButtonIcon}>
                  ×
                </Text>
              </PressableScale>
            </View>
          </View>
        </Reveal>
      </View>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: SPACING.xxl,
    gap: SPACING.lg,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
  },
  backLink: { alignSelf: 'flex-start', paddingVertical: SPACING.xs },
  card: {
    backgroundColor: COLORS.pureWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  imageWrap: {
    width: '100%',
    height: 240,
    justifyContent: 'flex-start',
    padding: SPACING.md,
    overflow: 'hidden',
  },
  imageLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(10, 52, 36, 0.82)',
  },
  copy: { gap: SPACING.sm, padding: SPACING.xl },
  featuresTitle: { marginTop: SPACING.md },
  features: { gap: SPACING.md, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  featureIcon: { marginTop: 2 },
  featureText: { flex: 1, lineHeight: 22 },
  closeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 26,
    borderRadius: RADIUS.pill,
    backgroundColor: TERRE[600],
    marginTop: SPACING.sm,
  },
  closeButtonLabel: { fontSize: 16, fontWeight: '700' },
  closeButtonIcon: { fontSize: 22, fontWeight: '600', lineHeight: 24 },
});