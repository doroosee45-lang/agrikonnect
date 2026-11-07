import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize, requireSuperAdmin } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin.controller.js';
import * as schema from './admin.schema.js';
import { settingsRouter, flagsRouter } from './admin.settings.routes.js';
import { jobsRouter, monitoringRouter } from './admin.monitoring.routes.js';
import { auditExportRouter, securityRouter } from './admin.security.routes.js';
import { operationsRouter } from './admin.operations.routes.js';
import { adminNotificationsRouter } from './admin.notifications.routes.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get(
  '/dashboard',
  authorize('admin.dashboard'),
  validate(schema.dashboardQuerySchema, 'query'),
  asyncHandler(controller.dashboard),
);

/** M1 — export de la vue (RG-M1-4 : `admin.users`, action auditée). */
router.get(
  '/dashboard/export',
  authorize('admin.users'),
  validate(schema.dashboardQuerySchema, 'query'),
  asyncHandler(controller.dashboardExport),
);

router.get(
  '/users',
  authorize('admin.users'),
  validate(schema.listUsersM2Schema, 'query'),
  asyncHandler(controller.listUsers),
);

/** M2 U-M2-2 — fiche complète (profil, rôles, sécurité, activité). */
router.get(
  '/users/:id',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  asyncHandler(controller.getUser),
);

router.patch(
  '/users/:id/status',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  validate(schema.updateUserStatusSchema),
  asyncHandler(controller.updateUserStatus),
);

/** M2 U-M2-4 — actions opérationnelles (palier 1, RG-M2-2 auditées). */
router.post(
  '/users/:id/unlock',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  validate(schema.reasonActionSchema),
  asyncHandler(controller.unlockUser),
);
router.post(
  '/users/:id/force-logout',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  validate(schema.reasonActionSchema),
  asyncHandler(controller.forceLogout),
);
router.post(
  '/users/:id/verify-email',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  validate(schema.verifyContactSchema),
  asyncHandler(controller.verifyEmail),
);
router.post(
  '/users/:id/verify-phone',
  authorize('admin.users'),
  validate(schema.userIdParam, 'params'),
  validate(schema.verifyContactSchema),
  asyncHandler(controller.verifyPhone),
);

/** M2 U-M2-6 — rôles + matrice de permissions effective. */
router.get('/roles', authorize('admin.users'), asyncHandler(controller.listRoles));

/**
 * M2 — palier 2 (SPEC-SUPER-ADMIN §2) : `requireSuperAdmin` cumule rôle
 * `SUPER_ADMIN` + session MFA (RG-G1) ; le `mfaCode` du corps est vérifié
 * par le service contre la MFA réelle, et la nomination d'un `SUPER_ADMIN`
 * exige de plus le mot de passe courant (RG-G3).
 */
router.post(
  '/users/:id/roles',
  requireSuperAdmin,
  validate(schema.userIdParam, 'params'),
  validate(schema.grantRoleSchema),
  asyncHandler(controller.grantRole),
);
router.delete(
  '/users/:id/roles/:role',
  requireSuperAdmin,
  validate(schema.userRoleParams, 'params'),
  asyncHandler(controller.revokeRole),
);
router.delete(
  '/users/:id',
  requireSuperAdmin,
  validate(schema.userIdParam, 'params'),
  validate(schema.reasonActionSchema),
  asyncHandler(controller.deleteUser),
);
router.get(
  '/users/:id/export',
  requireSuperAdmin,
  validate(schema.userIdParam, 'params'),
  asyncHandler(controller.exportUser),
);

router.get(
  '/audit',
  authorize('admin.audit'),
  validate(schema.listAuditSchema, 'query'),
  asyncHandler(controller.listAudit),
);

/**
 * M5 (U-M5-2/RG-M5-2) — console des tâches planifiées : état, exécution
 * manuelle (auditée `admin.job.run`), pause/reprise (palier 2). Montée ici
 * pour conserver les chemins exacts `/admin/jobs…`.
 */
router.use('/jobs', jobsRouter);

/** M5 (U-M5-1/U-M5-3) — services externes et santé technique, en direct. */
router.use('/monitoring', monitoringRouter);

router.use('/settings', settingsRouter);
router.use('/flags', flagsRouter);

/**
 * M6 (U-M6-1/U-M6-2/U-M6-3) — export du journal d'audit (audité) et vue
 * sécurité (connexions, verrous, MFA, clés API, sessions) + politique
 * `security.*` (palier 2).
 */
router.use('/audit', auditExportRouter);
router.use('/security', securityRouter);

/**
 * M4 (U-M4-2/RG-M4-1) — modération unifiée des flux métier (listings, avis,
 * vérifications) : listes lues en direct, décisions déléguées aux services
 * métier existants avec notification de l'acteur concerné (RG-M4-2).
 */
router.use('/operations', operationsRouter);

/** M7 (U-M7-1) — annonces internes ciblées (rôle/pays) et historique d'envois. */
router.use('/notifications', adminNotificationsRouter);

router.get('/export/farms', authorize('admin.users'), asyncHandler(controller.exportFarms));

export default router;
