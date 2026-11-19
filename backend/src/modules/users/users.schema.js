import { z } from 'zod';

const phone = z.string().regex(/^\+\d{8,15}$/, 'Format international attendu (ex. +243…)');

export const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60).optional(),
    lastName: z.string().trim().min(2).max(60).optional(),
    whatsapp: phone.nullable().optional(),
    locale: z.enum(['fr', 'en']).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    /** Un changement de téléphone exige une nouvelle vérification OTP (AUTH-03) */
    phone: phone.optional(),
  })
  .strict();

/**
 * Audit H-04 — changer de mot de passe exige le mot de passe ACTUEL (et le
 * code de double authentification si elle est active) : un jeton volé ne
 * suffit plus à s'approprier définitivement le compte.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis').max(128),
    newPassword: z.string().min(8, '8 caractères minimum').max(128),
    mfaCode: z.string().trim().min(6).max(14).optional(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel',
    path: ['newPassword'],
  });
