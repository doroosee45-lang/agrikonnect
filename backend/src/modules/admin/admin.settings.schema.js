import { z } from 'zod';

/**
 * SPEC-SUPER-ADMIN M3 — catalogue des paramètres globaux (U-M3-1 / U-M3-2).
 *
 * Chaque paramètre porte : clé, type, valeur par défaut, plage autorisée,
 * description, section et nécessité de redémarrage (RG-M3-1). La validation
 * est faite par schéma Zod **par section** (§10 de la spec).
 *
 * RG-M3-2 : `security.*` et `integrations.*` sont **palier 2** (SUPER_ADMIN) ;
 * `modules.*` et `limits.*` sont palier 1 ; `platform.*` est palier 1
 * (décision documentée : seul le reset de n'importe quelle clé est palier 2).
 */

export const SETTINGS_SECTIONS = {
  platform: { label: 'Plateforme', tier: 1 },
  security: { label: 'Sécurité', tier: 2 },
  modules: { label: 'Modules', tier: 1 },
  limits: { label: 'Limites', tier: 1 },
  integrations: { label: 'Intégrations', tier: 2 },
};

export const SECTION_NAMES = Object.keys(SETTINGS_SECTIONS);

/**
 * Catalogue — clé plateforme complète → métadonnées.
 * `secret: true` : la valeur est chiffrée en base, masquée à la lecture et
 * jamais renvoyée en clair après enregistrement (RG-M3-3) ; la rotation se
 * fait en saisissant une nouvelle valeur.
 */
export const SETTINGS_CATALOG = {
  // ── platform (palier 1) ────────────────────────────────────────────────
  'platform.name': {
    section: 'platform', type: 'string', default: 'AGRIKONNECT AFRICA',
    min: 2, max: 60, requiresRestart: false,
    description: 'Nom public de la plateforme',
  },
  'platform.activeCountries': {
    section: 'platform', type: 'stringArray', default: ['CD'],
    requiresRestart: false,
    description: 'Pays actifs (codes ISO 2 lettres)',
  },
  'platform.languages': {
    section: 'platform', type: 'stringArray', default: ['fr'],
    requiresRestart: false,
    description: 'Langues disponibles',
  },
  'platform.maintenance': {
    section: 'platform', type: 'boolean', default: false,
    requiresRestart: false,
    description: 'Mode maintenance : mutations métier refusées hors admin (RG-M3-4)',
  },

  // ── security (palier 2, RG-M3-2) ──────────────────────────────────────
  'security.mfaRequiredForGovernance': {
    section: 'security', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Second facteur exigé pour la gouvernance (RG-G1)',
  },
  'security.lockoutMinutes': {
    section: 'security', type: 'integer', default: 15, min: 1, max: 1440,
    requiresRestart: false,
    description: 'Durée de verrouillage après échecs de connexion',
  },
  'security.sessionTtlHours': {
    section: 'security', type: 'integer', default: 12, min: 1, max: 720,
    requiresRestart: true,
    description: 'Durée de vie d\'une session',
  },
  'security.passwordMinLength': {
    section: 'security', type: 'integer', default: 8, min: 6, max: 64,
    requiresRestart: true,
    description: 'Longueur minimale des mots de passe',
  },
  'security.passwordRequireSpecial': {
    section: 'security', type: 'boolean', default: true,
    requiresRestart: true,
    description: 'Caractère spécial exigé dans les mots de passe',
  },

  // ── modules (palier 1) — effets réels via settingsEffects (AC-M3) ─────
  'modules.market': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module marché (offres, demandes, commandes)',
  },
  'modules.transport': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module transport',
  },
  'modules.investissement': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module investissement (projets, data room, financement)',
  },
  'modules.iot': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module IoT (capteurs)',
  },
  'modules.satellite': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module satellite',
  },
  'modules.sms': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module SMS',
  },
  'modules.ia': {
    section: 'modules', type: 'boolean', default: true,
    requiresRestart: false,
    description: 'Module intelligence artificielle',
  },

  // ── limits (palier 1) ─────────────────────────────────────────────────
  'limits.apiQuotaPerDay': {
    section: 'limits', type: 'integer', default: 10000, min: 100, max: 1000000,
    requiresRestart: false,
    description: 'Quota API par jour et par client',
  },
  'limits.maxUploadMb': {
    section: 'limits', type: 'integer', default: 64, min: 1, max: 1024,
    requiresRestart: false,
    description: 'Taille maximale d\'un fichier téléversé (Mo)',
  },
  'limits.retentionDays': {
    section: 'limits', type: 'integer', default: 365, min: 7, max: 3650,
    requiresRestart: false,
    description: 'Durée de conservation des journaux (jours)',
  },
  'limits.exportMaxRows': {
    section: 'limits', type: 'integer', default: 10000, min: 100, max: 100000,
    requiresRestart: false,
    description: 'Nombre maximal de lignes d\'un export',
  },

  // ── integrations (palier 2, RG-M3-2/3) ────────────────────────────────
  'integrations.smsProvider': {
    section: 'integrations', type: 'enum', enum: ['console', 'twilio'],
    default: 'console', requiresRestart: true,
    description: 'Fournisseur SMS',
  },
  'integrations.emailProvider': {
    section: 'integrations', type: 'enum', enum: ['console', 'resend', 'sendgrid'],
    default: 'console', requiresRestart: true,
    description: 'Fournisseur e-mail',
  },
  'integrations.smsSenderId': {
    section: 'integrations', type: 'string', default: '', min: 0, max: 11,
    requiresRestart: true,
    description: 'Identifiant d\'expéditeur SMS (11 caractères ASCII max)',
  },
  'integrations.smsAuthToken': {
    section: 'integrations', type: 'secret', default: null, secret: true,
    requiresRestart: true,
    description: 'Jeton d\'authentification SMS (stocké chiffré, jamais affiché)',
  },
  'integrations.emailApiKey': {
    section: 'integrations', type: 'secret', default: null, secret: true,
    requiresRestart: true,
    description: 'Clé d\'API e-mail (stockée chiffrée, jamais affichée)',
  },
  'integrations.satelliteProvider': {
    section: 'integrations', type: 'string', default: '', min: 0, max: 40,
    requiresRestart: true,
    description: 'Fournisseur d\'imagerie satellite',
  },
};

