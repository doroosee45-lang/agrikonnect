/**
 * Routes d'administration du référentiel agronomique.
 *
 * Montées sur `/agronomic-ranges`. Écriture et validation réservées à
 * l'agronome et aux administrateurs (`agronomicRanges.write` /
 * `agronomicRanges.validate`) : une plage validée fait sortir les
 * recommandations du régime « indicatif », c'est un acte engageant.
 *
 * Toute écriture est auditée.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './agronomicRanges.service.js';
import {
  PHYSICAL_BOUNDS,
  RANGE_KEYS,
  RANGE_LABELS,
  RANGE_UNITS,
} from './agronomicRanges.js';
import { PARAMETER_LABELS, SOURCE_TYPE_LABELS, SOURCE_TYPES } from './agronomicRangesCsv.js';

const PARAMETER_KEYS = Object.values(RANGE_KEYS);
const idParam = z.object({ id: z.string().min(10).max(60) });

const listQuery = z.object({
  cropSlug: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['PROVISIONAL', 'VALIDATED', 'RETIRED']).optional(),
  datasetLabel: z.string().trim().min(1).max(40).optional(),
});

/**
 * Borne d'une plage. Les limites physiques sont appliquées par paramètre dans
 * le service ; le schéma borne seulement l'ordre de grandeur pour rejeter tôt
 * un fichier manifestement corrompu.
 */
const boundValue = z.coerce.number().min(-100).max(10_000);

const createSchema = z.object({
  cropSlug: z.string().trim().min(1).max(80),
  parameterKey: z.enum(PARAMETER_KEYS),
  minValue: boundValue,
  maxValue: boundValue,
  unit: z.string().trim().min(1).max(20),
  status: z.enum(['PROVISIONAL', 'VALIDATED']).default('PROVISIONAL'),
  /** Nom scientifique de la culture, à titre documentaire. */
  scientificName: z.string().trim().min(1).max(160).optional(),
  /**
   * Borne basse de la plage tolérée, plus large que l'idéal. Facultative : si
   * elle n'est pas renseignée, aucune limite n'est inventée et le verdict reste
   * binaire.
   */
  toleratedMin: boundValue.nullable().optional(),
  /** Borne haute de la plage tolérée. Même règle que `toleratedMin`. */
  toleratedMax: boundValue.nullable().optional(),
  /** Nature de la provenance : agronome, publication ou pilote. */
  sourceType: z.enum(['AGRONOMIST', 'PUBLICATION', 'PILOT']).nullable().optional(),
  /** Source citable de la fourchette. */
  sourceReference: z.string().trim().min(1).max(300).optional(),
  /**
   * Précision sur la nature de la valeur. Obligatoire en l'absence de
   * `sourceReference`, et indispensable pour une température issue d'un
   * référentiel générique : il s'agit de la température de l'AIR, pas de celle
   * du sol.
   */
  sourceNote: z.string().trim().min(1).max(2000).optional(),
  /** Zone concernée par la fourchette (province, bassin, type de sol…). */
  zone: z.string().trim().min(1).max(160).optional(),
  /** Lot : `production` par défaut. Un lot de test ne doit jamais y être écrit. */
  datasetLabel: z.string().trim().min(1).max(40).default('production'),
  /** `null` = référentiel plateforme ; sinon référentiel d'une organisation. */
  organizationId: z.string().min(10).max(60).nullable().optional(),
  validatedBy: z.string().trim().min(2).max(200).optional(),
  validatedAt: z.coerce.date().optional(),
});

const updateSchema = z
  .object({
    parameterKey: z.enum(PARAMETER_KEYS).optional(),
    minValue: boundValue.optional(),
    maxValue: boundValue.optional(),
    toleratedMin: boundValue.nullable().optional(),
    toleratedMax: boundValue.nullable().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    scientificName: z.string().trim().min(1).max(160).nullable().optional(),
    sourceType: z.enum(['AGRONOMIST', 'PUBLICATION', 'PILOT']).nullable().optional(),
    sourceReference: z.string().trim().min(1).max(300).nullable().optional(),
    sourceNote: z.string().trim().min(1).max(2000).nullable().optional(),
    zone: z.string().trim().min(1).max(160).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Aucun champ à modifier',
  });

const validateSchema = z.object({
  /** Nom du validateur : sans lui, « VALIDATED » ne voudrait rien dire. */
  validatedBy: z.string().trim().min(2).max(200),
  validatedAt: z.coerce.date().optional(),
  sourceReference: z.string().trim().min(1).max(300).optional(),
});

/**
 * Import CSV.
 *
 * Le contenu est borné (2 Mo) pour rejeter tôt un fichier manifestement hors
 * propos : un référentiel de quelques centaines de cultures tient très
 * largement en dessous.
 */
const importSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  /** Calcule le résultat sans rien écrire. */
  dryRun: z.boolean().default(false),
  /**
   * Lot appliqué à toutes les lignes. Le tableau « Plages agronomiques » ne
   * comporte pas de colonne de lot : celui-ci vient de l'appel ou de la
   * configuration d'environnement, jamais du fichier.
   */
  datasetLabel: z.string().trim().min(1).max(40).optional(),
  organizationId: z.string().min(10).max(60).nullable().optional(),
  /** Source appliquée aux lignes qui n'en portent pas. */
  defaultSourceReference: z.string().trim().min(1).max(300).nullable().optional(),
  defaultSourceNote: z.string().trim().min(1).max(2000).nullable().optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

// GET /agronomic-ranges — lecture du référentiel (filtrable).
router.get(
  '/',
  authorize('ranges.read'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.listRanges(req.query))),
);

// GET /agronomic-ranges/meta — clés, libellés, unités et bornes physiques.
// Utile aux écrans d'administration pour ne pas proposer une saisie invalide,
// et pour afficher les libellés français du tableau de référence.
router.get(
  '/meta',
  authorize('ranges.read'),
  asyncHandler(async (_req, res) =>
    success(res, {
      parameters: PARAMETER_KEYS.map((key) => ({
        key,
        // Libellé français du tableau « Plages agronomiques » : c'est celui que
        // l'agronome reconnaît, la clé technique ne lui parle pas.
        label: RANGE_LABELS[key] ?? key,
        // Libellés acceptés à l'import CSV, en plus de la clé technique.
        acceptedLabels: PARAMETER_LABELS[key] ?? [],
        unit: RANGE_UNITS[key] ?? null,
        bounds: PHYSICAL_BOUNDS[key] ?? null,
      })),
      physicalBounds: PHYSICAL_BOUNDS,
      /** Menu « Type de source ». « A choisir » n'y figure pas : c'est le vide. */
      sourceTypes: SOURCE_TYPES.map((value) => ({ value, label: SOURCE_TYPE_LABELS[value] })),
      statuses: ['PROVISIONAL', 'VALIDATED', 'RETIRED'],
    }),
  ),
);

/**
 * GET /agronomic-ranges/import/template — format attendu du CSV.
 *
 * Déclaré avant `/:id` pour ne pas être capturé par le paramètre : sans cet
 * ordre, « import » serait interprété comme un identifiant de plage.
 */
router.get(
  '/import/template',
  authorize('ranges.read'),
  asyncHandler(async (_req, res) =>
    success(res, {
      header: service.IMPORT_HEADER,
      example: service.IMPORT_EXAMPLE,
      columns: service.IMPORT_COLUMNS,
      parameters: PARAMETER_KEYS,
      physicalBounds: PHYSICAL_BOUNDS,
      csv: service.buildTemplateCsv(),
      notes: [
        'Une ligne par culture et par paramètre.',
        'Séparateur « ; », « , » ou tabulation ; les guillemets doubles sont gérés.',
        'Les en-têtes peuvent être en français ou en anglais, sans tenir compte de la casse ni des accents.',
        '« source » ou « note » est obligatoire sur chaque ligne : aucune valeur sans provenance.',
        'Une plage déjà VALIDATED n’est jamais écrasée par un import.',
        'Une ligne déclarée VALIDATED sans plage existante validée retombe en PROVISIONAL.',
      ],
    }),
  ),
);

/**
 * POST /agronomic-ranges/import — import en lot depuis un CSV.
 *
 * Chaque ligne est validée individuellement : une ligne invalide est rapportée
 * avec son numéro et sa raison, les autres sont traitées. `dryRun: true`
 * calcule tout sans rien écrire.
 */
router.post(
  '/import',
  authorize('ranges.write'),
  validate(importSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.importRanges(req.body, req), {
      message: req.body.dryRun ? 'Import simulé' : 'Import appliqué',
    }),
  ),
);

// GET /agronomic-ranges/:id
router.get(
  '/:id',
  authorize('ranges.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getRange(req.params.id))),
);

// POST /agronomic-ranges — création (admin / agronome).
router.post(
  '/',
  authorize('ranges.write'),
  validate(createSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.createRange(req.body, req), { message: 'Plage enregistrée' }),
  ),
);

// PATCH /agronomic-ranges/:id — modification. Une plage validée modifiée
// redevient provisoire : la validation portait sur les anciennes bornes.
router.patch(
  '/:id',
  authorize('ranges.write'),
  validate(idParam, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.updateRange(req.params.id, req.body, req), {
      message: 'Plage mise à jour',
    }),
  ),
);

/**
 * POST /agronomic-ranges/:id/validate — validation par un agronome.
 *
 * C'est l'acte qui fait sortir les recommandations du régime « indicatif » :
 * il exige un validateur nommé et une source citable.
 */
router.post(
  '/:id/validate',
  authorize('ranges.validate'),
  validate(idParam, 'params'),
  validate(validateSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.validateRange(req.params.id, req.body, req), {
      message: 'Plage validée',
    }),
  ),
);

// POST /agronomic-ranges/:id/retire — retrait sans effacement de l'historique.
router.post(
  '/:id/retire',
  authorize('ranges.write'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.retireRange(req.params.id, req), { message: 'Plage retirée' }),
  ),
);

export default router;
