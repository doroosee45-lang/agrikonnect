/* Test sandbox de fix-schema-doublon.mjs — 4 scénarios. */
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';

const execFileAsync = promisify(execFile);
const CLI = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const FIXER = '/home/user/fix-schema-doublon.mjs';
const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const CANON = '315d52597bd8f044b58135efd1dfc69a';

const md5 = () => createHash('md5').update(fs.readFileSync(SCHEMA)).digest('hex');
const propre = fs.readFileSync(SCHEMA, 'utf8');

/* Extraction du bloc SettingRevision (avec son commentaire de tête). */
const lignes = propre.split('\n');
const iMod = lignes.findIndex((l) => l.startsWith('model SettingRevision {'));
let iDebut = iMod;
while (iDebut > 0 && (lignes[iDebut - 1].startsWith('///') || lignes[iDebut - 1].trim() === '')) iDebut -= 1;
let iFin = iMod;
while (lignes[iFin] !== '}') iFin += 1;
const bloc = lignes.slice(iDebut, iFin + 1);

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const port = await freePort();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-doublon-pg-'));
const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'agrikon', password: 'agrikon', port,
  persistent: false, onLog: () => {}, initdbFlags: ['--encoding=UTF8', '--no-locale'],
});
await pg.initialise();
await pg.start();
await new Promise((r) => setTimeout(r, 1500));
await pg.createDatabase('agrikon');
const url = `postgresql://agrikon:agrikon@127.0.0.1:${port}/agrikon?schema=public`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' };

/* Base en état P3005 : schéma complet, historique absent. */
await execFileAsync(process.execPath, [CLI, 'migrate', 'deploy'],
  { cwd: process.cwd(), env, maxBuffer: 32 * 1024 * 1024 });
const dropSql = path.join(os.tmpdir(), 'drop-mig.sql');
fs.writeFileSync(dropSql, 'DROP TABLE IF EXISTS "_prisma_migrations";');
await execFileAsync(process.execPath, [CLI, 'db', 'execute', '--file', dropSql, '--url', url],
  { cwd: process.cwd(), env, maxBuffer: 32 * 1024 * 1024 });

const runFixer = async () => {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [FIXER],
      { cwd: '/home/user', env, maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out: `${stdout}\n${stderr}` };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}\n${e.stderr ?? ''}` };
  }
};

let problemes = 0;
const verifier = (cond, libelle) => {
  if (cond) console.log('   ✅ ' + libelle);
  else { console.log('   ❌ ' + libelle); problemes += 1; }
};

/* ═ Scénario 1 : copie EXACTE du bloc → réparation + chaîne baseline ═ */
console.log('══ Scénario 1 : bloc dupliqué à l\'identique');
{
  fs.writeFileSync(SCHEMA, `${propre}\n${bloc.join('\n')}\n`);
  verifier(md5() !== CANON, 'fichier corrompu (empreinte différente)');
  const r = await runFixer();
  verifier(/ligne\(s\) de doublon retirée\(s\)/.test(r.out), 'doublon retiré');
  verifier(/identique à la référence canonique/.test(r.out), 'empreinte canonique retrouvée');
  verifier(/Client Prisma régénéré/.test(r.out), 'client régénéré');
  verifier(/base sous gestion Prisma/.test(r.out), 'chaîne baseline terminée');
  verifier(/No pending migrations to apply/.test(r.out), 'baseline : No pending');
  verifier(r.code === 0, 'exit 0');
  verifier(md5() === CANON, 'fichier réparé == référence');
}

/* ═ Scénario 2 : copie au COMMENTAIRE différent → réparation quand même ═ */
console.log('══ Scénario 2 : doublon aux commentaires différents');
{
  const blocVarie = bloc.map((l) => l.replace('elle-même auditée.', 'elle-même auditée (purge).'));
  fs.writeFileSync(SCHEMA, `${propre}\n${blocVarie.join('\n')}\n`);
  const r = await runFixer();
  verifier(/ligne\(s\) de doublon retirée\(s\)/.test(r.out), 'doublon retiré malgré le commentaire');
  verifier(md5() === CANON, 'fichier réparé == référence');
  verifier(r.code === 0, 'exit 0');
}

/* ═ Scénario 3 : copie au CORPS différent → refus, rien touché ═ */
console.log('══ Scénario 3 : doublon au corps différent (refus attendu)');
{
  const blocModifie = bloc.filter((l) => !l.trim().startsWith('key'));
  fs.writeFileSync(SCHEMA, `${propre}\n${blocModifie.join('\n')}\n`);
  const avant = md5();
  const r = await runFixer();
  verifier(r.code !== 0, 'exit ≠ 0 (refus)');
  verifier(/DIFFÈRENT/.test(r.out), 'refus motivé (copies différentes)');
  verifier(md5() === avant, 'fichier laissé intact');
  verifier(/Première copie/.test(r.out) && /Autre copie/.test(r.out), 'les deux copies sont affichées');
  fs.writeFileSync(SCHEMA, propre);
}

/* ═ Scénario 4 : fichier sain → 🆗 + chaîne ═ */
console.log('══ Scénario 4 : fichier sain (idempotence)');
{
  const r = await runFixer();
  verifier(/aucun bloc dupliqué/.test(r.out), 'aucun doublon signalé');
  verifier(/identique à la référence canonique/.test(r.out), 'empreinte canonique');
  verifier(/base sous gestion Prisma/.test(r.out), 'chaîne baseline 🆗');
  verifier(r.code === 0, 'exit 0');
}

/* ═ Scénario 5 : commentaire à accolade NON équilibrée + doublon ════ */
console.log('══ Scénario 5 : accolade parasite dans un commentaire + doublon');
{
  fs.writeFileSync(SCHEMA, `${propre}\n/// exemple de format {x non fermé\n${bloc.join('\n')}\n`);
  const r = await runFixer();
  verifier(/occurrences/.test(r.out), 'doublon trouvé malgré l\'accolade parasite');
  verifier(/ligne\(s\) de doublon retirée\(s\)/.test(r.out), 'doublon retiré');
  verifier(md5() === CANON, 'fichier réparé == référence');
  verifier(r.code === 0, 'exit 0');
}

await pg.stop();
console.log('');
console.log(problemes === 0 ? '✅ TOUS LES SCÉNARIOS VERTS' : `❌ ${problemes} problème(s)`);
process.exit(problemes === 0 ? 0 : 1);
