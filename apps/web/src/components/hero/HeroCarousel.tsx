import { motion, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { COLORS, DURATION, EASE, RADIUS } from '@/theme';
import { VERT, TERRE, TAILLES } from '@/theme/agrikonnect';

/**
 * Une diapositive du carrousel Hero.
 *
 * Les textes sont spécifiques à chaque page : le même carrousel ne doit pas
 * répéter le même texte d'une page à l'autre (exigence 7). Les images sont
 * importées par l'appelant pour garder ce composant sans dépendance aux assets.
 */
export interface HeroCarouselSlide {
  /** Image de la diapositive. Peut être un import ou une URL externe. */
  image: string;
  /** Titre affiché en surimpression. */
  titre: string;
  /** Sous-titre affiché sous le titre. */
  sousTitre: string;
  /** Cible du bouton d'appel à l'action. */
  ctaHref: string;
  /** Libellé du bouton d'appel à l'action. */
  ctaLabel: string;
}

/**
 * Props du carrousel Hero.
 *
 * `intervalMs` contrôle la cadence de défilement automatique. Il est désactivé
 * quand l'utilisateur a demandé la réduction des animations (préférence système
 * `prefers-reduced-motion`).
 */
export interface HeroCarouselProps {
  slides: readonly HeroCarouselSlide[];
  /** Hauteur du carrousel en pixels (défaut 560). */
  height?: number;
  /** Intervalle entre deux diapositives en ms (défaut 5000). */
  intervalMs?: number;
  /** Classe CSS additionnelle. */
  className?: string;
}

const DOT_SIZE = 10;
const DOT_ACTIVE = 24;

/**
 * Carrousel Hero plein largeur avec défilement automatique.
 *
 * - Les images se chargent paresseusement ; une diapositive en erreur affiche
 *   une surface de repli colorée (jamais d'image brisée visible).
 * - Seul `opacity` et `transform` sont animés (règle I5 du système de design).
 * - `prefers-reduced-motion` désactive le défilement automatique et les
 *   transitions de diapositive.
 */
export function HeroCarousel({
  slides,
  height = 560,
  intervalMs = 5000,
  className,
}: HeroCarouselProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});
  const [hovered, setHovered] = useState(false);

  const total = slides.length;

  // Défilement automatique, suspendu au survol et en mode réduit.
  // `intervalMs <= 0` désactive le défilement (utile en tests).
  useEffect(() => {
    if (reduced || total === 0 || hovered || intervalMs <= 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [index, total, intervalMs, reduced, hovered]);

  // Quand on passe à une nouvelle diapositive, on réinitialise son état de charge.
  const handleImageError = useCallback((i: number) => {
    setErrored((prev) => ({ ...prev, [i]: true }));
  }, []);

  const slide = useMemo(() => slides[index % total], [index, total, slides]);

  // Animation de transition entre diapositives : fondu croisé via opacity.
  const opacity = useMotionValue(1);
  const springOpacity = useSpring(opacity, {
    damping: 25,
    stiffness: 200,
    restDelta: 0.001,
  });

  useEffect(() => {
    opacity.set(0);
    // Petit délai pour laisser le fondu s'achever avant de remonter à 1.
    const t = setTimeout(() => opacity.set(1), reduced ? 0 : 300);
    return () => clearTimeout(t);
  }, [index, opacity, reduced]);

  const isActive = (i: number) => i === index;

  return (
    <section
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height,
        minHeight: height,
        backgroundColor: COLORS.naturalWhite,
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Diapositives : fondu croisé, une à la fois. */}
      {slides.map((slide, i) => {
        const active = isActive(i);
        const hasError = errored[i];
        return (
          <motion.div
            key={`slide-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: active ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduced ? 0 : DURATION.slow / 1000,
              ease: EASE.inOut,
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={slide.image}
              alt=""
              role="presentation"
              decoding="async"
              loading={active ? 'eager' : 'lazy'}
              fetchPriority={active ? 'high' : 'auto'}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                opacity: hasError ? 0 : 1,
                transition: `opacity ${reduced ? 0 : DURATION.slow / 1000}s ease`,
                display: hasError ? 'none' : 'block',
              }}
              onError={() => handleImageError(i)}
            />
            {/* Surface de repli quand l'image échoue : couleur terre, jamais blanc brutal. */}
            {hasError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: TERRE[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text preset="caption" color={TERRE[700]}>
                  Visuel indisponible
                </Text>
              </div>
            )}
            {/* Overlay de lisibilité : dégradé sombre en bas du carrousel. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                background: `linear-gradient(
                  to bottom,
                  rgba(14, 48, 34, 0.35) 0%,
                  rgba(14, 48, 34, 0.55) 45%,
                  rgba(14, 48, 34, 0.75) 100%
                )`,
              }}
            />
          </motion.div>
        );
      })}

      {/* Contenu texte centré verticalement, en surimpression. */}
      <motion.div
        initial={{ opacity: 0, y: TAILLES.corps / 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reduced ? 0 : DURATION.slow / 1000,
          ease: EASE.inOut,
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        <Text
          preset="overline"
          color={COLORS.goldSurface}
          style={{
            marginBottom: 12,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          AGRIKONNECT AFRICA
        </Text>
        <Text
          preset="h1"
          color={COLORS.pureWhite}
          style={{
            fontFamily: TEXTE_serif(),
            marginBottom: 16,
            lineHeight: 1.2,
            maxWidth: 720,
          }}
        >
          {slide.titre}
        </Text>
        <Text
          preset="bodyLg"
          color="rgba(255, 255, 255, 0.9)"
          style={{
            marginBottom: 32,
            maxWidth: 560,
            lineHeight: 1.7,
          }}
        >
          {slide.sousTitre}
        </Text>
        <Link to={slide.ctaHref} style={{ textDecoration: 'none', display: 'inline-flex' }}>
          <Button
            label={slide.ctaLabel}
            variant="primary"
            size="lg"
            style={{
              backgroundColor: COLORS.goldSurface,
              color: COLORS.onGoldSurface,
              border: 'none',
              height: 52,
            }}
          />
        </Link>
      </motion.div>

      {/* Indicateurs de progression (dots). */}
      {total > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            zIndex: 3,
          }}
        >
          {slides.map((_, i) => (
            <motion.button
              key={`dot-${i}`}
              aria-label={`Diapositive ${i + 1} sur ${total}`}
              aria-current={isActive(i) ? 'true' : undefined}
              onClick={() => setIndex(i)}
              whileHover={reduced ? undefined : { scale: 1.2 }}
              whileTap={reduced ? undefined : { scale: 0.8 }}
              style={{
                width: isActive(i) ? DOT_ACTIVE : DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: 999,
                backgroundColor: isActive(i)
                  ? COLORS.pureWhite
                  : 'rgba(255, 255, 255, 0.45)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: `width ${reduced ? 0 : DURATION.base / 1000}s ease`,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// Helpers isolés pour éviter les imports circulaires ou des valeurs en dur.
function TEXTE_serif(): string {
  return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
}

