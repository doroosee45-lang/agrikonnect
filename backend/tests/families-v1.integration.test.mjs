import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import { can } from '../src/shared/permissions.js';
import { notify } from '../src/shared/events.js';
import * as registerSchemaModule from '../src/modules/auth/auth.schema.js';
import * as plotsService from '../src/modules/plots/plots.service.js';
import * as productionsService from '../src/modules/productions/productions.service.js';
import * as cooperativesService from '../src/modules/cooperatives/cooperatives.service.js';
import * as publicService from '../src/modules/public/public.service.js';
import * as verificationService from '../src/modules/verification/verification.service.js';
import * as transportService from '../src/modules/transport/transport.service.js';
import * as iotService from '../src/modules/iot/iot.service.js';
import * as investorsService from '../src/modules/investors/investors.service.js';
import * as fxService from '../src/modules/countries/fx.service.js';
import * as usersService from '../src/modules/users/users.service.js';

/**
 * Preuves d'acceptation V1 → V5 — seconde série.
 *
 * Couvre les familles restantes : identité (AUTH, PROF), socle agricole
 * (PLOT, PROD), coopératives (COOP), publication (PUB, MAP), vérification (VER),
 * transport (TRA), notifications (NOTIF), objets connectés (IOT),
 * investisseurs (INV) et taux de change (FX).
 */

const ORG = 'org_1';
const OTHER = 'org_2';

const reqAs = (organizationId = ORG, roles = ['FARMER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const baseStore = (overrides = {}) => ({
  crop: [],
  plot: [],
  farm: [],
  production: [],
  notification: [],
  notificationPreference: [],
  auditLog: [],
  membership: [],
  profile: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

// ─── AUTH ──────────────────────────────────────────────────────────────────

test('AUTH-01 : le contrat d’inscription refuse un email invalide et un mot de passe faible', () => {
  const schema = registerSchemaModule.registerSchema ?? registerSchemaModule.default;
  const base = {
    accountType: 'FARMER',
    firstName: 'Awa',
    lastName: 'Kabila',
    countryCode: 'CD',
    phone: '+243810000000',
    password: 'MotDePasse123!',
  };

  assert.equal(schema.safeParse({ ...base, email: 'pas-un-email' }).success, false, 'email invalide');
  assert.equal(schema.safeParse({ ...base, email: 'awa@example.cd', password: '123' }).success, false, 'mot de passe trop court');
  assert.equal(schema.safeParse({ ...base, phone: '0810000000' }).success, false, 'téléphone non international');
  assert.equal(schema.safeParse({ ...base, email: 'awa@example.cd' }).success, true);
});

test('AUTH-02 : un pays hors référentiel ISO est refusé au contrat', () => {
  const schema = registerSchemaModule.registerSchema ?? registerSchemaModule.default;
  const result = schema.safeParse({
    accountType: 'FARMER',
    email: 'awa@example.cd',
    password: 'MotDePasse123!',
    firstName: 'Awa',
    lastName: 'Kabila',
    countryCode: 'CONGO',
  });

  assert.equal(result.success, false);
});

test('PROF-03 : les permissions effectives découlent du rôle, jamais du client', async () => {
  const farmer = await usersService.getMyPermissions(reqAs(ORG, ['FARMER']));
  assert.ok(farmer.permissions.includes('farms.write'));
  assert.ok(!farmer.permissions.includes('admin.users'), 'un producteur n’a aucun droit d’administration');
  assert.ok(!farmer.permissions.includes('verifications.review'));

  const admin = await usersService.getMyPermissions(reqAs(ORG, ['ADMIN']));
  assert.ok(admin.permissions.includes('admin.users'));
  assert.ok(admin.permissions.includes('verifications.review'),
    'la revue de vérification est réservée à l’administration');
});

// ─── RBAC ──────────────────────────────────────────────────────────────────

test('CROP-01 : le référentiel des cultures est lisible par tous, modifiable par l’administration seule', () => {
  assert.equal(can(['FARMER'], 'crops.read'), true);
  assert.equal(can(['VISITOR'], 'crops.read'), true);
  assert.equal(can(['FARMER'], 'crops.write'), false);
  assert.equal(can(['ADMIN'], 'crops.write'), true);
});

test('CROP-02 : l’administration ne peut pas écrire le référentiel sans être authentifiée comme telle', () => {
  assert.equal(can([], 'crops.write'), false);
  assert.equal(can(['SUPPORT_AGENT'], 'crops.write'), false);
});

// ─── PLOT / PROD ───────────────────────────────────────────────────────────

test('PLOT-01 : une parcelle d’une autre exploitation est introuvable (404, pas 403)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_other', organizationId: OTHER, deletedAt: null }],
      plot: [],
    }),
  );
  try {
    await expectStatus(
      plotsService.create(
        { farmId: 'farm_other', name: 'Parcelle est', areaHa: 2.5, latitude: 0, longitude: 20 },
        reqAs(),
      ),
      404,
    );
  } finally {
    restore();
  }
});

