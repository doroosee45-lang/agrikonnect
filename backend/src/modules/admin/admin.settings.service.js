import { randomUUID, createHash, randomBytes, createCipheriv } from 'node:crypto';

import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';
import { can } from '../../shared/permissions.js';
import {
  SETTINGS_SECTIONS,
  SETTINGS_CATALOG,
  CATALOG_KEYS,
  SECRET_KEYS,
  tierOfKey,
  settingValueSchema,
} from './admin.settings.schema.js';

/**
 * SPEC-SUPER-ADMIN M3 — service des paramètres globaux (palette de fonctions).
 *
 * Le catalogue (`admin.settings.schema.js`) ne contient **que** des données ;
 * toute la mécanique vit ici :
 *
 *  - lecture : vue par sections (documentée) + surface de compatibilité
 *    `values` (le front M2 lit `values[key]`) + exposition de
 *    `platform.maintenance` (RG-M3-4, voir plus bas) ;
 *  - écriture : forme historique `{ key, value }` **et** forme par sections
 *    `{ section, values }` (clés complètes), validation Zod par clé, journal
 *    `setting_revisions` (avant → après) + `audit_logs` ;
 *  - palier 2 : `security.*` et `integrations.*` (RG-M3-2) ;
 *  - secrets : chiffrés AES-256-GCM au repos (RG-M3-3), jamais réaffichés,
 *    toute révision les concernant stockée masquée ;
 *  - historique paginé, réinitialisation à la valeur par défaut ;
 *  - feature flags par zone (`zone_feature_flags`, palier 2) ;
 *  - cache de lecture 60 s + invalidation du cache d'effets 15 s
 *    (`middleware/settingsEffects.js`) à chaque écriture.
 *
 * Conventions de persistance (schéma Prisma réel) :
 *  - `settings` : `key` (PK), `value` (Json — scalaire JSON, y compris les
 *    secrets : leur texte chiffré), `updated_by` ;
 *  - `setting_revisions` : `previous_value` / `new_value` (Json?) — pour un
 *    secret, `{ masked: true }` est stocké, jamais le texte chiffré ;
 *  - `zone_feature_flags` : `key` (ex. `modules.market`), `scope`
 *    (`COUNTRY`…), `scope_value` (code pays…), `enabled`, `reason`
 *    (justification), `updated_by` — l'`id` est fourni par l'application.
 *
 * RG-M3-4 — **compatibilité rétablie** : la clé historique
 * `platform.maintenance` n'a jamais existé en base (l'ancien `updateSetting`
 * l'écrivait dans `settings` mais rien ne la lisait). Le paramètre est
 * désormais réel : catalogue + stockage + exposition dans la vue, et appliqué
 * par `middleware/settingsEffects.js`.
 */

// ─────────────────────────── Chiffrement des secrets ───────────────────────

const SECRET_MASK = '••••••••';
const estSecret = (key) => SETTINGS_CATALOG[key]?.secret === true;

const secretKey = () => {
  const brut = process.env.SETTINGS_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!brut) {
    throw ApiError.internal('Aucune clé de chiffrement disponible (SETTINGS_SECRET_KEY)');
  }
  return createHash('sha256').update(String(brut)).digest();
};

