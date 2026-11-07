import * as service from './admin.settings.service.js';
import { success, paginated } from '../../shared/http/response.js';

/**
 * SPEC-SUPER-ADMIN M3 — passeries HTTP (aucune logique ici).
 * Les gardes (permission, palier 2) sont posées dans `admin.settings.routes.js`.
 */

export const getSettings = async (_req, res) =>
  success(res, await service.getSettingsView());

export const updateSettings = async (req, res) =>
  success(res, await service.updateSettings(req.body, req), {
    message: 'Paramètres enregistrés',
  });

export const settingsHistory = async (req, res) => {
  const { items, total, page, limit } = await service.settingsHistory(req.query);
  return paginated(res, items, { page, limit, total });
};

export const resetSetting = async (req, res) =>
  success(res, await service.resetSetting(req.params.key, req), {
    message: 'Paramètre réinitialisé à sa valeur par défaut',
  });

export const getFlags = async (req, res) =>
  success(res, await service.getZoneFlags(req.query));

export const updateFlags = async (req, res) =>
  success(res, await service.updateZoneFlags(req.body, req), {
    message: 'Feature flags mis à jour',
  });
