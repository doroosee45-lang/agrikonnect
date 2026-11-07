import { ImageBackground, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Button, PressableScale, Reveal, Text } from '@/components/ui';
import { SERVICE_CATALOG } from '@/lib/service-catalog';
import { COLORS } from '@/theme/colors';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';

/**
 * Fiche détail d'un service — miroir mobile de
 * `apps/web/src/pages/ServiceDetail.tsx` (route web `/services/:serviceId`).
 *
 * Même contenu que le web : image avec bandeau « AGRIKONNECT AFRICA · SERVICES »,
 * sur-titre « SERVICE AGRICOLE », titre, chapô, « Ce que le service permet »
 * (les capacités du service), puis retour au catalogue.
 */
export default function ServiceDetail() {
const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
const service = SERVICE_CATALOG.find((item) => item.id === serviceId);

  if (!service) {
    // Miroir du web (<Navigate to="/services" replace />) : identifiant inconnu
    // → retour immédiat au catalogue, jamais d'écran vide.
    return <Redirect href="/services" />;
  }

  return (
    <PublicShell active="services" background={COLORS.naturalWhite}>
      <View style={styles.page}>
        <Reveal variant="up">
          <PressableScale
            onPress={() => router.push('/services' as never)}
            accessibilityRole="button"
            accessibilityLabel="Fermer et revenir aux services"
            style={styles.backLink}
          >
            <Text preset="bodyMedium" color={COLORS.forestGreen}>← Retour aux services</Text>
          </PressableScale>
        </Reveal>

        <Reveal index={1} variant="up">
          <View style={styles.card}>
            <ImageBackground source={service.image} style={styles.imageWrap} imageStyle={styles.imageRadius}>
              <LinearGradient colors={['rgba(8, 39, 28, 0.02)', 'rgba(8, 39, 28, 0.82)']} style={StyleSheet.absoluteFill} />
              <View style={styles.imageLabel}>
                <Text preset="caption" color={COLORS.pureWhite}>AGRIKONNECT AFRICA · SERVICES</Text>
              </View>
            </ImageBackground>

            <View style={styles.copy}>
              <Text preset="overline" color={COLORS.forestGreen}>SERVICE AGRICOLE</Text>
              <Text preset="h1" color={COLORS.textPrimary}>{service.title}</Text>
              <Text preset="lead" color={COLORS.slateGray}>{service.description}</Text>

              <Text preset="h2" color={COLORS.textPrimary} style={styles.featuresTitle}>
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
                    />
                    <Text preset="body" color={COLORS.textPrimary} style={styles.featureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              <Button
                label="Fermer le détail"
                variant="outline"
                iconRight="close"
                onPress={() => router.push('/services' as never)}
                style={styles.closeButton}
              />
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
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.pureWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  imageWrap: {
    width: '100%',
    height: 240,
    justifyContent: 'flex-start',
    padding: SPACING.md,
  },
  imageRadius: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  imageLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(10, 52, 36, 0.82)',
  },
  copy: {
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  featuresTitle: {
    marginTop: SPACING.md,
  },
  features: {
    gap: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  featureIcon: {
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    lineHeight: 22,
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
  },
});