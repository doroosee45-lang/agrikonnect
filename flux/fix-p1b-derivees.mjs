/* fix-p1b-derivees.mjs
 * Phase 1b -- Mission Design System : derives (TINTS/SURFACES/DARK, aliases),
 * geometrie kit (RADIUS, breakpoints, conteneur 1180), ombres retintees,
 * variables CSS de tokens.css (valeurs d'echelle + blocs structurels).
 * Portes md5 pre + post-empreintes verrouillees sur les 4 fichiers TS.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const GEN = process.argv.includes('--gen');

function md5Fichier(p) {
  return createHash('md5').update(readFileSync(p)).digest('hex');
}
function lire(p) {
  return readFileSync(p, 'utf8');
}
function porte(p, attendu) {
  const m = md5Fichier(p);
  if (m !== attendu) {
    console.log('ARRET_MD5 ' + p + ' = ' + m + ' (attendu ' + attendu + ')');
    process.exit(1);
  }
  console.log('porte OK ' + p);
}
function remplacer(p, motif, remplacement, foisAttendues) {
  const t = lire(p);
  const parts = t.split(motif);
  const fois = parts.length - 1;
  if (fois !== foisAttendues) {
    console.log('ARRET_ANCRE ' + p + ' : motif present ' + fois + ' fois (attendu ' + foisAttendues + ') -> ' + motif.slice(0, 60));
    process.exit(1);
  }
  writeFileSync(p, parts.join(remplacement));
  console.log('remplace x' + fois + ' dans ' + p + ' : ' + motif.slice(0, 50));
}
function verifie(p, contenu, present, absent) {
  for (const s of present) {
    if (!contenu.includes(s)) {
      console.log('ARRET_CONTENU ' + p + ' : absent -> ' + s);
      process.exit(1);
    }
  }
  for (const s of absent) {
    if (contenu.includes(s)) {
      console.log('ARRET_CONTENU ' + p + ' : residu interdit -> ' + s);
      process.exit(1);
    }
  }
}

/* ============================ 1. PORTES MD5 PRE ============================ */
if (!GEN) {
  porte('apps/web/src/theme/index.ts', '9efe0380b49c754cb3b1e553a8e65a86');
  porte('apps/Mobile/src/theme/colors.ts', 'a0169a4fa5efea45cb64fd8663e35c77');
  porte('apps/Mobile/src/theme/space.ts', '06119413c3468827402737196e737349');
  porte('apps/Mobile/src/theme/shadows.ts', 'e6a5c73d3f40d7a035472ecdfe46948d');
  porte('apps/web/src/theme/tokens.css', '5cf715f49d18b8b269bc94777992b151');
}

