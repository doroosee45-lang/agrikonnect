/* fix-p2a-design-system.mjs
 * Phase 2a -- Mission Design System :
 *  (1) P1c : residus palette du site public dans tokens.css (overlays photo,
 *      fallbacks var(), serif en dur) ;
 *  (2) Button web : variante secondary + ombre retintee ;
 *  (3) socle design-system/ (Tailwind v4 + cn + StatCard kit 8) ;
 *  (4) branchements vite.config.ts + main.tsx.
 * Portes : md5 pre (Button) + ancres exactes ailleurs + post-controles + census.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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

/* ============================ 1. PORTES PRE ============================ */
if (!GEN) {
  porte('apps/web/src/components/ui/Button.tsx', '1dcd13955db40bd4a510631f352c5e03');
  const vite = lire('apps/web/vite.config.ts');
  if (!vite.includes('plugins: [react()],') || !vite.includes("import react from '@vitejs/plugin-react';")) {
    console.log('ARRET_ANCRE vite.config.ts');
    process.exit(1);
  }
  console.log('porte OK apps/web/vite.config.ts (ancres)');
  const main = lire('apps/web/src/main.tsx');
  if (main.split("import './theme/tokens.css';").length - 1 !== 1) {
    console.log('ARRET_ANCRE main.tsx : import tokens.css introuvable');
    process.exit(1);
  }
  console.log('porte OK apps/web/src/main.tsx (ancre)');
}

/* ==================== 2. P1c : tokens.css, residus palette ==================== */
const CSS = 'apps/web/src/theme/tokens.css';
const HEX = {
  '#fffdf6': '#fafbfa',
  '#f6f4ec': '#fafbfa',
  '#e8a36c': '#d6ac72',
  '#e7a06f': '#d6ac72',
  '#a84924': '#8a5b22',
  '#174b35': '#124c34',
  '#123e2e': '#0e3a29',
  '#b6522b': '#c58b42',
};
const RGB = {
  'rgba(255, 253, 246': 'rgba(250, 251, 250',
  'rgba(255,253,246': 'rgba(250,251,250',
  'rgba(7, 34, 24': 'rgba(8, 36, 26',
  'rgba(7,34,24': 'rgba(8,36,26',
  'rgba(7, 26, 18': 'rgba(8, 36, 26',
  'rgba(7,26,18': 'rgba(8,36,26',
  'rgba(13, 54, 38': 'rgba(14, 58, 41',
  'rgba(13,54,38': 'rgba(14,58,41',
  'rgba(19, 59, 43': 'rgba(18, 76, 52',
  'rgba(19,59,43': 'rgba(18,76,52',
  'rgba(249,247,238': 'rgba(245,248,245',
  'rgba(249, 247, 238': 'rgba(245, 248, 245',
  'rgba(37, 113, 76': 'rgba(18, 76, 52',
  'rgba(37,113,76': 'rgba(18,76,52',
};
function recolorer(texte) {
  let n = 0;
  let out = texte.replace(/#[0-9a-fA-F]{6}/g, (m) => {
    const k = m.toLowerCase();
    if (HEX[k]) {
      n += 1;
      return HEX[k];
    }
    return m;
  });
  for (const [avant, apres] of Object.entries(RGB)) {
    const parts = out.split(avant);
    const fois = parts.length - 1;
    if (fois > 0) {
      n += fois;
      out = parts.join(apres);
      console.log('rgba x' + fois + ' : ' + avant + ' -> ' + apres);
    }
  }
  let geo = out.split("Georgia, 'Times New Roman', serif").length - 1;
  if (geo > 0) {
    out = out.split("Georgia, 'Times New Roman', serif").join('var(--font-body)');
    console.log('font-family serif en dur -> var(--font-body) x' + geo);
  }
  console.log('P1c : ' + n + ' valeurs remplacees');
  return out;
}
writeFileSync(CSS, recolorer(lire(CSS)));
console.log('tokens.css P1c ok');

/* ==================== 3. BUTTON WEB : secondary + ombre ==================== */
const BTN = 'apps/web/src/components/ui/Button.tsx';
remplacer(BTN,
  "export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';",
  "export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';",
  1);
