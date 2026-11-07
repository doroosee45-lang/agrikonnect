import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './exports.service.js';

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const createSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  buyerOrgId: z.string().min(10).max(60).optional(),
  tenderId: z.string().min(10).max(60).optional(),
  logisticsPartnerOrgId: z.string().min(10).max(60).optional(),
  incoterm: z.enum(INCOTERMS),
  destinationCountry: z.string().trim().length(2).toUpperCase(),
  totalAmount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  fxRate: z.object({
    value: z.coerce.number().positive(),
    date: z.coerce.date(),
    source: z.string().trim().min(2).max(80),
  }).optional(),
  steps: z.array(z.record(z.any())).max(30).optional(),
});

const documentSchema = z.object({
  type: z.enum(['INVOICE', 'CERTIFICATE_OF_ORIGIN', 'PHYTOSANITARY', 'BILL_OF_LADING', 'OTHER']),
  name: z.string().trim().min(2).max(200),
  storageKey: z.string().max(500).optional(),
});

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_CONTROL', 'CERTIFIED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'CANCELLED']).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('export.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('export.write'), validate(createSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Dossier d\'export créé' })));

router.get('/:id', authorize('export.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.post('/:id/documents', authorize('export.write'), validate(idParam, 'params'),
  validate(documentSchema), asyncHandler(async (req, res) =>
    created(res, await service.addDocument(req.params.id, req.body, req), { message: 'Document ajouté au dossier' })));

router.patch('/:id/status', authorize('export.write'), validate(idParam, 'params'),
  validate(z.object({
    status: z.enum(['CONFIRMED', 'IN_CONTROL', 'CERTIFIED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'CANCELLED']),
    note: z.string().trim().max(1000).optional(),
  })), asyncHandler(async (req, res) =>
    success(res, await service.transition(req.params.id, req.body, req), { message: 'Statut du dossier mis à jour' })));

export default router;
