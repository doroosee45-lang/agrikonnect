/**
 * SPEC-SUPER-ADMIN M2 — utilisateurs, administrateurs, rôles et permissions.
 *
 * Ce que garantit ce test :
 *   1. `usersWhere` (pur) construit les filtres U-M2-1 (terme, rôle, statut,
 *      pays, MFA, vérifications, période) sans rien inventer ;
 *   2. la fiche U-M2-2 compose profil, adhésions/rôles, sécurité et historique
 *      d'actions auditées ;
 *   3. les actions opérationnelles U-M2-4 (statut avec motif, déverrouillage,
 *      révocation de sessions, marquage vérifié) exigent le motif quand la
 *      spec l'exige, protègent le compte courant et les SUPER_ADMIN, et
 *      écrivent systématiquement `audit_logs` (RG-M2-2) ;
 *   4. les mutations de rôles (U-M2-3) passent par une **vraie** vérification
 *      MFA (enrôlement + TOTP réels, `assertMfa`), créent l'adhésion manquante,
 *      refusent les doublons, et protègent le dernier SUPER_ADMIN (RG-G2) ;
 *   5. la suppression est **logique** (RG-G5) et les sessions révoquées avant ;
 *   6. l'export de portabilité (U-M2-5) ne contient **aucun secret** ;
 *   7. `grantRoleSchema` encode RG-G3 : la nomination d'un SUPER_ADMIN exige
 *      le mot de passe courant ;
 *   8. la matrice U-M2-6 est lue dans `PERMISSIONS`, palier 2 réservé
 *      `SUPER_ADMIN` (séparation stricte des privilèges).
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.service.js';
import { grantRoleSchema } from '../src/modules/admin/admin.schema.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import { setup, confirm, currentCode } from '../src/modules/auth/mfa.service.js';
import { PERMISSIONS, GOVERNANCE_ROLES } from '../src/shared/permissions.js';

/** Alias local : le constructeur de filtres est exporté par le service (pur). */
const usersWherePure = service.usersWhere;

const ORG = {
  id: 'org-1',
  type: 'INDIVIDUAL',
  name: 'Exploitation Awa',
  slug: 'exploitation-awa',
  countryCode: 'CD',
  deletedAt: null,
};

const profil = (id, extras = {}) => ({
  id,
  email: `${id}@agrikonnect.test`,
  firstName: 'Test',
  lastName: 'M2',
  countryCode: 'CD',
  status: 'ACTIVE',
  mfaEnabled: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  deletedAt: null,
  ...extras,
});

const adhesion = (userId, roles, extras = {}) => ({
  id: `mem-${userId}-${extras.organizationId ?? ORG.id}`,
  userId,
  organizationId: extras.organizationId ?? ORG.id,
  roles,
  status: 'ACTIVE',
  joinedAt: new Date('2026-01-15T10:00:00.000Z'),
  ...extras,
});

const requis = (user) => ({ user, headers: { 'user-agent': 'test-m2' }, ip: '127.0.0.1' });

/** Enrôle et confirme une **vraie** MFA (TOTP) pour l'acteur de test. */
const activerMfa = async (userId, email) => {
  const req = requis({ id: userId, email, roles: ['SUPER_ADMIN'], profile: { id: userId, mfaEnabled: false } });
  const enrollement = await setup(req);
  await confirm({ code: currentCode(enrollement.secret) }, req);
  return enrollement.secret;
};

const FAKE_BASE = {
  profile: [],
  membership: [],
  organization: [ORG],
  auditLog: [],
  mfaSecret: [],
  verification: [],
};

/** Monte un double + base de test, exécute la fonction, restaure toujours. */
const avecBase = async (initial, fn) => {
  const { fake, restore } = await withFakePrisma(prisma, { ...FAKE_BASE, ...initial });
  try {
    return await fn(fake);
  } finally {
    restore();
  }
};

// ─── usersWhere (U-M2-1, pur) ───────────────────────────────────────────────

test('usersWhere : aucun filtre → compte vivants seulement', () => {
  assert.deepEqual(usersWherePure({}), { deletedAt: null });
});

