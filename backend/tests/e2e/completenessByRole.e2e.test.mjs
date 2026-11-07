import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './support/harness.mjs';

/**
 * Tranche C — complétude PAR RÔLE (PROF-03 / CDC A4).
 *
 * Le contrat : `GET /me` expose une liste de critères **pertinents pour le
 * rôle** de l'utilisateur. Le trio exploitation / parcelle / production
 * n'est demandé qu'aux rôles de production (FARMER, COOPÉRATIVE_ADMIN,
 * COOPÉRATIVE_MEMBER, AGRICULTURAL_COMPANY) ; un acheteur, un investisseur ou
 * un transporteur ne doivent JAMAIS se voir réclamer une exploitation.
 *
 * Deuxième contrat : la complétude est **affichée, jamais bloquante**. Un
 * profil neuf renvoie ses critères manquants sans erreur et sans refus d'accès.
 */

let h;
const PASSWORD = 'MotDePasse!2026';

const registerAndToken = async ({ email, accountType }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType,
      firstName: 'Awa',
      lastName: 'Kabila',
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  const login = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(login.status, 200, `connexion ${email} : ${JSON.stringify(login.body)}`);
  return login.body.data.session.accessToken;
};

const me = async (token) => {
  const response = await h.request('GET', '/me', { token });
  assert.equal(response.status, 200, `GET /me : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

before(async () => {
  h = await startHarness();
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

test('E2E COMPLETE-01 : FARMER → 7 critères dont exploitation, parcelle et production', async () => {
  const token = await registerAndToken({ email: 'complete-farmer@agrikonnect.test', accountType: 'FARMER' });
  const data = await me(token);
  const keys = data.completeness.criteria.map((c) => c.key);
  assert.deepEqual(keys, ['identity', 'phone_verified', 'email_verified', 'avatar', 'farm', 'plot', 'production']);
  assert.equal(data.completeness.total, 7);
  assert.equal(data.completeness.done, data.completeness.criteria.filter((c) => c.done).length);
  assert.equal(data.completeness.missing.includes('farm'), true);
});

test('E2E COMPLETE-02 : BUYER → critères universels seuls, jamais de demande agricole', async () => {
  const token = await registerAndToken({ email: 'complete-buyer@agrikonnect.test', accountType: 'BUYER' });
  const data = await me(token);
  const keys = data.completeness.criteria.map((c) => c.key);
  assert.deepEqual(keys, ['identity', 'phone_verified', 'email_verified', 'avatar']);
  assert.equal(data.completeness.total, 4);
  assert.equal(keys.includes('farm'), false);
  assert.equal(keys.includes('plot'), false);
  assert.equal(keys.includes('production'), false);
});

test('E2E COMPLETE-03 : COOPERATIVE_ADMIN → trio de production conservé', async () => {
  const token = await registerAndToken({ email: 'complete-coop@agrikonnect.test', accountType: 'COOPERATIVE_ADMIN' });
  const data = await me(token);
  const keys = data.completeness.criteria.map((c) => c.key);
  assert.deepEqual(keys, ['identity', 'phone_verified', 'email_verified', 'avatar', 'farm', 'plot', 'production']);
});

test('E2E COMPLETE-04 : INVESTOR → critères universels, complétude non bloquante', async () => {
  const token = await registerAndToken({ email: 'complete-investor@agrikonnect.test', accountType: 'INVESTOR' });
  const data = await me(token);
  const keys = data.completeness.criteria.map((c) => c.key);
  assert.deepEqual(keys, ['identity', 'phone_verified', 'email_verified', 'avatar']);
  // Profil neuf : des critères manquent, la liste est exposée sans erreur.
  assert.ok(Array.isArray(data.completeness.missing));
  assert.ok(data.completeness.missing.includes('avatar'));
  assert.equal(data.completeness.percent, Math.round((data.completeness.done / data.completeness.total) * 100));
});
