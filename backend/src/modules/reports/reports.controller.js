import * as service from './reports.service.js';
import { success, created, paginated } from '../../shared/http/response.js';

export const create = async (req, res) =>
  created(res, await service.create(req.body, req), {
    message: 'Signalement transmis. Il sera examiné par la modération.',
  });

export const listForModeration = async (req, res) => {
  const { items, total, page, limit } = await service.listForModeration(req.query);
  return paginated(res, items, { page, limit, total });
};

export const review = async (req, res) =>
  success(res, await service.review(req.params.id, req.body, req), { message: 'Signalement traité' });
