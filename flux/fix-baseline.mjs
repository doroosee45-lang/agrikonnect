#!/usr/bin/env node
/**
 * fix-baseline.mjs — mise sous gestion Prisma de la base existante (v8, idempotent).
 *
 * Contexte : `npx prisma migrate deploy` répond P3005 — « the database schema is
 * not empty » : votre base contient déjà le schéma, mais sans le journal
 * `_prisma_migrations`, donc Prisma refuse d'y appliquer l'historique.
 *
 * Ce que fait le script, dans l'ordre :
 *
 *  1. `prisma migrate deploy` — si tout est déjà géré, il le dit et on s'arrête (🆗).
 *  2. Sinon (P3005), il calcule le **delta réel** entre votre base et
 *     `prisma/schema.prisma` (`prisma migrate diff`, lecture seule).
 *  3. Décision :
 *       - delta vide            → la base est déjà conforme ;
 *       - delta uniquement **additif** (créations) → il est appliqué ;
 *       - delta avec suppression → le script s'arrête SANS RIEN CASSER, écrit
 *         `delta-baseline.sql` et montre l'extrait pour relecture humaine.
 *  4. Baseline : les 19 migrations sont enregistrées comme appliquées
 *     (`prisma migrate resolve --applied`), puis `migrate deploy` vérifie
 *     « No pending migrations to apply ».
 *
 * Aucun secret n'est imprimé : les URL de connexion sont filtrées des sorties.
 * Idempotent : une seconde exécution dit 🆗 et ne change rien.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const racine = fileURLToPath(new URL('.', import.meta.url));
const chemin = (...p) => path.join(racine, ...p);

let corriges = 0;
let problemes = 0;

/* ── Lecture de la configuration (jamais imprimée) ─────────────────── */
const lireEnv = (fichier) => {
  const env = {};
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const s = ligne.trim();
    if (s === '' || s.startsWith('#')) continue;
    const m = s.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
};

const fichierEnv = chemin('backend', '.env');
if (!existsSync(fichierEnv)) {
  console.error('❌ backend/.env introuvable — impossible de se connecter à la base.');
  process.exit(1);
}
const envFichier = lireEnv(fichierEnv);
const url = process.env.DATABASE_URL ?? envFichier.DATABASE_URL;
const urlDirect = process.env.DIRECT_URL ?? envFichier.DIRECT_URL ?? url;
if (!url) {
  console.error('❌ DATABASE_URL absente de backend/.env.');
  process.exit(1);
}

/* ── Appel du CLI Prisma local (sans npx), secrets filtrés ───────── */
const CLI = chemin('backend', 'node_modules', 'prisma', 'build', 'index.js');
if (!existsSync(CLI)) {
  console.error('❌ CLI Prisma introuvable (node_modules) — lancez d\'abord : npm install');
  process.exit(1);
}

const filtrer = (texte) => `${texte ?? ''}`
  .split(/\r?\n/)
  .filter((l) => !/postgresql:\/\//i.test(l) && !/pooler\.|supabase\.com/i.test(l)
    && !/@[a-z0-9.-]+:/i.test(l))
  .join('\n')
  .trim();

const cli = async (args) => {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
      cwd: chemin('backend'),
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: urlDirect },
    });
    return { ok: true, stdout: `${stdout ?? ''}`, out: `${stdout ?? ''}\n${stderr ?? ''}` };
  } catch (erreur) {
    return {
      ok: false,
      stdout: `${erreur.stdout ?? ''}`,
      out: `${erreur.stdout ?? ''}\n${erreur.stderr ?? ''}`,
    };
  }
};

