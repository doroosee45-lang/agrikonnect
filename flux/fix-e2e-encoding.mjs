#!/usr/bin/env node
/**
 * AGRIKONNECT — correctif « encodage UTF-8 des bases de test e2e », en une commande.
 *
 * Usage, depuis le dossier racine du projet (agrikonnect-africa-final) :
 *
 *     node fix-e2e-encoding.mjs
 *
 * Ce que ça corrige (suite à l'échec P3018 / 22P05 « no equivalent in encoding
 * WIN1252 ») :
 *   - tests/e2e/support/harness.mjs — le cluster PostgreSQL de test s'initialise
 *     avec la locale Windows (WIN1252) ; toute migration en UTF-8 (signe U+2264,
 *     tirets, flèches) est rejetée, puis tous les tests e2e tombent ensemble.
 *     On force UTF-8 + locale C : identiques partout, comme la production
 *     (Supabase est UTF-8).
 *
 * Le script vérifie ensuite les correctifs précédents (2 tests unitaires) et
 * lance LA recette e2e qui bloquait (agronomicRanges) en preuve.
 *
 * Relançable à volonté : si c'est déjà fait, le script le dit et ne touche à rien.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
 * 1. harness.mjs — cluster PostgreSQL de test en UTF-8, partout
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/e2e/support/harness.mjs',
  'cluster PostgreSQL de test en UTF-8',
  `  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'agrikon',
    password: 'agrikon',
    port: PG_PORT,
    persistent: false,
    onLog: () => {},
  });`,
  `  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'agrikon',
    password: 'agrikon',
    port: PG_PORT,
    persistent: false,
    onLog: () => {},
    // Windows : initdb hérite de la locale système (WIN1252) — la moindre
    // migration en UTF-8 (signe U+2264, tirets, flèches) est alors rejetée
    // (erreur 22P05) et tous les tests e2e meurent au démarrage. On force
    // UTF-8 + locale C : identiques partout, et à l'image de la production
    // (Supabase est UTF-8).
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
  });`,
);

/* ────────────────────────────────────────────────────────────────
 * Vérifications : 2 tests unitaires (correctifs Windows), puis la
 * recette e2e qui bloquait — en preuve réelle.
 * ──────────────────────────────────────────────────────────────── */
const nettoyer = (sortie) => `${sortie ?? ''}`
  .replace(/\x1b\[[0-9;]*m/g, '')
  .replace(/\r/g, '');

const resume = (sortie) => {
  const propre = nettoyer(sortie);
  const passe = propre.match(/^(?:#\s*|\u2139\s*)pass\s+(\d+)\s*$/m)?.[1] ?? '?';
  const rate = propre.match(/^(?:#\s*|\u2139\s*)fail\s+(\d+)\s*$/m)?.[1] ?? '?';
  return { passe, rate, propre };
};

const executer = async (titre, args) => {
  console.log('');
  console.log(`⏳ ${titre} …`);
  let sortie = '';
  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: chemin('backend'),
      maxBuffer: 64 * 1024 * 1024,
    });
    sortie = stdout;
  } catch (erreur) {
    sortie = `${erreur.stdout ?? ''}`;
  }
  const { passe, rate, propre } = resume(sortie);
  console.log(`🧪 ${titre} : pass ${passe} — fail ${rate}`);
  if (rate !== '0') {
    problemes += 1;
    const lignes = propre.split('\n').filter((l) => l.trim() !== '');
    console.warn('   Dernières lignes :');
    for (const ligne of lignes.slice(-8)) console.warn(`   ${ligne}`);
  }
};

if (existsSync(chemin('backend/src/app.js'))) {
  await executer(
    'Tests unitaires Windows (authShortcut + dataMode)',
    ['--test', 'tests/authShortcut.test.mjs', 'tests/dataMode.test.mjs'],
  );
  await executer(
    'Recette e2e qui bloquait (agronomicRanges)',
    ['--test', 'tests/e2e/agronomicRanges.e2e.test.mjs'],
  );
}

/* ──────────────────────────────────────────────────────────────── */
console.log('');
if (problemes > 0) {
  console.error(`❌ ${problemes} problème(s) — voir les messages ci-dessus.`);
  process.exit(1);
}
if (corriges > 0) {
  console.log(`✅ Terminé : ${corriges} correction(s) appliquée(s), vérifications au vert.`);
} else {
  console.log('🆗 Terminé : tout était déjà en place, vérifications au vert.');
}
console.log('   Prochaine étape :  cd backend && npm test');
console.log('   Résultat attendu : # pass 1246 — # fail 0 (ou l’équivalent « pass 1246 »).');
