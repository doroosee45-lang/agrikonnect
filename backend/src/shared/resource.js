import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from './http/asyncHandler.js';
import { success, created, paginated, noContent } from './http/response.js';
import { ApiError } from './errors/ApiError.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { paginationArgs, orderBy as orderClause } from './pagination.js';
import { resolveId } from './ids.js';
import { audit } from './audit.js';

/**
 * Générateur de routes CRUD pour les ressources « simples » (V2→V5).
 *
 * Objectif : ne pas réécrire 5 fois le même contrôleur pour une ressource
 * qui ne contient aucune règle métier spécifique (certifications, prix,
 * rapports, zones…). Les modules à logique forte (commandes, stocks,
 * matching, data room, synchronisation) gardent un service dédié.
 *
 * Sécurité imposée par construction :
 *  - authentification + isolation tenant sur toutes les routes ;
 *  - permission `ressource.action` ;
 *  - filtre tenantField imposé côté serveur, jamais fourni par le client ;
 *  - suppression logique par défaut ;
 *  - écriture dans le journal d'audit.
 */
export const resourceRouter = ({
  model,
  permission,
  schemas,
  tenantField = 'organizationId',
  ownerField = null,
  idField = 'id',
  filterFields = [],
  searchField = null,
  orderFields = ['createdAt'],
  defaultOrder = 'desc',
  includes = undefined,
  softDelete = true,
  beforeCreate = null,
  beforeUpdate = null,
  afterCreate = null,
  extraWhere = null,
}) => {
  const db = prisma[model];
  if (!db) throw new Error(`resourceRouter : modèle Prisma inconnu « ${model} »`);

  const router = Router();
  router.use(authenticate, resolveTenant);

  const tenantWhere = (req) => {
    if (ownerField) return { [ownerField]: req.user.id };
    return { [tenantField]: req.tenant.organizationId };
  };

  // ─── Liste ──────────────────────────────────────────────────
  router.get(
    '/',
    authorize(`${permission}.read`),
    validate(schemas.list, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit, sort, order, search, ...filters } = req.query;

      const where = {
        ...tenantWhere(req),
        ...(softDelete ? { deletedAt: null } : {}),
        ...(extraWhere ? await extraWhere(req) : {}),
      };

      for (const field of filterFields) {
        if (filters[field] !== undefined) where[field] = filters[field];
      }

      if (searchField && search) {
        where[searchField] = { contains: String(search), mode: 'insensitive' };
      }

      const [items, total] = await Promise.all([
        db.findMany({
          where,
          ...paginationArgs({ page, limit }),
          orderBy: orderClause(sort, order ?? defaultOrder, orderFields),
          ...(includes ? { include: includes } : {}),
        }),
        db.count({ where }),
      ]);

      return paginated(res, items, { page, limit, total });
    }),
  );

  // ─── Détail ─────────────────────────────────────────────────
  router.get(
    '/:id',
    authorize(`${permission}.read`),
    validate(schemas.idParam, 'params'),
    asyncHandler(async (req, res) => {
      const item = await db.findFirst({
        where: { [idField]: req.params.id, ...tenantWhere(req), ...(softDelete ? { deletedAt: null } : {}) },
        ...(includes ? { include: includes } : {}),
      });
      if (!item) throw ApiError.notFound('Ressource introuvable');
      return success(res, item);
    }),
  );

  // ─── Création ───────────────────────────────────────────────
  router.post(
    '/',
    authorize(`${permission}.write`),
    validate(schemas.create),
    asyncHandler(async (req, res) => {
      let data = {
        [idField]: resolveId(req.body[idField]),
        ...req.body,
        ...tenantWhere(req),
        ...(ownerField ? {} : { createdBy: req.user.id }),
      };
      if (beforeCreate) data = await beforeCreate(data, req);

      const item = await db.create({ data, ...(includes ? { include: includes } : {}) });

      await audit({
        actorId: req.user.id,
        action: `${model}.create`,
        resource: model,
        resourceId: item[idField],
        req,
        newValue: req.body,
      });

      if (afterCreate) await afterCreate(item, req);
      return created(res, item);
    }),
  );

  // ─── Mise à jour ────────────────────────────────────────────
  router.patch(
    '/:id',
    authorize(`${permission}.write`),
    validate(schemas.idParam, 'params'),
    validate(schemas.update),
    asyncHandler(async (req, res) => {
      const existing = await db.findFirst({
        where: { [idField]: req.params.id, ...tenantWhere(req) },
      });
      if (!existing || (softDelete && existing.deletedAt)) throw ApiError.notFound('Ressource introuvable');

      let data = { ...req.body };
      if (beforeUpdate) data = await beforeUpdate(data, existing, req);
      if (existing.version !== undefined) data.version = { increment: 1 };

      const item = await db.update({ where: { [idField]: req.params.id }, data });

      await audit({
        actorId: req.user.id,
        action: `${model}.update`,
        resource: model,
        resourceId: req.params.id,
        req,
        newValue: req.body,
      });

      return success(res, item);
    }),
  );

  // ─── Suppression logique ────────────────────────────────────
  router.delete(
    '/:id',
    authorize(`${permission}.write`),
    validate(schemas.idParam, 'params'),
    asyncHandler(async (req, res) => {
      const existing = await db.findFirst({
        where: { [idField]: req.params.id, ...tenantWhere(req) },
      });
      if (!existing) throw ApiError.notFound('Ressource introuvable');

      await db.update({ where: { [idField]: req.params.id }, data: { deletedAt: new Date() } });

      await audit({
        actorId: req.user.id,
        action: `${model}.archive`,
        resource: model,
        resourceId: req.params.id,
        req,
      });

      return noContent(res);
    }),
  );

  return router;
};
