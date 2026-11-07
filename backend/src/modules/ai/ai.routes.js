import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import { idempotency } from '../../middleware/idempotency.js';
import * as service from './ai.service.js';

const analyzeSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  type: z.enum(['CHAT', 'PLANT_PHOTO', 'DOCUMENT']),
  plotId: z.string().min(10).max(60).optional(),
  prompt: z.string().trim().max(4000).optional(),
  mediaKey: z.string().max(500).optional(),
  consentGiven: z.boolean().default(false),
});

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  type: z.enum(['CHAT', 'PLANT_PHOTO', 'DOCUMENT']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'ESCALATED']).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const copilotSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().min(10).max(60).optional(),
});

const documentSchema = z.object({
  kind: z.enum(['FICHE_TECHNIQUE', 'SYNTHESE_EXPLOITATION', 'PLAN_CAMPAGNE']),
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().min(10).max(60).optional(),
  language: z.enum(['fr', 'en', 'pt', 'sw', 'ar']).default('fr'),
});

const router = Router();
router.use(authenticate, resolveTenant);

router.post('/analyses', authorize('ai.write'), idempotency('ai.analyze'), validate(analyzeSchema), asyncHandler(async (req, res) =>
  created(res, await service.analyze(req.body, req), { message: 'Analyse produite (aide à la décision, non prescriptive)' })));

// AI-10 — copilote ancré sur les données de l'organisation
router.post('/copilot', authorize('ai.write'), validate(copilotSchema), asyncHandler(async (req, res) =>
  success(res, await service.copilot(req.body, req), {
    message: 'Réponse du copilote (sourcée, non prescriptive)',
  })));

// AI-03 — génération de documents (brouillon à relire)
router.post('/documents', authorize('ai.write'), idempotency('ai.document'), validate(documentSchema), asyncHandler(async (req, res) =>
  created(res, await service.generateDocument(req.body, req), {
    message: 'Brouillon de document généré — relecture obligatoire',
  })));

router.get('/analyses', authorize('ai.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit, disclaimer } = await service.list(req.query, req);
  return success(res, { items, disclaimer }, {
    meta: { page: Number(page), limit: Number(limit), total: Number(total) },
  });
}));

router.get('/analyses/:id', authorize('ai.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

// AI-04 — escalade humaine
router.post('/analyses/:id/escalate', authorize('ai.write'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(5).max(1000) })), asyncHandler(async (req, res) =>
    success(res, await service.escalate(req.params.id, req.body, req), { message: 'Escalade vers un agronome enregistrée' })));

// AI-07 — revue experte (agronome, vérificateur) : annotation, jamais réécriture
router.post('/analyses/:id/review', authorize('ai.review'), validate(idParam, 'params'),
  validate(z.object({
    verdict: z.enum(['CONFIRMED', 'DISPUTED', 'INCONCLUSIVE']),
    comment: z.string().trim().max(2000).optional(),
  })), asyncHandler(async (req, res) =>
    success(res, await service.reviewAnalysis(req.params.id, req.body, req), { message: 'Revue experte enregistrée' })));

router.post('/analyses/:id/feedback', authorize('ai.write'), validate(idParam, 'params'),
  validate(z.object({ feedback: z.string().trim().min(2).max(2000) })), asyncHandler(async (req, res) =>
    success(res, await service.feedback(req.params.id, req.body, req), { message: 'Retour enregistré' })));

export default router;