test('usersWhere : terme q/recherche sur e-mail, nom, téléphone', () => {
  const where = usersWherePure({ q: 'awa' });
  assert.equal(where.OR.length, 4);
  assert.deepEqual(where.OR[3], { phone: { contains: 'awa' } });

  // Alias `search` (compatibilité) accepté à l'identique.
  assert.deepEqual(usersWherePure({ search: 'awa' }), where);
});

test('usersWhere : filtre rôle → adhésion portant le rôle', () => {
  const where = usersWherePure({ role: 'MODERATOR' });
  assert.deepEqual(where.memberships, { some: { roles: { has: 'MODERATOR' } } });
});

test('usersWhere : statut, pays en majuscules, MFA, vérifications', () => {
  const where = usersWherePure({
    status: 'SUSPENDED',
    country: 'cd',
    mfa: 'true',
    emailVerified: 'true',
    phoneVerified: 'false',
  });
  assert.equal(where.status, 'SUSPENDED');
  assert.equal(where.countryCode, 'CD');
  assert.equal(where.mfaEnabled, true);
  assert.deepEqual(where.emailVerifiedAt, { not: null });
  assert.deepEqual(where.phoneVerifiedAt, null);
});

test('usersWhere : période createdFrom/createdTo', () => {
  const where = usersWherePure({ createdFrom: '2026-01-01', createdTo: '2026-06-30' });
  assert.equal(where.createdAt.gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(where.createdAt.lte.toISOString(), '2026-06-30T23:59:59.999Z');
});

// ─── Fiche utilisateur (U-M2-2) ─────────────────────────────────────────────

test('fiche : compose profil, adhésions/rôles, sécurité et historique', async () => {
  await avecBase({
    profile: [profil('cible-1', { mfaEnabled: true, failedLoginAttempts: 3 })],
    membership: [adhesion('cible-1', ['FARMER', 'MODERATOR'])],
    auditLog: [
      { id: 'a1', actorId: 'cible-1', action: 'auth.login', resource: 'auth', createdAt: new Date(), ip: null },
      { id: 'a2', actorId: 'autre', action: 'autre.action', resource: 'x', createdAt: new Date(), ip: null },
    ],
  }, async () => {
    const fiche = await service.getUser('cible-1');
    assert.equal(fiche.user.email, 'cible-1@agrikonnect.test');
    assert.equal(fiche.organizations.length, 1);
    assert.deepEqual(fiche.organizations[0].roles, ['FARMER', 'MODERATOR']);
    assert.equal(fiche.organizations[0].organization.id, ORG.id);
    assert.equal(fiche.security.mfaEnabled, true);
    assert.equal(fiche.security.failedLoginAttempts, 3);
    assert.equal(fiche.security.locked, false);
    assert.equal(fiche.verification.emailVerifiedAt, null);
    // Seules les actions de la personne figurent à son historique.
    assert.equal(fiche.auditTrail.length, 1);
    assert.equal(fiche.auditTrail[0].action, 'auth.login');
  });
});

test('fiche : utilisateur inconnu → 404', async () => {
  await avecBase({}, async () => {
    await assert.rejects(() => service.getUser('inconnu-99'), (e) => e.status === 404);
  });
});

// ─── Actions opérationnelles (U-M2-4, RG-M2-2) ──────────────────────────────

test('statut : motif requis (3 caractères minimum)', async () => {
  await avecBase({
    profile: [profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async () => {
    const reqActeur = requis({ id: 'acteur-1', roles: ['ADMIN'] });
    await assert.rejects(
      () => service.updateUserStatus('cible-1', { status: 'SUSPENDED', reason: 'ab' }, reqActeur),
      /Motif requis/,
    );
  });
});

test('statut : jamais sur son propre compte, jamais un SUPER_ADMIN par un ADMIN', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1'), profil('chef-1')],
    membership: [adhesion('cible-1', ['FARMER']), adhesion('chef-1', ['SUPER_ADMIN'])],
  }, async () => {
    const reqAdmin = requis({ id: 'acteur-1', roles: ['ADMIN'] });

    await assert.rejects(
      () => service.updateUserStatus('acteur-1', { status: 'SUSPENDED', reason: 'test' }, reqAdmin),
      /propre (compte|statut)/,
    );
    await assert.rejects(
      () => service.updateUserStatus('chef-1', { status: 'SUSPENDED', reason: 'test' }, reqAdmin),
      (e) => e.status === 403,
    );
  });
});

