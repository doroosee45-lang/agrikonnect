import * as service from './soil.service.js';
import { success, created, noContent } from '../../shared/http/response.js';

export const list = async (req, res) => success(res, await service.list(req.params.id, req));

export const latestProfile = async (req, res) =>
  success(res, await service.latestProfile(req.params.id, req));

export const create = async (req, res) =>
  created(res, await service.create(req.params.id, req.body, req), {
    message: 'Analyse de sol enregistrée (avec provenance)',
  });

export const update = async (req, res) =>
  success(
    res,
    await service.update(req.params.id, req.params.assessmentId, req.body, req),
    { message: 'Analyse de sol mise à jour' },
  );

export const archive = async (req, res) => {
  await service.archive(req.params.id, req.params.assessmentId, req);
  return noContent(res);
};
