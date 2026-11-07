/**
 * Identification de fichier par octets d'en-tête, assainissement des noms,
 * et garde-fou d'emplacement du stockage.
 *
 * Ces trois points sont le cœur de la consigne : « vérifiés sur les octets
 * d'en-tête et pas seulement sur l'extension », « nom de fichier assaini »,
 * « chemin hors de tout dossier public ». Ils sont testés ici en isolation,
 * sans base ni HTTP, pour que l'échec pointe directement la cause.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HEADER_BYTES,
  assainirNom,
  detecterFormat,
  extensionDe,
  verifierType,
} from '../src/shared/fileMagic.js';
import {
  StockageInterdit,
  creerStockage,
  creerStockageLocal,
} from '../src/integrations/storage.js';

/* ─────────────────── tampons de référence ─────────────────── */

/** JPEG minimal : signature FF D8 FF puis n'importe quoi. */
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x41)]);

/** PNG : les 8 octets de signature imposés par la spécification. */
const png = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 0x42)]);

/** TIFF little-endian (II*\0) : l'ordre d'un GeoTIFF exporté par la plupart des outils. */
const tiffLE = () => Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(64, 0x43)]);

/** TIFF big-endian (MM\0*) : l'autre ordre, également rencontré sur le terrain. */
const tiffBE = () => Buffer.concat([Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), Buffer.alloc(64, 0x44)]);

/**
 * SEG-Y : 3 200 octets d'en-tête textuel libre, puis le marqueur de révision
 * « 01 » en EBCDIC aux octets 3 255-3 256.
 */
const SEGY_OFFSET = 3254;
const segy = (marqueur = [0xf0, 0xf1]) => {
  const b = Buffer.alloc(HEADER_BYTES, 0x20);
  b[SEGY_OFFSET] = marqueur[0];
  b[SEGY_OFFSET + 1] = marqueur[1];
  return b;
};

/* ─────────────────── détection sur les octets ─────────────────── */

test('fileMagic — chaque signature connue est reconnue', () => {
  assert.equal(detecterFormat(jpeg()).format, 'image/jpeg');
  assert.equal(detecterFormat(png()).format, 'image/png');
  assert.equal(detecterFormat(tiffLE()).format, 'image/tiff');
  assert.equal(detecterFormat(tiffBE()).format, 'image/tiff');
  assert.equal(detecterFormat(segy()).format, 'application/x-segy');
});

test('fileMagic — le type est rattaché à la bonne famille de dépôt', () => {
  assert.equal(detecterFormat(jpeg()).kind, 'DRONE_IMAGE');
  assert.equal(detecterFormat(png()).kind, 'DRONE_IMAGE');
  assert.equal(detecterFormat(segy()).kind, 'GPR');
});

test('fileMagic — un contenu inconnu n’est reconnu comme aucun type', () => {
  // Un exécutable ELF, du texte brut, du vide : rien de tout cela n'est un
  // relevé géospatial. Renvoyer `null` plutôt que de deviner.
  assert.equal(detecterFormat(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), null);
  assert.equal(detecterFormat(Buffer.from('#!/bin/sh\nexit 0\n')), null);
  assert.equal(detecterFormat(Buffer.alloc(0)), null);
});

/**
 * Le cas central : l'extension ment, les octets ne mentent pas.
 */
test('fileMagic — une extension .jpg sur un contenu PNG est refusée', () => {
  const controle = verifierType(png().subarray(0, HEADER_BYTES), 'DRONE_IMAGE');
  // PNG est bien une image de drone : accepté, et le format **réel** est dit.
  assert.equal(controle.ok, true);
  assert.equal(controle.format, 'image/png');
});

test('fileMagic — un relevé GPR déclaré DRONE_IMAGE est refusé', () => {
  const controle = verifierType(segy(), 'DRONE_IMAGE');
  assert.equal(controle.ok, false);
  assert.match(controle.raison, /GPR/);
  assert.match(controle.raison, /application\/x-segy/);
});

