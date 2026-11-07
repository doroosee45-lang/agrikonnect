/**
 * Lecture **réelle** des fichiers géospatiaux déposés.
 *
 * ## Ce que fait ce module
 *
 * Il ouvre les octets, lit les structures du format, et en tire ce qui sert aux
 * modules métier : dimensions, résolution au sol, coordonnées d'ancrage,
 * système géodésique, paramètres d'acquisition du géoradar. Le résultat est
 * écrit dans `GeospatialImport.result`.
 *
 * ## Ce que ce module ne fait pas
 *
 *  - **Aucun décodage des pixels.** Lire les valeurs d'un raster demande une
 *    bibliothèque d'images ; le dépôt n'en a pas. Les dimensions, la résolution
 *    et l'ancrage viennent des en-têtes, qui suffisent à situer un relevé.
 *  - **Aucune reprojection.** Les coordonnées sont rapportées telles quelles,
 *    avec le système annoncé par le fichier.
 *  - **Aucune valeur inventée.** Un champ absent vaut `null`. Renvoyer `0` ou
 *    une valeur par défaut produirait un nombre plausible et faux — le défaut
 *    le plus coûteux dans un système de décision agronomique.
 *
 * ## Formats
 *
 * PNG, JPEG, TIFF/GeoTIFF, SEG-Y. Ce sont les formats que `fileMagic.js`
 * identifie déjà ; ils couvrent l'imagerie drone (PNG/JPEG/TIFF) et le
 * géoradar (SEG-Y).
 */

/** Le fichier est du bon type mais sa structure est illisible. */
export class FichierIllisible extends Error {
  constructor(message) {
    super(message);
    this.name = 'FichierIllisible';
  }
}

const lire = (tampon, offset, taille) => {
  if (offset < 0 || offset + taille > tampon.length) return null;
  return tampon.subarray(offset, offset + taille);
};

/* ─────────────────────────────── PNG ─────────────────────────────── */

const TYPES_COULEUR_PNG = {
  0: 'niveaux de gris',
  2: 'RVB',
  3: 'palette indexée',
  4: 'niveaux de gris + alpha',
  6: 'RVB + alpha',
};

/**
 * Lit un PNG : dimensions, profondeur, type de couleur, texte et pixels/mètre.
 *
 * `pHYs` donne la taille physique d'un pixel. C'est la seule information de
 * résolution qu'un PNG porte — un PNG de drone sans `pHYs` n'a **pas** de
 * résolution au sol lisible, et c'est ce que renvoie ce module plutôt qu'une
 * estimation.
 */
export const lirePng = (tampon) => {
  if (tampon.length < 8 + 25) throw new FichierIllisible('PNG tronqué : en-tête IHDR incomplet.');
  const largeur = tampon.readUInt32BE(16);
  const hauteur = tampon.readUInt32BE(20);
  const profondeur = tampon[24];
  const typeCouleur = tampon[25];

  const resultat = {
    format: 'image/png',
    largeur,
    hauteur,
    profondeurBits: profondeur,
    typeCouleur: TYPES_COULEUR_PNG[typeCouleur] ?? `inconnu (${typeCouleur})`,
    entrelace: tampon[28] === 1,
    /** Unités par mètre ; `null` si le fichier ne le dit pas. */
    pixelsParMetreX: null,
    pixelsParMetreY: null,
    /** Résolution au sol en mètres/pixel, déduite de `pHYs` si présent. */
    resolutionSolM: null,
    texte: {},
    /** Présence d'un bloc EXIF (rare en drone, fréquent en photo géotaguée). */
    exifPresent: false,
  };

  let position = 8; // après la signature
  while (position + 12 <= tampon.length) {
    const longueur = tampon.readUInt32BE(position);
    const type = tampon.subarray(position + 4, position + 8).toString('latin1');
    const debut = position + 8;
    if (longueur > tampon.length - debut) break; // longueur annoncée incohérente

    if (type === 'pHYs' && longueur >= 9) {
      const x = tampon.readUInt32BE(debut);
      const y = tampon.readUInt32BE(debut + 4);
      const unite = tampon[debut + 8];
      if (unite === 1 && x > 0 && y > 0) {
        resultat.pixelsParMetreX = x;
        resultat.pixelsParMetreY = y;
        resultat.resolutionSolM = Number((1 / x).toFixed(6));
      }
    } else if (type === 'tEXt') {
      const brut = lire(tampon, debut, longueur);
      if (brut) {
        const sep = brut.indexOf(0);
        if (sep > 0) {
          resultat.texte[brut.subarray(0, sep).toString('latin1')] = brut
            .subarray(sep + 1)
            .toString('latin1');
        }
      }
    } else if (type === 'eXIf') {
      resultat.exifPresent = true;
    } else if (type === 'IEND') {
      break;
    }

    position = debut + longueur + 4; // +4 : CRC
  }

  return resultat;
};

