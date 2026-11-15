/* fix-p1a-couleurs-typo.mjs
 * Phase 1a -- Mission Design System : repointage couleur kit v1.0 + typo
 * Inter/JetBrains Mono (Space Grotesk retire). Ecritures totales des deux
 * agrikonnect.ts (contenu canonique identique), typography.ts mobile,
 * regeneration de design-tokens.json, retouche de index.html.
 * Portes md5 pre (etat machine connu) + post-empreintes affichees.
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
  porte('apps/web/src/theme/agrikonnect.ts', '1b46ced1a71a85a6cad6e7616445109f');
  porte('apps/Mobile/src/theme/agrikonnect.ts', 'fc1e4b014dd81f15f4ed717b81fb3a3e');
  porte('apps/Mobile/src/theme/typography.ts', 'ea581c9b51e9e6bb17a4465ec6c8d7e6');
  porte('design-tokens.json', 'db03194be7a1537b2699efe213a78906');
  const idx = lire('apps/web/index.html');
  if (!idx.includes('family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700') || !idx.includes('content="#174D35"')) {
    console.log('ARRET_ANCRE index.html : ancres polices/theme-color introuvables');
    process.exit(1);
  }
  console.log('porte OK apps/web/index.html (ancres)');
}

/* ==================== 2. AGRIKONNECT.TS (canonique) ==================== */
const AGRI = [
  '/**',
  ' * Jetons AGRIKONNECT AFRICA -- source de verite des valeurs.',
  ' *',
  ' * Source normative : UI KIT & DESIGN SYSTEM AGRIKONNECT AFRICA v1.0',
  ' * (sections 2 a 5), valide le 2026-11-05. Il remplace la charte V1-V5',
  " * et les decisions D1/D2 : design-tokens.json se regenere desormais depuis",
  ' * ce fichier, avec les valeurs du kit.',
  ' *',
  ' * ## Pourquoi ce fichier coexiste avec les alias',
  ' *',
  " * L'application existante nomme ses couleurs autrement (forestGreen, gold,",
  ' * naturalWhite...) et 157 pages web plus 206 ecrans mobile s y referencent.',
  ' * Les renommer d un coup serait une regression silencieuse. index.ts (web) et',
  ' * colors.ts (mobile) repointent donc leurs ancres vers les valeurs ci-dessous :',
  " * l'identite bascule partout en une fois, sans toucher aux ecrans. Les anciens",
  ' * noms restent des alias.',
  ' *',
  ' * Ce fichier est IDENTIQUE sur les deux plateformes (apps/web et apps/Mobile).',
  ' * Toute modification se fait dans les deux.',
  ' *',
  ' * ## Regles',
  ' *',
  " * I3 -- ecrire un code hexadecimal dans un composant reste interdit : on",
  ' * importe VERT[800], ou on utilise la variable CSS --vert-800.',
  ' * AA -- quand une couleur du kit echoue au contraste texte (4,5:1), le ROLE',
  ' * texte prend une valeur derivee plus foncee ; la couleur du kit reste',
  ' * reservee aux remplissages, filets et icones avec libelle (kit 2.2).',
  ' */',
  '',
  '/* ====== Vert -- marque (kit primary) ====== */',
  '',
  'export const VERT = {',
  '  /** kit primary-50 -- surface legere. */',
  "  50: '#f2f8f4',",
  '  /** kit primary-100 -- fond vert leger. */',
  "  100: '#e6f3ec',",
  '  /** Derive (interpolation). */',
  "  200: '#c6e0d2',",
  '  /** Derive. */',
  "  300: '#9bc7b0',",
  '  /** Derive. */',
  "  400: '#63ae8b',",
  '  /** kit primary-500 -- vert secondaire. */',
  "  500: '#239b68',",
  '  /** Derive. */',
  "  600: '#1b7f55',",
  '  /** kit primary-700 -- vert principal. */',
  "  700: '#176b45',",
  '  /** kit primary-900 (vert fonce) -- la marque. C est cette valeur, pas une autre. */',
  "  800: '#124c34',",
  '  /** Texte titre (derive fonce). 11,85:1 sur le fond. */',
  "  900: '#0e3a29',",
  '  /** Derive. */',
  "  950: '#08241a',",
  '} as const;',
  '',
  '/* ====== Terre -- accent (kit earth) ====== */',
  '',
  'export const TERRE = {',
  '  /** Derives de la teinte earth du kit. */',
  "  50: '#f7efe5',",
  "  100: '#f0e2cc',",
  "  200: '#e2c79b',",
  "  300: '#d6ac72',",
  '  /** Traits, filets et l accent utilise en SURFACE. */',
  "  400: '#d09a55',",
  '  /** kit earth-500 -- agriculture et terre. Remplissages et filets. */',
  "  500: '#c58b42',",
  '  /** Derive. */',
  "  600: '#a5722f',",
  '  /** Derive AA -- l accent en TEXTE : 5,45:1 sur le fond, 5,83:1 sur blanc.',
  '   *  kit earth-500 ne tient pas AA en texte (2,34:1) : voir regle AA. */',
  "  700: '#8a5b22',",
  '  /** Derive. */',
  "  800: '#6e4c1d',",
  "  900: '#523a17',",
  '} as const;',
  '',
  '/* ====== Creme -- fonds ====== */',
  '',
  'export const CREME = {',
  "  50: '#fafbfa',",
  '  /** kit background -- le fond de page. */',
  "  100: '#f5f8f5',",
  "  200: '#e7ede8',",
  "  300: '#d4dcd6',",
  '} as const;',
  '',
  '/* ====== Encre -- texte ====== */',
  '',
  'export const ENCRE = {',
  '  /** kit text-secondary. 4,67:1 sur le fond. */',
  "  500: '#64736a',",
  '  /** kit text-primary -- le texte courant. Jamais de noir pur. 15,16:1. */',
  "  700: '#17231d',",
  '  /** Titres sur surface claire (derive fonce). */',
  "  900: '#0f1712',",
  '} as const;',
  '',
  '/* ====== Blanc -- surfaces, en opacite ====== */',
  '',
  'export const BLANC = {',
  "  40: 'rgba(255, 255, 255, 0.40)',",
  "  55: 'rgba(255, 255, 255, 0.55)',",
  "  70: 'rgba(255, 255, 255, 0.70)',",
  "  85: 'rgba(255, 255, 255, 0.85)',",
  "  95: 'rgba(255, 255, 255, 0.95)',",
  '} as const;',
  '',
  '/* ====== Rouge -- l erreur ====== */',
  '',
  'export const ROUGE = {',
  '  /** Fond d erreur. */',
  "  50: '#fef2f2',",
  "  100: '#fadedd',",
  "  300: '#eea29e',",
  "  400: '#e2716b',",
  '  /** kit error -- remplissages, filets, icones avec libelle. */',
  "  500: '#dc4545',",
  '  /** Derive AA -- l erreur en TEXTE : 6,01:1 sur rouge-50. */',
  "  700: '#b42318',",
  "  800: '#8e1b12',",
  '} as const;',
  '',
  '/* ====== Scientifique -- information (kit scientific) ====== */',
  '',
  'export const SCIENTIFIQUE = {',
  "  50: '#f2f7fc',",
  "  100: '#e4eef8',",
  '  /** kit scientific-500 -- information. */',
  "  500: '#2878c8',",
  '  /** kit scientific-900 -- information en texte : 11,18:1 sur scientifique-100. */',
  "  900: '#17324d',",
  '} as const;',
  '',
  '/* ====== Fonctionnelles du kit (2.2) ====== */',
  '/**',
  ' * Valeurs EXACTES du kit. Reservees aux remplissages, filets et icones ;',
  ' * chaque usage porte un libelle (jamais la couleur seule). Les usages texte',
  ' * prennent les etapes derivees AA (VERT[700], TERRE[700], ROUGE[700],',
  ' * SCIENTIFIQUE[900]).',
  ' */',
  'export const FONCTION = {',
  "  succes: '#16a34a',",
  "  attention: '#e59a23',",
  "  erreur: '#dc4545',",
  "  info: '#2878c8',",
  "  desactive: '#a3ada6',",
  '} as const;',
  '',
  '/**',
  ' * Semantique metier imposee.',
  ' *',
  ' * Un badge porte UN etat. Jamais deux couleurs de sens oppose dans le meme',
  ' * badge, et jamais une information portee par la couleur seule (A11) : le',
  ' * libelle et l icone accompagnent toujours.',
  ' */',
  'export const SEMANTIQUE = {',
  '  fiabiliteBasse: { fond: TERRE[100], texte: TERRE[800] },',
  '  fiabiliteHaute: { fond: VERT[100], texte: VERT[800] },',
  '  identiteVerifiee: VERT[600],',
  '  /** Usage non textuel (filets, remplissages) : terre-500. */',
  '  identiteEnAttente: TERRE[500],',
  '  annonceActive: { fond: VERT[100], texte: VERT[800] },',
  '  annonceExpiree: { fond: CREME[200], texte: ENCRE[500] },',
  '  erreur: ROUGE[700],',
  '} as const;',
  '',
  '/**',
  ' * Typographie.',
  ' *',
  ' * kit 3 : deux familles seulement. Inter pour tout le texte, titres compris ;',
  ' * JetBrains Mono pour les coordonnees GPS, mesures scientifiques, identifiants',
  ' * de parcelles et valeurs techniques. Aucune autre famille (l ancienne police',
  ' * display est retiree). Les polices sont chargees via index.html (web) et',
  ' * @expo-google-fonts (mobile).',
  ' */',
  'export const TEXTE = {',
  '  sans: \'"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif\',',
  '  mono: \'"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace\',',
  '  /** Alias historique (anciennement serif) : renvoie a Inter. Ne plus employer. */',
  '  serif: \'"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif\',',
  '} as const;',
  '',
  '/**',
  ' * Echelle autorisee (kit 3), en pixels.',
  ' *',
  ' * Six tailles maximum par ecran. Toute valeur hors de cette liste doit etre',
  ' * justifiee.',
  ' */',
  'export const TAILLES = {',
  '  /** H1 kit (30-36) -- titre de page. */',
  '  titrePage: 30,',
  '  titrePageLarge: 36,',
  '  /** H2 kit (24-28) -- titre de section. */',
  '  titreSection: 24,',
  '  /** H3 kit (18-22) -- sous-titre de carte. */',
  '  sousTitre: 20,',
  '  /** Corps de texte (kit 14-16). */',
  '  corps: 15,',
  '  corpsBase: 16,',
  '  /** Corps dense : tableaux, listes (kit 12-13). */',
  '  dense: 12.5,',
  '  /** Aide sous un champ. */',
  '  aide: 12,',
  '  /** Sur-titre en majuscules (kit caption 11-12). */',
  '  surtitre: 11,',
  '  /** Mention legale. */',
  '  mention: 11.5,',
  '} as const;',
  '',
  '/* ====== Geometrie ====== */',
  '',
  'export const RAYON = {',
  '  /** Cartes : 20 px (kit radius-2xl). */',
  '  carte: 20,',
  '  /** Champs : 12 px (kit radius-lg). */',
  '  champ: 12,',
  '  pilule: 999,',
  '} as const;',
  '',
  'export const ESPACEMENT = {',
  '  xs: 4,',
  '  sm: 8,',
  '  md: 16,',
  '  lg: 24,',
  '  xl: 32,',
  '  xxl: 48,',
  '} as const;',
  '',
  '/**',
  ' * Cibles tactiles minimales.',
  ' *',
  ' * 44 px sur le web, 48 pt sur mobile (I14). Ces valeurs ne se reduisent pas',
  ' * pour faire tenir une mise en page : on agrandit la zone, pas seulement',
  " * l'icone.",
  ' */',
  'export const TACTILE = {',
  '  web: 44,',
  '  mobile: 48,',
  '  ecart: 8,',
  '} as const;',
  '',
  '/**',
  ' * Mouvement.',
  ' *',
  ' * Seuls opacity et transform s animent (I5). Animer height, width, top, left,',
  ' * margin, box-shadow ou filter est interdit. La courbe est imposee, et tout',
  ' * doit etre neutralise quand le systeme demande de reduire les animations.',
  ' */',
  'export const MOUVEMENT = {',
  "  /** Courbe imposee -- ne pas en inventer d autre. */",
  "  courbe: 'cubic-bezier(.22,.61,.36,1)',",
  '  /** Apparition au defilement. */',
  '  apparition: 700,',
  '  /** Translation de l apparition. */',
  '  decalage: 22,',
  '  /** Transition d ecran. */',
  '  ecran: 500,',
  '  /** Survol de carte. */',
  '  carte: 300,',
  '  /** Echelonnement dans une grille : 40 a 90 ms, jamais plus de 140. */',
  '  echelonnement: 70,',
  '  echelonnementMax: 140,',
  '  /** Zoom de photo. */',
  '  zoomPhoto: 1200,',
  '  /** Largeur du conteneur (unifiee avec LAYOUT.maxContentWidth). */',
  '  conteneur: 1180,',
  '} as const;',
  '',
].join('\n');