/* ==================== 2. apps/web/src/theme/index.ts ==================== */
const INDEX = [
  '/**',
  ' * Aliases web : les noms historiques de couleurs, geometrie et mouvement.',
  ' *',
  ' * Les noms sont historiques, les valeurs sont celles des jetons AGRIKONNECT',
  ' * (./agrikonnect, kit v1.0). 157 pages referencent ces noms ; ne pas les',
  ' * renommer. Pour du nouveau code, importer directement VERT, TERRE, CREME,',
  ' * ENCRE, SCIENTIFIQUE ou FONCTION.',
  ' *',
  ' * I3 : ecrire un code hexadecimal dans un composant reste interdit.',
  ' */',
  "import { VERT, TERRE, CREME, ENCRE, BLANC, ROUGE, SCIENTIFIQUE, FONCTION } from './agrikonnect';",
  '',
  '/**',
  ' * Couleurs de l application.',
  ' *',
  ' * Regle AA : quand une couleur du kit echoue au contraste texte, le role',
  ' * texte prend une etape derivee (VERT[700], TERRE[700], ROUGE[700],',
  ' * SCIENTIFIQUE[900]) et la couleur du kit reste aux remplissages via',
  ' * les roles *Surface et FONCTION.',
  ' */',
  'export const COLORS = {',
  '  /** Marque -- kit primary-900 #124c34. */',
  '  forestGreen: VERT[800],',
  '  /** kit primary-500 #239b68. */',
  '  livingGreen: VERT[500],',
  '  /** Accent en TEXTE -- terre-700 derive AA : 5,83:1 sur blanc. */',
  '  gold: TERRE[700],',
  '  /** Accent en SURFACE -- terre-400, texte encre-900 : 7,32:1. */',
  '  goldSurface: TERRE[400],',
  '  /** Texte a poser sur goldSurface. */',
  '  onGoldSurface: ENCRE[900],',
  '  /** Fond de page -- kit background #f5f8f5. */',
  '  naturalWhite: CREME[100],',
  "  pureWhite: '#FFFFFF',",
  '  paleGreen: VERT[100],',
  '  /** kit text-primary #17231d. 15,16:1 sur le fond. */',
  '  textPrimary: ENCRE[700],',
  '  /** kit text-secondary #64736a. 4,67:1 sur le fond. */',
  '  slateGray: ENCRE[500],',
  '  /** kit border #e3eae5. */',
  "  lightBorder: '#E3EAE5',",
  '  /** Succes en texte/icône -- vert-700 (5,70:1 sur vert-100). */',
  '  success: VERT[700],',
  '  /** Attention en texte -- terre-700 (4,57:1 sur terre-100). */',
  '  warning: TERRE[700],',
  '  /** Erreur en texte -- rouge-700 (6,01:1 sur rouge-50). */',
  '  error: ROUGE[700],',
  '  /** Information en texte -- kit scientific-900 (11,18:1 sur scientifique-100). */',
  '  info: SCIENTIFIQUE[900],',
  '  /** kit surface #ffffff : cartes et panneaux. */',
  "  surface: '#FFFFFF',",
  '  /** kit scientific-500 : remplissages et icones information. */',
  '  infoSurface: SCIENTIFIQUE[500],',
  '  /** kit disabled #a3ada6. */',
  '  desactive: FONCTION.desactive,',
  '} as const;',
  '',
  'export const TINTS = {',
  '  forestGreenBg: \'rgba(18, 76, 52, 0.1)\',',
  '  livingGreenBg: \'rgba(35, 155, 104, 0.1)\',',
  '  goldBg: \'rgba(208, 154, 85, 0.1)\',',
  '  infoBg: \'rgba(40, 120, 200, 0.1)\',',
  '} as const;',
  '',
  'export const SPACING = {',
  '  xs: 4,',
  '  sm: 8,',
  '  md: 16,',
  '  lg: 24,',
  '  xl: 32,',
  '  xxl: 48,',
  '  xxxl: 64,',
  '} as const;',
  '',
  '/** Rayons (kit 5) : sm 6, md 10, lg 12, xl 16, 2xl 20, pilule. */',
  'export const RADIUS = {',
  '  sm: 6,',
  '  md: 10,',
  '  lg: 12,',
  '  xl: 16,',
  '  xxl: 20,',
  '  pill: 999,',
  '} as const;',
  '',
  'export const LAYOUT = {',
  '  /** Largeur du conteneur, unifiee avec MOUVEMENT.conteneur et tokens.css. */',
  '  maxContentWidth: 1180,',
  '  headerHeight: 72,',
  '} as const;',
  '',
  '/** Breakpoints (kit 16) : mobile < 640, tablette 640-1023, desktop >= 1024. */',
  'export const BREAKPOINT = {',
  '  sm: 640,',
  '  md: 768,',
  '  lg: 1024,',
  '  xl: 1280,',
  '} as const;',
  '',
  'export const DURATION = {',
  '  fast: 150,',
  '  base: 250,',
  '  slow: 400,',
  '} as const;',
  '',
  'export const EASE = {',
  '  out: [0.16, 1, 0.3, 1] as const,',
  '  inOut: [0.65, 0, 0.35, 1] as const,',
  '};',
  '',
].join('\n');

writeFileSync('apps/web/src/theme/index.ts', INDEX);
console.log('ecrit apps/web/src/theme/index.ts');

