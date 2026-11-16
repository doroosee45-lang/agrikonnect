/**
 * Appels audio — routes REST (`/api/v1/calls`).
 *
 * Chaîne commune : `authenticate` (Supabase) → `resolveTenant` (organisation
 * active vérifiée) → permission. Les écritures passent en plus par
 * `requireVerifiedForWrites` (compte vérifié, monté dans routes/index.js) et
 * par `settingsEffects` (réglage `modules.appels`). Le client n'envoie JAMAIS
 * de nom de salle, de rôle ni d'identifiant de participant autorisé : seulement
 * la conversation et les personnes qu'il souhaite inviter, vérifiées ici.
 */
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import * as service from './calls.service.js';

const idParam = z.object({ id: z.string().min(10).max(60) });
const eligibleQuery = z.object({ conversationId: z.string().min(10).max(60) });

export const createCallSchema = z
  .object({
    conversationId: z.string().min(10).max(60),
    inviteeUserIds: z.array(z.string().uuid('Identifiant d’utilisateur invalide')).min(1).max(49),
  })
  .strict();

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/config', authorize('calls.join'), asyncHandler(async (_req, res) =>
  success(res, await service.configuration())));

router.get('/', authorize('calls.join'), asyncHandler(async (req, res) =>
  success(res, await service.lister(req))));

router.get('/eligible', authorize('calls.start'), validate(eligibleQuery, 'query'), asyncHandler(async (req, res) =>
  success(res, await service.invitables(req.query.conversationId, req))));

router.post('/', writeLimiter, authorize('calls.start'), validate(createCallSchema), asyncHandler(async (req, res) =>
  created(res, await service.creerAppel(req.body, req), { message: 'Appel lancé' })));

router.get('/:id', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.obtenir(req.params.id, req))));

router.post('/:id/accept', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.accepter(req.params.id, req), { message: 'Appel accepté' })));

router.post('/:id/decline', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.refuser(req.params.id, req), { message: 'Appel refusé' })));

router.post('/:id/cancel', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.annuler(req.params.id, req), { message: 'Appel annulé' })));

router.post('/:id/leave', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.quitter(req.params.id, req), { message: 'Appel quitté' })));

router.post('/:id/end', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.terminer(req.params.id, req), { message: 'Appel terminé' })));

router.post('/:id/token', authorize('calls.join'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.jeton(req.params.id, req), { message: 'Jeton d’appel délivré' })));

export default router;