writeFileSync('apps/web/src/theme/agrikonnect.ts', AGRI);
writeFileSync('apps/Mobile/src/theme/agrikonnect.ts', AGRI);
console.log('ecrit agrikonnect.ts web + mobile (contenu canonique identique)');

/* ==================== 3. TYPOGRAPHY.TS MOBILE ==================== */
const TYPO = [
  "import type { TextStyle } from 'react-native';",
  '',
  'import {',
  '  Inter_400Regular,',
  '  Inter_500Medium,',
  '  Inter_600SemiBold,',
  '  Inter_700Bold,',
  '  useFonts as useInterFonts,',
  "} from '@expo-google-fonts/inter';",
  'import {',
  '  JetBrainsMono_400Regular,',
  '  JetBrainsMono_500Medium,',
  '  useFonts as useJetBrainsFonts,',
  "} from '@expo-google-fonts/jetbrains-mono';",
  '',
  '/**',
  ' * Typographie (kit 3) : Inter pour le texte et les titres, JetBrains Mono',
  ' * pour le technique (coordonnees, mesures, identifiants). L ancienne police',
  ' * display est retiree. Les noms FONT.display sont conserves pour les appels existants.',
  ' */',
  'export const FONT = {',
  '  display: {',
  "    medium: 'Inter_500Medium',",
  "    semibold: 'Inter_600SemiBold',",
  "    bold: 'Inter_700Bold',",
  '  },',
  '  body: {',
  "    regular: 'Inter_400Regular',",
  "    medium: 'Inter_500Medium',",
  "    semibold: 'Inter_600SemiBold',",
  "    bold: 'Inter_700Bold',",
  '  },',
  '  mono: {',
  "    regular: 'JetBrainsMono_400Regular',",
  "    medium: 'JetBrainsMono_500Medium',",
  '  },',
  '} as const;',
  '',
  '/** Charge les deux familles en une fois ; a appeler une seule fois, a la racine. */',
  'export function useAppFonts() {',
  '  const [interLoaded] = useInterFonts({',
  '    Inter_400Regular,',
  '    Inter_500Medium,',
  '    Inter_600SemiBold,',
  '    Inter_700Bold,',
  '  });',
  '  const [jetBrainsLoaded] = useJetBrainsFonts({',
  '    JetBrainsMono_400Regular,',
  '    JetBrainsMono_500Medium,',
  '  });',
  '  return interLoaded && jetBrainsLoaded;',
  '}',
  '',
  'type Preset = {',
  '  fontFamily: string;',
  '  fontSize: number;',
  '  lineHeight: number;',
  '  letterSpacing?: number;',
  "  textTransform?: TextStyle['textTransform'];",
  '};',
  '',
  '/** Presets alignes sur les gammes du kit 3 (H1 30-36, H2 24-28, H3 18-22, corps 14-16, petit 12-13, caption 11-12). */',
  'const PRESETS = {',
  '  heroDisplay: {',
  '    fontFamily: FONT.display.bold,',
  '    fontSize: 36,',
  '    lineHeight: 42,',
  '    letterSpacing: -0.8,',
  '  },',
  '  display: {',
  '    fontFamily: FONT.display.bold,',
  '    fontSize: 30,',
  '    lineHeight: 36,',
  '    letterSpacing: -0.6,',
  '  },',
  '  h1: { fontFamily: FONT.display.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },',
  '  h2: { fontFamily: FONT.display.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },',
  '  h3: { fontFamily: FONT.display.medium, fontSize: 20, lineHeight: 26 },',
  '  lead: { fontFamily: FONT.body.regular, fontSize: 16, lineHeight: 25 },',
  '  body: { fontFamily: FONT.body.regular, fontSize: 15, lineHeight: 23 },',
  '  bodyMedium: { fontFamily: FONT.body.medium, fontSize: 15, lineHeight: 23 },',
  '  bodySm: { fontFamily: FONT.body.regular, fontSize: 13, lineHeight: 20 },',
  '  caption: { fontFamily: FONT.body.medium, fontSize: 12, lineHeight: 17 },',
  '  overline: {',
  '    fontFamily: FONT.body.semibold,',
  '    fontSize: 11,',
  '    lineHeight: 14,',
  '    letterSpacing: 1.4,',
  "    textTransform: 'uppercase',",
  '  },',
  '  button: { fontFamily: FONT.body.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.1 },',
  '  numeric: { fontFamily: FONT.display.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },',
  '  /** Valeurs techniques (kit 3) : coordonnees, mesures, identifiants. */',
  '  technique: { fontFamily: FONT.mono.regular, fontSize: 13, lineHeight: 18 },',
  '} satisfies Record<string, Preset>;',
  '',
  'export type TypePreset = keyof typeof PRESETS;',
  '',
  "/** Retourne le style complet d un preset ; `override` gagne toujours. */",
  'export function type(preset: TypePreset, override?: TextStyle): TextStyle {',
  '  return { ...PRESETS[preset], ...override };',
  '}',
  '',
  'export const TYPO = PRESETS;',
  '',
].join('\n');

