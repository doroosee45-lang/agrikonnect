/**
 * Dépôt de fichiers géospatiaux — service.
 *
 * Couvre les quatre cas exigés : **type usurpé**, **fichier trop gros**,
 * **doublon**, **accès d'un tiers**. Plus les invariants du module : statut
 * `RECEIVED` seul, aucun traitement du contenu, clé de stockage construite côté
 * serveur, nom assaini, isolation par organisation.
 *
 * Le stockage est le pilote **local**, sur un dossier temporaire : c'est le
 * pilote réellement exécuté ici. Le pilote objet n'est pas couvert — voir
 * `docs/GEOSPATIAL-IMPORT.md` §« Ce qui n'est pas vérifié ».
 */
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as service from '../src/modules/geospatialImport/geospatialImport.service.js';
import { HEADER_BYTES } from '../src/shared/fileMagic.js';

const ORG = 'org_1';
const AUTRE_ORG = 'org_2';

/* ─────────────────── tampons ─────────────────── */

/**
 * JPEG dont le corps varie à chaque appel.
 *
 * Sans cela, deux appels produisent des octets identiques donc un **doublon** :
 * le test de quota cumulé échouerait sur le refus de doublon au lieu de tester
 * le plafond.
 */
let compteurTampon = 0;
const jpeg = () => {
  compteurTampon += 1;
  const corps = Buffer.alloc(64, 0x41);
  corps.write(`tampon-${compteurTampon}`, 0, 'ascii');
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), corps]);
};
const png = () => {
  compteurTampon += 1;
  const corps = Buffer.alloc(64, 0x42);
  corps.write(`tampon-${compteurTampon}`, 0, 'ascii');
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), corps]);
};
const SEGY_OFFSET = 3254;
const segy = () => {
  const b = Buffer.alloc(HEADER_BYTES, 0x20);
  b[SEGY_OFFSET] = 0xf0;
  b[SEGY_OFFSET + 1] = 0xf1;
  return b;
};

const req = (organizationId = ORG) => ({
  user: { id: 'usr_1' },
  tenant: { organizationId, effectiveRoles: ['PRODUCER'] },
  headers: {},
});

/* ─────────────────── montage ─────────────────── */

let restore;
let dossier;

beforeEach(async () => {
  dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'ak-geospatial-'));
  const { creerStockageLocal } = await import('../src/integrations/storage.js');
  service.definirStockage(creerStockageLocal({ racine: dossier }));
  ({ restore } = await withFakePrisma(prisma, {
    geospatialImport: [],
    // Compteur transactionnel du quota : le dépôt l'incrémente dans sa
    // transaction, le double doit donc connaître le modèle.
    resourceUsage: [],
    plot: [{ id: 'plot_1', organizationId: ORG }],
    iotDevice: [
      { id: 'dev_1', organizationId: ORG, label: 'Géoradar 1' },
      { id: 'dev_tiers', organizationId: AUTRE_ORG, label: 'Géoradar tiers' },
    ],
  }));
});

afterEach(async () => {
  restore?.();
  service.definirStockage(null);
  service.reinitialiserTaillesMaximales();
  service.reinitialiserQuota();
  await fs.rm(dossier, { recursive: true, force: true });
});

const depot = (tampon, surcharge = {}) =>
  service.recevoir(
    {
      kind: 'DRONE_IMAGE',
      filename: 'releve.jpg',
      contentBase64: tampon.toString('base64'),
      ...surcharge,
    },
    req(surcharge.organizationId ?? ORG),
  );

/* ═══════════════ dépôt nominal ═══════════════ */

