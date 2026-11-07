import type { TextStyle } from 'react-native';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useGroteskFonts,
} from '@expo-google-fonts/space-grotesk';

export const FONT = {
  display: {
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
} as const;

/** Charge les deux familles en une fois ; à appeler une seule fois, à la racine. */
export function useAppFonts() {
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [groteskLoaded] = useGroteskFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  return interLoaded && groteskLoaded;
}

type Preset = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: TextStyle['textTransform'];
};

const PRESETS = {
  heroDisplay: {
    fontFamily: FONT.display.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.1,
  },
  display: {
    fontFamily: FONT.display.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  h1: { fontFamily: FONT.display.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontFamily: FONT.display.semibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  h3: { fontFamily: FONT.display.medium, fontSize: 17, lineHeight: 23 },
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
} satisfies Record<string, Preset>;

export type TypePreset = keyof typeof PRESETS;

/** Retourne le style complet d'un preset ; `override` gagne toujours. */
export function type(preset: TypePreset, override?: TextStyle): TextStyle {
  return { ...PRESETS[preset], ...override };
}

export const TYPO = PRESETS;
