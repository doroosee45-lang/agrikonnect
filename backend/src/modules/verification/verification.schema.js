import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/** VER-01 / VER-02 — demande de vérification avec documents privés */
export const createVerificationSchema = z.object({
  subjectType: z.enum(['PROFILE', 'FARM', 'ORGANIZATION', 'COOPERATIVE']).default('PROFILE'),
  subjectId: z.string().min(1).max(60).optional(),
  level: z.enum(['PHONE_VERIFIED', 'PROFILE_VERIFIED', 'ORGANIZATION_VERIFIED']),
  documentIds: z.array(z.string().min(10).max(60)).max(10).default([]),
});

export const reviewVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  /** VER-03 : le motif est obligatoire en cas de rejet */
  reason: z.string().trim().max(500).optional(),
}).refine((d) => d.status !== 'REJECTED' || (d.reason && d.reason.length >= 5), {
  message: 'Un motif est requis en cas de rejet',
  path: ['reason'],
});

export const listVerificationsSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  level: z.enum(['PHONE_VERIFIED', 'PROFILE_VERIFIED', 'ORGANIZATION_VERIFIED']).optional(),
});

export const verificationIdParam = z.object({ id: z.string().min(10).max(60) });
