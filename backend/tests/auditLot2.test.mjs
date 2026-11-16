import test from 'node:test';
import assert from 'node:assert/strict';

import { can, PLATFORM_ROLES, ASSIGNABLE_ROLES } from '../src/shared/permissions.js';
import { resolveTenant, rolesEffectifs } from '../src/middleware/tenant.js';
import { requireVerified, requireVerifiedForWrites } from '../src/middleware/auth.js';
import { cleIdempotence } from '../src/middleware/idempotency.js';
import { authorize } from '../src/middleware/authorize.js';
import { SELF_SERVICE_ACCOUNT_TYPES, registerSchema } from '../src/modules/auth/auth.schema.js';
import { grantRoleSchema } from '../src/modules/admin/admin.schema.js';
import organizationsRouter from '../src/modules/organizations/organizations.routes.js';

/**
 * Audit backend — Lot 2 : autorisations et isolation
 * (AUDIT_BACKEND/SUIVI_CORRECTIONS_BACKEND.md §4).
 */

const executer = (middleware, req) =>
  new Promise((resolve) => {
    middleware(req, {}, (erreur) => resolve(erreur ?? null));
  });

// ─── H-03 ──────────────────────────────────────────────────────────────────

test('H-03 : un rôle métier d’une AUTRE organisation ne s’applique pas dans l’organisation active', () => {
  const roles = rolesEffectifs(['COOPERATIVE_MEMBER'], ['COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER']);
  assert.deepEqual(roles, ['COOPERATIVE_MEMBER']);
  assert.equal(can(roles, 'cooperatives.members'), can(['COOPERATIVE_MEMBER'], 'cooperatives.members'));
});

test('H-03 : les rôles de plateforme restent valables quelle que soit l’organisation active', () => {
  const roles = rolesEffectifs(['FARMER'], ['FARMER', 'SUPER_ADMIN', 'BUYER']);
  assert.ok(roles.includes('SUPER_ADMIN'));
  assert.ok(!roles.includes('BUYER'), 'BUYER porté ailleurs : non appliqué');
  for (const role of ['ADMIN', 'MODERATOR', 'COUNTRY_ADMIN', 'DATA_STEWARD', 'VERIFIER', 'AGRONOMIST']) {
    assert.ok(PLATFORM_ROLES.includes(role), `${role} est un rôle de plateforme`);
  }
});

test('H-03 : resolveTenant n’hérite pas des droits d’administrateur de A dans B', async () => {
  const orgA = { id: 'org_aaaaaaaaaa', type: 'COOPERATIVE' };
  const orgB = { id: 'org_bbbbbbbbbb', type: 'COOPERATIVE' };
  const req = {
    headers: { 'x-organization-id': orgB.id },
    user: {
      id: 'user_1',
      roles: ['COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER'],
      memberships: [
        { organizationId: orgA.id, organization: orgA, roles: ['COOPERATIVE_ADMIN'] },
        { organizationId: orgB.id, organization: orgB, roles: ['COOPERATIVE_MEMBER'] },
      ],
    },
  };
  assert.equal(await executer(resolveTenant, req), null);
  assert.deepEqual(req.tenant.effectiveRoles, ['COOPERATIVE_MEMBER']);
  const refus = await executer(authorize('cooperatives.members'), req);
  if (!can(['COOPERATIVE_MEMBER'], 'cooperatives.members')) {
    assert.equal(refus?.status, 403, 'administration des membres de B refusée');
  }
});

// ─── H-01 ──────────────────────────────────────────────────────────────────

test('H-01 : agronome et agent d’appui ne s’obtiennent plus par inscription libre', () => {
  assert.ok(!SELF_SERVICE_ACCOUNT_TYPES.includes('AGRONOMIST'));
  assert.ok(!SELF_SERVICE_ACCOUNT_TYPES.includes('SUPPORT_AGENT'));
  const accountType = registerSchema.shape?.accountType ?? registerSchema._def?.schema?.shape?.accountType;
  if (accountType) {
    assert.equal(accountType.safeParse('AGRONOMIST').success, false);
    assert.equal(accountType.safeParse('SUPPORT_AGENT').success, false);
    assert.equal(accountType.safeParse('FARMER').success, true);
  }
});

