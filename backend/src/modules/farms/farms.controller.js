import * as service from './farms.service.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';

export const list = async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
};

export const getOne = async (req, res) => success(res, await service.getOne(req.params.id, req));

export const create = async (req, res) => {
  const { farm, warnings } = await service.create(req.body, req);
  return created(res, { farm, warnings }, { message: 'Exploitation créée' });
};

export const update = async (req, res) => {
  const { farm, warnings } = await service.update(req.params.id, req.body, req);
  return success(res, { farm, warnings }, { message: 'Exploitation mise à jour' });
};

export const archive = async (req, res) => {
  await service.archive(req.params.id, req);
  return noContent(res);
};

export const publish = async (req, res) => {
  const result = await service.publish(req.params.id, req.body.isPublic, req);
  return success(res, result, {
    message: req.body.isPublic ? 'Profil publié' : 'Profil dépublié',
  });
};
