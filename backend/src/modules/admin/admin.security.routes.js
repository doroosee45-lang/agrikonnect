import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authorize, requireSuperAdmin } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin.security.controller.js';
import { auditExportSchema, policyUpdateSchema } from './admin.security.schema.js';

/**
 * SPEC-SUPER-ADMIN M6 (§6.2) — routes sécurité et audit, montées par
 * `admin.routes.js` sous `/admin/security` et `/admin/audit`.
 *
 * RG-S2 : aucune route de modification/suppression du journal n'existe —
 * `audit_logs` est en insertion seule ; `auditExportRouter` n'offre que
 * l'export, lui-même journalisé (`admin.audit.export`).
 */

/** M6 — export du journal d'audit (`/admin/audit/export`), audité. */
export const auditExportRouter = Router();

auditExportRouter.get(
  '/export',
  authorize('admin.audit'),
  validate(auditExportSchema, 'query'),
  asyncHandler(controller.auditExport),
);

/** M6 — vue sécurité et politique (`/admin/security…`). */
export const securityRouter = Router();

securityRouter.get('/overview', authorize('admin.audit'), asyncHandler(controller.overview));

/**
 * U-M6-3 — politique de sécurité : palier 2 (`requireSuperAdmin` = rôle
 * SUPER_ADMIN + second facteur, RG-S1/RG-G1).
 */
securityRouter.get('/policy', requireSuperAdmin, asyncHandler(controller.getPolicy));

securityRouter.put(
  '/policy',
  requireSuperAdmin,
  validate(policyUpdateSchema),
  asyncHandler(controller.updatePolicy),
);
