#!/usr/bin/env node
/*
 * fix-p7-science.mjs -- BLOC 101 (Mission 2, Phase 7 : famille scientifique).
 * but : harmoniser la famille science (sol/capteurs/satellite/meteo) :
 *   1. StatCard (kit 8) gagne un slot pied?: ReactNode -- sans lui, adopter
 *      app/Soil supprimerait la tracabilite ProvenanceTag (interdit).
 *   2. app/Soil : la grille de profils sol adopte StatCard (4e adoption) --
 *      label + valeur + unite + pied = ProvenanceTag conserve (DECLARED/
 *      MEASURED/MODEL + date). Aucune donnee changee.
 *   3. Satellite : titre de carte Sources disponibles h4 -> h3 (gabarit
 *      familial : h3 = titres de carte, h4 = titres d items conserves).
 *   4. Les 9 autres fichiers de la famille sont CONTROLES INTACTS.
 * regles : aucun hex (I3), aucun npm, zero fonctionnalite supprimee,
 * aucune donnee fictive, aucun composant orphelin.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p7tree' : RD;
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

console.log('== BLOC 101 : P7, harmonisation de la famille scientifique ==');

/* 0. portes PRE : cibles + kit + controles */
pre('c3b5c6aa047b6169c2c37f5a355806f7', 'apps/web/src/design-system/components/StatCard.tsx');
pre('dc85518e0db9441268d66a0986b11749', 'apps/web/src/pages/app/Soil.tsx');
pre('8d7c9bbb426a1757b8308855f6501a7a', 'apps/web/src/pages/farmer/Plots/Satellite.tsx');
pre('e7e375f5a5f1b0fcefc6e9858865316a', 'apps/web/src/design-system/index.ts');
pre('5a00041e2a1b644907be3c994bef6beb', 'apps/web/src/pages/admin/Devices.tsx');
pre('bcde43f8246b891748b591f0ec6720b1', 'apps/web/src/pages/admin/Monitoring.tsx');
pre('5eb407b18f8b0bc2e901be3325d216ec', 'apps/web/src/pages/ai/AnalysisDetail.tsx');
pre('106cd84733c16a6ad333747ac6d07032', 'apps/web/src/pages/farmer/Devices.tsx');
pre('82cdebb60429ca6ada986b2906bf3b3f', 'apps/web/src/pages/farmer/Plots/PrecisionReport.tsx');
pre('180a58f10f4947d58037112623ba5aee', 'apps/web/src/pages/farmer/Plots/Sensors.tsx');
pre('55923cdc82ad0f2260101bcd8a1e86f4', 'apps/web/src/pages/farmer/Plots/Soil.tsx');
pre('fb72b02a2fe823290b854d04ceb00e07', 'apps/web/src/pages/farmer/Soil.tsx');
pre('f336c9bc4c4551b31f9d5546a2d4e26d', 'apps/web/src/pages/Weather.tsx');

/* 1. StatCard : slot pied (5 coutures) */
remplacerTout('apps/web/src/design-system/components/StatCard.tsx', ' * source.\n *\n', ' * source, pied (contenu additionnel : ex. provenance des donnees).\n *\n', 1);
remplacerTout('apps/web/src/design-system/components/StatCard.tsx', '  source?: string;\n  tendance?: StatTendance;\n  className?: string;', '  source?: string;\n  tendance?: StatTendance;\n  pied?: ReactNode;\n  className?: string;', 1);
remplacerTout('apps/web/src/design-system/components/StatCard.tsx', 'export function StatCard({ label, valeur, unite, periode, icone, source, tendance, className }: StatCardProps) {', 'export function StatCard({ label, valeur, unite, periode, icone, source, tendance, pied, className }: StatCardProps) {', 1);
remplacerTout('apps/web/src/design-system/components/StatCard.tsx', '      {tendance || periode || source ? (', '      {tendance || periode || source || pied ? (', 1);
remplacerTout('apps/web/src/design-system/components/StatCard.tsx', '          {source ? <span>Source : {source}</span> : null}\n        </footer>', '          {source ? <span>Source : {source}</span> : null}\n          {pied ? <div className="w-full">{pied}</div> : null}\n        </footer>', 1);

