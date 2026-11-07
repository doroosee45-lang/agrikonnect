/**
 * SPEC-SUPER-ADMIN M3 — recette AC-M3 de bout en bout (**base réelle**).
 *
 * Parcours exigé par le critère d'acceptation :
 *   - le Super Admin avec second facteur modifie les paramètres globaux ;
 *   - un admin sans `admin.settings` / un utilisateur non admin obtient 403 ;
 *   - **module désactivé → toute route du module renvoie 403 `module_disabled`**
 *     (la lecture du module est coupée, les autres modules restent ouverts) ;
 *   - **mode maintenance → mutations refusées** hors `/auth`, `/admin`,
 *     `/webhooks`, `/health` (RG-M3-4) ;
 *   - tout dépassement de plage est refusé (RG-M3-1) ;
 *   - un secret n'est jamais réaffiché (RG-M3-3) ;
 *   - le reset et les feature flags sont en palier 2 (`mfa_required`).
 *
 * Seul service remplacé : Supabase Auth (stub GoTrue — `support/harness.mjs`).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

let h;
let currentCode;

const PASSWORD = 'MotDePasse!2026';
const SUPER_EMAIL = 'super-admin-m3@agrikonnect.test';
const SANS_MFA_EMAIL = 'super-sans-mfa-m3@agrikonnect.test';
const ADMIN_EMAIL = 'admin-m3@agrikonnect.test';
const PRODUCTEUR_EMAIL = 'producteur-m3@agrikonnect.test';

const comptes = {
  super: { id: null, token: null, secret: null },
  sansMfa: { id: null, token: null },
  admin: { id: null, token: null },
  producteur: { id: null, token: null },
};

const registerUser = async (email) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'M3',
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

const login = async (email, extra = {}) =>
  h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD, ...extra } });

/** Attribue des rôles de gouvernance **directement en base** (semis de test). */
const seedRoles = async (userId, roles) => {
  const membership = await h.prisma.membership.findFirst({ where: { userId } });
  assert.ok(membership, `adhésion existante pour ${userId}`);
  await h.prisma.membership.update({ where: { id: membership.id }, data: { roles } });
};

/** Enrôle la MFA réelle (TOTP) du compte et retourne le secret. */
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

/** Jeton du super admin : connexion **avec** second facteur (RG-G1). */
const jetonSuper = async () => {
  const connexion = await login(SUPER_EMAIL, { mfaCode: currentCode(comptes.super.secret) });
  assert.equal(connexion.status, 200, `connexion super : ${JSON.stringify(connexion.body)}`);
  return connexion.body.data.session.accessToken;
};

before(async () => {
  h = await startHarness();
  ({ currentCode } = await import('../../src/modules/auth/mfa.service.js'));

  const superData = await registerUser(SUPER_EMAIL);
  comptes.super.id = superData.user.id;
  await seedRoles(comptes.super.id, ['SUPER_ADMIN']);
  comptes.super.token = superData.session.accessToken;
  comptes.super.secret = await activerMfa(comptes.super.token);

  const sansMfaData = await registerUser(SANS_MFA_EMAIL);
  comptes.sansMfa.id = sansMfaData.user.id;
  await seedRoles(comptes.sansMfa.id, ['SUPER_ADMIN']);
  comptes.sansMfa.token = (await login(SANS_MFA_EMAIL)).body.data.session.accessToken;

  const adminData = await registerUser(ADMIN_EMAIL);
  comptes.admin.id = adminData.user.id;
  await seedRoles(comptes.admin.id, ['ADMIN']);
  comptes.admin.token = (await login(ADMIN_EMAIL)).body.data.session.accessToken;

  const prodData = await registerUser(PRODUCTEUR_EMAIL);
  comptes.producteur.id = prodData.user.id;
  comptes.producteur.token = (await login(PRODUCTEUR_EMAIL)).body.data.session.accessToken;
});

after(async () => {
  await h?.stop();
});

/* ═══════════════ AC-M3 : module désactivé → 403 module_disabled ═══════════════ */

