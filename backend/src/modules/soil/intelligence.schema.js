import { z } from 'zod';

/** S2/S3 — validation des entrées du moteur agronomique (CDC V2 §6 / V3 §6). */

const criterionSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    type: z.enum(['range', 'min', 'max', 'in']),
    min: z.number().optional(),
    max: z.number().optional(),
    value: z.number().optional(),
    values: z.array(z.string().trim().min(1)).optional(),
    weight: z.number().positive().max(100).optional(),
    label: z.string().trim().max(160).optional(),
    unit: z.string().trim().max(20).optional(),
  })
  .superRefine((criterion, ctx) => {
    if (criterion.type === 'range' && (criterion.min === undefined || criterion.max === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Un critère "range" requiert min et max' });
    }
    if ((criterion.type === 'min' || criterion.type === 'max') && criterion.value === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Un critère "min"/"max" requiert value' });
    }
    if (criterion.type === 'in' && !criterion.values?.length) {
      ctx.addIssue({ code: 'custom', message: 'Un critère "in" requiert values' });
    }
  });

const rotationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  after: z.array(z.string().trim().min(1)).optional(),
  assumptions: z.array(z.string().trim().max(300)).optional(),
  sequence: z
    .array(
      z.object({
        cropSlug: z.string().trim().min(1).max(60),
        family: z.string().trim().max(60).optional(),
        rationale: z.string().trim().max(300).optional(),
        checks: z.array(z.string().trim().max(200)).optional(),
      }),
    )
    .min(1),
});

const calendarSchema = z.object({
  cropSlug: z.string().trim().max(60).optional(),
  activity: z.string().trim().min(1).max(60),
  startMonth: z.number().int().min(1).max(12),
  endMonth: z.number().int().min(1).max(12),
  rationale: z.string().trim().max(300).optional(),
});

export const createRuleSetSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  version: z.string().trim().min(1).max(40),
  zone: z.string().trim().min(2).max(80),
  countryCode: z.string().trim().length(2).toUpperCase(),
  cropSlug: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  rules: z.object({
    criteria: z.array(criterionSchema).min(1).max(40),
    rotations: z.array(rotationSchema).optional(),
    calendar: z.array(calendarSchema).optional(),
    yields: z
      .object({
        lowKgPerHa: z.number().nonnegative(),
        highKgPerHa: z.number().nonnegative(),
        unit: z.string().trim().max(20).optional(),
      })
      .optional(),
  }),
});

export const ruleSetParam = z.object({ id: z.string().min(10).max(60) });

export const ruleSetQuery = z.object({
  status: z.enum(['draft', 'validated', 'retired']).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  zone: z.string().trim().max(80).optional(),
  cropSlug: z.string().trim().max(60).optional(),
});

export const flagSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  key: z.string().trim().min(3).max(80).default('soil.recommendations'),
  scope: z.enum(['country', 'zone', 'crop', 'crop_zone']),
  scopeValue: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const flagQuery = z.object({
  key: z.string().trim().max(80).optional(),
  scope: z.enum(['country', 'zone', 'crop', 'crop_zone']).optional(),
  scopeValue: z.string().trim().max(120).optional(),
});

export const suitabilitySchema = z.object({
  id: z.string().min(20).max(40).optional(),
  cropId: z.string().min(10).max(60),
});

export const suitabilityParam = z.object({
  id: z.string().min(10).max(60),
  suitabilityId: z.string().min(10).max(60),
});

export const rotationSchemaBody = z.object({
  id: z.string().min(20).max(40).optional(),
  cropId: z.string().min(10).max(60).optional(),
  horizonYears: z.number().int().min(1).max(10).optional(),
});

export const rotationDecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  comment: z.string().trim().max(500).optional(),
});

export const rotationParam = z.object({
  id: z.string().min(10).max(60),
  planId: z.string().min(10).max(60),
});

export const farmingPlanSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  rotationPlanId: z.string().min(10).max(60).optional(),
  horizonYears: z.number().int().min(1).max(10).optional(),
});

export const yieldSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  cropId: z.string().min(10).max(60),
});
