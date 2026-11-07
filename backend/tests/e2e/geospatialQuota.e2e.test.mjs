import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Recette de bout en bout — base réelle — pour le **quota de dépôt géospatial**.
 *
 * ## Le défaut que cette suite ferme
 *
 * Le contrôle lisait la somme stockée avec `aggregate`, puis créait la ligne.
 * Entre les deux, rien ne verrouillait : deux dépôts arrivés en même temps
 * lisaient la **même** somme et passaient **tous les deux**, dépassant le
 * plafond. Un test séquentiel ne le voyait jamais.
 *
 * ## Ce que cette suite prouve
 *
 *  - deux dépôts concurrents qui, ensemble, dépassent le plafond : **un seul
 *    passe**, l'autre reçoit 413 ;
 *  - ce qui est stocké ne dépasse jamais le plafond ;
 *  - le compteur transactionnel reflète exactement les octets stockés — il ne
 *    dérive ni vers le haut ni vers le bas ;
 *  - le dépôt refusé ne laisse **aucune ligne** derrière lui.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * Aucun fichier n'est **traité** : le dépôt est reçu au statut `RECEIVED` et
 * rien d'autre. Voir `docs/PERIMETRE-BACKEND.md`.
 */

const { startHarness } = await import('./support/harness.mjs');

let h;
let service;
let adminToken;
const PASSWORD = 'MotDePasse!2026';

const TAILLE = 600;
/** Deux fois cette taille : le plafond est volontairement entre les deux. */
const QUOTA = TAILLE + 100;

const register = async ({ email, firstName = 'Paul', lastName = 'Ilunga' }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName,
      lastName,
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/**
 * JPEG valide dont le corps **varie** à chaque appel.
 *
 * Sans cela les deux dépôts porteraient la même empreinte et le second serait
 * refusé par le garde anti-doublon : le test croirait prouver le quota alors
 * qu'il mesurerait autre chose.
 */
const jpeg = (marqueur) => {
  const corps = Buffer.alloc(TAILLE - 4, 0x41);
  corps.write(`depot-${marqueur}`, 0, 'ascii');
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), corps]);
};

const deposer = (marqueur) =>
  h.request('POST', '/geospatial/imports', {
    token: adminToken,
    body: {
      kind: 'DRONE_IMAGE',
      filename: `image-${marqueur}.jpg`,
      contentBase64: jpeg(marqueur).toString('base64'),
    },
  });

before(async () => {
  h = await startHarness();
  service = await import('../../src/modules/geospatialImport/geospatialImport.service.js');

  await register({ email: 'admin-quota@agrikonnect.test' });
  const profil = await h.prisma.profile.findFirst({ where: { email: 'admin-quota@agrikonnect.test' } });
  await h.prisma.membership.updateMany({
    where: { userId: profil.id },
    data: { roles: ['SUPER_ADMIN'] },
  });
  adminToken = await connect('admin-quota@agrikonnect.test');

  /*
   * Plafond abaissé **après** le démarrage : `env` est validé et figé à
   * l'import du module, un test ne peut pas le faire varier autrement.
   */
  service.definirQuota(QUOTA);
}, { timeout: 180_000 });

after(async () => {
  service?.reinitialiserQuota();
  await h?.stop();
});

test('E2E quota : deux dépôts concurrents ne dépassent pas le plafond', async () => {
  // `Promise.all` et non deux appels successifs : c'est l'entrelacement qui
  // déclenche la course, pas la répétition.
  const [premier, second] = await Promise.all([deposer('a'), deposer('b')]);

  const statuts = [premier.status, second.status].sort();
  assert.deepEqual(
    statuts,
    [201, 413],
    `exactement un dépôt doit passer : ${JSON.stringify({ premier: premier.body, second: second.body })}`,
  );

  const refuse = premier.status === 413 ? premier : second;
  assert.match(
    JSON.stringify(refuse.body),
    /quota/i,
    'le refus doit nommer le quota, pas un échec interne',
  );

  const lignes = await h.prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 1, 'le dépôt refusé ne doit laisser aucune ligne');

  const stocke = lignes.reduce((total, ligne) => total + ligne.sizeBytes, 0);
  assert.ok(stocke <= QUOTA, `${stocke} octets stockés, plafond ${QUOTA}`);

  const compteur = await h.prisma.resourceUsage.findMany({});
  assert.equal(compteur.length, 1, 'un seul compteur pour cette organisation');
  assert.equal(
    Number(compteur[0].usedBytes),
    stocke,
    'le compteur doit refléter exactement les octets stockés',
  );
});

test('E2E quota : le compteur ne dérive pas sur les dépôts suivants', async () => {
  service.definirQuota(QUOTA * 10);

  const suite = await deposer('c');
  assert.equal(suite.status, 201, JSON.stringify(suite.body));

  const lignes = await h.prisma.geospatialImport.findMany({});
  const stocke = lignes.reduce((total, ligne) => total + ligne.sizeBytes, 0);
  const compteur = await h.prisma.resourceUsage.findFirst({});

  assert.equal(Number(compteur.usedBytes), stocke, 'le compteur suit le contenu réel');
  assert.equal(lignes.length, 2);
});

test('E2E quota : un dépôt isolé trop volumineux est refusé sans rien réserver', async () => {
  service.definirQuota(10);

  const tropGros = await deposer('d');
  assert.equal(tropGros.status, 413, JSON.stringify(tropGros.body));

  const lignes = await h.prisma.geospatialImport.findMany({});
  const stocke = lignes.reduce((total, ligne) => total + ligne.sizeBytes, 0);
  const compteur = await h.prisma.resourceUsage.findFirst({});

  assert.equal(lignes.length, 2, 'rien ne doit avoir été enregistré');
  assert.equal(Number(compteur.usedBytes), stocke, 'la réservation annulée ne doit pas rester');
});
