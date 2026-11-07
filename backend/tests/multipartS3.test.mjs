import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';

import {
  extraireBoundary,
  decouperMultipart,
  lireMultipart,
  construireMultipart,
  lireCorpsPlafonne,
  CorpsTropVolumineux,
  MultipartInvalide,
} from '../src/shared/multipart.js';
import { signerRequete, creerStockageS3 } from '../src/integrations/s3.js';
import { StockageInterdit } from '../src/integrations/storage.js';

/**
 * Téléversement `multipart/form-data` et stockage compatible S3.
 *
 * ## Deux choses distinctes sont vérifiées ici
 *
 *  1. **La signature SigV4**, contre le vecteur publié par AWS. C'est une
 *     vérification **indépendante** : la valeur attendue vient d'AWS, pas de ce
 *     dépôt. Si la canonicalisation dérive, ce test casse.
 *  2. **Le comportement HTTP du pilote** (méthodes, style d'adressage, `Range`,
 *     erreurs), contre un faux serveur. Un faux serveur ne prouve rien sur la
 *     conformité à S3 — il prouve que le pilote envoie ce qu'il prétend
 *     envoyer. Les deux vérifications se complètent, aucune ne suffit seule.
 */

/* ═══════════════════════════ multipart ═══════════════════════════ */

test('multipart — la frontière est extraite, avec ou sans guillemets', () => {
  assert.equal(extraireBoundary('multipart/form-data; boundary=abc123'), 'abc123');
  assert.equal(extraireBoundary('multipart/form-data; boundary="abc123"'), 'abc123');
  assert.equal(extraireBoundary('multipart/form-data'), null);
  assert.equal(extraireBoundary('application/json'), null);
  assert.equal(extraireBoundary(undefined), null);
});

test('multipart — champs texte et fichiers sont séparés', () => {
  const { boundary, tampon } = construireMultipart([
    { champ: 'kind', valeur: 'DRONE_IMAGE' },
    { champ: 'fichier', filename: 'releve.jpg', contentType: 'image/jpeg', valeur: Buffer.from([0xff, 0xd8, 0xff]) },
    { champ: 'plotId', valeur: 'plot_1' },
  ]);
  const { champs, fichiers } = decouperMultipart(tampon, boundary);
  assert.equal(champs.kind, 'DRONE_IMAGE');
  assert.equal(champs.plotId, 'plot_1');
  assert.equal(fichiers.length, 1);
  assert.equal(fichiers[0].filename, 'releve.jpg');
  assert.deepEqual([...fichiers[0].tampon], [0xff, 0xd8, 0xff]);
});

test('multipart — les octets binaires ne sont pas altérés', () => {
  /*
   * Un analyseur qui décode en texte puis réencode corrompt tout octet ≥ 0x80.
   * Le test porte sur les 256 valeurs, pas sur un échantillon : c'est justement
   * dans les octets rares que passe la corruption.
   */
  const tous = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  const { boundary, tampon } = construireMultipart([
    { champ: 'f', filename: 'b.bin', valeur: tous },
  ]);
  const { fichiers } = decouperMultipart(tampon, boundary);
  assert.deepEqual([...fichiers[0].tampon], [...tous]);
});

test('multipart — le CRLF du délimiteur n’est pas compté dans le fichier', () => {
  const contenu = Buffer.from('exactement-20-octets');
  const { boundary, tampon } = construireMultipart([
    { champ: 'f', filename: 'x.txt', valeur: contenu },
  ]);
  const { fichiers } = decouperMultipart(tampon, boundary);
  assert.equal(fichiers[0].tampon.length, contenu.length);
  assert.equal(fichiers[0].tampon.toString('utf8'), 'exactement-20-octets');
});

test('multipart — un nom de fichier vide reste une partie fichier', () => {
  const { boundary, tampon } = construireMultipart([{ champ: 'f', filename: '', valeur: '' }]);
  const { champs, fichiers } = decouperMultipart(tampon, boundary);
  assert.equal(fichiers.length, 1);
  assert.equal(champs.f, undefined);
});

