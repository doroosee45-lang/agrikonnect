/**
 * Journal d'usage API — l'écriture doit réellement aboutir.
 *
 * ## Le défaut que ce test couvre
 *
 * `ApiUsage` déclare `id String @id` **sans** `@default`. Le middleware
 * `apiKey.js` créait la ligne sans identifiant : Prisma levait
 * « Argument `id` is missing », et le `.catch()` se contentait de logger.
 * Résultat en production : **le journal d'usage restait vide**, donc
 * `apiUsage.count()` valait 0, donc le quota journalier ne s'appliquait jamais.
 *
 * ## Pourquoi la suite ne l'a pas vu
 *
 * Deux masques superposés :
 *
 *  1. **Le double de test inventait l'identifiant** (`scalarData.id ??
 *     newId(model)`), donc il était plus permissif que la base réelle. Corrigé :
 *     `tests/helpers/fakePrisma.mjs` lève désormais la même erreur que Prisma
 *     pour les modèles sans `@default`.
 *  2. **`API-04` injectait les lignes directement** (`fake._store.apiUsage =
 *     [...]`) au lieu de passer par le chemin d'écriture. Il vérifiait la
 *     lecture du journal, jamais son écriture.
 *
 * Ce test passe par le middleware lui-même : si l'identifiant cesse d'être
 * généré, l'écriture est refusée et le test échoue.
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import { apiKeyAuth } from '../src/middleware/apiKey.js';
import { sha256 } from '../src/shared/crypto.js';
import { logger } from '../src/shared/http/logger.js';

const CLE = 'ak_test_00000000000000000000000000000000';
const PREFIXE = CLE.slice(0, 12);

let restore;
let fake;
const loggerOriginal = logger.error;
let journalErreurs;

/** Monte un double avec un client approuvé et sa clé active. */
const monter = async (extra = {}) => {
  const resultat = await withFakePrisma(prisma, {
    apiClient: [{
      id: 'apic_1',
      organizationId: 'org_1',
      name: 'Client de test',
      status: 'ACTIVE',
      scopes: ['data:read'],
      purposeApprovedAt: new Date('2026-01-01'),
    }],
    apiKey: [{
      id: 'apk_1',
      clientId: 'apic_1',
      prefix: PREFIXE,
      keyHash: sha256(CLE),
      status: 'ACTIVE',
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null,
    }],
    apiUsage: [],
    ...extra,
  });
  restore = resultat.restore;
  fake = resultat.fake;
  return fake;
};

/** Exécute le middleware puis déclenche `finish`, comme le ferait Express. */
const traverser = async () => {
  const req = { headers: { 'x-api-key': CLE }, originalUrl: '/public-api/v1/prices' };
  const res = new EventEmitter();
  res.statusCode = 200;
  let erreurDeSuivant = null;
  await apiKeyAuth('data:read')(req, res, (e) => { erreurDeSuivant = e ?? null; });
  assert.equal(erreurDeSuivant, null, `le middleware ne doit pas refuser : ${erreurDeSuivant?.message}`);
  res.emit('finish');
  // L'écriture est asynchrone et volontairement non bloquante : on lui laisse
  // le temps d'aboutir avant d'assertionner.
  await new Promise((r) => setTimeout(r, 30));
  return { req, res };
};

afterEach(() => {
  logger.error = loggerOriginal;
  if (typeof restore === 'function') restore();
  restore = null;
});

test('ApiUsage : l’écriture du journal aboutit, avec un identifiant généré', async () => {
  await monter();
  await traverser();

  const lignes = fake._store.apiUsage;
  assert.equal(lignes.length, 1, 'une ligne de journal doit avoir été écrite');

  const [ligne] = lignes;
  assert.ok(ligne.id, 'la ligne porte un identifiant');
  assert.match(ligne.id, /^usg_/, 'identifiant au format des autres modules (préfixe + base36)');
  assert.equal(ligne.clientId, 'apic_1');
  assert.equal(ligne.keyId, 'apk_1');
  assert.equal(ligne.route, '/public-api/v1/prices');
  assert.equal(ligne.status, 200);
});

test('ApiUsage : sans identifiant, l’écriture est refusée et le test échoue', async () => {
  await monter();

  /*
   * Preuve que le double refuse bien une écriture sans identifiant — sinon le
   * test précédent passerait pour de mauvaises raisons.
   */
  await assert.rejects(
    () => prisma.apiUsage.create({ data: { clientId: 'apic_1', route: '/x', status: 200 } }),
    /Argument `id` is missing/,
    'le double doit lever la même erreur que le vrai Prisma',
  );
  assert.equal(fake._store.apiUsage.length, 0, 'rien n’est écrit quand l’identifiant manque');
});

test('ApiUsage : un échec d’écriture est tracé avec un marqueur stable', async () => {
  await monter();
  journalErreurs = [];
  logger.error = (...args) => journalErreurs.push(args);

  // On casse l'écriture après coup : la ligne ne doit pas disparaître en silence.
  const createOriginal = prisma.apiUsage.create.bind(prisma.apiUsage);
  prisma.apiUsage.create = () => Promise.reject(new Error('Argument `id` is missing'));

  await traverser();

  const marqueur = journalErreurs.find((args) => args[0] === 'API_USAGE_WRITE_FAILED');
  assert.ok(marqueur, `l'échec doit être tracé sous API_USAGE_WRITE_FAILED — reçu : ${JSON.stringify(journalErreurs)}`);
  assert.equal(marqueur[1].clientId, 'apic_1');
  assert.equal(marqueur[1].route, '/public-api/v1/prices');
  assert.match(marqueur[1].erreur, /Argument `id` is missing/);

  prisma.apiUsage.create = createOriginal;
});

test('ApiUsage : le quota journalier compte réellement les lignes écrites', async () => {
  await monter();

  // Trois appels réels, par le middleware — pas des lignes injectées.
  for (let i = 0; i < 3; i += 1) await traverser();

  const depuis24h = new Date(Date.now() - 24 * 3600 * 1000);
  const compte = await prisma.apiUsage.count({
    where: { clientId: 'apic_1', at: { gte: depuis24h } },
  });
  assert.equal(compte, 3, 'le compteur de quota voit les trois écritures');

  /*
   * C'est la conséquence métier du défaut : si l'écriture échoue en silence,
   * ce compteur reste à 0 et `used >= DAILY_QUOTA` n'est jamais vrai. Le quota
   * journalier devient décoratif.
   */
  assert.ok(compte > 0, 'un compteur à 0 rendrait le quota journalier inopérant');
});