test('PROD-01 : une parcelle rattachée à une autre exploitation est refusée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_1', organizationId: ORG, deletedAt: null }],
      plot: [{ id: 'plot_other', organizationId: OTHER, farmId: 'farm_1', deletedAt: null }],
      crop: [{ id: 'crop_1', slug: 'mais', deletedAt: null }],
    }),
  );
  try {
    await expectStatus(
      productionsService.create(
        { farmId: 'farm_1', plotId: 'plot_other', cropId: 'crop_1', quantity: 100, unit: 'kg', harvestedAt: '2026-09-01' },
        reqAs(),
      ),
      404,
    );
  } finally {
    restore();
  }
});

test('PROD-02 : une culture hors référentiel ne peut pas être déclarée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_1', organizationId: ORG, deletedAt: null }],
      crop: [],
    }),
  );
  try {
    await expectStatus(
      productionsService.create(
        { farmId: 'farm_1', cropId: 'crop_inconnu', quantity: 100, unit: 'kg', harvestedAt: '2026-09-01' },
        reqAs(),
      ),
      422,
      /Culture inconnue/,
    );
  } finally {
    restore();
  }
});

// ─── COOP ──────────────────────────────────────────────────────────────────

test('COOP-02 : un membre inexistant ne peut pas être ajouté à une coopérative', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      cooperative: [{ id: 'coop_1', organizationId: ORG, name: 'Coop Kivu', deletedAt: null }],
      cooperativeMember: [],
      profile: [],
    }),
  );
  try {
    await expectStatus(
      cooperativesService.addMember('coop_1', { identifier: 'inconnu@example.cd' }, reqAs(ORG, ['COOPERATIVE_ADMIN'])),
      404,
      /Aucun compte/,
    );
  } finally {
    restore();
  }
});

// ─── PUB / MAP ─────────────────────────────────────────────────────────────

test('MAP-01 : la carte publique n’expose que les coordonnées arrondies', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          name: 'Ferme Kivu',
          slug: 'ferme-kivu',
          countryCode: 'CD',
          province: 'Nord-Kivu',
          latitude: -1.67891,
          longitude: 29.22345,
          publicLatitude: -1.68,
          publicLongitude: 29.22,
          isPublic: true,
          deletedAt: null,
          crops: [],
        },
      ],
    }),
  );
  try {
    const result = await publicService.map({});
    assert.equal(result.type, 'FeatureCollection');
    const [lng, lat] = result.features[0].geometry.coordinates;
    assert.equal(lat, -1.68);
    assert.equal(lng, 29.22);
    assert.equal(result.features[0].properties.slug, 'ferme-kivu');
    assert.ok(!('latitude' in result.features[0].properties), 'la position exacte n’est jamais publiée');
  } finally {
    restore();
  }
});

test('MAP-02 : une bbox malformée est refusée explicitement', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(publicService.map({ bbox: 'n’importe quoi' }), 422, /bbox/);
  } finally {
    restore();
  }
});

test('PUB-01 : un profil public non publié reste introuvable', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_1', organizationId: ORG, slug: 'ferme-privee', isPublic: false, deletedAt: null }],
    }),
  );
  try {
    await expectStatus(publicService.getFarmBySlug('ferme-privee', { headers: {} }), 404);
  } finally {
    restore();
  }
});

// ─── VER ───────────────────────────────────────────────────────────────────

test('VER-01 : une seconde demande de vérification en attente est refusée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_1', organizationId: ORG, deletedAt: null }],
      verification: [
        { id: 'ver_1', subjectType: 'FARM', subjectId: 'farm_1', organizationId: ORG, level: 'BASIC', status: 'PENDING' },
      ],
      document: [],
    }),
  );
  try {
    await expectStatus(
      verificationService.submit({ subjectType: 'FARM', subjectId: 'farm_1', level: 'BASIC', documentIds: [] }, reqAs()),
      409,
      /déjà en cours/,
    );
  } finally {
    restore();
  }
});

// ─── TRA ───────────────────────────────────────────────────────────────────

test('TRA-03 : la preuve de livraison est réservée au transporteur assigné', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      transportRequest: [
        { id: 'trp_1', requesterOrgId: ORG, transporterOrgId: OTHER, status: 'IN_TRANSIT' },
      ],
    }),
  );
  try {
    await expectStatus(
      transportService.proofOfDelivery(
        'trp_1',
        { photos: ['https://cdn.example/pod.jpg'], receiverName: 'Awa' },
        reqAs(),
      ),
      403,
      /transporteur assigné/,
    );
  } finally {
    restore();
  }
});

