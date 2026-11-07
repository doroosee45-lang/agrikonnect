/**
 * SPEC-SUPER-ADMIN §2.3 / §8 — gardes de gouvernance (palier 2).
 *
 * Ce que garantit ce test :
 *   1. `requireMfa` refuse toute mutation de gouvernance sur un profil sans
 *      second facteur actif (NFR-01 / RG-S1), avec le contrat
 *      `details.mfaRequired` attendu par les clients web et mobile ;
 *   2. `requireSuperAdmin` cumule les deux contrôles (RG-G1) : rôle
 *      `SUPER_ADMIN` **et** MFA — un `ADMIN` passe les routes palier 1 mais
 *      jamais les routes palier 2 (séparation stricte des privilèges) ;
 *   3. les permissions `admin.*` de gouvernance n'appartiennent qu'au
 *      `SUPER_ADMIN` (y compris contre `ADMIN`), conformément à la matrice ;
 *   4. `GOVERNANCE_ROLES` n'expose que les rôles attribués par nomination.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { requireMfa, requireSuperAdmin } from '../src/middleware/authorize.js';
import { can, PERMISSIONS, GOVERNANCE_ROLES } from '../src/shared/permissions.js';

/** Exécute un middleware et résout l'erreur éventuelle passée à `next`. */
const executer = (middleware, req) =>
  new Promise((resolve) => {
    middleware(req, {}, (erreur) => resolve(erreur ?? null));
  });

const profilAvecMfa = (roles, mfaEnabled = true) => ({
  user: { id: 'u1', roles, profile: { id: 'u1', mfaEnabled } },
});

// ─── requireMfa (NFR-01 / RG-S1) ────────────────────────────────────────────

test('requireMfa : passe quand le second facteur est actif', async () => {
  const erreur = await executer(requireMfa, profilAvecMfa(['SUPER_ADMIN'], true));
  assert.equal(erreur, null);
});

test('requireMfa : refuse sans MFA active (403 + details.mfaRequired)', async () => {
  for (const requete of [
    profilAvecMfa(['SUPER_ADMIN'], false),
    { user: { id: 'u1', roles: ['SUPER_ADMIN'], profile: null } },
    {},
  ]) {
    const erreur = await executer(requireMfa, requete);
    assert.ok(erreur, 'une erreur doit être transmise à next');
    assert.equal(erreur.status, 403);
    assert.equal(erreur.details?.mfaRequired, true);
    assert.equal(erreur.details?.method, 'totp');
  }
});

// ─── requireSuperAdmin (RG-G1 : rôle ET MFA) ────────────────────────────────

test('requireSuperAdmin : passe pour SUPER_ADMIN avec MFA', async () => {
  const erreur = await executer(requireSuperAdmin, profilAvecMfa(['FARMER', 'SUPER_ADMIN'], true));
  assert.equal(erreur, null);
});

test('requireSuperAdmin : refuse un ADMIN même avec MFA (séparation stricte)', async () => {
  const erreur = await executer(requireSuperAdmin, profilAvecMfa(['ADMIN'], true));
  assert.ok(erreur);
  assert.equal(erreur.status, 403);
  assert.match(erreur.message, /Super Administrateur/);
});

test('requireSuperAdmin : refuse SUPER_ADMIN sans MFA', async () => {
  const erreur = await executer(requireSuperAdmin, profilAvecMfa(['SUPER_ADMIN'], false));
  assert.ok(erreur);
  assert.equal(erreur.status, 403);
  assert.equal(erreur.details?.mfaRequired, true);
});

test('requireSuperAdmin : refuse sans session (req.user absent)', async () => {
  const erreur = await executer(requireSuperAdmin, {});
  assert.ok(erreur);
  assert.equal(erreur.status, 403);
});

test('requireSuperAdmin : lit aussi les rôles du tenant', async () => {
  const requete = {
    tenant: { effectiveRoles: ['SUPER_ADMIN'] },
    user: { id: 'u1', roles: [], profile: { id: 'u1', mfaEnabled: true } },
  };
  const erreur = await executer(requireSuperAdmin, requete);
  assert.equal(erreur, null);
});

// ─── Permissions palier 2 (matrice §2.2) ────────────────────────────────────

test('permissions admin.roles/.security/.flags/.maintenance = SUPER_ADMIN seul', () => {
  for (const permission of ['admin.roles', 'admin.security', 'admin.flags', 'admin.maintenance']) {
    assert.deepEqual(PERMISSIONS[permission], ['SUPER_ADMIN'], `${permission} doit être exclusive`);
    assert.equal(can(['ADMIN'], permission), false, `${permission} : ADMIN ne doit pas passer`);
    assert.equal(can(['MODERATOR', 'DATA_STEWARD'], permission), false);
    assert.equal(can(['SUPER_ADMIN'], permission), true);
  }
});