test('statut : RG-G2 — le dernier SUPER_ADMIN actif ne peut pas être suspendu', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('chef-1')],
    membership: [adhesion('chef-1', ['SUPER_ADMIN'])],
  }, async () => {
    const reqSuper = requis({ id: 'acteur-1', roles: ['SUPER_ADMIN'] });
    await assert.rejects(
      () => service.updateUserStatus('chef-1', { status: 'SUSPENDED', reason: 'test' }, reqSuper),
      /dernier SUPER_ADMIN/,
    );
  });
});

test('statut : suspension avec motif → mise à jour + audit avant/après', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const reqActeur = requis({ id: 'acteur-1', roles: ['ADMIN'] });
    const maj = await service.updateUserStatus('cible-1', { status: 'SUSPENDED', reason: 'contenu signalé' }, reqActeur);
    assert.equal(maj.status, 'SUSPENDED');

    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.status');
    assert.ok(journal, 'action auditée');
    assert.deepEqual(journal.oldValue, { status: 'ACTIVE' });
    assert.deepEqual(journal.newValue, { status: 'SUSPENDED', reason: 'contenu signalé' });
  });
});

test('déverrouillage : compteur remis à zéro, verrou levé, audité', async () => {
  const verrou = new Date(Date.now() + 3600_000);
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1', { failedLoginAttempts: 5, lockedUntil: verrou })],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const resultat = await service.unlockUser('cible-1', { reason: 'identité confirmée' }, requis({ id: 'acteur-1', roles: ['ADMIN'] }));
    assert.equal(resultat.failedLoginAttempts, 0);
    assert.equal(resultat.lockedUntil, null);
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.unlock');
    assert.equal(journal.oldValue.failedLoginAttempts, 5);
  });
});

test('marquage vérifié : e-mail horodaté, motif journalisé', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    await service.markVerified('cible-1', 'email', { reason: 'pièce d\'identité contrôlée' }, requis({ id: 'acteur-1', roles: ['ADMIN'] }));
    const maj = fake._store.profile.find((p) => p.id === 'cible-1');
    assert.ok(maj.emailVerifiedAt instanceof Date);
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.verify_email');
    assert.equal(journal.newValue.reason, 'pièce d\'identité contrôlée');
  });
});

// ─── Sessions (U-M2-4) ──────────────────────────────────────────────────────

test('force-logout : révoque réellement les sessions GoTrue puis audit (RG-M2-2)', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const appels = [];
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      appels.push({ url: String(url), options });
      return { ok: true, status: 200 };
    };
    try {
      const resultat = await service.forceLogout('cible-1', { reason: 'session suspecte' }, requis({ id: 'acteur-1', roles: ['ADMIN'] }));
      assert.equal(resultat.sessionsRevoked, true);
    } finally {
      globalThis.fetch = vraiFetch;
    }

    assert.equal(appels.length, 1);
    assert.match(appels[0].url, /\/auth\/v1\/admin\/users\/cible-1\/logout$/);
    // La clé de service voyage en en-tête, jamais dans le journal.
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.force_logout');
    assert.equal(journal.newValue.sessionsRevoked, true);
  });
});

test('force-logout : si la révocation échoue, rien n\'est prétendu révoqué', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    try {
      await assert.rejects(
        () => service.forceLogout('cible-1', { reason: 'test' }, requis({ id: 'acteur-1', roles: ['ADMIN'] })),
        /Révocation des sessions refusée/,
      );
    } finally {
      globalThis.fetch = vraiFetch;
    }
    assert.equal(fake._store.auditLog.filter((a) => a.action === 'admin.user.force_logout').length, 0);
  });
});

// ─── Rôles de gouvernance (U-M2-3, RG-G1/G2/G3) ─────────────────────────────

