/**
 * SPEC-SUPER-ADMIN M2 — recette AC-M2 de bout en bout (**base réelle**).
 *
 * Parcours complet exigé par le critère d'acceptation :
 *   création d'un compte test → suspension → réactivation → attribution
 *   `MODERATOR` → vérification dans la matrice → révocation.
 *
 * S'y ajoutent les contre-épreuves de sécurité exigées §11.4 :
 *   - 401 sans jeton ;
 *   - 403 sans permission (un `FARMER` sur les listes, un `ADMIN` sur le
 *     palier 2) ;
 *   - `mfa_required` (403) pour un SUPER_ADMIN sans second facteur ;
 *   - RG-G2 : le dernier SUPER_ADMIN actif ne peut pas être révoqué ;
 *   - RG-G3 : la nomination d'un SUPER_ADMIN exige le mot de passe courant ;
 *   - la suppression est logique (RG-G5) et l'export de portabilité ne
 *     contient aucun secret.
 *
 * Seul service remplacé : Supabase Auth (stub GoTrue respectant son contrat
 * HTTP, y compris la révocation de sessions `POST /admin/users/:id/logout`).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

let h;
let currentCode;

const PASSWORD = 'MotDePasse!2026';
const SUPER_EMAIL = 'super-admin-m2@agrikonnect.test';
const ADMIN_EMAIL = 'admin-m2@agrikonnect.test';
const VICTIME_EMAIL = 'victime-m2@agrikonnect.test';
const SANS_MFA_EMAIL = 'super-sans-mfa-m2@agrikonnect.test';

const comptes = {
  super: { id: null, token: null, secret: null },
  admin: { id: null, token: null },
  victime: { id: null, token: null },
  sansMfa: { id: null, token: null },
};

const registerUser = async (email) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'M2',
      lastName: 'Recette',
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const login = async (email, extra = {}) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD, ...extra },
  });
  return response;
};

/** Attribue des rôles de gouvernance **directement en base** (semis de test). */
const seedRoles = async (userId, roles) => {
  const membership = await h.prisma.membership.findFirst({ where: { userId } });
  assert.ok(membership, `adhésion existante pour ${userId}`);
  await h.prisma.membership.update({ where: { id: membership.id }, data: { roles } });
};

/** Enrôle la MFA réelle du compte et retourne le secret (pour les codes). */
const activerMfa = async (token) => {
  const setup = await h.request('POST', '/auth/mfa/setup', { token, body: {} });
  assert.equal(setup.status, 200, `setup : ${JSON.stringify(setup.body)}`);
  const secret = setup.body.data.secret;
  const confirme = await h.request('POST', '/auth/mfa/confirm', {
    token,
    body: { code: currentCode(secret) },
  });
  assert.equal(confirme.status, 200, `confirm : ${JSON.stringify(confirme.body)}`);
  return secret;
};

