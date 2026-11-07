import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/**
 * SPEC-SUPER-ADMIN M6 (§3/§6.2) — schémas de la sécurité et de l'audit.
 *
 * `auditQuerySchema` = recherche avancée U-M6-1 (acteur, action, ressource,
 * date, gravité). La gravité (`severity`) est une **classification dérivée**
 * de l'action (`auditSeverity`, ci-dessous) — `audit_logs` n'a pas de colonne
 * de gravité et la spécification n'en ajoute aucune (§7.2).
 */

/** Date calendrier AAAA-MM-JJ (refuse 2026-13-45 ou 2026-02-31). */
export const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((valeur) => {
    const date = new Date(`${valeur}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur;
  }, 'Date calendrier invalide');

/** Recherche avancée du journal d'audit (U-M6-1). */
export const auditQuerySchema = paginationSchema.extend({
  /** Action cherchée (contient, insensible à la casse) — ex. `auth.login`. */
  action: z.string().trim().max(80).optional(),
  /** Acteur : identifiant exact **ou** fragment d'e-mail/nom (résolution côté service). */
  actor: z.string().trim().max(120).optional(),
  /** Alias historique de `actor` (identifiant exact). */
  actorId: z.string().trim().max(60).optional(),
  resource: z.string().trim().max(60).optional(),
  from: dateIso.optional(),
  to: dateIso.optional(),
  severity: z.enum(['haute', 'moyenne', 'info']).optional(),
});

/** Export du journal : mêmes filtres + format CSV/JSON (action auditée). */
export const auditExportSchema = auditQuerySchema.extend({
  format: z.enum(['csv', 'json']).default('csv'),
  limit: z.coerce.number().int().min(1).max(5000).default(5000),
});

/**
 * Politique de sécurité (U-M6-3, palier 2) : les clés acceptées sont celles
 * de la section `security` du catalogue M3 (`SETTINGS_CATALOG`) — la
 * validation de valeur (type, plage) reste celle du service de paramètres.
 */
export const policyUpdateSchema = z.object({
  values: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(3).max(200).optional(),
});

// ─── Gravité dérivée (U-M6-1) ──────────────────────────────────────────────

/**
 * Classification de gravité d'une entrée d'audit, **dérivée de l'action** :
 * `audit_logs` n'a pas de colonne de gravité (§7.2 — minimum de schéma) et la
 * règle ci-dessous est déterministe, documentée et testée. Première règle
 * dont le marqueur figure dans l'action (en minuscules) gagne ; à défaut :
 * `info`.
 */
export const SEVERITY_RULES = [
  {
    severity: 'haute',
    markers: [
      'admin.user.deleted',
      'admin.superadmin.',
      'admin.role.revoked',
      'admin.user.force_logout',
      'auth.login.locked',
      'admin.user.status',
      'mfa.disable',
    ],
  },
  {
    severity: 'moyenne',
    markers: [
      'failed',
      'granted',
      'unlock',
      'reset',
      'update',
      'run',
      'verify',
      'moderate',
      'broadcast',
      'export',
      'pause',
      'resume',
    ],
  },
];

export const auditSeverity = (action) => {
  const valeur = String(action ?? '').toLowerCase();
  for (const rule of SEVERITY_RULES) {
    if (rule.markers.some((marker) => valeur.includes(marker))) return rule.severity;
  }
  return 'info';
};

/**
 * Clause `where` Prisma du filtre par gravité — **cohérente** avec
 * `auditSeverity` (même règle, même ordre) : `moyenne` exclut les actions déjà
 * classées `haute`, `info` exclut tout marqueur.
 */
export const severityWhere = (severity) => {
  const haute = SEVERITY_RULES[0].markers.map((m) => ({ action: { contains: m, mode: 'insensitive' } }));
  const moyenne = SEVERITY_RULES[1].markers.map((m) => ({ action: { contains: m, mode: 'insensitive' } }));
  if (severity === 'haute') return { OR: haute };
  if (severity === 'moyenne') return { AND: [{ OR: moyenne }, { NOT: { OR: haute } }] };
  return { NOT: { OR: [...haute, ...moyenne] } };
};
