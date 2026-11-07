import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyserFichier,
  lirePng,
  lireJpeg,
  lireTiff,
  lireSegy,
  FichierIllisible,
} from '../src/shared/fileParsers.js';

/**
 * Lecture réelle des fichiers géospatiaux.
 *
 * Les fichiers de test sont **construits octet par octet** dans ce fichier, pas
 * copiés depuis des échantillons : un fichier de référence binaire dans le dépôt
 * est illisible pour qui relit le test, et on ne peut pas savoir ce qu'il était
 * censé contenir. Ici chaque octet attendu est visible.
 */

/* ─────────────────────── constructeurs de fixtures ─────────────────────── */

const chunkPng = (type, donnees) => {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  return Buffer.concat([longueur, Buffer.from(type, 'latin1'), donnees, Buffer.alloc(4)]);
};

/** PNG valide, dimensions et résolution paramétrables. */
const png = ({ largeur = 800, hauteur = 600, profondeur = 8, couleur = 6, phys = null } = {}) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = profondeur;
  ihdr[9] = couleur;
  const morceaux = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', ihdr),
  ];
  if (phys) {
    const bloc = Buffer.alloc(9);
    bloc.writeUInt32BE(phys, 0);
    bloc.writeUInt32BE(phys, 4);
    bloc[8] = 1; // unité = mètre
    morceaux.push(chunkPng('pHYs', bloc));
  }
  morceaux.push(chunkPng('IEND', Buffer.alloc(0)));
  return Buffer.concat(morceaux);
};

/** JPEG minimal : SOI, SOF0, EOI. */
const jpeg = ({ largeur = 1024, hauteur = 768, composantes = 3, marqueur = 0xc0 } = {}) => {
  const sof = Buffer.alloc(9);
  sof.writeUInt16BE(11, 0);
  sof[2] = 8;
  sof.writeUInt16BE(hauteur, 3);
  sof.writeUInt16BE(largeur, 5);
  sof[7] = composantes;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, marqueur]),
    sof,
    Buffer.from([0xff, 0xd9]),
  ]);
};

/**
 * TIFF little-endian avec un répertoire d'images.
 *
 * @param {Array<[number, number, number, number]>} entrees `[étiquette, type, compte, valeur]`
 */
const tiff = (entrees, { version = 42, doubles = [] } = {}) => {
  const debut = 8;
  const zone = debut + 2 + entrees.length * 12 + 2;
  const taille = zone + doubles.length * 8;
  const t = Buffer.alloc(taille);
  t.write('II', 'ascii');
  t.writeUInt16LE(version, 2);
  t.writeUInt32LE(debut, 4);
  t.writeUInt16LE(entrees.length, debut);
  entrees.forEach(([etiquette, type, compte, valeur], i) => {
    const o = debut + 2 + i * 12;
    t.writeUInt16LE(etiquette, o);
    t.writeUInt16LE(type, o + 2);
    t.writeUInt32LE(compte, o + 4);
    t.writeUInt32LE(valeur, o + 8);
  });
  doubles.forEach((valeur, i) => t.writeDoubleLE(valeur, zone + i * 8));
  return t;
};

/** SEG-Y : en-tête textuel de 3 200 octets puis en-tête binaire de 400. */
const segy = ({ intervalle = 200, echantillons = 512, format = 5, systeme = 1, ebcdic = false } = {}) => {
  const texte = Buffer.alloc(3200, ebcdic ? 0xf0 : 0x20);
  texte.write(ebcdic ? '' : 'RELEVE GPR AGRIKONNECT', 0, 'ascii');
  if (ebcdic) texte[0] = 0xf0; // premier octet > 0x7f ⇒ détection EBCDIC
  const binaire = Buffer.alloc(400);
  binaire.writeUInt16BE(intervalle, 16);
  binaire.writeUInt16BE(echantillons, 20);
  binaire.writeUInt16BE(format, 24);
  binaire.writeUInt16BE(systeme, 54);
  return Buffer.concat([texte, binaire, Buffer.alloc(1000)]);
};

/* ─────────────────────────────── PNG ─────────────────────────────── */