before(async () => {
  h = await startHarness();
  ({ currentCode } = await import('../../src/modules/auth/mfa.service.js'));

  // ── Comptes de la recette ──────────────────────────────────────────
  const superData = await registerUser(SUPER_EMAIL);
  comptes.super.id = superData.user.id;
  await seedRoles(comptes.super.id, ['SUPER_ADMIN']);
  comptes.super.token = superData.session.accessToken;
  comptes.super.secret = await activerMfa(comptes.super.token);
  // Connexion avec second facteur : le jeton de la recette est celui-ci.
  const superLogin = await login(SUPER_EMAIL, { mfaCode: currentCode(comptes.super.secret) });
  assert.equal(superLogin.status, 200, JSON.stringify(superLogin.body));
  comptes.super.token = superLogin.body.data.session.accessToken;

  const adminData = await registerUser(ADMIN_EMAIL);
  comptes.admin.id = adminData.user.id;
  await seedRoles(comptes.admin.id, ['ADMIN']);
  const adminLogin = await login(ADMIN_EMAIL);
  comptes.admin.token = adminLogin.body.data.session.accessToken;

  const victimeData = await registerUser(VICTIME_EMAIL);
  comptes.victime.id = victimeData.user.id;
  comptes.victime.token = victimeData.session.accessToken;

  const sansMfaData = await registerUser(SANS_MFA_EMAIL);
  comptes.sansMfa.id = sansMfaData.user.id;
  await seedRoles(comptes.sansMfa.id, ['SUPER_ADMIN']);
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ═══════════════ Sécurité : 401 / 403 / mfa_required ═══════════════ */

test('M2 sécurité : 401 sans jeton, 403 sans permission (FARMER)', async () => {
  const sansJeton = await h.request('GET', '/admin/users');
  assert.equal(sansJeton.status, 401, JSON.stringify(sansJeton.body));

  const farmer = await h.request('GET', '/admin/users', { token: comptes.victime.token });
  assert.equal(farmer.status, 403, JSON.stringify(farmer.body));
});

test('M2 sécurité : le palier 2 est réservé au SUPER_ADMIN (un ADMIN est refusé)', async () => {
  const refus = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.admin.token,
    body: { role: 'MODERATOR', mfaCode: '123456', reason: 'tentative palier 2' },
  });
  assert.equal(refus.status, 403, JSON.stringify(refus.body));
  assert.match(refus.body.message ?? '', /Super Administrateur/);

  const refusSuppression = await h.request('DELETE', `/admin/users/${comptes.victime.id}`, {
    token: comptes.admin.token,
    body: { reason: 'tentative palier 2' },
  });
  assert.equal(refusSuppression.status, 403);
});

test('M2 sécurité : SUPER_ADMIN sans second facteur → 403 `mfa_required`', async () => {
  const jetonSansMfa = (await login(SANS_MFA_EMAIL)).body.data.session.accessToken;
  const refus = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: jetonSansMfa,
    body: { role: 'MODERATOR', mfaCode: '123456', reason: 'sans second facteur' },
  });
  assert.equal(refus.status, 403, JSON.stringify(refus.body));
  assert.equal(refus.body.details?.mfaRequired, true);
});

/* ═══════════════ U-M2-1 / U-M2-2 — liste et fiche ═══════════════ */

test('U-M2-1 : liste filtrée (terme, rôle, pays, statut) sur base réelle', async () => {
  const liste = await h.request('GET', `/admin/users?q=${encodeURIComponent(VICTIME_EMAIL)}`, {
    token: comptes.super.token,
  });
  assert.equal(liste.status, 200, JSON.stringify(liste.body));
  const items = liste.body.data;
  assert.equal(items.length, 1);
  assert.equal(items[0].id, comptes.victime.id);

  const parRole = await h.request('GET', '/admin/users?role=FARMER&country=CD', { token: comptes.super.token });
  assert.equal(parRole.status, 200);
  assert.ok(parRole.body.data.some((u) => u.id === comptes.victime.id));

  const parMfa = await h.request('GET', '/admin/users?mfa=true', { token: comptes.super.token });
  assert.equal(parMfa.status, 200);
  assert.ok(parMfa.body.data.some((u) => u.id === comptes.super.id), 'le super admin a la MFA active');
  assert.equal(parMfa.body.data.some((u) => u.id === comptes.victime.id), false);
});

test('U-M2-2 : fiche complète (profil, rôles, sécurité, activité)', async () => {
  const fiche = await h.request('GET', `/admin/users/${comptes.victime.id}`, { token: comptes.super.token });
  assert.equal(fiche.status, 200, JSON.stringify(fiche.body));
  const data = fiche.body.data;
  assert.equal(data.user.id, comptes.victime.id);
  assert.equal(data.organizations.length >= 1, true);
  assert.deepEqual(data.organizations[0].roles, ['FARMER']);
  assert.equal(data.security.mfaEnabled, false);
  assert.equal(typeof data.security.failedLoginAttempts, 'number');
  assert.ok(Array.isArray(data.auditTrail));
});

/* ═══════════════ U-M2-4 — suspension / réactivation / actions ═══════════════ */

