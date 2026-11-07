import { prisma } from '../config/prisma.js';
import { ApiError } from './errors/ApiError.js';

/**
 * Quotas IA (AI-06 / NFR-05) : budget par utilisateur et par organisation.
 * Les valeurs sont paramétrables par variables d'environnement.
 */
const USER_DAILY = Number(process.env.AI_DAILY_QUOTA_PER_USER ?? 50);
const ORG_DAILY = Number(process.env.AI_DAILY_QUOTA_PER_ORG ?? 500);

export const assertAiQuota = async ({ userId, organizationId }) => {
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [userCount, orgCount] = await Promise.all([
    prisma.aiAnalysis.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.aiAnalysis.count({ where: { organizationId, createdAt: { gte: since } } }),
  ]);

  if (userCount >= USER_DAILY) {
    throw ApiError.tooManyRequests(
      `Quota IA journalier atteint (${USER_DAILY} requêtes). Il se réinitialise dans 24 h.`,
    );
  }
  if (orgCount >= ORG_DAILY) {
    throw ApiError.tooManyRequests(
      `Quota IA journalier de l'organisation atteint (${ORG_DAILY} requêtes).`,
    );
  }

  return { userRemaining: USER_DAILY - userCount, orgRemaining: ORG_DAILY - orgCount };
};
