/**
 * Contrat des réponses d'erreur — le champ `code`.
 *
 * ## Le défaut couvert
 *
 * `ApiError` portait un code machine (`VALIDATION_ERROR`, `NOT_FOUND`,
 * `CONFLICT`…) **sans jamais l'exposer** : `errorHandler.js` construisait
 * `{ success, message, requestId }`. Un client ne pouvait donc pas distinguer
 * deux erreurs de même statut autrement qu'en comparant des messages écrits
 * pour des humains, et voués à changer. Le statut seul ne suffit pas : 422
 * couvre aussi bien un champ manquant qu'un type de fichier refusé.
 *
 * ## Ce que garantit ce test
 *
 * L'ajout est **additif** : `success`, `message` et `requestId` restent
 * présents et inchangés. Rien n'est retiré du contrat existant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ZodError } from 'zod';

import { ApiError } from '../src/shared/errors/ApiError.js';
import { errorHandler } from '../src/shared/http/errorHandler.js';

/** Capturer le corps envoyé par le gestionnaire d'erreurs. */
const capturer = async (erreur) => {
  let corps;
  let statut;
  const req = { id: 'req-test', method: 'GET', originalUrl: '/test', headers: {} };
  const res = {
    status(s) {
      statut = s;
      return this;
    },
    json(c) {
      corps = c;
      return this;
    },
  };
  errorHandler(erreur, req, res, () => {});
  // `errorHandler` est synchrone ; on attend un tour de boucle par sécurité.
  await new Promise((r) => setImmediate(r));
  return { statut, corps };
};

/* ─────────── toutes les fabriques portent un code ─────────── */

const FABRIQUES = [
  ['badRequest', 422, 'VALIDATION_ERROR'],
  ['unauthorized', 401, 'UNAUTHORIZED'],
  ['forbidden', 403, 'FORBIDDEN'],
  ['notFound', 404, 'NOT_FOUND'],
  ['conflict', 409, 'CONFLICT'],
  ['payloadTooLarge', 413, 'PAYLOAD_TOO_LARGE'],
  ['tooManyRequests', 429, 'TOO_MANY_REQUESTS'],
  ['internal', 500, 'INTERNAL_ERROR'],
];

test('contrat — chaque fabrique ApiError porte un code et le bon statut', () => {
  for (const [nom, statut, code] of FABRIQUES) {
    const erreur = ApiError[nom]('message');
    assert.equal(erreur.status, statut, `${nom} : statut`);
    assert.equal(erreur.code, code, `${nom} : code`);
  }
});

/**
 * Si une fabrique cesse de porter un code, un client qui branche sur `code`
 * reçoit `null` sans s'en apercevoir. Ce test rend la régression visible.
 */
test('contrat — aucune fabrique ne renvoie un code vide', () => {
  for (const [nom] of FABRIQUES) {
    const { code } = ApiError[nom]('message');
    assert.ok(typeof code === 'string' && code.length > 0, `${nom} doit porter un code`);
    assert.match(code, /^[A-Z][A-Z0-9_]*$/, `${nom} : ${code} n'est pas en CONSTANT_CASE`);
  }
});

/* ─────────── le gestionnaire expose le code ─────────── */

test('contrat — le corps d’erreur expose `code`, sans rien retirer', async () => {
  for (const [nom, statut, code] of FABRIQUES) {
    const { statut: obtenu, corps } = await capturer(ApiError[nom]('un message'));
    assert.equal(obtenu, statut, nom);

    // Le champ ajouté.
    assert.equal(corps.code, code, `${nom} : code exposé`);
    // Les champs préexistants, inchangés — l'ajout est additif.
    assert.equal(corps.success, false, `${nom} : success`);
    assert.equal(corps.message, 'un message', `${nom} : message`);
    assert.equal(corps.requestId, 'req-test', `${nom} : requestId`);
  }
});

test('contrat — `code` est présent même quand l’erreur n’en porte pas', async () => {
  /*
   * Clé toujours présente, valeur `null` : un client n'a pas à tester
   * l'existence de la clé avant de la lire.
   */
  const { corps } = await capturer(new ApiError(418, 'théière'));
  assert.ok('code' in corps, 'la clé doit exister');
  assert.equal(corps.code, null);
});

/* ─────────── erreurs normalisées ─────────── */

test('contrat — une erreur Zod normalisée porte un code', async () => {
  let zodErreur;
  try {
    await import('zod').then(({ z }) => z.object({ a: z.string() }).parse({}));
  } catch (e) {
    zodErreur = e;
  }
  assert.ok(zodErreur instanceof ZodError, 'le test doit bien produire une ZodError');

  const { statut, corps } = await capturer(zodErreur);
  assert.equal(statut, 422);
  assert.equal(corps.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(corps.errors), 'le détail par champ est conservé');
});

