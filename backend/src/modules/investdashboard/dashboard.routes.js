import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import * as service from './dashboard.service.js';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('projects.read'), asyncHandler(async (req, res) =>
  success(res, await service.overview(req))));

export default router;
