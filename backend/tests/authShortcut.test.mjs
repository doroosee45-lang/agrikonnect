/**
 * Le raccourci d'authentification ne doit pas pouvoir être forgé.
 *
 * ## Le changement testé
 *
 * `authenticate` commence par `if (req.user) return next();`. C'est nécessaire :
 * sur la route de dépôt géospatial, l'authentification est **avancée avant le
 * parseur de corps** (pour qu'une requête sans jeton soit refusée sans que ses
 * 100 Mo soient lus), puis le routeur rejoue `authenticate`. Sans raccourci,
 * l'utilisateur serait résolu deux fois par requête.
 *
 * ## Le risque
 *
 * Un raccourci qui fait confiance à `req.user` devient **un contournement
 * complet de l'authentification** si `req.user` peut être influencé par la
 * requête. Il suffirait alors de poser le bon champ pour être considéré comme
 * connecté — sans jeton.
 *
 * ## Ce que prouve ce fichier
 *
 * Deux niveaux complémentaires :
 *
 *  1. **Structurel** — `req.user` n'est écrit qu'à un seul endroit du code, et
 *     cet endroit dérive la valeur du jeton, jamais de la requête. C'est la
 *     garantie la plus forte : elle vaut pour toutes les routes, y compris
 *     celles qui n'existent pas encore.
 *  2. **Fonctionnel** — une requête qui tente de forger l'état par en-tête,
 *     corps, cookie ou paramètre est refusée en 401.
 *
 * Le niveau 2 seul ne suffirait pas : il ne teste que les vecteurs auxquels on
 * a pensé. Le niveau 1 borne le problème à la source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authenticate } from '../src/middleware/auth.js';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parcourt récursivement les `.js` de `src/`, hors `node_modules`. */
const fichiersSource = async (dossier) => {
  const entrees = await fs.readdir(dossier, { withFileTypes: true });
  const resultat = [];
  for (const entree of entrees) {
    if (entree.name === 'node_modules') continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...(await fichiersSource(complet)));
    else if (entree.name.endsWith('.js')) resultat.push(complet);
  }
  return resultat;
};

/* ═══════════════ niveau structurel ═══════════════ */

test('structurel — `req.user` n’est écrit que dans src/middleware/auth.js', async () => {
  const fichiers = await fichiersSource(path.join(RACINE, 'src'));
  const ecritures = [];

  for (const fichier of fichiers) {
    const source = await fs.readFile(fichier, 'utf8');
    const lignes = source.split('\n');
    lignes.forEach((ligne, index) => {
      /*
       * Affectation simple ou composée (`=`, `??=`, `||=`), mais pas les
       * comparaisons ni les accès de propriété (`req.user.id`, `req.user?.x`).
       */
      const estAffectation = /req\.user\s*(\?\?|\|\|)?=(?!=)/.test(ligne);
      if (estAffectation) {
        ecritures.push(`${path.relative(RACINE, fichier)}:${index + 1}: ${ligne.trim()}`);
      }
    });
  }

  assert.ok(ecritures.length > 0, 'le test doit bien trouver des écritures, sinon il ne prouve rien');

  for (const ecriture of ecritures) {
    // Windows : path.relative produit des antislashs — on compare sans tenir
    // compte du séparateur de dossier.
    const cheminNormalise = ecriture.replaceAll(path.sep, '/');
    assert.ok(
      cheminNormalise.startsWith('src/middleware/auth.js:'),
      `Écriture de req.user hors du middleware d'authentification : ${ecriture}`,
    );
  }
});

test('structurel — toute écriture de `req.user` dérive du jeton, pas de la requête', async () => {
  const source = await fs.readFile(path.join(RACINE, 'src/middleware/auth.js'), 'utf8');
  const lignes = source.split('\n');
  const ecritures = lignes.filter((l) => /req\.user\s*=(?!=)/.test(l));

  assert.equal(ecritures.length, 2, 'deux écritures attendues (authenticate, optionalAuth)');
  for (const ligne of ecritures) {
    assert.match(
      ligne,
      /resolveUser\(token\)/,
      `req.user doit venir de resolveUser(token) : ${ligne.trim()}`,
    );
    // Aucun accès direct au corps, à la query ou à un en-tête arbitraire.
    assert.doesNotMatch(ligne, /req\.(body|query|params)/, ligne.trim());
  }
});

