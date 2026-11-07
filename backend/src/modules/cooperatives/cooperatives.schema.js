import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/** COOP-02 — invitation / adhésion d'un membre */
export const addMemberSchema = z.object({
  identifier: z.string().trim().min(3, 'Email ou téléphone du membre requis').max(120),
  consentScopes: z
    .array(z.enum(['profile', 'plots', 'productions', 'soil']))
    .default(['profile']),
  joinedAt: z.coerce.date().optional(),
});

export const updateMemberSchema = z
  .object({
    status: z.enum(['INVITED', 'ACTIVE', 'REMOVED']).optional(),
    consentScopes: z.array(z.enum(['profile', 'plots', 'productions', 'soil'])).optional(),
  })
  .strict();

export const memberParam = z.object({
  id: z.string().min(10).max(60),
  memberId: z.string().min(1).max(60),
});

export const listMembersSchema = paginationSchema.extend({
  status: z.enum(['INVITED', 'ACTIVE', 'REMOVED']).optional(),
  search: z.string().trim().max(80).optional(),
});

/** COOP-03 — import CSV : le fichier est envoyé en texte brut (max 2 Mo) */
export const importMembersSchema = z.object({
  csv: z.string().min(5, 'Contenu CSV requis').max(2_000_000),
  /** Colonnes attendues : email | phone | firstName | lastName | consentScopes */
  dryRun: z.coerce.boolean().default(false),
});

export const cooperativeIdParam = z.object({ id: z.string().min(10).max(60) });

/** COOP-10 — offre groupée */
export const groupOfferSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  cropId: z.string().min(10).max(60),
  season: z.string().trim().max(40).optional(),
  title: z.string().trim().min(3).max(160),
  quality: z.string().trim().max(120).optional(),
  pricePerUnit: z.number().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

export const groupOfferPreviewSchema = z.object({
  cropId: z.string().min(10).max(60),
  season: z.string().trim().max(40).optional(),
});

export const groupOfferParam = z.object({
  id: z.string().min(10).max(60),
  offerId: z.string().min(10).max(60),
});

export const groupOfferQuery = z.object({
  status: z.enum(['PROPOSED', 'CONFIRMED', 'CANCELLED']).optional(),
});

export const groupOfferCancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
