import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Button, Text, PressableScale } from '@/components/ui';
import { COLORS, TINTS } from '@/theme/colors';
import { CREME, TERRE } from '@/theme/agrikonnect';
import { SPACING } from '@/theme/space';
import { DURATION } from '@/theme/motion';

/**
 * Une diapositive du carrousel Hero mobile.
 */
export interface HeroCarouselSlide {
  image: number; // require() d’une image locale
  titre: string;
  sousTitre: string;
  ctaLabel: string;
  ctaHref: string;
}

/* ────────────────────────────────────────────────────────────
 * Diapositives spécifiques à l’accueil mobile.
 * Chaque diapositive porte son propre titre, sous-titre et CTA.
 * ──────────────────────────────────────────────────────────── */
const champsManioc = require('../../../../assets/hero/champs-manioc.jpg');
const cooperative = require('../../../../assets/hero/cooperative.jpg');
const marche = require('../../../../assets/hero/marche.jpg');
const terresAeriennes = require('../../../../assets/hero/terres-aeriennes.jpg');
const solAnalyse = require('../../../../assets/hero/sol-analyse.jpg');
const technologieCapteurs = require('../../../../assets/hero/technologie-capteurs.jpg');
const investissementProjet = require('../../../../assets/hero/investissement-projet.jpg');
const tracabiliteLot = require('../../../../assets/hero/tracabilite-lot.jpg');
const elevage = require('../../../../assets/hero/elevage.jpg');
const recolte = require('../../../../assets/hero/recolte.jpg');

const SLIDES: HeroCarouselSlide[] = [
  {
    image: champsManioc,
    titre: 'Traçabilité agricole, marchés et investissement en Afrique',
    sousTitre:
      'Chaque lot porte son origine. Chaque donnée porte sa source. Chaque transaction est traçable, de la parcelle au marché.',
    ctaLabel: 'Créer un compte gratuit',
    ctaHref: '/auth/register',
  },
  {
    image: cooperative,
    titre: 'Les coopératives au cœur des filières',
    sousTitre:
      'Réunissez vos productions, négociez collectivement et accédez aux marchés grâce à une organisation transparente.',
    ctaLabel: 'Découvrir les coopératives',
    ctaHref: '/public-site/cooperatives',
  },
  {
    image: marche,
    titre: 'Opportunités de marché',
    sousTitre:
      'Publiez vos annonces, recevez des offres d’achat et suivez vos expéditions jusqu’à leur destination.',
    ctaLabel: 'Voir les opportunités',
    ctaHref: '/public-site/tenders',
  },
  {
    image: terresAeriennes,
    titre: 'Cartographie agricole',
    sousTitre:
      'Localisez vos exploitations sur une carte partagée, avec les statistiques de sol agrégées par zone.',
    ctaLabel: 'Ouvrir la carte',
    ctaHref: '/public-site/map',
  },
  {
    image: solAnalyse,
    titre: 'Analyse des sols et conseils agronomes',
    sousTitre:
      'Déterminez la convenance de vos parcelles pour chaque culture et planifiez vos rotations en toute confiance.',
    ctaLabel: 'Commencer l’analyse',
    ctaHref: '/auth/register',
  },
  {
    image: technologieCapteurs,
    titre: 'Technologie au service des exploitations',
    sousTitre:
      'Capteurs, détections d’anomalies et alertes de seuil : suivez vos cultures en temps réel, partout en RDC.',
    ctaLabel: 'Équiper mon exploitation',
    ctaHref: '/auth/register',
  },
  {
    image: tracabiliteLot,
    titre: 'Traçabilité de la parcelle au marché',
    sousTitre: 'Chaque lot reçoit un QR code et un historique vérifié : origine, traitements, récolte et destination.',
    ctaLabel: 'Voir un lot exemple',
    ctaHref: '/public-site/lot/demo',
  },
  {
    image: investissementProjet,
    titre: 'Investisseurs et projets agricoles',
    sousTitre:
      'Déposez un projet de développement, trouvez des partenaires et suivez son avancement dans une data room sécurisée.',
    ctaLabel: 'Déposer un projet',
    ctaHref: '/public-site/projects',
  },
  {
    image: elevage,
    titre: 'Filières animales et élevage',
    sousTitre:
      'Suivez vos cheptels, enregistrez les productions et organisez la commercialisation avec vos coopératives.',
    ctaLabel: 'Gérer mon élevage',
    ctaHref: '/auth/register',
  },
  {
    image: recolte,
    titre: 'Récoltes et productions agricoles',
    sousTitre:
      'Déclarez vos rendements, comparez-les aux recommandations et valorisez votre production sur le marché.',
    ctaLabel: 'Déclarer ma récolte',
    ctaHref: '/auth/register',
  },
] as const;

