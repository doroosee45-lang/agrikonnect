import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import * as schema from './users.schema.js';

/**
 * PROF-01 → PROF-04 — profil de l'utilisateur connecté.
 *
 * Ce routeur est monté sous `/me` : les chemins déclarés ici ne doivent donc
 * PAS répéter le préfixe (sinon `GET /me` répond 404 — défaut détecté par la
 * recette de bout en bout sur base réelle).
 */
const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', asyncHandler(controller.getMe));
router.patch('/', validate(schema.updateMeSchema), asyncHandler(controller.updateMe));
router.get('/permissions', asyncHandler(controller.getMyPermissions));
router.post('/password', validate(schema.changePasswordSchema), asyncHandler(controller.changePassword));
router.delete('/', asyncHandler(controller.deleteMe));

export default router;
