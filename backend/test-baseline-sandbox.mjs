/* Test sandbox du fixer fix-baseline.mjs — 3 scénarios sur vraie base. */
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';

const execFileAsync = promisify(execFile);
const CLI = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const FIXER = '/home/user/fix-baseline.mjs';

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const waitForPort = async (port, timeoutMs = 30_000) => {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await new Promise((resolve) => {
      const s = new net.Socket();
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => { s.destroy(); resolve(false); });
      s.connect(port, '127.0.0.1');
    });
    if (ok) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('port jamais atteint');
};

const startPG = async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-baseline-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'agrikon',
    password: 'agrikon',
    port,
    persistent: false,
    onLog: () => {},
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
  });
  await pg.initialise();
  await pg.start();
  await waitForPort(port);
  await pg.createDatabase('agrikon');
  const url = `postgresql://agrikon:agrikon@127.0.0.1:${port}/agrikon?schema=public`;
  return {
    url,
    stop: async () => { await pg.stop().catch(() => {}); },
  };
};

const envPour = (url) => ({
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: url,
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
});

const deploy = async (url) => execFileAsync(process.execPath, [CLI, 'migrate', 'deploy'],
  { cwd: process.cwd(), env: envPour(url), maxBuffer: 32 * 1024 * 1024 });

const dbExec = async (url, sql) => {
  const f = path.join(os.tmpdir(), `sql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(f, sql);
  await execFileAsync(process.execPath, [CLI, 'db', 'execute', '--file', f, '--url', url],
    { cwd: process.cwd(), env: envPour(url), maxBuffer: 32 * 1024 * 1024 });
  fs.rmSync(f, { force: true });
};

const runFixer = async (url) => {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [FIXER],
      { cwd: '/home/user', env: envPour(url), maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out: `${stdout}\n${stderr}` };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}\n${e.stderr ?? ''}` };
  }
};

const diffVide = async (url) => {
  const { stdout } = await execFileAsync(process.execPath,
    [CLI, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel',
      path.join('prisma', 'schema.prisma'), '--script'],
    { cwd: process.cwd(), env: envPour(url), maxBuffer: 32 * 1024 * 1024 });
  const utiles = stdout.split(/;\s*\n/)
    .map((s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
    .filter((s) => s !== '')
    .filter((s) => !/_prisma_migrations/.test(s) && !/^DROP\s+INDEX\b/i.test(s));
  return utiles.length === 0;
};

const { PrismaClient } = await import('@prisma/client');
const indexPresents = async (url) => {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const lignes = await p.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
       AND indexname IN ('audit_logs_action_created_at_idx', 'memberships_roles_idx')`,
    );
    return lignes.length === 2;
  } finally {
    await p.$disconnect().catch(() => {});
  }
};

let problemes = 0;
const verifier = (cond, libelle) => {
  if (cond) console.log('   ✅ ' + libelle);
  else { console.log('   ❌ ' + libelle); problemes += 1; }
};

/* ── Scénario A : schéma complet, historique absent ───────────────── */
console.log('══ Scénario A : P3005 + schéma complet (delta vide attendu)');
{
  const pg = await startPG();
  await deploy(pg.url);
  await dbExec(pg.url, 'DROP TABLE IF EXISTS "_prisma_migrations";');
  const r1 = await runFixer(pg.url);
  verifier(r1.code === 0, 'fixer exit 0');
  verifier(/Delta vide/i.test(r1.out), 'delta vide détecté');
  verifier((r1.out.match(/baseline : 20/g) ?? []).length === 19, '19 baselines effectuées');
  verifier(/No pending migrations to apply/i.test(r1.out), 'vérification No pending');
  verifier(/✅ Terminé/.test(r1.out), '✅ Terminé');
  const r2 = await runFixer(pg.url);
  verifier(r2.code === 0 && /déjà sous gestion Prisma/i.test(r2.out), '2ᵉ exécution = 🆗 idempotent');
  verifier(await indexPresents(pg.url), 'les 2 index de migration sont présents');
  await pg.stop();
}

/* ── Scénario B : table admin_governance manquante (delta additif) ── */
console.log('══ Scénario B : settings_revisions + 2 index manquants (delta additif attendu)');
{
  const pg = await startPG();
  await deploy(pg.url);
  await dbExec(pg.url, [
    'DROP TABLE IF EXISTS "_prisma_migrations";',
    'DROP TABLE IF EXISTS "settings_revisions";',
    'DROP INDEX IF EXISTS "audit_logs_action_created_at_idx";',
    'DROP INDEX IF EXISTS "memberships_roles_idx";',
  ].join('\n'));
  const r1 = await runFixer(pg.url);
  verifier(r1.code === 0, 'fixer exit 0');
  verifier(/Delta additif/i.test(r1.out), 'delta additif détecté');
  verifier(/✅ Delta appliqué/.test(r1.out), 'delta appliqué');
  verifier((r1.out.match(/baseline : 20/g) ?? []).length === 19, '19 baselines effectuées');
  verifier(/✅ Terminé/.test(r1.out), '✅ Terminé');
  verifier(await diffVide(pg.url), 're-diff après correction = vide');
  verifier(await indexPresents(pg.url), 'les 2 index de migration sont recréés');
  const r2 = await runFixer(pg.url);
  verifier(r2.code === 0 && /déjà sous gestion Prisma/i.test(r2.out), '2ᵉ exécution = 🆗 idempotent');
  await pg.stop();
}

/* ── Scénario C : table parasite (delta destructif → arrêt) ──────── */
console.log('══ Scénario C : table parasite présente (arrêt pour revue attendu)');
{
  const pg = await startPG();
  await deploy(pg.url);
  await dbExec(pg.url, [
    'DROP TABLE IF EXISTS "_prisma_migrations";',
    'CREATE TABLE "zzz_parasite" ("id" INTEGER);',
  ].join('\n'));
  const r1 = await runFixer(pg.url);
  verifier(r1.code !== 0, 'fixer exit ≠ 0 (arrêt)');
  verifier(/SUPPRESSIONS/i.test(r1.out), 'refus motivé (suppressions)');
  verifier(/delta-baseline\.sql/.test(r1.out), 'delta écrit pour relecture');
  verifier(fs.existsSync('/home/user/backend/delta-baseline.sql'), 'fichier delta présent');
  verifier(/zzz_parasite/.test(fs.readFileSync('/home/user/backend/delta-baseline.sql', 'utf8')),
    'le delta nomme bien la table parasite');
  verifier(/baseline : 20/.test(r1.out) === false, 'aucune baseline effectuée');
  await pg.stop();
}

console.log('');
console.log(problemes === 0 ? '✅ TOUS LES SCÉNARIOS VERTS' : `❌ ${problemes} problème(s)`);
process.exit(problemes === 0 ? 0 : 1);
