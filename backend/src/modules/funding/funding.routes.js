import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './funding.service.js';

const projectParam = z.object({ projectId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

const transmitSchema = z.object({
  consentId: z.string().min(10, 'Identifiant de consentement requis').max(200),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement explicite (consentGiven: true) est obligatoire' }),
  }),
  partnerName: z.string().trim().max(160).optional(),
  partnerOrgId: z.string().min(10).max(60).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/projects/:projectId/funding-requests', authorize('funding.read'), validate(projectParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.list(req.params.projectId, req))));

// FUND-01 — émission du consentement (aperçu du contenu qui sera transmis)
router.post('/projects/:projectId/funding-requests/consent', authorize('funding.write'),
  validate(projectParam, 'params'), asyncHandler(async (req, res) =>
    created(res, await service.requestConsent(req.params.projectId, req), {
      message: 'Consentement préparé — transmission possible après accord explicite',
    })));

// FUND-02 — transmission conditionnée par le consentement
router.post('/funding-requests/:id/transmit', authorize('funding.write'), validate(idParam, 'params'),
  validate(transmitSchema), asyncHandler(async (req, res) =>
    success(res, await service.transmit(req.params.id, req.body, req), { message: 'Dossier transmis avec consentement enregistré' })));

router.patch('/funding-requests/:id/follow-up', authorize('funding.write'), validate(idParam, 'params'),
  validate(z.object({ status: z.enum(['ACKNOWLEDGED', 'CLOSED']), note: z.string().trim().max(1000).optional() })),
  asyncHandler(async (req, res) => success(res, await service.acknowledge(req.params.id, req.body, req), { message: 'Suivi enregistré' })));

export default router;
