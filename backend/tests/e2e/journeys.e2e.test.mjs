import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './support/harness.mjs';

/**
 * Recette de bout en bout — **base réelle**.
 *
 * Différence avec `npm test` : ici, rien n'est simulé côté applicatif.
 *   - PostgreSQL véritable, schéma appliqué par la migration versionnée ;
 *   - requêtes HTTP réelles sur l'API Express complète ;
 *   - middleware d'authentification réel (allant jusqu'à l'appel GoTrue) ;
 *   - SMS et emails réellement envoyés à une passerelle et capturés ;
 *   - contraintes SQL, index uniques, transactions et isolation tenant réellement exercés.
 *
 * Seul service remplacé : Supabase Auth (service hébergé, indisponible dans cet
 * environnement), remplacé par un stub qui respecte son contrat HTTP.
 */

let h;
const PASSWORD = 'MotDePasse!2026';

/** Jeton d'un utilisateur réellement créé via /auth/register. */
const tokenOf = async (email, password = PASSWORD) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password } });
  assert.equal(response.status, 200, `connexion de ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

const registerUser = async ({ email, phone = null, firstName = 'Awa', lastName = 'Kabila', accountType = 'FARMER' }) => {
  const body = { accountType, firstName, lastName, email, password: PASSWORD, countryCode: 'CD', locale: 'fr' };
  if (phone) body.phone = phone;
  const response = await h.request('POST', '/auth/register', { body });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

before(async () => {
  h = await startHarness();
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ─────────────────────────── AUTH ─────────────────────────── */

test('E2E AUTH-01 : l’inscription crée réellement profil, organisation, appartenance et journal', async () => {
  const data = await registerUser({ email: 'awa@agrikonnect.test' });

  assert.ok(data.user.id, 'identifiant utilisateur');
  assert.equal(data.user.email, 'awa@agrikonnect.test');
  assert.equal(data.organization.type, 'INDIVIDUAL');
  assert.equal(data.session.accessToken.length > 20, true);

  // Vérification directement en base : ce ne sont pas des mocks.
  const profile = await h.prisma.profile.findUnique({ where: { id: data.user.id } });
  assert.equal(profile.email, 'awa@agrikonnect.test');
  assert.equal(profile.countryCode, 'CD');

  const membership = await h.prisma.membership.findFirst({
    where: { userId: data.user.id },
    include: { organization: true },
  });
  assert.deepEqual(membership.roles, ['FARMER']);
  assert.equal(membership.status, 'ACTIVE');
  assert.equal(membership.organization.id, data.organization.id);

  const auditLog = await h.prisma.auditLog.findFirst({
    where: { actorId: data.user.id, action: 'auth.register' },
  });
  assert.ok(auditLog, 'inscription auditée');
});

test('E2E AUTH-02 : un même email ne peut pas s’inscrire deux fois (contrainte réelle)', async () => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Awa',
      lastName: 'Kabila',
      email: 'awa@agrikonnect.test',
      password: PASSWORD,
      countryCode: 'CD',
    },
  });
  assert.equal(response.status, 409);
  assert.match(response.body.message, /existe déjà/i);
});

test('E2E AUTH-03 : le code OTP est réellement envoyé par SMS puis vérifié', async () => {
  const phone = '+243900000101';
  await registerUser({ email: 'otp@agrikonnect.test', phone, firstName: 'Mbuyi', lastName: 'Tshibola' });
  const token = await tokenOf('otp@agrikonnect.test');

  const sent = await h.request('POST', '/auth/send-otp', { token, body: { phone } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));

  const code = h.sink.lastOtpFor(phone);
  assert.ok(code, 'SMS capturé par la passerelle avec un code à 6 chiffres');
  assert.match(h.sink.messages.sms.at(-1).message, /AGRIKONNECT/);

  const verified = await h.request('POST', '/auth/verify-phone', { token, body: { phone, code } });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));

  const profile = await h.prisma.profile.findFirst({ where: { phone } });
  assert.ok(profile.phoneVerifiedAt instanceof Date, 'téléphone marqué vérifié en base');
});

test('E2E AUTH-04 : un code OTP faux est refusé et comptabilisé', async () => {
  const token = await tokenOf('otp@agrikonnect.test');

  // Un code neuf est émis pour ce test (sinon le code d'AUTH-03 serait déjà consommé).
  const issued = await h.request('POST', '/auth/send-otp', {
    token,
    body: { phone: '+243900000101' },
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));

  // Convention maison : `ApiError.badRequest` → 422 (entrée invalide), jamais 400.
  const response = await h.request('POST', '/auth/verify-phone', {
    token,
    body: { phone: '+243900000101', code: '000000' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));

  // Le refus est réellement comptabilisé en base (protection anti-force brute).
  const otp = await h.prisma.otpCode.findFirst({
    where: { identifier: '+243900000101', purpose: 'PHONE_VERIFICATION' },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(otp.attempts, 1, 'tentative comptée');
  assert.equal(otp.consumedAt, null, 'code non consommé par une tentative ratée');

  // Au-delà de 5 essais, l'API bascule en 429 et ne vérifie plus le code.
  for (let i = 0; i < 4; i += 1) {
    await h.request('POST', '/auth/verify-phone', {
      token,
      body: { phone: '+243900000101', code: '000000' },
    });
  }
  const blocked = await h.request('POST', '/auth/verify-phone', {
    token,
    body: { phone: '+243900000101', code: '000000' },
  });
  assert.equal(blocked.status, 429, JSON.stringify(blocked.body));
});

test('E2E AUTH-05 : rafraîchissement puis révocation du jeton (logout)', async () => {
  await registerUser({ email: 'session@agrikonnect.test' });
  const login = await h.request('POST', '/auth/login', {
    body: { identifier: 'session@agrikonnect.test', password: PASSWORD },
  });
  assert.equal(login.status, 200);

  const refreshed = await h.request('POST', '/auth/refresh', {
    body: { refreshToken: login.body.data.session.refreshToken },
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.data.session.accessToken, login.body.data.session.accessToken);

  const newToken = refreshed.body.data.session.accessToken;
  const before = await h.request('GET', '/me', { token: newToken });
  assert.equal(before.status, 200);

  const logout = await h.request('POST', '/auth/logout', { token: newToken });
  assert.equal(logout.status, 200);

  const afterLogout = await h.request('GET', '/me', { token: newToken });
  assert.equal(afterLogout.status, 401, 'le jeton révoqué ne passe plus le middleware');
});

test('E2E AUTH-06 : réinitialisation de mot de passe, email réellement envoyé', async () => {
  await registerUser({ email: 'reset@agrikonnect.test' });

  const forgot = await h.request('POST', '/auth/forgot-password', { body: { email: 'reset@agrikonnect.test' } });
  assert.equal(forgot.status, 200);

  // GoTrue enverrait l'email de récupération ; le stub l'expose au test.
  const tokenHash = await h.stubRecoveryToken('reset@agrikonnect.test');
  assert.ok(tokenHash, 'jeton de récupération émis');

  // Séparation des fournisseurs : seul Supabase Auth envoie cet e-mail —
  // zéro e-mail applicatif (Resend) ne doit partir en double.
  const doublons = h.sink.messages.email.filter((m) => m.to === 'reset@agrikonnect.test');
  assert.equal(doublons.length, 0, `aucun e-mail applicatif en double : ${JSON.stringify(doublons)}`);

  const reset = await h.request('POST', '/auth/reset-password', {
    body: { tokenHash, password: 'NouveauMotDePasse!2026' },
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));

  const login = await h.request('POST', '/auth/login', {
    body: { identifier: 'reset@agrikonnect.test', password: 'NouveauMotDePasse!2026' },
  });
  assert.equal(login.status, 200, 'connexion avec le nouveau mot de passe');
});

/* ─────────────────────── V1 : FARM / PLOT ─────────────────────── */

test('E2E FARM-01 / MAP-04 : exploitation créée, coordonnées publiques arrondies', async () => {
  const token = await tokenOf('awa@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token,
    body: {
      name: 'Ferme Kivu',
      countryCode: 'CD',
      province: 'Nord-Kivu',
      latitude: -1.6789,
      longitude: 29.2234,
      totalAreaHa: 12.5,
      description: 'Exploitation familiale',
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id ?? farm.body.data.id;
  assert.ok(farmId);

  const stored = await h.prisma.farm.findUnique({ where: { id: farmId } });
  assert.equal(stored.latitude, -1.6789, 'position exacte conservée (privée)');
  assert.notEqual(stored.publicLatitude, stored.latitude, 'position publique approximée');
  assert.equal(String(stored.publicLatitude).split('.')[1]?.length <= 2, true);
});

test('E2E PLOT-01 : parcelle créée avec polygone, superficie dérivée en base', async () => {
  const token = await tokenOf('awa@agrikonnect.test');
  const farm = await h.prisma.farm.findFirst({ where: { name: 'Ferme Kivu' } });

  const response = await h.request('POST', '/plots', {
    token,
    body: {
      farmId: farm.id,
      name: 'Parcelle Nord',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [29.22, -1.68],
            [29.23, -1.68],
            [29.23, -1.67],
            [29.22, -1.67],
            [29.22, -1.68],
          ],
        ],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Nord' } });
  assert.ok(plot.areaHa > 0, 'superficie calculée depuis la géométrie');
  assert.equal(plot.geometryType, 'POLYGON');
});

/* ─────────────────── Isolation tenant (CDC A.3) ─────────────────── */

test('E2E TENANT-01 : un utilisateur ne voit ni ne modifie les données d’un autre', async () => {
  await registerUser({ email: 'intrus@agrikonnect.test', firstName: 'Jean', lastName: 'Mukendi' });
  const otherToken = await tokenOf('intrus@agrikonnect.test');

  const farm = await h.prisma.farm.findFirst({ where: { name: 'Ferme Kivu' } });
  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Nord' } });

  const readFarm = await h.request('GET', `/farms/${farm.id}`, { token: otherToken });
  assert.equal(readFarm.status, 404, 'ferme d’un autre tenant invisible');

  const readPlot = await h.request('GET', `/plots/${plot.id}`, { token: otherToken });
  assert.equal(readPlot.status, 404, 'parcelle d’un autre tenant invisible');

  const patchFarm = await h.request('PATCH', `/farms/${farm.id}`, {
    token: otherToken,
    body: { name: 'Ferme piratée' },
  });
  assert.ok([403, 404].includes(patchFarm.status), `écriture refusée (${patchFarm.status})`);

  const list = await h.request('GET', '/farms', { token: otherToken });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 0, 'la liste ne renvoie que son propre périmètre');
});

test('E2E TENANT-02 : le propriétaire, lui, accède à ses données', async () => {
  const token = await tokenOf('awa@agrikonnect.test');
  const farm = await h.prisma.farm.findFirst({ where: { name: 'Ferme Kivu' } });
  const response = await h.request('GET', `/farms/${farm.id}`, { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.name, 'Ferme Kivu');
});

/* ─────────────────────── V2 : marketplace ─────────────────────── */

test('E2E MKT-01 → ORD-01 : annonce publiée, commande créée par un autre tenant', async () => {
  const sellerToken = await tokenOf('awa@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const listing = await h.request('POST', '/listings', {
    token: sellerToken,
    body: {
      type: 'PRODUCE',
      cropId: crop.id,
      title: 'Manioc frais — 2 tonnes',
      description: 'Récolte de la semaine',
      quantity: 2000,
      unit: 'kg',
      indicativePrice: 0.45,
      currency: 'USD',
      countryCode: 'CD',
      province: 'Nord-Kivu',
    },
  });
  assert.equal(listing.status, 201, JSON.stringify(listing.body));
  const listingId = listing.body.data.id;

  const publish = await h.request('PATCH', `/listings/${listingId}/status`, {
    token: sellerToken,
    body: { status: 'PUBLISHED' },
  });
  assert.equal(publish.status, 200, JSON.stringify(publish.body));

  // Un acheteur d'une autre organisation commande.
  await registerUser({ email: 'acheteur@agrikonnect.test', accountType: 'BUYER', firstName: 'Sarah', lastName: 'Ilunga' });
  const buyerToken = await tokenOf('acheteur@agrikonnect.test');

  const order = await h.request('POST', '/orders', {
    token: buyerToken,
    headers: { 'idempotency-key': 'e2e-order-1' },
    body: { listingId, quantity: 500, unit: 'kg' },
  });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.data.status, 'PENDING');

  // ORD-03 : transition valide côté vendeur
  const accepted = await h.request('PATCH', `/orders/${order.body.data.id}/status`, {
    token: sellerToken,
    body: { status: 'ACCEPTED' },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

  // Transition interdite (saut d'étape) : la machine à états refuse en 409
  // (conflit avec l'état courant — la requête est bien formée).
  const jump = await h.request('PATCH', `/orders/${order.body.data.id}/status`, {
    token: sellerToken,
    body: { status: 'COMPLETED' },
  });
  assert.equal(jump.status, 409, JSON.stringify(jump.body));
  assert.match(jump.body.message, /ACCEPTED|DELIVERED|transition/i);

  // Aucune trace de la transition refusée dans le journal append-only.
  const afterJump = await h.request('GET', `/orders/${order.body.data.id}/events`, { token: sellerToken });
  assert.equal(afterJump.status, 200, JSON.stringify(afterJump.body));
  assert.equal(
    afterJump.body.data.events.some((event) => event.to === 'COMPLETED'),
    false,
    'une transition refusée n’écrit rien',
  );

  const events = await h.request('GET', `/orders/${order.body.data.id}/events`, { token: sellerToken });
  assert.equal(events.status, 200);
  assert.ok(events.body.data.events.length >= 2, 'journal de transitions conservé');
  assert.equal(events.body.data.appendOnly, true);
});

/* ─────────────────────── V3 : traçabilité ─────────────────────── */

test('E2E LOT-01 / TRC : lot traçable et page publique accessible sans jeton', async () => {
  const token = await tokenOf('awa@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const lot = await h.request('POST', '/lots', {
    token,
    body: { cropId: crop.id, quantityKg: 1200, publicFields: { origin: 'Nord-Kivu' } },
  });
  assert.equal(lot.status, 201, JSON.stringify(lot.body));
  const { id: lotId, code } = lot.body.data;
  assert.match(code, /^AK-[A-Z]{2}-\d{4}-\d+/, 'format de code AK-PAYS-ANNÉE-SÉQUENCE');

  const event = await h.request('POST', `/lots/${lotId}/events`, {
    token,
    body: { type: 'HARVEST', details: 'Récolte du matin', source: 'declared' },
  });
  assert.equal(event.status, 201, JSON.stringify(event.body));

  const publicPage = await h.request('GET', `/public/lots/${code}`);
  assert.equal(publicPage.status, 200);
  assert.equal(publicPage.body.data.code, code);
  assert.ok(publicPage.body.data.timeline.length >= 1, 'les étapes publiques sont visibles');
  assert.equal(publicPage.body.data.organizationId, undefined, 'aucune donnée interne exposée');
});

/* ─────────────────────── V3 : synchronisation ─────────────────────── */

test('E2E SYNC-01/02 : push idempotent, conflit explicite, pull par curseur', async () => {
  const token = await tokenOf('awa@agrikonnect.test');
  const farm = await h.prisma.farm.findFirst({ where: { name: 'Ferme Kivu' } });
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const operation = {
    opId: '01HZZZZZZZZZZZZZZZZZZZZZ01',
    collection: 'productions',
    operation: 'CREATE',
    entityId: '01HZZZZZZZZZZZZZZZZZZZZZ02',
    payload: {
      farmId: farm.id,
      cropId: crop.id,
      harvestedAt: '2026-09-01',
      season: '2026A',
      quantity: 1200,
      unit: 'kg',
      quantityKg: 1200,
    },
  };

  const push = await h.request('POST', '/sync/push', { token, body: { operations: [operation] } });
  assert.equal(push.status, 200, JSON.stringify(push.body));
  assert.equal(push.body.data.results[0].result, 'APPLIED');

  const replay = await h.request('POST', '/sync/push', { token, body: { operations: [operation] } });
  assert.equal(replay.body.data.results[0].result, 'DUPLICATE', 'rejeu hors-ligne sans doublon');

  const conflict = await h.request('POST', '/sync/push', {
    token,
    body: {
      operations: [
        {
          opId: '01HZZZZZZZZZZZZZZZZZZZZZ03',
          collection: 'productions',
          operation: 'UPDATE',
          entityId: '01HZZZZZZZZZZZZZZZZZZZZZ02',
          baseVersion: 99,
          payload: { quantity: 1300 },
        },
      ],
    },
  });
  assert.equal(conflict.body.data.results[0].result, 'CONFLICT', 'version obsolète signalée, jamais écrasée');

  const pull = await h.request('GET', '/sync/pull?since=2026-01-01T00:00:00.000Z&collections=productions', { token });
  assert.equal(pull.status, 200);
  assert.ok(pull.body.data.changes.productions.length >= 1);
  assert.ok(pull.body.data.cursor);
});

/* ─────────────────────── V4 : data room ─────────────────────── */

test('E2E DR-01/02 : accès fermé par défaut, ouvert après décision du porteur', async () => {
  const ownerToken = await tokenOf('awa@agrikonnect.test');

  const project = await h.request('POST', '/projects', {
    token: ownerToken,
    body: {
      title: 'Extension manioc Kivu',
      sector: 'AGRICULTURE',
      countryCode: 'CD',
      description: 'Extension de 20 ha',
      fundingNeed: { amount: 250000, currency: 'USD' },
      durationMonths: 24,
      impact: { jobsCreated: 40, hectaresConverted: 20 },
      milestones: [
        { label: 'Préparation du terrain', month: 3 },
        { label: 'Première récolte', month: 12 },
      ],
    },
  });
  assert.equal(project.status, 201, JSON.stringify(project.body));
  const projectId = project.body.data.id;

  // PRJ-01 : un projet n'est public qu'après soumission puis revue administrative.
  const submitted = await h.request('POST', `/projects/${projectId}/submit`, { token: ownerToken });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

  // L'auto-publication est refusée par le serveur (pas seulement par l'UI).
  const selfPublish = await h.request('PATCH', `/projects/${projectId}`, {
    token: ownerToken,
    body: { status: 'PUBLISHED' },
  });
  assert.ok([400, 403, 422].includes(selfPublish.status), `auto-publication refusée (${selfPublish.status})`);

  await registerUser({ email: 'revue@agrikonnect.test', firstName: 'Revue', lastName: 'Plateforme' });
  const reviewer = await h.prisma.profile.findFirst({ where: { email: 'revue@agrikonnect.test' } });
  await h.prisma.membership.updateMany({ where: { userId: reviewer.id }, data: { roles: ['VERIFIER'] } });
  const reviewerToken = await tokenOf('revue@agrikonnect.test');

  const reviewed = await h.request('PATCH', `/projects/${projectId}/review`, {
    token: reviewerToken,
    body: { decision: 'PUBLISHED', comment: 'Dossier complet et sourcé' },
  });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));

  const doc = await h.request('POST', `/dataroom/projects/${projectId}/documents`, {
    token: ownerToken,
    body: { name: 'business-plan.pdf', category: 'BUSINESS_PLAN', storageKey: 'private/bp.pdf' },
  });
  assert.equal(doc.status, 201, JSON.stringify(doc.body));
  const documentId = doc.body.data.id ?? doc.body.data.document?.id;

  await registerUser({ email: 'invest@agrikonnect.test', accountType: 'INVESTOR', firstName: 'Fonds', lastName: 'Sahel' });
  const investorToken = await tokenOf('invest@agrikonnect.test');

  const denied = await h.request('GET', `/dataroom/documents/${documentId}`, { token: investorToken });
  assert.ok([403, 404].includes(denied.status), `accès refusé sans autorisation (${denied.status})`);

  const request = await h.request('POST', `/dataroom/projects/${projectId}/access-requests`, {
    token: investorToken,
    body: {
      scope: { categories: ['BUSINESS_PLAN'], download: false },
      justification: 'Due diligence préalable à une prise de participation',
      requestedDays: 7,
    },
  });
  assert.ok([200, 201].includes(request.status), JSON.stringify(request.body));

  // DR-02 : la justification est obligatoire (aucun accès « à l'aveugle »).
  const unjustified = await h.request('POST', `/dataroom/projects/${projectId}/access-requests`, {
    token: investorToken,
    body: { scope: { categories: ['BUSINESS_PLAN'] }, justification: 'court' },
  });
  assert.equal(unjustified.status, 422, JSON.stringify(unjustified.body));

  const grant = await h.request('PATCH', `/dataroom/access-requests/${request.body.data.id}`, {
    token: ownerToken,
    body: {
      decision: 'GRANTED',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      downloadAllowed: false,
    },
  });
  assert.equal(grant.status, 200, JSON.stringify(grant.body));

  const granted = await h.request('GET', `/dataroom/documents/${documentId}`, { token: investorToken });
  assert.equal(granted.status, 200, JSON.stringify(granted.body));

  const log = await h.prisma.dataRoomAccessLog.findFirst({ where: { projectId } });
  assert.ok(log, 'chaque consultation est journalisée');
  assert.equal(log.userId.length > 0, true);
});

/* ─────────────────────── V5 : API publique ─────────────────────── */

test('E2E API-01/02 : clé émise une seule fois, hachée en base, scopes respectés', async () => {
  // Un administrateur de plateforme est nécessaire : on l'insère en base,
  // comme le ferait un script d'exploitation (aucun endpoint ne crée d'admin).
  const admin = await registerUser({ email: 'admin@agrikonnect.test', firstName: 'Admin', lastName: 'Plateforme' });
  await h.prisma.membership.updateMany({
    where: { userId: admin.user.id },
    data: { roles: ['SUPER_ADMIN'] },
  });
  const adminToken = await tokenOf('admin@agrikonnect.test');

  const client = await h.request('POST', '/api-clients/clients', {
    token: adminToken,
    body: {
      name: 'Observatoire partenaire',
      scopes: ['prices:read', 'aggregates:read'],
      dataPurpose: 'Suivi trimestriel des prix agricoles pour l’observatoire régional',
    },
  });
  assert.equal(client.status, 201, JSON.stringify(client.body));
  const clientId = client.body.data.client?.id ?? client.body.data.id;

  // API-03 : la finalité doit être approuvée avant toute émission de clé.
  const premature = await h.request('POST', `/api-clients/clients/${clientId}/keys`, {
    token: adminToken,
    body: { label: 'clé prématurée' },
  });
  assert.equal(premature.status, 403, 'pas de clé sans finalité approuvée');

  const approval = await h.request('PATCH', `/api-clients/clients/${clientId}/purpose`, {
    token: adminToken,
    body: { decision: 'APPROVED', comment: 'Finalité conforme au contrat de données' },
  });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));

  const key = await h.request('POST', `/api-clients/clients/${clientId}/keys`, {
    token: adminToken,
    body: { label: 'clé principale' },
  });
  assert.equal(key.status, 201, JSON.stringify(key.body));
  const rawKey = key.body.data.apiKey ?? key.body.data.key;
  assert.ok(rawKey, 'clé brute renvoyée une seule fois');

  const stored = await h.prisma.apiKey.findFirst({ where: { clientId } });
  assert.notEqual(stored.keyHash, rawKey, 'la clé n’est pas stockée en clair');

  const prices = await h.request('GET', '/public-api/v1/prices', { headers: { 'x-api-key': rawKey } });
  assert.ok([200, 404].includes(prices.status), `appel autorisé (${prices.status})`);

  // `/farmers` exige `data:read`, absent des scopes accordés → 403.
  const forbidden = await h.request('GET', '/public-api/v1/farmers', {
    headers: { 'x-api-key': rawKey },
  });
  assert.equal(forbidden.status, 403, 'scope manquant refusé');

  const withoutKey = await h.request('GET', '/public-api/v1/prices');
  assert.equal(withoutKey.status, 401);
});

/* ─────────────────────── Sécurité ─────────────────────── */

test('E2E SEC : injection SQL neutralisée, jeton invalide rejeté, corps trop gros refusé', async () => {
  const token = await tokenOf('awa@agrikonnect.test');

  const injection = await h.request(
    "GET",
    `/farms?search=${encodeURIComponent("' OR 1=1; DROP TABLE farms; --")}`,
    { token },
  );
  assert.equal(injection.status, 200, 'la requête est paramétrée, pas concaténée');
  const farmsStillThere = await h.prisma.farm.count();
  assert.ok(farmsStillThere > 0, 'aucune table supprimée');

  const badToken = await h.request('GET', '/me', { token: 'jeton.completement.faux' });
  assert.equal(badToken.status, 401);

  const huge = await h.request('POST', '/farms', {
    token,
    body: { name: 'x'.repeat(2_000_000), countryCode: 'CD' },
  });
  assert.equal(huge.status, 413, 'limite de taille appliquée par le middleware');
});

/* ─────────────────────── Tâches planifiées ─────────────────────── */

test('E2E MKT-06 : le job d’expiration agit sur les données réelles', async () => {
  const token = await tokenOf('awa@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const listing = await h.request('POST', '/listings', {
    token,
    body: {
      type: 'PRODUCE',
      cropId: crop.id,
      title: 'Annonce à expirer',
      quantity: 100,
      unit: 'kg',
      countryCode: 'CD',
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  });
  const listingId = listing.body.data.id;
  await h.request('PATCH', `/listings/${listingId}/status`, { token, body: { status: 'PUBLISHED' } });

  const { runJob } = await import('../../src/jobs/index.js');
  const outcome = await runJob('listings.expire');
  assert.equal(outcome.ok, true);
  assert.ok(outcome.result.expired >= 1);

  const stored = await h.prisma.listing.findUnique({ where: { id: listingId } });
  assert.equal(stored.status, 'EXPIRED');
});
