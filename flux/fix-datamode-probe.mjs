#!/usr/bin/env node
/**
 * AGRIKONNECT — correctif « test DataMode indépendant du .env local », en une commande.
 *
 * Usage, depuis le dossier racine du projet (agrikonnect-africa-final) :
 *
 *     node fix-datamode-probe.mjs
 *
 * Ce que ça corrige (suite à l'échec « DataMode (config) » dans npm test) :
 *   1. tests/helpers/pinTestEnv.mjs — créé : fige la messagerie à `console`
 *      AVANT tout import applicatif ; un `.env` local en cours de réglage
 *      (Twilio pas encore configuré, EMAIL_FROM manquant…) faisait `process.exit(1)`
 *      dans `env.js` et tuait le fichier de test entier ;
 *   2. tests/dataMode.test.mjs — importe ce garde-fou en premier ;
 *   3. tests/dataMode.test.mjs — la sonde devient **hermétique** : elle
 *      construit un environnement minimal (plus de `.env` ni de variables npm
 *      hérités), retente une fois si le lancement Windows échoue sous la charge,
 *      et remonte la sortie complète du processus enfant en cas d'échec.
 *
 * Le script prouve le tout avec LA configuration qui échouait chez vous
 * (SMS_PROVIDER=twilio + EMAIL_PROVIDER=resend incomplets).
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
 * 1. tests/helpers/pinTestEnv.mjs — garde-fou d'environnement
 * ──────────────────────────────────────────────────────────────── */
const PIN_REL = 'backend/tests/helpers/pinTestEnv.mjs';
const PIN_CONTENU = `/**
 * Réglages d'environnement pour les tests unitaires — posés AVANT tout import
 * applicatif.
 *
 * Les modules de \`src/\` chargent \`config/env.js\` à l'import, qui applique
 * \`.env\` et refuse de démarrer si la configuration de messagerie est
 * incomplète (process.exit(1)). Un \`.env\` local en cours de réglage (Twilio
 * pas encore configuré, EMAIL_FROM manquant…) tuerait alors le fichier de test
 * entier avant la moindre assertion. La messagerie n'a rien à voir avec ce que
 * ces tests vérifient : on la fige donc à « console ».
 */
process.env.SMS_PROVIDER = 'console';
process.env.EMAIL_PROVIDER = 'console';

// Filet de sécurité : si .env ne fournit pas les valeurs minimales du schéma,
// des valeurs factices suffisent — aucun test ne parle à ces services.
process.env.DATABASE_URL ??= 'postgresql://agrikon:test@127.0.0.1:54321/test';
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY ??= 'cle-anon-de-test';
`;

if (!existsSync(chemin(PIN_REL))) {
  writeFileSync(chemin(PIN_REL), PIN_CONTENU);
  console.log(`✅ ${PIN_REL} : CRÉÉ (garde-fou d’environnement)`);
  corriges += 1;
} else {
  console.log(`🆗 ${PIN_REL} : déjà présent`);
}

/* ────────────────────────────────────────────────────────────────
 * 2. dataMode.test.mjs — le garde-fou est importé en premier
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/dataMode.test.mjs',
  'import du garde-fou d’environnement',
  `import test from 'node:test';
import assert from 'node:assert/strict';`,
  `import './helpers/pinTestEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';`,
);

/* ────────────────────────────────────────────────────────────────
 * 3. dataMode.test.mjs — sonde hermétique
 * ──────────────────────────────────────────────────────────────── */
appliquer(
  'backend/tests/dataMode.test.mjs',
  'sonde hermétique',
  `const probeSimulationAllowed = async (nodeEnv, extra = {}) => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', "import('./src/config/env.js').then(({env})=>console.log(env.simulationAllowed))"],
    // Windows : URL.pathname donne « /D:/...%20... » — fileURLToPath donne le
    // vrai chemin du dossier.
    { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: nodeEnv, ...extra } },
  );
  return stdout.trim();
};`,
  `const envDeSonde = {
  PATH: process.env.PATH ?? '',
  SystemRoot: process.env.SystemRoot ?? '',
  ComSpec: process.env.ComSpec ?? '',
  DATABASE_URL: 'postgresql://agrikon:test@127.0.0.1:54321/sonde',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'cle-anon-de-sonde',
  SMS_PROVIDER: 'console',
  EMAIL_PROVIDER: 'console',
};

const probeSimulationAllowed = async (nodeEnv, extra = {}) => {
  const args = [
    '--input-type=module',
    '-e',
    "import('./src/config/env.js').then(({env})=>console.log(env.simulationAllowed))",
  ];
  const options = {
    // Windows : URL.pathname donne « /D:/...%20... » — fileURLToPath donne le
    // vrai chemin du dossier.
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...envDeSonde, NODE_ENV: nodeEnv, ...extra },
    maxBuffer: 8 * 1024 * 1024,
  };
  /*
   * Sous Windows, une nuée de processus parallèles peut faire échouer le
   * lancement lui-même (ENOENT/EAGAIN transitoires) : une seconde tentative
   * suffit. Un échec du processus enfant, lui, n'est jamais retenté — son
   * message doit remonter tel quel.
   */
  for (let tentative = 0; tentative < 2; tentative += 1) {
    try {
      const { stdout } = await execFileAsync(process.execPath, args, options);
      const lignes = stdout.trim().split('\\n');
      return lignes[lignes.length - 1].trim();
    } catch (erreur) {
      const rattrapable = ['ENOENT', 'EAGAIN', 'EMFILE'].includes(erreur.code);
      if (!rattrapable || tentative === 1) {
        const sortie = String(erreur.stdout ?? '') + ' ' + String(erreur.stderr ?? '');
        throw new Error(
          'Sonde env.js impossible (NODE_ENV=' + nodeEnv + ') : '
          + erreur.message + ' — sortie : ' + sortie.trim(),
        );
      }
    }
  }
};`,
);

/* ────────────────────────────────────────────────────────────────
 * Vérifications : la configuration qui échouait chez vous, puis la normale.
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

const executer = async (titre, envSupplementaire) => {
  console.log('');
  console.log(`⏳ ${titre} …`);
  let sortie = '';
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--test', 'tests/dataMode.test.mjs'],
      {
        cwd: chemin('backend'),
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...envSupplementaire },
      },
    );
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
  await executer('DataMode avec un .env hostile (twilio/resend incomplets)', {
    SMS_PROVIDER: 'twilio',
    EMAIL_PROVIDER: 'resend',
  });
  await executer('DataMode (environnement normal)', {});
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
console.log('   Résultat attendu : pass 1246 — fail 0.');
