#!/usr/bin/env node
/**
 * fix-m2-tests.mjs — inscrit les 2 tests M2 dans package.json (idempotent).
 *
 * Usage (depuis la racine du projet) :  node fix-m2-tests.mjs
 * Une seconde exécution dit 🆗 partout. Aucun secret n'est imprimé.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('.', import.meta.url));
const cible = path.join(racine, 'backend', 'package.json');

let source;
try {
  source = readFileSync(cible, 'utf8');
} catch {
  console.error('❌ backend/package.json introuvable — lancez ce script depuis la racine du projet.');
  process.exit(1);
}

const paires = [
  [' tests/agronomicRangesCsv.test.mjs',
   ' tests/adminUsers.test.mjs tests/agronomicRangesCsv.test.mjs'],
  [' tests/e2e/agronomicRanges.e2e.test.mjs',
   ' tests/e2e/adminUsers.e2e.test.mjs tests/e2e/agronomicRanges.e2e.test.mjs'],
];

let ok = 0;
let ko = 0;
let change = false;

for (const [avant, apres] of paires) {
  if (source.includes(apres)) {
    console.log('🆗 déjà inscrit : ' + apres.trim().split(' ')[0]);
    ok += 1;
    continue;
  }
  if (!source.includes(avant)) {
    console.error('❌ motif introuvable dans package.json : «' + avant.trim() + '»');
    ko += 1;
    continue;
  }
  source = source.split(avant).join(apres);
  change = true;
  console.log('✅ inscrit : ' + apres.trim().split(' ')[0]);
  ok += 1;
}

if (change) {
  writeFileSync(cible, source);
  console.log('✅ backend/package.json enregistré.');
}

console.log('');
if (ko > 0) {
  console.error('❌ ' + ko + ' problème(s) — copiez cette sortie dans le chat.');
  process.exit(1);
}
console.log('✅ Terminé (' + ok + ' étape(s)). Vérification : node --test tests/adminUsers.test.mjs → attendu 23/23.');
process.exit(0);