const AUTO_INTERVAL_MS = 5000;
const CAROUSEL_HEIGHT = 340;

/**
 * Carrousel Hero mobile avec défilement automatique.
 *
 * - Défilement piloté par Reanimated (60 fps, pas de blocage du JS thread).
 * - Images chargées avec expo-image : repli sur une surface de couleur en
 *   cas d’erreur (jamais d’image brisée visible).
 * - Défilement automatique suspendu au toucher, repris après délai.
 * - Les couleurs et dimensions utilisent les jetons AGRIKONNECT.
 */
export function HeroCarousel() {
  const { width } = useWindowDimensions();
  const total = SLIDES.length;
  const index = useSharedValue(0);
  const [errored, setErrored] = useState<Set<number>>(new Set());

  // Défilement automatique : avance l’index à intervalle fixe.
  useEffect(() => {
    const timer = setInterval(() => {
      index.value = withTiming((index.value + 1) % total, {
        duration: DURATION.slow,
      });
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [total]);

  const handleImageError = (i: number) => {
    setErrored((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  const animatedTrack = useAnimatedStyle(() => ({
    transform: [{ translateX: index.value * -width }],
  }), [width]);

  return (
    <View style={styles.container}>
      {/* Track de défilement horizontal */}
      <Animated.View style={[styles.track, animatedTrack]}>
        {SLIDES.map((slide, i) => {
          const hasError = errored.has(i);
          return (
            <View key={`slide-${i}`} style={styles.slide}>
              <Image
                source={slide.image}
                style={styles.image}
                resizeMode="cover"
                onError={() => handleImageError(i)}
              />
              {/* Surface de repli quand l’image est en erreur : terre-100. */}
              {hasError && (
                <View
                  style={{
                    ...StyleSheet.absoluteFill,
                    backgroundColor: TERRE[100],
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text preset="caption" color={COLORS.warning}>
                    Visuel indisponible
                  </Text>
                </View>
              )}
              {/* Voile de lisibilité au-dessus de l’image. */}
              <View style={styles.scrim} />
            </View>
          );
        })}
      </Animated.View>

      {/* Overlay texte centré sur la diapositive courante. */}
      {SLIDES.map((slide, i) => (
        <Animated.View
          key={`content-${i}`}
          style={[
            styles.contentWrap,
            useAnimatedStyle(() => ({
              opacity: index.value === i ? 1 : 0,
            })),
          ]}
        >
          <Text preset="overline" color={COLORS.gold} style={styles.overline}>
            AGRIKONNECT AFRICA
          </Text>
          <Text preset="h3" color={COLORS.pureWhite} style={styles.titre}>
            {slide.titre}
          </Text>
          <Text
            preset="bodyMedium"
            color="rgba(255,255,255,0.92)"
            style={styles.sousTitre}
          >
            {slide.sousTitre}
          </Text>
          <PressableScale
            onPress={() => router.push(slide.ctaHref)}
            style={styles.ctaContainer}
          >
            <Button
              label={slide.ctaLabel}
              variant="gold"
              size="lg"
              style={styles.cta}
            />
          </PressableScale>
        </Animated.View>
      ))}

      {/* Dots de navigation (actif = plus large, doré). */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <Animated.View
            key={`dot-${i}`}
            style={[
              styles.dot,
              useAnimatedStyle(() => ({
                width: index.value === i ? 24 : 8,
                backgroundColor:
                  index.value === i ? COLORS.gold : 'rgba(255,255,255,0.45)',
              })),
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: CAROUSEL_HEIGHT,
    overflow: 'hidden',
    backgroundColor: CREME[100],
  },
  track: {
    flexDirection: 'row',
    height: CAROUSEL_HEIGHT,
    width: '100%',
  },
  slide: {
    width: '100%',
    height: CAROUSEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: CAROUSEL_HEIGHT,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: TINTS.scrimStrong,
  },
  contentWrap: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    width: '100%',
  },
  overline: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  sousTitre: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaContainer: {
    marginTop: 8,
    width: '100%',
  },
  cta: {
    width: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
