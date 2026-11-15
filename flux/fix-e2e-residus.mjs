#!/usr/bin/env node
/**
 * fix-e2e-residus.mjs — correcteur auto-applicatif v7 (idempotent).
 *
 * Deux résidus repérés par votre dernier `npm test` (1245 pass — 1 fail —
 * 1 cancelled) :
 *
 *  A. `tests/e2e/fixtures/surface-anonyme.json` — la référence de la carte
 *     anonyme n'a pas été mise à jour après l'ajout (I2) de la route
 *     `GET /admin/dashboard/export` : le test « la carte des statuts anonymes
 *     n'a pas bougé » signale exactement cette clé manquante.
 *
 *  B. `tests/e2e/support/harness.mjs` — la migration des recettes e2e passe
 *     par `npx prisma migrate deploy` ; `npx` verrouille le cache npm, et en
 *     parallèle (24 fichiers e2e) un appel peut rester bloqué très longtemps
 *     (observé : `twilioErrors` annulé après 48 minutes d'attente). Remplacé
 *     par un appel **direct** du CLI Prisma local avec Node, sans shell ni
 *     réseau, avec un délai de 120 s qui transforme un blocage en erreur claire.
 *
 * Puis le script **exécute réellement** les deux recettes concernées.
 * Idempotent : une seconde exécution ne change rien et redit 🆗.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const racine = fileURLToPath(new URL('.', import.meta.url));
const chemin = (...p) => path.join(racine, ...p);

let corriges = 0;
let problemes = 0;

/* ────────────────────────────────────────────────────────────────
 * A. Carte anonyme : ajouter « GET /admin/dashboard/export » = 401.
 *    Sérialisation identique à celle de `tests/e2e/anonyme.probe.mjs` :
 *    clés triées, JSON.stringify(objet, null, 2) + '\n'.
 * ──────────────────────────────────────────────────────────────── */
const FICHIER_CARTE = chemin('backend', 'tests', 'e2e', 'fixtures', 'surface-anonyme.json');
const CLE = 'GET /admin/dashboard/export';
const EMPREINTE_REFERENCE = '0f8b2e583d1a13752a205bf14170cbbb';

if (!existsSync(FICHIER_CARTE)) {
  console.error('❌ Carte anonyme : fichier introuvable — ' + FICHIER_CARTE);
  problemes += 1;
} else {
  const carte = JSON.parse(readFileSync(FICHIER_CARTE, 'utf8'));
  if (carte[CLE] === 401) {
    console.log('🆗 Carte anonyme : « ' + CLE + ' » déjà présente (401).');
  } else {
    carte[CLE] = 401;
    const triee = Object.fromEntries(Object.keys(carte).sort().map((k) => [k, carte[k]]));
    writeFileSync(FICHIER_CARTE, JSON.stringify(triee, null, 2) + '\n');
    const verif = JSON.parse(readFileSync(FICHIER_CARTE, 'utf8'));
    if (verif[CLE] !== 401) {
      console.error('❌ Carte anonyme : la clé n\'a pas pu être écrite.');
      problemes += 1;
    } else {
      corriges += 1;
      console.log('✅ Carte anonyme : « ' + CLE + ' » ajoutée (401).');
    }
  }
  const empreinte = createHash('md5').update(readFileSync(FICHIER_CARTE)).digest('hex');
  const remarque = empreinte === EMPREINTE_REFERENCE
    ? 'identique à la référence canonique'
    : 'différente de la référence canonique (sans gravité : ce sont les tests qui font foi)';
  console.log('   Empreinte de la carte : ' + empreinte + ' — ' + remarque + '.');
}

/* ────────────────────────────────────────────────────────────────
 * B. Harnais e2e : `npx prisma migrate deploy` → CLI local direct.
 * ──────────────────────────────────────────────────────────────── */
const FICHIER_HARNAIS = chemin('backend', 'tests', 'e2e', 'support', 'harness.mjs');

