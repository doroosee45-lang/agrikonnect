import * as service from './academia.service.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';

const page = async (res, promesse) => {
  const { items, total, page: p, limit } = await promesse;
  return paginated(res, items, { page: p, limit, total });
};

// Établissements
export const listInstitutions = (req, res) => page(res, service.listInstitutions(req.query));
export const getInstitution = async (req, res) =>
  success(res, await service.getInstitution(req.params.id, req.user ?? null));
export const createInstitution = async (req, res) =>
  created(res, await service.createInstitution(req.body, req), { message: 'Établissement créé' });
export const updateInstitution = async (req, res) =>
  success(res, await service.updateInstitution(req.params.id, req.body, req), { message: 'Établissement mis à jour' });

// Unités
export const createUnit = async (req, res) =>
  created(res, await service.createUnit(req.params.id, req.body, req), { message: 'Unité créée' });
export const updateUnit = async (req, res) =>
  success(res, await service.updateUnit(req.params.id, req.params.unitId, req.body, req));
export const deleteUnit = async (req, res) => {
  await service.deleteUnit(req.params.id, req.params.unitId, req);
  return noContent(res);
};

// Responsables
export const designateAdmin = async (req, res) =>
  success(res, await service.designateAdmin(req.params.id, req.body, req), { message: 'Responsable désigné' });
export const revokeAdmin = async (req, res) => {
  await service.revokeAdmin(req.params.id, req.params.userId, req);
  return noContent(res);
};

// Profil
export const getMine = async (req, res) => success(res, await service.getMine(req));
export const upsertMyProfile = async (req, res) =>
  success(res, await service.upsertMyProfile(req.body, req), { message: 'Profil académique enregistré' });

// Affiliations
export const requestAffiliation = async (req, res) =>
  created(res, await service.requestAffiliation(req.body, req), {
    message: 'Demande envoyée. L\'établissement doit la vérifier.',
  });
export const listInstitutionAffiliations = (req, res) =>
  page(res, service.listInstitutionAffiliations(req.params.id, req.query, req));
export const decideAffiliation = async (req, res) =>
  success(res, await service.decideAffiliation(req.params.id, req.body, req), { message: 'Décision enregistrée' });
export const withdrawAffiliation = async (req, res) =>
  success(res, await service.withdrawAffiliation(req.params.id, req), { message: 'Affiliation close' });
