import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './apiclients.service.js';

const clientSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  organizationId: z.string().min(10).max(60).optional(),
  name: z.string().trim().min(2).max(160),
  contactEmail: z.string().trim().email().max(160).optional(),
  scopes: z.array(z.enum(['data:read', 'aggregates:read', 'prices:read'])).min(1),
  dataPurpose: z.string().trim().min(20, 'Finalité détaillée requise (min. 20 caractères)').max(1000),
});

const issueKeySchema = z.object({
  label: z.string().trim().min(2).max(120),
  expiresAt: z.coerce.date().optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/clients', authorize('apiclients.read'), asyncHandler(async (req, res) =>
  success(res, await service.listClients(req.query))));

router.post('/clients', authorize('apiclients.manage'), validate(clientSchema), asyncHandler(async (req, res) =>
  created(res, await service.createClient(req.body, req), {
    message: 'Client API créé — finalité à approuver avant émission de clé',
  })));

// API-03 — approbation de la finalité (condition d'usage)
router.patch('/clients/:id/purpose', authorize('apiclients.manage'), validate(idParam, 'params'),
  validate(z.object({ decision: z.enum(['APPROVED', 'REJECTED']), comment: z.string().trim().max(1000).optional() })),
  asyncHandler(async (req, res) => success(res, await service.approvePurpose(req.params.id, req.body, req))));

// API-02 — clé affichée une seule fois
router.post('/clients/:id/keys', authorize('apiclients.manage'), validate(idParam, 'params'),
  validate(issueKeySchema), asyncHandler(async (req, res) =>
    created(res, await service.issueKey(req.params.id, req.body, req), { message: 'Clé émise — conservez-la maintenant' })));

router.delete('/keys/:id', authorize('apiclients.manage'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().max(500).optional() })), asyncHandler(async (req, res) =>
    success(res, await service.revokeKey(req.params.id, req.body, req), { message: 'Clé révoquée' })));

// API-04 — quotas et journal d'usage
router.get('/clients/:id/usage', authorize('apiclients.read'), validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.usage(req.params.id, req.query, req))));

export default router;