/* 2. app/Soil : import + grille KPI -> StatCard(pied=ProvenanceTag) */
remplacerTout('apps/web/src/pages/app/Soil.tsx', 'import { COLORS, DURATION, EASE } from \'@/theme\';', 'import { COLORS, DURATION, EASE } from \'@/theme\';\nimport { StatCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/app/Soil.tsx', '                  <Card tone="white" hover>\n                    <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>\n                      {key}\n                    </Text>\n                    <Text preset="numeric" color={COLORS.forestGreen}>\n                      {String(parameter.value ?? \'\u2014\')}\n                      {parameter.unit ? <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{parameter.unit}</span> : null}\n                    </Text>\n                    <div style={{ marginTop: 8 }}>\n                      <ProvenanceTag\n                        kind={parameter.source === \'declared\' ? \'DECLARED\' : parameter.source.startsWith(\'measured\') ? \'MEASURED\' : \'MODEL\'}\n                        source={parameter.source}\n                        measuredAt={parameter.measuredAt ? formatDate(parameter.measuredAt, locale) : undefined}\n                      />\n                    </div>\n                  </Card>', '                  <StatCard\n                    label={key}\n                    valeur={String(parameter.value ?? \'\u2014\')}\n                    unite={parameter.unit || undefined}\n                    pied={(\n                      <ProvenanceTag\n                        kind={parameter.source === \'declared\' ? \'DECLARED\' : parameter.source.startsWith(\'measured\') ? \'MEASURED\' : \'MODEL\'}\n                        source={parameter.source}\n                        measuredAt={parameter.measuredAt ? formatDate(parameter.measuredAt, locale) : undefined}\n                      />\n                    )}\n                  />', 1);

/* 3. Satellite : titre de carte h4 -> h3 */
remplacerTout('apps/web/src/pages/farmer/Plots/Satellite.tsx', '              <Text preset="h4" style={{ marginBottom: 12 }}>\n                Sources disponibles\n              </Text>', '              <Text preset="h3" style={{ marginBottom: 12 }}>\n                Sources disponibles\n              </Text>', 1);

/* 4. portes POST */
post('d05288f4748260ed43c593f7fb3e77aa', 'apps/web/src/design-system/components/StatCard.tsx', [
  'pied?: ReactNode', '{pied ? <div className="w-full">{pied}</div> : null}',
  'tendance || periode || source || pied', 'StatCardProps', 'Source : {source}', 'rounded-carte',
]);
post('ca96d158fdc7eca215741b0195b35eb1', 'apps/web/src/pages/app/Soil.tsx', [
  '<StatCard', 'label={key}', 'unite={parameter.unit || undefined}', 'pied={(',
  'ProvenanceTag', 'missingParameters', 'disclaimer', "from '@/design-system'",
]);
if (lire(path.join(RACINE, 'apps/web/src/pages/app/Soil.tsx')).includes('preset="numeric"')) throw new Error('RESIDU numeric soil');
post('ff9df5c01aa4abbb4fe64fd9ffcdfd29', 'apps/web/src/pages/farmer/Plots/Satellite.tsx', [
  'preset="h3"', 'Sources disponibles', 'observation(s)', 'cloudCover', 'preset="h4"',
]);
post('5a00041e2a1b644907be3c994bef6beb', 'apps/web/src/pages/admin/Devices.tsx', []);
post('bcde43f8246b891748b591f0ec6720b1', 'apps/web/src/pages/admin/Monitoring.tsx', []);
post('5eb407b18f8b0bc2e901be3325d216ec', 'apps/web/src/pages/ai/AnalysisDetail.tsx', []);
post('106cd84733c16a6ad333747ac6d07032', 'apps/web/src/pages/farmer/Devices.tsx', []);
post('82cdebb60429ca6ada986b2906bf3b3f', 'apps/web/src/pages/farmer/Plots/PrecisionReport.tsx', []);
post('180a58f10f4947d58037112623ba5aee', 'apps/web/src/pages/farmer/Plots/Sensors.tsx', []);
post('55923cdc82ad0f2260101bcd8a1e86f4', 'apps/web/src/pages/farmer/Plots/Soil.tsx', []);
post('fb72b02a2fe823290b854d04ceb00e07', 'apps/web/src/pages/farmer/Soil.tsx', []);
post('f336c9bc4c4551b31f9d5546a2d4e26d', 'apps/web/src/pages/Weather.tsx', []);

/* 5. I3 */
for (const f of ['apps/web/src/design-system/components/StatCard.tsx', 'apps/web/src/pages/app/Soil.tsx', 'apps/web/src/pages/farmer/Plots/Satellite.tsx']) {
  const c = lire(path.join(RACINE, f));
  if (/(?<![-\\w])#[0-9a-fA-F]{6}(?![-\\w])/.test(c)) throw new Error('I3 hex ' + f);
}

console.log('');
console.log('RECAP BLOC 101 (P7) :');
console.log('  StatCard : slot pied (ReactNode) ajoute -- tracabilite ProvenanceTag preservee');
console.log('  app/Soil : grille profils sol adopte StatCard (4e adoption du kit)');
console.log('  Satellite : titre de carte = h3 (gabarit familial) ; h4 items conserves');
console.log('  9 fichiers de la famille = INTACTS (controles md5) ; aucun hex, aucun npm');
console.log('');
console.log('BLOC_101_OK (si verifications npm web + mobile sont vertes)');
