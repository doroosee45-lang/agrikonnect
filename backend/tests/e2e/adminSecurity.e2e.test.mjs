/**
 * SPEC-SUPER-ADMIN M6 — recette AC-M6 de bout en bout (**base réelle**).
 *
 * Parcours exigé par le critère d'acceptation :
 *   - échecs de connexion répétés (limite `LOGIN_MAX_ATTEMPTS`, paramétrable)
 *     → compte verrouillé → **visible dans M6** (`/admin/security/overview`)
 *     → déverrouillage par un admin → audit complet dans `/admin/audit` ;
 *   - refus d'une mutation de gouvernance sans MFA (`mfa_required`, RG-S1) ;
 *   - recherche avancée du journal (acteur, action, ressource, date, gravité) ;
 *   - export du journal (CSV/JSON), lui-même audité (RG-S2 : insertion seule) ;
 *   - politique de sécurité `security.*` en palier 2 (401/403/mfa_required,
 *     puis lecture/écriture validées avec le Super Admin à second facteur).
 *
 * Seul service remplacé : Supabase Auth (stub GoTrue — `support/harness.mjs`).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

let h;
let currentCode;

const PASSWORD = 'MotDePasse!2026';
const SUPER_EMAIL = 'super-admin-m6@agrikonnect.test';
const SANS_MFA_EMAIL = 'super-sans-mfa-m6@agrikonnect.test';
const ADMIN_EMAIL = 'admin-m6@agrikonnect.test';
const VICTIME_EMAIL = 'victime-m6@agrikonnect.test';

const LIMIT = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);

const comptes = {
  super: { id: null, token: null, secret: null },
  sansMfa: { id: null, token: null },
  admin: { id: null, token: null },
  victime: { id: null, token: null },
};

const registerUser = async (email) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'M6',
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

const seedRoles = async (userId, roles) => {
  const membership = await h.prisma.membership.findFirst({ where: { userId } });
  assert.ok(membership, `adhésion existante pour ${userId}`);
  await h.prisma.membership.update({ where: { id: membership.id }, data: { roles } });
};

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

  const victimeData = await registerUser(VICTIME_EMAIL);
  comptes.victime.id = victimeData.user.id;
  comptes.victime.token = (await login(VICTIME_EMAIL)).body.data.session.accessToken;
});

after(async () => {
  await h?.stop();
});

/* ═══════════════ AC-M6 : verrouillage → visible → déverrouillé → audité ═══════════════ */

test('AC-M6 : échecs répétés → verrou visible dans M6 → déverrouillage audité', async () => {
  // Échecs de connexion jusqu'à la limite anti brute-force (paramétrable).
  for (let i = 0; i < LIMIT; i += 1) {
    const echec = await login(VICTIME_EMAIL, { password: 'faux-mot-de-passe' });
    assert.ok([401, 429].includes(echec.status), `échec ${i + 1} : ${echec.status}`);
  }

  // Le compte est verrouillé : même le bon mot de passe est refusé.
  const verrouille = await login(VICTIME_EMAIL);
  assert.ok([429, 401].includes(verrouille.status), `verrou actif : ${verrouille.status}`);

  // Visible dans M6.
  const token = await jetonSuper();
  const vue = await h.request('GET', '/admin/security/overview', { token });
  assert.equal(vue.status, 200, JSON.stringify(vue.body));
  assert.ok(
    vue.body.data.lockedAccounts.some((c) => c.id === comptes.victime.id),
    'compte verrouillé visible dans la vue sécurité',
  );
  assert.ok(vue.body.data.failures.last24h >= LIMIT, 'échecs comptabilisés sur 24 h');

  // Déverrouillage par un admin (M2, palier 1) — motif requis.
  const debloc = await h.request('POST', `/admin/users/${comptes.victime.id}/unlock`, {
    token: comptes.admin.token,
    body: { reason: 'victime légitime vérifiée' },
  });
  assert.equal(debloc.status, 200, JSON.stringify(debloc.body));

  // Le compte n'est plus verrouillé.
  const vueApres = await h.request('GET', '/admin/security/overview', { token });
  assert.ok(
    !vueApres.body.data.lockedAccounts.some((c) => c.id === comptes.victime.id),
    'verrou levé',
  );

  // Audit complet : échecs tracés (acteur = la victime)…
  const journal = await h.request(
    'GET',
    `/admin/audit?actorId=${comptes.victime.id}&limit=50`,
    { token: comptes.admin.token },
  );
  assert.equal(journal.status, 200, JSON.stringify(journal.body));
  const actions = journal.body.data.map((l) => l.action);
  assert.ok(actions.includes('auth.login.failed') || actions.includes('auth.login.locked'), 'échecs tracés');

  // …et déverrouillage tracé (acteur = l'admin, ressource = le compte de la victime).
  const journalDebloc = await h.request(
    'GET',
    '/admin/audit?action=admin.user.unlock&limit=10',
    { token: comptes.admin.token },
  );
  assert.equal(journalDebloc.status, 200, JSON.stringify(journalDebloc.body));
  const deblocage = journalDebloc.body.data.find((l) => l.resourceId === comptes.victime.id);
  assert.ok(deblocage, 'déverrouillage tracé');
  assert.equal(deblocage.newValue.reason, 'victime légitime vérifiée');
});