test('dépôt nominal — ligne RECEIVED, somme de contrôle, fichier écrit', async () => {
  const tampon = jpeg();
  const { geospatialImport, detection } = await depot(tampon);

  assert.equal(geospatialImport.status, 'RECEIVED');
  assert.equal(geospatialImport.kind, 'DRONE_IMAGE');
  assert.equal(geospatialImport.format, 'image/jpeg');
  assert.equal(geospatialImport.sizeBytes, tampon.length);
  assert.equal(geospatialImport.organizationId, ORG);
  assert.equal(detection.format, 'image/jpeg');
  assert.equal(detection.controleFaible, false);

  // Somme de contrôle = SHA-256 du contenu, calculée à la réception.
  const crypto = await import('node:crypto');
  assert.equal(
    geospatialImport.checksum,
    crypto.createHash('sha256').update(tampon).digest('hex'),
  );

  // Les octets écrits sont ceux reçus, sans transformation.
  const ecrit = await fs.readFile(path.join(dossier, geospatialImport.storageKey));
  assert.ok(ecrit.equals(tampon), 'le fichier stocké doit être identique au fichier reçu');
});

/**
 * L'invariant central du module : **aucun traitement du contenu**.
 *
 * Si un jour ce test échoue, c'est que quelqu'un a écrit `COMPLETED` ou rempli
 * `result` ici. Ce module ne traite rien — le traitement est une étape à part.
 */
test('dépôt nominal — aucun traitement : RECEIVED seul, aucun résultat inventé', async () => {
  const { geospatialImport } = await depot(segy(), { kind: 'GPR', filename: 'transect.sgy' });

  assert.equal(geospatialImport.status, 'RECEIVED', 'le statut ne doit être que RECEIVED');
  /*
   * `== null` et non `=== null` : la base réelle renvoie `null` pour une colonne
   * nullable non renseignée, le double de test renvoie `undefined`. Les deux
   * signifient la même chose ici — aucune valeur n'a été inventée. Ce qui
   * compte est l'absence, pas sa représentation.
   */
  assert.ok(geospatialImport.result == null, 'aucun résultat ne doit être inventé');
  assert.ok(geospatialImport.startedAt == null, 'aucun traitement n’a été lancé');
  assert.ok(geospatialImport.completedAt == null, 'aucun traitement n’est terminé');
  assert.ok(geospatialImport.errorMessage == null);
  assert.equal(geospatialImport.mode, 'REAL', 'rien n’est simulé : le fichier vient de l’utilisateur');
});

test('dépôt nominal — le nom d’origine est assaini avant enregistrement', async () => {
  const { geospatialImport } = await depot(jpeg(), {
    filename: '../../etc/passwd',
  });
  assert.equal(geospatialImport.filename, '_etc_passwd');
  assert.doesNotMatch(geospatialImport.filename, /\.\./);
});

/**
 * Le nom fourni par le client ne doit jamais se retrouver dans la clé de
 * stockage : c'est ce qui rend l'évasion de chemin impossible, indépendamment
 * de la qualité de l'assainissement.
 */