// ─── NOTIF ─────────────────────────────────────────────────────────────────

test('NOTIF-03 : un canal désactivé par l’utilisateur ne reçoit rien', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      notificationPreference: [
        {
          id: 'pref_1',
          userId: 'user_1',
          type: 'message.received',
          channel: 'IN_APP',
          enabled: false,
        },
      ],
    }),
  );
  try {
    const created = await notify({
      userId: 'user_1',
      type: 'message.received',
      title: 'Nouveau message',
      channels: ['IN_APP'],
    });

    assert.deepEqual(created, []);
    assert.equal(fake._store.notification.length, 0, 'aucune notification créée sur un canal désactivé');
  } finally {
    restore();
  }
});

test('NOTIF-01 : une notification est créée sur un canal activé, avec sa préférence respectée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore());
  try {
    const created = await notify({ userId: 'user_1', type: 'order.accepted', title: 'Commande acceptée' });
    assert.equal(created.length, 1);
    assert.equal(fake._store.notification[0].channel, 'IN_APP');
  } finally {
    restore();
  }
});

// ─── IOT ───────────────────────────────────────────────────────────────────

test('IOT-01 : la clé d’appareil est affichée une fois et stockée hachée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore({ iotDevice: [], plot: [] }));
  try {
    const result = await iotService.register({ label: 'Sonde A', thresholds: { soilMoisture: 20 } }, reqAs());

    assert.match(result.deviceKey, /^iot_/);
    assert.match(result.warning, /une seule fois/i);

    const stored = fake._store.iotDevice[0];
    assert.equal(stored.keyHash.length, 64, 'empreinte SHA-256');
    assert.ok(!JSON.stringify(stored).includes(result.deviceKey), 'la clé en clair n’est pas persistée');
  } finally {
    restore();
  }
});

test('IOT-02 : un appareil présenté avec une mauvaise clé est rejeté', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({ iotDevice: [], sensorReading: [] }),
  );
  try {
    await expectStatus(
      iotService.ingest({ deviceKey: 'iot_inconnue', readings: [{ metric: 'soilMoisture', value: 20, at: new Date() }] }, { headers: {} }),
      401,
      /invalide/,
    );
  } finally {
    restore();
  }
});

// ─── INV ───────────────────────────────────────────────────────────────────

test('INV-02 : un investisseur non vérifié n’accède pas aux données d’investissement', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      investorProfile: [{ id: 'ip_1', userId: 'user_1', verifiedAt: null, mfaEnabled: false }],
    }),
  );
  try {
    await expectStatus(investorsService.assertInvestorReady('user_1'), 403, /non vérifié/);
  } finally {
    restore();
  }
});

test('INV-02 : la MFA est exigée même pour un investisseur vérifié', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      investorProfile: [{ id: 'ip_1', userId: 'user_1', verifiedAt: new Date(), mfaEnabled: false }],
    }),
  );
  try {
    await expectStatus(investorsService.assertInvestorReady('user_1'), 403, /multifacteur/);
  } finally {
    restore();
  }
});

// ─── FX ────────────────────────────────────────────────────────────────────

test('FX-01 : un taux nul ou négatif est refusé', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ fxRate: [] }));
  try {
    await expectStatus(
      fxService.record({ base: 'USD', quote: 'CDF', rate: 0, asOf: new Date().toISOString(), source: 'BCC' }, reqAs(ORG, ['ADMIN'])),
      422,
      /strictement positif/,
    );
  } finally {
    restore();
  }
});

test('FX-02 : une date de cotation future est refusée', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ fxRate: [] }));
  try {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await expectStatus(
      fxService.record({ base: 'USD', quote: 'CDF', rate: 2800, asOf: future, source: 'BCC' }, reqAs(ORG, ['ADMIN'])),
      422,
      /futur/,
    );
  } finally {
    restore();
  }
});

test('FX-03 : une cotation identique rejouée ne crée pas de doublon', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore({ fxRate: [] }));
  try {
    const payload = {
      base: 'USD',
      quote: 'CDF',
      rate: 2800,
      asOf: '2026-10-01T00:00:00.000Z',
      source: 'BCC',
      sourceLabel: 'Banque centrale du Congo',
    };

    const first = await fxService.record(payload, reqAs(ORG, ['ADMIN']));
    const second = await fxService.record({ ...payload, rate: 2850 }, reqAs(ORG, ['ADMIN']));

    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(fake._store.fxRate.length, 1, 'une seule ligne par (paire, date)');
    assert.equal(fake._store.fxRate[0].rate, 2850, 'la correction met à jour le taux');
  } finally {
    restore();
  }
});