/* ═══════════════ RG-S1 : mutation de gouvernance sans MFA ═══════════════ */

test('RG-S1 : mutation de gouvernance refusée sans MFA (`mfaRequired`)', async () => {
  // Attribution de rôle (palier 2) par un SUPER_ADMIN **sans** second facteur.
  const refus = await h.request('POST', `/admin/users/${comptes.victime.id}/roles`, {
    token: comptes.sansMfa.token,
    body: { role: 'MODERATOR', mfaCode: '000000', reason: 'test RG-S1' },
  });
  assert.equal(refus.status, 403, JSON.stringify(refus.body));
  assert.equal(refus.body.details?.mfaRequired, true, 'marqueur mfaRequired (contrat clients)');
});

/* ═══════════════ U-M6-1 : recherche avancée + export audité ═══════════════ */

test('U-M6-1 : recherche par gravité et export CSV audité', async () => {
  const token = await jetonSuper();

  const grave = await h.request('GET', '/admin/audit?severity=haute&limit=20', {
    token: comptes.admin.token,
  });
  assert.equal(grave.status, 200, JSON.stringify(grave.body));
  assert.ok(grave.body.data.every((l) => l.severity === 'haute'), 'filtre gravité appliqué');
  assert.ok(grave.body.data.length >= 1, 'au moins une action haute (verrouillage du parcours)');

  const parPeriode = await h.request(
    'GET',
    '/admin/audit?from=2020-01-01&to=2020-01-02&limit=10',
    { token: comptes.admin.token },
  );
  assert.equal(parPeriode.status, 200);
  assert.equal(parPeriode.body.data.length, 0, 'fenêtre vide = aucun résultat (aucune donnée inventée)');

  // Export CSV (brut : en-têtes d'attachement, pas de JSON enveloppé).
  const csv = await h.request('GET', '/admin/audit/export?format=csv&limit=50', {
    token: comptes.admin.token,
    raw: true,
  });
  assert.equal(csv.status, 200, `export : ${csv.status}`);
  assert.match(csv.headers.get('content-type'), /text.csv/);
  assert.match(csv.headers.get('content-disposition'), /audit-[0-9]{4}-[0-9]{2}-[0-9]{2}.csv/);
  const texte = csv.buffer.toString('utf8');
  const lignes = texte.split(String.fromCharCode(10));
  assert.ok(lignes[0].startsWith('id,createdAt,actorId'), 'en-tête CSV');
  assert.ok(lignes.length >= 2, 'au moins une ligne exportée');

  // RG-S2 : l'export est lui-même audité (insertion seule — aucune écriture ailleurs).
  const trace = await h.request('GET', '/admin/audit?action=admin.audit.export&limit=5', {
    token: comptes.admin.token,
  });
  assert.equal(trace.status, 200);
  assert.ok(trace.body.data.length >= 1, 'export journalisé');
  assert.equal(trace.body.data[0].newValue.format, 'csv');
});