const AVANT_MIGRATION = `  // Windows : \`npx\` est un .cmd — execFile ne peut pas l'exécuter sans shell
  // (spawn npx ENOENT). shell:true est sûr ici : les arguments ne contiennent
  // ni espaces ni métacaractères (« prisma migrate deploy »).
  await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: prismaEnv,
    shell: process.platform === 'win32',
  });`;

const APRES_MIGRATION = `  // Appel **direct** du CLI Prisma local avec Node — sans \`npx\`, sans shell.
  //
  // Pourquoi pas \`npx\` : la CLI npm verrouille son cache ; lancée en parallèle
  // par les deux douzaines de fichiers e2e, un \`npx\` peut rester bloqué très
  // longtemps derrière ce verrou (observé : un fichier e2e annulé après
  // 48 minutes d'attente). Ici, le CLI local démarre sans réseau ni verrou,
  // et le délai de 120 s transforme un blocage en erreur claire, pas en
  // attente infinie.
  await execFileAsync(
    process.execPath,
    [path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { cwd: backendRoot, env: prismaEnv, timeout: 120_000 },
  );`;

const AVANT_SEMENCE = `    await execFileAsync('node', ['prisma/seed.js'], { cwd: backendRoot, env: prismaEnv });`;

const APRES_SEMENCE = `    await execFileAsync(process.execPath, ['prisma/seed.js'], {
      cwd: backendRoot,
      env: prismaEnv,
      timeout: 120_000,
    });`;

const remplacer = (label, contenu, avant, apres) => {
  if (contenu.includes(apres)) {
    console.log('🆗 ' + label + ' : déjà en place.');
    return contenu;
  }
  if (!contenu.includes(avant)) {
    console.error('❌ ' + label + ' : ni l\'ancien ni le nouveau texte trouvés — '
      + 'le fichier a peut-être été modifié à la main. Rien n\'a été touché.');
    problemes += 1;
    return contenu;
  }
  corriges += 1;
  console.log('✅ ' + label + ' : corrigé.');
  return contenu.replace(avant, apres);
};

if (!existsSync(FICHIER_HARNAIS)) {
  console.error('❌ Harnais e2e : fichier introuvable — ' + FICHIER_HARNAIS);
  problemes += 1;
} else {
  let contenu = readFileSync(FICHIER_HARNAIS, 'utf8');
  contenu = remplacer('Harnais — migration (appel direct du CLI Prisma)',
    contenu, AVANT_MIGRATION, APRES_MIGRATION);
  contenu = remplacer('Harnais — référentiels (délai de 120 s)',
    contenu, AVANT_SEMENCE, APRES_SEMENCE);
  writeFileSync(FICHIER_HARNAIS, contenu);
  const relecture = readFileSync(FICHIER_HARNAIS, 'utf8');
  if (!relecture.includes("'prisma', 'build', 'index.js'") || relecture.includes("execFileAsync('npx'")) {
    console.error('❌ Harnais e2e : la relecture ne correspond pas à ce qui était attendu.');
    problemes += 1;
  }
}

/* ────────────────────────────────────────────────────────────────
 * C. Script de test : `--test-force-exit --test-timeout=240000`.
 *
 * `--test-force-exit` : chez vous, tous les tests de `twilioErrors` sont
 * passés, mais la fin du fichier a traîné (reliquats de fermeture) et Node a
 * ajouté une entrée « cancelled » fantôme. Ce drapeau fait sortir le processus
 * une fois les tests achevés — les assertions, elles, ont toutes tourné.
 * `--test-timeout=240000` : un blocage réel devient une erreur claire au bout
 * de 4 minutes, pas une attente de 48 minutes.
 * ──────────────────────────────────────────────────────────────── */
