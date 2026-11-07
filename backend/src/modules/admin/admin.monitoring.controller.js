import * as service from './admin.monitoring.service.js';
import { success } from '../../shared/http/response.js';

/**
 * SPEC-SUPER-ADMIN M5 — contrôleur de supervision (format de réponse unique).
 * Les handlers sont minces : la logique et les règles vivent dans le service.
 */

/** U-M5-1 — services externes, réévalués à chaque appel (RG-M5-1). */
export const services = async (_req, res) => success(res, service.servicesState());

/** U-M5-3 — santé technique (DB, stockage, temps réel, usage API) + alertes. */
export const health = async (_req, res) => success(res, await service.healthState());

/** U-M5-2 — console des tâches planifiées. */
export const jobs = async (_req, res) => success(res, service.jobsView());

/** U-M5-2 / RG-M5-2 — déclenchement manuel (audité, verrouillé). */
export const runJob = async (req, res) => {
  const outcome = await service.runJobManually(req.params.name, req.body ?? {}, req);
  const message = outcome.skipped
    ? `Tâche ${req.params.name} non exécutée : ${outcome.reason}`
    : `Tâche ${req.params.name} exécutée`;
  return success(res, outcome, { message });
};

/** U-M5-2 — pause (palier 2, auditée). */
export const pauseJob = async (req, res) =>
  success(res, await service.pauseJobByName(req.params.name, req), {
    message: `Tâche ${req.params.name} mise en pause`,
  });

/** U-M5-2 — reprise (palier 2, auditée). */
export const resumeJob = async (req, res) =>
  success(res, await service.resumeJobByName(req.params.name, req), {
    message: `Tâche ${req.params.name} reprise`,
  });