/* ─────────────────────────────── JPEG ─────────────────────────────── */

const MARQUEURS_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Types EXIF utiles, et leur taille en octets par composant. */
const TYPES_EXIF = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

const lireRationnel = (tampon, offset, petitBoutisme) => {
  if (offset + 8 > tampon.length) return null;
  const num = petitBoutisme ? tampon.readUInt32LE(offset) : tampon.readUInt32BE(offset);
  const den = petitBoutisme ? tampon.readUInt32LE(offset + 4) : tampon.readUInt32BE(offset + 4);
  if (den === 0) return null;
  return num / den;
};

/**
 * Lit un sous-répertoire IFD d'un bloc EXIF.
 *
 * @returns {Map<number, {type:number, compte:number, valeur:Buffer|number}>}
 */
const lireIfd = (exif, offset, petitBoutisme) => {
  const entrees = new Map();
  if (offset + 2 > exif.length) return entrees;
  const nombre = petitBoutisme ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  for (let i = 0; i < nombre; i += 1) {
    const debut = offset + 2 + i * 12;
    if (debut + 12 > exif.length) break;
    const etiquette = petitBoutisme ? exif.readUInt16LE(debut) : exif.readUInt16BE(debut);
    const type = petitBoutisme ? exif.readUInt16LE(debut + 2) : exif.readUInt16BE(debut + 2);
    const compte = petitBoutisme ? exif.readUInt32LE(debut + 4) : exif.readUInt32BE(debut + 4);
    const taille = (TYPES_EXIF[type] ?? 1) * compte;
    // Une valeur qui tient dans 4 octets est écrite sur place ; sinon les 4
    // octets donnent un décalage vers la valeur.
    const valeur = taille <= 4 ? exif.subarray(debut + 8, debut + 12) : exif.subarray(
      (petitBoutisme ? exif.readUInt32LE(debut + 8) : exif.readUInt32BE(debut + 8)),
    );
    entrees.set(etiquette, { type, compte, valeur, offsetBrut: debut + 8 });
  }
  return entrees;
};

const rationnelExif = (entree, exif, petitBoutisme) => {
  if (!entree) return null;
  const taille = (TYPES_EXIF[entree.type] ?? 1) * entree.compte;
  const offset = taille <= 4 ? null : (petitBoutisme
    ? exif.readUInt32LE(entree.offsetBrut)
    : exif.readUInt32BE(entree.offsetBrut));
  return lireRationnel(exif, offset ?? 0, petitBoutisme);
};