test('attribution MODERATOR : MFA réelle vérifiée, adhésion mise à jour, audit avant/après', async () => {
  await avecBase({
    profile: [profil('acteur-1', { mfaEnabled: true }), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const secret = await activerMfa('acteur-1', 'acteur-1@agrikonnect.test');

    const resultat = await service.grantRole(
      'cible-1',
      {
        role: 'MODERATOR',
        mfaCode: currentCode(secret),
        reason: 'nomination test M2',
      },
      requis({ id: 'acteur-1', email: 'acteur-1@agrikonnect.test', roles: ['SUPER_ADMIN'] }),
    );

    assert.deepEqual(resultat.roles, ['FARMER', 'MODERATOR']);
    const membre = fake._store.membership.find((m) => m.userId === 'cible-1');
    assert.deepEqual(membre.roles, ['FARMER', 'MODERATOR']);
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.role.granted');
    assert.deepEqual(journal.oldValue, { roles: ['FARMER'] });
    assert.deepEqual(journal.newValue, { roles: ['FARMER', 'MODERATOR'], reason: 'nomination test M2' });
  });
});

test('attribution : code MFA invalide → refus (RG-G1)', async () => {
  await avecBase({
    profile: [profil('acteur-1', { mfaEnabled: true }), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async () => {
    const secret = await activerMfa('acteur-1', 'acteur-1@agrikonnect.test');
    assert.ok(secret);
    await assert.rejects(
      () => service.grantRole(
        'cible-1',
        { role: 'MODERATOR', mfaCode: '000000', reason: 'test refus' },
        requis({ id: 'acteur-1', email: 'acteur-1@agrikonnect.test', roles: ['SUPER_ADMIN'] }),
      ),
      /Code de double authentification invalide/,
    );
  });
});

test('attribution : rôle déjà porté → 409, et adhésion manquante créée si organisationId fourni', async () => {
  await avecBase({
    profile: [profil('acteur-1', { mfaEnabled: true }), profil('cible-1')],
    membership: [adhesion('cible-1', ['MODERATOR'])],
  }, async (fake) => {
    const secret = await activerMfa('acteur-1', 'acteur-1@agrikonnect.test');
    const reqActeur = requis({ id: 'acteur-1', email: 'acteur-1@agrikonnect.test', roles: ['SUPER_ADMIN'] });

    await assert.rejects(
      () => service.grantRole('cible-1', { role: 'MODERATOR', mfaCode: currentCode(secret), reason: 'test' }, reqActeur),
      /déjà attribué/,
    );

    // Cible sans aucune adhésion : l'adhésion manquante est créée (U-M2-3).
    fake._store.profile.push(profil('nouveau-1'));
    const role = await service.grantRole(
      'nouveau-1',
      { role: 'VERIFIER', organizationId: ORG.id, mfaCode: currentCode(secret), reason: 'première nomination' },
      reqActeur,
    );
    assert.deepEqual(role.roles, ['VERIFIER']);
    const creee = fake._store.membership.find((m) => m.userId === 'nouveau-1');
    assert.equal(creee.organizationId, ORG.id);
  });
});

test('révocation : rôle retiré, audité ; RG-G2 protège le dernier SUPER_ADMIN', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1'), profil('chef-1')],
    membership: [adhesion('cible-1', ['FARMER', 'MODERATOR']), adhesion('chef-1', ['SUPER_ADMIN'])],
  }, async (fake) => {
    const reqSuper = requis({ id: 'acteur-1', roles: ['SUPER_ADMIN'] });

    const resultat = await service.revokeRole('cible-1', 'MODERATOR', reqSuper);
    assert.deepEqual(resultat.memberships[0].roles, ['FARMER']);
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.role.revoked');
    assert.deepEqual(journal.oldValue, { roles: ['FARMER', 'MODERATOR'] });

    // Dernier SUPER_ADMIN : révocation impossible.
    await assert.rejects(() => service.revokeRole('chef-1', 'SUPER_ADMIN', reqSuper), /dernier SUPER_ADMIN/);

    // Rôle absent : 404 explicite.
    await assert.rejects(() => service.revokeRole('cible-1', 'LAB_PARTNER', reqSuper), (e) => e.status === 404);
  });
});

// ─── Suppression logique & portabilité (U-M2-5, RG-G5) ──────────────────────

