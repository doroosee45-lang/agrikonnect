/**
 * Dépôt de fichiers géospatiaux — géoradar (GPR) et imagerie drone.
 *
 * ## Ce que ce module fait
 *
 * Il **reçoit** un fichier, vérifie qu'il est acceptable, le stocke, et
 * enregistre une ligne `RECEIVED`. C'est tout.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Aucun traitement du contenu.** Aucun parsing, aucune extraction de
 * coordonnées, aucune valeur calculée, aucune estimation. Le fichier est
 * conservé tel quel ; sa seule interprétation est « ce fichier commence comme
 * le type déclaré ».
 *
 * Le statut reste donc **`RECEIVED`**, et seulement `RECEIVED`. Les statuts
 * `PROCESSING`, `COMPLETED` et `ERROR` existent dans l'enum mais ne sont
 * **jamais écrits par ce module** : ils appartiennent à une étape de traitement
 * à part, qui n'existe pas encore. Écrire `COMPLETED` ici serait affirmer qu'un
 * traitement a eu lieu alors qu'aucun n'a été lancé.
 *
 * ## Pourquoi vérifier le type sur les octets
 *
 * Une extension est une déclaration du client. Vérifier le type sur
 * l'extension seule revient à faire confiance à l'expéditeur sur le point
 * précis qu'on cherche à contrôler. Voir `src/shared/fileMagic.js`.
 */
import crypto from 'node:crypto';

import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';
import {
  HEADER_BYTES,
  assainirNom,
  verifierType,
} from '../../shared/fileMagic.js';
import { storageKey } from '../../shared/crypto.js';
import { ulid } from '../../shared/ids.js';
import { env } from '../../config/env.js';

/* ─────────────────────────── limites ─────────────────────────── */

/**
 * Tailles maximales par type, en octets.
 *
 * ⚠ **Plafond imposé par le transport, pas par le métier.** Le dépôt passe par
 * un corps JSON en base64 : un fichier de 64 Mo devient ~85 Mo une fois encodé,
 * et le parseur de ce chemin est borné à 100 Mo (`src/app.js`). Annoncer ici
 * 512 Mo pour le géoradar serait indiquer une limite **inatteignable** — le
 * corps serait refusé bien avant. Les deux plafonds sont donc alignés sur ce
 * que le transport permet réellement.
 *
 * Les relevés géoradar dépassent couramment 64 Mo. Les accepter demanderait un
 * téléversement en flux (multipart), qui exige une dépendance absente du dépôt.
 * C'est une décision à prendre, pas un détail : voir docs/GEOSPATIAL-IMPORT.md
 * §« Ce qui n'est pas vérifié ».
 */
const TAILLES_PAR_DEFAUT = {
  GPR: 64 * 1024 * 1024, // 64 Mo
  DRONE_IMAGE: 64 * 1024 * 1024, // 64 Mo
};

/**
 * Plafond appliqué au corps de la requête, quel que soit le type.
 *
 * Le dépôt passe par un corps JSON en base64 : le texte transmis est ~33 % plus
 * volumineux que le fichier. Ce plafond protège la mémoire du processus **avant**
 * tout décodage — sans lui, un corps de 2 Go serait intégralement lu puis
 * décodé avant qu'on puisse le refuser.
 */
const PLAFOND_CORPS_BASE64 = 700 * 1024 * 1024;

export const tailleMaximale = (kind) =>
  LIMITES_TAILLE[kind] ?? LIMITES_TAILLE.DRONE_IMAGE;

/**
 * Limites effectivement appliquées. Initialisées depuis les valeurs par défaut,
 * réglables par `definirTaillesMaximales` — même mécanisme que
 * `definirStockage`, pour que les tests puissent descendre le plafond sans
 * allouer 64 Mo, et pour que l'exploitation puisse l'ajuster.
 */
const LIMITES_TAILLE = { ...TAILLES_PAR_DEFAUT };

export const definirTaillesMaximales = (limites) => {
  Object.assign(LIMITES_TAILLE, limites);
};

/** Restaure les plafonds d'origine (appelé par les tests en `afterEach`). */
export const reinitialiserTaillesMaximales = () => {
  for (const clef of Object.keys(LIMITES_TAILLE)) delete LIMITES_TAILLE[clef];
  Object.assign(LIMITES_TAILLE, TAILLES_PAR_DEFAUT);
};