export const CATALOG_KEYS = Object.keys(SETTINGS_CATALOG);
export const SECRET_KEYS = CATALOG_KEYS.filter((k) => SETTINGS_CATALOG[k].secret === true);

/** Tier effectif d'une clé (RG-M3-2) : celui de sa section. */
export const tierOfKey = (key) => SETTINGS_SECTIONS[SETTINGS_CATALOG[key]?.section]?.tier ?? 1;

/** Schéma Zod d'une valeur, dérivé des métadonnées du catalogue. */
export const settingValueSchema = (key) => {
  const entry = SETTINGS_CATALOG[key];
  if (!entry) return null;
  switch (entry.type) {
    case 'boolean':
      return z.boolean();
    case 'integer':
      return z.number().int().min(entry.min).max(entry.max);
    case 'enum':
      return z.enum(entry.enum);
    case 'string':
      return z.string().trim().min(entry.min ?? 0).max(entry.max ?? 200);
    case 'secret':
      return z.string().min(1).max(400);
    case 'stringArray':
      return z
        .array(z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Valeur alphanumérique attendue'))
        .min(1)
        .max(40);
    default:
      return z.unknown();
  }
};

const keySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*\.[a-zA-Z0-9]+$/, 'Clé de paramètre invalide (section.nom)')
  .max(60);

/**
 * Mise à jour — deux formes acceptées (compatibilité incluse) :
 *  - ancienne : `{ key, value }` (utilisée par les pages existantes) ;
 *  - M3 : `{ section, values: { 'section.nom': valeur, … } }`.
 * La validation de chaque valeur (type + plage) est faite par section dans le
 * service via `settingValueSchema` (RG-M3-1 : refus hors plage).
 */
export const settingsUpdateSchema = z.union([
  z.object({ key: keySchema, value: z.unknown() }),
  z.object({
    section: z.enum(SECTION_NAMES),
    values: z
      .record(z.string(), z.unknown())
      .refine((v) => Object.keys(v).length > 0, 'Aucune valeur fournie'),
  }),
]);

export const settingsHistoryQuerySchema = z.object({
  key: keySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const settingKeyParam = z.object({ key: keySchema });

// ─── Feature flags par zone (GET/PUT /admin/flags, palier 2) ─────────────────

export const flagsQuerySchema = z.object({
  scope: z.string().trim().max(40).optional(),
  scopeValue: z.string().trim().max(60).optional(),
});

export const flagsUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().regex(/^[a-z0-9][a-z0-9_.-]{1,60}$/, 'Clé de flag invalide'),
        scope: z.string().trim().min(2).max(40),
        scopeValue: z.string().trim().min(1).max(60),
        enabled: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(50),
});
