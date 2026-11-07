import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './intelligence.service.js';
import * as schema from './intelligence.schema.js';

/**
 * Gouvernance des règles agronomiques (SOIL-04) et activation par zone (S2 §6.4).
 * Monté sous /admin : /admin/rulesets, /admin/feature-flags.
 */
const router = Router();

router.use(authenticate, resolveTenant);

router.get(
  '/rulesets',
  authorize('rules.read'),
  validate(schema.ruleSetQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.listRuleSets(req.query))),
);

router.post(
  '/rulesets',
  authorize('rules.write'),
  validate(schema.createRuleSetSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.createRuleSet(req.body, req), {
      message: 'Jeu de règles créé en brouillon — il doit être validé par un agronome',
    }),
  ),
);

router.post(
  '/rulesets/:id/validate',
  authorize('rules.validate'),
  validate(schema.ruleSetParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.validateRuleSet(req.params.id, req), {
      message: 'Jeu de règles validé et opposable',
    }),
  ),
);

router.post(
  '/rulesets/:id/retire',
  authorize('rules.validate'),
  validate(schema.ruleSetParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.retireRuleSet(req.params.id, req), { message: 'Jeu de règles retiré' }),
  ),
);

router.get(
  '/feature-flags',
  authorize('rules.read'),
  validate(schema.flagQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.listFlags(req.query))),
);

router.put(
  '/feature-flags',
  authorize('flags.write'),
  validate(schema.flagSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.setFlag(req.body, req), { message: 'Activation enregistrée et auditée' }),
  ),
);

export default router;