test('fileMagic — une image déclarée GPR est refusée', () => {
  const controle = verifierType(jpeg(), 'GPR');
  assert.equal(controle.ok, false);
  assert.match(controle.raison, /DRONE_IMAGE/);
});

test('fileMagic — un contenu sans signature est refusé quel que soit le type déclaré', () => {
  for (const type of ['GPR', 'DRONE_IMAGE']) {
    const controle = verifierType(Buffer.from('pas un fichier geospatial'), type);
    assert.equal(controle.ok, false);
    assert.match(controle.raison, /octets d’en-tête/);
  }
});

/**
 * SEG-Y n'a pas de signature magique : le contrôle repose sur le marqueur de
 * révision. C'est plus faible que JPEG/PNG et le module doit le **dire**, pas
 * le laisser passer pour un contrôle plein.
 */
test('fileMagic — SEG-Y est signalé comme contrôle faible', () => {
  const controle = verifierType(segy(), 'GPR');
  assert.equal(controle.ok, true);
  assert.equal(controle.faible, true, 'SEG-Y doit être marqué contrôle faible');
  // JPEG, lui, est un contrôle plein.
  assert.equal(verifierType(jpeg(), 'DRONE_IMAGE').faible, false);
});

/**
 * `PK\3\4` identifie une **archive**, pas un relevé géoradar. N'importe quel
 * ZIP du monde passe ce contrôle. Certains formats GPR sont effectivement
 * distribués en archive, donc on l'accepte — mais au même statut que SEG-Y, et
 * la réponse doit le dire.
 */
test('fileMagic — un ZIP accepté comme GPR est signalé contrôle faible', () => {
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0x45)]);
  const trouve = detecterFormat(zip);
  assert.equal(trouve.format, 'application/zip');
  assert.equal(trouve.kind, 'GPR');
  assert.equal(trouve.faible, true, 'ZIP est un conteneur : contrôle faible');

  const controle = verifierType(zip, 'GPR');
  assert.equal(controle.ok, true);
  assert.equal(controle.faible, true);
});

test('fileMagic — JPEG, PNG et TIFF restent des contrôles pleins', () => {
  // Contrepartie du test précédent : « faible » ne doit pas devenir la valeur
  // par défaut, sinon le signal ne veut plus rien dire.
  for (const tampon of [jpeg(), png(), tiffLE(), tiffBE()]) {
    assert.equal(detecterFormat(tampon).faible, false);
  }
});

test('fileMagic — les deux conventions SEG-Y (EBCDIC et ASCII) sont acceptées', () => {
  assert.equal(verifierType(segy([0xf0, 0xf1]), 'GPR').ok, true); // EBCDIC « 01 »
  assert.equal(verifierType(segy([0xf0, 0xf2]), 'GPR').ok, true); // EBCDIC « 02 »
  assert.equal(verifierType(segy([0x30, 0x31]), 'GPR').ok, true); // ASCII « 01 »
  assert.equal(verifierType(segy([0x30, 0x32]), 'GPR').ok, true); // ASCII « 02 »
  assert.equal(verifierType(segy([0x00, 0x00]), 'GPR').ok, false); // marqueur absent
});

/* ─────────────────── assainissement du nom ─────────────────── */