/* ═══════════════ U-M6-2 : état MFA des comptes de gouvernance ═══════════════ */

test('U-M6-2 : la vue sécurité alerte sur les comptes de gouvernance sans MFA', async () => {
  const token = await jetonSuper();
  const vue = await h.request('GET', '/admin/security/overview', { token });
  assert.equal(vue.status, 200, JSON.stringify(vue.body));

  const sansMfa = vue.body.data.governanceMfa.withoutMfa;
  assert.ok(
    sansMfa.some((m) => m.userId === comptes.sansMfa.id),
    'le SUPER_ADMIN sans second facteur est signalé (RG-S1)',
  );
  assert.ok(
    !sansMfa.some((m) => m.userId === comptes.super.id),
    'le compte à MFA active n’est pas signalé',
  );
  assert.ok(vue.body.data.sessions.note, 'dérivation des sessions documentée');
  assert.ok(vue.body.data.apiKeys.note, 'politique des clés API documentée');
});

/* ═══════════════ U-M6-3 : politique de sécurité (palier 2) ═══════════════ */

test('U-M6-3 : politique — 401/403/mfa_required, puis lecture et écriture', async () => {
  // Sans jeton : 401.
  const anonyme = await h.request('GET', '/admin/security/policy');
  assert.equal(anonyme.status, 401, JSON.stringify(anonyme.body));

  // ADMIN (palier 1) : 403.
  const refusAdmin = await h.request('GET', '/admin/security/policy', { token: comptes.admin.token });
  assert.equal(refusAdmin.status, 403);

  // SUPER_ADMIN sans MFA : 403 `mfaRequired` (RG-S1).
  const refusMfa = await h.request('GET', '/admin/security/policy', { token: comptes.sansMfa.token });
  assert.equal(refusMfa.status, 403);
  assert.equal(refusMfa.body.details?.mfaRequired, true);

  // Super Admin avec second facteur : lecture.
  const token = await jetonSuper();
  const lecture = await h.request('GET', '/admin/security/policy', { token });
  assert.equal(lecture.status, 200, JSON.stringify(lecture.body));
  assert.equal(lecture.body.data.section, 'security');
  assert.equal(lecture.body.data.tier, 2);
  const cles = Object.keys(lecture.body.data.values);
  assert.ok(cles.includes('security.mfaRequiredForGovernance'));
  assert.ok(cles.includes('security.sessionTtlHours'));
  assert.ok(cles.includes('security.passwordMinLength'));

  // Écriture validée (dans la plage).
  const mise = await h.request('PUT', '/admin/security/policy', {
    token,
    body: { values: { 'security.lockoutMinutes': 30 }, reason: 'durcissement recette' },
  });
  assert.equal(mise.status, 200, JSON.stringify(mise.body));
  assert.equal(mise.body.data.values['security.lockoutMinutes'], 30);

  // Hors plage : refus (RG-M3-1 — la validation reste celle du catalogue).
  const horsPlage = await h.request('PUT', '/admin/security/policy', {
    token,
    body: { values: { 'security.lockoutMinutes': 99999 } },
  });
  assert.ok([400, 422].includes(horsPlage.status), `hors plage : ${horsPlage.status}`);

  // Hors section : refus.
  const horsSection = await h.request('PUT', '/admin/security/policy', {
    token,
    body: { values: { 'platform.name': 'Piraté' } },
  });
  assert.ok([400, 422].includes(horsSection.status), `hors section : ${horsSection.status}`);

  // L'écriture est journalisée (révision + audit — service de paramètres).
  const trace = await h.request('GET', '/admin/audit?action=admin.setting.update&limit=20', {
    token,
  });
  assert.ok(
    trace.body.data.some((l) => l.resourceId === 'security.lockoutMinutes'),
    'écriture de politique tracée dans le journal',
  );
});