/* ==================== 3. apps/Mobile/src/theme/colors.ts ==================== */
const COLORS = [
  '/**',
  ' * Palette de l application mobile : aliases des jetons AGRIKONNECT (kit v1.0).',
  ' *',
  ' * Les noms sont historiques, les valeurs sont celles de ./agrikonnect.',
  ' * 206 ecrans referencent ces noms ; ne pas les renommer. Pour du nouveau',
  ' * code, importer directement VERT, TERRE, CREME, ENCRE, SCIENTIFIQUE ou',
  ' * FONCTION.',
  ' *',
  ' * I3 : ecrire un code hexadecimal dans un ecran reste interdit.',
  ' * AA : les rôles texte prennent les etapes derivees ; les couleurs exactes',
  ' * du kit restent aux remplissages avec libelle (kit 2.2).',
  ' */',
  '',
  "import { VERT, TERRE, CREME, ENCRE, ROUGE, SCIENTIFIQUE, FONCTION } from './agrikonnect';",
  '',
  'export const COLORS = {',
  '  /** Marque -- kit primary-900 #124c34. */',
  '  forestGreen: VERT[800],',
  '  livingGreen: VERT[500],',
  '  /** Accent en TEXTE -- terre-700 derive AA. */',
  '  gold: TERRE[700],',
  '  /** Accent en SURFACE -- terre-400, texte encre-900 : 7,32:1. */',
  '  goldSurface: TERRE[400],',
  '  onGoldSurface: ENCRE[900],',
  '  /** Fond d ecran -- kit background #f5f8f5. */',
  '  naturalWhite: CREME[100],',
  "  pureWhite: '#FFFFFF',",
  '  paleGreen: VERT[100],',
  '  /** kit text-primary #17231d. 15,16:1 sur le fond. */',
  '  textPrimary: ENCRE[700],',
  '  slateGray: ENCRE[500],',
  '  /** kit border #e3eae5. */',
  "  lightBorder: '#E3EAE5',",
  '  success: VERT[700],',
  '  warning: TERRE[700],',
  '  error: ROUGE[700],',
  '  /** Information en texte -- kit scientific-900. */',
  '  info: SCIENTIFIQUE[900],',
  '  /** kit surface #ffffff : cartes et panneaux. */',
  "  surface: '#FFFFFF',",
  '  /** Bordure plus marquee, pour les boutons secondaires. */',
  "  bordureForte: 'rgba(18, 76, 52, 0.22)',",
  '} as const;',
  '',
  '/**',
  ' * Fonds de puces (B1) : les valeurs de la PALETTE, pas un calcul.',
  ' *',
  ' * Rôles et separations, avec les contrastes reels du kit v1.0 :',
  ' *   succes / mesure -> vert-100 #e6f3ec, texte vert-800 #124c34 : 8,72:1',
  ' *   information     -> scientifique-100 #e4eef8, texte #17324d : 11,18:1',
  ' *   attention       -> terre-100 #f0e2cc, texte terre-800 #6e4c1d : 6,06:1',
  ' *   erreur          -> rouge-50 #fef2f2, texte rouge-700 #b42318 : 6,01:1',
  ' *   neutre          -> creme-50 #fafbfa, texte encre-700 #17231d : 15,64:1',
  ' * La couleur ne code jamais seule le sens (A11) : libelle + icone.',
  ' */',
  'export const TINTS = {',
  '  successBg: VERT[100],',
  '  warningBg: TERRE[100],',
  '  errorBg: ROUGE[50],',
  '  infoBg: SCIENTIFIQUE[100],',
  '',
  '  goldBg: TERRE[100],',
  '  livingGreenBg: VERT[100],',
  '  forestGreenBg: VERT[100],',
  '',
  '  /** Voile utilise au-dessus des images (lisibilite du texte). */',
  "  scrimLight: 'rgba(18, 76, 52, 0.32)',",
  "  scrimStrong: 'rgba(14, 58, 41, 0.72)',",
  '} as const;',
  '',
  '/** Surfaces de l application (kit background/surface/border). */',
  'export const SURFACES = {',
  '  canvas: COLORS.naturalWhite,',
  '  card: COLORS.pureWhite,',
  "  cardMuted: '#FBFCF9',",
  '  border: COLORS.lightBorder,',
  "  borderSoft: '#EBF0EC',",
  '  text: COLORS.textPrimary,',
  '  textMuted: COLORS.slateGray,',
  '  accent: COLORS.forestGreen,',
  '  accentSoft: COLORS.paleGreen,',
  '} as const;',
  '',
  '/**',
  ' * Sections sombres : le vert de marque decline en profondeurs.',
  ' * Formule : mix(VERT[800] #124c34, noir, 30 % / 18 % / 6 %).',
  ' */',
  'export const DARK = {',
  "  bg: '#0d3524',",
  "  bgAlt: '#0f3e2b',",
  "  elevated: '#114731',",
  "  border: 'rgba(245, 248, 245, 0.14)',",
  "  borderStrong: 'rgba(245, 248, 245, 0.28)',",
  '  text: CREME[100],',
  "  textMuted: 'rgba(245, 248, 245, 0.68)',",
  "  textFaint: 'rgba(245, 248, 245, 0.45)',",
  '  gold: COLORS.goldSurface,',
  '  green: COLORS.livingGreen,',
  '} as const;',
  '',
  'export type ColorToken = keyof typeof COLORS;',
  '',
  'export const PALETTE_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [',
  '  { name: \'forestGreen\', hex: COLORS.forestGreen },',
  '  { name: \'livingGreen\', hex: COLORS.livingGreen },',
  '  { name: \'gold\', hex: COLORS.gold },',
  '  { name: \'naturalWhite\', hex: COLORS.naturalWhite },',
  '  { name: \'paleGreen\', hex: COLORS.paleGreen },',
  '  { name: \'textPrimary\', hex: COLORS.textPrimary },',
  '  { name: \'slateGray\', hex: COLORS.slateGray },',
  '  { name: \'lightBorder\', hex: COLORS.lightBorder },',
  '];',
  '',
].join('\n');