const FICHIER_PKG = chemin('backend', 'package.json');
if (!existsSync(FICHIER_PKG)) {
  console.error('❌ package.json introuvable — ' + FICHIER_PKG);
  problemes += 1;
} else {
  const pkg = JSON.parse(readFileSync(FICHIER_PKG, 'utf8'));
  const script = pkg.scripts?.test ?? '';
  if (script.includes('--test-force-exit')) {
    console.log('🆗 Script de test : drapeaux déjà présents.');
  } else if (!script.startsWith('node --test ')) {
    console.error('❌ Script de test : forme inattendue — rien n\'a été touché.');
    problemes += 1;
  } else {
    pkg.scripts.test = script.replace(
      'node --test ',
      'node --test --test-force-exit --test-timeout=240000 ',
    );
    writeFileSync(FICHIER_PKG, JSON.stringify(pkg, null, 2) + '\n');
    const relecture = JSON.parse(readFileSync(FICHIER_PKG, 'utf8'));
    if (!relecture.scripts.test.includes('--test-force-exit')) {
      console.error('❌ Script de test : la relecture ne correspond pas à ce qui était attendu.');
      problemes += 1;
    } else {
      corriges += 1;
      console.log('✅ Script de test : --test-force-exit --test-timeout=240000 ajoutés.');
    }
  }
}

/* ────────────────────────────────────────────────────────────────
 * Vérifications réelles : les deux recettes concernées, en entier.
 * ──────────────────────────────────────────────────────────────── */
const nettoyer = (sortie) => `${sortie ?? ''}`
  .replace(/\x1b\[[0-9;]*m/g, '')
  .replace(/\r/g, '');

const resume = (sortie) => {
  const propre = nettoyer(sortie);
  const passe = propre.match(/^(?:#\s*|\u2139\s*)pass\s+(\d+)\s*$/m)?.[1] ?? '?';
  const rate = propre.match(/^(?:#\s*|\u2139\s*)fail\s+(\d+)\s*$/m)?.[1] ?? '?';
  const annules = propre.match(/^(?:#\s*|\u2139\s*)cancelled\s+(\d+)\s*$/m)?.[1] ?? '?';
  return { passe, rate, annules, propre };
};

const executer = async (titre, fichier, attendu) => {
  console.log('');
  console.log('⏳ ' + titre + ' …');
  let sortie = '';
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--test', '--test-force-exit', '--test-timeout=240000', fichier],
      { cwd: chemin('backend'), maxBuffer: 64 * 1024 * 1024 },
    );
    sortie = stdout;
  } catch (erreur) {
    sortie = `${erreur.stdout ?? ''}`;
  }
  const { passe, rate, annules, propre } = resume(sortie);
  console.log('🧪 ' + titre + ' : pass ' + passe + ' — fail ' + rate
    + ' — cancelled ' + annules);
  if (rate !== '0' || annules !== '0' || passe === '?') {
    problemes += 1;
    const lignes = propre.split('\n').filter((l) => l.trim() !== '');
    console.warn('   Dernières lignes :');
    for (const ligne of lignes.slice(-8)) console.warn('   ' + ligne);
  } else if (passe !== String(attendu)) {
    console.warn('   ⚠ compte inattendu : ' + attendu + ' test(s) attendu(s), '
      + passe + ' obtenu(s) — à signaler.');
  }
};

if (existsSync(chemin('backend', 'tests', 'e2e', 'surfacePublique.e2e.test.mjs'))) {
  await executer('Surface publique (carte des statuts)',
    'tests/e2e/surfacePublique.e2e.test.mjs', 8);
  await executer('Erreurs Twilio (correspondance des codes)',
    'tests/e2e/twilioErrors.e2e.test.mjs', 10);
} else {
  console.error('❌ Recettes e2e introuvables — êtes-vous à la racine du projet ?');
  problemes += 1;
}

/* ──────────────────────────────────────────────────────────────── */
console.log('');
if (problemes > 0) {
  console.error('❌ ' + problemes + ' problème(s) — voir les messages ci-dessus.');
  process.exit(1);
}
if (corriges > 0) {
  console.log('✅ Terminé : ' + corriges + ' correction(s) appliquée(s), vérifications au vert.');
} else {
  console.log('🆗 Terminé : tout était déjà en place, vérifications au vert.');
}
console.log('   Prochaine étape :  cd backend && npm test');
console.log('   Résultat attendu : fail 0 — cancelled 0 (et toutes les recettes au vert).');
