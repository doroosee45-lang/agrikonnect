import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './duediligence.service.js';

const projectParam = z.object({ projectId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

const updateSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'ISSUE', 'NOT_APPLICABLE']).optional(),
  comment: z.string().trim().max(2000).optional(),
  professionalName: z.string().trim().max(160).optional(),
  professionalCapacity: z.enum([
    'expert_comptable', 'commissaire_aux_comptes', 'notaire', 'avocat',
    'agronome', 'ingenieur_agronome', 'auditeur', 'certification_body',
  ]).optional(),
  scope: z.string().trim().max(500).optional(),
});

const router = Router();
// Monté sur '/' : chemins /projects/:projectId/due-diligence et /due-diligence/:id.
router.use(['/projects', '/due-diligence'], authenticate, resolveTenant);

router.get('/projects/:projectId/due-diligence', authorize('duediligence.read'), validate(projectParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.list(req.params.projectId, req))));

// Génération de la checklist type (légal, financier, agronomique, environnemental, social)
router.post('/projects/:projectId/due-diligence/checklist', authorize('duediligence.write'),
  validate(projectParam, 'params'), asyncHandler(async (req, res) =>
    created(res, await service.ensureChecklist(req.params.projectId, req), { message: 'Checklist de due diligence initialisée' })));

router.patch('/due-diligence/:id', authorize('duediligence.write'), validate(idParam, 'params'),
  validate(updateSchema), asyncHandler(async (req, res) =>
    success(res, await service.update(req.params.id, req.body, req), { message: 'Élément mis à jour' })));

router.post('/due-diligence/:id/evidence', authorize('duediligence.write'), validate(idParam, 'params'),
  validate(z.object({ evidence: z.array(z.string().max(500)).min(1).max(20) })), asyncHandler(async (req, res) =>
    success(res, await service.addEvidence(req.params.id, req.body, req), { message: 'Pièces ajoutées' })));

export default router;
