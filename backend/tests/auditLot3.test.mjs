import test from 'node:test';
import assert from 'node:assert/strict';

import { emettrePreuveMfa, verifierPreuveMfa, sessionIdDuJeton, DUREE_PREUVE_S } from '../src/modules/auth/mfaProof.js';
import { requireMfa, requireSuperAdmin } from '../src/middleware/authorize.js';
import { authLimiter } from '../src/middleware/rateLimit.js';
import { changePasswordSchema } from '../src/modules/users/users.schema.js';
import authRouter from '../src/modules/auth/auth.routes.js';
import { jetonDeSession } from './helpers/investisseurPret.mjs';

/**
 * Audit backend — Lot 3 : authentification forte
 * (AUDIT_BACKEND/SUIVI_CORRECTIONS_BACKEND.md §4).
 */

const executer = (middleware, req) =>
  new Promise((resolve) => {
    middleware(req, {}, (erreur) => resolve(erreur ?? null));
  });

// ─── C-03 : preuve de second facteur liée à la session ─────────────────────

test('C-03 : la preuve est valable pour SON utilisateur et SA session uniquement', () => {
  const preuve = emettrePreuveMfa({ userId: 'u1', sessionId: 's1' });
  assert.equal(verifierPreuveMfa({ preuve, userId: 'u1', sessionId: 's1' }), true);
  assert.equal(verifierPreuveMfa({ preuve, userId: 'u1', sessionId: 's2' }), false, 'autre session (connexion directe à Supabase)');
  assert.equal(verifierPreuveMfa({ preuve, userId: 'u2', sessionId: 's1' }), false, 'autre utilisateur');
});

test('C-03 : une preuve expirée, falsifiée ou absente est refusée', () => {
  const ancienne = emettrePreuveMfa({ userId: 'u1', sessionId: 's1', maintenant: Date.now() - (DUREE_PREUVE_S + 60) * 1000 });
  assert.equal(verifierPreuveMfa({ preuve: ancienne, userId: 'u1', sessionId: 's1' }), false, 'expirée');

  const preuve = emettrePreuveMfa({ userId: 'u1', sessionId: 's1' });
  const [contenu, signature] = preuve.split('.');
  const contenuForge = Buffer.from('u1|s1|9999999999').toString('base64url');
  assert.equal(verifierPreuveMfa({ preuve: `${contenuForge}.${signature}`, userId: 'u1', sessionId: 's1' }), false, 'échéance falsifiée');
  assert.equal(verifierPreuveMfa({ preuve: `${contenu}.AAAA`, userId: 'u1', sessionId: 's1' }), false, 'signature falsifiée');
  assert.equal(verifierPreuveMfa({ preuve: '', userId: 'u1', sessionId: 's1' }), false);
  assert.equal(emettrePreuveMfa({ userId: 'u1', sessionId: null }), null, 'pas de preuve sans session identifiée');
});

test('C-03 : le session_id est lu dans le JWT d’accès', () => {
  assert.equal(sessionIdDuJeton(jetonDeSession('u1', 'abc-123')), 'abc-123');
  assert.equal(sessionIdDuJeton('pas-un-jwt'), null);
});

test('C-03 : requireMfa refuse une session sans preuve, même si la MFA est activée sur le compte', async () => {
  const base = { user: { id: 'u1', profile: { mfaEnabled: true } }, token: jetonDeSession('u1', 's1'), headers: {} };

  const sansPreuve = await executer(requireMfa, base);
  assert.equal(sansPreuve?.status, 403);
  assert.equal(sansPreuve?.details?.stepUp, true, 'le client doit redemander un code');

  const autreSession = await executer(requireMfa, {
    ...base,
    headers: { 'x-mfa-proof': emettrePreuveMfa({ userId: 'u1', sessionId: 'session-legitime' }) },
  });
  assert.equal(autreSession?.status, 403, 'la preuve d’une autre session ne vaut pas ici');

  const valide = await executer(requireMfa, {
    ...base,
    headers: { 'x-mfa-proof': emettrePreuveMfa({ userId: 'u1', sessionId: 's1' }) },
  });
  assert.equal(valide, null);
});

test('C-03 : requireSuperAdmin cumule rôle, MFA activée ET session à second facteur', async () => {
  const req = {
    tenant: { effectiveRoles: ['SUPER_ADMIN'] },
    user: { id: 'sa', roles: ['SUPER_ADMIN'], profile: { mfaEnabled: true } },
    token: jetonDeSession('sa', 's9'),
    headers: {},
  };
  assert.equal((await executer(requireSuperAdmin, req))?.details?.stepUp, true);
  req.headers['x-mfa-proof'] = emettrePreuveMfa({ userId: 'sa', sessionId: 's9' });
  assert.equal(await executer(requireSuperAdmin, req), null);
});

// ─── H-04 ──────────────────────────────────────────────────────────────────

test('H-04 : changer de mot de passe exige le mot de passe actuel, différent du nouveau', () => {
  assert.equal(changePasswordSchema.safeParse({ newPassword: 'Nouveau!2026' }).success, false, 'mot de passe actuel requis');
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: 'Meme!2026xx', newPassword: 'Meme!2026xx' }).success,
    false,
    'identique refusé',
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: 'Ancien!2026', newPassword: 'Nouveau!2026', mfaCode: '123456' }).success,
    true,
  );
});

// ─── M-02 ──────────────────────────────────────────────────────────────────

test('M-02 : les routes qui vérifient un code portent le limiteur strict', () => {
  for (const [methode, chemin] of [
    ['post', '/mfa/verify'], ['post', '/mfa/disable'], ['post', '/mfa/confirm'],
    ['post', '/verify-phone'], ['post', '/send-otp'],
  ]) {
    const couche = authRouter.stack.find((l) => l.route?.path === chemin && l.route.methods[methode]);
    assert.ok(couche, `${chemin} introuvable`);
    assert.ok(couche.route.stack.some((s) => s.handle === authLimiter), `${chemin} : authLimiter absent`);
  }
});
