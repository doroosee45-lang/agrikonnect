import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './precision.service.js';
import { sendPdf } from '../../shared/pdf.js';

const plotParam = z.object({ plotId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

const computeSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  methodVersion: z.string().trim().max(40).optional(),
});

const reportSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  pdfKey: z.string().max(500).optional(),
  ruleSetVersion: z.string().trim().max(40).optional(),
  methodVersion: z.string().trim().max(40).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/plots/:plotId/management-zones', authorize('precision.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listZones(req.params.plotId, req))));

router.post('/plots/:plotId/management-zones', authorize('precision.write'), validate(plotParam, 'params'),
  validate(computeSchema), asyncHandler(async (req, res) =>
    created(res, await service.computeZones(req.params.plotId, req.body, req), { message: 'Zones calculées avec version de méthode' })));

router.get('/plots/:plotId/precision-reports', authorize('precision.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listReports(req.params.plotId, req))));

router.post('/plots/:plotId/precision-reports', authorize('precision.write'), validate(plotParam, 'params'),
  validate(reportSchema), asyncHandler(async (req, res) =>
    created(res, await service.createReport(req.params.plotId, req.body, req), { message: 'Rapport généré — validation agronomique requise' })));

// PRE-03 — validation humaine obligatoire
router.patch('/precision-reports/:id/validate', authorize('precision.read'), validate(idParam, 'params'),
  validate(z.object({ ruleSetVersion: z.string().trim().max(40).optional() })), asyncHandler(async (req, res) =>
    success(res, await service.validateReport(req.params.id, req.body, req), { message: 'Rapport validé' })));

router.get(
  '/precision-reports/:id/pdf',
  authorize('precision.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await service.reportPdf(req.params.id, req);
    return sendPdf(res, buffer, filename);
  }),
);

export default router;