remplacer(BTN,
  "import { ROUGE } from '../../theme/agrikonnect';",
  "import { ROUGE, VERT } from '../../theme/agrikonnect';",
  1);
remplacer(BTN,
  "  primary: { bg: COLORS.forestGreen, color: COLORS.pureWhite, border: 'transparent', hover: COLORS.livingGreen },",
  "  primary: { bg: COLORS.forestGreen, color: COLORS.pureWhite, border: 'transparent', hover: COLORS.livingGreen },\n  secondary: { bg: COLORS.paleGreen, color: COLORS.forestGreen, border: 'transparent', hover: VERT[200] },",
  1);
remplacer(BTN,
  "boxShadow: variant === 'primary' && !isDisabled ? '0 6px 16px rgba(18, 61, 42, 0.18)' : undefined,",
  "boxShadow: variant === 'primary' && !isDisabled ? '0 6px 16px rgba(18, 76, 52, 0.18)' : undefined,",
  1);

/* ==================== 4. SOCLE design-system/ ==================== */
mkdirSync('apps/web/src/design-system/lib', { recursive: true });
mkdirSync('apps/web/src/design-system/components', { recursive: true });

const INDEX_CSS = [
  '/* Socle Tailwind du design-system (kit v1.0, sections 7-8).',
  ' *',
  ' * Les jetons sont les variables CSS de theme/tokens.css (source :',
  ' * agrikonnect.ts). Les composants design-system utilisent ces classes ;',
  ' * les ecrans existants gardent les styles inline + jetons (double systeme',
  ' * assume). I3 : aucune couleur en dur dans les composants.',
  ' */',
  "@import 'tailwindcss';",
  '',
  '@theme inline {',
  '  /* Couleurs -- pont vers les variables du theme. */',
  '  --color-marque: var(--vert-800);',
  '  --color-marque-clair: var(--vert-100);',
  '  --color-secondaire: var(--vert-500);',
  '  --color-accent: var(--terre-700);',
  '  --color-accent-surface: var(--terre-400);',
  '  --color-fond: var(--creme-100);',
  '  --color-surface: var(--pure-white);',
  '  --color-texte: var(--encre-700);',
  '  --color-texte-doux: var(--encre-500);',
  '  --color-bordure: var(--light-border);',
  '  --color-succes: var(--vert-700);',
  '  --color-succes-clair: var(--vert-100);',
  '  --color-attention: var(--terre-700);',
  '  --color-attention-clair: var(--terre-100);',
  '  --color-erreur: var(--rouge-700);',
  '  --color-erreur-clair: var(--rouge-50);',
  '  --color-info: var(--scientifique-900);',
  '  --color-info-clair: var(--scientifique-100);',
  '  --color-desactive: var(--fonction-desactive);',
  '',
  '  /* Typographie -- Inter partout, JetBrains Mono pour le technique. */',
  '  --font-sans: var(--font-body);',
  '  --font-mono: var(--font-mono);',
  '',
  '  /* Rayons (kit 5). */',
  '  --radius-carte: 20px;',
  '  --radius-champ: 12px;',
  '}',
  '',
].join('\n');

const UTILS = [
  "import { clsx, type ClassValue } from 'clsx';",
  "import { twMerge } from 'tailwind-merge';",
  '',
  '/** Fusionne les classes conditionnelles sans conflit Tailwind. */',
  'export function cn(...inputs: ClassValue[]) {',
  '  return twMerge(clsx(inputs));',
  '}',
  '',
].join('\n');

