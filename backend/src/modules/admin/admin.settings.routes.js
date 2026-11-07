import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize, requireSuperAdmin } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as schema from './admin.settings.schema.js';
import * as controller from './admin.settings.controller.js';

/**
 * SPEC-SUPER-ADMIN M3 — routes des paramètres globaux et des feature flags.
 *
 * Montage (dans `admin.routes.js`) :
 *   router.use('/settings', settingsRouter);  → GET/PUT /admin/settings,
 *                                               GET /admin/settings/history,
 *                                               POST /admin/settings/:key/reset
 *   router.use('/flags', flagsRouter);        → GET/PUT /admin/flags
 *
 * Permissions (RG-M3-2) :
 *   - lecture/écriture des paramètres : `admin.settings` (palier 1) ;
 *   - `security.*` / `integrations.*` : palier 2, contrôlé par clé dans le
 *     service ;
 *   - reset de **n'importe quelle** clé : palier 2 (`requireSuperAdmin`) ;
 *   - feature flags : palier 2 (`requireSuperAdmin`, qui cumule rôle
 *     SUPER_ADMIN **et** session MFA — RG-G1).
 *
 * Convention de déclaration : chaque routeur est déclaré **immédiatement
 * avant ses routes** (le contrat OpenAPI découpe le corps d'un routeur de sa
 * déclaration à la suivante).
 */

export const settingsRouter = Router();

settingsRouter.use(authenticate, resolveTenant);

settingsRouter.get(
  '/',
  authorize('admin.settings'),
  asyncHandler(controller.getSettings),
);

settingsRouter.put(
  '/',
  authorize('admin.settings'),
  validate(schema.settingsUpdateSchema),
  asyncHandler(controller.updateSettings),
);

settingsRouter.get(
  '/history',
  authorize('admin.settings'),
  validate(schema.settingsHistoryQuerySchema, 'query'),
  asyncHandler(controller.settingsHistory),
);

settingsRouter.post(
  '/:key/reset',
  requireSuperAdmin,
  validate(schema.settingKeyParam, 'params'),
  asyncHandler(controller.resetSetting),
);

export const flagsRouter = Router();

flagsRouter.use(authenticate, resolveTenant);

flagsRouter.get(
  '/',
  requireSuperAdmin,
  validate(schema.flagsQuerySchema, 'query'),
  asyncHandler(controller.getFlags),
);

flagsRouter.put(
  '/',
  requireSuperAdmin,
  validate(schema.flagsUpdateSchema),
  asyncHandler(controller.updateFlags),
);
