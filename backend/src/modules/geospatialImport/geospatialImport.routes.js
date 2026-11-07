import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './geospatialImport.controller.js';
import * as schema from './geospatialImport.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

/*
 * Permissions : on réutilise le couple existant `geospatial.read` /
 * `geospatial.write` plutôt que d'introduire une nouvelle permission. Déposer
 * un fichier géospatial **est** une écriture géospatiale ; créer une permission
 * distincte fragmenterait un droit qui n'a qu'un seul sens métier.
 */

router.post(
  '/',
  authorize('geospatial.write'),
  validate(schema.receiveSchema),
  asyncHandler(controller.receive),
);

/*
 * Téléversement multipart — le chemin des fichiers volumineux (jusqu'à
 * `GEOSPATIAL_MULTIPART_MAX_BYTES`, 64 Mo par défaut).
 *
 * Aucun `validate(...)` : le corps n'est pas du JSON, il est lu par le
 * contrôleur directement depuis le flux, avec son plafond appliqué pendant la
 * lecture. Les champs texte sont vérifiés dans le service.
 */
router.post(
  '/upload',
  authorize('geospatial.write'),
  asyncHandler(controller.receiveMultipart),
);

/*
 * Routes fixes déclarées **avant** `/:id` : sinon `/imports/processing` serait
 * avalé par le paramètre et renverrait un 404 sur identifiant invalide.
 */
router.post(
  '/process-pending',
  authorize('geospatial.write'),
  asyncHandler(controller.processPending),
);

router.get(
  '/processing',
  authorize('geospatial.read'),
  asyncHandler(controller.processingState),
);

/**
 * Traitement d'un dépôt : `RECEIVED` → `PROCESSING` → `COMPLETED` ou `ERROR`.
 *
 * `?force=true` retraite un dépôt déjà traité. Sans cela, un second appel
 * relirait le fichier pour rien et écraserait le résultat sans le dire.
 */
router.post(
  '/:id/process',
  authorize('geospatial.write'),
  validate(schema.idParamsSchema, 'params'),
  asyncHandler(controller.process),
);

/**
 * Route fixe déclarée **avant** `/:id` : sinon `/imports/count` serait avalé par
 * le paramètre et renverrait un 404 sur identifiant invalide.
 */
router.get(
  '/',
  authorize('geospatial.read'),
  validate(schema.listSchema, 'query'),
  asyncHandler(controller.list),
);

router.get(
  '/:id',
  authorize('geospatial.read'),
  validate(schema.idParamsSchema, 'params'),
  asyncHandler(controller.get),
);

export default router;
