import test from 'node:test';
import assert from 'node:assert/strict';

import { matchListingToRequest } from '../src/shared/matching.js';
import { round, convert, validFxRate } from '../src/shared/money.js';
import { can, PERMISSIONS } from '../src/shared/permissions.js';
import { distanceKm, approximate, parseBbox } from '../src/shared/geo.js';
import { isClientId, isUlid, resolveId } from '../src/shared/ids.js';
import { slugify, uniqueSlug } from '../src/shared/slug.js';

/**
 * Tests de logique pure (aucune base de données requise) :
 *   node --test tests/
 *
 * Les invariants testés ici sont ceux que le CDC cite comme critères
 * d'acceptation non négociables (matching explicable, taux daté et sourcé,
 * RBAC, k-anonymat côté service).
 */

// ─── Matching explicable (REQ-02) ───────────────────────────────
const listing = {
  id: 'lst_1',
  cropId: 'crop_mais',
  quantity: 80,
  unit: 'kg',
  province: 'Kongo Central',
  latitude: -5.85,
  longitude: 13.05,
  availableTo: new Date('2027-01-31'),
  status: 'PUBLISHED',
  createdAt: new Date('2026-09-01'),
  certifications: ['Bio'],
};

const request = {
  id: 'req_1',
  cropId: 'crop_mais',
  quantity: 100,
  unit: 'kg',
  deliveryProvince: 'Kongo Central',
  neededBy: new Date('2027-01-15'),
  certifications: [],
};

test('matching : chaque critère est expliqué, jamais un score opaque', () => {
  const result = matchListingToRequest(listing, request);

  assert.ok(Array.isArray(result.criteria));
  assert.ok(result.criteria.length >= 5);
  for (const criterion of result.criteria) {
    assert.equal(typeof criterion.key, 'string');
    assert.equal(typeof criterion.label, 'string');
    assert.equal(typeof criterion.satisfied, 'boolean');
  }
  assert.equal(typeof result.matched, 'number');
  assert.equal(result.total, result.criteria.length);
  assert.match(result.explainingOrder, /critère/);
});

test('matching : un volume insuffisant fait échouer le critère volume', () => {
  const result = matchListingToRequest(listing, { ...request, quantity: 1000 });
  const volume = result.criteria.find((c) => c.key === 'volume');
  assert.equal(volume.satisfied, false);
  assert.match(volume.detail, /8 %/);
});

test('matching : une culture différente fait échouer le critère produit', () => {
  const result = matchListingToRequest(listing, { ...request, cropId: 'crop_riz' });
  assert.equal(result.criteria.find((c) => c.key === 'product').satisfied, false);
});

// ─── Devises (BIL-02) ───────────────────────────────────────────
test('convert : refuse un taux non daté ou non sourcé', () => {
  const withoutSource = convert(100, 'USD', 'CDF', { value: 2800, date: '2026-10-01' });
  assert.equal(withoutSource.amount, null);
  assert.match(withoutSource.error, /daté et sourcé/);

  const ok = convert(100, 'USD', 'CDF', { value: 2800, date: '2026-10-01', source: 'BCC' });
  assert.equal(ok.amount, 280000);
  assert.equal(ok.fxRate.source, 'BCC');
});

test('convert : même devise = pas de conversion', () => {
  assert.equal(convert(45.678, 'USD', 'USD').amount, 45.68);
});

test('validFxRate : exige valeur, date et source', () => {
  assert.equal(validFxRate({ value: 1, date: '2026-10-01', source: 'BCC' }), true);
  assert.equal(validFxRate({ value: 1, date: '2026-10-01' }), false);
  assert.equal(validFxRate(null), false);
});

test('round : évite les erreurs de flottants', () => {
  assert.equal(round(0.1 + 0.2), 0.3);
  assert.equal(round(1.005, 2), 1.01);
});

