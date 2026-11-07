import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startHarness } from './support/harness.mjs';

/**
 * Recette de bout en bout — **base réelle** — canaux, MFA, QR public, appels
 * d'offres et supervision des tâches planifiées.
 *
 * Ces parcours touchent des mécanismes que les doubles en mémoire ne peuvent pas
 * valider : chiffrement AES-256-GCM d'un secret TOTP réellement stocké en base,
 * signature HMAC d'un webhook Meta, rendu binaire d'un QR, sérialisation d'une
 * offre scellée, et exécution d'une tâche de fond sur les vraies tables.
 */

let h;
const PASSWORD = 'MotDePasse!2026';

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila' }) => {
  const response = await h.request('POST', '/auth/register', {
    body: { accountType, firstName, lastName, email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const connect = async (email, mfaCode) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD, ...(mfaCode ? { mfaCode } : {}) },
  });
  return response;
};

const tokenOf = async (email, mfaCode) => {
  const response = await connect(email, mfaCode);
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

const makeAdmin = async (email) => {
  await register({ email, firstName: 'Admin', lastName: 'Plateforme' });
  const profile = await h.prisma.profile.findFirst({ where: { email } });
  await h.prisma.membership.updateMany({ where: { userId: profile.id }, data: { roles: ['SUPER_ADMIN'] } });
  return { id: profile.id, token: await tokenOf(email) };
};

before(async () => {
  h = await startHarness();
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ───────────────────────────── NFR-01 — MFA ───────────────────────────── */

test('E2E NFR-01 : MFA TOTP réelle — enrôlement, exigence à la connexion, codes de secours', async () => {
  await register({ email: 'mfa@agrikonnect.test', firstName: 'Mireille', lastName: 'Tshibola' });
  const token = await tokenOf('mfa@agrikonnect.test');

  const status = await h.request('GET', '/auth/mfa/status', { token });
  assert.equal(status.status, 200, JSON.stringify(status.body));
  assert.equal(status.body.data.mfaEnabled, false, 'MFA désactivée par défaut');

  const setup = await h.request('POST', '/auth/mfa/setup', { token });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  const { secret, otpauthUrl } = setup.body.data;
  assert.match(secret, /^[A-Z2-7]+=*$/, 'secret base32');
  assert.match(otpauthUrl, /^otpauth:\/\/totp\/.+\?secret=/);

  // Le secret est chiffré en base : il n'est jamais relisible par un tiers.
  const stored = await h.prisma.mfaSecret.findFirst({ where: { userId: status.body.data.userId } });
  assert.ok(stored, 'enrôlement persisté');
  assert.notEqual(stored.secretHash, secret, 'secret non stocké en clair');
  assert.equal(stored.confirmedAt, null, 'non actif avant confirmation');

  // Un code faux n'active rien.
  const wrong = await h.request('POST', '/auth/mfa/confirm', { token, body: { code: '000000' } });
  assert.ok([401, 422].includes(wrong.status), `code faux refusé (${wrong.status})`);

  const { currentCode } = await import('../../src/modules/auth/mfa.service.js');
  const confirmed = await h.request('POST', '/auth/mfa/confirm', { token, body: { code: currentCode(secret) } });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.mfaEnabled, true);
  assert.equal(confirmed.body.data.backupCodes.length, 8, 'huit codes de secours à usage unique');

  // Les codes de secours sont hachés, jamais stockés en clair.
  const afterConfirm = await h.prisma.mfaSecret.findFirst({ where: { userId: status.body.data.userId } });
  assert.equal(afterConfirm.backupCodesHashes.length, 8);
  assert.equal(afterConfirm.backupCodesHashes.includes(confirmed.body.data.backupCodes[0]), false);

  // NFR-01 : le mot de passe seul ne suffit plus.
  const withoutCode = await connect('mfa@agrikonnect.test');
  assert.equal(withoutCode.status, 401, JSON.stringify(withoutCode.body));
  assert.match(withoutCode.body.message, /double authentification/i, 'MFA exigée signalée');

  // Code TOTP courant : session délivrée.
  const withCode = await connect('mfa@agrikonnect.test', currentCode(secret));
  assert.equal(withCode.status, 200, JSON.stringify(withCode.body));

  // Un code de secours fonctionne une seule fois.
  const backup = confirmed.body.data.backupCodes[0];
  const firstUse = await connect('mfa@agrikonnect.test', backup);
  assert.equal(firstUse.status, 200, 'code de secours accepté');
  const secondUse = await connect('mfa@agrikonnect.test', backup);
  assert.equal(secondUse.status, 401, 'code de secours à usage unique');
});

/* ─────────────────────── PUB-03 — QR public (PNG / SVG) ─────────────────────── */

test('E2E PUB-03 : le QR public est produit côté serveur, en PNG et en SVG', async () => {
  await register({ email: 'qr@agrikonnect.test', firstName: 'Rachel', lastName: 'Kavira' });
  const token = await tokenOf('qr@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token,
    body: {
      name: 'Ferme QR Kivu',
      countryCode: 'CD',
      province: 'Nord-Kivu',
      latitude: -1.6789,
      longitude: 29.2234,
      totalAreaHa: 4,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;
  const slug = farm.body.data.slug ?? farm.body.data.farm?.slug;
  assert.ok(slug, 'slug public attribué');

  // PUB-01 : la publication exige une identité vérifiée (téléphone ou email).
  const otp = await h.request('POST', '/auth/send-otp', { token, body: { phone: '+243900000555' } });
  assert.equal(otp.status, 200, JSON.stringify(otp.body));
  const code = h.sink.lastOtpFor('+243900000555');
  assert.ok(code, 'code OTP réellement envoyé au prestataire SMS');
  const verified = await h.request('POST', '/auth/verify-phone', {
    token,
    body: { phone: '+243900000555', code },
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));

  // PUB-01/05 : c'est le producteur qui publie son profil ; sans publication, 404.
  const beforePublish = await h.request('GET', `/public/farms/${slug}/qr.png`, { raw: true });
  assert.equal(beforePublish.status, 404, 'profil non publié ⇒ pas de QR public');

  const published = await h.request('PATCH', `/farms/${farmId}/publish`, { token, body: { isPublic: true } });
  assert.equal(published.status, 200, JSON.stringify(published.body));

  const png = await h.request('GET', `/public/farms/${slug}/qr.png`, { raw: true });
  assert.equal(png.status, 200);
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.equal(png.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'signature PNG réelle');

  const svg = await h.request('GET', `/public/farms/${slug}/qr.svg`, { raw: true });
  assert.equal(svg.status, 200);
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
  assert.match(svg.buffer.toString('utf8'), /<svg[\s>]/);

  // PUB-05 : une exploitation non vérifiée n'est pas indexable, et c'est dit.
  const page = await h.request('GET', `/public/farms/${slug}`);
  assert.equal(page.status, 200, JSON.stringify(page.body));
  const projection = page.body.data.farm ?? page.body.data;
  assert.equal(projection.seo.indexable, false, 'non vérifié ⇒ non indexable');
  assert.equal(projection.seo.robots, 'noindex,follow');
  assert.equal(projection.latitude, undefined, 'coordonnées exactes jamais publiées');
  assert.equal(projection.contact?.phone ?? null, null, 'numéro non exposé sans accord');

  // Un slug inconnu reste un 404, pas une page blanche indexable.
  const missing = await h.request('GET', '/public/farms/inconnu-xyz/qr.png', { raw: true });
  assert.equal(missing.status, 404);
});

/* ───────────────────────── USSD-01 / WA-01 — canaux ───────────────────────── */

test('E2E USSD-01 : menu pas à pas, réponses courtes, session et messages journalisés', async () => {
  const menu = await h.request('POST', '/channels/ussd', {
    body: { phoneNumber: '+243900000777', text: '', countryCode: 'CD' },
  });
  assert.equal(menu.status, 200, JSON.stringify(menu.body));
  assert.ok(menu.body.data.ussdResponse.length <= 182, 'réponse compatible agrégateur (≤ 182 caractères)');
  assert.match(menu.body.data.ussdResponse, /1\. Prix/);
  assert.equal(menu.body.data.end, false);

  const prices = await h.request('POST', '/channels/ussd', {
    body: { phoneNumber: '+243900000777', text: '1', countryCode: 'CD' },
  });
  assert.equal(prices.status, 200);
  assert.ok(prices.body.data.body.length <= 182);

  const quit = await h.request('POST', '/channels/ussd', {
    body: { phoneNumber: '+243900000777', text: '0', countryCode: 'CD' },
  });
  assert.equal(quit.body.data.end, true, 'menu 0 clôt la session');
  assert.equal(quit.body.data.state, 'CLOSED');

  // Chaque interaction est journalisée (aucune boîte noire).
  const sessions = await h.prisma.channelSession.findMany({ where: { phone: '+243900000777', channel: 'USSD' } });
  assert.equal(sessions.length, 1, 'une session par numéro');
  const messages = await h.prisma.channelMessage.findMany({ where: { phone: '+243900000777' } });
  assert.equal(messages.length, 6, 'trois entrées + trois sorties');
  assert.deepEqual(
    [...new Set(messages.map((m) => m.direction))].sort(),
    ['IN', 'OUT'],
  );
});

test('E2E WA-01 : webhook WhatsApp vérifié par jeton puis par signature', async () => {
  const verify = await h.request(
    'GET',
    '/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=e2e-verify-token&hub.challenge=12345',
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.body));
  assert.equal(String(verify.body).trim(), '12345', 'le défi Meta est renvoyé tel quel');

  const badToken = await h.request(
    'GET',
    '/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=12345',
  );
  assert.equal(badToken.status, 403, 'jeton de vérification refusé');

  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ from: '243900000888', type: 'text', text: { body: 'prix manioc' } }],
            },
          },
        ],
      },
    ],
  };
  const rawBody = JSON.stringify(payload);

  // Signature absente ou fausse : le webhook refuse (401/403), jamais de traitement.
  const unsigned = await fetch(`${h.urls.baseUrl}/channels/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  assert.equal(unsigned.status, 403, 'signature absente refusée');

  const wrongSignature = await fetch(`${h.urls.baseUrl}/channels/whatsapp/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${'a'.repeat(64)}`,
    },
    body: rawBody,
  });
  assert.equal(wrongSignature.status, 403, 'signature invalide refusée');

  const signature = crypto.createHmac('sha256', 'e2e-app-secret').update(rawBody).digest('hex');
  const signed = await fetch(`${h.urls.baseUrl}/channels/whatsapp/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
    },
    body: rawBody,
  });
  assert.equal(signed.status, 200, 'signature valide acceptée');
  const signedBody = await signed.json();
  assert.ok(signedBody.data, 'accusé de réception');

  const inbound = await h.prisma.channelMessage.findFirst({
    where: { channel: 'WHATSAPP', phone: '243900000888', direction: 'IN' },
  });
  assert.ok(inbound, 'message entrant journalisé');
});

