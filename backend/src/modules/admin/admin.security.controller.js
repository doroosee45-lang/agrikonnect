import * as service from './admin.security.service.js';
import { success } from '../../shared/http/response.js';

/**
 * SPEC-SUPER-ADMIN M6 — contrôleur sécurité/audit (format de réponse unique).
 */

/** U-M6-1 — export du journal (CSV/JSON), audité côté service. */
export const auditExport = async (req, res) => {
  const fichier = await service.exportAudit(req.query ?? {}, req);
  res.setHeader('Content-Type', fichier.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fichier.filename}"`);
  return res.status(200).send(fichier.content);
};

/** U-M6-2 — vue sécurité consolidée (connexions, verrous, MFA, clés, sessions). */
export const overview = async (_req, res) => success(res, await service.securityOverview());

/** U-M6-3 — politique de sécurité (palier 2). */
export const getPolicy = async (_req, res) => success(res, await service.getPolicy());

export const updatePolicy = async (req, res) =>
  success(res, await service.updatePolicy(req.body ?? {}, req), {
    message: 'Politique de sécurité mise à jour',
  });