/**
 * `extractToken` est la seule porte d'entrée du jeton. S'il se mettait à lire
 * autre chose que l'en-tête `Authorization` — un cookie, un champ du corps — le
 * raccourci deviendrait exploitable.
 */
test('structurel — le jeton ne vient que de l’en-tête Authorization', async () => {
  const source = await fs.readFile(path.join(RACINE, 'src/middleware/auth.js'), 'utf8');
  const debut = source.indexOf('const extractToken');
  const fin = source.indexOf('};', debut);
  const corps = source.slice(debut, fin);

  assert.match(corps, /req\.headers\.authorization/, 'doit lire l’en-tête Authorization');
  assert.doesNotMatch(corps, /req\.(body|query|params|cookies)/, 'ne doit lire ni corps, ni query, ni cookie');
});

/* ═══════════════ niveau fonctionnel ═══════════════ */

/** Fabrique une requête Express minimale portant les vecteurs de forge. */
const requeteForgee = (surcharge = {}) => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  cookies: {},
  ...surcharge,
});

/** Renvoie l'erreur passée à `next`, ou `null` si le middleware a laissé passer. */
const lancer = (req) =>
  new Promise((resoudre) => {
    authenticate(req, { status: () => ({ json: () => {} }) }, (erreur) => resoudre(erreur ?? null));
  });

const VECTEURS = [
  ['corps `user`', { body: { user: { id: 'usr_forge', roles: ['PRODUCER'] } } }],
  ['corps `userId`', { body: { userId: 'usr_forge' } }],
  ['query `user`', { query: { user: 'usr_forge' } }],
  ['params `user`', { params: { user: 'usr_forge' } }],
  ['cookies `user`', { cookies: { user: 'usr_forge' } }],
  ['en-tête x-user', { headers: { 'x-user': '{"id":"usr_forge"}' } }],
  ['en-tête x-user-id', { headers: { 'x-user-id': 'usr_forge' } }],
  ['en-tête x-authenticated', { headers: { 'x-authenticated': 'true' } }],
  ['en-tête x-forwarded-user', { headers: { 'x-forwarded-user': 'usr_forge' } }],
  ['tous en même temps', {
    headers: { 'x-user-id': 'usr_forge', 'x-authenticated': 'true' },
    body: { user: { id: 'usr_forge' } },
    query: { user: 'usr_forge' },
    cookies: { user: 'usr_forge' },
  }],
];

for (const [libelle, surcharge] of VECTEURS) {
  test(`fonctionnel — forge par ${libelle} : refusé en 401`, async () => {
    const req = requeteForgee(surcharge);
    const erreur = await lancer(req);

    assert.ok(erreur, `${libelle} : authenticate n'aurait pas dû laisser passer`);
    assert.equal(erreur.status, 401, `${libelle} : statut`);
    assert.equal(erreur.code, 'UNAUTHORIZED', `${libelle} : code`);
    assert.equal(req.user, undefined, `${libelle} : req.user ne doit pas être posé`);
  });
}

test('fonctionnel — Authorization sans schéma Bearer : refusé', async () => {
  const erreur = await lancer(requeteForgee({ headers: { authorization: 'usr_forge' } }));
  assert.equal(erreur?.status, 401);
});

test('fonctionnel — Authorization: Bearer vide : refusé', async () => {
  // `'Bearer '.slice(7).trim()` vaut '' : sans garde, on appellerait Supabase
  // avec un jeton vide au lieu de refuser tout de suite.
  const erreur = await lancer(requeteForgee({ headers: { authorization: 'Bearer   ' } }));
  assert.equal(erreur?.status, 401);
  assert.match(erreur.message, /manquant/);
});

/**
 * Le raccourci lui-même : il ne doit se déclencher que si `req.user` est déjà
 * posé **par un middleware d'authentification**, ce que le niveau structurel
 * garantit. On vérifie ici son comportement, pour que toute modification du
 * raccourci soit visible.
 */
test('fonctionnel — le raccourci laisse passer un `req.user` déjà résolu', async () => {
  const dejaResolu = { id: 'usr_reel', roles: ['PRODUCER'] };
  const req = requeteForgee();
  req.user = dejaResolu; // posé par un middleware d'authentification en amont
  const erreur = await lancer(req);
  assert.equal(erreur, null, 'aucune erreur attendue');
  assert.equal(req.user, dejaResolu, 'l’objet résolu n’est pas remplacé');
});
