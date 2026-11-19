/**
 * ACADEMIA — lot L1 : règles pures (sans base).
 * CDC-ACADEMIA-01 §2.3, §2.4, §11.4, annexe A ; plan : docs/ACADEMIA-01-AUDIT-ET-PLAN.md.
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AFFILIATION_TRANSITIONS,
  estRoleAffiliable,
  membershipApresDecision,
  orgTypePourEtablissement,
  peutAdministrerEtablissement,
  peutDeciderAffiliation,
  peutTransitionner,
  rolesDans,
} from '../src/modules/academia/academia.policy.js';
import { rolesEffectifs } from '../src/middleware/tenant.js';
import { MODULE_PREFIXES, moduleDesactive } from '../src/middleware/settingsEffects.js';
import { can, GOVERNANCE_ROLES } from '../src/shared/permissions.js';
import { SETTINGS_CATALOG } from '../src/modules/admin/admin.settings.schema.js';

const UNI_A = 'org_uni_a';
const UNI_B = 'org_uni_b';
const membre = (organizationId, roles, type = 'UNIVERSITY') => ({
  organizationId,
  roles,
  status: 'ACTIVE',
  organization: { id: organizationId, type },
});

test('§2.4 — cycle de vie : transitions autorisées et interdites', () => {
  assert.ok(peutTransitionner('PENDING', 'VERIFIED'));
  assert.ok(peutTransitionner('PENDING', 'REJECTED'));
  assert.ok(peutTransitionner('PENDING', 'ENDED'));
  assert.ok(peutTransitionner('VERIFIED', 'SUSPENDED'));
  assert.ok(peutTransitionner('SUSPENDED', 'VERIFIED'));
  assert.ok(peutTransitionner('SUSPENDED', 'ENDED'));
  assert.equal(peutTransitionner('REJECTED', 'VERIFIED'), false, 'un refus est définitif');
  assert.equal(peutTransitionner('ENDED', 'VERIFIED'), false, 'une affiliation close ne se rouvre pas');
  assert.equal(peutTransitionner('PENDING', 'SUSPENDED'), false);
  assert.equal(peutTransitionner('VERIFIED', 'PENDING'), false);
  assert.deepEqual(Object.keys(AFFILIATION_TRANSITIONS).sort(), ['ENDED', 'PENDING', 'REJECTED', 'SUSPENDED', 'VERIFIED']);
});

test('§2.3 — seuls les rôles académiques sont demandables par affiliation', () => {
  for (const role of ['STUDENT', 'PROFESSOR', 'RESEARCHER', 'LIBRARIAN']) assert.ok(estRoleAffiliable(role), role);
  for (const role of ['UNIVERSITY_ADMIN', 'ACADEMIA_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'FARMER']) {
    assert.equal(estRoleAffiliable(role), false, `${role} ne s'obtient pas par affiliation`);
  }
});

test('annexe A — rôles évalués DANS l\'établissement concerné', () => {
  const adminA = { id: 'u1', roles: ['UNIVERSITY_ADMIN', 'FARMER'], memberships: [membre(UNI_A, ['UNIVERSITY_ADMIN'])] };
  assert.deepEqual(rolesDans(adminA, UNI_A), ['UNIVERSITY_ADMIN']);
  assert.deepEqual(rolesDans(adminA, UNI_B), []);
  assert.ok(peutAdministrerEtablissement(adminA, UNI_A));
  assert.equal(peutAdministrerEtablissement(adminA, UNI_B), false, 'responsable de A, pas de B');

  const gouvernance = { id: 'g', roles: ['ACADEMIA_ADMIN'], memberships: [] };
  assert.ok(peutAdministrerEtablissement(gouvernance, UNI_B));
});

test('§2.4 — personne ne valide sa propre affiliation, même la gouvernance', () => {
  const admin = { id: 'u1', roles: ['UNIVERSITY_ADMIN'], memberships: [membre(UNI_A, ['UNIVERSITY_ADMIN'])] };
  assert.equal(peutDeciderAffiliation(admin, { userId: 'u1', organizationId: UNI_A }), false);
  assert.ok(peutDeciderAffiliation(admin, { userId: 'u2', organizationId: UNI_A }));
  assert.equal(peutDeciderAffiliation(admin, { userId: 'u2', organizationId: UNI_B }), false);
  const gouvernance = { id: 'g', roles: ['ACADEMIA_ADMIN'], memberships: [] };
  assert.equal(peutDeciderAffiliation(gouvernance, { userId: 'g', organizationId: UNI_A }), false);
});

test('Membership : VERIFIED accorde le rôle, SUSPENDED/ENDED le retirent', () => {
  assert.deepEqual(
    membershipApresDecision({ role: 'STUDENT', nouveauStatut: 'VERIFIED' }),
    { roles: ['STUDENT'], status: 'ACTIVE' },
  );
  assert.deepEqual(
    membershipApresDecision({ rolesActuels: ['UNIVERSITY_ADMIN'], statutActuel: 'ACTIVE', role: 'PROFESSOR', nouveauStatut: 'VERIFIED' }),
    { roles: ['UNIVERSITY_ADMIN', 'PROFESSOR'], status: 'ACTIVE' },
  );
  assert.deepEqual(
    membershipApresDecision({ rolesActuels: ['STUDENT'], statutActuel: 'ACTIVE', role: 'STUDENT', nouveauStatut: 'SUSPENDED' }),
    { roles: [], status: 'REMOVED' },
  );
  assert.deepEqual(
    membershipApresDecision({ rolesActuels: ['STUDENT', 'RESEARCHER'], statutActuel: 'ACTIVE', role: 'STUDENT', nouveauStatut: 'ENDED' }),
    { roles: ['RESEARCHER'], status: 'ACTIVE' },
  );
  // Un Membership REMOVED ne restitue pas d'anciens rôles lors d'une nouvelle vérification.
  assert.deepEqual(
    membershipApresDecision({ rolesActuels: ['LIBRARIAN'], statutActuel: 'REMOVED', role: 'STUDENT', nouveauStatut: 'VERIFIED' }),
    { roles: ['STUDENT'], status: 'ACTIVE' },
  );
  // Rôle également porté par une autre affiliation vérifiée : conservé.
  assert.deepEqual(
    membershipApresDecision({
      rolesActuels: ['RESEARCHER'], statutActuel: 'ACTIVE', role: 'RESEARCHER', nouveauStatut: 'ENDED', rolesCouvertsAilleurs: ['RESEARCHER'],
    }),
    { roles: ['RESEARCHER'], status: 'ACTIVE' },
  );
  assert.equal(membershipApresDecision({ role: 'STUDENT', nouveauStatut: 'REJECTED' }), null, 'un refus n\'accorde rien');
  assert.equal(membershipApresDecision({ role: 'STUDENT', nouveauStatut: 'ENDED' }), null, 'retrait d\'une demande : rien à retirer');
});

test('non-régression R2 — rôles effectifs : inchangés hors établissement, cloisonnés dans un établissement', () => {
  const rolesTousTenants = ['FARMER', 'STUDENT'];
  // Organisation agricole : comportement historique (union) inchangé.
  assert.deepEqual(
    rolesEffectifs(membre('org_ferme', ['FARMER'], 'INDIVIDUAL'), rolesTousTenants).sort(),
    ['FARMER', 'STUDENT'],
  );
  // Université : le rôle FARMER ne s'y applique PAS.
  const dansUni = rolesEffectifs(membre(UNI_A, ['STUDENT']), rolesTousTenants);
  assert.deepEqual(dansUni, ['STUDENT']);
  assert.equal(can(dansUni, 'farms.read'), false, 'aucun accès producteur via l\'université');
  // Les rôles de gouvernance restent effectifs partout.
  assert.ok(rolesEffectifs(membre(UNI_A, ['STUDENT']), ['ADMIN']).includes('ADMIN'));
  assert.ok(GOVERNANCE_ROLES.includes('ACADEMIA_ADMIN'));
});

test('permissions ACADEMIA — matrice', () => {
  assert.ok(can(['FARMER'], 'academia.read'), 'consultation ouverte');
  assert.ok(can(['BUYER'], 'affiliations.request'), 'tout compte peut demander une affiliation');
  assert.equal(can(['STUDENT'], 'affiliations.review'), false);
  assert.ok(can(['UNIVERSITY_ADMIN'], 'affiliations.review'));
  assert.equal(can(['UNIVERSITY_ADMIN'], 'institutions.create'), false, '§11.4 : création réservée');
  assert.ok(can(['ACADEMIA_ADMIN'], 'institutions.create'));
  assert.equal(can(['ACADEMIA_ADMIN'], 'admin.roles'), false, 'ACADEMIA_ADMIN n\'a pas les droits SUPER_ADMIN');
  assert.equal(can(['ACADEMIA_ADMIN'], 'admin.maintenance'), false);
});

test('module ACADEMIA désactivé par défaut ; modules historiques inchangés', () => {
  const academia = MODULE_PREFIXES.find((m) => m.module === 'academia');
  const market = MODULE_PREFIXES.find((m) => m.module === 'market');
  assert.deepEqual(academia.prefixes, ['/academia']);
  assert.equal(moduleDesactive({}, academia), true, 'aucun réglage → désactivé');
  assert.equal(moduleDesactive({ 'modules.academia': true }, academia), false);
  assert.equal(moduleDesactive({}, market), false, 'aucun réglage → marché actif (historique)');
  assert.equal(moduleDesactive({ 'modules.market': false }, market), true);
  assert.equal(SETTINGS_CATALOG['modules.academia']?.default, false);
});

test('type d\'organisation selon le type d\'établissement', () => {
  assert.equal(orgTypePourEtablissement('UNIVERSITY'), 'UNIVERSITY');
  assert.equal(orgTypePourEtablissement('INSTITUTE'), 'UNIVERSITY');
  assert.equal(orgTypePourEtablissement('SCHOOL'), 'UNIVERSITY');
  assert.equal(orgTypePourEtablissement('RESEARCH_CENTER'), 'RESEARCH_CENTER');
});
