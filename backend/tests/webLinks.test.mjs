/**
 * Les liens web construits par le backend atteignent une route réelle.
 *
 * ## Le défaut couvert
 *
 * Trois URL étaient construites en dur dans les services et **aucune** ne
 * correspondait à une route du client web :
 *
 * | Construit côté backend              | Route web réelle       |
 * | ----------------------------------- | ---------------------- |
 * | `${PUBLIC_WEB_URL}/verify-email`    | `/auth/verify-email`   |
 * | `${PUBLIC_WEB_URL}/reset-password`  | `/auth/reset`          |
 * | `${PUBLIC_WEB_URL}/farm/:slug`      | `/public/farms/:slug`  |
 *
 * Le routeur web se termine par `<Route path="*" element={<AppNotFound />} />`.
 * Un chemin faux ne produit donc **aucune erreur visible** : l'e-mail part, le
 * lien s'ouvre, l'utilisateur arrive sur « page introuvable », et le jeton de
 * vérification n'a plus nulle part où être saisi.
 *
 * ## Portée
 *
 * Test **structurel** : il lit `CHEMINS_WEB` et les `<Route path=…>` déclarés
 * dans `apps/web/src/App.tsx`. Il ne lance ni navigateur ni serveur. Le fait
 * que la page s'affiche et vérifie le jeton n'est pas prouvé ici.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lire = (relatif) => fs.readFile(path.join(RACINE, relatif), 'utf8');

const { CHEMINS_WEB, lienWeb, lienProfilFerme, lienVerificationEmail } = await import(
  '../src/shared/links.js'
);

/** Routes déclarées dans le routeur web. */
const routesWeb = async () => {
  const source = await lire('apps/web/src/App.tsx');
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
};

test('liens web — chaque chemin construit par le backend existe dans le routeur', async () => {
  const routes = await routesWeb();
  assert.ok(routes.length > 100, `routeur web anormalement petit (${routes.length} routes)`);

  const manquants = [];
  for (const [cle, chemin] of Object.entries(CHEMINS_WEB)) {
    if (!routes.includes(chemin)) {
      const proche = routes.filter((r) => r.includes(chemin.split('/').pop()));
      manquants.push(`${cle} → « ${chemin} » absent${proche.length ? ` (routes proches : ${proche.join(', ')})` : ''}`);
    }
  }
  assert.deepEqual(
    manquants,
    [],
    `Chemins sans route correspondante — l'utilisateur tomberait sur AppNotFound :\n  ${manquants.join('\n  ')}`,
  );
});

/**
 * Sans cette garde, un nouveau service peut réintroduire
 * `` `${env.PUBLIC_WEB_URL}/...` `` en dur et la dérive recommence sans que
 * rien ne le signale.
 */
test('liens web — plus aucune URL web construite en dur hors `links.js`', async () => {
  const fautifs = [];
  const parcourir = async (relatif) => {
    const absolu = path.join(RACINE, relatif);
    for (const entree of await fs.readdir(absolu, { withFileTypes: true })) {
      if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue;
      const complet = path.join(absolu, entree.name);
      const suivant = path.join(relatif, entree.name);
      if (entree.isDirectory()) await parcourir(suivant);
      else if (/\.js$/.test(entree.name) && !suivant.endsWith('shared/links.js')) {
        const source = (await lire(suivant)).replace(/\/\*[\s\S]*?\*\//g, '');
        if (/PUBLIC_WEB_URL\}\s*\/|PUBLIC_WEB_URL\s*\+\s*['"]\//.test(source)) fautifs.push(suivant);
      }
    }
  };
  await parcourir('backend/src');
  assert.deepEqual(
    fautifs,
    [],
    `URL web construites en dur (utiliser lienWeb) :\n  ${fautifs.join('\n  ')}`,
  );
});

test('liens web — `lienWeb` encode les segments et refuse un paramètre manquant', async () => {
  // `PUBLIC_WEB_URL` vaut `http://localhost:5173` dans l'environnement de test.
  assert.equal(lienVerificationEmail(), 'http://localhost:5173/auth/verify-email');

  const url = lienProfilFerme('ferme mbongi/2');
  assert.equal(url, 'http://localhost:5173/public/farms/ferme%20mbongi%2F2');

  /*
   * Un slug absent ne doit pas produire `/public/farms/:slug` dans un QR code
   * ou une balise canonique : ce serait un lien mort imprimé.
   */
  assert.throws(() => lienProfilFerme(''), /paramètre « slug » manquant/);
  assert.throws(() => lienProfilFerme(undefined), /paramètre « slug » manquant/);
});

/**
 * Une barre oblique finale dans `PUBLIC_WEB_URL` produirait
 * `http://hôte//auth/verify-email`. Certains clients de messagerie coupent ou
 * refusent ces URL.
 */
test('liens web — une barre oblique finale dans PUBLIC_WEB_URL ne double pas le séparateur', async () => {
  const source = await lire('backend/src/shared/links.js');
  assert.match(
    source,
    /replace\(\/\\\/\+\$\/, ''\)/,
    'la barre oblique finale de PUBLIC_WEB_URL doit être retirée',
  );
});

/* ─────────────────────── côté mobile ─────────────────────── */

/**
 * Les écrans mobiles existent, mais l'e-mail transporte une URL `https://`.
 *
 * Sans **liens universels** (iOS `associatedDomains`) ni **App Links**
 * (Android `intentFilters`), une URL `https://` ouvre le navigateur, pas
 * l'application. Le test le vérifie pour que la situation soit **documentée
 * par un résultat** plutôt que supposée : si quelqu'un configure un jour les
 * domaines associés, ce test l'indiquera et le compte rendu devra changer.
 */
test('lien profond mobile — état réel, vérifié et non supposé', async () => {
  const app = JSON.parse(await lire('apps/Mobile/app.json'));
  const expo = app.expo ?? app;

  assert.equal(
    typeof expo.scheme,
    'string',
    'un schéma personnalisé est déclaré — il ne suffit pas pour une URL https://',
  );

  const domainesAssocies = expo.ios?.associatedDomains;
  const intentFilters = expo.android?.intentFilters;
  const lienProfond = Boolean(domainesAssocies?.length) || Boolean(intentFilters?.length);

  /*
   * Assertion volontairement **descriptive** : elle fixe l'état constaté au
   * moment de l'écriture. Elle échouera le jour où un lien profond sera
   * configuré — et c'est voulu : il faudra alors mettre à jour le compte
   * rendu, qui affirme que l'e-mail n'ouvre pas l'application.
   */
  assert.equal(
    lienProfond,
    false,
    'un lien profond est désormais configuré : mettre à jour le compte rendu — '
    + 'l’URL de l’e-mail ouvre peut-être maintenant l’application',
  );

  // Les écrans mobiles existent : le parcours est atteignable **dans** l'app.
  for (const ecran of ['verify-email.tsx', 'reset-password.tsx', 'mfa.tsx']) {
    await fs.stat(path.join(RACINE, 'apps/Mobile/src/app/auth', ecran));
  }
});
