import * as service from './cooperatives.service.js';
import * as groupOffers from './groupoffers.service.js';
import { success, created, paginated } from '../../shared/http/response.js';

export const getCurrent = async (req, res) => success(res, await service.getCurrent(req));

export const updateCurrent = async (req, res) =>
  success(res, await service.updateCurrent(req.body, req), { message: 'Coopérative mise à jour' });

export const listMembers = async (req, res) => {
  const { items, total, page, limit } = await service.listMembers(req.params.id, req.query, req);
  return paginated(res, items, { page, limit, total });
};

export const addMember = async (req, res) =>
  created(res, await service.addMember(req.params.id, req.body, req), {
    message: 'Membre invité. Il doit accepter l\'adhésion.',
  });

export const updateMember = async (req, res) =>
  success(
    res,
    await service.updateMember(req.params.id, req.params.memberId, req.body, req),
    { message: 'Membre mis à jour' },
  );

export const importMembers = async (req, res) =>
  success(res, await service.importMembers(req.params.id, req.body, req), {
    message: 'Import traité',
  });

export const overview = async (req, res) => success(res, await service.overview(req.params.id, req));

/* COOP-10 — offres groupées issues de la disponibilité déclarée des membres */

export const previewGroupOffer = async (req, res) =>
  success(res, await groupOffers.previewPool(req.params.id, req.body, req), {
    message: 'Aperçu du pool disponible (membres consentants uniquement)',
  });

export const createGroupOffer = async (req, res) =>
  created(res, await groupOffers.createGroupOffer(req.params.id, req.body, req), {
    message: 'Offre groupée créée — répartition figée et auditable',
  });

export const listGroupOffers = async (req, res) =>
  success(res, await groupOffers.listGroupOffers(req.params.id, req.query, req));

export const confirmGroupOffer = async (req, res) =>
  success(res, await groupOffers.confirmGroupOffer(req.params.id, req.params.offerId, req), {
    message: 'Offre confirmée : une annonce en brouillon a été créée',
  });

export const cancelGroupOffer = async (req, res) =>
  success(res, await groupOffers.cancelGroupOffer(req.params.id, req.params.offerId, req.body.reason, req), {
    message: 'Offre annulée',
  });
