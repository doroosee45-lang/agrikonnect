import * as service from './productions.service.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';

export const list = async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
};

export const getOne = async (req, res) => success(res, await service.getOne(req.params.id, req));

export const create = async (req, res) => {
  const { production, conversion } = await service.create(req.body, req);
  return created(res, { production, conversion }, { message: 'Production enregistrée (déclarée)' });
};

export const update = async (req, res) =>
  success(res, await service.update(req.params.id, req.body, req), { message: 'Production mise à jour' });

export const archive = async (req, res) => {
  await service.archive(req.params.id, req);
  return noContent(res);
};

export const stats = async (req, res) => success(res, await service.stats(req.query, req));
