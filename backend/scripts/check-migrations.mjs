/**
 * Portail : la chaîne de migrations s'applique-t-elle, et donne-t-elle le schéma attendu ?
 *
 * Applique toute la chaîne de migrations sur une base vierge, puis vérifie
 * que la base obtenue correspond exactement au schéma Prisma (aucun drift).
 *
 * Ce contrôle attrape deux classes d'erreurs qu'aucun test applicatif ne voit :
 * un fichier `migration.sql` invalide ou manquant, et un schéma modifié sans
 * migration correspondante (le client Prisma accepterait alors des colonnes
 * que la base de production n'a pas).
 *
 * Pourquoi ne pas utiliser `prisma migrate deploy` : la commande relit
 * `backend/.env`, dont `DATABASE_URL` l'emporte sur la variable d'environnement
 * passée. On exécute donc le SQL via le pilote `pg`, ce qui teste exactement la
 * même chose — la validité et l'ordre des fichiers de migration.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';

const PORT = 55478;
fs.rmSync('/tmp/agrikon-mig-pg', { recursive: true, force: true });

const pgServer = new EmbeddedPostgres({
  databaseDir: '/tmp/agrikon-mig-pg',
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
});

await pgServer.initialise();
await pgServer.start();

const url = `postgresql://postgres:postgres@localhost:${PORT}/postgres`;
const client = new pg.Client({ connectionString: url });
await client.connect();

const dir = 'prisma/migrations';
const folders = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let applied = 0;
try {
  for (const folder of folders) {
    const file = path.join(dir, folder, 'migration.sql');
    if (!fs.existsSync(file)) throw new Error(`migration.sql absent dans ${folder}`);
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
    applied += 1;
    console.log(`  ✓ ${folder}`);
  }
  console.log(`\n${applied} migration(s) appliquée(s) sans erreur.`);
} finally {
  await client.end();
}

const drift = execFileSync(
  './node_modules/.bin/prisma',
  ['migrate', 'diff', '--from-url', `${url}?schema=public`, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
).trim();

// Prisma écrit « -- This is an empty migration. » quand il n'y a aucun écart.
const isEmpty = drift === '' || /^--\s*This is an empty migration\.?$/.test(drift);

if (isEmpty) {
  console.log('✅ Aucun drift : la base obtenue correspond au schéma Prisma.');
} else {
  console.log(`❌ DRIFT détecté :\n${drift}`);
}

await pgServer.stop();

/*
 * `process.exit()`, et non `process.exitCode = 1`.
 *
 * Le code utilisait `process.exitCode`, et il sortait quand même 0 : quelque chose
 * dans l'arrêt de la base embarquée remet le code à zéro après coup. Résultat, le
 * contrôle affichait « ❌ DRIFT détecté » puis `npm run verify` enchaînait comme
 * si de rien n'était — une dérive de schéma pouvait donc passer inaperçue.
 * `process.exit()` tranche immédiatement et n'est plus modifiable.
 */
process.exit(isEmpty ? 0 : 1);