writeFileSync('apps/Mobile/src/theme/colors.ts', COLORS);
console.log('ecrit apps/Mobile/src/theme/colors.ts');

/* ==================== 4. apps/Mobile/src/theme/space.ts ==================== */
const SPACE = [
  '/**',
  ' * Rythme vertical, rayons et gabarits (kit 4-5).',
  ' * Rayons alignes sur l echelle du kit : sm 6, md 10, lg 12, xl 16, 2xl 20.',
  ' */',
  '',
  'export const SPACING = {',
  '  xs: 4,',
  '  sm: 8,',
  '  md: 12,',
  '  lg: 16,',
  '  xl: 24,',
  '  xxl: 32,',
  '  xxxl: 48,',
  '} as const;',
  '',
  '/** Rayons (kit 5). */',
  'export const RADIUS = {',
  '  sm: 6,',
  '  md: 10,',
  '  lg: 12,',
  '  xl: 16,',
  '  xxl: 20,',
  '  pill: 999,',
  '} as const;',
  '',
  '/** Marges d ecran et largeurs de contenu (le site public reste centre sur tablette). */',
  'export const LAYOUT = {',
  '  screenPadding: 20,',
  '  gutter: 12,',
  '  /** Unifie avec MOUVEMENT.conteneur et --max-content-width. */',
  '  maxContentWidth: 1180,',
  '  sectionGap: 64,',
  '  cardMinWidth: 260,',
  '  tabBarHeight: 68,',
  '  navbarHeight: 58,',
  '} as const;',
  '',
  '/** Breakpoints (kit 16) : mobile < 640, tablette 640-1023, desktop >= 1024. */',
  'export const BREAKPOINT = {',
  '  sm: 640,',
  '  md: 768,',
  '  lg: 1024,',
  '  xl: 1280,',
  '} as const;',
  '',
  '/** Tailles d icones normalisees : evite les tailles arbitraires dans les ecrans. */',
  'export const ICON_SIZE = {',
  '  xs: 14,',
  '  sm: 16,',
  '  md: 20,',
  '  lg: 24,',
  '  xl: 32,',
  '  hero: 48,',
  '} as const;',
  '',
  'export type SpacingToken = keyof typeof SPACING;',
  'export type RadiusToken = keyof typeof RADIUS;',
  '',
].join('\n');

writeFileSync('apps/Mobile/src/theme/space.ts', SPACE);
console.log('ecrit apps/Mobile/src/theme/space.ts');

