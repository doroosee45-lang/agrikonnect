/**
 * Exigences CDC couvertes : CROP-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './crops.controller.js';
import * as schema from './crops.schema.js';

const router = Router();

// Lecture publique (PUB, carte, formulaires)
router.get('/', authorize('crops.read'), validate(schema.listCropsSchema, 'query'), asyncHandler(controller.list));
router.get(
  '/:id',
  authorize('crops.read'),
  validate(schema.cropIdParam, 'params'),
  // CROP-03 — la langue du libellé est un paramètre, jamais une supposition.
  validate(schema.localeQuery, 'query'),
  asyncHandler(controller.getOne),
);

// Administration du référentiel (CROP-01)
router.post(
  '/',
  authenticate,
  resolveTenant,
  authorize('crops.write'),
  validate(schema.createCropSchema),
  asyncHandler(controller.create),
);

router.patch(
  '/:id',
  authenticate,
  resolveTenant,
  authorize('crops.write'),
  validate(schema.cropIdParam, 'params'),
  validate(schema.updateCropSchema),
  asyncHandler(controller.update),
);

export default router;