/* ─────────────────────── PRC-10 — appels d'offres scellés ─────────────────────── */

test('E2E PRC-10 : appel d’offres public, réponses scellées, une réponse par offre', async () => {
  await register({ email: 'acheteur@ao.test', accountType: 'BUYER', firstName: 'Béatrice', lastName: 'Lokole' });
  await register({ email: 'soumissionnaire@ao.test', accountType: 'SUPPLIER', firstName: 'Serge', lastName: 'Mbala' });
  await register({ email: 'concurrent@ao.test', accountType: 'SUPPLIER', firstName: 'Céline', lastName: 'Ilunga' });

  const buyerToken = await tokenOf('acheteur@ao.test');
  const sellerToken = await tokenOf('soumissionnaire@ao.test');
  const rivalToken = await tokenOf('concurrent@ao.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const tender = await h.request('POST', '/tenders', {
    token: buyerToken,
    body: {
      title: 'Achat de 50 tonnes de manioc — Kinshasa',
      description: 'Livraison en deux lots, qualité marchande',
      cropId: crop.id,
      quantity: 50000,
      unit: 'kg',
      destinationCountry: 'CD',
      deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    },
  });
  assert.equal(tender.status, 201, JSON.stringify(tender.body));
  const tenderId = tender.body.data.id;
  assert.equal(tender.body.data.status, 'OPEN', 'ouvert dès la publication');

  const listed = await h.request('GET', '/tenders', { token: sellerToken });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.some((item) => item.id === tenderId), 'visible par les soumissionnaires');

  const response = await h.request('POST', `/tenders/${tenderId}/responses`, {
    token: sellerToken,
    body: { quantity: 50000, unit: 'kg', price: 0.38, currency: 'USD', conditions: 'Livraison en 10 jours' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const duplicate = await h.request('POST', `/tenders/${tenderId}/responses`, {
    token: sellerToken,
    body: { quantity: 40000, unit: 'kg', price: 0.35, currency: 'USD' },
  });
  assert.equal(duplicate.status, 409, 'une seule réponse par organisation');

  // Scellé : un concurrent ne voit pas l'offre de l'autre.
  const seenByRival = await h.request('GET', `/tenders/${tenderId}`, { token: rivalToken });
  assert.equal(seenByRival.status, 200);
  const rivalView = JSON.stringify(seenByRival.body.data);
  assert.equal(rivalView.includes('0.38'), false, 'montant d’un concurrent jamais exposé');
  assert.equal(seenByRival.body.data.responses?.length ?? 0, 0, 'aucune réponse visible avant attribution');

  // Le porteur, lui, arbitre et attribue.
  const detailed = await h.request('GET', `/tenders/${tenderId}`, { token: buyerToken });
  assert.equal(detailed.body.data.responses.length, 1, 'le porteur voit les réponses');
  const award = await h.request('POST', `/tenders/${tenderId}/award`, {
    token: buyerToken,
    body: { responseId: detailed.body.data.responses[0].id },
  });
  assert.equal(award.status, 200, JSON.stringify(award.body));
  assert.equal(award.body.data.tender.status, 'AWARDED');

  // Après attribution, plus aucune réponse n'est acceptée.
  const late = await h.request('POST', `/tenders/${tenderId}/responses`, {
    token: rivalToken,
    body: { quantity: 1000, unit: 'kg', price: 0.5, currency: 'USD' },
  });
  assert.equal(late.status, 409, 'appel clôturé : réponse refusée');
});

/* ─────────────── V5 — supervision et exécution des tâches planifiées ─────────────── */

test('E2E V5 jobs : supervision réservée à l’administration, exécution réelle', async () => {
  const admin = await makeAdmin('ops@agrikonnect.test');

  const list = await h.request('GET', '/admin/jobs', { token: admin.token });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const jobs = list.body.data.jobs;
  const names = jobs.map((job) => job.name);
  assert.ok(names.includes('listings.expire'), 'tâche d’expiration supervisée');
  assert.ok(names.includes('orders.expirePending'), 'tâche de clôture supervisée');
  assert.ok(names.length >= 6, 'toutes les tâches du planificateur sont supervisées');
  assert.ok(jobs.every((job) => 'lastRunAt' in job && 'lastResult' in job), 'état exposé');
  assert.equal(list.body.data.enabled, false, 'planificateur arrêté en environnement de test');

  const run = await h.request('POST', '/admin/jobs/listings.expire/run', { token: admin.token });
  assert.equal(run.status, 200, JSON.stringify(run.body));
  assert.equal(run.body.data.ok, true, JSON.stringify(run.body.data));
  assert.ok('result' in run.body.data, 'compte-rendu d’exécution');

  const unknown = await h.request('POST', '/admin/jobs/job.inexistant/run', { token: admin.token });
  assert.equal(unknown.status, 404, JSON.stringify(unknown.body));

  // Un producteur n'a aucun accès à la supervision des tâches.
  const farmerToken = await tokenOf('qr@agrikonnect.test');
  const forbidden = await h.request('GET', '/admin/jobs', { token: farmerToken });
  assert.equal(forbidden.status, 403);
});
