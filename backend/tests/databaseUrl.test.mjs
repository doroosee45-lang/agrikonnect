import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierUrlBase } from '../src/config/databaseUrl.js';

const HOTE = 'aws-0-eu-west-1.pooler.supabase.com';

test('pooler Supabase en mode session (5432) : avertissement EMAXCONNSESSION', () => {
  const { avertissements } = verifierUrlBase({ DATABASE_URL: `postgresql://u:p@${HOTE}:5432/postgres?schema=public` });
  assert.ok(avertissements.some((a) => a.includes('mode session')));
  assert.ok(avertissements.some((a) => a.includes('connection_limit')));
});

test('mode transaction complet (6543 + pgbouncer + connection_limit) : aucun avertissement', () => {
  const { avertissements } = verifierUrlBase({
    DATABASE_URL: `postgresql://u:p@${HOTE}:6543/postgres?pgbouncer=true&connection_limit=5&schema=public`,
  });
  assert.deepEqual(avertissements, []);
});

test('mode transaction sans pgbouncer=true : avertissement', () => {
  const { avertissements } = verifierUrlBase({ DATABASE_URL: `postgresql://u:p@${HOTE}:6543/postgres?connection_limit=5` });
  assert.ok(avertissements.some((a) => a.includes('pgbouncer=true')));
});

test('base locale (hors pooler Supabase) : aucun avertissement', () => {
  assert.deepEqual(verifierUrlBase({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/app' }).avertissements, []);
});

test("l'avertissement ne contient jamais l'adresse ni le mot de passe", () => {
  const { avertissements } = verifierUrlBase({ DATABASE_URL: `postgresql://u:SECRETXYZ@${HOTE}:5432/postgres` });
  for (const a of avertissements) {
    assert.equal(a.includes('SECRETXYZ'), false);
    assert.equal(a.includes(HOTE), false);
  }
});
