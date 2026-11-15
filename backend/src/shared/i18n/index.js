/**
 * Exigences CDC couvertes : I18N-01.
 *
 * Internationalisation des réponses de l'API.
 *
 * ## Stratégie
 *
 * - Le **français reste la langue source et la langue par défaut** : les
 *   messages sont écrits en français dans le code (ApiError, Zod, messages de
 *   succès, notifications). Aucun appelant n'a été réécrit.
 * - La traduction est appliquée **en sortie**, à partir d'un catalogue
 *   (`messages.en.js`) indexé par le texte français. Les messages construits
 *   par gabarit (`Parcelle ${id} introuvable`) sont reconnus par motif : les
 *   segments variables sont capturés puis réinjectés dans la traduction.
 * - La langue d'une requête vient de `Accept-Language` (en-tête envoyé par le
 *   web et le mobile), avec repli sur le français. Une notification utilise la
 *   langue enregistrée sur le profil du **destinataire** (`Profile.locale`).
 * - Un message absent du catalogue est renvoyé en français : jamais une clé
 *   technique, jamais une chaîne vide.
 *
 * Langues prises en charge : fr, en (CDC I18N-01 mentionne aussi `pt` : non
 * livré à ce stade, voir docs/I18N.md).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { ZodIssueCode, defaultErrorMap } from 'zod';

import { MESSAGES_EN } from './messages.en.js';

export const SUPPORTED_LOCALES = Object.freeze(['fr', 'en']);
export const DEFAULT_LOCALE = 'fr';

const storage = new AsyncLocalStorage();

/** Normalise une langue quelconque (« en-GB », « FR ») vers une langue prise en charge. */
export const normalizeLocale = (value) => {
  if (!value || typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(base) ? base : null;
};

/**
 * Langue préférée d'un en-tête `Accept-Language` (RFC 9110 §12.5.4).
 * Exemple : « en-GB,en;q=0.9,fr;q=0.8 » → « en ».
 */
export const parseAcceptLanguage = (header) => {
  if (!header || typeof header !== 'string') return DEFAULT_LOCALE;
  const candidates = header
    .split(',')
    .map((part, index) => {
      const [tag, ...attrs] = part.trim().split(';');
      const q = attrs.map((a) => a.trim()).find((a) => a.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { locale: normalizeLocale(tag), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((c) => c.locale && c.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return candidates[0]?.locale ?? DEFAULT_LOCALE;
};

/** Langue de la requête en cours (contexte asynchrone), sinon la langue par défaut. */
export const currentLocale = () => storage.getStore()?.locale ?? DEFAULT_LOCALE;

/** Exécute `fn` dans un contexte de langue donné (jobs, notifications). */
export const withLocale = (locale, fn) => storage.run({ locale: normalizeLocale(locale) ?? DEFAULT_LOCALE }, fn);

/**
 * Middleware Express : fixe `req.locale`, l'en-tête `Content-Language` et le
 * contexte asynchrone utilisé par `success()` et l'errorHandler.
 */
export const localeMiddleware = (req, res, next) => {
  const locale = parseAcceptLanguage(req.headers?.['accept-language']);
  req.locale = locale;
  res.setHeader('Content-Language', locale);
  storage.run({ locale }, next);
};

// ─── catalogue ──────────────────────────────────────────────────────────────

const CATALOGS = { en: { exact: new Map(), patterns: [] } };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const [fr, en, params = []] of MESSAGES_EN) {
  const catalog = CATALOGS.en;
  if (!params.length) {
    catalog.exact.set(fr, en);
    continue;
  }
  // Gabarit : chaque {param} devient un groupe de capture.
  const names = [];
  let source = '';
  let rest = fr;
  const re = new RegExp(`\\{(${params.map(escapeRegex).join('|')})\\}`);
  for (let m = rest.match(re); m; m = rest.match(re)) {
    source += escapeRegex(rest.slice(0, m.index)) + '([\\s\\S]*?)';
    names.push(m[1]);
    rest = rest.slice(m.index + m[0].length);
  }
  source += escapeRegex(rest);
  catalog.patterns.push({ regex: new RegExp(`^${source}$`), names, en, literal: fr });
  // Le gabarit lui-même (cas d'un message non interpolé) reste traduisible.
  catalog.exact.set(fr, en);
}

/**
 * Traduit un message français. `locale` vaut par défaut la langue de la
 * requête en cours. Les valeurs capturées sont elles-mêmes traduites quand
 * elles figurent au catalogue (ex. « Seuil dépassé — pH du sol »).
 */
export const translateMessage = (message, locale = currentLocale()) => {
  if (typeof message !== 'string' || !message) return message;
  const target = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  if (target === DEFAULT_LOCALE) return message;
  const catalog = CATALOGS[target];
  if (!catalog) return message;
  const exact = catalog.exact.get(message);
  if (exact !== undefined) return exact;
  for (const { regex, names, en } of catalog.patterns) {
    const m = message.match(regex);
    if (!m) continue;
    const values = Object.fromEntries(names.map((name, i) => [name, m[i + 1]]));
    return en.replace(/\{(\w+)\}/g, (all, name) => {
      if (!(name in values)) return all;
      const value = values[name];
      return catalog.exact.get(value) ?? value;
    });
  }
  return message;
};

// ─── messages Zod par défaut ──────────────────────────────────────────────────

/**
 * Messages des règles Zod sans message personnalisé. Zod 3 les produit en
 * anglais : un utilisateur francophone voyait donc « Required » ou « Invalid
 * email » à côté de messages français. Ils sont désormais rendus dans la langue
 * de la requête.
 */
const ZOD_DEFAULTS = {
  fr: {
    required: 'Champ obligatoire',
    invalidType: (expected) => `Type invalide : ${expected} attendu`,
    invalidEmail: 'Adresse e-mail invalide',
    invalidUrl: 'URL invalide',
    invalidUuid: 'Identifiant invalide',
    invalidString: 'Format invalide',
    invalidDate: 'Date invalide',
    tooSmallString: (min, exact) => (exact ? `${min} caractère(s) exactement` : `${min} caractère(s) minimum`),
    tooBigString: (max, exact) => (exact ? `${max} caractère(s) exactement` : `${max} caractère(s) maximum`),
    tooSmallNumber: (min, inclusive) => (inclusive ? `Valeur minimale : ${min}` : `Doit être supérieur à ${min}`),
    tooBigNumber: (max, inclusive) => (inclusive ? `Valeur maximale : ${max}` : `Doit être inférieur à ${max}`),
    tooSmallArray: (min) => `${min} élément(s) minimum`,
    tooBigArray: (max) => `${max} élément(s) maximum`,
    invalidEnum: (options) => `Valeur invalide. Valeurs acceptées : ${options}`,
    unrecognizedKeys: (keys) => `Champ(s) non reconnu(s) : ${keys}`,
    notMultipleOf: (n) => `Doit être un multiple de ${n}`,
    notFinite: 'Nombre fini attendu',
    invalidLiteral: (expected) => `Valeur attendue : ${expected}`,
    fallback: 'Valeur invalide',
  },
  en: {
    required: 'Required field',
    invalidType: (expected) => `Invalid type: ${expected} expected`,
    invalidEmail: 'Invalid email address',
    invalidUrl: 'Invalid URL',
    invalidUuid: 'Invalid identifier',
    invalidString: 'Invalid format',
    invalidDate: 'Invalid date',
    tooSmallString: (min, exact) => (exact ? `Exactly ${min} character(s)` : `At least ${min} character(s)`),
    tooBigString: (max, exact) => (exact ? `Exactly ${max} character(s)` : `At most ${max} character(s)`),
    tooSmallNumber: (min, inclusive) => (inclusive ? `Minimum value: ${min}` : `Must be greater than ${min}`),
    tooBigNumber: (max, inclusive) => (inclusive ? `Maximum value: ${max}` : `Must be less than ${max}`),
    tooSmallArray: (min) => `At least ${min} item(s)`,
    tooBigArray: (max) => `At most ${max} item(s)`,
    invalidEnum: (options) => `Invalid value. Accepted values: ${options}`,
    unrecognizedKeys: (keys) => `Unrecognised field(s): ${keys}`,
    notMultipleOf: (n) => `Must be a multiple of ${n}`,
    notFinite: 'Finite number expected',
    invalidLiteral: (expected) => `Expected value: ${expected}`,
    fallback: 'Invalid value',
  },
};

/** Message par défaut localisé d'une erreur Zod (sans message personnalisé). */
export const zodDefaultMessage = (issue, locale = currentLocale()) => {
  const d = ZOD_DEFAULTS[normalizeLocale(locale) ?? DEFAULT_LOCALE];
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      return issue.received === 'undefined' ? d.required : d.invalidType(issue.expected);
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return d.invalidEmail;
      if (issue.validation === 'url') return d.invalidUrl;
      if (issue.validation === 'uuid' || issue.validation === 'cuid') return d.invalidUuid;
      return d.invalidString;
    case ZodIssueCode.invalid_date:
      return d.invalidDate;
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return d.tooSmallString(issue.minimum, issue.exact);
      if (issue.type === 'array' || issue.type === 'set') return d.tooSmallArray(issue.minimum);
      return d.tooSmallNumber(issue.minimum, issue.inclusive);
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return d.tooBigString(issue.maximum, issue.exact);
      if (issue.type === 'array' || issue.type === 'set') return d.tooBigArray(issue.maximum);
      return d.tooBigNumber(issue.maximum, issue.inclusive);
    case ZodIssueCode.invalid_enum_value:
      return d.invalidEnum((issue.options ?? []).join(', '));
    case ZodIssueCode.unrecognized_keys:
      return d.unrecognizedKeys((issue.keys ?? []).join(', '));
    case ZodIssueCode.not_multiple_of:
      return d.notMultipleOf(issue.multipleOf);
    case ZodIssueCode.not_finite:
      return d.notFinite;
    case ZodIssueCode.invalid_literal:
      return d.invalidLiteral(JSON.stringify(issue.expected));
    default:
      return d.fallback;
  }
};

/**
 * Message localisé d'une erreur Zod.
 *
 * Un message personnalisé (écrit en français dans le schéma) passe par le
 * catalogue ; un message par défaut de Zod est régénéré dans la langue cible.
 * On reconnaît un message par défaut à ce que Zod le produit lui-même pour
 * le même incident.
 */
export const localizeZodIssue = (issue, locale = currentLocale(), zodDefault = null) => {
  const isDefault = zodDefault !== null && issue.message === zodDefault;
  return isDefault ? zodDefaultMessage(issue, locale) : translateMessage(issue.message, locale);
};

/**
 * Erreurs par champ d'un échec Zod, au format du contrat (CDC A.5).
 *
 * - `field` et `code` sont **inchangés** (rétrocompatibilité : `code` porte
 *   toujours le message produit par le schéma) ;
 * - `message` est **ajouté** : texte lisible dans la langue de la requête.
 *   Les clients l'affichent en priorité.
 */
export const zodIssuesToFieldErrors = (issues, fallbackField = 'body', locale = currentLocale()) =>
  issues.map((issue) => {
    let zodDefault = null;
    try {
      zodDefault = defaultErrorMap(issue, { defaultError: issue.message, data: undefined }).message;
    } catch {
      zodDefault = null;
    }
    return {
      field: issue.path.join('.') || fallbackField,
      code: issue.message,
      message: localizeZodIssue(issue, locale, zodDefault),
    };
  });