/* ── 1. Tentative directe ─────────────────────────────────────────── */
console.log('⏳ Vérification de l\'état Prisma de la base …');
let etat = await cli(['migrate', 'deploy']);
if (etat.ok && /No pending migrations to apply/i.test(etat.out)) {
  console.log('🆗 Base déjà sous gestion Prisma : aucune migration en attente.');
  console.log('');
  console.log('🆗 Terminé : tout était déjà en place.');
  console.log('   Prochaine étape : rotation des identifiants, puis I3.');
  process.exit(0);
}
if (etat.ok) {
  // Déploiement réellement effectué (base vierge ou partiellement gérée).
  const appliquees = (etat.out.match(/following migration\(s\) have been applied/i) ?? []).length > 0;
  console.log(appliquees
    ? '✅ Migrations appliquées directement par deploy.'
    : '✅ Deploy terminé.');
  console.log('');
  console.log('✅ Terminé.');
  process.exit(0);
}
if (!/P3005/i.test(etat.out)) {
  console.error('❌ migrate deploy a échoué autrement que par P3005 :');
  console.error(filtrer(etat.out).split('\n').slice(-8).join('\n'));
  process.exit(1);
}
console.log('🆗 P3005 confirmé : schéma présent, historique Prisma absent — baseline nécessaire.');

/* ── 2. Delta réel base ↔ schema.prisma ───────────────────────────── */
const SCHEMA = path.join('prisma', 'schema.prisma');
const diffAvecRepli = async () => {
  const premier = await cli(['migrate', 'diff', '--from-url', url,
    '--to-schema-datamodel', SCHEMA, '--script']);
  if (premier.ok) return premier;
  if (/Unknown argument|unknown option/i.test(premier.out)) {
    return cli(['migrate', 'diff', '--from-url', url,
      '--to-schema-file', SCHEMA, '--script']);
  }
  return premier;
};

console.log('⏳ Calcul du delta entre votre base et le schéma attendu …');
const delta = await diffAvecRepli();
if (!delta.ok) {
  console.error('❌ Impossible de calculer le delta :');
  console.error(filtrer(delta.out).split('\n').slice(-8).join('\n'));
  process.exit(1);
}

const sql = delta.stdout
  .split(/\r?\n/)
  .filter((l) => !/^(Environment variables|Prisma schema loaded|Datasource)/.test(l.trim()))
  .join('\n')
  .trim();

/*
 * Analyse instruction par instruction. Deux faux positifs connus, sans danger
 * pour l'application, sont écartés :
 *  - toute instruction visant `_prisma_migrations` (journal interne de Prisma,
 *    que l'introspection voit comme une table ordinaire) ;
 *  - les `DROP INDEX` : les migrations créent des index que schema.prisma ne
 *    modèle pas (ex. index GIN de admin_governance) — les garder est correct.
 * Une vraie suppression (table, colonne, type, lignes) reste bloquante.
 */
const instructions = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s !== '');
const sansCommentaire = (s) => s.split('\n')
  .filter((l) => !l.trim().startsWith('--')).join('\n').trim();
const estInterne = (s) => /_prisma_migrations/.test(s)
  || /^DROP\s+INDEX\b/i.test(sansCommentaire(s));
const estDestructif = (s) => /\b(DROP\s+(TABLE|COLUMN|TYPE|SCHEMA|CONSTRAINT)|DELETE\s|TRUNCATE\s|UPDATE\s)/i
  .test(sansCommentaire(s));

const ignorees = instructions.filter(estInterne);
const dangereuses = instructions.filter((s) => !estInterne(s) && estDestructif(s));
const additives = instructions.filter((s) => !estInterne(s) && !estDestructif(s));
const noteInterne = ignorees.length > 0
  ? ' (' + ignorees.length + ' instruction(s) interne(s)/index ignorée(s), sans objet)'
  : '';

const destructif = dangereuses.length > 0;
const fichierDelta = chemin('backend', 'delta-baseline.sql');

