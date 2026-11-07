import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { logger } from '../../shared/http/logger.js';
import { analyserFichier } from '../../shared/fileParsers.js';
import { obtenirStockage } from './geospatialImport.service.js';

/**
 * Traitement des fichiers géospatiaux déposés.
 *
 * ## Le cycle de vie
 *
 * ```
 * RECEIVED ──► PROCESSING ──► COMPLETED   (métadonnées extraites, `result` écrit)
 *                     └─────► ERROR       (fichier illisible, `errorMessage` écrit)
 * ```
 *
 * Un dépôt reste `RECEIVED` jusqu'à ce qu'un traitement soit demandé
 * explicitement. Aucun traitement n'est lancé à la réception : lire un fichier
 * de 64 Mo coûte du temps et de la mémoire, et le faire dans la requête HTTP du
 * dépôt transformerait un téléversement rapide en requête longue.
 *
 * ## Ce que « traiter » veut dire ici
 *
 * Lire les en-têtes et en extraire les métadonnées utiles (dimensions,
 * résolution au sol, ancrage géodésique, paramètres d'acquisition géoradar).
 * **Aucun pixel n'est décodé, aucune carte n'est produite, aucune analyse
 * agronomique n'est faite.** Voir `docs/PERIMETRE-BACKEND.md`.
 *
 * ## Idempotence
 *
 * Traiter deux fois ne refait pas le travail : un dépôt déjà `PROCESSING` ou
 * `COMPLETED` est refusé, sauf demande explicite de retraitement. Sans cela,
 * deux appels concurrents liraient le même fichier deux fois et le dernier
 * écraserait le résultat du premier sans que rien ne le signale.
 */

/** Passe le dépôt à `PROCESSING` de façon atomique, ou renvoie `null`. */
const reserverTraitement = async (id, { forcer }) => {
  const ligne = await prisma.geospatialImport.findUnique({ where: { id } });
  if (!ligne) return { erreur: ApiError.notFound('Dépôt introuvable') };
  if (!forcer && (ligne.status === 'PROCESSING' || ligne.status === 'COMPLETED')) {
    return {
      erreur: ApiError.conflict(
        `Dépôt déjà au statut ${ligne.status}. Passe force=true pour le retraiter.`,
      ),
    };
  }
  /*
   * `updateMany` avec le statut attendu en condition : deux demandes
   * simultanées ne peuvent pas réserver le même dépôt. `update` seul ne le
   * garantit pas, il écrirait simplement le statut.
   */
  const reserve = await prisma.geospatialImport.updateMany({
    where: {
      id,
      ...(forcer ? {} : { status: { in: ['RECEIVED', 'ERROR'] } }),
    },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
      errorMessage: null,
    },
  });
  if (reserve.count === 0) {
    return { erreur: ApiError.conflict('Dépôt en cours de traitement par un autre appel.') };
  }
  return { ligne };
};

/**
 * Traite un dépôt : lecture, extraction, écriture du résultat.
 *
 * @param {string} id
 * @param {object} req
 * @param {{ force?: boolean }} options
 */
export const traiter = async (id, req, { force = false } = {}) => {
  const organizationId = req.tenant.organizationId;
  const ligne = await prisma.geospatialImport.findFirst({ where: { id, organizationId } });
  if (!ligne) throw ApiError.notFound('Dépôt introuvable');

  const reservation = await reserverTraitement(id, { forcer: force });
  if (reservation.erreur) throw reservation.erreur;

  const depot = await obtenirStockage();
  let tampon;
  try {
    tampon = await depot.lire(ligne.storageKey);
  } catch (erreur) {
    await marquerErreur(id, `Fichier illisible depuis le stockage : ${erreur.message}`);
    return prisma.geospatialImport.findUnique({ where: { id } });
  }

  /*
   * L'empreinte est revérifiée avant traitement : si le stockage a été modifié
   * entre le dépôt et le traitement, traiter produirait des métadonnées qui ne
   * correspondent à rien de ce qui a été reçu.
   */
  const { createHash } = await import('node:crypto');
  const empreinte = createHash('sha256').update(tampon).digest('hex');
  if (ligne.checksum && empreinte !== ligne.checksum) {
    await marquerErreur(
      id,
      'Empreinte différente de celle enregistrée au dépôt : le fichier stocké a changé.',
    );
    return prisma.geospatialImport.findUnique({ where: { id } });
  }

  const analyse = analyserFichier(tampon, ligne.format);

  if (analyse.erreur && !analyse.extrait) {
    await marquerErreur(id, analyse.erreur);
    return prisma.geospatialImport.findUnique({ where: { id } });
  }

  await prisma.geospatialImport.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      /*
       * Une archive ZIP est `COMPLETED` avec un avertissement : le fichier est
       * conservé et identifié, mais son contenu n'est pas ouvert. Le message
       * dit pourquoi plutôt que de laisser croire à un traitement complet.
       */
      errorMessage: analyse.erreur ?? null,
      result: {
        traiteLe: new Date().toISOString(),
        pilote: depot.pilote,
        ...analyse.extrait,
        ...(analyse.erreur ? { avertissement: analyse.erreur } : {}),
      },
    },
  });

  return prisma.geospatialImport.findUnique({ where: { id } });
};

const marquerErreur = async (id, message) => {
  logger.warn(`[geospatial] traitement en échec pour ${id} : ${message}`);
  await prisma.geospatialImport.update({
    where: { id },
    data: {
      status: 'ERROR',
      completedAt: new Date(),
      errorMessage: message.slice(0, 500),
      result: null,
    },
  });
};

/**
 * Traite les dépôts en attente d'une organisation.
 *
 * Séquentiel, pas parallèle : chaque traitement lit un fichier entier en
 * mémoire. En traiter dix à la fois multiplierait la consommation par dix pour
 * un gain nul — le goulot est la lecture, pas l'attente.
 */
export const traiterEnAttente = async (organizationId, { limite = 20 } = {}) => {
  const enAttente = await prisma.geospatialImport.findMany({
    where: { organizationId, status: { in: ['RECEIVED', 'ERROR'] } },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Number(limite) || 20, 100),
    select: { id: true },
  });

  const resultat = { traites: 0, echecs: 0, ids: [] };
  const req = { tenant: { organizationId } };

  for (const { id } of enAttente) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ligne = await traiter(id, req, { force: true });
      if (ligne.status === 'COMPLETED') resultat.traites += 1;
      else resultat.echecs += 1;
      resultat.ids.push({ id, status: ligne.status });
    } catch (erreur) {
      resultat.echecs += 1;
      resultat.ids.push({ id, status: 'ERROR', erreur: erreur.message });
    }
  }

  return resultat;
};

/** État du traitement, pour le diagnostic et les tests. */
export const etatTraitement = async (organizationId) => {
  const parStatut = await prisma.geospatialImport.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { _all: true },
  });
  const compte = Object.fromEntries(parStatut.map((ligne) => [ligne.status, ligne._count._all]));
  return {
    total: Object.values(compte).reduce((a, b) => a + b, 0),
    parStatut: compte,
    enAttente: (compte.RECEIVED ?? 0) + (compte.ERROR ?? 0),
  };
};
