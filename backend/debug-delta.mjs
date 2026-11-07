/* Debug : montre le delta brut d'une base fraîchement migrée. */
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';

const execFileAsync = promisify(execFile);
const CLI = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const port = await freePort();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-delta-pg-'));
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

await execFileAsync(process.execPath, [CLI, 'migrate', 'deploy'],
  { cwd: process.cwd(), env, maxBuffer: 32 * 1024 * 1024 });
console.log('── deploy OK — delta base conforme ↔ schema.prisma : ──');
const { stdout, stderr } = await execFileAsync(process.execPath,
  [CLI, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel',
    path.join('prisma', 'schema.prisma'), '--script'],
  { cwd: process.cwd(), env, maxBuffer: 32 * 1024 * 1024 });
console.log('=== STDOUT (' + stdout.length + ' octets) ===');
console.log(stdout.slice(0, 3000));
console.log('=== STDERR ===');
console.log(stderr.slice(0, 800));
await pg.stop();
