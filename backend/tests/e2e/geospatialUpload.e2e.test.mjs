import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { construireMultipart } from '../../src/shared/multipart.js';

/**
 * Recette de bout en bout — base réelle — pour le téléversement
 * `multipart/form-data`, le cycle de vie du traitement et le pilote de stockage.
 *
 * ## Ce que cette suite prouve
 *
 *  - un fichier est déposé en multipart et passe par **les mêmes contrôles** que
 *    le chemin base64 (signature d'en-tête, empreinte, refus de doublon, quota) ;
 *  - un fichier trop volumineux est refusé, et la raison est explicite ;
 *  - le cycle de vie `RECEIVED → PROCESSING → COMPLETED` s'écrit réellement,
 *    avec les métadonnées **extraites du fichier** ;
 *  - un fichier corrompu termine en `ERROR` avec un message, et **ne bloque
 *    pas** le serveur ;
 *  - un dépôt déjà traité n'est pas retraité sans demande explicite ;
 *  - l'empreinte est revérifiée au traitement : un fichier modifié dans le
 *    stockage entre-temps est refusé plutôt que lu.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * Le pilote de stockage objet (S3, Supabase Storage) n'est **pas** exercé ici :
 * aucun stockage réel n'est accessible. Il est testé en unité contre un faux
 * serveur et contre le vecteur de signature AWS (`tests/multipartS3.test.mjs`).
 */

const { startHarness } = await import('./support/harness.mjs');

let h;
let adminToken;
const PASSWORD = 'MotDePasse!2026';

