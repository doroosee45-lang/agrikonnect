import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';
import { GOVERNANCE_ROLES } from '../../shared/permissions.js';

/**
 * SPEC-SUPER-ADMIN §6.2 / §10 — schémas de validation des routes admin.
 *
 * M2 (utilisateurs & rôles) : les mutations de gouvernance portent toujours
 * un `reason` (motif) et, quand la MFA est exigée (RG-G1/G3), un `mfaCode`.
 */

/**
 * Miroir de l'enum Prisma `Role` (prisma/schema.prisma) — le filtre de liste
 * U-M2-1 doit accepter **tous** les rôles (un FARMER se recherche aussi),
 * pas seulement les rôles de gouvernance.
 */
export const ALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FARMER',
  'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY',
  'BUYER', 'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR',
  'LAB_PARTNER', 'API_CLIENT', 'PUBLIC_USER', 'VERIFIER', 'COUNTRY_ADMIN',
  'DATA_STEWARD',
];

export const listUsersSchema = paginationSchema.extend({
  /** Terme de recherche (alias `search` conservé pour compatibilité). */
  q: z.string().trim().max(80).optional(),
  search: z.string().trim().max(80).optional(),
  role: z.enum(ALL_ROLES).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  country: z
    .string()
    .trim()
    .length(2, 'Code pays à 2 lettres requis')
    .toUpperCase()
    .optional(),
  mfa: z.enum(['true', 'false']).optional(),
  emailVerified: z.enum(['true', 'false']).optional(),
  phoneVerified: z.enum(['true', 'false']).optional(),
});

/**
 * Suspendre / réactiver — **motif requis** (U-M2-4 : « avec motif »).
 * Le motif est journalisé dans `audit_logs.newValue.reason` (RG-M2-2).
 */
export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().min(3, 'Motif requis (3 caractères minimum)').max(500),
});

/** Motif des actions opérationnelles — exigé quand la spec le dit (U-M2-4). */
export const reasonActionSchema = z.object({
  reason: z.string().trim().min(3, 'Motif requis (3 caractères minimum)').max(500).optional(),
});

/**
 * Recherche d'audit — M6 (U-M6-1) : acteur, action, ressource, date, gravité.
 * Définie dans `admin.security.schema.js` (une seule source) et ré-exportée
 * sous le nom historique consommé par `admin.routes.js`.
 */
export { auditQuerySchema as listAuditSchema } from './admin.security.schema.js';

export const userIdParam = z.object({ id: z.string().min(10).max(60) });

/**
 * Filtres du tableau de bord (SPEC-SUPER-ADMIN M1 / RG-M1-1).
 * `country` = code ISO 2 lettres ; `from`/`to` = bornes de période (AAAA-MM-JJ).
 * Les dates sont validées au calendrier (2026-13-45 ou 2026-02-31 sont refusés).
 */
const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((valeur) => {
    const date = new Date(`${valeur}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur;
  }, 'Date calendrier invalide');

export const dashboardQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .length(2, 'Code pays à 2 lettres requis')
    .toUpperCase()
    .optional(),
  from: dateIso.optional(),
  to: dateIso.optional(),
});

export const settingSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_.]{3,60}$/, 'Clé de paramètre invalide'),
  value: z.any(),
});

// ─── M2 — rôles de gouvernance (palier 2, SPEC-SUPER-ADMIN §2.3/§10) ────────

/**
 * Attribution de rôle (palier 2) — SPEC-SUPER-ADMIN §10.
 *
 * RG-G1 : `mfaCode` = code TOTP (ou code de secours) du **Super Admin acteur**,
 * vérifié par `assertMfa` — le code n'est jamais stocké.
 * RG-G3 : la nomination d'un `SUPER_ADMIN` exige en plus le mot de passe
 * **courant de l'acteur** (double validation) — `password` devient alors
 * obligatoire (affinage ci-dessous).
 */
export const grantRoleSchema = z
  .object({
    role: z.enum(GOVERNANCE_ROLES),
    organizationId: z.string().trim().min(10).max(60).optional(),
    mfaCode: z.string().trim().min(6).max(14),
    password: z.string().min(8).max(128).optional(),
    reason: z.string().trim().min(3).max(200),
  })
  .refine((valeur) => valeur.role !== 'SUPER_ADMIN' || Boolean(valeur.password), {
    message: 'La nomination d\'un SUPER_ADMIN exige la saisie du mot de passe courant (RG-G3)',
    path: ['password'],
  });

/** Révocation de rôle : `role` validé contre la liste gouvernance. */
export const userRoleParams = z.object({
  id: z.string().min(10).max(60),
  role: z.enum(GOVERNANCE_ROLES),
});

/** Marquage e-mail / téléphone vérifié (motif requis, U-M2-4). */
export const verifyContactSchema = z.object({
  reason: z.string().trim().min(3, 'Motif requis (3 caractères minimum)').max(200),
});

/** Période de la liste — bornes calendaires réutilisant `dateIso`. */
export const usersPeriodSchema = z.object({
  createdFrom: dateIso.optional(),
  createdTo: dateIso.optional(),
});

/** Union des filtres de liste M2 (query complète). */
export const listUsersM2Schema = listUsersSchema.merge(usersPeriodSchema);
