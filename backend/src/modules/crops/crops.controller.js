import * as service from './crops.service.js';
import { success, created, paginated } from '../../shared/http/response.js';

export const list = async (req, res) => {
  const { items, total, page, limit, locale } = await service.list(req.query);
  // CROP-03 — la locale réellement servie est renvoyée avec la page.
  return paginated(res, items, { page, limit, total, locale });
};

export const getOne = async (req, res) =>
  success(res, await service.getOne(req.params.id, { locale: req.query.locale ?? 'fr' }));

export const create = async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Culture ajoutée au référentiel' });

export const update = async (req, res) =>
  success(res, await service.update(req.params.id, req.body, req), { message: 'Culture mise à jour' });