const STAT = [
  "import type { ReactNode } from 'react';",
  '',
  "import { cn } from '../lib/utils';",
  '',
  '/**',
  ' * StatCard (kit 8) : valeur principale, libelle, evolution, periode, icone,',
  ' * source.',
  ' *',
  ' * Aucune valeur par defaut pour l evolution : un indicateur n affiche jamais',
  ' * un pourcentage ou une evolution fictifs dans l environnement reel. La',
  ' * tendance n apparaît que si elle est fournie.',
  ' */',
  'export interface StatTendance {',
  "  valeur: string;",
  "  sens: 'up' | 'down' | 'flat';",
  '  libelle?: string;',
  '}',
  '',
  'export interface StatCardProps {',
  '  label: string;',
  '  valeur: string;',
  '  unite?: string;',
  '  periode?: string;',
  '  icone?: ReactNode;',
  '  source?: string;',
  '  tendance?: StatTendance;',
  '  className?: string;',
  '}',
  '',
  'const SENS_STYLE: Record<StatTendance[\'sens\'], string> = {',
  "  up: 'bg-marque-clair text-marque',",
  "  down: 'bg-erreur-clair text-erreur',",
  "  flat: 'bg-fond text-texte-doux',",
  '};',
  '',
  'const SENS_ICONE: Record<StatTendance[\'sens\'], ReactNode> = {',
  "  up: <svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\" aria-hidden><path d=\"M5 1 L9 7 L1 7 Z\" fill=\"currentColor\" /></svg>,",
  "  down: <svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\" aria-hidden><path d=\"M5 9 L1 3 L9 3 Z\" fill=\"currentColor\" /></svg>,",
  "  flat: <svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\" aria-hidden><rect x=\"1\" y=\"4\" width=\"8\" height=\"2\" fill=\"currentColor\" /></svg>,",
  '};',
  '',
  'export function StatCard({ label, valeur, unite, periode, icone, source, tendance, className }: StatCardProps) {',
  '  return (',
  "    <section className={cn('flex flex-col gap-2 rounded-carte border border-bordure bg-surface p-5', className)}>",
  "      <header className=\"flex items-start justify-between gap-3\">",
  "        <h3 className=\"text-sm font-medium text-texte-doux\">{label}</h3>",
  "        {icone ? <span className=\"text-marque\" aria-hidden>{icone}</span> : null}",
  '      </header>',
  "      <p className=\"flex items-baseline gap-1.5\">",
  "        <span className=\"text-3xl font-bold tabular-nums text-texte\">{valeur}</span>",
  "        {unite ? <span className=\"text-sm text-texte-doux\">{unite}</span> : null}",
  '      </p>',
  '      {tendance || periode || source ? (',
  "        <footer className=\"flex flex-wrap items-center gap-2 text-xs text-texte-doux\">",
  '          {tendance ? (',
  "            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold', SENS_STYLE[tendance.sens])}>",
  '              {SENS_ICONE[tendance.sens]}',
  '              {tendance.valeur}',
  "              {tendance.libelle ? <span className=\"font-normal\">-- {tendance.libelle}</span> : null}",
  '            </span>',
  '          ) : null}',
  '          {periode ? <span>{periode}</span> : null}',
  '          {source ? <span>Source : {source}</span> : null}',
  '        </footer>',
  '      ) : null}',
  '    </section>',
  '  );',
  '}',
  '',
].join('\n');

const BARIL = [
  '/**',
  ' * design-system AGRIKONNECT AFRICA (kit v1.0).',
  ' *',
  ' * Composants Tailwind/shadcn pour le NEUF uniquement ; les ecrans existants',
  ' * gardent les styles inline + jetons. Chaque composant livre ici est adopte',
  ' * dans au moins un ecran reel.',
  ' */',
  "export { StatCard } from './components/StatCard';",
  "export type { StatCardProps, StatTendance } from './components/StatCard';",
  "export { cn } from './lib/utils';",
  '',
].join('\n');

writeFileSync('apps/web/src/design-system/index.css', INDEX_CSS);
writeFileSync('apps/web/src/design-system/lib/utils.ts', UTILS);
writeFileSync('apps/web/src/design-system/components/StatCard.tsx', STAT);
writeFileSync('apps/web/src/design-system/index.ts', BARIL);
console.log('design-system/ cree (index.css, utils, StatCard, barrel)');

/* ==================== 5. BRANCHEMENTS ==================== */
remplacer('apps/web/vite.config.ts',
  "import react from '@vitejs/plugin-react';",
  "import react from '@vitejs/plugin-react';\nimport tailwindcss from '@tailwindcss/vite';",
  1);