export const TYPES_AUTORISES = Object.freeze(['GPR', 'DRONE_IMAGE']);

/**
 * Plafond cumulé de stockage par organisation, en octets. `0` désactive le
 * contrôle.
 *
 * Initialisé depuis `GEOSPATIAL_ORG_QUOTA_BYTES`, et réglable par
 * `definirQuota` : `env` est validé et figé à l'import du module, un test ne
 * peut donc pas le faire varier autrement. Même mécanisme que
 * `definirStockage` et `definirTaillesMaximales`.
 */
let quotaOctets = env.GEOSPATIAL_ORG_QUOTA_BYTES;

export const definirQuota = (octets) => {
  quotaOctets = Number(octets) || 0;
};

export const reinitialiserQuota = () => {
  quotaOctets = env.GEOSPATIAL_ORG_QUOTA_BYTES;
};

export const quotaCourant = () => quotaOctets;

/** Ressource comptée par le compteur transactionnel du quota de dépôt. */
export const RESSOURCE_DEPOT = 'GEOSPATIAL_IMPORT';

/**
 * Occupation cumulée de l'organisation, d'après le compteur.
 *
 * Le premier dépôt d'une organisation initialise le compteur depuis les lignes
 * déjà stockées : sans cela, des fichiers déposés avant l'existence du
 * compteur ne compteraient pour rien et le plafond serait offert à neuf.
 */
const lireUsage = async (client, organizationId) => {
  const compteur = await client.resourceUsage.findUnique({
    where: {
      organizationId_resource: { organizationId, resource: RESSOURCE_DEPOT },
    },
  });
  if (compteur) return Number(compteur.usedBytes);
  const agrego = await client.geospatialImport.aggregate({
    where: { organizationId },
    _sum: { sizeBytes: true },
  });
  return agrego?._sum?.sizeBytes ?? 0;
};

/** Occupation actuelle, pour affichage et tests. */
export const usageCourant = (organizationId) => lireUsage(prisma, organizationId);

/* ─────────────────────────── stockage ─────────────────────────── */

let stockage = null;

/**
 * Injecte le pilote de stockage. Les tests appellent cette fonction avec le
 * pilote local ; la production laisse l'initialisation paresseuse se faire
 * depuis la configuration.
 */
export const definirStockage = (pilote) => {
  stockage = pilote;
};

export const obtenirStockage = async () => {
  if (stockage) return stockage;
  const { creerStockage } = await import('../../integrations/storage.js');
  const pilote = env.GEOSPATIAL_STORAGE_DRIVER ?? 'local';
  if (pilote === 'object') {
    const { supabaseAdmin } = await import('../../config/supabase.js');
    stockage = await creerStockage({
      pilote: 'object',
      client: supabaseAdmin,
      panier: env.GEOSPATIAL_BUCKET,
    });
  } else if (pilote === 's3') {
    /*
     * Configuration incomplète ⇒ refus de démarrer le pilote, pas repli sur le
     * disque local. Un repli silencieux écrirait sur le disque éphémère d'un
     * conteneur et les fichiers disparaîtraient au redémarrage.
     */
    stockage = await creerStockage({ pilote: 's3', panier: env.S3_BUCKET ?? env.GEOSPATIAL_BUCKET });
  } else {
    stockage = await creerStockage({ pilote: 'local', racine: env.GEOSPATIAL_STORAGE_DIR });
  }
  return stockage;
};

/* ─────────────────────────── dépôt ─────────────────────────── */

/**
 * Retire les blancs : le base64 circule souvent replié sur 76 colonnes, et ces
 * retours à la ligne sont licites. Ils sont retirés avant tout contrôle, sinon
 * un encodage parfaitement valide serait refusé.
 */
const normaliserBase64 = (chaine) => chaine.replace(/\s+/g, '');

/**
 * Contrôle **syntaxique** de la chaîne reçue.
 *
 * `Buffer.from(x, 'base64')` ne lève jamais : il ignore silencieusement les
 * caractères hors alphabet et s'arrête au premier caractère inattendu. Une
 * chaîne corrompue produit donc un fichier **tronqué** mais accepté. Il faut
 * donc valider la chaîne elle-même, pas seulement ce que Node en tire.
 */
const estBase64Valide = (chaine) => {
  if (chaine.length === 0) return false;
  if (chaine.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(chaine)) return false;
  // Le rembourrage n'est licite qu'en toute fin : « = » ailleurs = corrompu.
  return !chaine.slice(0, -2).includes('=');
};

