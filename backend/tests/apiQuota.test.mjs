/**
 * Quota journalier d'API — testé **au plafond**, pas seulement en dessous.
 *
 * ## Pourquoi ce test existe
 *
 * `tests/apiUsageWrite.test.mjs` prouve que le compteur avance (3 appels →
 * compteur à 3). Il ne prouve pas le **blocage** : c'est le défaut `ApiUsage`
 * qui rendait le quota décoratif — l'écriture échouait en silence, le compteur
 * restait à 0, et `used >= DAILY_QUOTA` n'était jamais vrai. Un test qui
 * s'arrête sous le plafond passe aussi bien avec un quota cassé qu'avec un
 * quota sain.
 *
 * ## Comment le quota est réglé à 3
 *
 * `src/middleware/apiKey.js` lit `API_DAILY_QUOTA` **au chargement du module**
 * (`const DAILY_QUOTA = Number(process.env.API_DAILY_QUOTA ?? 1000)`). En ESM
 * les imports statiques sont hoistés : poser la variable dans le corps du test
 * serait trop tard. D'où l'import **dynamique**, après avoir posé la variable.
 *
 * Ce fichier est volontairement séparé : `node --test` exécute chaque fichier
 * dans son propre processus, donc la variable ne fuit pas vers les autres tests.
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import { sha256 } from '../src/shared/crypto.js';

const QUOTA = 3;
const CLE = 'ak_test_quota00000000000000000000';
const PREFIXE = CLE.slice(0, 12);

let restore;
let fake;
let apiKeyAuth;

afterEach(() => {
  if (typeof restore === 'function') restore();
  restore = null;
});

/** Monte le double, pose le quota, puis importe le middleware. */
const monter = async () => {
  const resultat = await withFakePrisma(prisma, {
    apiClient: [{
      id: 'apic_q',
      organizationId: 'org_q',
      name: 'Client quota',
      status: 'ACTIVE',
      scopes: ['data:read'],
      purposeApprovedAt: new Date('2026-01-01'),
    }],
    apiKey: [{
      id: 'apk_q',
      clientId: 'apic_q',
      prefix: PREFIXE,
      keyHash: sha256(CLE),
      status: 'ACTIVE',
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null,
    }],
    apiUsage: [],
  });
  restore = resultat.restore;
  fake = resultat.fake;

  // Posé AVANT l'import : le middleware fige la valeur au chargement.
  process.env.API_DAILY_QUOTA = String(QUOTA);
  const module = await import(`../src/middleware/apiKey.js?quota=${QUOTA}&${Date.now()}`);
  apiKeyAuth = module.apiKeyAuth;
};

/** Un appel complet : middleware, puis `finish` pour déclencher l'écriture. */
const appeler = async () => {
  const req = { headers: { 'x-api-key': CLE }, originalUrl: '/public-api/v1/prices' };
  const res = new EventEmitter();
  res.statusCode = 200;
  let erreur = null;
  await apiKeyAuth('data:read')(req, res, (e) => { erreur = e ?? null; });
  if (!erreur) {
    res.emit('finish');
    await new Promise((r) => setTimeout(r, 25));
  }
  return erreur;
};

test(`Quota API : au plafond (${QUOTA}), le ${QUOTA + 1}ᵉ appel est refusé en 429`, async () => {
  await monter();

  // ── Les 3 premiers passent
  for (let i = 1; i <= QUOTA; i += 1) {
    const erreur = await appeler();
    assert.equal(erreur, null, `l'appel ${i} sur ${QUOTA} doit passer`);
  }

  const compteAvant = await prisma.apiUsage.count({
    where: { clientId: 'apic_q', at: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
  });
  assert.equal(compteAvant, QUOTA, `les ${QUOTA} premiers appels sont comptés`);

  // ── Le 4ᵉ est refusé
  const refus = await appeler();
  assert.ok(refus, `le ${QUOTA + 1}ᵉ appel doit être refusé`);
  assert.equal(refus.status, 429, 'statut 429 Too Many Requests');
  assert.equal(refus.code, 'TOO_MANY_REQUESTS', 'code attendu TOO_MANY_REQUESTS');
  assert.match(refus.message, new RegExp(String(QUOTA)), 'le message cite le plafond appliqué');

  // ── Et rien de plus n'est écrit : le refus ne consomme pas de quota
  const compteApres = await prisma.apiUsage.count({
    where: { clientId: 'apic_q', at: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
  });
  assert.equal(compteApres, QUOTA, 'un appel refusé n’ajoute pas de ligne au journal');
  assert.equal(fake._store.apiUsage.length, QUOTA);
});

test('Quota API : sans écriture du journal, le plafond ne bloque rien — la régression est visible', async () => {
  await monter();

  /*
   * Contre-épreuve. On casse l'écriture comme le faisait le défaut `ApiUsage`
   * (identifiant manquant → refus → `.catch()` qui loggue). Le compteur reste à
   * 0, donc **tous** les appels passent : le quota devient décoratif.
   *
   * Sans cette contre-épreuve, le test précédent pourrait passer pour de
   * mauvaises raisons — par exemple si le middleware refusait tout le monde.
   */
  prisma.apiUsage.create = () => Promise.reject(new Error('Argument `id` is missing'));

  let refuses = 0;
  for (let i = 0; i < QUOTA + 2; i += 1) {
    const erreur = await appeler();
    if (erreur) refuses += 1;
  }

  assert.equal(refuses, 0, 'journal cassé ⇒ aucun refus : le quota ne s’applique plus');
  assert.equal(fake._store.apiUsage.length, 0, 'rien n’est écrit');
});
