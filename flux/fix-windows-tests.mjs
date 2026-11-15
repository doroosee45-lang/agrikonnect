#!/usr/bin/env node
/**
 * AGRIKONNECT — correctifs « compatibilité Windows » des tests, en une commande.
 *
 * Usage, depuis le dossier racine du projet (agrikonnect-africa-final) :
 *
 *     node fix-windows-tests.mjs
 *
 * Ce que ça corrige (suite aux 2 échecs unitaires + au blocage e2e) :
 *   1. tests/authShortcut.test.mjs — le test compare des chemins avec des
 *      antislashs (Windows) à une chaîne à slashs → faux échec « req.user » ;
 *   2. tests/dataMode.test.mjs — le sous-processus reçoit un dossier de travail
 *      invalide sous Windows (« /D:/...%20... ») → faux échec « DataMode » ;
 *   3. scripts/check-env.mjs — même défaut de chemin (npm run verify) ;
 *   4. scripts/seed-demo.mjs — la détection « lancé en ligne de commande » ne
 *      se déclenche jamais sous Windows (le parcours démo ne ferait rien).
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
 * 1. authShortcut.test.mjs — comparaison de chemins sans antislash
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/authShortcut.test.mjs',
  'comparaison de chemin sans antislash',
  `  for (const ecriture of ecritures) {
    assert.ok(
      ecriture.startsWith('src/middleware/auth.js:'),`,
  `  for (const ecriture of ecritures) {
    // Windows : path.relative produit des antislashs — on compare sans tenir
    // compte du séparateur de dossier.
    const cheminNormalise = ecriture.replaceAll(path.sep, '/');
    assert.ok(
      cheminNormalise.startsWith('src/middleware/auth.js:'),`,
);

/* ────────────────────────────────────────────────────────────────
 * 2. dataMode.test.mjs — dossier de travail du sous-processus
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/dataMode.test.mjs',
  'import de fileURLToPath',
  `import { execFile } from 'node:child_process';
import { promisify } from 'node:util';`,
  `import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';`,
);

appliquer(
  'backend/tests/dataMode.test.mjs',
  'dossier de travail réel du sous-processus',
  `    { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, NODE_ENV: nodeEnv, ...extra } },`,
  `    // Windows : URL.pathname donne « /D:/...%20... » — fileURLToPath donne le
    // vrai chemin du dossier.
    { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: nodeEnv, ...extra } },`,
);

/* ────────────────────────────────────────────────────────────────
 * 3. check-env.mjs — même défaut de chemin (npm run verify)
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/scripts/check-env.mjs',
  'import de fileURLToPath',
  `import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';`,
  `import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';`,
);

appliquer(
  'backend/scripts/check-env.mjs',
  'racine réelle du projet',
  `const ROOT = new URL('..', import.meta.url).pathname;`,
  `const ROOT = fileURLToPath(new URL('..', import.meta.url));`,
);

/* ────────────────────────────────────────────────────────────────
 * 4. seed-demo.mjs — détection « lancé en ligne de commande »
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/scripts/seed-demo.mjs',
  'import de pathToFileURL',
  `import process from 'node:process';`,
  `import process from 'node:process';
import { pathToFileURL } from 'node:url';`,
);

appliquer(
  'backend/scripts/seed-demo.mjs',
  'garde de lancement en CLI',
  "const lanceEnCli = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;",
  `const lanceEnCli = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;`,
);

/* ────────────────────────────────────────────────────────────────
 * Vérification locale : les deux fichiers de tests repassent au vert.
 * ──────────────────────────────────────────────────────────────── */
console.log('');
if (existsSync(chemin('backend/src/app.js'))) {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--test', 'tests/authShortcut.test.mjs', 'tests/dataMode.test.mjs'],
      { cwd: chemin('backend') },
    );
    const passe = stdout.match(/^# pass (\d+)$/m)?.[1] ?? '?';
    const rate = stdout.match(/^# fail (\d+)$/m)?.[1] ?? '?';
    console.log(`🧪 Vérification locale : # pass ${passe} — # fail ${rate}`);
    if (rate !== '0') problemes += 1;
  } catch (erreur) {
    const sortie = `${erreur.stdout ?? ''}`;
    const passe = sortie.match(/^# pass (\d+)$/m)?.[1] ?? '?';
    const rate = sortie.match(/^# fail (\d+)$/m)?.[1] ?? '?';
    console.log(`🧪 Vérification locale : # pass ${passe} — # fail ${rate}`);
    console.warn('   Détail ci-dessus si besoin — envoyez-moi la sortie complète.');
    problemes += 1;
  }
}

/* ──────────────────────────────────────────────────────────────── */
console.log('');
if (problemes > 0) {
  console.error(`❌ ${problemes} problème(s) — voir les messages ci-dessus.`);
  process.exit(1);
}
if (corriges > 0) {
  console.log(`✅ Terminé : ${corriges} correction(s) appliquée(s).`);
  console.log('   Prochaine étape :  cd backend && node --test tests/e2e/agronomicRanges.e2e.test.mjs');
} else {
  console.log('🆗 Terminé : tout était déjà en place.');
  console.log('   Prochaine étape :  cd backend && node --test tests/e2e/agronomicRanges.e2e.test.mjs');
}