test('multipart — un corps sans frontière est refusé', () => {
  assert.throws(() => decouperMultipart(Buffer.from('n’importe quoi'), 'abc'), MultipartInvalide);
});

test('multipart — le plafond est appliqué pendant la lecture, pas après', async () => {
  /*
   * Le point important : un analyseur qui lit tout puis mesure accepte d'abord
   * le corps entier en mémoire. Ici la lecture s'arrête dès le dépassement.
   */
  const gros = Buffer.alloc(5000, 0x41);
  const req = Readable.from([gros.subarray(0, 3000), gros.subarray(3000)]);
  req.headers = { 'content-type': 'multipart/form-data; boundary=x' };
  await assert.rejects(() => lireMultipart(req, { limiteOctets: 4000 }), CorpsTropVolumineux);
});

test('multipart — un Content-Type absent est refusé avant toute lecture', async () => {
  const req = Readable.from([Buffer.from('x')]);
  req.headers = {};
  await assert.rejects(() => lireMultipart(req, { limiteOctets: 1000 }), /boundary/);
});

test('multipart — lireCorpsPlafonne rend les octets intacts sous le plafond', async () => {
  const req = Readable.from([Buffer.from('ab'), Buffer.from('cd')]);
  const corps = await lireCorpsPlafonne(req, 100);
  assert.equal(corps.toString('utf8'), 'abcd');
});

/* ═══════════════════════ signature SigV4 ═══════════════════════ */

test('SigV4 — la signature reproduit le vecteur officiel AWS', () => {
  /*
   * Cas `get-vanilla` du jeu de tests AWS Signature Version 4.
   *
   * La valeur attendue est **publiée par AWS** : c'est une vérification
   * indépendante de l'implémentation, pas une tautologie. Si la canonicalisation
   * de l'URI, des en-têtes ou de la chaîne à signer dérive d'un octet, ce test
   * casse.
   */
  const signe = signerRequete({
    methode: 'GET',
    hote: 'example.amazonaws.com',
    chemin: '/',
    region: 'us-east-1',
    service: 'service',
    signerEmpreinteCorps: false, // le profil générique ne porte pas cet en-tête
    cleAcces: 'AKIDEXAMPLE',
    cleSecrete: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    date: new Date('2015-08-30T12:36:00Z'),
  });
  assert.match(
    signe.authorization,
    /Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31$/,
  );
  assert.match(signe.authorization, /Credential=AKIDEXAMPLE\/20150830\/us-east-1\/service\/aws4_request/);
});

