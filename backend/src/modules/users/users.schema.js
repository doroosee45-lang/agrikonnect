import { z } from 'zod';

const phone = z.string().regex(/^\+\d{8,15}$/, 'Format international attendu (ex. +243…)');

const optionalText = (max) => z.string().trim().max(max);
const stringList = (maxLength, maxItems) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).default([]);

export const professionalProfileSchema = z
  .object({
    jobTitle: optionalText(120).optional(),
    activityDomain: optionalText(160).optional(),
    expertise: optionalText(160).optional(),
    specialties: stringList(100, 20).optional(),
    yearsExperience: z.coerce.number().int().min(0).max(80).optional(),
    biography: optionalText(2000).optional(),
    services: stringList(120, 30).optional(),
    interventionZones: stringList(120, 30).optional(),
    certifications: stringList(160, 30).optional(),
    portfolioUrl: z.string().url().optional().or(z.literal('')),
    available: z.boolean().optional(),
    publicProfile: z.boolean().optional(),
    publicFields: z
      .array(z.enum(['identity', 'biography', 'services', 'certifications', 'zones', 'portfolio']))
      .max(6)
      .optional(),
  })
  .strict();

export const accountPreferencesSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    compactNavigation: z.boolean().optional(),
    communicationEmail: z.boolean().optional(),
    communicationSms: z.boolean().optional(),
  })
  .strict();

export const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60).optional(),
    lastName: z.string().trim().min(2).max(60).optional(),
    whatsapp: phone.nullable().optional(),
    locale: z.enum(['fr', 'en']).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    professionalProfile: professionalProfileSchema.optional(),
    accountPreferences: accountPreferencesSchema.optional(),
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