/* ==================== 5. apps/Mobile/src/theme/shadows.ts ==================== */
const SHADOWS = [
  "import type { ViewStyle } from 'react-native';",
  '',
  "import { COLORS } from './colors';",
  "import { BLANC, CREME, TERRE, VERT } from './agrikonnect';",
  '',
  "const GREEN_SHADOW = 'rgba(18, 76, 52, 0.10)';",
  "const GREEN_SHADOW_SOFT = 'rgba(18, 76, 52, 0.06)';",
  '',
  '/**',
  ' * Ombres : volontairement vertes et diffuses plutot que grises,',
  ' * pour rester dans la charte (le vert de marque est la couleur d ombre).',
  ' */',
  "export const SHADOWS: Record<'hairline' | 'card' | 'lifted' | 'floating' | 'gold', ViewStyle> = {",
  '  hairline: {',
  '    shadowColor: GREEN_SHADOW_SOFT,',
  '    shadowOffset: { width: 0, height: 1 },',
  '    shadowOpacity: 1,',
  '    shadowRadius: 2,',
  '    elevation: 1,',
  '  },',
  '  card: {',
  '    shadowColor: GREEN_SHADOW_SOFT,',
  '    shadowOffset: { width: 0, height: 6 },',
  '    shadowOpacity: 1,',
  '    shadowRadius: 16,',
  '    elevation: 2,',
  '  },',
  '  lifted: {',
  '    shadowColor: GREEN_SHADOW,',
  '    shadowOffset: { width: 0, height: 14 },',
  '    shadowOpacity: 1,',
  '    shadowRadius: 28,',
  '    elevation: 6,',
  '  },',
  '  floating: {',
  '    shadowColor: GREEN_SHADOW,',
  '    shadowOffset: { width: 0, height: 20 },',
  '    shadowOpacity: 1,',
  '    shadowRadius: 40,',
  '    elevation: 10,',
  '  },',
  '  gold: {',
  "    shadowColor: 'rgba(208, 154, 85, 0.35)',",
  '    shadowOffset: { width: 0, height: 12 },',
  '    shadowOpacity: 1,',
  '    shadowRadius: 24,',
  '    elevation: 5,',
  '  },',
  '};',
  '',
  '/** Degradés réutilisables (expo-linear-gradient). */',
  'export const GRADIENTS = {',
  '  forest: [VERT[800], VERT[900]] as const,',
  "  forestSoft: ['#176b45', COLORS.forestGreen] as const,",
  '  gold: [TERRE[300], COLORS.goldSurface] as const,',
  '  leaf: [VERT[500], VERT[600]] as const,',
  "  scrimBottom: ['rgba(14, 58, 41, 0)', 'rgba(14, 58, 41, 0.85)'] as const,",
  "  scrimTop: ['rgba(14, 58, 41, 0.55)', 'rgba(14, 58, 41, 0)'] as const,",
  '  paper: [BLANC[95], CREME[50]] as const,',
  '} as const;',
  '',
].join('\n');

writeFileSync('apps/Mobile/src/theme/shadows.ts', SHADOWS);
console.log('ecrit apps/Mobile/src/theme/shadows.ts');

/* ==================== 6. tokens.css : structure + recoloration ==================== */
const CSS = 'apps/web/src/theme/tokens.css';

/* 6a. Blocs structurels (ancres exactes de l etat machine). */
remplacer(CSS,
  "  /* ====== Typographie ======\n     AUCUNE police n'est téléchargée (I4) : pas de CDN, pas de @font-face. Les\n     deux familles sont des piles système. 'Inter' et 'Space Grotesk' étaient\n     nommées ici alors qu'aucun fichier n'était chargé : le rendu était déjà\n     système, mais le nom mentait. Il est retiré. */\n  --font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto,\n    Helvetica, Arial, sans-serif;\n  --font-display: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;",
  "  /* ====== Typographie (kit 3) ======\n     Deux familles seulement : Inter pour tout le texte, JetBrains Mono pour les\n     coordonnees, mesures et identifiants techniques. Les polices sont chargees\n     via Google Fonts (index.html). Aucune autre famille. */\n  --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto,\n    Helvetica, Arial, sans-serif;\n  --font-display: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto,\n    Helvetica, Arial, sans-serif;\n  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;",
  1);
remplacer(CSS, '  --texte-titre-page: 26px;', '  --texte-titre-page: 30px;', 1);
remplacer(CSS, '  --texte-titre-page-large: 32px;', '  --texte-titre-page-large: 36px;', 1);
remplacer(CSS, '  --texte-sous-titre: 17px;', '  --texte-sous-titre: 20px;', 1);
remplacer(CSS, '  --light-border: rgba(18, 61, 42, 0.1);', '  --light-border: #e3eae5;', 1);
remplacer(CSS, '  --success: var(--vert-600);', '  --success: var(--vert-700);', 1);
remplacer(CSS, '  --warning: var(--terre-500);', '  --warning: var(--terre-700);', 1);
remplacer(CSS, '  --info: var(--encre-700);', '  --info: var(--scientifique-900);', 1);
remplacer(CSS, '  --forest-green-10: rgba(18, 61, 42, 0.1);', '  --forest-green-10: rgba(18, 76, 52, 0.1);', 1);
remplacer(CSS, '  --living-green-10: rgba(75, 127, 99, 0.1);', '  --living-green-10: rgba(35, 155, 104, 0.1);', 1);
remplacer(CSS, '  --gold-10: rgba(156, 68, 35, 0.1);', '  --gold-10: rgba(138, 91, 34, 0.1);', 1);
remplacer(CSS, '  --info-10: rgba(51, 64, 58, 0.1);', '  --info-10: rgba(23, 50, 77, 0.1);', 1);
remplacer(CSS,
  '  --radius-sm: 8px;\n  --radius-md: 12px;\n  --radius-lg: 16px;\n  --radius-xl: 24px;\n  --radius-pill: 999px;',
  '  --radius-sm: 6px;\n  --radius-md: 10px;\n  --radius-lg: 12px;\n  --radius-xl: 16px;\n  --radius-2xl: 20px;\n  --radius-pill: 999px;',
  1);
