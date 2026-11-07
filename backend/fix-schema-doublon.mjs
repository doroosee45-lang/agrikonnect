#!/usr/bin/env node
/**
 * fix-schema-doublon.mjs — répare schema.prisma (v9, idempotent).
 *
 * Contexte : `prisma migrate diff` répond P1012 — « The model "SettingRevision"
 * cannot be defined because a model with that name already exists » : votre
 * `backend/prisma/schema.prisma` contient un bloc `model` (ou `enum`) en
 * DOUBLE, suite à un copier-coller. `migrate deploy` (qui ne lit que la source
 * de connexion) tolérait ce dédoublement ; toute lecture complète du modèle,
 * non.
 *
 * Ce que fait le script, dans l'ordre :
 *
 *  1. Il repère les blocs `model`/`enum`/`type` dupliqués dans le fichier.
 *  2. Si les copies sont identiques (commentaires et blancs mis à part), la
 *     copie en trop est retirée ; si elles DIFFÈRENT, le script s'arrête SANS
 *     RIEN TOUCHER et affiche les deux blocs pour relecture humaine.
 *  3. Le fichier réparé est d'abord validé sur une COPIE TEMPORAIRE
 *     (`prisma validate --schema`) : le fichier réel n'est écrasé qu'après
 *     validation réussie.
 *  4. `prisma generate` régénère le client, puis la chaîne de baseline
 *     (`fix-baseline.mjs`) est lancée : migration des 19 migrations.
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
const FICHIER_TEMP = chemin('backend', 'prisma', 'schema-verification.prisma');
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

/* ── 1. Repérage des blocs de haut niveau ─────────────────────────── */
const lignes = readFileSync(FICHIER, 'utf8').split(/\r?\n/);
const blocs = [];
{
  let debut = -1;
  let nom = '';
  let profondeur = 0;
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i];
    const entete = ligne.match(/^(model|enum|type|view)\s+(\w+)\s*\{/);
    if (entete && profondeur === 0) {
      debut = i;
      nom = `${entete[1]} ${entete[2]}`;
      profondeur = (ligne.match(/\{/g) ?? []).length - (ligne.match(/\}/g) ?? []).length;
    } else if (debut >= 0) {
      profondeur += (ligne.match(/\{/g) ?? []).length - (ligne.match(/\}/g) ?? []).length;
      if (profondeur <= 0) {
        blocs.push({ nom, debut, fin: i });
        debut = -1;
        profondeur = 0;
      }
    }
  }
}

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
      // attachés (le copier-coller les a emportés) — sinon il en reste des
      // débris orphelins en tête ou fin de fichier.
      let d = copie.debut;
      while (d > 0 && (lignes[d - 1].trim() === '' || lignes[d - 1].trim().startsWith('//'))) d -= 1;
      for (let i = d; i <= copie.fin; i += 1) aRetirer.push(i);
    }
  }
  const retenues = new Set(aRetirer);
  const reparer = lignes.filter((_, i) => !retenues.has(i)).join('\n');

  /* ── 3. Validation sur copie temporaire AVANT d'écraser ─────────── */
  writeFileSync(FICHIER_TEMP, reparer + '\n');
  let validation;
  try {
    await execFileAsync(process.execPath, [CLI, 'validate', '--schema',
      path.join('prisma', 'schema-verification.prisma')],
    { cwd: chemin('backend'), maxBuffer: 32 * 1024 * 1024 });
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
console.log('   Empreinte de schema.prisma : ' + empreinte
  + (empreinte === EMPREINTE_REFERENCE
    ? ' (identique à la référence canonique)'
    : ' (différente de la référence — sans gravité si la validation passe)'));

/* ── 4. Régénération du client ────────────────────────────────────── */
console.log('⏳ Régénération du client Prisma …');
try {
  await execFileAsync(process.execPath, [CLI, 'generate'],
    { cwd: chemin('backend'), maxBuffer: 64 * 1024 * 1024 });
  console.log('🆗 Client Prisma régénéré.');
} catch (erreur) {
  console.error('❌ prisma generate a échoué :');
  console.error(`${erreur.stdout ?? ''}\n${erreur.stderr ?? ''}`.split('\n').slice(-8).join('\n'));
  process.exit(1);
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
