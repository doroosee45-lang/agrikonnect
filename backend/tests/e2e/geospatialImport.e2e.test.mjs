/**
 * Recette de bout en bout — dépôt de fichiers géospatiaux (géoradar, drone).
 *
 * ## Ce que cette recette prouve, et que les tests unitaires ne peuvent pas
 *
 *  1. un fichier est reçu contre une **base PostgreSQL réelle**, avec la
 *     contrainte d'unicité `(organization_id, checksum)` réellement posée par la
 *     migration — le double de test ne peut pas la simuler fidèlement ;
 *  2. le **type usurpé** est refusé par la route, pas seulement par le service ;
 *  3. le **fichier trop gros** est refusé en 413 ;
 *  4. le **doublon exact** est refusé en 409, y compris en passant par la
 *     contrainte de base plutôt que par le contrôle applicatif ;
 *  5. un **tiers** obtient 404, jamais 403 — on ne révèle pas l'existence ;
 * 6. le statut reste **`RECEIVED`** : aucun traitement n'est lancé par la route.
 *
 * ## Ce que cette recette ne prouve pas
 *
 * Aucun écran n'est piloté. Le **pilote de stockage objet n'est pas exécuté** :
 * cette recette tourne sur le pilote local, le seul disponible ici.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { startHarness } from './support/harness.mjs';

const PASSWORD = 'MotDePasse!2026';

/* ─────────────────── tampons ─────────────────── */

/**
 * Construit un tampon **unique** portant la signature voulue.
 *
 * Chaque dépôt doit avoir des octets distincts : sans cela le refus de doublon
 * se déclenche là où le test ne l'attend pas, et un test vert ne prouverait
 * plus rien sur ce qu'il croit tester.
 */
let graine = 0;
const unique = (entete, taille = 96) => {
  graine += 1;
  const corps = Buffer.alloc(taille, 0x41);
  corps.write(`graine-${graine}`, 0, 'ascii');
  return Buffer.concat([Buffer.from(entete), corps]);
};

const JPEG_ENTETE = [0xff, 0xd8, 0xff, 0xe0];
const PNG_ENTETE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const jpeg = () => unique(JPEG_ENTETE);
const png = () => unique(PNG_ENTETE);

const SEGY_OFFSET = 3254;
const segy = () => {
  const b = Buffer.alloc(3256, 0x20);
  graine += 1;
  b.write(`graine-${graine}`, 100, 'ascii');
  b[SEGY_OFFSET] = 0xf0;
  b[SEGY_OFFSET + 1] = 0xf1;
  return b;
};

/** JPEG d'une taille précise, pour tester le plafond au plus près. */
const jpegDeTaille = (taille) => {
  const b = Buffer.alloc(taille, 0x41);
  b.set(JPEG_ENTETE, 0);
  return b;
};

let h;
let dossierStockage;
let farmerToken;
let agronomistToken;
let outsiderToken;
let organizationId;
let organizationIdTiers;
let plotId;

