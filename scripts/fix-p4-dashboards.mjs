#!/usr/bin/env node
/*
 * fix-p4-dashboards.mjs -- BLOC 93 (Mission 2, Phase 4 : Dashboard Kit).
 * but : adoption de StatCard (design-system P2a, jusqu ici ORPHELIN) dans les
 * zones KPI reels des 3 dashboards web :
 *   pages/admin/Dashboard.tsx, pages/app/Dashboard.tsx, pages/farmer/index.tsx.
 * regles : aucun code supprime (Liens/drill-down, motion, grille, SHORTCUTS,
 * MODULES, graphe des inscriptions INTACTS), aucune donnee changee (memes
 * valeurs API, meme fallback, aucun tendance/periode fictifs), aucun hex (I3),
 * aucun npm. Coutures chirurgicales = 2 par fichier (import + bloc KPI).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p4tree' : RD;

const md5 = (f) => createHash('md5').update(fs.readFileSync(f)).digest('hex');
const lire = (f) => fs.readFileSync(f, 'utf8');
const ecrire = (f, contenu) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, contenu, 'utf8'); };
const verifie = (f, contenu, valeurs) => {
  for (const v of valeurs) {
    if (typeof v === 'string' && !contenu.includes(v)) throw new Error('ABSENT: ' + v + ' @ ' + f);
    if (v instanceof RegExp && !v.test(contenu)) throw new Error('ABSENT_RE: ' + String(v) + ' @ ' + f);
  }
};
function pre(m5, f) {
  const p = path.join(RACINE, f);
  if (!fs.existsSync(p)) throw new Error('MANQUANT ' + f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5 ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function post(m5, f, valeurs) {
  const p = path.join(RACINE, f);
  const v = md5(p);
  verifie(p, lire(p), valeurs);
  if (v !== m5) throw new Error('ARRET_MD5_POST ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function remplacerTout(f, avant, apres, attendu) {
  const p = path.join(RACINE, f);
  const c = lire(p);
  if (c.split(avant).length - 1 !== attendu) throw new Error('ARRET_ANCRE ' + f + ' : ' + avant.slice(0, 50));
  ecrire(p, c.split(avant).join(apres));
}

console.log('== BLOC 93 : P4, adoption StatCard dans les 3 dashboards ==');

/* 0. portes PRE : cibles exactes + kit intact */
pre('771cb79330278c75ebca769a230e3327', 'apps/web/src/pages/admin/Dashboard.tsx');
pre('db23d8b018660f2f6f37e8766fc0617b', 'apps/web/src/pages/app/Dashboard.tsx');
pre('bf9313d63c0fc0bf1471d97c0875b3ff', 'apps/web/src/pages/farmer/index.tsx');
pre('c3b5c6aa047b6169c2c37f5a355806f7', 'apps/web/src/design-system/components/StatCard.tsx');
pre('01d5ce843ce105a64fa82c67362e9467', 'apps/web/src/design-system/index.ts');

