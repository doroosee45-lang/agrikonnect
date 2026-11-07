#!/usr/bin/env node
/*
 * fix-p6-geo.mjs -- BLOC 99 (Mission 2, Phase 6 : geospatial).
 * but : harmoniser la famille geo (web) :
 *   1. MapPage : la carte Couverture (repartition par pays) adopte ChartCard
 *      (kit 8, deja adopte en P5) -- titre existant, zero copy inventee ;
 *      titre Legende aligne sur le gabarit familial (h3 encre, plus de h4 vert) ;
 *      la zone carte pleine largeur reste sur Card (padding 0 requis).
 *   2. Projects/Create : le select natif aligne sur les metriques Input
 *      (padding 14, fontSize 15, border 1.5px, radius = RADIUS.md jeton).
 *   3. AgronomicRanges + Plots/Create : CONTROLES INTACTS (portes md5).
 * regles : aucun hex (I3, references jetons uniquement), aucune donnee changee,
 * aucun composant orphelin, aucun npm, zero fonctionnalite supprimee.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p6tree' : RD;
const LF = String.fromCharCode(10);

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

console.log('== BLOC 99 : P6, harmonisation de la famille geo ==');

/* 0. portes PRE : cibles exactes + kit intact */
pre('10cab18d8ea3678d0dce9eb8825f15cd', 'apps/web/src/pages/public/MapPage.tsx');
pre('37d42b795475b5a0f810a32665e7b750', 'apps/web/src/pages/farmer/Projects/Create.tsx');
pre('a98bb0a9a87735c536b4412fe0d46af0', 'apps/web/src/design-system/components/ChartCard.tsx');
pre('e7e375f5a5f1b0fcefc6e9858865316a', 'apps/web/src/design-system/index.ts');
pre('22a1fcc469ca2d86ff6516cebc0e142c', 'apps/web/src/pages/admin/AgronomicRanges.tsx');
pre('7b1b56ee30cd3e1b91a0e5accb5b3ace', 'apps/web/src/pages/farmer/Plots/Create.tsx');

/* 1. coutures MapPage : import + Couverture -> ChartCard (ouverture/fermeture) + titre Legende */
remplacerTout('apps/web/src/pages/public/MapPage.tsx', 'import { COLORS, DURATION, EASE, LAYOUT } from \'@/theme\';', 'import { COLORS, DURATION, EASE, LAYOUT } from \'@/theme\';\nimport { ChartCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/public/MapPage.tsx', '            <Card tone="white">\n              <Text preset="h4" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>\n                Couverture\n              </Text>', '            <ChartCard titre="Couverture">', 1);
remplacerTout('apps/web/src/pages/public/MapPage.tsx', '              </Text>\n            </Card>\n\n            <Card tone="white">', '              </Text>\n            </ChartCard>\n\n            <Card tone="white">', 1);
remplacerTout('apps/web/src/pages/public/MapPage.tsx', '              <Text preset="h4" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>\n                L\u00e9gende\n              </Text>', '              <Text preset="h3" style={{ marginBottom: 12 }}>\n                L\u00e9gende\n              </Text>', 1);

/* 2. coutures Projects : import RADIUS + metriques select alignees Input */
remplacerTout('apps/web/src/pages/farmer/Projects/Create.tsx', 'import { COLORS, DURATION, EASE } from \'@/theme\';', 'import { COLORS, DURATION, EASE, RADIUS } from \'@/theme\';', 1);
remplacerTout('apps/web/src/pages/farmer/Projects/Create.tsx', '                      style={{\n                        height: 44,\n                        padding: \'0 12px\',\n                        borderRadius: 10,\n                        border: `1px solid ${COLORS.lightBorder}`,\n                        background: COLORS.pureWhite,\n                        fontSize: 14,\n                        color: COLORS.textPrimary,\n                      }}', '                      style={{\n                        height: 44,\n                        padding: \'0 14px\',\n                        borderRadius: RADIUS.md,\n                        border: `1.5px solid ${COLORS.lightBorder}`,\n                        background: COLORS.pureWhite,\n                        fontSize: 15,\n                        color: COLORS.textPrimary,\n                      }}', 1);

/* 3. portes POST : empreintes calculees atelier + fonctionnalites preservees */
post('28f615bc59e94469cf0c69ddd7a2a9b1', 'apps/web/src/pages/public/MapPage.tsx', [
  '<ChartCard', 'titre="Couverture"', '</ChartCard>',
  'preset="h3"', 'Légende', 'map.data?.meta.note', 'project(lng, lat)',
  "from '@/design-system'", 'COLORS.forestGreen',
]);
post('1f2250057661c6519b18b2c0ab8c3ff1', 'apps/web/src/pages/farmer/Projects/Create.tsx', [
  'RADIUS.md', "padding: '0 14px'", 'fontSize: 15', '1.5px solid', 'COLORS, DURATION, EASE, RADIUS',
  'ProjectCreateInput', 'create.mutate', '← Retour aux projets',
]);
post('22a1fcc469ca2d86ff6516cebc0e142c', 'apps/web/src/pages/admin/AgronomicRanges.tsx', ['STATUS_TONE', 'PARAMETER_LABELS', 'AdminAgronomicRanges']);
post('7b1b56ee30cd3e1b91a0e5accb5b3ace', 'apps/web/src/pages/farmer/Plots/Create.tsx', ['FarmerPlotCreate', 'plotApi.create', 'latitude', 'longitude']);

/* 4. I3 : aucun hex en dur dans les fichiers touches */
for (const f of ['apps/web/src/pages/public/MapPage.tsx', 'apps/web/src/pages/farmer/Projects/Create.tsx']) {
  const c = lire(path.join(RACINE, f));
  if (/(?<![-\\w])#[0-9a-fA-F]{6}(?![-\\w])/.test(c)) throw new Error('I3 hex ' + f);
}

console.log('');
console.log('RECAP BLOC 99 (P6) :');
console.log('  MapPage : Couverture adopte ChartCard ; titre Legende = h3 encre (gabarit familial)');
console.log('  zone carte pleine largeur conservee sur Card (padding 0 requis)');
console.log('  Projects/Create : select aligne sur Input (metriques jetons, focus natif conserve)');
console.log('  AgronomicRanges + Plots/Create : INTACTS (controles md5) ; aucun hex, aucun npm');
console.log('');
console.log('BLOC_99_OK (si verifications npm web + mobile sont vertes)');