const chiffrer = (secret) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const chiffre = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), chiffre]).toString('base64')}`;
};

// ─────────────────────────── Cache ─────────────────────────────────────────

const TTL_LECTURE_MS = 60_000;
let lectureCache = null;
let lectureAt = 0;

const memoLecture = async (clee, calcul) => {
  const maintenant = Date.now();
  if (lectureCache?.clee === clee && maintenant - lectureAt < TTL_LECTURE_MS) {
    return lectureCache.valeur;
  }
  const valeur = await calcul();
  lectureCache = { clee, valeur };
  lectureAt = maintenant;
  return valeur;
};

/** Invalide le cache de lecture **et** le cache d'effets du middleware. */
export const invalidateSettingsCache = async () => {
  lectureCache = null;
  try {
    const mod = await import('../../middleware/settingsEffects.js');
    mod.invalidateSettingsCache();
  } catch {
    /* middleware non monté (tests isolés) : sans objet */
  }
};

// ─────────────────────────── Lecture : la vue ──────────────────────────────

const formes = (key, brut) => (estSecret(key) ? SECRET_MASK : brut);

export const getSettingsView = () =>
  memoLecture('view', async () => {
    const lignes = await prisma.setting.findMany();
    const parCle = Object.fromEntries(lignes.map((l) => [l.key, l.value]));

    const values = {};
    for (const key of CATALOG_KEYS) {
      const brut = Object.hasOwn(parCle, key) ? parCle[key] : SETTINGS_CATALOG[key].default;
      values[key] = formes(key, brut);
    }

    const sections = Object.fromEntries(
      Object.entries(SETTINGS_SECTIONS).map(([section, meta]) => [
        section,
        {
          label: meta.label,
          tier: meta.tier,
          settings: Object.fromEntries(
            CATALOG_KEYS.filter((k) => SETTINGS_CATALOG[k].section === section).map((k) => [
              k,
              {
                type: SETTINGS_CATALOG[k].type,
                default: SETTINGS_CATALOG[k].default,
                min: SETTINGS_CATALOG[k].min,
                max: SETTINGS_CATALOG[k].max,
                enum: SETTINGS_CATALOG[k].enum,
                description: SETTINGS_CATALOG[k].description,
                requiresRestart: SETTINGS_CATALOG[k].requiresRestart,
                secret: estSecret(k),
              },
            ]),
          ),
          values: Object.fromEntries(
            CATALOG_KEYS.filter((k) => SETTINGS_CATALOG[k].section === section).map((k) => [
              k,
              values[k],
            ]),
          ),
        },
      ]),
    );

    return {
      sections,
      values,
      maintenance: values['platform.maintenance'] === true,
      updatedAt: lignes.length
        ? lignes.reduce((acc, l) => (l.updatedAt > acc ? l.updatedAt : acc), lignes[0].updatedAt)
        : null,
    };
  });

// ─────────────────────────── Écriture ─────────────────────────────────────

const exigerPermission = (req) => {
  if (!can(req?.user?.roles ?? [], 'admin.settings')) {
    throw ApiError.forbidden("Cette action exige la permission d'administration `admin.settings`");
  }
};

const recordRevision = async (key, avant, apres, req) => {
  await prisma.settingRevision.create({
    data: {
      key,
      previousValue: estSecret(key) ? { masked: true } : (avant ?? null),
      newValue: estSecret(key) ? { masked: true } : (apres ?? null),
      changedBy: req?.user?.id ?? null,
    },
  });
};

/**
 * Écrit une clé : forme historique `{ key, value }` ou forme par sections
 * `{ section, values: { 'section.nom': valeur, … } }` — avec validation,
 * palier 2, révision et audit (RG-M3-1/2/3).
 */
export const updateSettings = async (payload, req) => {
  exigerPermission(req);

  // ── Forme historique : { key, value } ──
  if (payload && typeof payload === 'object' && typeof payload.key === 'string') {
    await ecrireCle(payload.key, payload.value, req);
    return getSettingsView();
  }

  // ── Forme par sections : { section, values: { 'section.nom': … } } ──
  const { section, values } = payload ?? {};
  if (!SETTINGS_SECTIONS[section] || !values || typeof values !== 'object') {
    throw ApiError.badRequest('Format attendu : `{ key, value }` ou `{ section, values }`');
  }
  for (const [key, valeur] of Object.entries(values)) {
    const entry = SETTINGS_CATALOG[key];
    if (!entry) throw ApiError.notFound(`Paramètre inconnu : « ${key} »`);
    if (entry.section !== section) {
      throw ApiError.badRequest(`Le paramètre « ${key} » n'appartient pas à la section « ${section} »`);
    }
    await ecrireCle(key, valeur, req);
  }
  return getSettingsView();
};

const ecrireCle = async (key, valeur, req) => {
  const entry = SETTINGS_CATALOG[key];
  if (!entry) throw ApiError.notFound(`Paramètre inconnu : « ${key} »`);

  if (tierOfKey(key) >= 2 && !(req?.user?.roles ?? []).includes('SUPER_ADMIN')) {
    // Palier 2 (RG-M3-2) : SUPER_ADMIN seul (garde MFA posée par la route).
    throw ApiError.forbidden(`Le paramètre « ${key} » est réservé aux SUPER_ADMIN`, {
      code: 'mfa_required',
      requires: 'super_admin',
    });
  }

  const zod = settingValueSchema(key);
  const valide = zod.safeParse(valeur);
  if (!valide.success) {
    throw ApiError.badRequest(
      `Valeur hors plage pour « ${key} » : ${valide.error.issues.map((i) => i.message).join(' ; ')}`,
      valide.error.issues,
    );
  }

  const existant = await prisma.setting.findUnique({ where: { key } });
  const avant = existant ? formes(key, existant.value) : entry.default;
  const stocke = estSecret(key) ? chiffrer(valide.data) : valide.data;
  const apres = formes(key, stocke);

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: stocke, updatedBy: req?.user?.id ?? null },
    update: { value: stocke, updatedBy: req?.user?.id ?? null },
  });
  await recordRevision(key, avant, apres, req);
  await auditAs(req, {
    action: 'admin.setting.update',
    resource: 'settings',
    resourceId: key,
    oldValue: { [key]: avant },
    newValue: { [key]: apres },
  });
  await invalidateSettingsCache();
};