/**
 * Reçoit un fichier et l'enregistre.
 *
 * @param {object} payload
 * @param {'GPR'|'DRONE_IMAGE'} payload.kind Type déclaré.
 * @param {string} payload.filename Nom d'origine, assaini avant tout usage.
 * @param {string} payload.contentBase64 Contenu du fichier, encodé base64.
 * @param {string} [payload.plotId] Parcelle concernée, si connue.
 * @param {string} [payload.deviceId] Équipement à l'origine du relevé.
 * @returns {Promise<object>} La ligne créée, au statut `RECEIVED`.
 */
/**
 * Cœur du dépôt : prend des **octets déjà décodés** et fait tous les contrôles.
 *
 * Extrait de `recevoir` pour que le téléversement multipart passe par exactement
 * les mêmes garde-fous que le chemin base64 — taille par type, signature
 * d'en-tête, empreinte, refus de doublon, quota transactionnel, clé construite
 * côté serveur. Un second chemin d'entrée qui réécrirait ces contrôles finirait
 * par en oublier un.
 */
export const recevoirTampon = async ({ tampon, kind, filename, plotId = null, deviceId = null }, req) => {
  const organizationId = req.tenant.organizationId;

  // ── 1. Taille, par type.
  const limite = tailleMaximale(kind);
  if (tampon.length > limite) {
    throw ApiError.payloadTooLarge(
      `Fichier de ${tampon.length} octets : au-dessus de la limite de ${limite} octets `
      + `pour le type ${kind}`,
    );
  }

  // ── 2. Type vérifié sur les octets d'en-tête, pas sur l'extension.
  const entete = tampon.subarray(0, Math.min(HEADER_BYTES, tampon.length));
  const controle = verifierType(entete, kind);
  if (!controle.ok) {
    throw ApiError.badRequest(controle.raison);
  }

  // ── 3. Somme de contrôle, calculée à la réception.
  const checksum = crypto.createHash('sha256').update(tampon).digest('hex');

  // ── 4. Doublon exact dans la même organisation.
  /*
   * Portée à l'organisation : le même relevé déposé par deux organisations
   * différentes est légitime (partage de données entre coopératives). Refusé
   * seulement au sein de la même organisation, où c'est une erreur de
   * manipulation, pas une information nouvelle.
   */
  const existant = await prisma.geospatialImport.findFirst({
    where: { organizationId, checksum },
    select: { id: true, createdAt: true, filename: true },
  });
  if (existant) {
    throw ApiError.conflict(
      `Un fichier identique (SHA-256 ${checksum.slice(0, 12)}…) a déjà été déposé `
      + `le ${existant.createdAt.toISOString()} sous l'identifiant ${existant.id}`,
    );
  }

  // ── 6. Parcelle, si fournie : elle doit appartenir à l'organisation.
  if (plotId) {
    const parcelle = await prisma.plot.findFirst({
      where: { id: plotId, organizationId },
      select: { id: true },
    });
    // 404 et non 403 : on ne révèle pas l'existence d'une parcelle d'un tiers.
    if (!parcelle) throw ApiError.notFound('Parcelle introuvable');
  }

  /*
   * ── 6b. Équipement, si fourni : même règle.
   *
   * Sans ce contrôle, `deviceId` est une chaîne libre : n'importe qui peut
   * rattacher un dépôt à l'équipement d'une autre organisation, et toute
   * lecture qui joint sur l'équipement remonterait alors une provenance
   * mensongère. 404 pour la même raison qu'au-dessus.
   */
  if (deviceId) {
    const equipement = await prisma.iotDevice.findFirst({
      where: { id: deviceId, organizationId },
      select: { id: true },
    });
    if (!equipement) throw ApiError.notFound('Équipement introuvable');
  }

  /*
   * ── 5c. Quota cumulé de stockage de l'organisation.
   *
   * Sans plafond, une organisation peut déposer indéfiniment des fichiers
   * distincts : le refus de doublon ne borne rien, puisqu'il suffit de changer
   * un octet. Le contrôle porte sur la somme déjà stockée **plus** ce fichier,
   * pour refuser avant l'écriture plutôt que laisser un dépôt partiel.
   */
  const quota = quotaOctets;
  if (quota > 0) {
    /*
     * Pré-contrôle **non décisif** : il refuse tôt, avant d'écrire un fichier
     * de 64 Mo pour rien, mais il ne tranche pas. La décision appartient à la
     * transaction de l'étape 9.
     *
     * Deux dépôts concurrents peuvent passer ici en même temps — c'est
     * exactement la course que l'ancien contrôle laissait passer jusqu'au
     * bout. Elle est maintenant rattrapée, pas ignorée.
     */
    const dejaStocke = await lireUsage(prisma, organizationId);
    if (dejaStocke + tampon.length > quota) {
      throw ApiError.payloadTooLarge(
        `Quota de stockage de l'organisation dépassé : ${dejaStocke} octets déjà stockés, `
        + `${tampon.length} octets demandés, plafond ${quota} octets`,
      );
    }
  }

  // ── 6. Nom assaini, clé construite côté serveur.
  const nomAssaini = assainirNom(filename);
  /*
   * L'extension de la clé vient du format **détecté**, jamais du nom fourni.
   * Reprendre l'extension du client remettrait dans la clé exactement la
   * confiance qu'on vient de refuser d'accorder : un PNG nommé `.jpg` serait
   * stocké sous `.jpg`. Le nom assaini reste sur la ligne, pour l'affichage.
   */
  const extension = extensionParFormat(controle.format);
  const id = `gim_${ulid()}`;
  /*
   * La clé ne contient **jamais** le nom fourni par le client : organisation,
   * identifiant généré, extension validée. C'est ce qui rend l'évasion de
   * chemin impossible, indépendamment de l'assainissement du nom affiché.
   */
  const cle = storageKey('geospatial', organizationId, kind.toLowerCase(), `${id}.${extension}`);

  // ── 7. Écriture.
  const depot = await obtenirStockage();
  await depot.ecrire(cle, tampon);

  /*
   * ── 8. Réservation du quota **et** ligne enregistrée, dans une même
   * transaction, au statut RECEIVED et à aucun autre.
   *
   * L'incrément du compteur verrouille sa ligne : un second dépôt arrivé en
   * même temps attend le commit du premier, puis voit la somme mise à jour.
   * C'est ce qui ferme la course du point 6c. En cas de dépassement, la
   * transaction est annulée — ni réservation, ni ligne — et le `catch`
   * ci-dessous supprime le fichier déjà écrit.
   */
  let ligne;
  try {
    ligne = await prisma.$transaction(async (tx) => {
      const compteur = await tx.resourceUsage.upsert({
        where: {
          organizationId_resource: { organizationId, resource: RESSOURCE_DEPOT },
        },
        create: {
          organizationId,
          resource: RESSOURCE_DEPOT,
          usedBytes: BigInt(tampon.length),
        },
        update: { usedBytes: { increment: BigInt(tampon.length) } },
      });
      const occupe = Number(compteur.usedBytes);
      if (quota > 0 && occupe > quota) {
        throw ApiError.payloadTooLarge(
          `Quota de stockage de l'organisation dépassé : ${occupe - tampon.length} octets `
          + `déjà stockés, ${tampon.length} octets demandés, plafond ${quota} octets`,
        );
      }
      return tx.geospatialImport.create({
        data: {
          id,
          organizationId,
          plotId,
          deviceId,
          kind,
          format: controle.format,
          filename: nomAssaini,
          storageKey: cle,
          sizeBytes: tampon.length,
          checksum,
          status: 'RECEIVED',
          // Le fichier vient d'un équipement déclaré par l'utilisateur : `REAL`.
          // Aucune donnée n'est simulée ici — rien n'est généré.
          mode: 'REAL',
          createdBy: req.user?.id ?? null,
        },
        });
    });
  } catch (erreur) {
    /*
     * Si l'insertion échoue — dont le cas de course où deux dépôts identiques
     * arrivent en même temps et où la contrainte d'unicité tranche — le fichier
     * déjà écrit ne doit pas rester orphelin dans le stockage.
     */
    await depot.supprimer(cle).catch(() => {});
    if (erreur.code === 'P2002') {
      throw ApiError.conflict('Un fichier identique a été déposé entre-temps');
    }
    throw erreur;
  }

  await auditAs(req, {
    action: 'geospatialImport.receive',
    resource: 'GeospatialImport',
    resourceId: ligne.id,
    newValue: {
      kind,
      format: controle.format,
      sizeBytes: tampon.length,
      checksum,
      // Le nom d'origine n'est pas tracé : il peut porter des informations
      // personnelles (nom de l'opérateur, nom de machine). Seul le nom assaini
      // est conservé, sur la ligne.
      detectionFaible: controle.faible === true,
    },
  });

  return {
    geospatialImport: ligne,
    detection: {
      format: controle.format,
      /**
       * `true` pour SEG-Y : ce format n'a pas de signature magique fiable, le
       * contrôle repose sur le marqueur de révision. C'est dit, pas caché.
       */
      controleFaible: controle.faible === true,
    },
  };
};