test('AC-M2 : suspension avec motif → déconnexion impossible, puis réactivation', async () => {
  const sansMotif = await h.request('PATCH', `/admin/users/${comptes.victime.id}/status`, {
    token: comptes.super.token,
    body: { status: 'SUSPENDED' },
  });
  assert.equal(sansMotif.status, 422, 'motif requis (U-M2-4)');

  const suspend = await h.request('PATCH', `/admin/users/${comptes.victime.id}/status`, {
    token: comptes.super.token,
    body: { status: 'SUSPENDED', reason: 'comportement signalé en recette' },
  });
  assert.equal(suspend.status, 200, JSON.stringify(suspend.body));

  // Le compte suspendu est refusé à la connexion comme aux appels API.
  const connexion = await login(VICTIME_EMAIL);
  assert.equal(connexion.status, 403);
  assert.match(connexion.body.message ?? '', /suspendu/i);
  const appel = await h.request('GET', '/admin/users', { token: comptes.victime.token });
  assert.equal(appel.status, 403);

  const reactiver = await h.request('PATCH', `/admin/users/${comptes.victime.id}/status`, {
    token: comptes.super.token,
    body: { status: 'ACTIVE', reason: 'signalement levé en recette' },
  });
  assert.equal(reactiver.status, 200);
  const reconnexion = await login(VICTIME_EMAIL);
  assert.equal(reconnexion.status, 200, JSON.stringify(reconnexion.body));
  comptes.victime.token = reconnexion.body.data.session.accessToken;

  // RG-M2-2 : les deux mutations sont dans le journal, avec motifs.
  const journal = await h.prisma.auditLog.findMany({
    where: { action: 'admin.user.status', resourceId: comptes.victime.id },
  });
  assert.equal(journal.length >= 2, true);
  assert.equal(journal[0].newValue.reason.length >= 3, true);
});

test('U-M2-4 : déverrouillage anti brute-force et marquage vérifié', async () => {
  const verrou = new Date(Date.now() + 3600_000);
  await h.prisma.profile.update({
    where: { id: comptes.victime.id },
    data: { failedLoginAttempts: 5, lockedUntil: verrou },
  });

  const debloquer = await h.request('POST', `/admin/users/${comptes.victime.id}/unlock`, {
    token: comptes.super.token,
    body: { reason: 'identité confirmée par le support' },
  });
  assert.equal(debloquer.status, 200, JSON.stringify(debloquer.body));
  const profil = await h.prisma.profile.findUnique({ where: { id: comptes.victime.id } });
  assert.equal(profil.failedLoginAttempts, 0);
  assert.equal(profil.lockedUntil, null);

  const verifier = await h.request('POST', `/admin/users/${comptes.victime.id}/verify-email`, {
    token: comptes.super.token,
    body: { reason: 'pièce contrôlée en recette' },
  });
  assert.equal(verifier.status, 200, JSON.stringify(verifier.body));
  const maj = await h.prisma.profile.findUnique({ where: { id: comptes.victime.id } });
  assert.ok(maj.emailVerifiedAt, 'e-mail marqué vérifié');
});

test('U-M2-4 : force-logout révoque réellement les sessions du compte', async () => {
  // Session fraîche de la victime.
  const connexion = await login(VICTIME_EMAIL);
  assert.equal(connexion.status, 200);
  const jetonVictime = connexion.body.data.session.accessToken;

  // Elle fonctionne…
  const avant = await h.request('GET', '/admin/users', { token: jetonVictime });
  assert.equal(avant.status, 403, 'un FARMER reste refusé — mais le jeton est valide');

  const revoquer = await h.request('POST', `/admin/users/${comptes.victime.id}/force-logout`, {
    token: comptes.super.token,
    body: { reason: 'session suspecte en recette' },
  });
  assert.equal(revoquer.status, 200, JSON.stringify(revoquer.body));

  // …puis le jeton est **détruit** : 401 (session révoquée), plus 403.
  const apres = await h.request('GET', '/admin/users', { token: jetonVictime });
  assert.equal(apres.status, 401, `session révoquée attendue, reçu ${apres.status}`);

  // Une nouvelle connexion repart de zéro.
  const reconnexion = await login(VICTIME_EMAIL);
  assert.equal(reconnexion.status, 200);
});

