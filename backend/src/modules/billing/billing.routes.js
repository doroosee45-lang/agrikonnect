import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './billing.service.js';
import { sendPdf } from '../../shared/pdf.js';

const fxRateSchema = z.object({
  value: z.coerce.number().positive(),
  date: z.coerce.date(),
  source: z.string().trim().min(2).max(80),
});

const createInvoiceSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  type: z.enum(['QUOTE', 'PROFORMA', 'INVOICE', 'RECEIPT', 'DELIVERY_NOTE']),
  orderId: z.string().min(10).max(60).optional(),
  recipientOrgId: z.string().min(10).max(60).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  fxRate: fxRateSchema.optional(),
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        quantity: z.coerce.number().positive(),
        unit: z.string().trim().max(20).optional(),
        unitPrice: z.coerce.number().min(0),
      }),
    )
    .min(1, 'Au moins une ligne est requise'),
});

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  type: z.enum(['QUOTE', 'PROFORMA', 'INVOICE', 'RECEIPT', 'DELIVERY_NOTE']).optional(),
  orderId: z.string().max(60).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('invoices.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('invoices.write'), validate(createInvoiceSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Document émis' })));

router.get('/:id', authorize('invoices.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.post('/:id/settlement', authorize('invoices.write'), validate(idParam, 'params'),
  validate(z.object({ note: z.string().trim().max(500).optional() })), asyncHandler(async (req, res) =>
    success(res, await service.declareSettlement(req.params.id, req.body, req), { message: 'Règlement déclaré' })));

// BIL-01 — PDF de la facture (document commercial, sans encaissement)
router.get(
  '/:id/pdf',
  authorize('invoices.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await service.invoicePdf(req.params.id, req);
    return sendPdf(res, buffer, filename);
  }),
);

export default router;
