import type { TextStyle } from 'react-native';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  useFonts as useJetBrainsFonts,
} from '@expo-google-fonts/jetbrains-mono';

/**
 * Typographie (kit 3) : Inter pour le texte et les titres, JetBrains Mono
 * pour le technique (coordonnees, mesures, identifiants). L ancienne police
 * display est retiree. Les noms FONT.display sont conserves pour les appels existants.
 */
export const FONT = {
  display: {
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  mono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
  },
} as const;

/** Charge les deux familles en une fois ; a appeler une seule fois, a la racine. */
export function useAppFonts() {
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [jetBrainsLoaded] = useJetBrainsFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  return interLoaded && jetBrainsLoaded;
}

type Preset = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: TextStyle['textTransform'];
};

/** Presets alignes sur les gammes du kit 3 (H1 30-36, H2 24-28, H3 18-22, corps 14-16, petit 12-13, caption 11-12). */
const PRESETS = {
  heroDisplay: {
    fontFamily: FONT.display.bold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  display: {
    fontFamily: FONT.display.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  h1: { fontFamily: FONT.display.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontFamily: FONT.display.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  h3: { fontFamily: FONT.display.medium, fontSize: 20, lineHeight: 26 },
  lead: { fontFamily: FONT.body.regular, fontSize: 16, lineHeight: 25 },
  body: { fontFamily: FONT.body.regular, fontSize: 15, lineHeight: 23 },
  bodyMedium: { fontFamily: FONT.body.medium, fontSize: 15, lineHeight: 23 },
  bodySm: { fontFamily: FONT.body.regular, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: FONT.body.medium, fontSize: 12, lineHeight: 17 },
  overline: {
    fontFamily: FONT.body.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  button: { fontFamily: FONT.body.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.1 },
  numeric: { fontFamily: FONT.display.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  /** Valeurs techniques (kit 3) : coordonnees, mesures, identifiants. */
  technique: { fontFamily: FONT.mono.regular, fontSize: 13, lineHeight: 18 },
} satisfies Record<string, Preset>;

export type TypePreset = keyof typeof PRESETS;

/** Retourne le style complet d un preset ; `override` gagne toujours. */
export function type(preset: TypePreset, override?: TextStyle): TextStyle {
  return { ...PRESETS[preset], ...override };
}

export const TYPO = PRESETS;