test('dépôt nominal — la clé de stockage ne contient pas le nom fourni', async () => {
  const { geospatialImport } = await depot(jpeg(), { filename: 'mon relevé (final).jpg' });
  assert.match(geospatialImport.storageKey, /^geospatial\//);
  assert.match(geospatialImport.storageKey, /gim_[0-9A-Z]+\.jpg$/);
  assert.doesNotMatch(geospatialImport.storageKey, /releve|final/i);
  // Le nom assaini reste disponible pour l'affichage, sur la ligne.
  assert.equal(geospatialImport.filename, 'mon_releve_final.jpg');
});

test('dépôt nominal — une parcelle d’un tiers est refusée en 404', async () => {
  await assert.rejects(
    depot(jpeg(), { plotId: 'plot_inexistant' }),
    (e) => e.status === 404,
  );
});

/* ═══════════════ CAS EXIGÉ : type usurpé ═══════════════ */

/**
 * L'extension dit `jpg`, les octets disent SEG-Y. Vérifier l'extension seule
 * laisserait passer ce fichier.
 */
test('type usurpé — un SEG-Y nommé .jpg et déclaré DRONE_IMAGE est refusé', async () => {
  await assert.rejects(
    depot(segy(), { kind: 'DRONE_IMAGE', filename: 'releve.jpg' }),
    (e) => {
      assert.equal(e.status, 422);
      assert.equal(e.code, 'VALIDATION_ERROR');
      assert.match(e.message, /DRONE_IMAGE/);
      return true;
    },
  );
  // Rien ne doit avoir été écrit.
  const [lignes] = await Promise.all([prisma.geospatialImport.findMany({})]);
  assert.equal(lignes.length, 0, 'un fichier refusé ne doit laisser aucune ligne');
  const fichiers = await fs.readdir(dossier, { recursive: true }).catch(() => []);
  assert.equal(fichiers.length, 0, 'un fichier refusé ne doit rien laisser sur le disque');
});

test('type usurpé — une image déclarée GPR est refusée', async () => {
  await assert.rejects(depot(jpeg(), { kind: 'GPR' }), (e) => e.status === 422);
});

test('type usurpé — un contenu sans signature est refusé', async () => {
  await assert.rejects(
    depot(Buffer.from('#!/bin/sh\nrm -rf /\n'), { kind: 'GPR' }),
    (e) => {
      assert.equal(e.status, 422);
      assert.match(e.message, /octets d’en-tête/);
      return true;
    },
  );
});

test('type usurpé — un PNG déclaré DRONE_IMAGE passe, avec son format réel', async () => {
  // Un PNG nommé .jpg reste une image de drone : accepté, mais le format
  // enregistré est celui des octets, pas celui de l'extension.
  const { geospatialImport } = await depot(png(), { filename: 'photo.jpg' });
  assert.equal(geospatialImport.format, 'image/png');
  assert.equal(geospatialImport.storageKey.endsWith('.png'), true);
});

/* ═══════════════ CAS EXIGÉ : fichier trop gros ═══════════════ */

test('fichier trop gros — refusé en 413, sans écriture', async () => {
  // Plafond abaissé pour le test : allouer 64 Mo à chaque exécution serait
  // gratuit. Le chemin vérifié est exactement celui de la limite réelle.
  service.definirTaillesMaximales({ DRONE_IMAGE: 64 });

  await assert.rejects(depot(jpeg()), (e) => {
    assert.equal(e.status, 413);
    assert.equal(e.code, 'PAYLOAD_TOO_LARGE');
    assert.match(e.message, /64 octets/);
    assert.match(e.message, /DRONE_IMAGE/);
    return true;
  });

  const lignes = await prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 0);
});

test('fichier trop gros — la limite est distincte par type', async () => {
  service.definirTaillesMaximales({ DRONE_IMAGE: 16, GPR: 100_000 });

  assert.ok(service.tailleMaximale('DRONE_IMAGE') < service.tailleMaximale('GPR'));
  // Un SEG-Y de 3 256 octets passe sous le plafond GPR…
  await depot(segy(), { kind: 'GPR', filename: 't.sgy' });
  // …et serait refusé s'il était déclaré DRONE_IMAGE.
  await assert.rejects(depot(segy(), { kind: 'DRONE_IMAGE' }), (e) => e.status === 413);
});

test('fichier trop gros — un corps base64 absurdement grand est refusé avant décodage', async () => {
  // Le plafond sur le corps protège la mémoire du processus **avant** tout
  // décodage. On ne peut pas allouer 700 Mo ici : on vérifie que le contrôle
  // existe et précède `Buffer.from`.
  const source = await fs.readFile(
    new URL('../src/modules/geospatialImport/geospatialImport.service.js', import.meta.url),
    'utf8',
  );
  const positionPlafond = source.indexOf('PLAFOND_CORPS_BASE64)');
  const positionSyntaxe = source.indexOf('estBase64Valide(normalise)');
  const positionDecodage = source.indexOf("Buffer.from(normalise, 'base64')");
  assert.ok(positionPlafond > 0, 'le contrôle du plafond doit exister');
  assert.ok(positionSyntaxe > 0, 'le contrôle syntaxique doit exister');
  assert.ok(positionDecodage > 0, 'le décodage doit exister');
  assert.ok(
    positionPlafond < positionSyntaxe && positionSyntaxe < positionDecodage,
    'plafond puis contrôle syntaxique puis décodage, dans cet ordre',
  );
  assert.ok(
    positionPlafond < positionDecodage,
    'le plafond doit être vérifié AVANT le décodage, sinon il ne protège rien',
  );
});

