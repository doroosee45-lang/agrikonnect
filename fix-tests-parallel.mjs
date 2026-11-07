#!/usr/bin/env node
/**
 * AGRIKONNECT — correctifs « tests parallèles / Windows » en une commande.
 *
 * Usage, depuis le dossier racine du projet (agrikonnect-africa-final) :
 *
 *     node fix-tests-parallel.mjs
 *
 * Ce que ça corrige (suite aux échecs « initdb: directory /tmp/agrikon-e2e-pg
 * exists but is not empty ») :
 *   1. backend/tests/e2e/support/harness.mjs — chaque fichier de test reçoit
 *      son propre dossier PostgreSQL et son propre port (les suites tournent
 *      EN PARALLÈLE sur une machine multi-cœurs) ;
 *   2. backend/tests/fileMagic.test.mjs — comparaison de chemins compatible
 *      Windows (antislashs) ;
 *   3. backend/.env.example — restauré s'il manque (les tests « matériel » le
 *      lisent) ;
 *   4. backend/package.json — les scripts de tests listent les fichiers
 *      explicitement (fin des surprises de motifs Node 24) ;
 *   5. Fichiers e2e égarés à la racine de tests/ → mis de côté avec un
 *      avertissement ; anciens dossiers de test nettoyés.
 *
 * Relançable à volonté : si c'est déjà fait, le script le dit et ne touche à rien.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

// Fonctionne depuis la racine agrikonnect-africa-final OU depuis backend/.
const root = existsSync(join(process.cwd(), 'backend', 'package.json'))
  ? process.cwd()
  : existsSync(join(process.cwd(), 'package.json'))
    ? join(process.cwd(), '..')
    : process.cwd();
let corriges = 0;
let problemes = 0;

const chemin = (rel) => join(root, rel);

const lire = (rel) => {
  const p = chemin(rel);
  if (!existsSync(p)) {
    console.error(`❌ Fichier introuvable : ${rel}`);
    console.error('   → Lancez ce script depuis le dossier agrikonnect-africa-final.');
    process.exit(1);
  }
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
};

const appliquer = (rel, label, avant, apres) => {
  const texte = lire(rel);
  if (texte.includes(apres)) {
    console.log(`🆗 ${rel} — ${label} : déjà appliqué`);
    return;
  }
  if (texte.includes(avant)) {
    writeFileSync(chemin(rel), texte.replace(avant, () => apres));
    console.log(`✅ ${rel} — ${label} : CORRIGÉ`);
    corriges += 1;
    return;
  }
  console.error(`❌ ${rel} — ${label} : texte attendu introuvable.`);
  console.error('   Ce fichier diffère de la version d’origine (copie modifiée ?).');
  console.error('   Envoyez-moi ce fichier et je livre la version complète.');
  problemes += 1;
};

/* ────────────────────────────────────────────────────────────────
 * 0. Fichiers e2e égarés à la racine de tests/ (souvent un copier-collé)
 * ──────────────────────────────────────────────────────────────── */
{
  const dossier = chemin('backend/tests');
  if (existsSync(dossier)) {
    for (const f of readdirSync(dossier)) {
      if (f.includes('.e2e.') && f.endsWith('.mjs')) {
        renameSync(join(dossier, f), join(dossier, `${f}.stray.bak`));
        console.warn(`⚠ tests/${f} : fichier e2e égaré à la racine de tests/ —`);
        console.warn(`  renommé tests/${f}.stray.bak. Les recettes e2e vivent dans tests/e2e/.`);
        console.warn('  Supprimez ce .bak s’il est inutile.');
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
 * 1. harness.mjs — dossier ET port PostgreSQL propres à chaque fichier
 * ──────────────────────────────────────────────────────────────── */
const HARNESS = 'backend/tests/e2e/support/harness.mjs';

appliquer(
  HARNESS,
  'import du module os',
  `import path from 'node:path';
import fs from 'node:fs';`,
  `import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';`,
);

appliquer(
  HARNESS,
  'dossier et port PostgreSQL par processus',
  `const PG_PORT = Number(process.env.E2E_PG_PORT ?? 55433);
const DATA_DIR = process.env.E2E_PG_DATA ?? '/tmp/agrikon-e2e-pg';`,
  `/**
 * Port PostgreSQL et dossier de données **propres à chaque processus de test**.
 *
 * Les fichiers de tests s'exécutent en parallèle (cœurs − 1 fichiers à la
 * fois). Partager '/tmp/agrikon-e2e-pg' et le port 55433 faisait échouer tous
 * les fichiers sauf un : « initdb: directory … exists but is not empty ».
 * E2E_PG_DATA / E2E_PG_PORT restent prioritaires quand ils sont posés
 * explicitement.
 */
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const PG_PORT = Number(process.env.E2E_PG_PORT ?? await freePort());
const DATA_DIR = process.env.E2E_PG_DATA
  ?? fs.mkdtempSync(path.join(os.tmpdir(), 'agrikon-e2e-pg-'));`,
);

/* ────────────────────────────────────────────────────────────────
 * 2. fileMagic.test.mjs — chemins compatibles Windows
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/fileMagic.test.mjs',
  'comparaison de chemin sans antislash',
  `  const pilote = creerStockageLocal({ racine: './storage/geospatial' });
  assert.equal(pilote.pilote, 'local');
  assert.ok(pilote.racine.endsWith('storage/geospatial'));`,
  `  const pilote = creerStockageLocal({ racine: './storage/geospatial' });
  assert.equal(pilote.pilote, 'local');
  // Windows : path.resolve produit des antislashs — on compare séparateurs
  // agnostiquement.
  assert.ok(pilote.racine.replaceAll('\\\\', '/').endsWith('storage/geospatial'));`,
);

const ENV_GZ_B64 = [
  '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',
  '8Mr3fuDhyqro8f8DuOvknhs5AAA=',
].join('');

/* ────────────────────────────────────────────────────────────────
 * 3. backend/.env.example — restauré s'il manque (modèle public, sans secret)
 * ──────────────────────────────────────────────────────────────── */
{
  const p = chemin('backend/.env.example');
  if (existsSync(p)) {
    console.log('🆗 backend/.env.example : présent');
  } else {
    writeFileSync(p, zlib.gunzipSync(Buffer.from(ENV_GZ_B64, 'base64')));
    console.log('✅ backend/.env.example : RESTAURÉ (modèle de variables, aucun secret)');
    corriges += 1;
  }
}

/* ────────────────────────────────────────────────────────────────
 * 4. backend/package.json — listes de fichiers explicites
 * ──────────────────────────────────────────────────────────────── */
{
  const rel = 'backend/package.json';
  const p = chemin(rel);
  if (!existsSync(p)) {
    console.error(`❌ Fichier introuvable : ${rel}`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  const unitaires = readdirSync(chemin('backend/tests'))
    .filter((f) => f.endsWith('.test.mjs'))
    .sort()
    .map((f) => `tests/${f}`);
  const e2e = readdirSync(chemin('backend/tests/e2e'))
    .filter((f) => f.endsWith('.e2e.test.mjs'))
    .sort()
    .map((f) => `tests/e2e/${f}`);
  const liste = [...unitaires, ...e2e].join(' ');
  const attendus = {
    test: `node --test ${liste}`,
    'test:unit': `node --test ${liste}`,
    'test:dbless': `node --test --test-force-exit --test-name-pattern="^(?!.*\\[db\\]).*" ${liste}`,
  };
  let modifie = false;
  for (const [cle, valeur] of Object.entries(attendus)) {
    if (pkg.scripts[cle] === valeur) {
      console.log(`🆗 ${rel} — « ${cle} » : déjà en liste explicite`);
    } else {
      console.log(`✅ ${rel} — « ${cle} » : CORRIGÉ (liste explicite de ${unitaires.length + e2e.length} fichiers)`);
      pkg.scripts[cle] = valeur;
      modifie = true;
      corriges += 1;
    }
  }
  if (modifie) writeFileSync(p, `${JSON.stringify(pkg, null, 2)}\n`);
}

/* ────────────────────────────────────────────────────────────────
 * 5. Nettoyage : anciens dossiers PostgreSQL de test (exécutions
 *    interrompues) et débris d'un copier-collé raté — sans risque.
 * ──────────────────────────────────────────────────────────────── */
for (const debris of ['backend/fix-tests-parallel.mjs', 'backend/fix-tests-parallel.mjscat']) {
  try {
    if (existsSync(chemin(debris))) {
      rmSync(chemin(debris), { force: true });
      console.log(`🧹 ${debris} : débris de copier-collé supprimé`);
    }
  } catch { /* ignoré */ }
}
for (const d of ['/tmp/agrikon-e2e-pg', join(os.tmpdir(), 'agrikon-e2e-pg')]) {
  try {
    if (existsSync(d)) {
      rmSync(d, { recursive: true, force: true });
      console.log(`🧹 ${d} : ancien dossier de test supprimé`);
    }
  } catch {
    console.warn(`⚠ ${d} : occupé (une autre session l’utilise ?) — supprimez-le à la main si besoin.`);
  }
}

/* ──────────────────────────────────────────────────────────────── */
console.log('');
if (problemes > 0) {
  console.error(`❌ ${problemes} remplacement(s) impossible(s) — voir les messages ci-dessus.`);
  process.exit(1);
}
if (corriges > 0) {
  console.log(`✅ Terminé : ${corriges} correction(s) appliquée(s).`);
  console.log('   Ensuite, lancez :  cd backend && npm test');
} else {
  console.log('🆗 Terminé : tout était déjà en place.');
  console.log('   Vous pouvez lancer :  cd backend && npm test');
}