test('assainirNom — les séparateurs de chemin sont neutralisés', () => {
  // L'attaque classique : un nom qui remonte l'arborescence.
  assert.equal(assainirNom('../../etc/passwd'), '_etc_passwd');

  const barreOblique = assainirNom('..\\..\\windows\\system32');
  assert.equal(barreOblique, '_windows_system32');
  // Ce qui compte vraiment : ni séparateur, ni remontée de répertoire.
  assert.doesNotMatch(assainirNom('../../../etc/passwd'), /\//);
  assert.doesNotMatch(barreOblique, /\\/);
  for (const nom of ['../../etc/passwd', '..\\..\\x', 'a/../b']) {
    assert.doesNotMatch(assainirNom(nom), /\.\./, nom);
  }
});

test('assainirNom — l’octet nul et les caractères de contrôle sont retirés', () => {
  assert.equal(assainirNom('releve\u0000.jpg'), 'releve.jpg');
  assert.equal(assainirNom('releve\n\t.jpg'), 'releve.jpg');
  assert.doesNotMatch(assainirNom('a\u0007b'), /[\u0000-\u001f]/);
});

test('assainirNom — accents et espaces produisent un nom stable', () => {
  // NFKC + retrait des diacritiques : « e\u0301 » et « é » donnent la même chose.
  assert.equal(assainirNom('relevé été.jpg'), 'releve_ete.jpg');
  assert.equal(assainirNom('releve e\u0301te\u0301.jpg'), 'releve_ete.jpg');
  assert.equal(assainirNom('mon relevé (final).jpg'), 'mon_releve_final.jpg');
});

test('assainirNom — un nom entièrement invalide retombe sur « fichier »', () => {
  assert.equal(assainirNom('///'), 'fichier');
  assert.equal(assainirNom(''), 'fichier');
  assert.equal(assainirNom(null), 'fichier');
  assert.equal(assainirNom(undefined), 'fichier');
});

test('assainirNom — la longueur est bornée', () => {
  assert.ok(assainirNom('a'.repeat(5000) + '.jpg').length <= 184);
});

test('extensionDe — renvoie l’extension en minuscules, sans point', () => {
  assert.equal(extensionDe('RELEVE.JPG'), 'jpg');
  assert.equal(extensionDe('a.b.segy'), 'segy');
  assert.equal(extensionDe('sans_extension'), '');
  assert.equal(extensionDe('.gitignore'), ''); // point en tête ≠ extension
  assert.equal(extensionDe('fini.'), '');
});

/* ─────────────────── emplacement du stockage ─────────────────── */

/**
 * Un fichier déposé par un utilisateur n'est pas une ressource web. S'il
 * tombait dans un dossier servi statiquement, il serait téléchargeable par
 * quiconque connaît son URL — sans authentification ni contrôle d'organisation.
 */
test('stockage — refuse un dossier public', () => {
  for (const chemin of ['./public/uploads', '/srv/app/dist/geospatial', 'www/geospatial']) {
    assert.throws(() => creerStockageLocal({ racine: chemin }), StockageInterdit, chemin);
  }
});

test('stockage — accepte un dossier hors racine publique', () => {
  const pilote = creerStockageLocal({ racine: './storage/geospatial' });
  assert.equal(pilote.pilote, 'local');
  // Windows : path.resolve produit des antislashs — on compare séparateurs
  // agnostiquement.
  assert.ok(pilote.racine.replaceAll('\\', '/').endsWith('storage/geospatial'));
});

test('stockage — exige une racine pour le pilote local', () => {
  assert.throws(() => creerStockageLocal({}), StockageInterdit);
});

test('stockage — un pilote inconnu est une erreur, pas un repli sur local', async () => {
  /*
   * Repli silencieux sur `local` en production = fichiers écrits sur le disque
   * d'un conteneur éphémère, perdus au redémarrage. Mieux vaut refuser de
   * démarrer.
   */
  // `creerStockage` est asynchrone : il importe le pilote S3 à la demande.
  await assert.rejects(() => creerStockage({ pilote: 'inexistant' }), /inconnu/);
  await assert.rejects(() => creerStockage({ pilote: 'object' }), StockageInterdit); // pas de client
  // `s3` est un pilote réel désormais : sans configuration il doit dire quoi
  // manque, et non retomber silencieusement sur le disque local.
  await assert.rejects(() => creerStockage({ pilote: 's3' }), /S3/);
});

test('stockage — la clé ne peut pas sortir de la racine', () => {
  const pilote = creerStockageLocal({ racine: './storage/geospatial' });
  assert.throws(() => pilote.chemin('../../etc/passwd'), StockageInterdit);
  assert.throws(() => pilote.chemin('/etc/passwd'), StockageInterdit);
  assert.ok(pilote.chemin('org/kind/fichier.sgy').startsWith(pilote.racine));
});