test('AC-M3 : modules.market=false → 403 `module_disabled` sur les routes du marché', async () => {
  const token = await jetonSuper();

  const mise = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'modules.market', value: false },
  });
  assert.equal(mise.status, 200, JSON.stringify(mise.body));

  for (const chemin of ['/purchase-requests', '/listings', '/market/offres']) {
    const refus = await h.request('POST', chemin, { token: comptes.producteur.token, body: {} });
    assert.equal(refus.status, 403, `POST ${chemin} : ${JSON.stringify(refus.body)}`);
    assert.equal(refus.body.details?.code, 'module_disabled', `POST ${chemin}`);
  }

  // Lecture du module coupée aussi.
  const lectureCoupee = await h.request('GET', '/listings', { token: comptes.producteur.token });
  assert.equal(lectureCoupee.status, 403);
  assert.equal(lectureCoupee.body.details?.code, 'module_disabled');

  // Les autres modules restent ouverts.
  const autreModule = await h.request('GET', '/crops', { token: comptes.producteur.token });
  assert.ok(![401, 403].includes(autreModule.status), `GET /crops : ${autreModule.status}`);

  // Rétablissement.
  const retabli = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'modules.market', value: true },
  });
  assert.equal(retabli.status, 200);
  const apres = await h.request('GET', '/listings', { token: comptes.producteur.token });
  assert.ok(![401, 403].includes(apres.status), `module rétabli : ${apres.status}`);
});

/* ═══════════════ RG-M3-4 : mode maintenance ═══════════════ */

test('RG-M3-4 : maintenance → 403 `maintenance_mode` sur les mutations, lectures ouvertes', async () => {
  const token = await jetonSuper();

  const mise = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'platform.maintenance', value: true },
  });
  assert.equal(mise.status, 200, JSON.stringify(mise.body));

  const mutation = await h.request('POST', '/purchase-requests', {
    token: comptes.producteur.token,
    body: {},
  });
  assert.equal(mutation.status, 403, JSON.stringify(mutation.body));
  assert.equal(mutation.body.details?.code, 'maintenance_mode');

  const lecture = await h.request('GET', '/listings', { token: comptes.producteur.token });
  assert.ok(![401, 403].includes(lecture.status), `lecture en maintenance : ${lecture.status}`);

  // Exemptions : /auth (rester joignable), /admin (administrer), /health.
  const connexion = await login(PRODUCTEUR_EMAIL, { password: 'faux' });
  assert.notEqual(connexion.status, 403, '/auth exempté du mode maintenance');

  const adminLecture = await h.request('GET', '/admin/settings', { token });
  assert.equal(adminLecture.status, 200, '/admin exempté du mode maintenance');

  const retabli = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'platform.maintenance', value: false },
  });
  assert.equal(retabli.status, 200);
});

/* ═══════════════ Lecture : sections, compat, paliers ═══════════════ */

test('M3 lecture : vue documentée + compat `values` + palier 2', async () => {
  const vue = await h.request('GET', '/admin/settings', { token: comptes.admin.token });
  assert.equal(vue.status, 200, JSON.stringify(vue.body));
  assert.ok(vue.body.data.values['platform.name'], 'compat values[key]');
  assert.ok(vue.body.data.sections.platform.settings['platform.name'].description);
  assert.equal(typeof vue.body.data.maintenance, 'boolean');

  // ADMIN : palier 1 OK, palier 2 refusé (RG-M3-2).
  const palier1 = await h.request('PUT', '/admin/settings', {
    token: comptes.admin.token,
    body: { key: 'limits.maxUploadMb', value: 32 },
  });
  assert.equal(palier1.status, 200, JSON.stringify(palier1.body));

  const palier2 = await h.request('PUT', '/admin/settings', {
    token: comptes.admin.token,
    body: { key: 'security.passwordMinLength', value: 10 },
  });
  assert.equal(palier2.status, 403, JSON.stringify(palier2.body));
  assert.equal(palier2.body.details?.requires, 'super_admin');
});

/* ═══════════════ RG-M3-1 : plages ═══════════════ */

test('RG-M3-1 : toute valeur hors plage est refusée (422)', async () => {
  const token = await jetonSuper();
  const horsPlage = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'limits.maxUploadMb', value: 99999 },
  });
  assert.equal(horsPlage.status, 422, JSON.stringify(horsPlage.body));
});

/* ═══════════════ RG-M3-3 : secrets ═══════════════ */

