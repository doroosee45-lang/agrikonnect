import * as service from './public.service.js';
import { success, paginated } from '../../shared/http/response.js';

export const getFarm = async (req, res) => success(res, await service.getFarmBySlug(req.params.slug, req));

export const contact = async (req, res) => {
  const result = await service.contactFarm(req.params.slug, req.body);
  return success(res, result, { message: result.message });
};

export const map = async (req, res) => success(res, await service.map(req.query));

export const listFarms = async (req, res) => {
  const { items, total, page, limit } = await service.listPublicFarms(req.query);
  return paginated(res, items, { page, limit, total });
};
