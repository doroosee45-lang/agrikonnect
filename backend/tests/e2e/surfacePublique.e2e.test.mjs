import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startHarness } from './support/harness.mjs';

/**
 * Recette de bout en bout — base réelle — de la **surface publique** de l'API.
 *
 * ## Ce que cette suite prouve
 *
 * Elle interroge **toutes** les routes du serveur **sans jeton** et vérifie :
 *
 *  - qu'aucune route ne répond 2xx hors d'une liste publique **explicite** ;
 *  - qu'aucune route ne répond 5xx à un appel anonyme (un 500 sur une requête
 *    non authentifiée signale presque toujours un ordre de middlewares cassé) ;
 *  - que le reste est bien refusé, en 401 (pas de jeton), 403 (permission),
 *    404 ou 422 (validation) — jamais en 2xx.
 *
 * L'inventaire est lu sur le **routeur Express réel**, pas sur une liste
 * recopiée : une route ajoutée demain sans `authenticate` fait échouer cette
 * suite. C'est le but.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * Elle ne prouve rien sur l'**isolation entre organisations** une fois
 * authentifié — c'est le rôle des suites par module. Elle prouve seulement la
 * porte d'entrée.
 */

/*
 * Routes autorisées à répondre sans jeton.
 *
 *  - `/` , `/docs`, `/docs/openapi.json`, `/health` : racine, documentation et
 *    sonde de vie, par définition publiques ;
 *  - `/public/*` : vitrine publique (carte, exploitations, statistiques) ;
 *  - `GET /countries`, `GET /countries/fx-rates/pairs`, `GET /crops` : données
 *    de référence dont la permission est `EVERYONE` dans
 *    `src/shared/permissions.js` — publiques **par conception**, pas par oubli ;
 *  - `POST /auth/resend-verification` : répond 200 même pour une adresse
 *    inconnue, volontairement, pour ne pas révéler quels comptes existent
 *    (anti-énumération) — mais **avec une adresse valide**. Depuis le
 *    2026-11-04, un corps vide reçoit 422 (contrat explicite) : la route
 *    n'est plus observée en 2xx avec `{}` et sort de cette liste.
 */
const PUBLIQUES = new Set([
  'GET /',
  'GET /countries',
  'GET /countries/fx-rates/pairs',
  'GET /crops',
  'GET /docs',
  'GET /docs/openapi.json',
  'GET /health',
  'GET /public/farms',
  'GET /public/map',
  'GET /public/soil-stats',
]);

/**
 * Traduit le regexp d'un montage Express en chemin.
 *
 * Express 4 compile `router.use('/sms', …)` en `^\/sms\/?(?=\/|$)`. On traite la
 * **chaîne** plutôt qu'avec des regex : un littéral regex contenant `\/` se
 * referme sur le `/` et produit une erreur de syntaxe discrète.
 */
const prefixeDepuis = (regexp) => {
  let s = regexp.source;
  if (s === '^\\/?(?=\\/|$)' || s === '^(?:\\/)?$') return '';
  if (s.startsWith('^')) s = s.slice(1);
  for (const suffixe of ['\\/?(?=\\/|$)', '\\/?$', '$']) {
    if (s.endsWith(suffixe)) {
      s = s.slice(0, -suffixe.length);
      break;
    }
  }
  s = s.split('\\/').join('/');
  s = s.split('(?:').join('').split(')').join('');
  s = s.split('[^/]+?').join(':param');
  return s.split('?').join('').replace(/\/$/, '');
};

let h;
let carte = [];

before(async () => {
  h = await startHarness();

  /*
   * Import **après** `startHarness()`. Un import statique en tête de fichier
   * évaluerait `config/env.js` — donc `DATABASE_URL` — avant que la base
   * embarquée n'existe : le client Prisma viserait alors le port 6543 et toutes
   * les routes touchant la base répondraient 500. Le défaut viendrait de
   * l'ordre d'import, pas de l'application.
   */
  const router = (await import('../../src/routes/index.js')).default;

  const routes = [];
  const parcourir = (pile, prefixe) => {
    for (const couche of pile) {
      if (couche.route) {
        const chemin = (prefixe + couche.route.path).replace(/\/+$/, '') || '/';
        for (const methode of Object.keys(couche.route.methods)) {
          routes.push({ method: methode.toUpperCase(), path: chemin });
        }
      } else if (couche.name === 'router' && couche.handle?.stack) {
        parcourir(couche.handle.stack, prefixe + prefixeDepuis(couche.regexp));
      }
    }
  };
  parcourir(router.stack, '');

  /*
   * Trois routes sont déclarées directement sur `app` dans `src/app.js`, hors du
   * routeur `/api/v1` : la racine et la documentation OpenAPI. Sans elles, la
   * sonde couvre 382 routes alors que le contrat en compte 385.
   */
  routes.push(
    // `/docs` et `/docs/openapi.json` portent déjà le préfixe dans `app.js`, et
    // le harnais l'ajoute aussi : il ne faut donc pas le remettre.
    { method: 'GET', path: '/docs' },
    { method: 'GET', path: '/docs/openapi.json' },
    // La racine est **hors** préfixe : elle n'est atteignable qu'en visant
    // l'origine, pas `/api/v1`.
    { method: 'GET', path: '/', racine: true },
  );

  for (const r of routes) {
    // Paramètres factices : un UUID pour tout identifiant, « x » sinon.
    const chemin = r.path.replace(/:([\w]+)/g, (_m, p) =>
      (/id$/i.test(p) ? '00000000-0000-0000-0000-000000000000' : 'x'));
    // eslint-disable-next-line no-await-in-loop
    const res = r.racine
      // La racine est hors `/api/v1` : le harnais préfixe tout, donc on vise
      // l'origine directement.
      ? await (async () => {
          const origine = h.urls.baseUrl.replace(/\/api\/v1$/, '');
          const rep = await fetch(origine + '/', { method: r.method });
          return { status: rep.status };
        })()
      : await h.request(r.method, chemin, {
          body: ['POST', 'PUT', 'PATCH'].includes(r.method) ? {} : undefined,
        });
    carte.push({ route: `${r.method} ${r.path}`, status: res.status });
  }
}, { timeout: 300_000 });

