import { created, success } from '../../shared/http/response.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { env } from '../../config/env.js';
import { lireMultipart, CorpsTropVolumineux, MultipartInvalide } from '../../shared/multipart.js';
import * as service from './geospatialImport.service.js';
import * as traitement from './geospatialProcessing.service.js';

/**
 * Dépôt d'un fichier géoradar ou drone, en JSON base64.
 *
 * Répond `201` avec la ligne au statut `RECEIVED`. **Aucun traitement n'est
 * lancé** : voir `process` ci-dessous.
 */
export const receive = async (req, res) => {
  const resultat = await service.recevoir(req.body, req);
  return created(res, resultat, {
    message: 'Fichier reçu. Aucun traitement du contenu n’a été effectué.',
  });
};

/**
 * Dépôt en `multipart/form-data` — le chemin à utiliser pour les gros fichiers.
 *
 * ## Pourquoi un second chemin d'entrée
 *
 * Le chemin base64 gonfle le fichier de 33 % et oblige à le charger entier en
 * mémoire côté client **et** côté serveur avant le premier octet utile. Un
 * relevé de 64 Mo devient ~85 Mo de corps. Le multipart n'encode rien.
 *
 * ## Ce qui est contrôlé
 *
 * Le plafond est appliqué **pendant** la lecture du flux : un fichier trop gros
 * est refusé avant d'être entièrement reçu, pas après. Les contrôles métier
 * (taille par type, signature d'en-tête, empreinte, doublon, quota) sont ceux du
 * chemin base64 — même fonction, pas une copie.
 */
export const receiveMultipart = async (req, res) => {
  let parties;
  try {
    parties = await lireMultipart(req, { limiteOctets: env.GEOSPATIAL_MULTIPART_MAX_BYTES });
  } catch (erreur) {
    if (erreur instanceof CorpsTropVolumineux) throw ApiError.payloadTooLarge(erreur.message);
    if (erreur instanceof MultipartInvalide) throw ApiError.badRequest(erreur.message);
    throw erreur;
  }

  const fichier = parties.fichiers[0];
  if (!fichier) {
    throw ApiError.badRequest(
      'Aucun fichier dans le formulaire. Le champ attendu porte un `filename`.',
    );
  }

  const { kind, filename, plotId, deviceId } = parties.champs;
  if (!kind) throw ApiError.badRequest('Le champ `kind` est requis (GPR ou DRONE_IMAGE).');

  const resultat = await service.recevoirTampon(
    {
      tampon: fichier.tampon,
      kind,
      // Le nom vient du formulaire s'il est fourni, sinon de celui du fichier.
      filename: filename || fichier.filename || 'fichier',
      plotId: plotId || null,
      deviceId: deviceId || null,
    },
    req,
  );

  return created(res, { ...resultat, reception: 'multipart' }, {
    message: 'Fichier reçu. Aucun traitement du contenu n’a été effectué.',
  });
};

/**
 * Traite un dépôt : lecture du fichier, extraction des métadonnées.
 *
 * Le traitement est **explicite**. Le lancer dans la requête de dépôt
 * transformerait un téléversement rapide en requête longue, et ferait échouer
 * le dépôt lui-même pour une erreur de lecture du contenu.
 */
export const process = async (req, res) => {
  const ligne = await traitement.traiter(req.params.id, req, {
    force: req.query.force === 'true',
  });
  return success(res, ligne, {
    message: ligne.status === 'COMPLETED'
      ? 'Fichier traité : métadonnées extraites.'
      : `Traitement terminé au statut ${ligne.status}.`,
  });
};

/** Traite les dépôts en attente de l'organisation. */
export const processPending = async (req, res) => {
  const resultat = await traitement.traiterEnAttente(req.tenant.organizationId, {
    limite: Number(req.body?.limit ?? req.query?.limit ?? 20),
  });
  return success(res, resultat);
};

/** État du traitement de l'organisation : utile au diagnostic et au support. */
export const processingState = async (req, res) =>
  success(res, await traitement.etatTraitement(req.tenant.organizationId));

/** Liste les dépôts de l'organisation active. */
export const list = async (req, res) => {
  const { data, meta } = await service.lister(req.query, req);
  return success(res, data, { meta });
};

/** Un dépôt. 404 s'il appartient à une autre organisation. */
export const get = async (req, res) => {
  const ligne = await service.obtenir(req.params.id, req);
  return success(res, ligne);
};
