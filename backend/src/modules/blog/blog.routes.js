import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { created, paginated, success } from '../../shared/http/response.js';
import * as service from './blog.service.js';

const slugValue = z.string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Le slug doit être en minuscules et séparé par des tirets');

const httpsImageUrl = z.string().trim().url().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'L’image doit avoir une URL HTTPS valide');

const publicListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(6),
  includeContent: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

const slugParam = z.object({ slug: slugValue });
const idParam = z.object({ id: z.string().uuid() });

const createPostSchema = z.object({
  slug: slugValue,
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(500),
  imageUrl: httpsImageUrl,
  authorName: z.string().trim().min(2).max(160),
  content: z.string().trim().min(30).max(100000),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

const updatePostSchema = createPostSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  'Au moins un champ doit être fourni',
);

/** Routes publiques : aucun middleware d’authentification. */
export const publicBlogRoutes = Router();

publicBlogRoutes.get(
  '/',
  validate(publicListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listPublished(req.query);
    return paginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  }),
);

publicBlogRoutes.get(
  '/:slug',
  validate(slugParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getPublishedBySlug(req.params.slug))),
);

/** Routes d’édition : authentification puis permission dédiée côté serveur. */
export const adminBlogRoutes = Router();
adminBlogRoutes.use(authenticate, resolveTenant);

adminBlogRoutes.get(
  '/',
  authorize('admin.content'),
  validate(adminListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listAdmin(req.query);
    return paginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  }),
);

adminBlogRoutes.post(
  '/',
  authorize('admin.content'),
  validate(createPostSchema),
  asyncHandler(async (req, res) => created(
    res,
    await service.createPost(req.body, req),
    { message: 'Article enregistré' },
  )),
);

adminBlogRoutes.patch(
  '/:id',
  authorize('admin.content'),
  validate(idParam, 'params'),
  validate(updatePostSchema),
  asyncHandler(async (req, res) => success(
    res,
    await service.updatePost(req.params.id, req.body, req),
    { message: 'Article mis à jour' },
  )),
);

adminBlogRoutes.delete(
  '/:id',
  authorize('admin.content'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(
    res,
    await service.deletePost(req.params.id, req),
    { message: 'Article supprimé' },
  )),
);
