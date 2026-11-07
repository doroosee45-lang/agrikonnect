import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './soil.controller.js';
import * as schema from './soil.schema.js';
import * as intel from './intelligence.schema.js';
import * as intelligence from './intelligence.service.js';

/**
 * Module Soil & Crop Intelligence — piste S1.
 * Monté sous /plots : les routes sont donc /plots/:id/soil-assessments, etc.
 */
const router = Router();

router.use(authenticate, resolveTenant);

router.get(
  '/:id/soil-assessments',
  authorize('soil.read'),
  validate(schema.plotParam, 'params'),
  asyncHandler(controller.list),
);

router.get(
  '/:id/soil-profile',
  authorize('soil.read'),
  validate(schema.plotParam, 'params'),
  asyncHandler(controller.latestProfile),
);

router.post(
  '/:id/soil-assessments',
  authorize('soil.write'),
  validate(schema.plotParam, 'params'),
  validate(schema.createAssessmentSchema),
  asyncHandler(controller.create),
);

router.patch(
  '/:id/soil-assessments/:assessmentId',
  authorize('soil.write'),
  validate(schema.assessmentParam, 'params'),
  validate(schema.updateAssessmentSchema),
  asyncHandler(controller.update),
);

router.delete(
  '/:id/soil-assessments/:assessmentId',
  authorize('soil.write'),
  validate(schema.assessmentParam, 'params'),
  asyncHandler(controller.archive),
);

/* ───────────── S2 / S3 — intelligence agronomique (V2 §6, V3 §6) ───────────── */

router.get(
  '/:id/suitability',
  authorize('soil.read'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  asyncHandler(async (req, res) => success(res, await intelligence.listSuitabilities(req.params.id, req))),
);

router.post(
  '/:id/suitability',
  authorize('soil.recommend'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  validate(intel.suitabilitySchema),
  asyncHandler(async (req, res) =>
    created(res, await intelligence.computeSuitability(req.params.id, req.body, req), {
      message: 'Compatibilité culture/parcelle évaluée (règles validées et sourcées)',
    }),
  ),
);

router.get(
  '/:id/suitability/:suitabilityId',
  authorize('soil.read'),
  validate(intel.suitabilityParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await intelligence.explainSuitability(req.params.id, req.params.suitabilityId, req)),
  ),
);

router.get(
  '/:id/rotation-plans',
  authorize('soil.read'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  asyncHandler(async (req, res) => success(res, await intelligence.listRotations(req.params.id, req))),
);

router.post(
  '/:id/rotation-plans',
  authorize('soil.recommend'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  validate(intel.rotationSchemaBody),
  asyncHandler(async (req, res) =>
    created(res, await intelligence.proposeRotation(req.params.id, req.body, req), {
      message: 'Rotation proposée à partir du jeu de règles validé',
    }),
  ),
);

router.patch(
  '/:id/rotation-plans/:planId',
  authorize('soil.recommend'),
  validate(intel.rotationParam, 'params'),
  validate(intel.rotationDecisionSchema),
  asyncHandler(async (req, res) =>
    success(res, await intelligence.decideRotation(req.params.id, req.params.planId, req.body, req), {
      message: 'Décision enregistrée sur la rotation',
    }),
  ),
);

router.get(
  '/:id/farming-plans',
  authorize('soil.read'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  asyncHandler(async (req, res) => success(res, await intelligence.listFarmingPlans(req.params.id, req))),
);

router.post(
  '/:id/farming-plans',
  authorize('soil.recommend'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  validate(intel.farmingPlanSchema),
  asyncHandler(async (req, res) =>
    created(res, await intelligence.proposeFarmingPlan(req.params.id, req.body, req), {
      message: 'Plan agricole construit à partir du calendrier du jeu de règles',
    }),
  ),
);

router.get(
  '/:id/yield-estimates',
  authorize('soil.read'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  asyncHandler(async (req, res) => success(res, await intelligence.listYieldEstimates(req.params.id, req))),
);

router.post(
  '/:id/yield-estimates',
  authorize('soil.recommend'),
  validate(intel.suitabilityParam.pick({ id: true }), 'params'),
  validate(intel.yieldSchema),
  asyncHandler(async (req, res) =>
    created(res, await intelligence.estimateYield(req.params.id, req.body, req), {
      message: 'Estimation de rendement produite en fourchette',
    }),
  ),
);

export default router;
