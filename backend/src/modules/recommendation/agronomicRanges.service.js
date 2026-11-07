/**
 * Référentiel agronomique — lecture par le moteur, administration par les rôles
 * habilités.
 *
 * Règles structurantes :
 *  • **Aucune valeur inventée.** Une plage doit citer sa source
 *    (`sourceReference`) ou expliquer son absence (`sourceNote`). Une création
 *    sans l'un des deux est refusée.
 *  • **Bornes physiques vérifiées.** Un import corrompu (pH à 42, température
 *    à 900 °C) est rejeté à l'écriture, pas au calcul.
 *  • **Validation tracée.** Passer une plage en `VALIDATED` exige un validateur
 *    nommé et une date : c'est ce qui distingue une fourchette générique d'une
 *    plage confirmée pour les sols locaux.
 *  • **Lots séparés.** Le moteur ne lit que le lot porté par `AGRONOMIC_DATASET`
 *    (`production`). Un lot `test` ne peut donc jamais influencer la production.
 *  • **Audit systématique** sur chaque écriture.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { env } from '../../config/env.js';
import { PHYSICAL_BOUNDS, RANGE_KEYS, RANGE_LABELS, RANGE_UNITS, toRange } from './agronomicRanges.js';
import {
  IMPORT_HEADER,
  buildTemplateCsv,
  resolveZone,
  parseCsvText,
  readImportRow,
  resolveImportColumns,
} from './agronomicRangesCsv.js';

const PARAMETER_KEYS = Object.values(RANGE_KEYS);

/** Contrôle commun à la création et à la modification. */
const assertCoherent = ({
  parameterKey,
  minValue,
  maxValue,
  toleratedMin,
  toleratedMax,
  unit,
  sourceReference,
  sourceNote,
}) => {
  if (!PARAMETER_KEYS.includes(parameterKey)) {
    throw ApiError.badRequest(
      `Paramètre inconnu : « ${parameterKey} ». Paramètres acceptés : ${PARAMETER_KEYS.join(', ')}.`,
    );
  }
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    throw ApiError.badRequest('Les bornes min et max doivent être numériques');
  }
  if (minValue > maxValue) {
    throw ApiError.badRequest(`Borne minimale (${minValue}) supérieure à la borne maximale (${maxValue})`);
  }

  const bounds = PHYSICAL_BOUNDS[parameterKey];
  if (bounds && (minValue < bounds.min || maxValue > bounds.max)) {
    throw ApiError.badRequest(
      `${RANGE_LABELS[parameterKey]} : les bornes [${minValue} ; ${maxValue}] sortent de la plage `
      + `physiquement plausible [${bounds.min} ; ${bounds.max}] ${RANGE_UNITS[parameterKey]}.`,
    );
  }

  // Bornes tolérées : facultatives, mais quand elles sont renseignées elles
  // doivent être cohérentes. Un toléré plus étroit que l'idéal inverserait le
  // sens du score ; une seule des deux bornes renseignées ne permet pas de
  // calculer quoi que ce soit, donc on la refuse au lieu de la compléter.
  if (toleratedMin !== null && toleratedMin !== undefined) {
    if (!Number.isFinite(toleratedMin)) {
      throw ApiError.badRequest('La borne tolérée minimale doit être numérique');
    }
    if (toleratedMin > minValue) {
      throw ApiError.badRequest(
        `${RANGE_LABELS[parameterKey]} : la borne tolérée minimale (${toleratedMin}) est au-dessus de `
        + `l'idéal minimal (${minValue}) ; elle doit être plus basse.`,
      );
    }
  }
  if (toleratedMax !== null && toleratedMax !== undefined) {
    if (!Number.isFinite(toleratedMax)) {
      throw ApiError.badRequest('La borne tolérée maximale doit être numérique');
    }
    if (toleratedMax < maxValue) {
      throw ApiError.badRequest(
        `${RANGE_LABELS[parameterKey]} : la borne tolérée maximale (${toleratedMax}) est en dessous de `
        + `l'idéal maximal (${maxValue}) ; elle doit être plus haute.`,
      );
    }
  }
  if (toleratedMin !== null && toleratedMax !== null
    && toleratedMin !== undefined && toleratedMax !== undefined
    && toleratedMin > toleratedMax) {
    throw ApiError.badRequest(
      `${RANGE_LABELS[parameterKey]} : la borne tolérée minimale (${toleratedMin}) dépasse la borne `
      + `tolérée maximale (${toleratedMax}).`,
    );
  }
  if (bounds && ((toleratedMin !== null && toleratedMin !== undefined && toleratedMin < bounds.min)
    || (toleratedMax !== null && toleratedMax !== undefined && toleratedMax > bounds.max))) {
    throw ApiError.badRequest(
      `${RANGE_LABELS[parameterKey]} : les bornes tolérées [${toleratedMin} ; ${toleratedMax}] sortent de `
      + `la plage physiquement plausible [${bounds.min} ; ${bounds.max}] ${RANGE_UNITS[parameterKey]}.`,
    );
  }

  const expectedUnit = RANGE_UNITS[parameterKey];
  if (unit !== expectedUnit) {
    throw ApiError.badRequest(
      `Unité incohérente pour ${RANGE_LABELS[parameterKey]} : « ${unit} » fournie, « ${expectedUnit} » attendue.`,
    );
  }

  // Une plage sans source citable ni note explicative n'a aucune valeur
  // probante : on refuse plutôt que d'enregistrer un chiffre anonyme.
  if (!sourceReference && !sourceNote) {
    throw ApiError.badRequest(
      'Une plage exige une source citable (sourceReference) ou, à défaut, une note expliquant '
      + 'son origine et ses limites (sourceNote). Aucune valeur ne peut être enregistrée sans provenance.',
    );
  }
};