remplacer(CSS,
  '  --max-content-width: 1152px;',
  '  --max-content-width: 1180px;\n  --breakpoint-sm: 640px;\n  --breakpoint-md: 768px;\n  --breakpoint-lg: 1024px;\n  --breakpoint-xl: 1280px;',
  1);
remplacer(CSS,
  '  --rouge-800: #7d231d;',
  '  --rouge-800: #7d231d;\n\n  /* ====== Scientifique -- information (kit scientific) ====== */\n  --scientifique-50: #f2f7fc;\n  --scientifique-100: #e4eef8;\n  --scientifique-500: #2878c8;\n  --scientifique-900: #17324d;\n\n  /* ====== Fonctionnelles du kit (2.2) ====== */\n  --fonction-succes: #16a34a;\n  --fonction-attention: #e59a23;\n  --fonction-erreur: #dc4545;\n  --fonction-info: #2878c8;\n  --fonction-desactive: #a3ada6;',
  1);

/* 6b. Recoloration des valeurs d echelle (une passe, sans cascade). */
const HEX = {
  '#f2f7f4': '#f2f8f4', '#e0ece5': '#e6f3ec', '#c2d9cb': '#c6e0d2', '#9cbfaa': '#9bc7b0',
  '#6f9e83': '#63ae8b', '#4b7f63': '#239b68', '#2f6249': '#1b7f55', '#1e4f38': '#176b45',
  '#123d2a': '#124c34', '#0e3022': '#0e3a29', '#071a12': '#08241a',
  '#fbf4ef': '#f7efe5', '#f5e3d8': '#f0e2cc', '#e9c4ac': '#e2c79b', '#e0a982': '#d6ac72',
  '#db8a4c': '#d09a55', '#c46f33': '#c58b42', '#b05a27': '#a5722f', '#9c4423': '#8a5b22',
  '#7d3620': '#6e4c1d', '#5f2a1a': '#523a17',
  '#fdfbf6': '#fafbfa', '#faf6ec': '#f5f8f5', '#f0e8d8': '#e7ede8', '#e2d6c0': '#d4dcd6',
  '#5c665f': '#64736a', '#33403a': '#17231d', '#1f2a24': '#0f1712',
  '#fbe4e2': '#fadedd', '#eda9a3': '#eea29e', '#e07a72': '#e2716b', '#cf4f45': '#dc4545',
  '#b91c1c': '#b42318', '#7d231d': '#8e1b12',
};
const RGB = {
  'rgba(18, 61, 42': 'rgba(18, 76, 52',
  'rgba(14, 48, 34': 'rgba(14, 58, 41',
  'rgba(36, 53, 43': 'rgba(23, 35, 29',
  'rgba(250, 246, 236': 'rgba(245, 248, 245',
  'rgba(23, 77, 53': 'rgba(18, 76, 52',
  'rgba(101, 166, 75': 'rgba(35, 155, 104',
  'rgba(214, 166, 79': 'rgba(208, 154, 85',
  'rgba(62, 110, 142': 'rgba(40, 120, 200',
  'rgba(219, 138, 76': 'rgba(208, 154, 85',
};
function recolorer(texte) {
  let total = 0;
  const out = texte.replace(/#[0-9a-fA-F]{6}/g, (m) => {
    const k = m.toLowerCase();
    if (HEX[k]) {
      total += 1;
      return HEX[k];
    }
    return m;
  });
  let totalRgb = 0;
  let out2 = out;
  for (const [avant, apres] of Object.entries(RGB)) {
    const parts = out2.split(avant);
    const fois = parts.length - 1;
    if (fois > 0) {
      totalRgb += fois;
      out2 = parts.join(apres);
      console.log('rgba x' + fois + ' : ' + avant + ' -> ' + apres);
    }
  }
  console.log('recoloration : ' + total + ' valeurs hex remplacees, ' + totalRgb + ' motifs rgba');
  return out2;
}
writeFileSync(CSS, recolorer(lire(CSS)));
console.log('tokens.css mis a jour');