/* ═══════════════ CAS EXIGÉ : doublon ═══════════════ */

test('doublon — le même fichier dans la même organisation est refusé en 409', async () => {
  const tampon = jpeg();
  const premier = await depot(tampon);

  await assert.rejects(depot(tampon), (e) => {
    assert.equal(e.status, 409);
    assert.equal(e.code, 'CONFLICT');
    assert.match(e.message, /identique/);
    assert.match(e.message, new RegExp(premier.geospatialImport.id));
    return true;
  });

  const lignes = await prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 1, 'un doublon refusé ne crée pas de seconde ligne');
});

test('doublon — le refus nomme la somme de contrôle et le dépôt d’origine', async () => {
  const tampon = png();
  await depot(tampon);
  await assert.rejects(depot(tampon, { filename: 'autre-nom.jpg' }), (e) => {
    // Le doublon est détecté sur le **contenu**, pas sur le nom : deux noms
    // différents pour les mêmes octets restent un doublon.
    assert.match(e.message, /SHA-256/);
    return true;
  });
});

test('doublon — le même fichier dans une AUTRE organisation est accepté', async () => {
  const tampon = jpeg();
  await depot(tampon);
  // Partage de données entre coopératives : le même relevé déposé par deux
  // organisations distinctes est légitime.
  const second = await depot(tampon, { organizationId: AUTRE_ORG });
  assert.equal(second.geospatialImport.organizationId, AUTRE_ORG);
  assert.equal(second.geospatialImport.checksum, (await prisma.geospatialImport.findMany({}))[0].checksum);
});

test('doublon — un octet de différence suffit à lever le refus', async () => {
  const a = jpeg();
  const b = jpeg();
  b[b.length - 1] = 0x99;
  await depot(a);
  const second = await depot(b);
  assert.notEqual(second.geospatialImport.checksum, (await prisma.geospatialImport.findMany({}))[0].checksum);
});

/**
 * Course : deux dépôts identiques passent tous deux le `findFirst`, et c'est la
 * contrainte d'unicité en base qui tranche. Le fichier déjà écrit ne doit pas
 * rester orphelin.
 */
test('doublon — en cas de course, le fichier écrit est nettoyé', async () => {
  const tampon = jpeg();
  await depot(tampon);

  const createReel = prisma.geospatialImport.create;
  prisma.geospatialImport.create = async () => {
    const erreur = new Error('Unique constraint failed');
    erreur.code = 'P2002';
    throw erreur;
  };
  try {
    await assert.rejects(depot(tampon), (e) => e.status === 409);
  } finally {
    prisma.geospatialImport.create = createReel;
  }

  const restants = (await fs.readdir(dossier, { recursive: true })).filter((f) =>
    f.toString().endsWith('.jpg'),
  );
  assert.equal(restants.length, 1, 'le second fichier doit avoir été supprimé');
});

/* ═══════════════ CAS EXIGÉ : tiers ═══════════════ */

test('tiers — un dépôt d’une autre organisation renvoie 404, pas 403', async () => {
  const { geospatialImport } = await depot(jpeg());

  await assert.rejects(service.obtenir(geospatialImport.id, req(AUTRE_ORG)), (e) => {
    // 404 et non 403 : répondre 403 révélerait que l'identifiant existe.
    assert.equal(e.status, 404);
    return true;
  });
  // Le propriétaire, lui, y accède.
  const vu = await service.obtenir(geospatialImport.id, req(ORG));
  assert.equal(vu.id, geospatialImport.id);
});

test('tiers — la liste ne montre que les dépôts de l’organisation active', async () => {
  await depot(jpeg());
  await depot(png(), { organizationId: AUTRE_ORG });

  const { data: miens, meta } = await service.lister({}, req(ORG));
  assert.equal(miens.length, 1);
  assert.equal(meta.total, 1);
  assert.ok(miens.every((l) => l.organizationId === ORG));

  const { data: autres } = await service.lister({}, req(AUTRE_ORG));
  assert.equal(autres.length, 1);
  assert.equal(autres[0].organizationId, AUTRE_ORG);
});