test('PNG — dimensions, profondeur et type de couleur sont lus', () => {
  const resultat = lirePng(png({ largeur: 1280, hauteur: 720, couleur: 2 }));
  assert.equal(resultat.largeur, 1280);
  assert.equal(resultat.hauteur, 720);
  assert.equal(resultat.profondeurBits, 8);
  assert.equal(resultat.typeCouleur, 'RVB');
});

test('PNG — la résolution au sol vient de pHYs, pas d’une estimation', () => {
  // 200 pixels par mètre ⇒ 0,005 m par pixel.
  assert.equal(lirePng(png({ phys: 200 })).resolutionSolM, 0.005);
  /*
   * Sans `pHYs`, la résolution est `null`. Renvoyer une valeur par défaut
   * donnerait une résolution plausible et fausse — exactement ce qu'un système
   * de décision ne doit pas produire.
   */
  assert.equal(lirePng(png()).resolutionSolM, null);
  assert.equal(lirePng(png()).pixelsParMetreX, null);
});

test('PNG — un texte tEXt est rapporté, un bloc eXIf est signalé', () => {
  const corps = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', Buffer.concat([(() => {
      const b = Buffer.alloc(13); b.writeUInt32BE(10, 0); b.writeUInt32BE(10, 4); b[8] = 8; b[9] = 0; return b;
    })()])),
    chunkPng('tEXt', Buffer.concat([Buffer.from('Logiciel\0', 'latin1'), Buffer.from('drone v2', 'latin1')])),
    chunkPng('eXIf', Buffer.from('Exif\0\0', 'latin1')),
    chunkPng('IEND', Buffer.alloc(0)),
  ]);
  const resultat = lirePng(corps);
  assert.equal(resultat.texte.Logiciel, 'drone v2');
  assert.equal(resultat.exifPresent, true);
});

test('PNG — un fichier tronqué est une erreur explicite, pas une exception', () => {
  const resultat = analyserFichier(Buffer.from([0x89, 0x50]), 'image/png');
  assert.equal(resultat.extrait, null);
  assert.match(resultat.erreur, /tronqué/);
});

/* ─────────────────────────────── JPEG ─────────────────────────────── */

test('JPEG — largeur et hauteur ne sont pas inversées', () => {
  /*
   * L'inversion est le défaut classique de lecture d'une trame SOF : elle est
   * invisible sur une image carrée et fausse tout le reste. Les dimensions sont
   * volontairement différentes pour que l'erreur se voie.
   */
  const resultat = lireJpeg(jpeg({ largeur: 1024, hauteur: 768 }));
  assert.equal(resultat.largeur, 1024);
  assert.equal(resultat.hauteur, 768);
  assert.equal(resultat.echantillons, 3);
  assert.equal(resultat.progressif, false);
});

test('JPEG — un encodage progressif est signalé', () => {
  assert.equal(lireJpeg(jpeg({ marqueur: 0xc2 })).progressif, true);
});

test('JPEG — sans trame SOF, aucune dimension n’est inventée', () => {
  const sansSof = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xd9])]);
  assert.throws(() => lireJpeg(sansSof), FichierIllisible);
});

/* ─────────────────────────── TIFF / GeoTIFF ─────────────────────────── */

test('GeoTIFF — ancrage et résolution sont lus, et le coin est déduit', () => {
  const ZONE = 60; // décalage de la zone de données doubles
  const fichier = tiff(
    [
      [256, 4, 1, 1024], // largeur
      [257, 4, 1, 512], // hauteur
      [33550, 12, 3, ZONE], // échelle du pixel
      [33922, 12, 6, ZONE + 24], // point d'ancrage
    ],
    { doubles: [0.5, 0.5, 0, 0, 0, 0, 15.3125, -4.305, 0] },
  );
  const resultat = lireTiff(fichier);
  assert.equal(resultat.largeur, 1024);
  assert.equal(resultat.hauteur, 512);
  assert.deepEqual(resultat.resolutionSol, [0.5, 0.5, 0]);
  assert.equal(resultat.geotiff, true);
  // Coordonnées du coin supérieur gauche, telles que le fichier les donne.
  assert.equal(resultat.coinSuperieurGauche.x, 15.3125);
  assert.equal(resultat.coinSuperieurGauche.y, -4.305);
});