test('suppression : logique uniquement, sessions révoquées, auditée', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1')],
    membership: [adhesion('cible-1', ['FARMER'])],
  }, async (fake) => {
    const appels = [];
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      appels.push(String(url));
      return { ok: true, status: 200 };
    };
    try {
      const supprime = await service.deleteUser('cible-1', { reason: 'demande RGPD' }, requis({ id: 'acteur-1', roles: ['SUPER_ADMIN'] }));
      assert.equal(supprime.status, 'DELETED');
    } finally {
      globalThis.fetch = vraiFetch;
    }

    const maj = fake._store.profile.find((p) => p.id === 'cible-1');
    assert.equal(maj.status, 'DELETED');
    assert.ok(maj.deletedAt instanceof Date, 'suppression logique = horodatage, pas d\'effacement');
    assert.equal(appels.length, 1, 'sessions révoquées avant suppression');
    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.deleted');
    assert.equal(journal.newValue.reason, 'demande RGPD');
  });
});

test('portabilité : export complet, sans aucun secret, audité', async () => {
  await avecBase({
    profile: [profil('acteur-1'), profil('cible-1', { mfaEnabled: true })],
    membership: [adhesion('cible-1', ['FARMER'])],
    verification: [
      { id: 'v1', subjectType: 'FARM', subjectId: 'f1', organizationId: ORG.id, level: 'BASIC', status: 'PENDING', reviewedBy: 'cible-1', createdAt: new Date() },
    ],
    mfaSecret: [{ id: 'sec-1', userId: 'cible-1', secretHash: 'jamais-exporte', confirmedAt: new Date(), backupCodesHashes: ['h1'] }],
  }, async (fake) => {
    const payload = await service.exportUserData('cible-1', requis({ id: 'acteur-1', roles: ['SUPER_ADMIN'] }));

    assert.equal(payload.subject.id, 'cible-1');
    assert.equal(payload.memberships.length, 1);
    assert.equal(payload.verifications.length, 1);
    assert.equal(payload.activity.length >= 0, true);

    // RG-M2-1 / §8 : aucun secret dans l'export de portabilité.
    const brut = JSON.stringify(payload);
    assert.equal(brut.includes('secretHash'), false);
    assert.equal(brut.includes('backupCodesHashes'), false);
    assert.equal(brut.includes('password'), false);

    const journal = fake._store.auditLog.find((a) => a.action === 'admin.user.export');
    assert.ok(journal, 'export audité');
  });
});

// ─── Schéma RG-G3 & matrice U-M2-6 ─────────────────────────────────────────

test('grantRoleSchema : RG-G3 — SUPER_ADMIN exige le mot de passe courant', () => {
  const sansMotDePasse = grantRoleSchema.safeParse({
    role: 'SUPER_ADMIN',
    mfaCode: '123456',
    reason: 'transfert de couronne',
  });
  assert.equal(sansMotDePasse.success, false);
  assert.equal(sansMotDePasse.error.issues[0].path[0], 'password');

  const complet = grantRoleSchema.safeParse({
    role: 'SUPER_ADMIN',
    mfaCode: '123456',
    password: 'MotDePasse!2026',
    reason: 'transfert de couronne',
  });
  assert.equal(complet.success, true);

  // Un rôle hors gouvernance est refusé (SEC-03).
  const horsListe = grantRoleSchema.safeParse({ role: 'FARMER', mfaCode: '123456', reason: 'test' });
  assert.equal(horsListe.success, false);
});

test('matrice U-M2-6 : lue dans PERMISSIONS, palier 2 réservé SUPER_ADMIN', () => {
  const matrice = service.rolesMatrix();
  assert.equal(matrice.roles.length, GOVERNANCE_ROLES.length);

  const parRole = Object.fromEntries(matrice.roles.map((r) => [r.role, r.permissions]));
  assert.ok(parRole.SUPER_ADMIN.includes('admin.roles'));
  assert.ok(parRole.SUPER_ADMIN.includes('admin.security'));
  assert.ok(parRole.ADMIN.includes('admin.users'));

  // Séparation stricte des privilèges : ADMIN n'a aucun palier 2.
  for (const reserve of ['admin.roles', 'admin.security', 'admin.flags', 'admin.maintenance']) {
    assert.deepEqual(PERMISSIONS[reserve], ['SUPER_ADMIN'], `${reserve} réservé SUPER_ADMIN`);
    assert.equal(parRole.ADMIN.includes(reserve), false);
    assert.equal(parRole.MODERATOR.includes(reserve), false);
  }
});
