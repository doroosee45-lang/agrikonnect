import * as service from './users.service.js';
import { success, noContent } from '../../shared/http/response.js';

export const getMe = async (req, res) => success(res, await service.getMe(req));

export const updateMe = async (req, res) =>
  success(res, await service.updateMe(req.body, req), { message: 'Profil mis à jour' });

export const getMyPermissions = async (req, res) => success(res, await service.getMyPermissions(req));

export const changePassword = async (req, res) =>
  success(res, await service.changePassword(req.body, req), { message: 'Mot de passe modifié' });

export const deleteMe = async (req, res) => {
  await service.deleteMe(req);
  return noContent(res);
};
