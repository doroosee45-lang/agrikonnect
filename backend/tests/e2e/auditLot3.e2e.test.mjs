/**
 * Audit backend — Lot 3, de bout en bout (PostgreSQL réel + GoTrue simulé).
 *
 * C-03 : un jeton obtenu DIRECTEMENT auprès de Supabase Auth (sans passer par
 *        l'API, donc sans second facteur) n'ouvre plus les routes de
 *        gouvernance, même sur un compte Super Admin dont la MFA est activée.
 * H-04 : changer de mot de passe exige l'actuel et ferme les autres sessions.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

const PASSWORD = 'Agrikonnect!2026';
const SUPER = 'super-lot3@agrikonnect.test';
const MEMBRE = 'membre-lot3@agrikonnect.test';

let h;
let currentCode;

const inscrire = async (email) => {
  const reponse = await h.request('POST', '/auth/register', {
    body: { accountType: 'FARMER', firstName: 'Lot', lastName: 'Trois', email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  return reponse.body.data.user.id;
};

const connecter = async (email, extra = {}) => {
  const reponse = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD, ...extra } });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  return reponse.body.data.session;
};

/** Ce que ferait un attaquant : se connecter à Supabase sans passer par l'API. */
const jetonDirectSupabase = async (email, motDePasse = PASSWORD) => {
  const reponse = await fetch(`${h.urls.gotrue}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: 'anon-key-e2e' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  assert.equal(reponse.status, 200, 'connexion directe au fournisseur d’identité');
  return (await reponse.json()).access_token;
};

before(async () => {
  h = await startHarness();
  ({ currentCode } = await import('../../src/modules/auth/mfa.service.js'));

  // Super Admin avec MFA activée (enrôlement réel par l'API).
  const superId = await inscrire(SUPER);
  await h.prisma.membership.updateMany({ where: { userId: superId }, data: { roles: ['SUPER_ADMIN'] } });
  const session = await connecter(SUPER);
  const setup = await h.request('POST', '/auth/mfa/setup', { token: session.accessToken, body: {} });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  h.secretSuper = setup.body.data.secret;
  const confirme = await h.request('POST', '/auth/mfa/confirm', {
    token: session.accessToken,
    body: { code: currentCode(h.secretSuper) },
  });
  assert.equal(confirme.status, 200, JSON.stringify(confirme.body));

  await inscrire(MEMBRE);
});

after(async () => {
  await h.stop();
});

test('C-03 : connexion par l’API avec code → preuve de session → route de gouvernance ouverte', async () => {
  const session = await connecter(SUPER, { mfaCode: currentCode(h.secretSuper) });
  assert.ok(session.mfaProof, 'la connexion à second facteur délivre une preuve');
  const flags = await h.request('GET', '/admin/flags', { token: session.accessToken });
  assert.equal(flags.status, 200, JSON.stringify(flags.body));
});

test('C-03 : jeton obtenu directement auprès de Supabase → refusé, même pour un Super Admin à MFA activée', async () => {
  const jeton = await jetonDirectSupabase(SUPER);
  const refus = await h.request('GET', '/admin/flags', { token: jeton });
  assert.equal(refus.status, 403, JSON.stringify(refus.body));
  assert.equal(refus.body.details?.mfaRequired, true);
  assert.equal(refus.body.details?.stepUp, true);

  // La preuve d'une AUTRE session ne s'applique pas à ce jeton.
  const autre = await connecter(SUPER, { mfaCode: currentCode(h.secretSuper) });
  const emprunt = await h.request('GET', '/admin/flags', { token: jeton, headers: { 'x-mfa-proof': autre.mfaProof } });
  assert.equal(emprunt.status, 403, 'une preuve ne se transfère pas d’une session à l’autre');
});

test('C-03 : la session peut franchir le second facteur après coup (step-up)', async () => {
  const jeton = await jetonDirectSupabase(SUPER);
  const verification = await h.request('POST', '/auth/mfa/verify', {
    token: jeton,
    body: { code: currentCode(h.secretSuper) },
  });
  assert.equal(verification.status, 200, JSON.stringify(verification.body));
  assert.ok(verification.body.data.mfaProof);
  const flags = await h.request('GET', '/admin/flags', { token: jeton });
  assert.equal(flags.status, 200, JSON.stringify(flags.body));
});

test('H-04 : mot de passe actuel faux → 422, la session reste valide', async () => {
  const session = await connecter(MEMBRE);
  const refus = await h.request('POST', '/me/password', {
    token: session.accessToken,
    body: { currentPassword: 'Mauvais!2026', newPassword: 'NouveauSecret!2026' },
  });
  assert.equal(refus.status, 422, JSON.stringify(refus.body));
  const me = await h.request('GET', '/me', { token: session.accessToken });
  assert.equal(me.status, 200, 'la session courante n’est pas détruite par une erreur de saisie');
});

test('H-04 : changement réussi → autres sessions fermées, session courante conservée', async () => {
  const courante = await connecter(MEMBRE);
  const volee = await connecter(MEMBRE);

  const change = await h.request('POST', '/me/password', {
    token: courante.accessToken,
    body: { currentPassword: PASSWORD, newPassword: 'NouveauSecret!2026' },
  });
  assert.equal(change.status, 200, JSON.stringify(change.body));
  assert.equal(change.body.data.otherSessionsRevoked, true);

  assert.equal((await h.request('GET', '/me', { token: courante.accessToken })).status, 200, 'session courante conservée');
  assert.equal((await h.request('GET', '/me', { token: volee.accessToken })).status, 401, 'autre session fermée');

  const ancienRefuse = await h.request('POST', '/auth/login', { body: { identifier: MEMBRE, password: PASSWORD } });
  assert.equal(ancienRefuse.status, 401, 'l’ancien mot de passe ne fonctionne plus');
});
