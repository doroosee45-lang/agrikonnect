/**
 * Exigences CDC couvertes : NFR-03.
 *
 * Toute écriture qui touche plusieurs tables (décision + répercussion, commande
 * + mouvements, facture + numérotation) doit être atomique : soit tout est
 * écrit, soit rien. Ce module est le point d'entrée unique pour ces écritures.
 */
import { prisma } from '../config/prisma.js';

/**
 * Exécute `fn` dans une transaction interactive Prisma.
 *
 * @template T
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withTransaction = (fn) => prisma.$transaction(fn);

/**
 * Exécute une liste d'opérations déjà construites dans une transaction
 * séquentielle (`$transaction([...])`), utile quand aucun état intermédiaire
 * n'est nécessaire.
 *
 * @param {Promise<unknown>[]} operations
 */
export const withBatch = (operations) => prisma.$transaction(operations);
