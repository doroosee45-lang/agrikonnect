#!/usr/bin/env node
/*
 * fix-p5b-repair.mjs -- BLOC 96. Repare ProductionSummary.tsx (P5) :
 * la couture de fermeture du BLOC 95 avait absorbe la ligne )} qui clôt la
 * ternaire du bloc Repartition -> TS1005 sur </ChartCard>. On reintroduit
 * exactement cette ligne, rien d autre. Les autres livrables P5 (ChartCard,
 * admin/Dashboard, barrel) sont verifies intacts.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const LF = String.fromCharCode(10);
const md5 = (f) => createHash('md5').update(fs.readFileSync(f)).digest('hex');
const lire = (f) => fs.readFileSync(f, 'utf8');
const ecrire = (f, c) => fs.writeFileSync(f, c, 'utf8');

function pre(m5, f) {
  const p = path.join(RD, f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5 ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function post(m5, f, vals) {
  const p = path.join(RD, f);
  const c = lire(p);
  for (const s of vals) if (!c.includes(s)) throw new Error('ABSENT ' + s + ' @ ' + f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5_POST ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}

const F = 'apps/web/src/pages/organization/ProductionSummary.tsx';
console.log('== BLOC 96 : reparation P5 de ProductionSummary.tsx ==');

/* 0. etat machine exact + les autres livrables P5 intacts */
pre('c90ead2b3e1239b7429353cd51e5b1c4', F);
pre('a98bb0a9a87735c536b4412fe0d46af0', 'apps/web/src/design-system/components/ChartCard.tsx');
pre('75c1fb867d8e3e7c9a0f488ee5aa2230', 'apps/web/src/pages/admin/Dashboard.tsx');
pre('e7e375f5a5f1b0fcefc6e9858865316a', 'apps/web/src/design-system/index.ts');

/* 1. couture unique : reintroduire la ligne )} avant </ChartCard> */
const p = path.join(RD, F);
const av = '                  </div>' + LF + '              </ChartCard>';
const ap = '                  </div>' + LF + '                )}' + LF + '              </ChartCard>';
const c = lire(p);
if (c.split(av).length - 1 !== 1) throw new Error('ARRET_ANCRE fermeture');
ecrire(p, c.split(av).join(ap));

/* 2. porte POST : empreinte calculee atelier + structure ternaire restauree */
post('dd0cdc2d880d79f875c2fdc43fa09719', F, [
  '                )}' + LF + '              </ChartCard>',
  '<ChartCard', 'GROUP_LABELS[groupBy]', 'source={stats.data.source}',
  'recordsWithoutKg', 'formatNumber', "from '@/design-system'",
]);
if (lire(p).includes('Chip label')) throw new Error('RESIDU Chip source');

console.log('RECAP BLOC 96 :');
console.log('  ligne )} reintroduite (ternaire du bloc Repartition restauree)');
console.log('  ChartCard/admin/barrel verifies intacts ; zero autre changement');
console.log('');
console.log('BLOC_96_OK (si verifications npm web + mobile sont vertes)');
