#!/usr/bin/env node
/**
 * fix-schema-doublon.mjs — répare schema.prisma (v10, idempotent).
 *
 * Contexte : `prisma migrate diff` répond P1012 — « The model "SettingRevision"
 * cannot be defined because a model with that name already exists » : votre
 * `backend/prisma/schema.prisma` contient un bloc `model` (ou `enum`) en
 * DOUBLE, suite à un copier-coller (la copie se trouve vers la ligne 3080).
 *
 * v10 : le détecteur ne compte plus les accolades (un commentaire contenant
 * une accolade le perdait) — il repère chaque bloc par son en-tête et sa
 * ligne de fermeture `}` seule, comme formate Prisma.
 *
 * Ce que fait le script, dans l'ordre :
 *
 *  1. Il repère les blocs `model`/`enum`/`type` dupliqués.
 *  2. Si les copies sont identiques (commentaires et blancs mis à part), la
 *     copie en trop est retirée AVEC ses commentaires attachés ; si elles
 *     DIFFÈRENT, le script s'arrête SANS RIEN TOUCHER et affiche les deux.
 *  3. La version réparée est validée sur une COPIE TEMPORAIRE hors du projet
 *     (`prisma validate --schema`) : le fichier réel n'est écrasé qu'après
 *     validation réussie.
 *  4. `prisma generate` régénère le client si le fichier a changé (un
 *     verrou Windows — EPERM — est signalé sans bloquer la suite), puis la
 *     chaîne de baseline (`fix-baseline.mjs`) est lancée.
 *
 * Aucun secret n'est imprimé. Idempotent : une seconde exécution dit 🆗.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const execFileAsync = promisify(execFile);
const racine = fileURLToPath(new URL('.', import.meta.url));
const chemin = (...p) => path.join(racine, ...p);

let corriges = 0;

const FICHIER = chemin('backend', 'prisma', 'schema.prisma');
const FICHIER_TEMP = chemin('schema-verification.prisma');
const EMPREINTE_REFERENCE = '315d52597bd8f044b58135efd1dfc69a';
const CLI = chemin('backend', 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(FICHIER)) {
  console.error('❌ backend/prisma/schema.prisma introuvable.');
  process.exit(1);
}
if (!existsSync(CLI)) {
  console.error('❌ CLI Prisma introuvable (node_modules) — lancez d\'abord : npm install');
  process.exit(1);
}

/* ── 1. Repérage des blocs (sans comptage d'accolades) ──────────────
 * Un bloc commence par son en-tête en colonne 0 et se termine à la
 * première ligne `}` seule — la convention de formattage Prisma. Les
 * accolades présentes dans les commentaires ou les chaînes ne peuvent
 * donc plus décaler la lecture. */
const lignes = readFileSync(FICHIER, 'utf8').split(/\r?\n/);
const blocs = [];
for (let i = 0; i < lignes.length; i += 1) {
  const entete = lignes[i].match(/^(model|enum|type|view)\s+(\w+)\s*\{/);
  if (!entete) continue;
  let fin = -1;
  for (let j = i + 1; j < lignes.length; j += 1) {
    if (/^\}/.test(lignes[j])) { fin = j; break; }
  }
  if (fin === -1) {
    console.error('❌ Bloc « ' + entete[2] + ' » sans ligne de fermeture `}` — '
      + 'le fichier est trop dégradé pour être réparé automatiquement. RIEN n\'a été touché.');
    process.exit(1);
  }
  blocs.push({ nom: `${entete[1]} ${entete[2]}`, debut: i, fin });
  i = fin;
}

if (blocs.length < 50) {
  console.error('❌ Seulement ' + blocs.length + ' bloc(s) lisible(s) dans schema.prisma — '
    + 'lecture suspecte, RIEN n\'a été touché. Coller ce message dans le chat.');
  process.exit(1);
}
console.log('   ' + blocs.length + ' bloc(s) lu(s) dans schema.prisma.');

const parNom = new Map();
for (const b of blocs) {
  if (!parNom.has(b.nom)) parNom.set(b.nom, []);
  parNom.get(b.nom).push(b);
}
const dobles = [...parNom.entries()].filter(([, liste]) => liste.length > 1);