// ─── RBAC ───────────────────────────────────────────────────────
test('RBAC : un producteur ne peut pas modérer une annonce', () => {
  assert.equal(can(['FARMER'], 'listings.write'), true);
  assert.equal(can(['FARMER'], 'listings.moderate'), false);
  assert.equal(can(['MODERATOR'], 'listings.moderate'), true);
});

test('RBAC : les transitions de commande sont réservées aux parties', () => {
  assert.equal(can(['BUYER'], 'orders.write'), true);
  assert.equal(can(['TRANSPORTER'], 'orders.write'), false);
  assert.equal(can(['TRANSPORTER'], 'transport.write'), true);
});

test('RBAC : un investisseur n\'écrit pas de projet', () => {
  assert.equal(can(['INVESTOR'], 'projects.read'), true);
  assert.equal(can(['INVESTOR'], 'projects.write'), false);
});

test('RBAC : toute permission déclarée a au moins un rôle', () => {
  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    assert.ok(roles.length > 0, `${permission} sans rôle`);
    assert.match(permission, /^[a-z]+\.[a-z]+$/, `${permission} mal formée`);
  }
});

// ─── Géographie ─────────────────────────────────────────────────
test('distanceKm : ordre de grandeur correct et valeurs manquantes gérées', () => {
  const kinshasa = [-4.32, 15.31];
  const matadi = [-5.82, 13.45];
  const d = distanceKm(...kinshasa, ...matadi);
  // Kinshasa ↔ Matadi ≈ 265 km à vol d'oiseau
  assert.ok(d > 240 && d < 300, `distance inattendue : ${d}`);
  assert.equal(distanceKm(null, 13, -5, 15), null);
});

test('approximate : la position publique est dégradée', () => {
  const value = approximate(-5.856123, 2);
  assert.equal(Number.isInteger(value * 100), true);
  assert.notEqual(value, -5.856123);
});

test('parseBbox : refuse une bbox invalide', () => {
  assert.deepEqual(parseBbox('13,-6,16,-4'), { minLng: 13, minLat: -6, maxLng: 16, maxLat: -4 });
  assert.equal(parseBbox('1,2,3'), null, 'trois valeurs');
  assert.equal(parseBbox('a,b,c,d'), null, 'valeurs non numériques');
  assert.equal(parseBbox('16,-6,13,-4'), null, 'bornes inversées');
  assert.equal(parseBbox(null), null);
});

// ─── Identifiants offline (SYNC) ────────────────────────────────
test('isClientId / isUlid : validation stricte des ids clients', () => {
  assert.equal(isUlid('01JBQ8Z0K4Y8V0R2M3N4P5Q6R7'), true);
  assert.equal(isClientId('01JBQ8Z0K4Y8V0R2M3N4P5Q6R7'), true);
  assert.equal(isClientId('abc'), false);
  assert.equal(isClientId('../../etc/passwd'), false);
});

test('resolveId : honore un id client valide, sinon génère', () => {
  const provided = resolveId('01JBQ8Z0K4Y8V0R2M3N4P5Q6R7');
  assert.equal(provided, '01JBQ8Z0K4Y8V0R2M3N4P5Q6R7');
  const generated = resolveId();
  assert.equal(generated.length, 26);
  assert.equal(isUlid(generated), true);
});

// ─── Slugs ──────────────────────────────────────────────────────
test('slugify : accents retirés et caractères nettoyés', () => {
  assert.equal(slugify('Ferme Espoir Kongo'), 'ferme-espoir-kongo');
  assert.equal(slugify('Coopérative Agricole de Matadi'), 'cooperative-agricole-de-matadi');
  assert.equal(slugify(''), 'profil');
});

test('uniqueSlug : ajoute un suffixe en cas de collision', async () => {
  const taken = new Set(['ferme-espoir']);
  const slug = await uniqueSlug('Ferme Espoir', async (candidate) => taken.has(candidate));
  assert.equal(slug, 'ferme-espoir-2');
});