after(async () => {
  await h?.stop();
});

test('Surface publique : l’inventaire couvre l’ensemble du routeur', () => {
  assert.ok(carte.length >= 380, `inventaire trop court : ${carte.length} routes`);
  assert.equal(carte.filter((c) => c.route === 'GET /health').length, 1);
});

test('Surface publique : aucune route ne répond 2xx sans jeton hors liste explicite', () => {
  const fuites = carte.filter((c) => c.status >= 200 && c.status < 300 && !PUBLIQUES.has(c.route));
  assert.deepEqual(
    fuites.map((c) => `${c.route} → ${c.status}`),
    [],
    'Ces routes répondent sans authentification. Soit elles doivent entrer dans '
    + 'la liste publique (avec justification), soit il manque `authenticate`.',
  );
});

test('Surface publique : la liste publique est exactement celle observée', () => {
  /*
   * Contrôle dans l'autre sens : si une route publique cesse de l'être, la liste
   * devient mensongère et il faut la mettre à jour — pas la laisser enfler.
   */
  const observees = new Set(
    carte.filter((c) => c.status >= 200 && c.status < 300).map((c) => c.route),
  );
  assert.deepEqual([...PUBLIQUES].sort(), [...observees].sort());
});

test('Surface publique : aucun 5xx sur une requête anonyme', () => {
  const erreurs = carte.filter((c) => c.status >= 500);
  assert.deepEqual(
    erreurs.map((c) => `${c.route} → ${c.status}`),
    [],
    'Un 5xx sur une requête non authentifiée signale un ordre de middlewares '
    + 'cassé ou une fuite d’exception avant la garde d’authentification.',
  );
});

test('Surface publique : les écritures de référence refusent l’anonyme', () => {
  /*
   * `fx.read` est publique ; `fx.write` ne l'est pas. Les deux vivent dans le
   * même fichier de routes, et seule la permission les distingue — c'est
   * précisément l'endroit où une inversion passerait inaperçue.
   */
  const ecriture = carte.find((c) => c.route === 'PUT /countries/fx-rates');
  assert.ok(ecriture, 'PUT /countries/fx-rates absente de l’inventaire');
  assert.equal(ecriture.status, 403, `attendu 403, obtenu ${ecriture.status}`);

  const lecture = carte.find((c) => c.route === 'GET /countries/fx-rates/pairs');
  assert.equal(lecture.status, 200, 'la lecture des paires est publique par conception');
});

test('Surface publique : les webhooks refusent une requête non signée', () => {
  /*
   * Les webhooks ne portent pas de jeton : leur authentification **est** la
   * signature. Sans secret configuré ni signature valide, ils doivent refuser.
   */
  const twilio = carte.find((c) => c.route === 'POST /webhooks/twilio/status');
  assert.ok(twilio, 'POST /webhooks/twilio/status absente de l’inventaire');
  assert.ok(twilio.status < 200 || twilio.status >= 300,
    `le webhook Twilio a accepté une requête non signée (${twilio.status})`);

  const whatsapp = carte.filter((c) => c.route.includes('/channels/whatsapp/webhook'));
  assert.ok(whatsapp.length >= 2, 'les deux webhooks WhatsApp sont attendus');
  for (const w of whatsapp) {
    assert.ok(w.status < 200 || w.status >= 300,
      `${w.route} a accepté une requête non signée (${w.status})`);
  }
});

test('Surface publique : la carte des statuts anonymes n’a pas bougé', () => {
  /*
   * Contrôle **exhaustif**, route par route, et pas seulement « pas de 2xx ».
   *
   * Pourquoi c'est nécessaire : retirer `authenticate` d'une route qui conserve
   * `authorize(...)` ne la rend pas publique — elle passe de 401 à 403. Un test
   * qui ne cherche que les 2xx laisse passer cette régression, alors qu'elle
   * change le contrat (le client doit gérer 401) et révèle l'existence de la
   * route. Cette contre-épreuve a été faite : sans ce contrôle, la mutation
   * passait inaperçue.
   *
   * La référence est `tests/e2e/fixtures/surface-anonyme.json`, régénérée par
   * `node tests/e2e/anonyme.probe.mjs`. Toute différence doit être un choix
   * assumé, pas un effet de bord.
   */
  const observe = {};
  for (const c of carte) observe[c.route] = c.status;
  const reference = JSON.parse(
    readFileSync(new URL('./fixtures/surface-anonyme.json', import.meta.url), 'utf8'),
  );

  const differences = [];
  for (const cle of new Set([...Object.keys(reference), ...Object.keys(observe)])) {
    if (reference[cle] !== observe[cle]) {
      differences.push(`${cle} : référence ${reference[cle] ?? 'absente'} → observé ${observe[cle] ?? 'absente'}`);
    }
  }
  assert.deepEqual(
    differences,
    [],
    'La surface anonyme a changé. Si c’est volontaire, régénère la référence avec '
    + '`node tests/e2e/anonyme.probe.mjs` et documente le motif.',
  );
});

test('Surface publique : la majorité des routes exigent un jeton', () => {
  const nonAuthentifie = carte.filter((c) => c.status === 401);
  assert.ok(
    nonAuthentifie.length >= 340,
    `seulement ${nonAuthentifie.length} routes renvoient 401 — la garde globale a changé`,
  );
});