remplacer('apps/web/vite.config.ts',
  '  plugins: [react()],',
  '  plugins: [react(), tailwindcss()],',
  1);
remplacer('apps/web/src/main.tsx',
  "import './theme/tokens.css';",
  "import './theme/tokens.css';\nimport './design-system/index.css';",
  1);

/* ==================== 6. CONTROLES + CENSUS ==================== */
const css = lire(CSS);
verifie('tokens.css', css,
  ['#8a5b22', '#124c34', '#d6ac72', 'var(--font-body)'],
  ['#a84924', '#fffdf6', '#123e2e', '#174b35', '#e8a36c', "Georgia, 'Times New Roman', serif"]);
const btn = lire(BTN);
verifie('Button.tsx', btn,
  ["'secondary'", 'rgba(18, 76, 52, 0.18)', 'VERT[200]'],
  ['rgba(18, 61, 42']);
const st = lire('apps/web/src/design-system/components/StatCard.tsx');
verifie('StatCard.tsx', st, ['StatCardProps', 'tendance?', 'rounded-carte', "from '../lib/utils'"], ['#123d2a', '#124c34']);
if (/#[0-9a-fA-F]{3,8}/.test(st)) {
  console.log('ARRET_CONTENU StatCard.tsx : code hexadecimal en dur');
  process.exit(1);
}
const cssDs = lire('apps/web/src/design-system/index.css');
verifie('design-system/index.css', cssDs, ["@import 'tailwindcss';", '@theme inline', '--color-marque: var(--vert-800);'], ['#124c34', '#123d2a']);
verifie('main.tsx', lire('apps/web/src/main.tsx'), ["import './design-system/index.css';"], []);
verifie('vite.config.ts', lire('apps/web/vite.config.ts'), ['tailwindcss()', '@tailwindcss/vite'], []);

console.log('--- post-empreintes (verrou sur le genere) ---');
const attendus = {
  'apps/web/src/design-system/index.css': '7d097df3c690ab93ae8e57df99635fc4',
  'apps/web/src/design-system/lib/utils.ts': '7bf6a73d2682b52eae139424cd2f9fc3',
  'apps/web/src/design-system/components/StatCard.tsx': 'c3b5c6aa047b6169c2c37f5a355806f7',
  'apps/web/src/design-system/index.ts': '5c342a09363a90de879813614f8d7d0e',
};
for (const p of [
  'apps/web/src/theme/tokens.css',
  'apps/web/src/components/ui/Button.tsx',
  'apps/web/src/design-system/index.css',
  'apps/web/src/design-system/lib/utils.ts',
  'apps/web/src/design-system/components/StatCard.tsx',
  'apps/web/src/design-system/index.ts',
  'apps/web/vite.config.ts',
  'apps/web/src/main.tsx',
]) {
  const m = md5Fichier(p);
  const a = attendus[p];
  if (a && m !== a) {
    console.log('ARRET_POST_MD5 ' + p + ' = ' + m + ' (attendu ' + a + ')');
    process.exit(1);
  }
  console.log(m + ' *' + p);
}

const BLANCHE = new Set(Object.values(HEX).concat(Object.keys(HEX), [
  '#ffffff', '#fafbfa', '#f5f8f5', '#e3eae5', '#17231d', '#64736a', '#0f1712',
  '#124c34', '#0e3a29', '#08241a', '#176b45', '#239b68', '#1b7f55',
  '#d6ac72', '#d09a55', '#c58b42', '#8a5b22', '#f7efe5', '#f0e2cc', '#e2c79b',
  '#a5722f', '#6e4c1d', '#523a17', '#e7ede8', '#d4dcd6',
  '#fef2f2', '#fadedd', '#eea29e', '#e2716b', '#dc4545', '#b42318', '#8e1b12',
  '#f2f7fc', '#e4eef8', '#2878c8', '#17324d', '#16a34a', '#e59a23', '#a3ada6',
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
console.log('P2A_TERMINE');