// ─────────────────────────── Historique ───────────────────────────────────

export const settingsHistory = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const where = query.key ? { key: query.key } : {};
  const [items, total] = await Promise.all([
    prisma.settingRevision.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.settingRevision.count({ where }),
  ]);
  // Défense en profondeur : toute révision d'un secret reste masquée.
  const safeItems = items.map((r) =>
    SECRET_KEYS.includes(r.key)
      ? { ...r, previousValue: { masked: true }, newValue: { masked: true } }
      : r,
  );
  return { items: safeItems, total, page, limit };
};

// ─────────────────────────── Réinitialisation ─────────────────────────────

export const resetSetting = async (key, req) => {
  exigerPermission(req);
  const entry = SETTINGS_CATALOG[key];
  if (!entry) throw ApiError.notFound(`Paramètre inconnu : « ${key} »`);

  const existant = await prisma.setting.findUnique({ where: { key } });
  const avant = existant ? formes(key, existant.value) : entry.default;

  await prisma.setting.delete({ where: { key } }).catch(() => undefined);
  await recordRevision(key, avant, entry.default, req);
  await auditAs(req, {
    action: 'admin.setting.reset',
    resource: 'settings',
    resourceId: key,
    oldValue: { [key]: avant },
    newValue: { [key]: entry.default },
  });
  await invalidateSettingsCache();
  return { key, value: entry.default };
};

// ─────────────────────────── Feature flags par zone ──────────────────────

const flagView = (ligne) => ({
  id: ligne.id,
  key: ligne.key,
  scope: ligne.scope,
  scopeValue: ligne.scopeValue,
  enabled: ligne.enabled,
  reason: ligne.reason ?? null,
  updatedBy: ligne.updatedBy ?? null,
  updatedAt: ligne.updatedAt,
});

export const getZoneFlags = async (query = {}) => {
  const where = {};
  if (query.scope) where.scope = query.scope;
  if (query.scopeValue) where.scopeValue = query.scopeValue;
  const lignes = await prisma.zoneFeatureFlag.findMany({
    where,
    orderBy: [{ scope: 'asc' }, { scopeValue: 'asc' }, { key: 'asc' }],
  });
  return { items: lignes.map(flagView), total: lignes.length };
};

/** Mise à jour par lot (≤ 50 drapeaux) — palier 2, justification au choix. */
export const updateZoneFlags = async (payload, req) => {
  if (!can(req?.user?.roles ?? [], 'admin.flags')) {
    throw ApiError.forbidden('Les feature flags sont réservés aux SUPER_ADMIN');
  }
  const items = payload?.items ?? [];
  const ecrits = [];
  for (const item of items) {
    const { key, scope, scopeValue, enabled, reason } = item;
    const ligne = await prisma.zoneFeatureFlag.findFirst({ where: { key, scope, scopeValue } });
    const ecrite = ligne
      ? await prisma.zoneFeatureFlag.update({
          where: { id: ligne.id },
          data: { enabled, reason: reason ?? ligne.reason ?? null, updatedBy: req?.user?.id ?? null },
        })
      : await prisma.zoneFeatureFlag.create({
          data: {
            id: randomUUID(),
            key,
            scope,
            scopeValue,
            enabled,
            reason: reason ?? null,
            updatedBy: req?.user?.id ?? null,
          },
        });
    await auditAs(req, {
      action: 'admin.flag.update',
      resource: 'zone_feature_flags',
      resourceId: ecrite.id,
      oldValue: ligne ? flagView(ligne) : null,
      newValue: flagView(ecrite),
    });
    ecrits.push(flagView(ecrite));
  }
  await invalidateSettingsCache();
  return { items: ecrits, total: ecrits.length };
};
