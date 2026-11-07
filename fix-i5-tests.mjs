#!/usr/bin/env node
/**
 * fix-i5-tests.mjs — inscrit les 4 fichiers de tests M5/M6 dans
 * backend/package.json (3 listes unitaires + 4 listes e2e).
 *
 * Depuis la racine du projet (celle qui contient `backend/`) :
 *   node fix-i5-tests.mjs
 *
 * Répond ✅ / 🆗 / ❌ puis vérifie le md5 final du package.json.
 * Idempotent : relisible sans danger.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

const resoudre = (fichier) => {
  if (fs.existsSync(fichier)) return fichier;
  const sans = fichier.startsWith('backend/') ? fichier.slice(7) : fichier;
  if (fs.existsSync(sans)) return sans;
  return null;
};

const chemin = resoudre('backend/package.json');
const ATTENDU = '62ed6d9b91d0f5ffeb569bb0f08d58d0';

const paires = [
  {
    libelle: 'listes unitaires (3) : adminMonitoring + adminSecurity avant adminUsers',
    avant: 'tests/adminUsers.test.mjs',
    apres: 'tests/adminMonitoring.test.mjs tests/adminSecurity.test.mjs tests/adminUsers.test.mjs',
    fois: 3,
  },
  {
    libelle: 'listes e2e (4) : adminMonitoring + adminSecurity avant adminUsers',
    avant: 'tests/e2e/adminUsers.e2e.test.mjs',
    apres: 'tests/e2e/adminMonitoring.e2e.test.mjs tests/e2e/adminSecurity.e2e.test.mjs tests/e2e/adminUsers.e2e.test.mjs',
    fois: 4,
  },
];

let s = fs.readFileSync(chemin, 'utf8');
let ok = 0; let deja = 0; let ko = 0;

for (const p of paires) {
  if (s.includes(p.apres)) {
    console.log(`🆗 ${p.libelle} (déjà appliqué)`);
    deja += 1;
    continue;
  }
  const occurrences = s.split(p.avant).length - 1;
  if (occurrences !== p.fois) {
    console.log(`❌ ${p.libelle} : ${occurrences} occurrence(s), ${p.fois} attendue(s)`);
    ko += 1;
    continue;
  }
  s = s.split(p.avant).join(p.apres);
  console.log(`✅ ${p.libelle}`);
  ok += 1;
}

if (ko === 0) fs.writeFileSync(chemin, s);

const obtenu = md5(chemin);
console.log(`md5 ${chemin} : ${obtenu}`);
if (obtenu === ATTENDU) {
  console.log('FIX_I5_TESTS_OK');
} else {
  console.log('FIX_I5_TESTS_KO');
  process.exit(1);
}