test('GOVERNANCE_ROLES : rôles de nomination, jamais auto-attribués', () => {
  for (const role of GOVERNANCE_ROLES) {
    assert.match(role, /^[A-Z_]+$/, `${role} : format d\'un rôle`);
    assert.ok(!['FARMER', 'BUYER', 'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR',
      'SUPPORT_AGENT', 'AGRICULTURAL_COMPANY', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER']
      .includes(role), `${role} : un rôle libre-service ne peut pas être un rôle de gouvernance`);
  }
  assert.ok(GOVERNANCE_ROLES.includes('SUPER_ADMIN'));
  assert.ok(GOVERNANCE_ROLES.includes('ADMIN'));
});


















// /**
//  * SPEC-SUPER-ADMIN §2.3 / §8 — gardes de gouvernance (palier 2).
//  *
//  * Ce que garantit ce test :
//  *   1. `requireMfa` refuse toute mutation de gouvernance sur un profil sans
//  *      second facteur actif (NFR-01 / RG-S1), avec le contrat
//  *      `details.mfaRequired` attendu par les clients web et mobile ;
//  *   2. `requireSuperAdmin` cumule les deux contrôles (RG-G1) : rôle
//  *      `SUPER_ADMIN` **et** MFA — un `ADMIN` passe les routes palier 1 mais
//  *      jamais les routes palier 2 (séparation stricte des privilèges) ;
//  *   3. les permissions `admin.*` de gouvernance n'appartiennent qu'au
//  *      `SUPER_ADMIN` (y compris contre `ADMIN`), conformément à la matrice ;
//  *   4. `GOVERNANCE_ROLES` n'expose que les rôles attribués par nomination.
//  */
// import test from 'node:test';
// import assert from 'node:assert/strict';

// import { requireMfa, requireSuperAdmin } from '../src/middleware/authorize.js';
// import { can, PERMISSIONS, GOVERNANCE_ROLES } from '../src/shared/permissions.js';

// /** Exécute un middleware et résout l'erreur éventuelle passée à `next`. */
// const executer = (middleware, req) =>
//   new Promise((resolve) => {
//     middleware(req, {}, (erreur) => resolve(erreur ?? null));
//   });

// const profilAvecMfa = (roles, mfaEnabled = true) => ({
//   user: { id: 'u1', roles, profile: { id: 'u1', mfaEnabled } },
// });

// // ─── requireMfa (NFR-01 / RG-S1) ────────────────────────────────────────────

// test('requireMfa : passe quand le second facteur est actif', async () => {
//   const erreur = await executer(requireMfa, profilAvecMfa(['SUPER_ADMIN'], true));
//   assert.equal(erreur, null);
// });

// test('requireMfa : refuse sans MFA active (403 + details.mfaRequired)', async () => {
//   for (const requete of [
//     profilAvecMfa(['SUPER_ADMIN'], false),
//     { user: { id: 'u1', roles: ['SUPER_ADMIN'], profile: null } },
//     {},
//   ]) {
//     const erreur = await executer(requireMfa, requete);
//     assert.ok(erreur, 'une erreur doit être transmise à next');
//     assert.equal(erreur.status, 403);
//     assert.equal(erreur.details?.mfaRequired, true);
//     assert.equal(erreur.details?.method, 'totp');
//   }
// });

// // ─── requireSuperAdmin (RG-G1 : rôle ET MFA) ────────────────────────────────

// test('requireSuperAdmin : passe pour SUPER_ADMIN avec MFA', async () => {
//   const erreur = await executer(requireSuperAdmin, profilAvecMfa(['FARMER', 'SUPER_ADMIN'], true));
//   assert.equal(erreur, null);
// });

// test('requireSuperAdmin : refuse un ADMIN même avec MFA (séparation stricte)', async () => {
//   const erreur = await executer(requireSuperAdmin, profilAvecMfa(['ADMIN'], true));
//   assert.ok(erreur);
//   assert.equal(erreur.status, 403);
//   assert.match(erreur.message, /Super Administrateur/);
// });

// test('requireSuperAdmin : refuse SUPER_ADMIN sans MFA', async () => {
//   const erreur = await executer(requireSuperAdmin, profilAvecMfa(['SUPER_ADMIN'], false));
//   assert.ok(erreur);
//   assert.equal(erreur.status, 403);
//   assert.equal(erreur.details?.mfaRequired, true);
// });

// test('requireSuperAdmin : refuse sans session (req.user absent)', async () => {
//   const erreur = await executer(requireSuperAdmin, {});
//   assert.ok(erreur);
//   assert.equal(erreur.status, 403);
// });

// test('requireSuperAdmin : lit aussi les rôles du tenant', async () => {
//   const requete = {
//     tenant: { effectiveRoles: ['SUPER_ADMIN'] },
//     user: { id: 'u1', roles: [], profile: { id: 'u1', mfaEnabled: true } },
//   };
//   const erreur = await executer(requireSuperAdmin, requete);
//   assert.equal(erreur, null);
// });

// // ─── Permissions palier 2 (matrice §2.2) ────────────────────────────────────

// test('permissions admin.roles/.security/.flags/.maintenance = SUPER_ADMIN seul', () => {
//   for (const permission of ['admin.roles', 'admin.security', 'admin.flags', 'admin.maintenance']) {
//     assert.deepEqual(PERMISSIONS[permission], ['SUPER_ADMIN'], `${permission} doit être exclusive`);
//     assert.equal(can(['ADMIN'], permission), false, `${permission} : ADMIN ne doit pas passer`);
//     assert.equal(can(['MODERATOR', 'DATA_STEWARD'], permission), false);
//     assert.equal(can(['SUPER_ADMIN'], permission), true);
//   }
// });

// test('GOVERNANCE_ROLES : rôles de nomination, jamais auto-attribués', () => {
//   for (const role of GOVERNANCE_ROLES) {
//     assert.match(role, /^[A-Z_]+$/, `${role} : format d'un rôle`);
//     assert.ok(!['FARMER', 'BUYER', 'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR',
//       'SUPPORT_AGENT', 'AGRICULTURAL_COMPANY', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER']
//       .includes(role), `${role} : un rôle libre-service ne peut pas être un rôle de gouvernance`);
//   }
//   assert.ok(GOVERNANCE_ROLES.includes('SUPER_ADMIN'));
//   assert.ok(GOVERNANCE_ROLES.includes('ADMIN'));
// });