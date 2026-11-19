import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as farmsService from '../src/modules/farms/farms.service.js';
import { can } from '../src/shared/permissions.js';
import { empreintesEgales } from '../src/middleware/apiKey.js';
import { contactLimiter, contactPerFarmLimiter } from '../src/middleware/rateLimit.js';
import { nomCulture } from '../src/modules/channels/channels.service.js';
import countriesRouter from '../src/modules/countries/countries.routes.js';
import publicRouter from '../src/modules/public/public.routes.js';

/**
 * Audit backend — Lot 1 (AUDIT_BACKEND/SUIVI_CORRECTIONS_BACKEND.md §4).
 * Chaque test échouait sur le code d'avant correction.
 */

const reqAs = (organizationId = 'org_1', roles = ['FARMER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const store = () => ({ crop: [], plot: [], farm: [], auditLog: [], notification: [], membership: [] });

test('H-06 : passer la position en « privée » efface la position publique déjà publiée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const { farm } = await farmsService.create(
      { name: 'Ferme Privée', countryCode: 'CD', latitude: -1.67891, longitude: 29.22345 },
      reqAs(),
    );
    assert.notEqual(fake._store.farm[0].publicLatitude, null, 'position publique approximée à la création');

    await farmsService.update(farm.id, { visibility: { location: 'private' } }, reqAs());

    const stored = fake._store.farm[0];
    assert.equal(stored.publicLatitude, null, 'latitude publique effacée');
    assert.equal(stored.publicLongitude, null, 'longitude publique effacée');
    assert.equal(stored.latitude, -1.67891, 'la position exacte (privée) est conservée');
  } finally {
    restore();
  }
});

test('H-01 (partiel) : SUPPORT_AGENT ne publie plus ni taux de change ni prix de marché', () => {
  assert.equal(can(['SUPPORT_AGENT'], 'fx.write'), false);
  assert.equal(can(['SUPPORT_AGENT'], 'prices.write'), false);
  assert.equal(can(['ADMIN'], 'fx.write'), true);
  assert.equal(can(['SUPER_ADMIN'], 'prices.write'), true);
});

const handlersDe = (router, methode, chemin) => {
  const couche = router.stack.find((l) => l.route?.path === chemin && l.route.methods[methode]);
  return couche ? couche.route.stack.map((s) => s.name) : null;
};

test('F-01 : PUT /countries/fx-rates authentifie la session avant de vérifier la permission', () => {
  const noms = handlersDe(countriesRouter, 'put', '/fx-rates');
  assert.ok(noms, 'route PUT /fx-rates introuvable');
  assert.ok(noms.includes('authenticate'), `authenticate absent (${noms.join(', ')})`);
  assert.ok(noms.indexOf('authenticate') < noms.length - 1);
});

test('M-06 : le formulaire de contact public est limité (par IP et par ferme)', () => {
  const couche = publicRouter.stack.find((l) => l.route?.path === '/farms/:slug/contact' && l.route.methods.post);
  assert.ok(couche, 'route de contact introuvable');
  const fonctions = couche.route.stack.map((s) => s.handle);
  assert.ok(fonctions.includes(contactLimiter), 'limiteur par IP absent');
  assert.ok(fonctions.includes(contactPerFarmLimiter), 'limiteur par ferme absent');
});

test('M-14 : comparaison des empreintes de clé d’API en temps constant', () => {
  assert.equal(empreintesEgales('abc', 'abc'), true);
  assert.equal(empreintesEgales('abc', 'abd'), false);
  assert.equal(empreintesEgales('abc', 'abcd'), false, 'longueurs différentes : refus sans exception');
  assert.equal(empreintesEgales('', ''), false, 'empreinte vide jamais acceptée');
  assert.equal(empreintesEgales(null, undefined), false);
});

test('F-05 : le canal USSD lit le nom de culture dans `names`', () => {
  assert.equal(nomCulture({ slug: 'mais', names: { fr: 'Maïs', en: 'Maize' } }), 'Maïs');
  assert.equal(nomCulture({ slug: 'cafe', names: { en: 'Coffee' } }), 'Coffee');
  assert.equal(nomCulture({ slug: 'manioc', names: {} }), 'manioc');
  assert.equal(nomCulture(null), null);
});