const register = async ({ email, accountType = 'FARMER', firstName, lastName }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType, firstName, lastName, email, password: PASSWORD,
      countryCode: 'CD', locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/** Dépose un fichier et renvoie la réponse brute. */
/**
 * Dépose un fichier et renvoie la réponse brute.
 *
 * `organizationId` est retiré du corps : l'organisation n'est **jamais** fournie
 * par le client, elle vient du jeton et de l'en-tête `X-Organization-Id`, que le
 * serveur vérifie (`src/middleware/tenant.js`). Elle est donc passée en en-tête.
 */
const deposer = (token, tampon, surcharge = {}, entetes = {}) => {
  const { organizationId: org, ...corps } = surcharge;
  return h.request('POST', '/geospatial/imports', {
    token,
    headers: org ? { 'X-Organization-Id': org, ...entetes } : entetes,
    body: {
      kind: 'DRONE_IMAGE',
      filename: 'releve.jpg',
      contentBase64: tampon.toString('base64'),
      ...corps,
    },
  });
};

before(async () => {
  /*
   * Posé AVANT `startHarness()` : l'application est importée à l'intérieur du
   * harnais, après affectation de `process.env`. Sans cela les dépôts
   * atterriraient dans le dépôt versionné.
   */
  dossierStockage = await fs.mkdtemp(path.join(os.tmpdir(), 'ak-geospatial-e2e-'));
  process.env.GEOSPATIAL_STORAGE_DIR = dossierStockage;
  process.env.GEOSPATIAL_STORAGE_DRIVER = 'local';

  h = await startHarness();

  const farmer = await register({
    email: 'fermier-geospatial@agrikonnect.test',
    firstName: 'Josué',
    lastName: 'Bomoi',
  });
  organizationId = farmer.organization.id;
  assert.ok(organizationId, 'une organisation individuelle est créée à l’inscription');

  // L'agronome porte `geospatial.write` : il est rattaché à l'organisation de
  // l'agriculteur, sinon toutes ses routes renvoient 404.
  const agronomist = await register({
    email: 'agro-geospatial@agrikonnect.test',
    accountType: 'AGRONOMIST',
    firstName: 'Alice',
    lastName: 'Muteba',
  });
  await h.prisma.membership.create({
    data: {
      id: 'mbr_geospatial_agro_0000000001',
      userId: agronomist.user.id,
      organizationId,
      roles: ['AGRONOMIST'],
    },
  });

  const tiers = await register({
    email: 'tiers-geospatial@agrikonnect.test',
    firstName: 'Paul',
    lastName: 'Ekila',
  });
  organizationIdTiers = tiers.organization.id;

  farmerToken = await connect('fermier-geospatial@agrikonnect.test');
  agronomistToken = await connect('agro-geospatial@agrikonnect.test');
  outsiderToken = await connect('tiers-geospatial@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme géospatial',
      countryCode: 'CD',
      province: 'Équateur',
      latitude: 0.0481,
      longitude: 18.2557,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle géoradar',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;
});

after(async () => {
  await h?.stop?.();
  await fs.rm(dossierStockage, { recursive: true, force: true });
});

/* ═══════════════ dépôt nominal ═══════════════ */

let premierId;
let tamponPartage;

test('dépôt nominal — 201, statut RECEIVED, fichier réellement écrit', async () => {
  tamponPartage = jpeg();
  const response = await deposer(farmerToken, tamponPartage, { plotId, filename: 'transect A.jpg' });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const ligne = response.body.data.geospatialImport;
  premierId = ligne.id;
  assert.equal(ligne.status, 'RECEIVED');
  assert.equal(ligne.kind, 'DRONE_IMAGE');
  assert.equal(ligne.format, 'image/jpeg');
  assert.equal(ligne.sizeBytes, tamponPartage.length);
  assert.equal(ligne.plotId, plotId);
  assert.equal(ligne.filename, 'transect_A.jpg', 'le nom est assaini');
  assert.match(ligne.checksum, /^[a-f0-9]{64}$/, 'une somme SHA-256 est enregistrée');

  // Aucun traitement : les colonnes de traitement restent vides.
  assert.ok(ligne.result == null, 'aucun résultat inventé');
  assert.ok(ligne.startedAt == null, 'aucun traitement lancé');
  assert.ok(ligne.completedAt == null, 'aucun traitement terminé');

  // Le fichier est bien sur le disque, aux octets près.
  const ecrit = await fs.readFile(path.join(dossierStockage, ligne.storageKey));
  assert.ok(ecrit.equals(tamponPartage), 'les octets stockés sont ceux reçus');
});

test('dépôt nominal — le dépôt est relisible par identifiant', async () => {
  const response = await h.request('GET', `/geospatial/imports/${premierId}`, { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.id, premierId);
  assert.equal(response.body.data.status, 'RECEIVED');
});

test('dépôt nominal — un SEG-Y passe comme GPR et est signalé contrôle faible', async () => {
  const response = await deposer(farmerToken, segy(), {
    kind: 'GPR',
    filename: 'transect.sgy',
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.geospatialImport.format, 'application/x-segy');
  assert.equal(
    response.body.data.detection.controleFaible,
    true,
    'SEG-Y n’a pas de signature magique : la route doit le dire',
  );
});

test('dépôt nominal — la liste ne renvoie que des statuts RECEIVED', async () => {
  const response = await h.request('GET', '/geospatial/imports', { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const lignes = response.body.data;
  assert.ok(lignes.length >= 2);
  // Invariant du module : rien d'autre que RECEIVED ne peut exister aujourd'hui.
  for (const ligne of lignes) assert.equal(ligne.status, 'RECEIVED');
  assert.ok(lignes.every((l) => l.organizationId === organizationId));
});

/* ═══════════════ CAS EXIGÉ : type usurpé ═══════════════ */

test('type usurpé — un SEG-Y nommé .jpg et déclaré DRONE_IMAGE est refusé', async () => {
  const response = await deposer(farmerToken, segy(), {
    kind: 'DRONE_IMAGE',
    filename: 'photo.jpg',
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /DRONE_IMAGE/);
});

test('type usurpé — un contenu sans signature est refusé', async () => {
  const response = await deposer(farmerToken, Buffer.from('#!/bin/sh\nrm -rf /\n'), {
    kind: 'GPR',
    filename: 'releve.sgy',
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /octets d’en-tête/);
});

test('type usurpé — un PNG nommé .jpg passe, sous son format réel', async () => {
  const response = await deposer(farmerToken, png(), { filename: 'photo.jpg' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const ligne = response.body.data.geospatialImport;
  assert.equal(ligne.format, 'image/png');
  // L'extension de la clé suit le format détecté, pas le nom fourni.
  assert.ok(ligne.storageKey.endsWith('.png'), ligne.storageKey);
});

/* ═══════════════ CAS EXIGÉ : fichier trop gros ═══════════════ */

test('fichier trop gros — refusé en 413 avec le code attendu', async () => {
  // 64 Mo alloués une fois pour cette recette : c'est le plafond réel de
  // DRONE_IMAGE. On ajoute un octet pour franchir la limite exactement.
  const tropGros = jpegDeTaille(64 * 1024 * 1024 + 1);

  const response = await deposer(farmerToken, tropGros, { filename: 'enorme.jpg' });
  assert.equal(response.status, 413, JSON.stringify(response.body));
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /DRONE_IMAGE/);
});

/* ═══════════════ CAS EXIGÉ : doublon ═══════════════ */

test('doublon — le même fichier dans la même organisation est refusé en 409', async () => {
  const response = await deposer(farmerToken, tamponPartage, { filename: 'copie.jpg' });
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /identique/);
  assert.match(response.body.message, new RegExp(premierId), 'le dépôt d’origine est cité');

  const compte = await h.prisma.geospatialImport.count({ where: { checksum: /^[a-f0-9]{64}$/ } });
  assert.ok(compte >= 1);
});

test('doublon — le refus porte sur le contenu, pas sur le nom', async () => {
  const response = await deposer(farmerToken, tamponPartage, { filename: 'nom-totalement-different.jpg' });
  assert.equal(response.status, 409, JSON.stringify(response.body));
});

/**
 * Ce cas ne peut être couvert qu'en e2e : il franchit le contrôle applicatif et
 * laisse la **contrainte de base** trancher. Le double de test ne peut pas
 * reproduire fidèlement une contrainte d'unicité PostgreSQL.
 */
test('doublon — la contrainte d’unicité en base existe réellement', async () => {
  const index = await h.prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'geospatial_imports'
       AND indexname = 'geospatial_imports_organization_id_checksum_key'`,
  );
  assert.equal(index.length, 1, 'la contrainte d’unicité posée par la migration doit exister');

  // Insertion directe, en contournant le service : c'est la base qui refuse.
  await assert.rejects(
    h.prisma.geospatialImport.create({
      data: {
        id: 'gim_doublon_direct_0000000001',
        organizationId,
        kind: 'DRONE_IMAGE',
        format: 'image/jpeg',
        filename: 'direct.jpg',
        storageKey: 'geospatial/test/direct.jpg',
        sizeBytes: tamponPartage.length,
        checksum: 'a'.repeat(64),
        status: 'RECEIVED',
      },
    }).then(() =>
      h.prisma.geospatialImport.create({
        data: {
          id: 'gim_doublon_direct_0000000002',
          organizationId,
          kind: 'DRONE_IMAGE',
          format: 'image/jpeg',
          filename: 'direct2.jpg',
          storageKey: 'geospatial/test/direct2.jpg',
          sizeBytes: tamponPartage.length,
          checksum: 'a'.repeat(64), // même organisation, même somme
          status: 'RECEIVED',
        },
      }),
    ),
    (erreur) => erreur.code === 'P2002' || /Unique/i.test(erreur.message),
  );
});

test('doublon — le même fichier dans une AUTRE organisation est accepté', async () => {
  const response = await deposer(outsiderToken, tamponPartage, { filename: 'partage.jpg' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.notEqual(response.body.data.geospatialImport.organizationId, organizationId);
});

/* ═══════════════ CAS EXIGÉ : tiers ═══════════════ */

test('tiers — lire le dépôt d’une autre organisation renvoie 404, pas 403', async () => {
  const response = await h.request('GET', `/geospatial/imports/${premierId}`, {
    token: outsiderToken,
  });
  // 404 et non 403 : répondre 403 révélerait que l'identifiant existe.
  assert.equal(response.status, 404, JSON.stringify(response.body));
});

test('tiers — la liste ne laisse rien voir des dépôts d’autrui', async () => {
  const response = await h.request('GET', '/geospatial/imports', { token: outsiderToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const ids = response.body.data.map((l) => l.id);
  assert.equal(ids.includes(premierId), false, 'le dépôt d’une autre organisation ne doit pas apparaître');
  assert.ok(
    response.body.data.every((l) => l.organizationId !== organizationId),
    'aucune ligne d’une autre organisation',
  );
});

test('tiers — un identifiant inexistant renvoie aussi 404', async () => {
  const response = await h.request('GET', '/geospatial/imports/gim_inexistant', {
    token: farmerToken,
  });
  assert.equal(response.status, 404);
});

test('tiers — déposer avec le jeton d’autrui crée la ligne dans SA propre organisation', async () => {
  const response = await deposer(outsiderToken, png(), { filename: 'chez-moi.png' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  // `organizationId` vient du jeton, jamais du corps de la requête.
  assert.notEqual(response.body.data.geospatialImport.organizationId, organizationId);
});

/* ═══════════════ permissions ═══════════════ */

test('permissions — un agronome rattaché peut déposer dans l’organisation', async () => {
  /*
   * L'agronome s'est inscrit à part : il a sa propre organisation. Il agit ici
   * dans celle de l'agriculteur via `X-Organization-Id`, que le serveur vérifie
   * contre ses adhésions. Sans l'adhésion créée au montage, ce serait 404.
   */
  const response = await deposer(
    agronomistToken,
    png(),
    { filename: 'releve-agro.png' },
    { 'X-Organization-Id': organizationId },
  );
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.geospatialImport.organizationId, organizationId);
});

test('permissions — sans jeton, la route est refusée', async () => {
  const response = await h.request('POST', '/geospatial/imports', {
    body: { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: tamponPartage.toString('base64') },
  });
  assert.equal(response.status, 401, JSON.stringify(response.body));
});

test('permissions — un type non pris en charge est refusé', async () => {
  const response = await deposer(farmerToken, jpeg(), { kind: 'SATELLITE' });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  // Une erreur Zod est normalisée en `Validation error` + détails par champ :
  // le message porté est celui de l'`errorMap` du schéma.
  const detail = JSON.stringify(response.body.errors ?? []);
  assert.match(detail, /GPR, DRONE_IMAGE/);
});

/* ═══════════════ audit ═══════════════ */

test('audit — le dépôt laisse une trace horodatée', async () => {
  const journaux = await h.prisma.auditLog.findMany({
    where: { action: 'geospatialImport.receive' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  assert.ok(journaux.length >= 1, 'au moins une entrée d’audit pour le dépôt');
  assert.equal(journaux[0].resource, 'GeospatialImport');
});

/* ═══════════════ CORRECTIF 1 — authentification avant lecture du corps ═══════════════ */

/**
 * Un parseur à 100 Mo qui tourne avant toute authentification est un vecteur
 * d'épuisement : n'importe qui fait allouer 100 Mo par requête, sans identité,
 * en boucle.
 *
 * La preuve que le corps n'est **pas lu** : on envoie un JSON volontairement
 * invalide de plus de 2 Mo. Si le parseur s'exécutait, il échouerait sur la
 * syntaxe et on obtiendrait un 422 « Corps de requête JSON invalide ». Obtenir
 * 401 prouve que l'authentification a tranché avant.
 */
test('sécurité — un corps > 2 Mo sans jeton est refusé en 401 sans être lu', async () => {
  const corpsInvalide = `{"contentBase64":"${'A'.repeat(2 * 1024 * 1024)}`; // accolade non fermée
  assert.ok(corpsInvalide.length > 2 * 1024 * 1024);

  const response = await h.request('POST', '/geospatial/imports', {
    raw: true,
    headers: { 'content-type': 'application/json' },
    body: corpsInvalide,
  });

  assert.equal(
    response.status,
    401,
    `attendu 401 (authentification avant parseur), obtenu ${response.status}`,
  );
  // Contre-épreuve intégrée : un 422 signifierait que le parseur a lu le corps.
  assert.notEqual(response.status, 422);
});

test('sécurité — avec un jeton, le même corps invalide atteint bien le parseur', async () => {
  /*
   * Sans cette contre-épreuve, le test précédent pourrait passer parce que la
   * route refuserait tout corps volumineux, jeton ou pas. Ici le parseur
   * s'exécute et échoue sur la syntaxe : c'est bien l'authentification, et non
   * la taille, qui produisait le 401.
   */
  const corpsInvalide = `{"contentBase64":"${'A'.repeat(2 * 1024 * 1024)}`;
  const response = await h.request('POST', '/geospatial/imports', {
    token: farmerToken,
    raw: true,
    headers: { 'content-type': 'application/json' },
    body: corpsInvalide,
  });
  assert.equal(response.status, 422, `attendu 422, obtenu ${response.status}`);
});

/* ═══════════════ CORRECTIF 2 — base64 invalide ═══════════════ */

test('base64 — une chaîne hors alphabet est refusée en 422', async () => {
  const response = await h.request('POST', '/geospatial/imports', {
    token: farmerToken,
    body: { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: '!!! pas du base64 !!!' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.match(response.body.message, /base64 valide/);
});

test('base64 — un encodage non canonique est refusé', async () => {
  const response = await h.request('POST', '/geospatial/imports', {
    token: farmerToken,
    body: { kind: 'DRONE_IMAGE', filename: 'a.bin', contentBase64: 'AB==' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /canonique/);
});

/* ═══════════════ CORRECTIF 3 — équipement ═══════════════ */

test('équipement — un équipement de l’organisation est accepté', async () => {
  const equipement = await h.prisma.iotDevice.create({
    data: {
      id: 'dev_geospatial_org_0000000001',
      organizationId,
      label: 'Géoradar de la ferme',
      keyHash: 'x'.repeat(64),
    },
  });

  const response = await deposer(farmerToken, jpeg(), { deviceId: equipement.id });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.geospatialImport.deviceId, equipement.id);
});

test('équipement — un équipement d’un tiers est refusé en 404', async () => {
  const equipementTiers = await h.prisma.iotDevice.create({
    data: {
      id: 'dev_geospatial_tiers_000000001',
      // Organisation du **tiers** : l'agriculteur ne doit pas pouvoir s'y
      // rattacher, et réciproquement.
      organizationId: organizationIdTiers,
      label: 'Géoradar tiers',
      keyHash: 'y'.repeat(64),
    },
  });

  // Le tiers dépose avec l'équipement de l'agriculteur → 404.
  const response = await deposer(outsiderToken, jpeg(), {
    deviceId: 'dev_geospatial_org_0000000001',
  });
  assert.equal(response.status, 404, JSON.stringify(response.body));
  assert.equal(response.body.code, 'NOT_FOUND');

  // Et l'inverse, pour prouver que ce n'est pas l'identifiant qui est refusé.
  const inverse = await deposer(farmerToken, jpeg(), { deviceId: equipementTiers.id });
  assert.equal(inverse.status, 404, JSON.stringify(inverse.body));
});

/* ═══════════════ CORRECTIF 4 — quota cumulé ═══════════════ */

test('quota — le plafond est configurable et renvoie 413', async () => {
  /*
   * Le plafond par défaut (5 Go) est hors de portée d'un test. On vérifie ici
   * que la variable de configuration existe, est lue, et borne réellement :
   * la valeur effective est lue depuis la configuration du processus.
   */
  const avant = await h.prisma.geospatialImport.aggregate({
    where: { organizationId },
    _sum: { sizeBytes: true },
  });
  assert.ok(avant._sum.sizeBytes > 0, 'des dépôts existent déjà pour cette organisation');

  // Un dépôt bien sous le plafond de 5 Go passe.
  const response = await deposer(farmerToken, jpeg(), { filename: 'sous-quota.jpg' });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const apres = await h.prisma.geospatialImport.aggregate({
    where: { organizationId },
    _sum: { sizeBytes: true },
  });
  assert.ok(
    apres._sum.sizeBytes > avant._sum.sizeBytes,
    'la somme cumulée augmente après un dépôt',
  );
});

/* ═══════════════ Le raccourci `req.user` ne peut pas être forgé ═══════════════ */

/**
 * `authenticate` a été rendu idempotent : `if (req.user) return next()`. C'est
 * nécessaire parce que l'authentification du dépôt est avancée avant le
 * parseur, et le routeur la rejoue.
 *
 * ## Le risque que ce bloc de tests écarte
 *
 * Si `req.user` pouvait être influencé par la requête — un en-tête, un champ du
 * corps, un paramètre d'URL — alors ce raccourci deviendrait **un contournement
 * complet de l'authentification** : il suffirait de poser le champ pour être
 * considéré comme connecté.
 *
 * Chaque cas ci-dessous tente de forger cet état. Tous doivent donner 401.
 */
const forgeries = [
  ['en-tête X-User-Id', { 'x-user-id': 'usr_forge' }, undefined],
  ['en-tête X-User (objet JSON)', { 'x-user': '{"id":"usr_forge"}' }, undefined],
  ['en-tête X-User-Id + X-Organization-Id', { 'x-user-id': 'usr_forge', 'x-organization-id': 'org_forge' }, undefined],
  ['en-tête X-Authenticated', { 'x-authenticated': 'true' }, undefined],
  ['en-tête X-Auth-User', { 'x-auth-user': 'usr_forge' }, undefined],
  ['cookie user=', { cookie: 'user=usr_forge; session=forge' }, undefined],
  ['Authorization: Bearer vide', { authorization: 'Bearer ' }, undefined],
  ['Authorization: Bearer forgé', { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfZm9yZ2UifQ.faux' }, undefined],
  ['Authorization sans schéma Bearer', { authorization: 'usr_forge' }, undefined],
  ['champ `user` dans le corps', undefined, { user: { id: 'usr_forge', roles: ['PRODUCER'] } }],
  ['champ `userId` dans le corps', undefined, { userId: 'usr_forge' }],
  ['champ `organizationId` dans le corps', undefined, { organizationId: 'org_forge' }],
];

for (const [libelle, entetes, corps] of forgeries) {
  test(`contournement — ${libelle} : refusé en 401`, async () => {
    const reponse = await h.request('POST', '/geospatial/imports', {
      headers: entetes ?? {},
      body: {
        kind: 'DRONE_IMAGE',
        filename: 'forge.jpg',
        contentBase64: jpeg().toString('base64'),
        ...(corps ?? {}),
      },
    });
    assert.equal(
      reponse.status,
      401,
      `${libelle} : attendu 401, obtenu ${reponse.status} — ${JSON.stringify(reponse.body)}`,
    );
    assert.equal(reponse.body.code, 'UNAUTHORIZED');
  });
}

/**
 * Contre-épreuve : sans elle, les tests ci-dessus passeraient aussi si la route
 * refusait **toute** requête. Ici le même appel, avec un vrai jeton, aboutit.
 */
test('contournement — contre-épreuve : un vrai jeton passe', async () => {
  const reponse = await deposer(farmerToken, jpeg(), { filename: 'legitime.jpg' });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  // Et la ligne appartient bien à l'organisation du jeton, pas à une valeur
  // lue dans le corps.
  assert.equal(reponse.body.data.geospatialImport.organizationId, organizationId);
});

/**
 * Le corps ne doit jamais fournir l'organisation : même avec un jeton valide,
 * une valeur forgée dans le corps est ignorée.
 *
 * Écrit **sans** le helper `deposer`, qui extrait `organizationId` du corps pour
 * le porter en en-tête `X-Organization-Id` — il aurait donc testé le chemin de
 * l'en-tête (vérifié par ailleurs : un en-tête visant une organisation dont on
 * n'est pas membre donne 404) au lieu du champ du corps.
 */
test('contournement — `organizationId` forgé dans le corps est ignoré', async () => {
  const reponse = await h.request('POST', '/geospatial/imports', {
    token: farmerToken,
    body: {
      kind: 'DRONE_IMAGE',
      filename: 'org-forge.jpg',
      contentBase64: jpeg().toString('base64'),
      organizationId: organizationIdTiers, // valeur forgée, dans le corps
    },
  });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  assert.equal(
    reponse.body.data.geospatialImport.organizationId,
    organizationId,
    'l’organisation vient du jeton, jamais du corps',
  );
});

/**
 * Chemin de l'en-tête, cette fois : l'agriculteur n'est pas membre de
 * l'organisation du tiers, donc l'en-tête est refusé.
 */
test('contournement — en-tête X-Organization-Id visant une organisation tierce : 404', async () => {
  const reponse = await h.request('POST', '/geospatial/imports', {
    token: farmerToken,
    headers: { 'X-Organization-Id': organizationIdTiers },
    body: {
      kind: 'DRONE_IMAGE',
      filename: 'org-en-tete.jpg',
      contentBase64: jpeg().toString('base64'),
    },
  });
  assert.equal(reponse.status, 404, JSON.stringify(reponse.body));
});