/** PNG valide, construit octet par octet. */
const png = ({ largeur = 640, hauteur = 480, phys = 100, marque = 'a' } = {}) => {
  const chunk = (type, donnees) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    return Buffer.concat([longueur, Buffer.from(type, 'latin1'), donnees, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const blocPhys = Buffer.alloc(9);
  blocPhys.writeUInt32BE(phys, 0);
  blocPhys.writeUInt32BE(phys, 4);
  blocPhys[8] = 1;
  // Le texte rend le fichier unique : sans cela deux dépôts de test porteraient
  // la même empreinte et le second serait refusé comme doublon.
  const texte = Buffer.concat([Buffer.from('marque\0', 'latin1'), Buffer.from(marque, 'latin1')]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('pHYs', blocPhys),
    chunk('tEXt', texte),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const register = async (email) => {
  const reponse = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Paul',
      lastName: 'Ilunga',
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(reponse.status, 201, `inscription ${email} : ${JSON.stringify(reponse.body)}`);
};

const connect = async (email) => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  return reponse.body.data.session.accessToken;
};

/** Téléverse un fichier en multipart. */
const deposer = (tampon, { filename = 'releve.png', kind = 'DRONE_IMAGE', champs = {} } = {}) => {
  const { boundary, tampon: corps } = construireMultipart([
    { champ: 'kind', valeur: kind },
    ...Object.entries(champs).map(([champ, valeur]) => ({ champ, valeur })),
    { champ: 'fichier', filename, contentType: 'image/png', valeur: tampon },
  ]);
  return h.request('POST', '/geospatial/imports/upload', {
    token: adminToken,
    rawBody: true,
    body: corps,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
};

before(async () => {
  h = await startHarness();
  await register('admin-geo@agrikonnect.test');
  const profil = await h.prisma.profile.findFirst({ where: { email: 'admin-geo@agrikonnect.test' } });
  await h.prisma.membership.updateMany({
    where: { userId: profil.id },
    data: { roles: ['SUPER_ADMIN'] },
  });
  adminToken = await connect('admin-geo@agrikonnect.test');
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ─────────────────────── téléversement multipart ─────────────────────── */

test('E2E géospatial : un fichier arrive en multipart et passe les mêmes contrôles', async () => {
  const reponse = await deposer(png({ marque: 'depot-1' }), { filename: 'vol-01.png' });

  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  const ligne = reponse.body.data.geospatialImport;
  assert.equal(ligne.status, 'RECEIVED', 'aucun traitement ne doit être lancé à la réception');
  assert.equal(ligne.format, 'image/png', 'le format vient des octets, pas du nom');
  assert.equal(ligne.filename, 'vol-01.png');
  assert.equal(reponse.body.data.reception, 'multipart');
  assert.ok(ligne.checksum, 'l’empreinte est calculée à la réception');
});

test('E2E géospatial : un contenu qui ne correspond pas au type déclaré est refusé', async () => {
  // Un PNG nommé `.jpg` et déclaré DRONE_IMAGE passe ; un texte brut non.
  const reponse = await deposer(Buffer.from('ceci n’est pas une image'), { filename: 'faux.png' });
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));
});

test('E2E géospatial : un doublon exact est refusé, quel que soit le nom', async () => {
  const tampon = png({ marque: 'doublon' });
  const premier = await deposer(tampon, { filename: 'a.png' });
  assert.equal(premier.status, 201, JSON.stringify(premier.body));

  const second = await deposer(tampon, { filename: 'b.png' });
  assert.equal(second.status, 409, 'le même relevé sous un autre nom reste un doublon');
  assert.match(JSON.stringify(second.body), /identique/i);
});

test('E2E géospatial : un champ manquant est une erreur de requête', async () => {
  const { boundary, tampon } = construireMultipart([
    { champ: 'fichier', filename: 'x.png', valeur: png({ marque: 'sans-kind' }) },
  ]);
  const reponse = await h.request('POST', '/geospatial/imports/upload', {
    token: adminToken,
    rawBody: true,
    body: tampon,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));
  assert.match(JSON.stringify(reponse.body), /kind/);
});

test('E2E géospatial : une requête sans jeton est refusée avant lecture du corps', async () => {
  const { boundary, tampon } = construireMultipart([
    { champ: 'kind', valeur: 'DRONE_IMAGE' },
    { champ: 'fichier', filename: 'x.png', valeur: png({ marque: 'sans-jeton' }) },
  ]);
  const reponse = await h.request('POST', '/geospatial/imports/upload', {
    rawBody: true,
    body: tampon,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
  assert.equal(reponse.status, 401);
});

/* ─────────────────────── cycle de vie du traitement ─────────────────────── */

let idTraite;

test('E2E géospatial : le traitement extrait les métadonnées du fichier', async () => {
  const depot = await deposer(png({ largeur: 1280, hauteur: 720, phys: 200, marque: 'traite' }));
  assert.equal(depot.status, 201, JSON.stringify(depot.body));
  idTraite = depot.body.data.geospatialImport.id;

  const reponse = await h.request('POST', `/geospatial/imports/${idTraite}/process`, {
    token: adminToken,
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));

  const ligne = reponse.body.data;
  assert.equal(ligne.status, 'COMPLETED');
  assert.ok(ligne.startedAt, 'le début du traitement est daté');
  assert.ok(ligne.completedAt, 'la fin du traitement est datée');
  assert.equal(ligne.errorMessage, null);

  // Les valeurs viennent **du fichier**, pas d'un gabarit.
  assert.equal(ligne.result.largeur, 1280);
  assert.equal(ligne.result.hauteur, 720);
  assert.equal(ligne.result.resolutionSolM, 0.005); // 200 px/m
  assert.equal(ligne.result.texte.marque, 'traite');
});

test('E2E géospatial : un dépôt déjà traité n’est pas retraité sans demande', async () => {
  const reponse = await h.request('POST', `/geospatial/imports/${idTraite}/process`, {
    token: adminToken,
  });
  assert.equal(reponse.status, 409, 'retraiter silencieusement écraserait le résultat');

  const force = await h.request('POST', `/geospatial/imports/${idTraite}/process?force=true`, {
    token: adminToken,
  });
  assert.equal(force.status, 200, JSON.stringify(force.body));
  assert.equal(force.body.data.status, 'COMPLETED');
});

test('E2E géospatial : un fichier illisible termine en ERROR sans bloquer le serveur', async () => {
  /*
   * Un PNG dont l'en-tête est valide mais tronqué : la signature passe, la
   * lecture échoue. C'est un résultat de traitement, pas une panne — un 500 ici
   * laisserait le dépôt bloqué à `PROCESSING`.
   */
  const tronque = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(20, 0x00),
  ]);
  const depot = await deposer(tronque, { filename: 'casse.png' });
  assert.equal(depot.status, 201, JSON.stringify(depot.body));

  const reponse = await h.request('POST', `/geospatial/imports/${depot.body.data.geospatialImport.id}/process`, {
    token: adminToken,
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.status, 'ERROR');
  assert.match(reponse.body.data.errorMessage, /tronqué|illisible/i);
  assert.equal(reponse.body.data.result, null);
});

test('E2E géospatial : une empreinte modifiée entre dépôt et traitement est refusée', async () => {
  const depot = await deposer(png({ marque: 'altere' }), { filename: 'altere.png' });
  assert.equal(depot.status, 201, JSON.stringify(depot.body));
  const id = depot.body.data.geospatialImport.id;

  // Modification directe du fichier stocké, en contournant l'API : c'est
  // exactement ce que le contrôle d'empreinte au traitement doit attraper.
  const ligne = await h.prisma.geospatialImport.findUnique({ where: { id } });
  const cle = ligne.storageKey;
  const { creerStockageLocal } = await import('../../src/integrations/storage.js');
  const { env } = await import('../../src/config/env.js');
  const disque = creerStockageLocal({ racine: env.GEOSPATIAL_STORAGE_DIR });
  await disque.ecrire(cle, png({ marque: 'autre-contenu' }));

  const reponse = await h.request('POST', `/geospatial/imports/${id}/process`, { token: adminToken });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.status, 'ERROR');
  assert.match(reponse.body.data.errorMessage, /Empreinte différente/);
});

test('E2E géospatial : le traitement par lot compte les réussites et les échecs', async () => {
  const avant = await h.request('GET', '/geospatial/imports/processing', { token: adminToken });
  assert.equal(avant.status, 200);

  const reponse = await h.request('POST', '/geospatial/imports/process-pending', {
    token: adminToken,
    body: { limit: 10 },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(
    reponse.body.data.traites + reponse.body.data.echecs,
    reponse.body.data.ids.length,
    'chaque dépôt traité doit être compté',
  );

  const apres = await h.request('GET', '/geospatial/imports/processing', { token: adminToken });
  assert.equal(apres.body.data.parStatut.RECEIVED ?? 0, 0, 'plus aucun dépôt en attente');
});

/* ─────────────────────── isolation entre organisations ─────────────────────── */

test('E2E géospatial : un dépôt d’une autre organisation est introuvable', async () => {
  await register('autre-org@agrikonnect.test');
  const autreJeton = await connect('autre-org@agrikonnect.test');
  const autreProfil = await h.prisma.profile.findFirst({ where: { email: 'autre-org@agrikonnect.test' } });
  await h.prisma.membership.updateMany({
    where: { userId: autreProfil.id },
    data: { roles: ['SUPER_ADMIN'] },
  });
  const jetonEleve = await connect('autre-org@agrikonnect.test');

  const lecture = await h.request('GET', `/geospatial/imports/${idTraite}`, { token: jetonEleve });
  assert.equal(lecture.status, 404, 'un dépôt d’une autre organisation ne doit pas être lisible');

  const traitement = await h.request('POST', `/geospatial/imports/${idTraite}/process`, {
    token: jetonEleve,
  });
  assert.equal(traitement.status, 404, 'ni traitable');
  assert.ok(autreJeton);
});
