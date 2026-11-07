import * as service from './admin.service.js';
import { success, paginated } from '../../shared/http/response.js';

export const dashboard = async (req, res) =>
  success(res, await service.dashboard(req.query ?? {}));

/** M1 — export CSV de la vue (RG-M1-4 : action auditée côté service). */
export const dashboardExport = async (req, res) =>
  success(res, await service.exportDashboardCsv(req.query ?? {}, req));

export const listUsers = async (req, res) => {
  const { items, total, page, limit } = await service.listUsers(req.query);
  return paginated(res, items, { page, limit, total });
};

export const updateUserStatus = async (req, res) =>
  success(res, await service.updateUserStatus(req.params.id, req.body, req), {
    message: 'Statut utilisateur mis à jour',
  });

export const listAudit = async (req, res) => {
  const { items, total, page, limit } = await service.listAuditLogs(req.query);
  return paginated(res, items, { page, limit, total });
};

export const getSettings = async (_req, res) => success(res, await service.getSettings());

export const updateSetting = async (req, res) =>
  success(res, await service.updateSetting(req.body.key, req.body.value, req), {
    message: 'Paramètre enregistré',
  });

export const exportFarms = async (req, res) => {
  const csv = await service.exportFarmsCsv(req);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="farms.csv"');
  return res.status(200).send(csv);
};

// ─── M2 — utilisateurs & rôles (SPEC-SUPER-ADMIN §6.2) ─────────────────────

export const getUser = async (req, res) =>
  success(res, await service.getUser(req.params.id));

export const unlockUser = async (req, res) =>
  success(res, await service.unlockUser(req.params.id, req.body, req), {
    message: 'Compte déverrouillé',
  });

export const forceLogout = async (req, res) =>
  success(res, await service.forceLogout(req.params.id, req.body, req), {
    message: 'Sessions révoquées',
  });

export const verifyEmail = async (req, res) =>
  success(res, await service.markVerified(req.params.id, 'email', req.body, req), {
    message: 'E-mail marqué vérifié',
  });

export const verifyPhone = async (req, res) =>
  success(res, await service.markVerified(req.params.id, 'phone', req.body, req), {
    message: 'Téléphone marqué vérifié',
  });

export const listRoles = async (_req, res) => success(res, service.rolesMatrix());

export const grantRole = async (req, res) =>
  success(res, await service.grantRole(req.params.id, req.body, req), {
    message: 'Rôle attribué',
  });

export const revokeRole = async (req, res) =>
  success(res, await service.revokeRole(req.params.id, req.params.role, req), {
    message: 'Rôle révoqué',
  });

export const deleteUser = async (req, res) =>
  success(res, await service.deleteUser(req.params.id, req.body, req), {
    message: 'Compte supprimé (suppression logique)',
  });

export const exportUser = async (req, res) =>
  success(res, await service.exportUserData(req.params.id, req), {
    message: 'Export de portabilité généré',
  });