test('H-01 : un Super Admin peut attribuer agronome et agent d’appui depuis l’administration', () => {
  assert.ok(ASSIGNABLE_ROLES.includes('AGRONOMIST'));
  assert.ok(ASSIGNABLE_ROLES.includes('SUPPORT_AGENT'));
  const ok = grantRoleSchema.safeParse({ role: 'AGRONOMIST', mfaCode: '123456', reason: 'diplôme vérifié' });
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues));
  const ko = grantRoleSchema.safeParse({ role: 'BUYER', mfaCode: '123456', reason: 'essai' });
  assert.equal(ko.success, false, 'un rôle commercial ne s’attribue pas par ce canal');
});

// ─── H-02 ──────────────────────────────────────────────────────────────────

test('H-02 : créer une organisation est réservé aux producteurs (jamais acheteur/investisseur)', () => {
  for (const role of ['BUYER', 'INVESTOR', 'TRANSPORTER', 'SUPPLIER', 'COOPERATIVE_MEMBER']) {
    assert.equal(can([role], 'organizations.create'), false, `${role} ne crée pas d’organisation`);
  }
  assert.equal(can(['FARMER'], 'organizations.create'), true);
  assert.equal(can(['COOPERATIVE_MEMBER'], 'organizations.write'), false, 'un simple membre ne renomme pas l’organisation');
  assert.equal(can(['COOPERATIVE_ADMIN'], 'organizations.write'), true);
});

test('H-02 / H-07 : POST et PATCH /organizations portent permission et compte vérifié', () => {
  for (const methode of ['post', 'patch']) {
    const couche = organizationsRouter.stack.find((l) => l.route?.methods[methode]);
    const fonctions = couche.route.stack.map((s) => s.handle);
    assert.ok(fonctions.includes(requireVerified), `${methode} : requireVerified absent`);
    assert.ok(couche.route.stack.length >= 4, `${methode} : authorize attendu`);
  }
});

// ─── H-07 ──────────────────────────────────────────────────────────────────

test('H-07 : lecture libre, écriture refusée tant que le compte n’est pas vérifié', async () => {
  assert.equal(await executer(requireVerifiedForWrites, { method: 'GET', headers: {} }), null, 'GET sans session : passe');

  const nonVerifie = { method: 'POST', headers: {}, user: { id: 'u1', emailConfirmed: false, phoneVerified: false } };
  const refus = await executer(requireVerifiedForWrites, nonVerifie);
  assert.equal(refus?.status, 403);
  assert.equal(refus?.details?.accountNotVerified, true);

  const verifie = { method: 'PATCH', headers: {}, user: { id: 'u2', emailConfirmed: true } };
  assert.equal(await executer(requireVerifiedForWrites, verifie), null);
  const parTelephone = { method: 'DELETE', headers: {}, user: { id: 'u3', phoneVerified: true } };
  assert.equal(await executer(requireVerifiedForWrites, parTelephone), null);
});

test('H-07 : écriture sans session → 401 (pas de contournement par absence de jeton)', async () => {
  const erreur = await executer(requireVerifiedForWrites, { method: 'POST', headers: {} });
  assert.equal(erreur?.status, 401);
});

// ─── M-01 ──────────────────────────────────────────────────────────────────

test('M-01 : la même clé d’idempotence de deux utilisateurs ne se confond jamais', () => {
  assert.notEqual(cleIdempotence('user_a', 'cle-1234'), cleIdempotence('user_b', 'cle-1234'));
  assert.equal(cleIdempotence('user_a', 'cle-1234'), cleIdempotence('user_a', 'cle-1234'));
  assert.notEqual(cleIdempotence(null, 'cle-1234'), cleIdempotence('user_a', 'cle-1234'));
});