writeFileSync('apps/Mobile/src/theme/typography.ts', TYPO);
console.log('ecrit apps/Mobile/src/theme/typography.ts');

/* ==================== 4. DESIGN-TOKENS.JSON (regenere) ==================== */
const dt = {
  $schema: 'https://tr.designtokens.org/format/',
  meta: {
    produit: 'AGRIKONNECT AFRICA',
    genere: '2026-11-05',
    source: "UI KIT & DESIGN SYSTEM AGRIKONNECT AFRICA v1.0 (sections 2-5) + apps/web/src/theme/agrikonnect.ts (copie identique : apps/Mobile/src/theme/agrikonnect.ts)",
    statut: "Ce fichier DOCUMENTE l'echelle generee par agrikonnect.ts. La source de verite reste le code. Toute modification se fait dans le code, puis ce fichier est regenere.",
    historique: "La charte V1-V5 et la reference programme (decisions D1/D2, ancienne section d ecarts) sont supersedees par le kit v1.0 valide le 2026-11-05.",
  },
  couleurs: {
    vert: {
      50: '#f2f8f4', 100: '#e6f3ec', 200: '#c6e0d2', 300: '#9bc7b0', 400: '#63ae8b',
      500: '#239b68', 600: '#1b7f55', 700: '#176b45', 800: '#124c34', 900: '#0e3a29', 950: '#08241a',
    },
    terre: {
      50: '#f7efe5', 100: '#f0e2cc', 200: '#e2c79b', 300: '#d6ac72', 400: '#d09a55',
      500: '#c58b42', 600: '#a5722f', 700: '#8a5b22', 800: '#6e4c1d', 900: '#523a17',
    },
    creme: { 50: '#fafbfa', 100: '#f5f8f5', 200: '#e7ede8', 300: '#d4dcd6' },
    encre: { 500: '#64736a', 700: '#17231d', 900: '#0f1712' },
    blanc: {
      40: 'rgba(255, 255, 255, 0.40)', 55: 'rgba(255, 255, 255, 0.55)',
      70: 'rgba(255, 255, 255, 0.70)', 85: 'rgba(255, 255, 255, 0.85)', 95: 'rgba(255, 255, 255, 0.95)',
    },
    rouge: {
      50: '#fef2f2', 100: '#fadedd', 300: '#eea29e', 400: '#e2716b',
      500: '#dc4545', 700: '#b42318', 800: '#8e1b12',
    },
    scientifique: { 50: '#f2f7fc', 100: '#e4eef8', 500: '#2878c8', 900: '#17324d' },
  },
  fonction: {
    succes: '#16a34a', attention: '#e59a23', erreur: '#dc4545', info: '#2878c8', desactive: '#a3ada6',
    note: 'Valeurs exactes du kit 2.2 : remplissages, filets, icones avec libelle. Usages texte : etapes derivees AA.',
  },
  roles: {
    fond: { valeur: '#f5f8f5', note: 'kit background.' },
    surface: { valeur: '#ffffff', note: 'kit surface : cartes et panneaux poses sur le fond.' },
    bordure: { valeur: '#e3eae5', note: 'kit border.' },
    titre: { valeur: '#0e3a29', note: 'vert-900 derive. 11,85:1 sur le fond.' },
    texte: { valeur: '#17231d', note: 'kit text-primary. 15,16:1 sur le fond.' },
    texteSecondaire: { valeur: '#64736a', note: 'kit text-secondary. 4,67:1 sur le fond.' },
    marque: { valeur: '#124c34', note: 'kit primary-900. Boutons principaux : 9,96:1 avec le blanc.' },
    accent: { valeur: '#8a5b22', note: 'terre-700 derive AA. 5,45:1 sur le fond. earth-500 du kit reste aux surfaces et filets.' },
    accentSurface: { valeur: '#d09a55', note: 'terre-400. Texte encre-900 dessus : 7,32:1.' },
    trait: { valeur: '#d09a55', note: 'terre-400. Filets, focus.' },
    erreur: { valeur: '#b42318', note: 'rouge-700 derive AA. 6,01:1 sur rouge-50.' },
    erreurFond: { valeur: '#fef2f2', note: 'rouge-50.' },
    info: { valeur: '#2878c8', note: 'kit scientific-500.' },
    infoTexte: { valeur: '#17324d', note: 'kit scientific-900. 11,18:1 sur scientifique-100.' },
    succes: { valeur: '#16a34a', note: 'kit success : remplissages et icones avec libelle. Texte : vert-700.' },
    attention: { valeur: '#e59a23', note: 'kit warning : remplissages et filets. Texte : terre-700.' },
    desactive: { valeur: '#a3ada6', note: 'kit disabled.' },
  },
  puces: {
    succes: { fond: '#e6f3ec', texte: '#124c34', contraste: 8.72 },
    mesure: { fond: '#e6f3ec', texte: '#124c34', contraste: 8.72 },
    information: { fond: '#e4eef8', texte: '#17324d', contraste: 11.18 },
    attention: { fond: '#f0e2cc', texte: '#6e4c1d', contraste: 6.06 },
    erreur: { fond: '#fef2f2', texte: '#b42318', contraste: 6.01 },
    neutre: { fond: '#fafbfa', texte: '#17231d', contraste: 15.64 },
    note: 'A11 : la couleur ne porte jamais seule le sens ; libelle + icone.',
  },
  geometrie: {
    rayonCarte: 20, rayonPanneau: 28, rayonChampWeb: 8, rayonChampMobile: 12,
    ombreDouce: '0 1px 2px rgba(18, 76, 52, .05), 0 8px 24px -12px rgba(18, 76, 52, .18)',
    conteneur: 1180,
  },
  mouvement: {
    courbe: 'cubic-bezier(.22,.61,.36,1)', dureeStandard: 300, focus: '3 px terre-400, decalage 2 px',
  },
  tactile: { cibleWeb: 44, cibleMobile: 48, ecartMinimum: 8 },
  typographie: {
    familles: { texte: 'Inter', technique: 'JetBrains Mono' },
    echelle: {
      h1: '30-36', h2: '24-28', h3: '18-22', h4: '16-18', corps: '14-16', petit: '12-13', legende: '11-12',
    },
  },
  derivees: [
    'vert-200/300/400/600/950 : interpolations de la gamme primary du kit.',
    'terre-50/100/200/300/600/800/900 : derivation de la teinte earth du kit.',
    'terre-700 : derive AA pour l accent en texte (earth-500 = 2,34:1 en texte).',
    'vert-900 : derive fonce pour les titres.',
    'rouge-100/300/400/800 : derivations de kit error ; rouge-700 derive AA (texte).',
    'scientifique-50/100 : fonds derives de kit scientific-500.',
    'creme-50/200/300 : fonds derives de kit background.',
  ],
};
writeFileSync('design-tokens.json', JSON.stringify(dt, null, 2) + '\n');
console.log('regenere design-tokens.json');

