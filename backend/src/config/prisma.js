import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * En dev, le rechargement à chaud de Node peut recréer des clients
 * et saturer les connexions Postgres : on réutilise l'instance globale.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['warn', 'error'],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;
