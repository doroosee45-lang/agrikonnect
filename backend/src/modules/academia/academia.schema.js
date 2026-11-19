import { z } from 'zod';

import { paginationSchema } from '../../shared/pagination.js';
import { ACADEMIC_AFFILIATION_ROLES } from '../../shared/permissions.js';

const texte = (max) => z.string().trim().min(1).max(max);
const texteOptionnel = (max) => z.string().trim().max(max).optional().nullable();
const listeCourte = z.array(z.string().trim().min(1).max(80)).max(30);

export const INSTITUTION_KINDS = ['UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'RESEARCH_CENTER'];
export const UNIT_KINDS = ['FACULTY', 'DEPARTMENT', 'LABORATORY', 'RESEARCH_CENTER'];

export const idParam = z.object({ id: z.string().trim().min(1).max(80) });
export const unitParam = z.object({
  id: z.string().trim().min(1).max(80),
  unitId: z.string().trim().min(1).max(80),
});
export const adminParam = z.object({
  id: z.string().trim().min(1).max(80),
  userId: z.string().uuid(),
});

export const listInstitutionsSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(120).optional(),
  kind: z.enum(INSTITUTION_KINDS).optional(),
  discipline: z.string().trim().max(80).optional(),
});

const champsEtablissement = {
  description: texteOptionnel(4000),
  shortName: texteOptionnel(40),
  website: z.string().trim().url().max(300).optional().nullable(),
  contactEmail: z.string().trim().email().max(200).optional().nullable(),
  contactPhone: texteOptionnel(40),
  address: texteOptionnel(300),
  city: texteOptionnel(120),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
  disciplines: listeCourte.optional(),
  isPublished: z.boolean().optional(),
};

export const createInstitutionSchema = z.object({
  name: texte(200),
  kind: z.enum(INSTITUTION_KINDS).default('UNIVERSITY'),
  countryCode: z.string().trim().length(2).toUpperCase(),
  ...champsEtablissement,
});

export const updateInstitutionSchema = z
  .object({ name: texte(200).optional(), ...champsEtablissement })
  .refine((v) => Object.keys(v).length > 0, { message: 'Aucune modification fournie' });

export const createUnitSchema = z.object({
  kind: z.enum(UNIT_KINDS),
  name: texte(200),
  code: texteOptionnel(40),
  description: texteOptionnel(2000),
  parentId: z.string().trim().max(80).optional().nullable(),
});

export const updateUnitSchema = z
  .object({
    name: texte(200).optional(),
    code: texteOptionnel(40),
    description: texteOptionnel(2000),
    parentId: z.string().trim().max(80).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Aucune modification fournie' });

export const designateAdminSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().trim().email().max(200).optional(),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.email), {
    message: 'Indique soit userId, soit email',
  });

export const updateProfileSchema = z.object({
  headline: texteOptionnel(160),
  bio: texteOptionnel(4000),
  disciplines: listeCourte.optional(),
  researchAreas: listeCourte.optional(),
  interests: listeCourte.optional(),
  externalLinks: z
    .array(z.object({ label: texte(80), url: z.string().trim().url().max(300) }))
    .max(10)
    .optional()
    .nullable(),
  visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']).optional(),
  contactPolicy: z.enum(['EVERYONE', 'VERIFIED_MEMBERS', 'NOBODY']).optional(),
});

export const requestAffiliationSchema = z.object({
  organizationId: z.string().trim().min(1).max(80),
  unitId: z.string().trim().max(80).optional().nullable(),
  role: z.enum(ACADEMIC_AFFILIATION_ROLES),
  studyLevel: texteOptionnel(80),
  program: texteOptionnel(160),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(-\d{4})?$/, 'Format attendu : 2026 ou 2026-2027')
    .optional()
    .nullable(),
  position: texteOptionnel(120),
  message: texteOptionnel(1000),
});

export const listAffiliationsSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'ENDED']).optional(),
});

export const decisionSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'SUSPENDED', 'ENDED']),
  reason: texteOptionnel(1000),
});
