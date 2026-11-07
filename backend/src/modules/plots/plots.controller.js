import * as service from './plots.service.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';

export const list = async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
};

export const getOne = async (req, res) => success(res, await service.getOne(req.params.id, req));

export const create = async (req, res) => {
  const { plot, computed } = await service.create(req.body, req);
  return created(res, { plot, computed }, { message: 'Parcelle créée' });
};

export const update = async (req, res) =>
  success(res, await service.update(req.params.id, req.body, req), { message: 'Parcelle mise à jour' });

export const archive = async (req, res) => {
  await service.archive(req.params.id, req);
  return noContent(res);
};

export const listHistory = async (req, res) =>
  success(res, await service.listHistory(req.params.id, req));

export const addHistory = async (req, res) => {
  const entry = await service.addHistory(req.params.id, req.body, req);
  return created(res, entry, { message: 'Historique cultural ajouté' });
};

export const updateHistory = async (req, res) =>
  success(
    res,
    await service.updateHistory(req.params.id, req.params.historyId, req.body, req),
    { message: 'Historique mis à jour' },
  );