test('contrat — un corps JSON invalide normalisé porte un code', async () => {
  const { statut, corps } = await capturer({ type: 'entity.parse.failed' });
  assert.equal(statut, 422);
  assert.equal(corps.code, 'VALIDATION_ERROR');
});

test('contrat — un corps trop volumineux normalisé porte PAYLOAD_TOO_LARGE', async () => {
  const { statut, corps } = await capturer({ type: 'entity.too.large' });
  assert.equal(statut, 413);
  assert.equal(corps.code, 'PAYLOAD_TOO_LARGE');
});

test('contrat — une erreur inconnue devient INTERNAL_ERROR, sans fuite de détail', async () => {
  const { statut, corps } = await capturer(new Error('secret de la pile'));
  assert.equal(statut, 500);
  assert.equal(corps.code, 'INTERNAL_ERROR');
  // Le message interne ne doit pas atteindre le client.
  assert.doesNotMatch(corps.message, /secret de la pile/);
});

/* ─────────── limiteurs de débit ─────────── */

/**
 * Les limiteurs construisent leur corps eux-mêmes, sans passer par
 * `errorHandler`. Sans ce test, une erreur de débit serait la seule du contrat
 * à ne porter son code que dans `errors[0].code`.
 */
test('contrat — les limiteurs de débit exposent `code` à la racine', async () => {
  const source = await fs.readFile(
    new URL('../src/middleware/rateLimit.js', import.meta.url),
    'utf8',
  );
  const bloc = source.slice(source.indexOf('const errorBody'), source.indexOf('/** Limite globale'));
  assert.match(bloc, /success: false/, 'success conservé');
  assert.match(bloc, /^\s*code,/m, 'code exposé à la racine');
  assert.match(bloc, /errors: \[\{ field: null, code \}\]/, 'code conservé dans errors aussi');
});

/* ─────────── OpenAPI ─────────── */

test('contrat — l’OpenAPI déclare `code` comme requis dans ErrorEnvelope', async () => {
  const brut = await fs.readFile(new URL('../src/docs/openapi.json', import.meta.url), 'utf8');
  const contrat = JSON.parse(brut);
  const enveloppe = contrat.components.schemas.ErrorEnvelope;

  assert.ok(enveloppe, 'ErrorEnvelope doit exister');
  assert.ok(
    enveloppe.required.includes('code'),
    `code doit être requis, requis actuel : ${JSON.stringify(enveloppe.required)}`,
  );
  assert.ok(enveloppe.properties.code, 'la propriété code doit être décrite');
  assert.equal(enveloppe.properties.code.nullable, true, 'null est une valeur licite');

  // Les champs préexistants restent requis : l'ajout est additif.
  for (const champ of ['success', 'message', 'requestId']) {
    assert.ok(enveloppe.required.includes(champ), `${champ} doit rester requis`);
  }
});

test('contrat — le 413 est documenté', async () => {
  const brut = await fs.readFile(new URL('../src/docs/openapi.json', import.meta.url), 'utf8');
  const contrat = JSON.parse(brut);
  assert.ok(contrat.components.responses.PayloadTooLarge, 'la réponse 413 doit être définie');
});

/* ─────────── arguments silencieusement ignorés ─────────── */

/**
 * Le verrouillage MFA venait de là : `ApiError.unauthorized(msg, { mfaRequired })`
 * passait un second argument à une fabrique qui n'en acceptait **qu'un**. Node
 * n'avertit pas — l'argument est simplement perdu. L'appel a l'air de
 * fonctionner, le signal disparaît, et rien ne le signale avant qu'un
 * utilisateur soit bloqué dehors.
 *
 * Ce test compare, pour chaque appel du code, le **nombre d'arguments passés**
 * au nombre de paramètres déclarés par la fabrique.
 */