test('GeoTIFF — sans ancrage, aucune coordonnée n’est supposée', () => {
  const fichier = tiff([[256, 4, 1, 64], [257, 4, 1, 64]]);
  const resultat = lireTiff(fichier);
  assert.equal(resultat.geotiff, false);
  /*
   * `(0, 0)` situerait le relevé dans le golfe de Guinée. `null` dit la vérité :
   * le fichier ne porte pas de coordonnées.
   */
  assert.equal(resultat.coinSuperieurGauche, null);
});

test('TIFF — plusieurs valeurs d’une étiquette restent un tableau', () => {
  /*
   * BitsPerSample à deux composantes. N'en garder qu'une ferait croire à une
   * image en niveaux de gris. Deux SHORT tiennent dans les 4 octets du champ de
   * valeur : `0x00080008` porte 8 puis 8 en petit boutisme.
   */
  const fichier = tiff([[258, 3, 2, 0x00080008]]);
  const resultat = lireTiff(fichier);
  assert.deepEqual(resultat.bitsParEchantillon, [8, 8]);
});

test('TIFF — le BigTIFF est refusé explicitement, pas lu à moitié', () => {
  const fichier = tiff([[256, 4, 1, 10]], { version: 43 });
  assert.throws(() => lireTiff(fichier), /BigTIFF/);
});

test('TIFF — un ordre d’octets invalide est refusé', () => {
  const fichier = Buffer.concat([Buffer.from('XX', 'ascii'), Buffer.alloc(200)]);
  assert.throws(() => lireTiff(fichier), FichierIllisible);
});

/* ─────────────────────────────── SEG-Y ─────────────────────────────── */

test('SEG-Y — les paramètres d’acquisition sont lus en grand boutisme', () => {
  const resultat = lireSegy(segy({ intervalle: 200, echantillons: 512, format: 5, systeme: 1 }));
  assert.equal(resultat.intervalleEchantillonnageMicroS, 200);
  assert.equal(resultat.echantillonsParTrace, 512);
  assert.equal(resultat.formatEchantillon, 'IEEE 4 octets');
  assert.equal(resultat.systemeMesure, 'mètres');
  assert.equal(resultat.encodageEnTete, 'ASCII');
});

test('SEG-Y — la durée de trace est marquée comme calculée', () => {
  const resultat = lireSegy(segy({ intervalle: 200, echantillons: 512 }));
  // 200 µs × 512 = 102 400 µs = 102,4 ms. C'est la seule valeur déduite du
  // module : le nom du champ le dit, pour qu'elle ne passe pas pour une donnée
  // lue dans le fichier.
  assert.equal(resultat.dureeTraceCalculeeMs, 102.4);
});

test('SEG-Y — un en-tête EBCDIC est reconnu comme tel', () => {
  assert.equal(lireSegy(segy({ ebcdic: true })).encodageEnTete, 'EBCDIC');
});

test('SEG-Y — un en-tête binaire incomplet est refusé', () => {
  assert.throws(() => lireSegy(Buffer.alloc(3300)), FichierIllisible);
});

/* ─────────────────────────── point d'entrée ─────────────────────────── */

test('analyse — une archive ZIP est conservée mais non ouverte, et c’est dit', () => {
  const resultat = analyserFichier(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'application/zip');
  assert.equal(resultat.extrait, null);
  assert.match(resultat.erreur, /bombes à décompression/);
});

test('analyse — un format sans lecteur est signalé, pas ignoré', () => {
  const resultat = analyserFichier(Buffer.alloc(10), 'application/x-inconnu');
  assert.equal(resultat.extrait, null);
  assert.match(resultat.erreur, /sans lecteur correspondant/);
});

test('analyse — aucune exception ne remonte, quel que soit le contenu', () => {
  /*
   * Un fichier corrompu est un **résultat** de traitement, pas une panne du
   * serveur. Si une exception remontait, elle deviendrait un 500 et le dépôt
   * resterait bloqué à `PROCESSING`.
   */
  for (const format of ['image/png', 'image/jpeg', 'image/tiff', 'application/x-segy']) {
    const resultat = analyserFichier(Buffer.alloc(4), format);
    assert.equal(resultat.extrait, null, format);
    assert.ok(resultat.erreur, format);
  }
});