/**
 * Dépôt par corps JSON base64 — chemin historique, conservé pour la
 * compatibilité des clients existants.
 *
 * @param {object} payload
 * @param {'GPR'|'DRONE_IMAGE'} payload.kind Type déclaré.
 * @param {string} payload.filename Nom d'origine, assaini avant tout usage.
 * @param {string} payload.contentBase64 Contenu du fichier, encodé base64.
 * @param {string} [payload.plotId] Parcelle concernée, si connue.
 * @param {string} [payload.deviceId] Équipement à l'origine du relevé.
 * @returns {Promise<object>} La ligne créée, au statut `RECEIVED`.
 */
export const recevoir = async (payload, req) => {
  const { kind, filename, contentBase64, plotId = null, deviceId = null } = payload;

  // ── 1. Décodage, avec plafond sur le corps avant tout décodage complet.
  if (typeof contentBase64 !== 'string' || contentBase64.length === 0) {
    throw ApiError.badRequest('Le champ `contentBase64` est requis et ne peut pas être vide');
  }
  const normalise = normaliserBase64(contentBase64);
  if (normalise.length > PLAFOND_CORPS_BASE64) {
    throw ApiError.payloadTooLarge(
      `Corps de requête trop volumineux (${normalise.length} caractères base64)`,
    );
  }
  if (!estBase64Valide(normalise)) {
    throw ApiError.badRequest(
      '`contentBase64` n\u2019est pas du base64 valide : alphabet, longueur multiple de 4 '
      + 'ou rembourrage incorrect',
    );
  }

  const tampon = Buffer.from(normalise, 'base64');
  if (tampon.length === 0) {
    throw ApiError.badRequest('`contentBase64` ne contient aucune donnée décodable');
  }
  /*
   * Contrôle aller-retour contre la chaîne **reçue** (normalisée), pas contre un
   * second décodage : comparer `Buffer.from(x)` à `Buffer.from(x)` est une
   * tautologie qui ne peut jamais échouer.
   *
   * Ce test attrape ce que le contrôle syntaxique laisse passer — notamment les
   * bits de queue non nuls, où plusieurs chaînes base64 différentes décodent
   * vers les mêmes octets. `toString('base64')` produit la forme canonique : si
   * la chaîne reçue n'était pas canonique, elle diffère et est refusée.
   */
  if (tampon.toString('base64') !== normalise) {
    throw ApiError.badRequest('Encodage base64 non canonique (aller-retour différent)');
  }

  return recevoirTampon({ tampon, kind, filename, plotId, deviceId }, req);
};