/** Coordonnées GPS EXIF en degrés décimaux, ou `null`. */
const extraireGpsExif = (exif) => {
  if (!exif || exif.length < 8) return null;
  const ordre = exif.subarray(0, 2).toString('latin1');
  if (ordre !== 'II' && ordre !== 'MM') return null;
  const petitBoutisme = ordre === 'II';
  const racine = lireIfd(exif, petitBoutisme ? exif.readUInt32LE(4) : exif.readUInt32BE(4), petitBoutisme);
  const pointeurGps = racine.get(0x8825);
  if (!pointeurGps) return null;
  const offsetGps = petitBoutisme
    ? exif.readUInt32LE(pointeurGps.offsetBrut)
    : exif.readUInt32BE(pointeurGps.offsetBrut);
  const gps = lireIfd(exif, offsetGps, petitBoutisme);

  const degres = (etiquette) => {
    const brut = gps.get(etiquette);
    if (!brut) return null;
    const base = petitBoutisme ? exif.readUInt32LE(brut.offsetBrut) : exif.readUInt32BE(brut.offsetBrut);
    const deg = lireRationnel(exif, base, petitBoutisme);
    const min = lireRationnel(exif, base + 8, petitBoutisme);
    const sec = lireRationnel(exif, base + 16, petitBoutisme);
    if (deg === null || min === null) return null;
    return deg + min / 60 + (sec ?? 0) / 3600;
  };

  const latitude = degres(2);
  const longitude = degres(4);
  if (latitude === null || longitude === null) return null;

  const refLat = gps.get(1)?.valeur?.toString('latin1')[0];
  const refLon = gps.get(3)?.valeur?.toString('latin1')[0];
  return {
    latitude: refLat === 'S' ? -latitude : latitude,
    longitude: refLon === 'W' ? -longitude : longitude,
    altitudeM: rationnelExif(gps.get(6), exif, petitBoutisme),
  };
};

/** Lit un JPEG : dimensions, progression, et GPS EXIF s'il y en a. */
export const lireJpeg = (tampon) => {
  if (tampon.length < 4) throw new FichierIllisible('JPEG tronqué.');
  const resultat = {
    format: 'image/jpeg',
    largeur: null,
    hauteur: null,
    echantillons: null,
    progressif: false,
    gps: null,
    exifPresent: false,
  };

  let position = 2;
  while (position + 4 <= tampon.length) {
    if (tampon[position] !== 0xff) {
      position += 1;
      continue;
    }
    const marqueur = tampon[position + 1];
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
      position += 2;
      continue;
    }
    if (position + 4 > tampon.length) break;
    const longueur = tampon.readUInt16BE(position + 2);
    const debut = position + 4;

    if (marqueur === 0xe1) {
      // APP1 : EXIF si le bloc commence par « Exif\0\0 ».
      const entete = lire(tampon, debut, 6);
      if (entete && entete.toString('latin1').startsWith('Exif\0')) {
        resultat.exifPresent = true;
        const exif = lire(tampon, debut + 6, Math.max(0, longueur - 8));
        if (exif) resultat.gps = extraireGpsExif(exif);
      }
    } else if (MARQUEURS_SOF.has(marqueur) && longueur >= 8) {
      /*
       * Après la longueur (2 octets) viennent : précision (1), hauteur (2),
       * largeur (2), nombre de composantes (1). `debut` pointe juste après la
       * longueur : la hauteur est à +1 et la largeur à +3, pas l'inverse.
       * L'inversion donnerait une image transposée, ce qui est invisible à
       * l'œil sur un carré et faux sur tout le reste.
       */
      resultat.hauteur = tampon.readUInt16BE(debut + 1);
      resultat.largeur = tampon.readUInt16BE(debut + 3);
      resultat.echantillons = tampon[debut + 5];
      resultat.progressif = marqueur === 0xc2;
      break;
    } else if (marqueur === 0xda) {
      break; // début des données compressées : plus de métadonnées
    }

    position = debut + longueur - 2;
  }

  if (resultat.largeur === null) {
    throw new FichierIllisible('JPEG sans trame SOF : dimensions illisibles.');
  }
  return resultat;
};

/* ─────────────────────────── TIFF / GeoTIFF ─────────────────────────── */

