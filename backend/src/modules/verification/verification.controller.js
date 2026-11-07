import * as service from './verification.service.js';
import { success, created, paginated } from '../../shared/http/response.js';

export const submit = async (req, res) =>
  created(res, await service.submit(req.body, req), {
    message: 'Demande de vérification envoyée. Elle sera examinée par un administrateur.',
  });

export const listMine = async (req, res) => success(res, await service.listMine(req));

export const listForReview = async (req, res) => {
  const { items, total, page, limit } = await service.listForReview(req.query);
  return paginated(res, items, { page, limit, total });
};

export const review = async (req, res) =>
  success(res, await service.review(req.params.id, req.body, req), {
    message: 'Décision enregistrée et notifiée',
  });