/* 1. coutures : import StatCard + bloc KPI -> StatCard (2 par fichier) */
remplacerTout('apps/web/src/pages/admin/Dashboard.tsx', 'import { COLORS, DURATION, EASE } from \'@/theme\';', 'import { COLORS, DURATION, EASE } from \'@/theme\';\nimport { StatCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/admin/Dashboard.tsx', '                        <Card tone="white" hover>\n                          <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>\n                            {kpi.label}\n                          </Text>\n                          <Text preset="numeric" color={COLORS.forestGreen}>\n                            {formatNumber(Number(data[kpi.cle] ?? 0), locale)}\n                          </Text>\n                        </Card>', '                        <StatCard\n                          label={kpi.label}\n                          valeur={formatNumber(Number(data[kpi.cle] ?? 0), locale)}\n                        />', 1);
remplacerTout('apps/web/src/pages/app/Dashboard.tsx', 'import { COLORS, DURATION, EASE, TINTS } from \'@/theme\';', 'import { COLORS, DURATION, EASE, TINTS } from \'@/theme\';\nimport { StatCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/app/Dashboard.tsx', '                <Card tone="white" hover>\n                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>\n                    {key}\n                  </Text>\n                  <Text preset="numeric" color={COLORS.forestGreen}>\n                    {typeof value === \'number\' ? formatNumber(value, locale) : typeof value === \'string\' ? value : JSON.stringify(value)}\n                  </Text>\n                </Card>', '                <StatCard\n                  label={key}\n                  valeur={typeof value === \'number\' ? formatNumber(value, locale) : typeof value === \'string\' ? value : JSON.stringify(value)}\n                />', 1);
remplacerTout('apps/web/src/pages/farmer/index.tsx', 'import { COLORS, DURATION, EASE } from \'@/theme\';', 'import { COLORS, DURATION, EASE } from \'@/theme\';\nimport { StatCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/farmer/index.tsx', '                <Card tone="white" hover>\n                  <Text preset="numeric" color={COLORS.forestGreen}>\n                    {count.value ?? \'\u2014\'}\n                  </Text>\n                  <Text preset="caption" color={COLORS.slateGray}>\n                    {count.label}\n                  </Text>\n                </Card>', '                <StatCard\n                  label={count.label}\n                  valeur={String(count.value ?? \'\u2014\')}\n                />', 1);

/* 2. portes POST : empreintes calculees atelier + fonctionnalites preservees */
post('f46b7606175f4824f59bf2597febf399', 'apps/web/src/pages/admin/Dashboard.tsx', [
  "import { StatCard } from '@/design-system';", '<StatCard', 'label={kpi.label}',
  'to={kpi.vers ?? bloc.vers}', 'dashboardExport', 'Inscriptions',
  /(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/,
].filter((v) => !(v instanceof RegExp)));
verifie('apps/web/src/pages/admin/Dashboard.tsx', lire(path.join(RACINE, 'apps/web/src/pages/admin/Dashboard.tsx')), ['<StatCard']);
if (/(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/.test(lire(path.join(RACINE, 'apps/web/src/pages/admin/Dashboard.tsx')))) throw new Error('I3 hex admin');
if (lire(path.join(RACINE, 'apps/web/src/pages/admin/Dashboard.tsx')).includes('preset="numeric"')) throw new Error('RESIDU numeric admin');
post('65148e27a88ec3281fa61eb019680b52', 'apps/web/src/pages/app/Dashboard.tsx', [
  "import { StatCard } from '@/design-system';", '<StatCard', 'label={key}', 'SHORTCUTS', 'JSON.stringify(value)',
]);
if (/(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/.test(lire(path.join(RACINE, 'apps/web/src/pages/app/Dashboard.tsx')))) throw new Error('I3 hex app');
if (lire(path.join(RACINE, 'apps/web/src/pages/app/Dashboard.tsx')).includes('preset="numeric"')) throw new Error('RESIDU numeric app');
post('f5f192869394f736c96f07cd6c87bd85', 'apps/web/src/pages/farmer/index.tsx', [
  "import { StatCard } from '@/design-system';", '<StatCard', 'label={count.label}', 'to={count.href}', 'MODULES',
  '<Card tone="white" hover>',
]);
if (/(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/.test(lire(path.join(RACINE, 'apps/web/src/pages/farmer/index.tsx')))) throw new Error('I3 hex farmer');
if (lire(path.join(RACINE, 'apps/web/src/pages/farmer/index.tsx')).includes('preset="numeric"')) throw new Error('RESIDU numeric farmer');

console.log('');
console.log('RECAP BLOC 93 (P4) :');
console.log('  StatCard adopte dans les 3 dashboards (zones KPI reels uniquement)');
console.log('  Liens drill-down, motion, grilles, SHORTCUTS/MODULES, graphe : INTACTS');
console.log('  valeurs API et fallback inchanges ; aucune tendance/periode fictive');
console.log('  aucun hex, aucun npm, zero fonctionnalite supprimee');
console.log('');
console.log('BLOC_93_OK (si verifications npm web + mobile sont vertes)');
