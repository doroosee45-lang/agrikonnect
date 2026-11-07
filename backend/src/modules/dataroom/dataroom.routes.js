import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './dataroom.service.js';

const projectParam = z.object({ projectId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

const requestSchema = z.object({
  scope: z
    .object({
      categories: z.array(z.string().max(80)).max(20).optional(),
      download: z.boolean().default(false),
    })
    .default({ download: false }),
  justification: z.string().trim().min(10, 'Justification requise').max(1000),
  requestedDays: z.coerce.number().int().min(1).max(90).default(30),
});

const decideSchema = z.object({
  decision: z.enum(['GRANTED', 'REJECTED']),
  expiresAt: z.coerce.date().optional(),
  conditions: z.string().trim().max(1000).optional(),
  downloadAllowed: z.boolean().default(false),
});

const documentSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(80),
  storageKey: z.string().min(3).max(500),
  sha256: z.string().length(64).optional(),
  confidentiality: z.enum(['PRIVATE', 'RESTRICTED', 'PUBLIC']).optional(),
  downloadAllowed: z.boolean().default(false),
});

const router = Router();
router.use(authenticate, resolveTenant);

// DR-01/DR-02 — data room fermée par défaut
router.get('/projects/:projectId/documents', authorize('dataroom.read'), validate(projectParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listDocuments(req.params.projectId, req))));

router.post('/projects/:projectId/documents', authorize('dataroom.write'), validate(projectParam, 'params'),
  validate(documentSchema), asyncHandler(async (req, res) =>
    created(res, await service.addDocument(req.params.projectId, req.body, req), { message: 'Document ajouté (téléchargement désactivé par défaut)' })));

router.post('/projects/:projectId/access-requests', authorize('dataroom.request'), validate(projectParam, 'params'),
  validate(requestSchema), asyncHandler(async (req, res) =>
    created(res, await service.requestAccess(req.params.projectId, req.body, req), { message: 'Demande d\'accès transmise' })));

router.patch('/access-requests/:id', authorize('dataroom.decide'), validate(idParam, 'params'),
  validate(decideSchema), asyncHandler(async (req, res) =>
    success(res, await service.decideAccess(req.params.id, req.body, req), { message: 'Décision enregistrée' })));

router.get('/documents/:id', authorize('dataroom.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.openDocument(req.params.id, req))));

// DR-05 — journal append-only
router.get('/projects/:projectId/access-log', authorize('dataroom.write'), validate(projectParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.accessLog(req.params.projectId, req.query, req))));

export default router;