/**
 * Plages d'une culture, dans le lot actif.
 *
 * Utilisé par le moteur de recommandation. Une plage propre à l'organisation
 * prime sur la plage plateforme : une coopérative peut avoir fait valider ses
 * propres fourchettes.
 */
export const rangesForCrop = async (cropSlug, { organizationId = null, datasetLabel } = {}) => {
  const label = datasetLabel ?? env.AGRONOMIC_DATASET;
  const rows = await prisma.cropAgronomicRange.findMany({
    where: {
      cropSlug,
      datasetLabel: label,
      status: { not: 'RETIRED' },
      deletedAt: null,
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
  });

  const byKey = new Map();
  for (const row of rows) {
    const existing = byKey.get(row.parameterKey);
    // La plage organisationnelle l'emporte sur la plage plateforme.
    if (!existing || (existing.organizationId === null && row.organizationId !== null)) {
      byKey.set(row.parameterKey, row);
    }
  }

  const ranges = {};
  for (const [key, row] of byKey.entries()) ranges[key] = toRange(row);
  return { cropSlug, datasetLabel: label, ranges };
};

/**
 * Plages de plusieurs cultures en une requête.
 *
 * Le moteur évalue plusieurs candidats par recommandation : les charger un par
 * un multiplierait les allers-retours en base pour rien.
 */
export const rangesForCrops = async (cropSlugs, { organizationId = null, datasetLabel } = {}) => {
  const slugs = [...new Set((cropSlugs ?? []).filter(Boolean))];
  const label = datasetLabel ?? env.AGRONOMIC_DATASET;
  if (slugs.length === 0) return { datasetLabel: label, byCrop: {} };

  const rows = await prisma.cropAgronomicRange.findMany({
    where: {
      cropSlug: { in: slugs },
      datasetLabel: label,
      status: { not: 'RETIRED' },
      deletedAt: null,
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
  });

  const byCrop = {};
  for (const row of rows) {
    const bucket = (byCrop[row.cropSlug] ??= {});
    const existing = bucket[row.parameterKey];
    // La plage organisationnelle l'emporte sur la plage plateforme.
    if (!existing || (existing.organizationId === null && row.organizationId !== null)) {
      bucket[row.parameterKey] = row;
    }
  }

  return {
    datasetLabel: label,
    byCrop: Object.fromEntries(
      Object.entries(byCrop).map(([slug, rowsByKey]) => [
        slug,
        Object.fromEntries(Object.entries(rowsByKey).map(([key, row]) => [key, toRange(row)])),
      ]),
    ),
  };
};

/** Liste filtrée, pour l'écran d'administration. */
export const listRanges = async (query = {}) => {
  const where = {
    deletedAt: null,
    ...(query.cropSlug ? { cropSlug: query.cropSlug } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.datasetLabel ? { datasetLabel: query.datasetLabel } : {}),
  };
  const items = await prisma.cropAgronomicRange.findMany({
    where,
    orderBy: [{ cropSlug: 'asc' }, { parameterKey: 'asc' }],
    take: 500,
  });
  return { items, count: items.length };
};

export const getRange = async (id) => {
  const range = await prisma.cropAgronomicRange.findFirst({ where: { id, deletedAt: null } });
  if (!range) throw ApiError.notFound('Plage agronomique introuvable');
  return range;
};

export const createRange = async (payload, req) => {
  assertCoherent(payload);

  const existing = await prisma.cropAgronomicRange.findFirst({
    where: {
      cropSlug: payload.cropSlug,
      parameterKey: payload.parameterKey,
      datasetLabel: payload.datasetLabel ?? 'production',
      organizationId: payload.organizationId ?? null,
      deletedAt: null,
    },
  });
  if (existing) {
    throw ApiError.conflict(
      `Une plage existe déjà pour ${payload.cropSlug} / ${payload.parameterKey} dans ce lot.`,
      { existingId: existing.id },
    );
  }

  const status = payload.status === 'VALIDATED' ? 'VALIDATED' : 'PROVISIONAL';
  // Une plage créée directement comme validée doit nommer son validateur :
  // sinon « VALIDATED » ne voudrait rien dire.
  if (status === 'VALIDATED' && !payload.validatedBy) {
    throw ApiError.badRequest('Une plage VALIDATED exige un validateur nommé (validatedBy)');
  }

  const created = await prisma.cropAgronomicRange.create({
    data: {
      id: resolveId(),
      organizationId: payload.organizationId ?? null,
      cropSlug: payload.cropSlug,
      parameterKey: payload.parameterKey,
      scientificName: payload.scientificName ?? null,
      minValue: payload.minValue,
      maxValue: payload.maxValue,
      toleratedMin: payload.toleratedMin ?? null,
      toleratedMax: payload.toleratedMax ?? null,
      unit: payload.unit,
      status,
      sourceType: payload.sourceType ?? null,
      sourceReference: payload.sourceReference ?? null,
      sourceNote: payload.sourceNote ?? null,
      // Même forme canonique que par l'import : « Équateur » et « Equateur »
      // doivent aboutir à la même valeur, quel que soit le chemin d'entrée.
      zone: resolveZone(payload.zone),
      datasetLabel: payload.datasetLabel ?? 'production',
      validatedBy: status === 'VALIDATED' ? payload.validatedBy : null,
      validatedAt: status === 'VALIDATED' ? (payload.validatedAt ?? new Date()) : null,
      createdBy: req.user?.id ?? null,
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'agronomicRange.create',
    resource: 'CropAgronomicRange',
    resourceId: created.id,
    req,
    newValue: {
      cropSlug: created.cropSlug,
      parameterKey: created.parameterKey,
      min: created.minValue,
      max: created.maxValue,
      status: created.status,
      datasetLabel: created.datasetLabel,
      sourceReference: created.sourceReference,
    },
  });

  return created;
};

export const updateRange = async (id, payload, req) => {
  const current = await getRange(id);

  // Contrôlé avant la cohérence des bornes : changer de paramètre produirait
  // sinon une erreur d'unité trompeuse, masquant la vraie raison du refus.
  if (payload.parameterKey && payload.parameterKey !== current.parameterKey) {
    throw ApiError.badRequest(
      'Le paramètre d’une plage ne se modifie pas : créez une nouvelle plage et retirez l’ancienne.',
    );
  }

  // Pour les champs facultatifs, `undefined` veut dire « ne pas toucher » et
  // `null` veut dire « effacer » : un simple `??` confondrait les deux et
  // rendrait impossible la suppression d'une borne tolérée.
  const pick = (value, fallback) => (value === undefined ? fallback : value);

  const merged = {
    parameterKey: payload.parameterKey ?? current.parameterKey,
    minValue: payload.minValue ?? current.minValue,
    maxValue: payload.maxValue ?? current.maxValue,
    toleratedMin: pick(payload.toleratedMin, current.toleratedMin),
    toleratedMax: pick(payload.toleratedMax, current.toleratedMax),
    unit: payload.unit ?? current.unit,
    scientificName: pick(payload.scientificName, current.scientificName),
    sourceType: pick(payload.sourceType, current.sourceType),
    sourceReference: pick(payload.sourceReference, current.sourceReference),
    sourceNote: pick(payload.sourceNote, current.sourceNote),
    // `undefined` = non touché ; `null` = effacé ; sinon forme canonique.
    zone: payload.zone === undefined ? current.zone : resolveZone(payload.zone),
  };
  assertCoherent(merged);

  // Modifier une plage validée la fait redevenir provisoire : la validation
  // portait sur les anciennes bornes, elle ne peut pas survivre au changement.
  const downgraded = current.status === 'VALIDATED';

  const updated = await prisma.cropAgronomicRange.update({
    where: { id },
    data: {
      scientificName: merged.scientificName,
      minValue: merged.minValue,
      maxValue: merged.maxValue,
      toleratedMin: merged.toleratedMin,
      toleratedMax: merged.toleratedMax,
      unit: merged.unit,
      sourceType: merged.sourceType,
      sourceReference: merged.sourceReference,
      sourceNote: merged.sourceNote,
      zone: merged.zone,
      status: downgraded ? 'PROVISIONAL' : current.status,
      validatedBy: downgraded ? null : current.validatedBy,
      validatedAt: downgraded ? null : current.validatedAt,
      version: current.version + 1,
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'agronomicRange.update',
    resource: 'CropAgronomicRange',
    resourceId: id,
    req,
    oldValue: { min: current.minValue, max: current.maxValue, status: current.status },
    newValue: {
      min: updated.minValue,
      max: updated.maxValue,
      status: updated.status,
      ...(downgraded ? { note: 'Validation annulée : les bornes ont changé.' } : {}),
    },
  });

  return updated;
};

/**
 * Valide une plage : elle cesse d'être « indicative ».
 *
 * Exige un validateur nommé et une source citable. Sans source, « validée »
 * serait une affirmation sans fondement.
 */
export const validateRange = async (id, payload, req) => {
  const current = await getRange(id);

  if (!payload.validatedBy || String(payload.validatedBy).trim().length < 2) {
    throw ApiError.badRequest('La validation exige le nom du validateur (validatedBy)');
  }
  if (!current.sourceReference) {
    throw ApiError.conflict(
      'Impossible de valider une plage sans source citable : renseignez d’abord sourceReference.',
      { id },
    );
  }

  const updated = await prisma.cropAgronomicRange.update({
    where: { id },
    data: {
      status: 'VALIDATED',
      validatedBy: String(payload.validatedBy).trim(),
      validatedAt: payload.validatedAt ? new Date(payload.validatedAt) : new Date(),
      sourceReference: payload.sourceReference ?? current.sourceReference,
      version: current.version + 1,
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'agronomicRange.validate',
    resource: 'CropAgronomicRange',
    resourceId: id,
    req,
    oldValue: { status: current.status },
    newValue: {
      status: 'VALIDATED',
      validatedBy: updated.validatedBy,
      validatedAt: updated.validatedAt,
    },
  });

  return updated;
};

/** Retire une plage du référentiel actif sans effacer l'historique. */
export const retireRange = async (id, req) => {
  const current = await getRange(id);
  const updated = await prisma.cropAgronomicRange.update({
    where: { id },
    data: { status: 'RETIRED', version: current.version + 1 },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'agronomicRange.retire',
    resource: 'CropAgronomicRange',
    resourceId: id,
    req,
    oldValue: { status: current.status },
    newValue: { status: 'RETIRED' },
  });

  return updated;
};
/* ───────────────────────── Import CSV ───────────────────────── */

// La lecture du fichier est déportée dans `agronomicRangesCsv.js` : module pur,
// testé sans base. On réexporte ses constantes pour ne pas casser les imports
// existants (`IMPORT_HEADER`, `IMPORT_EXAMPLE`, `IMPORT_COLUMNS`).
export {
  IMPORT_COLUMNS,
  IMPORT_EXAMPLE,
  IMPORT_HEADER,
  PARAMETER_LABELS,
  SOURCE_TYPE_MENU,
  buildTemplateCsv,
} from './agronomicRangesCsv.js';

/**
 * Importe le tableau « Plages agronomiques » au format CSV.
 *
 * Trois règles structurantes, chacune motivée par un défaut réel :
 *
 *  • **Une ligne du fichier ne valide jamais rien.** Même si le tableau annonce
 *    « VALIDATED » avec un validateur et une date, la plage est créée
 *    `PROVISIONAL`. Un fichier est une saisie, pas une validation agronomique :
 *    laisser un tableur produire des fourchettes validées ferait entrer dans le
 *    moteur des valeurs que personne n'a vérifiées, avec le label de confiance
 *    qui va avec. Le validateur et la date annoncés sont **conservés en note**
 *    pour ne pas perdre l'information ; seule la route de validation,
 *    réservée aux agronomes et administrateurs, peut passer une plage en
 *    `VALIDATED`.
 *
 *  • **Les cases vides restent vides.** Une borne tolérée absente n'est pas
 *    complétée, un type de source « A choisir » n'est pas remplacé : inventer
 *    une valeur produirait une limite que personne n'a mesurée.
 *
 *  • **Une plage déjà validée n'est jamais écrasée.** Elle est signalée
 *    `SKIPPED_VALIDATED` : c'est un acte d'agronome, pas une donnée de fichier.
 *
 * Chaque ligne est traitée indépendamment : une ligne invalide est rapportée
 * avec son numéro et sa raison, les autres sont importées.
 */
export const importRanges = async (payload, req) => {
  // Lot et organisation suivent la convention du reste du service : le lot
  // vient de l'appel, sinon de la configuration ; l'organisation est celle du
  // locataire, jamais déduite du fichier.
  const organizationId = payload?.organizationId ?? null;
  const datasetLabel = payload?.datasetLabel?.trim()
    || process.env.AGRONOMIC_DATASET
    || 'production';
  const dryRun = payload?.dryRun === true;

  const csvText = String(payload?.csv ?? '');
  if (csvText.trim().length === 0) {
    throw ApiError.badRequest('Le contenu CSV est vide');
  }

  const { headerCells, rows } = parseCsvText(csvText);
  if (headerCells.length === 0) {
    throw ApiError.badRequest('Le fichier ne contient aucune ligne d\'en-tête');
  }

  const { columns, indices, missing } = resolveImportColumns(headerCells);
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Colonnes obligatoires manquantes dans l'en-tête : ${missing.join(', ')}. `
      + `En-tête attendu : ${IMPORT_HEADER.join(';')}.`,
    );
  }

  const summary = {
    totalLines: rows.length,
    created: 0,
    updated: 0,
    skippedValidated: 0,
    /**
     * Lignes **sans valeurs idéales**, ignorées sans être des erreurs.
     *
     * Un tableur exporté contient presque toujours des lignes de séparation,
     * une ligne de total, ou des cultures dont la fourchette n'est pas encore
     * établie. Les compter comme des erreurs noierait les vrais problèmes dans
     * le bruit — et découragerait de relire le rapport.
     */
    skippedEmpty: 0,
    errors: 0,
    dryRun,
  };
  const results = [];

  for (const row of rows) {
    const record = readImportRow(row.cells, indices);
    const base = {
      line: row.lineNumber,
      cropSlug: record.cropSlug ?? null,
      parameterKey: record.parameterKey ?? record.parameterKeyAsWritten,
    };

    try {
      // Vérifié en premier : une ligne sans bornes idéales n'a rien à dire,
      // quelle que soit la présence des autres colonnes. Elle est ignorée et
      // comptée à part, jamais traitée comme une erreur.
      const idealBoundsMissing = [record.minValue, record.maxValue]
        .every((value) => value === null || value === undefined);
      if (idealBoundsMissing) {
        summary.skippedEmpty += 1;
        results.push({
          ...base,
          outcome: 'SKIPPED_EMPTY',
          reason: 'Aucune valeur idéale renseignée : ligne ignorée',
        });
        continue;
      }

      if (!record.cropSlug) throw ApiError.badRequest('Colonne « Culture » vide');
      if (!record.parameterKey) {
        throw ApiError.badRequest(
          `Paramètre « ${record.parameterKeyAsWritten ?? ''} » non reconnu. `
          + `Paramètres acceptés : ${Object.values(PARAMETER_LABELS)
            .map((labels) => labels[0]).join(', ')}.`,
        );
      }
      if (!record.unit) throw ApiError.badRequest('Colonne « Unité » vide');
      // Une seule des deux bornes renseignées : ce n'est plus une ligne vide
      // mais une fourchette incomplète, et la compléter serait une invention.
      if (record.minValue === null || record.maxValue === null
        || record.minValue === undefined || record.maxValue === undefined) {
        throw ApiError.badRequest(
          'Une seule des deux bornes idéales est renseignée : indiquez « Idéal min » '
          + 'et « Idéal max », ou laissez les deux vides pour ignorer la ligne.',
        );
      }
      // Une colonne absente ou une cellule vide restent vides ; seule une
      // valeur réellement hors menu est refusée.
      // `null` = menu non renseigné (« A choisir » ou case vide) : légitime.
      // `undefined` avec une valeur brute = résolution impossible : à refuser.
      if (record.sourceTypeRaw && record.sourceType === undefined) {
        throw ApiError.badRequest(
          `Type de source hors menu : « ${record.sourceTypeRaw} ». `
          + 'Valeurs acceptées : Agronome, Publication, Pilote '
          + '(« A choisir » = non renseigné).',
        );
      }
      if (!record.sourceReference && !record.sourceNote) {
        throw ApiError.badRequest(
          'Une source (« Source précise ») ou une remarque est obligatoire : '
          + 'une fourchette sans provenance ne doit pas entrer en base.',
        );
      }

      const where = {
        organizationId,
        cropSlug: record.cropSlug,
        parameterKey: record.parameterKey,
        datasetLabel,
      };

      const existing = await prisma.cropAgronomicRange.findFirst({ where });

      if (existing && existing.status === 'VALIDATED') {
        summary.skippedValidated += 1;
        results.push({
          ...base,
          outcome: 'SKIPPED_VALIDATED',
          id: existing.id,
          reason: 'Plage déjà validée par un agronome : un fichier ne peut pas l\'écraser',
        });
        continue;
      }

      // Le validateur et la date annoncés par le fichier ne sont pas perdus :
      // ils sont conservés en note, à titre d'information, sans effet sur le
      // statut. Seule la route de validation peut en faire une validation.
      const announcedBy = [record.validatedBy, record.validatedAt]
        .filter((value) => value !== null && value !== undefined)
        .join(' le ');
      const notes = [
        record.sourceNote ?? null,
        announcedBy ? `Annoncé validé par ${announcedBy} (non appliqué : reste provisoire)` : null,
        record.zone ? `Zone concernée : ${record.zone}` : null,
        record.status && record.status !== 'PROVISIONAL'
          ? `Statut annoncé par le fichier : ${record.status}`
          : null,
      ].filter(Boolean);

      const data = {
        scientificName: record.scientificName ?? null,
        minValue: record.minValue,
        maxValue: record.maxValue,
        toleratedMin: record.toleratedMin ?? null,
        toleratedMax: record.toleratedMax ?? null,
        unit: record.unit,
        // Toujours PROVISIONAL à l'import, quel que soit le statut annoncé.
        status: 'PROVISIONAL',
        sourceType: record.sourceType ?? null,
        sourceReference: record.sourceReference ?? null,
        zone: record.zone ?? null,
        sourceNote: notes.length > 0 ? notes.join(' — ') : null,
      };

      // La cohérence est vérifiée avant toute écriture, y compris en dryRun :
      // sinon le mode « à blanc » validerait des lignes que l'import réel
      // refuserait ensuite.
      assertCoherent({
        parameterKey: record.parameterKey,
        minValue: record.minValue,
        maxValue: record.maxValue,
        toleratedMin: record.toleratedMin ?? null,
        toleratedMax: record.toleratedMax ?? null,
        unit: record.unit,
        sourceReference: record.sourceReference,
        sourceNote: data.sourceNote,
      });

      if (dryRun) {
        // Rien n'est écrit, mais le résumé décrit le résultat attendu : un
        // essai à blanc qui annoncerait zéro ligne ne servirait à rien. Le
        // drapeau `dryRun` lève toute ambiguïté.
        if (existing) summary.updated += 1; else summary.created += 1;
        results.push({
          ...base,
          outcome: existing ? 'WOULD_UPDATE' : 'WOULD_CREATE',
          id: existing?.id ?? null,
        });
        continue;
      }

      const saved = existing
        ? await prisma.cropAgronomicRange.update({
          where: { id: existing.id },
          // Le modèle n'a pas de colonne « modifié par » : l'auteur de la
          // modification est tracé par l'audit, pas par la ligne.
          data: { ...data, version: { increment: 1 } },
        })
        : await prisma.cropAgronomicRange.create({
          data: {
            ...data,
            id: resolveId(),
            organizationId,
            cropSlug: record.cropSlug,
            parameterKey: record.parameterKey,
            datasetLabel,
            createdBy: req.user?.id ?? null,
          },
        });

      if (existing) summary.updated += 1; else summary.created += 1;
      results.push({
        ...base,
        outcome: existing ? 'UPDATED' : 'CREATED',
        id: saved.id,
      });

      await audit({
        actorId: req.user?.id ?? null,
        action: existing ? 'agronomicRange.importUpdate' : 'agronomicRange.importCreate',
        resource: 'CropAgronomicRange',
        resourceId: saved.id,
        req,
        newValue: { cropSlug: record.cropSlug, parameterKey: record.parameterKey, status: 'PROVISIONAL' },
      });
    } catch (error) {
      summary.errors += 1;
      results.push({
        ...base,
        outcome: 'ERROR',
        reason: error?.message ?? 'Erreur inconnue',
      });
    }
  }

  await audit({
    actorId: req.user?.id ?? null,
    action: 'agronomicRange.import',
    resource: 'CropAgronomicRange',
    resourceId: null,
    req,
    newValue: summary,
  });

  return { summary, results, columns };
};
