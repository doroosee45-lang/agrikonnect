import * as service from './organizations.service.js';
import { success, created } from '../../shared/http/response.js';

export const list = async (req, res) => success(res, await service.listMine(req));

export const getOne = async (req, res) => success(res, await service.getOne(req.params.id, req));

export const create = async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Organisation créée' });

export const update = async (req, res) =>
  success(res, await service.update(req.params.id, req.body, req), { message: 'Organisation mise à jour' });