test('contrat — aucune fabrique ApiError ne reçoit plus d’arguments qu’elle n’en déclare', async () => {
  const apiErrorSource = await fs.readFile(
    new URL('../src/shared/errors/ApiError.js', import.meta.url),
    'utf8',
  );

  // Paramètres déclarés par chaque fabrique statique.
  const declarees = new Map();
  for (const match of apiErrorSource.matchAll(/static (\w+)\(([^)]*)\)/g)) {
    const [, nom, params] = match;
    const liste = params.split(',').map((p) => p.trim()).filter(Boolean);
    declarees.set(nom, liste.length);
  }
  assert.ok(declarees.size >= 8, 'les fabriques doivent être trouvées, sinon ce test ne prouve rien');

  const dossiers = ['src'];
  const fichiers = [];
  const parcourir = async (relatif) => {
    const url = new URL(`../${relatif}/`, import.meta.url);
    const entrees = await fs.readdir(url, { withFileTypes: true });
    for (const entree of entrees) {
      if (entree.name === 'node_modules') continue;
      const suivant = `${relatif}/${entree.name}`;
      if (entree.isDirectory()) await parcourir(suivant);
      else if (entree.name.endsWith('.js')) fichiers.push(suivant);
    }
  };
  for (const dossier of dossiers) await parcourir(dossier);

  /*
   * Compter les virgules naïvement produit des faux positifs vérifiés : les
   * gabarits de `modelVersions.service.js` contiennent des virgules
   * (« … contre X, »), et une recherche non bornée peut traverser plusieurs
   * instructions. On retire donc d'abord chaînes et commentaires, puis on
   * parcourt caractère par caractère en suivant la profondeur des parenthèses.
   */
  /*
   * L'épure **préserve la longueur** : chaque caractère retiré est remplacé par
   * une espace. Sans ça, les numéros de ligne calculés ensuite ne correspondent
   * plus au fichier réel et le test envoie chercher au mauvais endroit.
   */
  const memeLongueur = (texte) => texte.replace(/[^\n]/g, ' ');
  const epurer = (source) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, memeLongueur)
      .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
      .replace(/`(?:[^`\\]|\\.)*`/g, (m) => '`' + ' '.repeat(m.length - 2) + '`')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => "'" + ' '.repeat(m.length - 2) + "'")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => '"' + ' '.repeat(m.length - 2) + '"');

  const exces = [];
  for (const fichier of fichiers) {
    if (fichier.endsWith('shared/errors/ApiError.js')) continue;
    const source = epurer(await fs.readFile(new URL(`../${fichier}`, import.meta.url), 'utf8'));
    const ligneDe = (index) => source.slice(0, index).split('\n').length;

    const motif = /ApiError\.(\w+)\(/g;
    let match;
    while ((match = motif.exec(source)) !== null) {
      const fabrique = match[1];
      const attendus = declarees.get(fabrique);
      if (attendus === undefined) continue;

      let profondeur = 1;
      let comptes = 0;
      let vuCaractere = false;
      let dernierUtile = '';
      for (let i = motif.lastIndex; i < source.length; i += 1) {
        const caractere = source[i];
        if ('([{'.includes(caractere)) profondeur += 1;
        else if (')]}'.includes(caractere)) {
          profondeur -= 1;
          if (profondeur === 0) break;
        } else if (caractere === ',' && profondeur === 1) comptes += 1;
        if (!/\s/.test(caractere)) {
          vuCaractere = true;
          dernierUtile = caractere;
        }
      }
      /*
       * Une virgule de fin (`f(a, b,)`) est admise en JavaScript et ne constitue
       * **pas** un argument supplémentaire. Sans cette garde, les trois appels
       * `payloadTooLarge` de l'import géospatial étaient signalés à tort.
       */
      if (!vuCaractere) comptes = 0; // appel sans argument
      else if (dernierUtile === ',') comptes -= 1;
      const passes = comptes + 1;

      if (passes > attendus) {
        exces.push(
          `${fichier}:${ligneDe(match.index)} → ApiError.${fabrique}(${passes} arguments, ${attendus} déclarés)`,
        );
      }
    }
  }

  assert.deepEqual(
    exces,
    [],
    `Arguments silencieusement ignorés :\n  ${exces.join('\n  ')}`,
  );
});

test('contrat — unauthorized et forbidden portent bien `details` quand on leur en donne', async () => {
  const avecDetails = ApiError.unauthorized('Code requis', { mfaRequired: true, method: 'TOTP' });
  assert.equal(avecDetails.status, 401);
  assert.equal(avecDetails.code, 'UNAUTHORIZED');
  assert.deepEqual(avecDetails.details, { mfaRequired: true, method: 'TOTP' });

  const interdit = ApiError.forbidden('Second facteur requis', { mfaRequired: true });
  assert.equal(interdit.status, 403);
  assert.equal(interdit.code, 'FORBIDDEN');
  assert.deepEqual(interdit.details, { mfaRequired: true });
});

/**
 * De bout en bout sur le gestionnaire : `details` doit atteindre le corps HTTP,
 * sinon le client ne voit toujours rien.
 */
test('contrat — `details.mfaRequired` atteint le corps de la réponse 401', async () => {
  const { statut, corps } = await capturer(
    ApiError.unauthorized('Code de double authentification requis', {
      mfaRequired: true,
      method: 'TOTP',
    }),
  );
  assert.equal(statut, 401);
  assert.equal(corps.details.mfaRequired, true, 'le client doit pouvoir détecter la MFA requise');
  assert.equal(corps.details.method, 'TOTP');
  // Les champs préexistants restent là.
  assert.equal(corps.success, false);
  assert.equal(corps.code, 'UNAUTHORIZED');
});
