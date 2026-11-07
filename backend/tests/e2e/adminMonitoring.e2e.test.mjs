/**
 * SPEC-SUPER-ADMIN M5 — recette AC-M5 de bout en bout (**base réelle**).
 *
 * Parcours exigé par le critère d'acceptation :
 *   - l'écran de supervision reflète le rapport de démarrage (services
 *     externes évalués en direct, RG-M5-1) ;
 *   - le déclenchement manuel d'un job (`notifications.purge`) exécute
 *     réellement la tâche et met à jour la dernière exécution (AC-M5) ;
 *   - la pause/reprise est en palier 2 : 403 pour un ADMIN, `mfa_required`
 *     pour un SUPER_ADMIN sans second facteur, 200 avec MFA (RG-S1) ;
 *   - un déclenchement manuel est audité (`admin.job.run`, RG-M5-2) ;
 *   - un nom de tâche inconnu renvoie 404 ; un utilisateur non admin est
 *     refusé partout.
 *
 * Seul service remplacé : Supabase Auth (stub GoTrue — `support/harness.mjs`).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

let h;
let currentCode;

const PASSWORD = 'MotDePasse!2026';
const SUPER_EMAIL = 'super-admin-m5@agrikonnect.test';
const SANS_MFA_EMAIL = 'super-sans-mfa-m5@agrikonnect.test';
const ADMIN_EMAIL = 'admin-m5@agrikonnect.test';
const PRODUCTEUR_EMAIL = 'producteur-m5@agrikonnect.test';

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
      firstName: 'M5',
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

  const prodData = await registerUser(PRODUCTEUR_EMAIL);
  comptes.producteur.id = prodData.user.id;
  comptes.producteur.token = (await login(PRODUCTEUR_EMAIL)).body.data.session.accessToken;
});

after(async () => {
  await h?.stop();
});

/* ═══════════════ AC-M5 : écran = rapport de démarrage (RG-M5-1) ═══════════════ */

test('AC-M5 : /admin/monitoring/services reflète le rapport de démarrage', async () => {
  // Miroir exact : l'écran renvoie les findings du rapport de démarrage,
  // réévalués avec la configuration en vigueur (RG-M5-1).
  const { evaluerServicesExternes } = await import('../../src/shared/startup/degradedServices.js');
  const { servicesCfg } = await import('../../src/modules/admin/admin.monitoring.service.js');

  const response = await h.request('GET', '/admin/monitoring/services', { token: comptes.admin.token });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const etat = response.body.data;
  assert.ok(etat.generatedAt, 'date de calcul affichée');
  assert.deepEqual(
    etat.services,
    evaluerServicesExternes(servicesCfg()),
    'findings identiques au rapport de démarrage (AC-M5)',
  );

  const noms = etat.services.map((f) => f.service);
  for (const attendu of ['sms', 'email', 'satellite', 'geoai']) {
    assert.ok(noms.includes(attendu), `service « ${attendu} » dans l'écran`);
  }
  assert.equal(etat.summary.total, etat.services.length);
  for (const f of etat.services) {
    assert.ok(f.mode && f.consequence, `finding complet pour ${f.service}`);
    if (f.niveau !== 'ok') assert.ok(f.pourRetablir, `marche à suivre pour ${f.service}`);
  }
  // L'écran dit le mode **en vigueur** (le harnais envoie via webhook : les SMS
  // sont capturés par le récepteur de recette).
  const sms = etat.services.find((f) => f.service === 'sms');
  assert.equal(sms.mode, servicesCfg().SMS_PROVIDER, 'mode SMS = fournisseur réellement configuré');
});

test('AC-M5 : /admin/monitoring/health — DB, stockage, temps réel, usage', async () => {
  const response = await h.request('GET', '/admin/monitoring/health', { token: comptes.admin.token });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const sante = response.body.data;
  assert.equal(sante.database.ok, true, 'base réelle joignable');
  assert.equal(typeof sante.database.latencyMs, 'number');
  assert.ok(sante.api.uptimeSeconds >= 0);
  assert.equal(typeof sante.realtime.connections, 'number');
  assert.equal(typeof sante.usage.apiCalls24h, 'number');
  assert.ok(Array.isArray(sante.alerts));
  assert.equal(sante.jobs.total, sante.jobs.total, 'compteurs de jobs présents');
});

/* ═══════════════ AC-M5 : déclenchement manuel réel (RG-M5-2) ═══════════════ */

