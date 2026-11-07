import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './dataproducts.service.js';

const createSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  slug: z.string().trim().max(80).optional(),
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  minGroupSize: z.coerce.number().int().min(5, 'Le seuil de k-anonymat ne peut être inférieur à 5').max(1000).default(10),
  fields: z.record(z.any()),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('data.read'), asyncHandler(async (_req, res) =>
  success(res, await service.listProducts())));

router.post('/', authorize('dataproducts.manage'), validate(createSchema), asyncHandler(async (req, res) =>
  created(res, await service.createProduct(req.body, req), { message: 'Produit de données créé (brouillon)' })));

router.patch('/:id/status', authorize('dataproducts.manage'), validate(idParam, 'params'),
  validate(z.object({ status: z.enum(['PUBLISHED', 'RETIRED']) })), asyncHandler(async (req, res) =>
    success(res, await service.publishProduct(req.params.id, req.body, req), { message: 'Statut du produit mis à jour' })));

// DATA-02 — calcul d'agrégats sous contrainte de k-anonymat
router.post('/:id/aggregates', authorize('dataproducts.manage'), validate(idParam, 'params'),
  validate(z.object({
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Format attendu AAAA-MM').optional(),
    ruleVersion: z.string().trim().max(40).optional(),
  })), asyncHandler(async (req, res) =>
    success(res, await service.computeAggregate(req.params.id, req.body, req), {
      message: 'Agrégats calculés — groupes sous le seuil supprimés',
    })));

router.get('/:id/aggregates', authorize('data.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.listAggregates(req.params.id, req.query))));

// DATA-04 — contrat de données
router.post('/contracts', authorize('dataproducts.manage'), validate(z.object({
  clientId: z.string().min(10).max(60),
  productId: z.string().min(10).max(60),
  purposes: z.array(z.string().min(3).max(200)).min(1),
  restrictions: z.string().trim().max(1000).optional(),
  expiresAt: z.coerce.date().optional(),
})), asyncHandler(async (req, res) =>
  created(res, await service.createContract(req.body, req), { message: 'Contrat de données enregistré' })));

export default router;
