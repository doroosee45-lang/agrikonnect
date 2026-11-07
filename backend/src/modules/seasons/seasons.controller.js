import * as service from './seasons.service.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';

export const list = async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
};

export const getOne = async (req, res) => success(res, await service.getOne(req.params.id, req));

export const create = async (req, res) =>
  created(res, { seasonFeedback: await service.create(req.body, req) }, {
    message: 'Rendement réel enregistré (déclaré)',
  });

export const update = async (req, res) =>
  success(res, await service.update(req.params.id, req.body, req), {
    message: 'Rendement mis à jour',
  });

export const archive = async (req, res) => {
  await service.archive(req.params.id, req);
  return noContent(res);
};

export const compare = async (req, res) =>
  success(res, await service.compareWithRecommendation(req.params.id, req));

export const stats = async (req, res) => success(res, await service.stats(req.query, req));