/* ==================== 7. CONTROLES + POST-EMPREINTES + CENSUS ==================== */
const idx = lire('apps/web/src/theme/index.ts');
verifie('index.ts', idx,
  ["lightBorder: '#E3EAE5'", 'SCIENTIFIQUE[900]', 'BREAKPOINT', 'xxl: 20', 'desactive'],
  ['#123d2a', 'rgba(18, 61, 42', 'BLANC[85]']);
const col = lire('apps/Mobile/src/theme/colors.ts');
verifie('colors.ts', col,
  ["lightBorder: '#E3EAE5'", 'SCIENTIFIQUE[100]', "bg: '#0d3524'", '8,72:1', 'bordureForte'],
  ['#123d2a', '#faf6ec', 'rgba(18, 61, 42', '10,02:1']);
const spa = lire('apps/Mobile/src/theme/space.ts');
verifie('space.ts', spa,
  ['BREAKPOINT', 'maxContentWidth: 1180', 'export const RADIUS = {\n  sm: 6,\n  md: 10,\n  lg: 12,\n  xl: 16,\n  xxl: 20,\n  pill: 999,'],
  ['export const RADIUS = {\n  sm: 8,']);
const sha = lire('apps/Mobile/src/theme/shadows.ts');
verifie('shadows.ts', sha, ["'rgba(18, 76, 52, 0.10)'", "'rgba(208, 154, 85, 0.35)'", '#176b45'], ['rgba(23, 77, 53', 'rgba(219, 138, 76', '#1B5A3E']);
const css = lire(CSS);
verifie('tokens.css', css,
  ['--scientifique-500: #2878c8;', '--fonction-succes: #16a34a;', '--font-mono:', '--radius-2xl: 20px;', '--breakpoint-sm: 640px;', '--max-content-width: 1180px;', '--vert-800: #124c34;'],
  ['--vert-800: #123d2a;', '#faf6ec', 'ui-serif', 'Space Grotesk']);

const cibles = [
  'apps/web/src/theme/index.ts',
  'apps/Mobile/src/theme/colors.ts',
  'apps/Mobile/src/theme/space.ts',
  'apps/Mobile/src/theme/shadows.ts',
  'apps/web/src/theme/tokens.css',
];
const attendus = {
  'apps/web/src/theme/index.ts': '257b3b5fb2e1e5f33485af8f5f3082de',
  'apps/Mobile/src/theme/colors.ts': 'ef69240c06549137d36e2b87652e2f4f',
  'apps/Mobile/src/theme/space.ts': '85915ab3482f0d3380e11c6db2bfff7f',
  'apps/Mobile/src/theme/shadows.ts': '11ebec767e463f928f2d311f3a5e11df',
};
console.log('--- post-empreintes (verrou) ---');
for (const p of cibles) {
  const m = md5Fichier(p);
  const a = attendus[p];
  if (a && m !== a) {
    console.log('ARRET_POST_MD5 ' + p + ' = ' + m + ' (attendu ' + a + ')');
    process.exit(1);
  }
  console.log(m + ' *' + p);
}

/* Census : hex et rgba restants hors palette (matiere du P1c si besoin). */
const BLANCHE = new Set(Object.values(HEX).concat(Object.keys(HEX), [
  '#ffffff', '#e3eae5', '#f2f7fc', '#e4eef8', '#2878c8', '#17324d', '#16a34a', '#e59a23',
  '#dc4545', '#a3ada6', '#176b45', '#f2f8f4', '#e6f3ec', '#124c34', '#239b68',
]));
const vus = new Map();
for (const m of css.matchAll(/#[0-9a-fA-F]{6}/g)) {
  const k = m[0].toLowerCase();
  if (!BLANCHE.has(k)) {
    vus.set(k, (vus.get(k) || 0) + 1);
  }
}
console.log('--- census hex hors palette (tokens.css) ---');
for (const [k, n] of [...vus.entries()].sort()) {
  console.log('  ' + k + ' x' + n);
}
if (vus.size === 0) {
  console.log('  aucun residu');
}
console.log('P1B_TERMINE');
