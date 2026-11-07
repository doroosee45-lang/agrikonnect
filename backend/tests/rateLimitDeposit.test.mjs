/**
 * Limite de débit de la route de dépôt géospatial.
 *
 * ## Pourquoi ce test
 *
 * La route de dépôt est la seule de l'API à accepter un corps de 100 Mo. Sa
 * première ligne de défense n'est pas la taille mais le **débit** : elle est
 * appliquée avant l'authentification et avant le parseur. Annoncer une valeur
 * dans la documentation sans l'avoir observée serait une affirmation de mémoire.
 *
 * Ce test pilote donc le **vrai** `writeLimiter`, avec sa **vraie**
 * configuration, sur une vraie application Express, et compte les requêtes
 * jusqu'au refus.
 *
 * ## Ce qu'il ne couvre pas
 *
 * La valeur diffère selon l'environnement : `env.isProd ? 30 : 1_000`. La suite
 * tourne avec `NODE_ENV=test`, donc le test observe **1 000**. Le comportement
 * en production (30 par minute) suit le même code mais n'est pas exécuté ici.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { writeLimiter } from '../src/middleware/rateLimit.js';

let serveur;
let base;

before(async () => {
  const app = express();
  app.set('trust proxy', false);
  app.post('/depot', writeLimiter, (_req, res) => res.json({ success: true }));
  serveur = app.listen(0);
  await new Promise((r) => serveur.once('listening', r));
  base = `http://127.0.0.1:${serveur.address().port}`;
});

after(async () => {
  await new Promise((r) => serveur.close(r));
});

test('débit — les requêtes passent sous le plafond, puis refus 429 au plafond', async () => {
  let passes = 0;
  let refus = null;

  /*
   * 1 010 tentatives : `writeLimiter` est configuré à 1 000 par minute hors
   * production. On s'arrête dès le premier refus.
   */
  for (let i = 0; i < 1010; i++) {
    const reponse = await fetch(`${base}/depot`, { method: 'POST' });
    if (reponse.ok) {
      passes += 1;
    } else {
      refus = {
        statut: reponse.status,
        corps: await reponse.json(),
        retryAfter: reponse.headers.get('retry-after'),
      };
      break;
    }
  }

  // La valeur observée, pas la valeur supposée.
  assert.equal(passes, 1000, `attendu 1 000 requêtes admises, observé ${passes}`);

  assert.ok(refus, 'un refus doit survenir');
  assert.equal(refus.statut, 429, `statut du refus : ${refus.statut}`);

  /*
   * Le corps du refus porte `code` à la racine, comme le reste du contrat
   * depuis l'ajout du champ — les limiteurs construisent leur corps eux-mêmes,
   * sans passer par `errorHandler`.
   */
  assert.equal(refus.corps.success, false);
  assert.equal(refus.corps.code, 'WRITE_RATE_LIMITED');
  assert.match(refus.corps.message, /Trop d'écritures/);
  assert.ok(refus.retryAfter, 'l’en-tête Retry-After doit être présent');
});

test('débit — le compteur est par adresse IP, pas global', async () => {
  /*
   * Si le compteur était global, un seul client abusif bloquerait l'API pour
   * tout le monde. On le vérifie en montant une seconde application qui fait
   * confiance à `X-Forwarded-For` : deux adresses distinctes doivent avoir
   * chacune leur quota.
   */
  const appProxy = express();
  appProxy.set('trust proxy', true);
  appProxy.post('/depot', writeLimiter, (_req, res) => res.json({ success: true }));
  const serveurProxy = appProxy.listen(0);
  await new Promise((r) => serveurProxy.once('listening', r));
  const baseProxy = `http://127.0.0.1:${serveurProxy.address().port}`;

  try {
    const ipA = '198.51.100.7';
    const ipB = '198.51.100.8';

    // A consomme une partie de son quota.
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${baseProxy}/depot`, {
        method: 'POST',
        headers: { 'x-forwarded-for': ipA },
      });
      assert.equal(r.status, 200, `A requête ${i}`);
    }

    // B doit disposer de **tout** son quota : le compteur n'est pas partagé.
    let passesB = 0;
    for (let i = 0; i < 1010; i++) {
      const r = await fetch(`${baseProxy}/depot`, {
        method: 'POST',
        headers: { 'x-forwarded-for': ipB },
      });
      if (r.ok) passesB += 1;
      else break;
    }
    assert.equal(passesB, 1000, `B doit avoir son quota entier, observé ${passesB}`);

    // Et A a bien son propre compteur, entamé de 5.
    let passesA = 0;
    for (let i = 0; i < 1010; i++) {
      const r = await fetch(`${baseProxy}/depot`, {
        method: 'POST',
        headers: { 'x-forwarded-for': ipA },
      });
      if (r.ok) passesA += 1;
      else break;
    }
    assert.equal(passesA, 995, `A avait déjà consommé 5 : observé ${passesA}`);
  } finally {
    await new Promise((r) => serveurProxy.close(r));
  }
});
