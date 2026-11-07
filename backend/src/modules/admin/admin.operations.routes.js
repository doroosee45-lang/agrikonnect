import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, paginated } from '../../shared/http/response.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './admin.operations.service.js';
import { entityParam, entityIdParam, listQuerySchema, moderateSchema } from './admin.operations.schema.js';

/**
 * SPEC-SUPER-ADMIN M4 (§6.2) — modération unifiée, montée par
 * `admin.routes.js` sous `/admin/operations`.
 *
 * Les **listes** sont des lectures admin (RG-M4-1 n'encadre que les
 * écritures) ; la **décision** (`/:entity/:id/moderate`) délègue aux services
 * métier existants : aucun statut n'est écrit directement ici.
 */
export const operationsRouter = Router();

/** U-M4-2 — file de modération par entité (listing|review|verification). */
operationsRouter.get(
  '/:entity',
  authorize('admin.users'),
  validate(entityParam, 'params'),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { items, total, page, limit } = await service.file(req.params.entity, req.query);
    return paginated(res, items, { page, limit, total });
  }),
);

/** U-M4-2 — fiche détail. */
operationsRouter.get(
  '/:entity/:id',
  authorize('admin.users'),
  validate(entityIdParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.detail(req.params.entity, req.params.id))),
);

/**
 * U-M4-2 / RG-M4-1 / RG-M5-2 — décision motivée (approuver / refuser /
 * suspendre) : délégation métier + notification de l'acteur concerné.
 */
operationsRouter.post(
  '/:entity/:id/moderate',
  authorize('admin.users'),
  validate(entityIdParam, 'params'),
  validate(moderateSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.moderate(req.params.entity, req.params.id, req.body, req), {
      message: 'Décision de modération enregistrée',
    })),
);
