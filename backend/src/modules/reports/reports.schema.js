import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

export const createReportSchema = z.object({
  subjectType: z.enum(['FARM', 'PLOT', 'PRODUCTION', 'USER', 'COOPERATIVE']),
  subjectId: z.string().min(1).max(60),
  reason: z.enum([
    'FAKE_PROFILE',
    'FALSE_INFORMATION',
    'INAPPROPRIATE_CONTENT',
    'SPAM',
    'FRAUD',
    'OTHER',
  ]),
  details: z.string().trim().max(1500).optional(),
});

export const reviewReportSchema = z
  .object({
    status: z.enum(['REVIEWING', 'RESOLVED', 'REJECTED']),
    decision: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.status === 'REVIEWING' || (d.decision && d.decision.length >= 3), {
    message: 'Une décision est requise pour clôturer un signalement',
    path: ['decision'],
  });

export const listReportsSchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED']).optional(),
});

export const reportIdParam = z.object({ id: z.string().min(10).max(60) });