if (additives.length === 0 && !destructif) {
  console.log('🆗 Delta vide' + noteInterne + ' : votre base est déjà conforme au schéma attendu.');
} else if (!destructif) {
  const sqlApliquer = additives.join(';\n\n') + ';';
  writeFileSync(fichierDelta, sqlApliquer + '\n');
  console.log('✅ Delta additif détecté (' + additives.length + ' instruction(s)'
    + noteInterne + ') :');
  for (const ligne of sqlApliquer.split('\n').slice(0, 12)) console.log('   ' + ligne);
  if (sqlApliquer.split('\n').length > 12) console.log('   … (total : backend/delta-baseline.sql)');
  console.log('⏳ Application du delta …');
  const appli = await cli(['db', 'execute', '--file', 'delta-baseline.sql']);
  if (!appli.ok) {
    console.error('❌ L\'application du delta a échoué :');
    console.error(filtrer(appli.out).split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
  corriges += 1;
  console.log('✅ Delta appliqué à la base.');
} else {
  writeFileSync(fichierDelta, sql + '\n');
  console.error('❌ Le delta contient des SUPPRESSIONS réelles — RIEN n\'a été modifié.');
  console.error('   Extrait (le tout est dans backend/delta-baseline.sql) :');
  for (const ligne of sql.split('\n').slice(0, 20)) console.error('   ' + ligne);
  console.error('   Coller cet extrait dans le chat : le motif doit être compris avant');
  console.error('   toute application (probable écart entre la base et le dépôt).');
  process.exit(1);
}

/* ── 2bis. Complément : index de migration non modélisés ────────────
 * La migration admin_governance crée deux index que schema.prisma ne peut
 * pas modéliser (index GIN). Ils ne figurent donc jamais dans le delta :
 * on garantit leur présence ici, sans risque de doublon. */
const complement = [
  'CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" '
    + 'ON "audit_logs"("action", "created_at");',
  'CREATE INDEX IF NOT EXISTS "memberships_roles_idx" '
    + 'ON "memberships" USING GIN ("roles");',
].join('\n');
const fichierComplement = chemin('backend', 'complement-indexes.sql');
writeFileSync(fichierComplement, complement + '\n');
const comp = await cli(['db', 'execute', '--file', 'complement-indexes.sql']);
if (!comp.ok) {
  console.error('❌ Le complément d\'index a échoué :');
  console.error(filtrer(comp.out).split('\n').slice(-6).join('\n'));
  process.exit(1);
}
console.log('🆗 Complément : index de migration garantis présents (IF NOT EXISTS).');

/* ── 3. Baseline des 19 migrations ────────────────────────────────── */
const dossierMigrations = chemin('backend', 'prisma', 'migrations');
const noms = readdirSync(dossierMigrations, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
console.log('⏳ Enregistrement de ' + noms.length + ' migration(s) comme appliquées …');
for (const nom of noms) {
  // eslint-disable-next-line no-await-in-loop
  const res = await cli(['migrate', 'resolve', '--applied', nom]);
  const deja = /already/i.test(res.out);
  if (!res.ok && !deja) {
    console.error('❌ Baseline impossible sur ' + nom + ' :');
    console.error(filtrer(res.out).split('\n').slice(-6).join('\n'));
    process.exit(1);
  }
  console.log((deja ? '🆗 ' : '✅ ') + 'baseline : ' + nom);
}
corriges += 1;

/* ── 4. Vérification finale ───────────────────────────────────────── */
console.log('⏳ Vérification finale …');
const final = await cli(['migrate', 'deploy']);
if (!final.ok || !/No pending migrations to apply/i.test(final.out)) {
  console.error('❌ La vérification finale ne dit pas « No pending migrations » :');
  console.error(filtrer(final.out).split('\n').slice(-8).join('\n'));
  process.exit(1);
}
console.log('🆗 Vérification : No pending migrations to apply.');

console.log('');
console.log('✅ Terminé : ' + corriges + ' correction(s), base sous gestion Prisma ('
  + noms.length + ' migrations).');
console.log('   Prochaine étape : rotation des identifiants, puis I3.');