/* ==================== 5. INDEX.HTML (polices + theme-color) ==================== */
remplacer(
  'apps/web/index.html',
  'family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700',
  'family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500',
  1,
);
remplacer('apps/web/index.html', 'content="#174D35"', 'content="#124C34"', 1);

/* ==================== 6. CONTROLES SEMANTIQUES + POST-EMPREINTES ==================== */
const agriWeb = lire('apps/web/src/theme/agrikonnect.ts');
const agriMob = lire('apps/Mobile/src/theme/agrikonnect.ts');
if (agriWeb !== agriMob) {
  console.log('ARRET_CONTENU : agrikonnect.ts web et mobile divergent');
  process.exit(1);
}
verifie('agrikonnect.ts', agriWeb,
  ['#124c34', '#239b68', '#176b45', '#c58b42', '#f5f8f5', '#17231d', '#2878c8', '#dc4545', '#a3ada6', '"JetBrains Mono"', '"Inter"'],
  ['#123d2a', '#faf6ec', '#9c4423', '#33403a', '#4b7f63', 'Georgia', 'Space Grotesk', 'SpaceGrotesk', 'space-grotesk']);
const typo = lire('apps/Mobile/src/theme/typography.ts');
verifie('typography.ts', typo,
  ['JetBrainsMono_400Regular', 'JetBrainsMono_500Medium', 'Inter_700Bold', 'technique'],
  ['SpaceGrotesk', 'space-grotesk', 'Space Grotesk']);
const dtTxt = lire('design-tokens.json');
JSON.parse(dtTxt);
verifie('design-tokens.json', dtTxt, ['"800": "#124c34"', 'JetBrains Mono', '#124c34'], ['#123d2a', '#faf6ec', 'ecartsAvecLaReference']);
const idx2 = lire('apps/web/index.html');
verifie('index.html', idx2, ['JetBrains+Mono', '#124C34'], ['Space+Grotesk']);

const cibles = [
  'apps/web/src/theme/agrikonnect.ts',
  'apps/Mobile/src/theme/agrikonnect.ts',
  'apps/Mobile/src/theme/typography.ts',
  'design-tokens.json',
  'apps/web/index.html',
];
const attendus = {
  'apps/web/src/theme/agrikonnect.ts': '60e0e028b867708b5ff367dc49158f4b',
  'apps/Mobile/src/theme/agrikonnect.ts': '60e0e028b867708b5ff367dc49158f4b',
  'apps/Mobile/src/theme/typography.ts': '0552f02b5d4fd7d323e55199e3c22dda',
  'design-tokens.json': '027e27edb2d62f79659907eeb9158a99',
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
console.log('P1A_TERMINE');