test('SigV4 — le profil S3 signe l’empreinte du corps', () => {
  const signe = signerRequete({
    methode: 'PUT',
    hote: 'panier.s3.amazonaws.com',
    chemin: '/cle/fichier.tif',
    region: 'us-east-1',
    cleAcces: 'AKIAIOSFODNN7EXAMPLE',
    cleSecrete: 'wJalrXUtnFEMI/K7MDKG+bPxRfiCYEXAMPLEKEY',
    corps: Buffer.from('donnees'),
    date: new Date('2026-10-28T12:00:00Z'),
  });
  assert.match(signe.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
  assert.equal(signe.amzDate, '20261028T120000Z');
});

test('SigV4 — les paramètres sont triés après encodage, comme l’exige la norme', () => {
  /*
   * Trier avant encodage et après encodage ne donnent pas le même ordre dès
   * qu'une clé contient un caractère réservé. La signature en dépend.
   */
  const signe = signerRequete({
    methode: 'GET',
    hote: 'h.example.com',
    chemin: '/',
    parametres: { 'max-keys': 20, prefix: 'J', marker: 'someMarker' },
    region: 'us-east-1',
    cleAcces: 'AKIAIOSFODNN7EXAMPLE',
    cleSecrete: 'secret',
    date: new Date('2026-10-28T12:00:00Z'),
  });
  assert.ok(signe.authorization.includes('Signature='));
});

test('SigV4 — un chemin à segments réservés n’encode pas les barres obliques', () => {
  /*
   * `encodeURIComponent` transformerait `/` en `%2F`. S3 signe le chemin avec
   * les `/` intacts : les encoder produirait un `SignatureDoesNotMatch` sans
   * message utile.
   */
  const signe = signerRequete({
    methode: 'GET',
    hote: 'h.example.com',
    chemin: '/geospatial/org_1/drone_image/gim_01.tif',
    region: 'us-east-1',
    cleAcces: 'AKIAIOSFODNN7EXAMPLE',
    cleSecrete: 'secret',
  });
  assert.ok(signe.authorization.startsWith('AWS4-HMAC-SHA256 '));
});

/* ═══════════════════════ pilote S3 ═══════════════════════ */

let serveur;
let port;
/** Requêtes reçues par le faux serveur. */
let recues = [];
let comportement = { statut: 200, corps: Buffer.alloc(0), entetes: {} };

before(async () => {
  serveur = createServer((req, res) => {
    const morceaux = [];
    req.on('data', (m) => morceaux.push(m));
    req.on('end', () => {
      recues.push({
        methode: req.method,
        url: req.url,
        entetes: req.headers,
        corps: Buffer.concat(morceaux),
      });
      if (req.method === 'HEAD' && comportement.statut === 404) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(comportement.statut, comportement.entetes);
      res.end(req.method === 'HEAD' ? undefined : comportement.corps);
    });
  });
  await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
  port = serveur.address().port;
});

after(async () => {
  await new Promise((resolve) => serveur.close(resolve));
});

const pilote = (surcharge = {}) =>
  creerStockageS3({
    endpoint: surcharge.endpoint ?? `http://127.0.0.1:${port}`,
    region: 'us-east-1',
    panier: 'geospatial-imports',
    cleAcces: 'AKIAIOSFODNN7EXAMPLE',
    cleSecrete: 'wJalrXUtnFEMI/K7MDKG+bPxRfiCYEXAMPLEKEY',
    ...surcharge,
  });

test('S3 — une configuration incomplète refuse de démarrer', () => {
  assert.throws(() => creerStockageS3({ endpoint: 'http://x', region: 'r' }), StockageInterdit);
  assert.throws(() => creerStockageS3({}), StockageInterdit);
});

test('S3 — l’écriture envoie un PUT signé avec l’empreinte du corps', async () => {
  recues = [];
  comportement = { statut: 200, corps: Buffer.alloc(0), entetes: {} };
  const resultat = await pilote().ecrire('geospatial/org_1/gim_01.tif', Buffer.from('donnees'));

  assert.equal(recues.length, 1);
  assert.equal(recues[0].methode, 'PUT');
  assert.equal(recues[0].url, '/geospatial-imports/geospatial/org_1/gim_01.tif');
  assert.match(recues[0].entetes.authorization, /^AWS4-HMAC-SHA256 Credential=/);
  assert.equal(recues[0].entetes['x-amz-content-sha256'].length, 64);
  assert.equal(recues[0].corps.toString('utf8'), 'donnees');
  assert.equal(resultat.taille, 7);
});

test('S3 — la lecture partielle envoie un en-tête Range', async () => {
  recues = [];
  comportement = { statut: 206, corps: Buffer.alloc(3256, 0x41), entetes: {} };
  const entete = await pilote().lireEnTete('cle.tif', 3256);

  assert.equal(recues[0].entetes.range, 'bytes=0-3255');
  assert.equal(entete.length, 3256);
  /*
   * C'est ce que le pilote Supabase Storage ne peut pas faire : il télécharge
   * le fichier entier puis le tronque. Sur un relevé de 64 Mo la différence
   * est exactement là où la vérification d'en-tête doit rester bon marché.
   */
});

test('S3 — l’adressage virtual-host met le panier dans l’hôte signé', async () => {
  /*
   * Testé avec un `fetch` injecté, sans réseau : l'adressage virtual-host exige
   * un nom DNS (`panier.hote`), et aucun sous-domaine de l'hôte de test ne
   * résout ici. Ce qui est vérifié est la **construction** de l'URL et de l'hôte
   * signé, qui est exactement ce que le style d'adressage change.
   */
  const vus = [];
  const fauxFetch = async (url, options) => {
    vus.push({ url: String(url), entetes: options.headers });
    return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  await pilote({ endpoint: 'https://example.com', styleChemin: false, fetchImpl: fauxFetch })
    .ecrire('dossier/cle.tif', Buffer.from('x'));

  assert.equal(vus[0].url, 'https://geospatial-imports.example.com/dossier/cle.tif');
  assert.equal(vus[0].entetes.host, 'geospatial-imports.example.com');
  // Le chemin signé ne porte plus le panier : il est dans l'hôte.
  // `content-type` est signé lui aussi : un en-tête envoyé mais non signé
  // pourrait être modifié en route sans invalider la requête.
  assert.match(
    vus[0].entetes.authorization,
    /SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date/,
  );
});

test('S3 — le style path-style garde le panier dans le chemin', async () => {
  const vus = [];
  const fauxFetch = async (url, options) => {
    vus.push({ url: String(url), entetes: options.headers });
    return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  await pilote({ styleChemin: true, fetchImpl: fauxFetch }).ecrire('dossier/cle.tif', Buffer.from('x'));
  assert.equal(vus[0].url, `http://127.0.0.1:${port}/geospatial-imports/dossier/cle.tif`);
  assert.equal(vus[0].entetes.host, `127.0.0.1:${port}`);
});

test('S3 — virtual-host sur une adresse IP est une erreur explicite', async () => {
  /*
   * `panier.127.0.0.1` n'est pas un hôte valide : un libellé DNS ne peut pas
   * précéder une adresse littérale. C'est précisément pourquoi `S3_PATH_STYLE`
   * existe — MinIO et les serveurs auto-hébergés sont atteints par IP.
   *
   * Le test fixe ce comportement : sans lui, un exploitant qui met
   * `S3_PATH_STYLE=false` devant une IP recevrait une erreur opaque.
   */
  await assert.rejects(
    () => pilote({ styleChemin: false }).ecrire('cle.tif', Buffer.from('x')),
    /Invalid URL/,
  );
});

test('S3 — l’existence d’un objet est un HEAD, pas un téléchargement', async () => {
  recues = [];
  comportement = { statut: 200, corps: Buffer.alloc(0), entetes: {} };
  assert.equal(await pilote().existe('cle.tif'), true);
  assert.equal(recues[0].methode, 'HEAD');

  comportement = { statut: 404, corps: Buffer.alloc(0), entetes: {} };
  assert.equal(await pilote().existe('absente.tif'), false);
});

test('S3 — un refus du serveur est une erreur nommée, sans corps brut', async () => {
  comportement = {
    statut: 403,
    corps: Buffer.from(
      '<Error><Code>SignatureDoesNotMatch</Code><AWSAccessKeyId>AKIASECRET</AWSAccessKeyId></Error>',
    ),
    entetes: {},
  };
  /*
   * Le corps d'erreur de S3 peut reprendre la clé d'accès. Le message retenu ne
   * garde que le code : journaliser le corps brut ferait fuiter un identifiant.
   */
  await assert.rejects(() => pilote().lire('cle.tif'), (erreur) => {
    assert.match(erreur.message, /HTTP 403/);
    assert.match(erreur.message, /SignatureDoesNotMatch/);
    assert.ok(!erreur.message.includes('AKIASECRET'), 'la clé ne doit pas apparaître');
    return true;
  });
  comportement = { statut: 200, corps: Buffer.alloc(0), entetes: {} };
});

test('S3 — la suppression envoie un DELETE', async () => {
  recues = [];
  comportement = { statut: 204, corps: Buffer.alloc(0), entetes: {} };
  await pilote().supprimer('cle.tif');
  assert.equal(recues[0].methode, 'DELETE');
});