if (dobles.length === 0) {
  console.log('🆗 schema.prisma : aucun bloc dupliqué — rien à réparer.');
} else {
  const sansBlancNiCommentaire = (debut, fin) => lignes
    .slice(debut, fin + 1)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('//'))
    .join('\n');

  const aRetirer = [];
  for (const [nom, liste] of dobles) {
    console.log('🔍 ' + nom + ' : ' + liste.length + ' occurrences (lignes '
      + liste.map((b) => b.debut + 1).join(', ') + ')');
    const reference = sansBlancNiCommentaire(liste[0].debut, liste[0].fin);
    for (const copie of liste.slice(1)) {
      if (sansBlancNiCommentaire(copie.debut, copie.fin) !== reference) {
        console.error('❌ Les copies de « ' + nom + ' » DIFFÈRENT — RIEN n\'a été touché.');
        console.error('   Première copie (lignes ' + (liste[0].debut + 1) + ' à ' + (liste[0].fin + 1) + ') :');
        for (const l of lignes.slice(liste[0].debut, liste[0].fin + 1)) console.error('   | ' + l);
        console.error('   Autre copie (lignes ' + (copie.debut + 1) + ' à ' + (copie.fin + 1) + ') :');
        for (const l of lignes.slice(copie.debut, copie.fin + 1)) console.error('   | ' + l);
        console.error('   Coller ceci dans le chat pour arbitrage.');
        process.exit(1);
      }
      // La copie en trop est retirée AVEC ses commentaires et lignes blanches
      // attachés (le copier-coller les a emportés).
      let d = copie.debut;
      while (d > 0 && (lignes[d - 1].trim() === '' || lignes[d - 1].trim().startsWith('//'))) d -= 1;
      for (let i = d; i <= copie.fin; i += 1) aRetirer.push(i);
    }
  }
  const retenues = new Set(aRetirer);
  const reparer = lignes.filter((_, i) => !retenues.has(i)).join('\n');

  /* ── 3. Validation sur copie temporaire AVANT d'écraser ───────────
   * La copie est placée HORS du projet : lancé depuis la racine, le CLI
   * n'a aucun schéma par défaut à y ajouter. */
  writeFileSync(FICHIER_TEMP, reparer + '\n');
  let validation;
  try {
    await execFileAsync(process.execPath, [CLI, 'validate', '--schema',
      'schema-verification.prisma'],
    { cwd: racine, maxBuffer: 32 * 1024 * 1024 });
    validation = true;
  } catch {
    validation = false;
  }
  if (!validation) {
    rmSync(FICHIER_TEMP, { force: true });
    console.error('❌ La version réparée ne valide pas — le fichier réel n\'a pas été modifié.');
    console.error('   Coller ce message dans le chat pour analyse.');
    process.exit(1);
  }
  writeFileSync(FICHIER, reparer);
  rmSync(FICHIER_TEMP, { force: true });
  corriges += 1;
  console.log('✅ ' + aRetirer.length + ' ligne(s) de doublon retirée(s) — version validée.');
}

/* ── Empreinte ────────────────────────────────────────────────────── */
const empreinte = createHash('md5').update(readFileSync(FICHIER)).digest('hex');
const conforme = empreinte === EMPREINTE_REFERENCE;
console.log('   Empreinte de schema.prisma : ' + empreinte
  + (conforme ? ' (identique à la référence canonique)'
    : ' (différente de la référence — sans gravité si la validation passe)'));

/* ── 4. Régénération du client (utile seulement si le fichier a changé,
 *     et jamais bloquante : un verrou Windows est signalé, pas subi) ── */
if (corriges === 0 && conforme) {
  console.log('🆗 Client Prisma déjà en cohérence — régénération inutile.');
} else {
  console.log('⏳ Régénération du client Prisma …');
  try {
    await execFileAsync(process.execPath, [CLI, 'generate'],
      { cwd: chemin('backend'), maxBuffer: 64 * 1024 * 1024 });
    console.log('🆗 Client Prisma régénéré.');
  } catch (erreur) {
    const detail = `${erreur.stdout ?? ''}\n${erreur.stderr ?? ''}`;
    if (/EPERM|EBUSY|locked|being used/i.test(detail)) {
      console.log('⚠️  Régénération reportée : le moteur Prisma est verrouillé par un '
        + 'processus Node en cours (serveur de dev ? test qui tourne ?).');
      console.log('   Rien de grave : fermez ce processus puis relancez « npx prisma generate ».');
      console.log('   La chaîne continue — le client existant est déjà en cohérence.');
    } else {
      console.error('❌ prisma generate a échoué :');
      console.error(detail.split('\n').slice(-8).join('\n'));
      process.exit(1);
    }
  }
}

/* ── 5. Chaîne vers la baseline ───────────────────────────────────── */
const fixBaseline = chemin('fix-baseline.mjs');
if (!existsSync(fixBaseline)) {
  console.log('🆗 Terminé. Prochaine étape : node fix-baseline.mjs');
  process.exit(0);
}
console.log('⏳ Lancement de la baseline (fix-baseline.mjs) …');
console.log('');
const code = await new Promise((resolve) => {
  const enfant = spawn(process.execPath, [fixBaseline], {
    cwd: racine,
    stdio: 'inherit',
    env: process.env,
  });
  enfant.on('exit', (c) => resolve(c ?? 1));
  enfant.on('error', () => resolve(1));
});
console.log('');
if (code === 0) {
  console.log(corriges > 0
    ? '✅ Terminé : ' + corriges + ' correction(s), schéma réparé et base sous gestion Prisma.'
    : '🆗 Terminé : schéma sain, base sous gestion Prisma.');
  console.log('   Prochaine étape : rotation des identifiants, puis I3.');
} else {
  console.error('❌ La baseline s\'est arrêtée — voir ses messages ci-dessus.');
}
process.exit(code);