/** Extension déduite du format détecté, quand le nom n'en portait pas. */
const extensionParFormat = (format) => {
  switch (format) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/tiff': return 'tif';
    case 'application/zip': return 'zip';
    case 'application/x-segy': return 'sgy';
    default: return 'bin';
  }
};

/* ─────────────────────────── lecture ─────────────────────────── */

/** Liste les dépôts de l'organisation active. */
export const lister = async (query, req) => {
  const organizationId = req.tenant.organizationId;
  const where = {
    organizationId,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.plotId ? { plotId: query.plotId } : {}),
  };
  const [lignes, total] = await Promise.all([
    prisma.geospatialImport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(query.limit ?? 50), 200),
      skip: Number(query.offset ?? 0),
    }),
    prisma.geospatialImport.count({ where }),
  ]);
  return { data: lignes, meta: { total, limit: Number(query.limit ?? 50), offset: Number(query.offset ?? 0) } };
};

/**
 * Un dépôt, ou **404** s'il appartient à une autre organisation.
 *
 * 404 et non 403 : répondre 403 révélerait que l'identifiant existe.
 */
export const obtenir = async (id, req) => {
  const ligne = await prisma.geospatialImport.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!ligne) throw ApiError.notFound('Dépôt introuvable');
  return ligne;
};
