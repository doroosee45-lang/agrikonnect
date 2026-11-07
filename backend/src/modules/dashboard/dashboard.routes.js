import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import * as controller from './dashboard.controller.js';

const router = Router();

router.get('/', authenticate, resolveTenant, asyncHandler(controller.producer));

export default router;
