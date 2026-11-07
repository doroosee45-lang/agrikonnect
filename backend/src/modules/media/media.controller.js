import * as service from './media.service.js';
import { success, created } from '../../shared/http/response.js';

export const createUploadUrl = async (req, res) =>
  created(res, await service.createUploadUrl(req.body, req), { message: 'URL d\'upload générée' });

export const confirm = async (req, res) =>
  success(res, await service.confirm(req.params.id, req), { message: 'Média enregistré' });

export const list = async (req, res) => success(res, await service.list(req.query, req));

export const remove = async (req, res) =>
  success(res, await service.remove(req.params.id, req), { message: 'Média supprimé' });