test('RG-M3-3 : un secret n\'est jamais réaffiché (vue + historique)', async () => {
  const token = await jetonSuper();
  const ecriture = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'integrations.smsAuthToken', value: 'twilio-token-recette-123' },
  });
  assert.equal(ecriture.status, 200, JSON.stringify(ecriture.body));
  assert.equal(ecriture.body.data.values['integrations.smsAuthToken'], '••••••••');

  const vue = await h.request('GET', '/admin/settings', { token });
  assert.equal(vue.body.data.values['integrations.smsAuthToken'], '••••••••');
  assert.ok(!JSON.stringify(vue.body).includes('twilio-token-recette-123'), 'aucune fuite');

  const historique = await h.request(
    'GET',
    '/admin/settings/history?key=integrations.smsAuthToken',
    { token },
  );
  assert.equal(historique.status, 200, JSON.stringify(historique.body));
  assert.ok(historique.body.data.length >= 1);
  for (const revision of historique.body.data) {
    assert.deepEqual(revision.newValue, { masked: true });
    assert.deepEqual(revision.previousValue, { masked: true });
  }
  assert.ok(!JSON.stringify(historique.body).includes('twilio-token-recette-123'));
});

/* ═══════════════ Historique + reset (palier 2) ═══════════════ */

test('M3 historique et reset : journal des révisions + retour au défaut', async () => {
  const token = await jetonSuper();

  const ecriture = await h.request('PUT', '/admin/settings', {
    token,
    body: { key: 'platform.name', value: 'Nom Journal M3' },
  });
  assert.equal(ecriture.status, 200, JSON.stringify(ecriture.body));

  const historique = await h.request('GET', '/admin/settings/history?key=platform.name', { token });
  assert.equal(historique.status, 200, JSON.stringify(historique.body));
  assert.ok(historique.body.meta.total >= 1, 'journal non vide');

  const reset = await h.request('POST', '/admin/settings/platform.name/reset', { token });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(reset.body.data.key, 'platform.name');

  // Reset = palier 2 : un SUPER_ADMIN sans second facteur est refusé.
  const sansMfa = await h.request('POST', '/admin/settings/platform.name/reset', {
    token: comptes.sansMfa.token,
  });
  assert.equal(sansMfa.status, 403, JSON.stringify(sansMfa.body));
  assert.equal(sansMfa.body.details?.mfaRequired, true);
});

/* ═══════════════ Feature flags (palier 2) ═══════════════ */

test('M3 flags : lecture/écriture SUPER_ADMIN + MFA, refus ailleurs', async () => {
  const token = await jetonSuper();

  const ecriture = await h.request('PUT', '/admin/flags', {
    token,
    body: {
      items: [
        { key: 'modules.transport', scope: 'COUNTRY', scopeValue: 'CD', enabled: false, reason: 'Recette M3' },
      ],
    },
  });
  assert.equal(ecriture.status, 200, JSON.stringify(ecriture.body));
  assert.equal(ecriture.body.data.items[0].scopeValue, 'CD');
  assert.equal(ecriture.body.data.items[0].enabled, false);

  const liste = await h.request('GET', '/admin/flags?scopeValue=CD', { token });
  assert.equal(liste.status, 200, JSON.stringify(liste.body));
  assert.equal(liste.body.data.items.length, 1);

  const adminRefus = await h.request('PUT', '/admin/flags', {
    token: comptes.admin.token,
    body: { items: [{ key: 'modules.transport', scope: 'COUNTRY', scopeValue: 'CD', enabled: true }] },
  });
  assert.equal(adminRefus.status, 403, JSON.stringify(adminRefus.body));

  const sansMfaRefus = await h.request('GET', '/admin/flags', { token: comptes.sansMfa.token });
  assert.equal(sansMfaRefus.status, 403, JSON.stringify(sansMfaRefus.body));
  assert.equal(sansMfaRefus.body.details?.mfaRequired, true);
});

/* ═══════════════ Contre-épreuves ═══════════════ */

test('M3 sécurité : 401 sans jeton, 403 sans permission', async () => {
  const sansJeton = await h.request('GET', '/admin/settings');
  assert.equal(sansJeton.status, 401, JSON.stringify(sansJeton.body));

  const producteur = await h.request('GET', '/admin/settings', { token: comptes.producteur.token });
  assert.equal(producteur.status, 403, JSON.stringify(producteur.body));
});
