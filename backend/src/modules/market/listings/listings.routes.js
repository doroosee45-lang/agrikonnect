import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created, noContent } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import * as service from './listings.service.js';
import * as schema from './listings.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

// MKT-03 — recherche (les annonces publiées sont visibles par tous les connectés)
router.get('/', authorize('listings.read'), validate(schema.searchListingsSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit, filtersApplied } = await service.search(req.query, req);
  return success(res, { items, filtersApplied }, {
    meta: { page: Number(page), limit: Number(limit), total: Number(total), totalPages: Math.ceil(total / limit) },
  });
}));

router.post('/', authorize('listings.write'), validate(schema.createListingSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Annonce créée en brouillon' })));

router.get('/:id', authorize('listings.read'), validate(schema.listingIdParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.patch('/:id', authorize('listings.write'), validate(schema.listingIdParam, 'params'),
  validate(schema.updateListingSchema), asyncHandler(async (req, res) =>
    success(res, await service.update(req.params.id, req.body, req), { message: 'Annonce mise à jour' })));

// MKT-04 — cycle de vie
router.patch('/:id/status', authorize('listings.write'), validate(schema.listingIdParam, 'params'),
  validate(schema.publishListingSchema), asyncHandler(async (req, res) => {
    const { listing, warnings } = await service.changeStatus(req.params.id, req.body.status, req);
    return success(res, { listing, warnings }, { message: 'Statut mis à jour' });
  }));

/**
 * MKT-06 — contacter le vendeur sans exposer ses coordonnées.
 * Ouvre un fil rattaché à l'annonce ; le premier message est optionnel.
 */
router.post('/:id/contact', authorize('messages.write'), validate(schema.listingIdParam, 'params'),
  validate(z.object({ message: z.string().trim().max(3000).optional() })), asyncHandler(async (req, res) => {
    const { conversation, replayed } = await service.contactSeller(req.params.id, req.body, req);
    return replayed
      ? success(res, conversation, { message: 'Fil de discussion existant réutilisé' })
      : created(res, conversation, { message: 'Fil de discussion ouvert avec le vendeur' });
  }));

/**
 * MKT-02 — rattacher des photos déjà téléversées à l'annonce.
 * Permission dédiée `listings.media` : elle couvre le commerce sans ouvrir
 * la modification du contenu de l'annonce.
 */
router.post('/:id/photos', authorize('listings.media'), validate(schema.listingIdParam, 'params'),
  validate(z.object({ mediaIds: z.array(z.string().min(5).max(60)).min(1).max(10) })),
  asyncHandler(async (req, res) =>
    success(res, await service.attachPhotos(req.params.id, req.body, req), { message: 'Photos rattachées à l\'annonce' })));

// MKT-05 — modération
router.patch('/:id/moderate', authorize('listings.moderate'), validate(schema.listingIdParam, 'params'),
  validate(schema.moderateListingSchema), asyncHandler(async (req, res) =>
    success(res, await service.moderate(req.params.id, req.body, req), { message: 'Décision de modération enregistrée' })));

router.delete('/:id', authorize('listings.write'), validate(schema.listingIdParam, 'params'), asyncHandler(async (req, res) => {
  await service.archive(req.params.id, req);
  return noContent(res);
}));

export default router;
