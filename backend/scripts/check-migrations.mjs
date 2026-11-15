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
fs.rmSync('/tmp/agrikon-mig-pg', { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });

const pgServer = new EmbeddedPostgres({
  databaseDir: '/tmp/agrikon-mig-pg',
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--no-locale'],
});

await pgServer.initialise();
await pgServer.start();

const url = `postgresql://postgres:postgres@localhost:${PORT}/postgres`;
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`
DO $ensure_roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon'
  ) THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'
  ) THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
END;
$ensure_roles$;
`);

const dir = 'prisma/migrations';
const folders = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let applied = 0;
let rlsOk = false;
try {
  for (const folder of folders) {
    const file = path.join(dir, folder, 'migration.sql');
    if (!fs.existsSync(file)) throw new Error(`migration.sql absent dans ${folder}`);
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
    applied += 1;
    console.log(`  ✓ ${folder}`);
  }
  const rlsTables = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `);
  const rlsMissing = rlsTables.rows
    .filter((table) => table.rls_enabled !== true)
    .map((table) => table.table_name);

  rlsOk = rlsTables.rows.length > 0 && rlsMissing.length === 0;
  if (rlsOk) {
    console.log(`  ✓ RLS_CHECK_RESULT : ${rlsTables.rows.length} table(s) protégée(s).`);
  } else {
    console.error(
      `  ❌ RLS_CHECK_RESULT : RLS absente sur ${rlsMissing.join(', ') || 'aucune table public trouvée'}.`,
    );
  }
  console.log(`\n${applied} migration(s) appliquée(s) sans erreur.`);
} finally {
  await client.end();
}

const drift = execFileSync(
  process.execPath,
  [
    path.resolve('node_modules/prisma/build/index.js'),
    'migrate',
    'diff',
    '--from-url',
    `${url}?schema=public`,
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
).trim();

// Prisma écrit « -- This is an empty migration. » quand il n'y a aucun écart.
const isEmpty = drift === '' || /^--\s*This is an empty migration\.?$/.test(drift);

if (isEmpty) {
  console.log('✅ Aucun drift : la base obtenue correspond au schéma Prisma.');
} else {
  console.log(`❌ DRIFT détecté :\n${drift}`);
}

if (process.platform === 'win32') {
  const pgCtl = path.resolve(
    'node_modules',
    '@embedded-postgres',
    'windows-x64',
    'native',
    'bin',
    'pg_ctl.exe',
  );
  execFileSync(
    pgCtl,
    ['-D', path.resolve('/tmp/agrikon-mig-pg'), '-m', 'fast', '-w', '-t', '90', 'stop'],
    { timeout: 120_000, stdio: 'inherit' },
  );
  fs.rmSync('/tmp/agrikon-mig-pg', { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
} else {
  await pgServer.stop();
}

/*
 * `process.exit()`, et non `process.exitCode = 1`.
 *
 * Le code utilisait `process.exitCode`, et il sortait quand même 0 : quelque chose
 * dans l'arrêt de la base embarquée remet le code à zéro après coup. Résultat, le
 * contrôle affichait « ❌ DRIFT détecté » puis `npm run verify` enchaînait comme
 * si de rien n'était — une dérive de schéma pouvait donc passer inaperçue.
 * `process.exit()` tranche immédiatement et n'est plus modifiable.
 */
process.exit(isEmpty && rlsOk ? 0 : 1);