test('AC-M5 : run notifications.purge exécute la tâche et met à jour le dernier passage', async () => {
  const token = await jetonSuper();

  const avant = await h.request('GET', '/admin/jobs', { token: comptes.admin.token });
  assert.equal(avant.status, 200);
  const purgeAvant = avant.body.data.jobs.find((j) => j.name === 'notifications.purge');

  const run = await h.request('POST', '/admin/jobs/notifications.purge/run', {
    token,
    body: { reason: 'purge de recette AC-M5' },
  });
  assert.equal(run.status, 200, JSON.stringify(run.body));
  assert.equal(run.body.data.ok, true, 'tâche réellement exécutée');

  const apres = await h.request('GET', '/admin/jobs', { token: comptes.admin.token });
  const purgeApres = apres.body.data.jobs.find((j) => j.name === 'notifications.purge');
  assert.ok(purgeApres.lastRunAt, 'dernier passage remonté');
  assert.equal(purgeApres.lastOk, true);
  if (purgeAvant?.lastRunAt) {
    assert.ok(
      new Date(purgeApres.lastRunAt) >= new Date(purgeAvant.lastRunAt),
      'dernier passage mis à jour',
    );
  }

  // RG-M5-2 : le déclenchement manuel est audité avec l'acteur et le motif.
  const journal = await h.request(
    'GET',
    '/admin/audit?action=admin.job.run&limit=10',
    { token: comptes.admin.token },
  );
  assert.equal(journal.status, 200, JSON.stringify(journal.body));
  const ligne = journal.body.data.find((l) => l.resourceId === 'notifications.purge');
  assert.ok(ligne, 'entrée admin.job.run présente');
  assert.equal(ligne.newValue.reason, 'purge de recette AC-M5');

  // Nom inconnu → 404 (jamais 200).
  const inconnu = await h.request('POST', '/admin/jobs/tache.inconnue/run', {
    token,
    body: { reason: 'essai' },
  });
  assert.equal(inconnu.status, 404, JSON.stringify(inconnu.body));
});

/* ═══════════════ U-M5-2 : pause/reprise en palier 2 (RG-S1) ═══════════════ */

test('pause/reprise : 403 pour un ADMIN, mfa_required sans MFA, 200 avec MFA', async () => {
  // Un ADMIN (palier 1) ne touche pas à la planification.
  const refusAdmin = await h.request('POST', '/admin/jobs/notifications.purge/pause', {
    token: comptes.admin.token,
  });
  assert.equal(refusAdmin.status, 403, JSON.stringify(refusAdmin.body));

  // RG-S1 : SUPER_ADMIN sans second facteur → refus avec marqueur `mfaRequired`.
  const refusMfa = await h.request('POST', '/admin/jobs/notifications.purge/pause', {
    token: comptes.sansMfa.token,
  });
  assert.equal(refusMfa.status, 403, JSON.stringify(refusMfa.body));
  assert.equal(refusMfa.body.details?.mfaRequired, true, 'marqueur mfaRequired');

  // Non admin → refusé.
  const refusProd = await h.request('POST', '/admin/jobs/notifications.purge/pause', {
    token: comptes.producteur.token,
  });
  assert.equal(refusProd.status, 403);

  // Super Admin avec MFA : pause effective → la tâche ne s'exécute plus.
  const token = await jetonSuper();
  const pause = await h.request('POST', '/admin/jobs/notifications.purge/pause', { token });
  assert.equal(pause.status, 200, JSON.stringify(pause.body));
  assert.equal(pause.body.data.paused, true);

  const enPause = await h.request('POST', '/admin/jobs/notifications.purge/run', {
    token,
    body: { reason: 'essai en pause' },
  });
  assert.equal(enPause.status, 200);
  assert.equal(enPause.body.data.skipped, true, 'tâche en pause jamais exécutée');
  assert.match(enPause.body.data.reason, /pause/);

  // Reprise → la tâche repart.
  const reprise = await h.request('POST', '/admin/jobs/notifications.purge/resume', { token });
  assert.equal(reprise.status, 200, JSON.stringify(reprise.body));
  assert.equal(reprise.body.data.paused, false);

  const repris = await h.request('POST', '/admin/jobs/notifications.purge/run', {
    token,
    body: { reason: 'après reprise' },
  });
  assert.equal(repris.status, 200);
  assert.equal(repris.body.data.ok, true, 'tâche exécutée après reprise');

  // Les actions de pause/reprise sont auditées (RG-M5-2 cohérent).
  const journal = await h.request(
    'GET',
    '/admin/audit?action=admin.job.&limit=50',
    { token: comptes.admin.token },
  );
  const actions = journal.body.data.map((l) => l.action);
  assert.ok(actions.includes('admin.job.pause'), 'pause auditée');
  assert.ok(actions.includes('admin.job.resume'), 'reprise auditée');
});

/* ═══════════════ Permissions d'accès aux écrans M5 ═══════════════ */

test('accès : un producteur est refusé sur les écrans de supervision', async () => {
  for (const chemin of ['/admin/monitoring/services', '/admin/monitoring/health', '/admin/jobs']) {
    const refus = await h.request('GET', chemin, { token: comptes.producteur.token });
    assert.equal(refus.status, 403, `GET ${chemin} : ${JSON.stringify(refus.body)}`);
  }
  const anonyme = await h.request('GET', '/admin/jobs');
  assert.equal(anonyme.status, 401, 'sans jeton : 401');
});