/** Étiquettes TIFF et GeoTIFF qui intéressent les modules métier. */
const ETIQUETTES = {
  256: 'largeur',
  257: 'hauteur',
  258: 'bitsParEchantillon',
  259: 'compression',
  262: 'photometrie',
  277: 'echantillonsParPixel',
  339: 'organisationEchantillons',
  33550: 'echellePixelModele',
  33922: 'pointAncrageModele',
  34264: 'transformationModele',
  34735: 'repertoireClesGeo',
  34737: 'citationGeotiff',
  42112: 'metadonneesGdal',
  42113: 'valeurNodataGdal',
};

/** Codes de compression TIFF courants. */
const COMPRESSIONS = { 1: 'aucune', 5: 'LZW', 7: 'JPEG', 8: 'Deflate', 32773: 'PackBits', 34925: 'LZMA' };

/**
 * Lit un TIFF ou un GeoTIFF.
 *
 * Un GeoTIFF est un TIFF ordinaire portant des étiquettes privées (33550,
 * 33922, 34264, 34735). Ce module lit les deux : les dimensions viennent du
 * TIFF, l'ancrage et le système géodésique viennent des étiquettes GeoTIFF.
 *
 * BigTIFF (version 43) est **détecté et refusé** : son schéma d'offsets sur 64
 * bits diffère, et le lire à moitié produirait des valeurs fausses.
 */