/* ═══════════════ U-M2-6 — matrice ═══════════════ */

test('U-M2-6 : la liste des rôles expose la matrice de permissions effective', async () => {
  const roles = await h.request('GET', '/admin/roles', { token: comptes.super.token });
  assert.equal(roles.status, 200, JSON.stringify(roles.body));
  const matrice = roles.body.data;
  const noms = matrice.roles.map((r) => r.role);
  assert.ok(noms.includes('SUPER_ADMIN'));
  assert.ok(noms.includes('MODERATOR'));

  const superRole = matrice.roles.find((r) => r.role === 'SUPER_ADMIN');
  const adminRole = matrice.roles.find((r) => r.role === 'ADMIN');
  assert.ok(superRole.permissions.includes('admin.roles'));
  assert.equal(adminRole.permissions.includes('admin.roles'), false, 'palier 2 réservé SUPER_ADMIN');
  assert.ok(matrice.permissions['admin.users'].includes('ADMIN'));
});

/* ═══════════════ U-M2-3 / RG-G2 / RG-G3 — rôles ═══════════════ */

test('AC-M2 : attribution MODERATOR (MFA exigée) → visible dans la fiche, puis révocation', async () => {
  // Un code MFA faux est refusé (RG-G1 : le code est réellement vérifié).
  const codeFaux = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.super.token,
    body: { role: 'MODERATOR', mfaCode: '000000', reason: 'code faux en recette' },
  });
  assert.equal(codeFaux.status, 401, JSON.stringify(codeFaux.body));

  const nommer = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.super.token,
    body: {
      role: 'MODERATOR',
      mfaCode: currentCode(comptes.super.secret),
      reason: 'nomination recette AC-M2',
    },
  });
  assert.equal(nommer.status, 200, JSON.stringify(nommer.body));
  assert.deepEqual(nommer.body.data.roles, ['FARMER', 'MODERATOR']);

  // Vérification dans la matrice (AC-M2) : la fiche porte le nouveau rôle.
  const fiche = await h.request('GET', `/admin/users/${comptes.victime.id}`, { token: comptes.super.token });
  assert.deepEqual(fiche.body.data.organizations[0].roles, ['FARMER', 'MODERATOR']);

  // Révocation (AC-M2) : le rôle disparaît, l'audit porte avant/après.
  const revoquer = await h.request('DELETE', `/admin/users/${comptes.victime.id}/roles/MODERATOR`, {
    token: comptes.super.token,
  });
  assert.equal(revoquer.status, 200, JSON.stringify(revoquer.body));
  const ficheApres = await h.request('GET', `/admin/users/${comptes.victime.id}`, { token: comptes.super.token });
  assert.deepEqual(ficheApres.body.data.organizations[0].roles, ['FARMER']);

  const journal = await h.prisma.auditLog.findMany({
    where: { action: 'admin.role.granted', resourceId: { not: '' } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  assert.ok(journal.length === 1);
  assert.deepEqual(journal[0].newValue.roles, ['FARMER', 'MODERATOR']);
});

test('RG-G3 : nomination d\'un SUPER_ADMIN — mot de passe courant exigé puis vérifié', async () => {
  const sansMotDePasse = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.super.token,
    body: { role: 'SUPER_ADMIN', mfaCode: currentCode(comptes.super.secret), reason: 'transfert de couronne' },
  });
  assert.equal(sansMotDePasse.status, 422, JSON.stringify(sansMotDePasse.body));

  const mauvaisMotDePasse = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.super.token,
    body: {
      role: 'SUPER_ADMIN',
      mfaCode: currentCode(comptes.super.secret),
      password: 'MauvaisMotDePasse!2026',
      reason: 'transfert de couronne',
    },
  });
  assert.equal(mauvaisMotDePasse.status, 401, JSON.stringify(mauvaisMotDePasse.body));

  const couronne = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.super.token,
    body: {
      role: 'SUPER_ADMIN',
      mfaCode: currentCode(comptes.super.secret),
      password: PASSWORD,
      reason: 'transfert de couronne recette',
    },
  });
  assert.equal(couronne.status, 200, JSON.stringify(couronne.body));

  // RG-G3 : audit `admin.superadmin.granted` avec rôles avant/après.
  const journal = await h.prisma.auditLog.findFirst({
    where: { action: 'admin.superadmin.granted' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(journal, 'nomination de Super Admin auditée');
  assert.deepEqual(journal.oldValue.roles, ['FARMER']);
  assert.deepEqual(journal.newValue.roles, ['FARMER', 'SUPER_ADMIN']);
});

test('RG-G2 : le dernier SUPER_ADMIN actif ne peut pas être révoqué', async () => {
  // Le compte « sans MFA » de la recette négative porte aussi SUPER_ADMIN :
  // on le rétrograde ici pour isoler la règle (exactement deux titulaires).
  await h.prisma.membership.updateMany({
    where: { userId: comptes.sansMfa.id },
    data: { roles: ['FARMER'] },
  });

  // Deux SUPER_ADMIN existent (super + victime) : la révocation de la victime passe.
  const revoquerVictime = await h.request('DELETE', `/admin/users/${comptes.victime.id}/roles/SUPER_ADMIN`, {
    token: comptes.super.token,
  });
  assert.equal(revoquerVictime.status, 200, JSON.stringify(revoquerVictime.body));

  // Reste un seul SUPER_ADMIN : la révocation est refusée (409).
  const refus = await h.request('DELETE', `/admin/users/${comptes.super.id}/roles/SUPER_ADMIN`, {
    token: comptes.super.token,
  });
  assert.equal(refus.status, 409, JSON.stringify(refus.body));
  assert.match(refus.body.message ?? '', /dernier SUPER_ADMIN/);
});

/* ═══════════════ U-M2-5 — portabilité et suppression logique ═══════════════ */

test('U-M2-5 : export de portabilité — complet, audité, sans aucun secret', async () => {
  const exporte = await h.request('GET', `/admin/users/${comptes.victime.id}/export`, {
    token: comptes.super.token,
  });
  assert.equal(exporte.status, 200, JSON.stringify(exporte.body));
  const payload = exporte.body.data;
  assert.equal(payload.subject.id, comptes.victime.id);
  assert.ok(payload.memberships.length >= 1);

  const brut = JSON.stringify(payload);
  assert.equal(brut.includes('secretHash'), false);
  assert.equal(brut.includes('backupCodesHashes'), false);
  assert.equal(brut.includes('password'), false);

  const journal = await h.prisma.auditLog.findFirst({
    where: { action: 'admin.user.export', resourceId: comptes.victime.id },
  });
  assert.ok(journal, 'export audité');
});

test('U-M2-5/RG-G5 : suppression logique — sessions révoquées, aucune ligne effacée', async () => {
  const supprimer = await h.request('DELETE', `/admin/users/${comptes.victime.id}`, {
    token: comptes.super.token,
    body: { reason: 'fin de recette AC-M2' },
  });
  assert.equal(supprimer.status, 200, JSON.stringify(supprimer.body));

  // Logique : la ligne existe toujours, marquée DELETED + horodatée.
  const profil = await h.prisma.profile.findUnique({ where: { id: comptes.victime.id } });
  assert.equal(profil.status, 'DELETED');
  assert.ok(profil.deletedAt, 'suppression logique = horodatage');

  // Sessions révoquées : l'ancien jeton est mort.
  const mort = await h.request('GET', '/admin/users', { token: comptes.victime.token });
  assert.ok(mort.status === 401 || mort.status === 403, `jeton mort attendu, reçu ${mort.status}`);

  // Le compte supprimé ne se reconnecte pas.
  const reconnexion = await login(VICTIME_EMAIL);
  assert.ok(reconnexion.status >= 400, 'connexion refusée après suppression');

  const journal = await h.prisma.auditLog.findFirst({
    where: { action: 'admin.user.deleted', resourceId: comptes.victime.id },
  });
  assert.ok(journal, 'suppression auditée');
  assert.equal(journal.newValue.status, 'DELETED');
});
