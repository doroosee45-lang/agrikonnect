import { z } from 'zod';

const publicSocialLink = z.string().trim().url().max(500);

const profileDetailsSchema = z
  .object({
    officialName: z.string().trim().max(160).optional(),
    tradingName: z.string().trim().max(160).optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    coverUrl: z.string().url().optional().or(z.literal('')),
    sector: z.string().trim().max(160).optional(),
    foundedAt: z.string().trim().date().optional(),
    registrationCountry: z.string().trim().length(2).toUpperCase().optional(),
    headquartersAddress: z.string().trim().max(500).optional(),
    legalForm: z.string().trim().max(120).optional(),
    registrationNumber: z.string().trim().max(120).optional(),
    taxIdentifier: z.string().trim().max(120).optional(),
    legalRepresentative: z.string().trim().max(160).optional(),
    officialPhone: z.string().trim().max(32).optional(),
    institutionalEmail: z.string().email().optional().or(z.literal('')),
    website: z.string().url().optional().or(z.literal('')),
    socialLinks: z.array(publicSocialLink).max(10).optional(),
    activities: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    locations: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    partners: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  })
  .strict();

const organizationSettingsSchema = z
  .object({
    defaultLocale: z.enum(['fr', 'en']).optional(),
    publicProfile: z.boolean().optional(),
    publicFields: z
      .array(z.enum(['description', 'activities', 'locations', 'contact', 'partners', 'projects']))
      .max(6)
      .optional(),
    memberInvitesAllowed: z.boolean().optional(),
  })
  .strict();

export const createOrganizationSchema = z.object({
  type: z.enum(['COOPERATIVE', 'COMPANY']),
  name: z.string().trim().min(2, 'Nom requis').max(120),
  description: z.string().trim().max(2000).optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  /** COOP-01 : informations légales de la coopérative */
  legalStatus: z.string().trim().max(120).optional(),
  foundedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  province: z.string().trim().max(120).optional(),
  territory: z.string().trim().max(120).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema
  .omit({ type: true })
  .partial()
  .extend({
    profileDetails: profileDetailsSchema.optional(),
    settings: organizationSettingsSchema.optional(),
  })
  .strict();

export const organizationIdParam = z.object({
  id: z.string().min(10, 'Identifiant invalide'),
});