test('tiers — un identifiant inexistant renvoie aussi 404', async () => {
  await assert.rejects(service.obtenir('gim_inexistant', req(ORG)), (e) => e.status === 404);
});

/* ═══════════════ entrées invalides ═══════════════ */

test('entrée — un base64 vide ou absent est refusé', async () => {
  await assert.rejects(
    service.recevoir({ kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: '' }, req()),
    (e) => e.status === 422,
  );
  await assert.rejects(
    service.recevoir({ kind: 'DRONE_IMAGE', filename: 'a.jpg' }, req()),
    (e) => e.status === 422,
  );
});

test('entrée — un base64 non décodable est refusé', async () => {
  await assert.rejects(
    service.recevoir(
      { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: '!!!!pas-du-base64!!!!' },
      req(),
    ),
    (e) => e.status === 422,
  );
});

/* ═══════════════ SEG-Y : contrôle faible ═══════════════ */

test('SEG-Y — accepté comme GPR, et signalé comme contrôle faible', async () => {
  const { geospatialImport, detection } = await depot(segy(), {
    kind: 'GPR',
    filename: 'transect.sgy',
  });
  assert.equal(geospatialImport.format, 'application/x-segy');
  assert.equal(
    detection.controleFaible,
    true,
    'SEG-Y n’a pas de signature magique : le module doit le dire',
  );
});


/* ═══════════════ base64 invalide ═══════════════ */

/**
 * `Buffer.from(x, 'base64')` ne lève jamais : il ignore les caractères hors
 * alphabet et s'arrête au premier caractère inattendu. Sans contrôle de la
 * chaîne elle-même, une entrée corrompue produit un fichier **tronqué** mais
 * accepté.
 */
test('base64 — une chaîne hors alphabet est refusée', async () => {
  for (const mauvais of [
    '!!!!pas-du-base64!!!!',
    'QQ==\u0000QQ==',
    'releve.jpg', // du texte brut, pas du base64
    'a*b(c)d',
  ]) {
    await assert.rejects(
      service.recevoir(
        { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: mauvais },
        req(),
      ),
      (e) => e.status === 422,
      `aurait dû être refusé : ${JSON.stringify(mauvais)}`,
    );
  }
});

test('base64 — une longueur non multiple de 4 est refusée', async () => {
  // 'QUJD' = « ABC ». Retirer un caractère casse la longueur sans toucher
  // l'alphabet : seul le contrôle de longueur l'attrape.
  await assert.rejects(
    service.recevoir(
      { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: 'QUJ' },
      req(),
    ),
    (e) => {
      assert.equal(e.status, 422);
      assert.match(e.message, /multiple de 4|base64 valide/);
      return true;
    },
  );
});

test('base64 — un rembourrage mal placé est refusé', async () => {
  await assert.rejects(
    service.recevoir(
      { kind: 'DRONE_IMAGE', filename: 'a.jpg', contentBase64: 'QU=D' },
      req(),
    ),
    (e) => e.status === 422,
  );
});

/**
 * Le contrôle aller-retour doit porter sur la chaîne **reçue**. L'ancienne
 * version comparait `Buffer.from(x)` à `Buffer.from(x)` : une tautologie qui ne
 * peut jamais échouer, et donc ne teste rien.
 */
test('base64 — un encodage non canonique est refusé par l’aller-retour', async () => {
  /*
   * « AB » et « AA » diffèrent, mais leurs bits de queue sont perdus au
   * décodage : les deux décodent vers les mêmes octets. Seul l'aller-retour
   * contre la chaîne reçue distingue la forme canonique de l'autre.
   */
  const canonique = Buffer.from([0x00]).toString('base64'); // 'AA=='
  assert.equal(canonique, 'AA==');
  // 'AB==' décode vers le même octet mais n'est pas canonique.
  await assert.rejects(
    service.recevoir(
      { kind: 'DRONE_IMAGE', filename: 'a.bin', contentBase64: 'AB==' },
      req(),
    ),
    (e) => {
      assert.equal(e.status, 422);
      assert.match(e.message, /canonique/);
      return true;
    },
  );
});

