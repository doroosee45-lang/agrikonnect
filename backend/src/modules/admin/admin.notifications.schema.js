import { z } from 'zod';

/**
 * SPEC-SUPER-ADMIN M7 (§3/§6.2) — schémas des annonces internes ciblées.
 *
 * U-M7-1 : annonce ciblée **par rôle et/ou par pays** ; le ciblage est exigé
 * (une annonce sans cible ni rôle ni pays est refusée : diffusion générale
 * volontaire seulement, jamais par oubli).
 */

export const ROLES_CONNUS = [
  'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FARMER',
  'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY',
  'BUYER', 'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR',
  'LAB_PARTNER', 'API_CLIENT', 'PUBLIC_USER', 'VERIFIER',
  'COUNTRY_ADMIN', 'DATA_STEWARD',
];

export const broadcastSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(2000),
    role: z.enum(ROLES_CONNUS).optional(),
    country: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Za-z]{2}$/, 'Code pays ISO 2 lettres')
      .transform((v) => v.toUpperCase())
      .optional(),
    channels: z
      .array(z.enum(['IN_APP', 'EMAIL', 'SMS']))
      .min(1)
      .max(3)
      .default(['IN_APP']),
  })
  .refine((payload) => payload.role ?? payload.country, {
    message: 'Ciblage requis : un rôle et/ou un pays',
    path: ['role'],
  });

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
