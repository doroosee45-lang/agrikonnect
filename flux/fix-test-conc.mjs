#!/usr/bin/env node
/**
 * fix-test-conc.mjs — borne la concurrence de `node --test` à 2 fichiers de
 * tests simultanés dans les 4 commandes de tests de backend/package.json.
 *
 * Pourquoi : sous Windows, 24 fichiers e2e lancés en parallèle font échouer
 * les démarrages (base embarquée injoignable, moteur Python qui manque sa
 * fenêtre) — chaque fichier passe isolément, mais pas en parallèle totale.
 * La concurrence 2 garde la fiabilité sans rallonger le déroulement.
 *
 * Depuis la racine du projet (celle qui contient `backend/`) :
 *   node fix-test-conc.mjs
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
const ATTENDU = '4374f257775b8bcd8a4accdc7bf7b5ed';

const paires = [
  {
    libelle: 'scripts test + test:dbless : concurrence 2 avant --test-force-exit',
    avant: 'node --test --test-force-exit ',
    apres: 'node --test --test-concurrency=2 --test-force-exit ',
    fois: 2,
  },
  {
    libelle: 'scripts test:unit + test:e2e : concurrence 2 avant la liste',
    avant: 'node --test tests/',
    apres: 'node --test --test-concurrency=2 tests/',
    fois: 2,
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
  console.log('FIX_TEST_CONC_OK');
} else {
  console.log('FIX_TEST_CONC_KO');
  process.exit(1);
}
