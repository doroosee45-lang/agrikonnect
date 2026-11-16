/**
 * `PUBLIC_WEB_URL` en production : jamais `localhost`, toujours https, une
 * origine seule. C'est l'adresse de retour des liens de vérification d'e-mail
 * et de mot de passe oublié transmis à Supabase Auth.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { verifierUrlWebPublique } from '../src/config/publicWebUrl.js';

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(import.meta.dirname, '..');

test('URL web publique — hors production, la valeur locale par défaut est acceptée', () => {
  assert.deepEqual(verifierUrlWebPublique({ NODE_ENV: 'development', PUBLIC_WEB_URL: 'http://localhost:5173' }).erreurs, []);
  assert.deepEqual(verifierUrlWebPublique({ NODE_ENV: 'test', PUBLIC_WEB_URL: 'http://localhost:5173' }).erreurs, []);
});

test('URL web publique — en production, une adresse https publique est acceptée', () => {
  for (const url of ['https://agrikonnectweb.onrender.com', 'https://agrikonnectweb.onrender.com/']) {
    assert.deepEqual(verifierUrlWebPublique({ NODE_ENV: 'production', PUBLIC_WEB_URL: url }).erreurs, [], url);
  }
});

test('URL web publique — en production, localhost, http, un chemin ou une valeur vide sont refusés', () => {
  const cas = [
    ['http://localhost:5173', /localhost/],
    ['https://127.0.0.1', /127\.0\.0\.1/],
    ['http://agrikonnectweb.onrender.com', /https/],
    ['https://agrikonnectweb.onrender.com/auth/verify-email', /origine seule/],
    ['', /URL valide/],
  ];
  for (const [url, motif] of cas) {
    const { erreurs } = verifierUrlWebPublique({ NODE_ENV: 'production', PUBLIC_WEB_URL: url });
    assert.ok(erreurs.length > 0, `doit être refusé : « ${url} »`);
    assert.match(erreurs.join(' '), motif, url);
  }
});

test('URL web publique — le démarrage en production s’arrête vraiment sur la valeur par défaut', async () => {
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    DOTENV_CONFIG_PATH: path.join(backendRoot, 'tests', '__aucun_fichier__.env'),
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://essai:essai@127.0.0.1:1/aucune',
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_ANON_KEY: 'valeur-factice-de-test',
  };
  const script = "import('./src/config/env.js').then(() => { console.log('DEMARRE'); process.exit(0); });";
  await assert.rejects(
    execFileAsync('node', ['--input-type=module', '-e', script], { cwd: backendRoot, env }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /PUBLIC_WEB_URL/);
      assert.doesNotMatch(error.stdout, /DEMARRE/);
      return true;
    },
  );
  const { stdout } = await execFileAsync('node', ['--input-type=module', '-e', script], {
    cwd: backendRoot,
    env: { ...env, PUBLIC_WEB_URL: 'https://agrikonnectweb.onrender.com' },
  });
  assert.match(stdout, /DEMARRE/);
});
