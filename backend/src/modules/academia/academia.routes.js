/**
 * AGRIKONNECT ACADEMIA — lot L1 (CDC-ACADEMIA-01).
 *
 * Monté sous `/academia` ; l'ensemble est coupé par `modules.academia`
 * (settingsEffects, désactivé par défaut). Pas de `resolveTenant` : les
 * droits sur un établissement sont vérifiés dans le service, DANS le contexte
 * de cet établissement (academia.policy.js).
 */
import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { authorize, requireMfa } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './academia.controller.js';
import * as schema from './academia.schema.js';

const router = Router();

// ─── Annuaire public des établissements (§3.6 : sans affiliation) ───
router.get('/institutions', optionalAuth, validate(schema.listInstitutionsSchema, 'query'),
  asyncHandler(controller.listInstitutions));
router.get('/institutions/:id', optionalAuth, validate(schema.idParam, 'params'),
  asyncHandler(controller.getInstitution));

// ─── Tout le reste exige une session ───
router.use(authenticate);

// Profil et affiliations de l'utilisateur courant
router.get('/me', authorize('academia.read'), asyncHandler(controller.getMine));
router.put('/me/profile', authorize('academia.write'), validate(schema.updateProfileSchema),
  asyncHandler(controller.upsertMyProfile));

router.post('/affiliations', authorize('affiliations.request'), validate(schema.requestAffiliationSchema),
  asyncHandler(controller.requestAffiliation));
router.post('/affiliations/:id/withdraw', authorize('affiliations.request'), validate(schema.idParam, 'params'),
  asyncHandler(controller.withdrawAffiliation));
router.post('/affiliations/:id/decision', authorize('affiliations.review'), validate(schema.idParam, 'params'),
  validate(schema.decisionSchema), asyncHandler(controller.decideAffiliation));

// Administration d'un établissement (UNIVERSITY_ADMIN de CET établissement, ou gouvernance)
router.post('/institutions', authorize('institutions.create'), requireMfa, validate(schema.createInstitutionSchema),
  asyncHandler(controller.createInstitution));
router.patch('/institutions/:id', authorize('institutions.write'), validate(schema.idParam, 'params'),
  validate(schema.updateInstitutionSchema), asyncHandler(controller.updateInstitution));
router.get('/institutions/:id/affiliations', authorize('affiliations.review'), validate(schema.idParam, 'params'),
  validate(schema.listAffiliationsSchema, 'query'), asyncHandler(controller.listInstitutionAffiliations));

router.post('/institutions/:id/units', authorize('institutions.write'), validate(schema.idParam, 'params'),
  validate(schema.createUnitSchema), asyncHandler(controller.createUnit));
router.patch('/institutions/:id/units/:unitId', authorize('institutions.write'),
  validate(schema.unitParam, 'params'), validate(schema.updateUnitSchema), asyncHandler(controller.updateUnit));
router.delete('/institutions/:id/units/:unitId', authorize('institutions.write'),
  validate(schema.unitParam, 'params'), asyncHandler(controller.deleteUnit));

// Responsables d'établissement : gouvernance ACADEMIA uniquement, second facteur
// exigé (preuve MFA de la session) comme pour toute mutation de gouvernance.
router.post('/institutions/:id/admins', authorize('academia.admin'), requireMfa, validate(schema.idParam, 'params'),
  validate(schema.designateAdminSchema), asyncHandler(controller.designateAdmin));
router.delete('/institutions/:id/admins/:userId', authorize('academia.admin'), requireMfa, validate(schema.adminParam, 'params'),
  asyncHandler(controller.revokeAdmin));

export default router;
