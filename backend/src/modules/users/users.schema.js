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

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, '8 caractères minimum').max(128),
});