export const lireTiff = (tampon) => {
  if (tampon.length < 8) throw new FichierIllisible('TIFF tronqué : en-tête de 8 octets incomplet.');
  const ordre = tampon.subarray(0, 2).toString('latin1');
  if (ordre !== 'II' && ordre !== 'MM') throw new FichierIllisible('TIFF : octet d\'ordre inconnu.');
  const petitBoutisme = ordre === 'II';
  const u16 = (o) => (petitBoutisme ? tampon.readUInt16LE(o) : tampon.readUInt16BE(o));
  const u32 = (o) => (petitBoutisme ? tampon.readUInt32LE(o) : tampon.readUInt32BE(o));
  const f64 = (o) => (petitBoutisme ? tampon.readDoubleLE(o) : tampon.readDoubleBE(o));

  const version = u16(2);
  if (version === 43) {
    throw new FichierIllisible(
      'BigTIFF (version 43) non pris en charge : ses offsets 64 bits demandent une lecture '
      + 'différente, et une lecture partielle donnerait des coordonnées fausses.',
    );
  }
  if (version !== 42) throw new FichierIllisible(`TIFF : version inattendue (${version}).`);

  const offsetIfd = u32(4);
  if (offsetIfd + 2 > tampon.length) throw new FichierIllisible('TIFF : répertoire d\'images hors du fichier.');

  const nombre = u16(offsetIfd);
  const champs = {};
  const doubles = (etiquette) => {
    // Valeur DOUBLE : toujours stockée au décalage indiqué (8 octets > 4).
    const entree = bruts.get(etiquette);
    if (!entree) return null;
    const offset = u32(entree.offsetBrut);
    const valeurs = [];
    for (let i = 0; i < entree.compte; i += 1) {
      if (offset + i * 8 + 8 > tampon.length) break;
      valeurs.push(f64(offset + i * 8));
    }
    return valeurs.length ? valeurs : null;
  };

  const bruts = new Map();
  for (let i = 0; i < nombre; i += 1) {
    const debut = offsetIfd + 2 + i * 12;
    if (debut + 12 > tampon.length) break;
    const etiquette = u16(debut);
    const type = u16(debut + 2);
    const compte = u32(debut + 4);
    bruts.set(etiquette, { type, compte, offsetBrut: debut + 8 });

    const nom = ETIQUETTES[etiquette];
    if (!nom) continue;

    if (type === 3 || type === 4) {
      /*
       * SHORT (2 octets) ou LONG (4 octets). Une valeur unique est rapportée
       * telle quelle ; plusieurs valeurs sont rapportées en tableau — les
       * échantillons d'un raster RVB en portent trois, et n'en garder qu'une
       * ferait croire à une image en niveaux de gris.
       */
      const octets = type === 3 ? 2 : 4;
      const lireUn = (o) => {
        if (o + octets > tampon.length) return null;
        if (type === 3) return petitBoutisme ? tampon.readUInt16LE(o) : tampon.readUInt16BE(o);
        return petitBoutisme ? tampon.readUInt32LE(o) : tampon.readUInt32BE(o);
      };
      if (compte * octets <= 4) {
        const valeurs = [];
        for (let k = 0; k < compte; k += 1) valeurs.push(lireUn(debut + 8 + k * octets));
        champs[nom] = compte === 1 ? valeurs[0] : valeurs;
      } else {
        const offset = u32(debut + 8);
        const valeurs = [];
        for (let k = 0; k < compte; k += 1) valeurs.push(lireUn(offset + k * octets));
        champs[nom] = compte === 1 ? valeurs[0] : valeurs;
      }
    } else if (type === 2) {
      // ASCII : sur place si ≤ 4 octets, sinon au décalage.
      const offset = compte <= 4 ? debut + 8 : u32(debut + 8);
      const brut = lire(tampon, offset, Math.max(0, compte - 1));
      champs[nom] = brut ? brut.toString('utf8').replace(/\0+$/, '') : null;
    }
  }

  const resultat = {
    format: 'image/tiff',
    grand: petitBoutisme ? 'petit boutisme (II)' : 'grand boutisme (MM)',
    largeur: champs.largeur ?? null,
    hauteur: champs.hauteur ?? null,
    bitsParEchantillon: champs.bitsParEchantillon ?? null,
    compression: COMPRESSIONS[champs.compression] ?? (champs.compression ? `code ${champs.compression}` : null),
    echantillonsParPixel: champs.echantillonsParPixel ?? null,
    /** Résolution au sol, en unités du système géodésique (degrés ou mètres). */
    resolutionSol: doubles(33550),
    /** Point d'ancrage : [rasterX, rasterY, rasterZ, modeleX, modeleY, modeleZ]. */
    pointAncrage: doubles(33922),
    transformationModele: doubles(34264),
    repertoireClesGeo: bruts.get(34735) ? { compte: bruts.get(34735).compte } : null,
    citationGeotiff: champs.citationGeotiff ?? null,
    valeurNodata: champs.valeurNodataGdal ?? null,
    geotiff: Boolean(doubles(33550) || doubles(33922) || doubles(34264)),
  };

  /*
   * Coordonnées du coin supérieur gauche, quand le fichier les donne.
   *
   * Sans `pointAncrage`, aucune coordonnée n'est déduite : la rapporter à
   * (0, 0) placerait le relevé dans le golfe de Guinée, ce qui est pire que de
   * dire « inconnu ».
   */
  if (resultat.pointAncrage && resultat.pointAncrage.length >= 6) {
    resultat.coinSuperieurGauche = {
      x: resultat.pointAncrage[3],
      y: resultat.pointAncrage[4],
    };
  } else {
    resultat.coinSuperieurGauche = null;
  }

  return resultat;
};

/* ─────────────────────────────── SEG-Y ─────────────────────────────── */

const SYSTEMES_MESURE = { 1: 'mètres', 2: 'pieds' };
const FORMATS_ECHANTILLON = {
  1: 'entier 4 octets',
  2: 'entier 2 octets',
  3: 'flottant 4 octets',
  4: 'entier 2 octets sans signe',
  5: 'IEEE 4 octets',
  8: 'entier 1 octet',
};

/**
 * Lit l'en-tête binaire SEG-Y (400 octets à partir de l'octet 3 200).
 *
 * C'est là que se trouvent les paramètres d'acquisition utiles : intervalle
 * d'échantillonnage, nombre d'échantillons par trace, format des échantillons,
 * unité de mesure, et le nombre de traces. Ce sont des entiers 16 bits **grand
 * boutisme**, quelle que soit la machine émettrice — la norme l'impose.
 */