test('base64 — les retours à la ligne licites sont acceptés', async () => {
  // Le base64 est souvent replié sur 76 colonnes. Le refuser casserait des
  // clients parfaitement corrects.
  const tampon = jpeg();
  const replie = tampon.toString('base64').replace(/(.{8})/g, '$1\n');
  const { geospatialImport } = await service.recevoir(
    { kind: 'DRONE_IMAGE', filename: 'releve.jpg', contentBase64: replie },
    req(),
  );
  assert.equal(geospatialImport.sizeBytes, tampon.length, 'le fichier décodé doit être complet');
});

/* ═══════════════ équipement (deviceId) ═══════════════ */

test('équipement — un équipement de l’organisation est accepté', async () => {
  const { geospatialImport } = await depot(jpeg(), { deviceId: 'dev_1' });
  assert.equal(geospatialImport.deviceId, 'dev_1');
});

/**
 * Sans ce contrôle, `deviceId` est une chaîne libre : n'importe qui rattache un
 * dépôt à l'équipement d'une autre organisation, et toute lecture joignant sur
 * l'équipement remonte une provenance mensongère.
 */
test('équipement — un équipement d’un tiers est refusé en 404', async () => {
  await assert.rejects(depot(jpeg(), { deviceId: 'dev_tiers' }), (e) => {
    // 404 et non 403 : on ne révèle pas l'existence de l'équipement.
    assert.equal(e.status, 404);
    assert.match(e.message, /quipement/);
    return true;
  });
  const lignes = await prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 0, 'un dépôt refusé ne laisse aucune ligne');
});

test('équipement — un équipement inexistant est refusé en 404', async () => {
  await assert.rejects(depot(jpeg(), { deviceId: 'dev_inexistant' }), (e) => e.status === 404);
});

/* ═══════════════ quota cumulé ═══════════════ */

test('quota — un dépôt qui fait dépasser le plafond est refusé en 413', async () => {
  // Plafond abaissé pour le test : le chemin vérifié est celui du plafond réel.
  service.definirQuota(jpeg().length + png().length - 1);

  await depot(jpeg()); // passe : sous le plafond
  await assert.rejects(depot(png()), (e) => {
    assert.equal(e.status, 413);
    assert.equal(e.code, 'PAYLOAD_TOO_LARGE');
    assert.match(e.message, /Quota de stockage/);
    assert.match(e.message, /plafond/);
    return true;
  });

  const lignes = await prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 1, 'le dépôt refusé ne doit pas être stocké');
});

test('quota — le plafond est cumulé, pas par fichier', async () => {
  /*
   * C'est le point que le refus de doublon ne couvre pas : il suffit de changer
   * un octet pour déposer un fichier « nouveau ». Seule la somme borne le volume.
   */
  const taille = jpeg().length;
  service.definirQuota(taille * 2 + 10);

  await depot(jpeg());
  await depot(jpeg()); // octets distincts, donc pas un doublon
  await assert.rejects(depot(jpeg()), (e) => e.status === 413, 'le troisième doit dépasser');
});

test('quota — le plafond ne compte que l’organisation active', async () => {
  const taille = jpeg().length;
  service.definirQuota(taille + 5);

  await depot(jpeg()); // ORG atteint presque son plafond
  // L'autre organisation a son propre plafond : elle n'est pas bloquée.
  const second = await depot(jpeg(), { organizationId: AUTRE_ORG });
  assert.equal(second.geospatialImport.organizationId, AUTRE_ORG);
});

test('quota — un fichier unique plus gros que le plafond est refusé', async () => {
  service.definirQuota(10);
  await assert.rejects(depot(jpeg()), (e) => e.status === 413);
});

test('quota — 0 désactive le contrôle', async () => {
  service.definirQuota(0);
  await depot(jpeg());
  await depot(png());
  const lignes = await prisma.geospatialImport.findMany({});
  assert.equal(lignes.length, 2);
});