export const lireSegy = (tampon) => {
  const EN_TETE_BINAIRE = 3200;
  if (tampon.length < EN_TETE_BINAIRE + 400) {
    throw new FichierIllisible('SEG-Y tronqué : en-tête binaire de 400 octets incomplet.');
  }
  const u16 = (o) => tampon.readUInt16BE(o);

  const intervalle = u16(EN_TETE_BINAIRE + 16);
  const echantillons = u16(EN_TETE_BINAIRE + 20);
  const format = u16(EN_TETE_BINAIRE + 24);
  const systeme = u16(EN_TETE_BINAIRE + 54);

  // L'en-tête textuel est en EBCDIC ou en ASCII selon l'outil émetteur ; on le
  // rapporte tel quel, nettoyé, sans prétendre l'interpréter.
  const brut = tampon.subarray(0, EN_TETE_BINAIRE);
  const estEbcdic = brut[0] > 0x7f;

  const resultat = {
    format: 'application/x-segy',
    intervalleEchantillonnageMicroS: intervalle || null,
    echantillonsParTrace: echantillons || null,
    formatEchantillon: FORMATS_ECHANTILLON[format] ?? (format ? `code ${format}` : null),
    systemeMesure: SYSTEMES_MESURE[systeme] ?? (systeme ? `code ${systeme}` : null),
    encodageEnTete: estEbcdic ? 'EBCDIC' : 'ASCII',
    enTeteTextuel: brut.toString(estEbcdic ? 'latin1' : 'utf8').replace(/\0+/g, '').trim().slice(0, 500),
    /**
     * Durée couverte par une trace, déduite — et non lue.
     *
     * C'est la seule valeur **calculée** de ce module : `intervalle × nombre
     * d'échantillons`. Elle est marquée comme telle pour ne pas passer pour une
     * donnée du fichier.
     */
    dureeTraceCalculeeMs: intervalle && echantillons ? (intervalle * echantillons) / 1000 : null,
  };

  return resultat;
};

/* ─────────────────────────── point d'entrée ─────────────────────────── */

/**
 * Analyse un fichier déjà identifié par `fileMagic.detecterFormat`.
 *
 * @param {Buffer} tampon Le fichier **complet**, pas seulement l'en-tête.
 * @param {string} format Le format détecté sur les octets d'en-tête.
 * @returns {{ format: string, extrait: object|null, erreur: string|null }}
 *
 * Une erreur de lecture **ne remonte pas** : un fichier corrompu est un résultat
 * de traitement (`ERROR`), pas une panne du serveur. L'appelant écrit le message
 * dans `errorMessage` et le statut adéquat.
 */
export const analyserFichier = (tampon, format) => {
  const octets = Buffer.isBuffer(tampon) ? tampon : Buffer.from(tampon ?? []);
  try {
    switch (format) {
      case 'image/png':
        return { format, extrait: lirePng(octets), erreur: null };
      case 'image/jpeg':
        return { format, extrait: lireJpeg(octets), erreur: null };
      case 'image/tiff':
        return { format, extrait: lireTiff(octets), erreur: null };
      case 'application/x-segy':
        return { format, extrait: lireSegy(octets), erreur: null };
      case 'application/zip':
        return {
          format,
          /*
           * Une archive n'est pas ouverte. Lire un ZIP demande de décompresser
           * son contenu, et accepter une décompression d'archive fournie par un
           * client expose aux bombes à décompression. Le fichier est conservé,
           * son statut reste à traiter, et c'est dit.
           */
          extrait: null,
          erreur:
            'Archive ZIP reçue et conservée, mais non ouverte : la décompression '
            + "d'une archive fournie par un client expose aux bombes à décompression.",
        };
      default:
        return {
          format,
          extrait: null,
          erreur: `Format identifié « ${format} » sans lecteur correspondant.`,
        };
    }
  } catch (erreur) {
    return { format, extrait: null, erreur: erreur.message };
  }
};
