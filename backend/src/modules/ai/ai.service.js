/**
 * Exigences CDC couvertes : AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-10,
 * NFR-09 (minimisation des données transmises à l'IA, consentement révocable).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { assertAiQuota } from '../../shared/quota.js';
import { audit } from '../../shared/audit.js';
import { logger } from '../../shared/http/logger.js';

/**
 * AI-01 → AI-06 — Assistance IA encadrée.
 *
 * Règles structurantes du CDC V3 §7 :
 *  - consentement explicite et enregistré avant tout traitement d'image ;
 *  - toute sortie porte `disclaimer` + `confidence` + version de prompt/modèle ;
 *  - jamais de recommandation agronomique « réglementée » sans validation humaine ;
 *  - escalade possible vers un humain (agronome), tracée ;
 *  - quota par utilisateur et par organisation.
 */

export const PROMPT_VERSION = 'agrikon-v3.1';
export const MODEL = 'agrikon-advisor-1';

const DISCLAIMER =
  'Analyse assistée par IA à titre informatif. Elle ne remplace pas l\'avis d\'un agronome ' +
  'agréé ni un diagnostic de laboratoire. Aucune décision phytosanitaire ne doit être prise ' +
  'sur cette seule base.';

const CONFIDENCE_LABEL = { low: 'faible', medium: 'moyenne', high: 'élevée' };

/**
 * Fournisseur d'analyse. En l'absence de fournisseur configuré, on renvoie une
 * analyse déterministe à partir des données réelles de la parcelle — jamais une
 * réponse inventée présentée comme certaine.
 */
const runInference = async ({ type, plotId, prompt, organizationId }) => {
  if (!plotId) {
    return {
      output: { summary: 'Aucune parcelle fournie : analyse non contextualisée.', observations: [] },
      confidence: 'low',
    };
  }

  const [plot, lastProduction, lastSoil] = await Promise.all([
    prisma.plot.findFirst({ where: { id: plotId, organizationId, deletedAt: null } }),
    prisma.production.findFirst({
      where: { plotId, organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.soilAssessment.findFirst({
      where: { plotId, organizationId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      include: { parameters: true },
    }),
  ]);

  if (!plot) throw ApiError.notFound('Parcelle introuvable');

  const observations = [];
  if (lastProduction) {
    observations.push({
      key: 'last_production',
      label: 'Dernière production enregistrée',
      value: `${lastProduction.quantity} ${lastProduction.unit ?? ''}`.trim(),
      source: 'declared',
    });
  }
  const ph = lastSoil?.parameters?.find((p) => p.key.toLowerCase() === 'ph');
  if (ph) {
    observations.push({
      key: 'soil_ph',
      label: 'pH du sol (dernière analyse)',
      value: ph.numericValue ?? ph.value,
      source: ph.source,
    });
  }

  return {
    output: {
      summary:
        observations.length === 0
          ? 'Données insuffisantes sur cette parcelle pour une analyse fiable.'
          : `Analyse basée sur ${observations.length} observation(s) disponible(s) pour ${plot.name}.`,
      observations,
      promptEcho: prompt ?? null,
      missingData: observations.length < 2 ? ['historique de production', 'analyse de sol'] : [],
    },
    // Peu de données ⇒ confiance faible, affichée telle quelle
    confidence: observations.length >= 2 ? 'medium' : 'low',
  };
};

export const analyze = async (payload, req) => {
  // AI-05 — consentement obligatoire pour les images
  if (payload.type !== 'CHAT' && payload.consentGiven !== true) {
    throw ApiError.badRequest(
      'Consentement explicite requis pour l\'analyse d\'image ou de document (AI-05). ' +
        'Aucune donnée n\'est traitée sans accord enregistré.',
    );
  }

  await assertAiQuota({ userId: req.user.id, organizationId: req.tenant.organizationId });

  if (payload.plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: payload.plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
  }

  const analysis = await prisma.aiAnalysis.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      type: payload.type,
      status: 'PENDING',
      plotId: payload.plotId ?? null,
      prompt: payload.prompt ?? null,
      promptVersion: PROMPT_VERSION,
      provider: 'internal',
      model: MODEL,
      consentGiven: payload.consentGiven === true,
    },
  });

  try {
    const result = await runInference({
      type: payload.type,
      plotId: payload.plotId,
      prompt: payload.prompt,
      organizationId: req.tenant.organizationId,
    });

    const completed = await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: 'COMPLETED',
        output: result.output,
        confidence: result.confidence,
        disclaimer: DISCLAIMER,
      },
    });

    await audit({
      actorId: req.user.id,
      action: 'ai.analyze',
      resource: 'ai_analyses',
      resourceId: analysis.id,
      req,
      newValue: { type: payload.type, promptVersion: PROMPT_VERSION, model: MODEL, confidence: result.confidence },
    });

    return {
      analysis: completed,
      disclaimer: DISCLAIMER,
      confidence: { level: result.confidence, label: CONFIDENCE_LABEL[result.confidence] },
      provenance: { promptVersion: PROMPT_VERSION, model: MODEL, generatedAt: new Date().toISOString() },
      humanEscalationAvailable: true,
    };
  } catch (error) {
    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: { status: 'FAILED', disclaimer: DISCLAIMER },
    });
    logger.warn('Analyse IA échouée :', error.message);
    throw error;
  }
};

export const list = async (query, req) => {
  const { page, limit } = query;
  const where = {
    organizationId: req.tenant.organizationId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.aiAnalysis.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, status: true, plotId: true, confidence: true,
        promptVersion: true, model: true, createdAt: true, escalatedAt: true,
      },
    }),
    prisma.aiAnalysis.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    disclaimer: DISCLAIMER,
  };
};

export const getOne = async (id, req) => {
  const analysis = await prisma.aiAnalysis.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!analysis) throw ApiError.notFound('Analyse introuvable');

  return {
    analysis,
    // AI-04 : la traçabilité de la génération est toujours exposée
    provenance: {
      promptVersion: analysis.promptVersion,
      model: analysis.model,
      provider: analysis.provider,
      disclaimer: analysis.disclaimer ?? DISCLAIMER,
    },
  };
};

/** AI-04 — escalade vers un humain (agronome). */
export const escalate = async (id, { reason }, req) => {
  const analysis = await prisma.aiAnalysis.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!analysis) throw ApiError.notFound('Analyse introuvable');
  if (analysis.status === 'ESCALATED') throw ApiError.conflict('Analyse déjà escaladée');

  const updated = await prisma.aiAnalysis.update({
    where: { id },
    data: { status: 'ESCALATED', escalatedTo: 'agronomist_queue', escalatedAt: new Date(), feedback: reason ?? null },
  });

  await audit({
    actorId: req.user.id,
    action: 'ai.escalate',
    resource: 'ai_analyses',
    resourceId: id,
    req,
    newValue: { reason: reason ?? null },
  });

  return {
    analysis: updated,
    message: 'Demande transmise à un agronome. La réponse humaine primera sur l\'analyse automatique.',
  };
};

/** Retour utilisateur sur la qualité de l'analyse (AI-06). */
export const feedback = async (id, { feedback }, req) => {
  const analysis = await prisma.aiAnalysis.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!analysis) throw ApiError.notFound('Analyse introuvable');

  const updated = await prisma.aiAnalysis.update({ where: { id }, data: { feedback } });
  return updated;
};

/**
 * AI-07 — revue experte d'une analyse (agronome / vérificateur).
 *
 * La validation humaine ne réécrit pas la sortie de l'IA : elle l'annote.
 * `status` reste `COMPLETED` pour la sortie machine, la revue est tracée à
 * part (audit + `escalatedTo`) afin de ne jamais faire passer une opinion
 * humaine pour un résultat de modèle.
 */
export const reviewAnalysis = async (id, { verdict, comment }, req) => {
  const analysis = await prisma.aiAnalysis.findUnique({ where: { id } });
  if (!analysis) throw ApiError.notFound('Analyse introuvable');

  if (!['COMPLETED', 'ESCALATED'].includes(analysis.status)) {
    throw ApiError.conflict('Seule une analyse terminée peut être revue');
  }

  const updated = await prisma.aiAnalysis.update({
    where: { id },
    data: {
      feedback: [analysis.feedback, `[revue experte] ${verdict}${comment ? ` — ${comment}` : ''}`]
        .filter(Boolean)
        .join('\n'),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'ai.review',
    resource: 'ai_analyses',
    resourceId: id,
    req,
    newValue: { verdict, comment: comment ?? null, promptVersion: analysis.promptVersion, model: analysis.model },
  });

  return {
    analysis: updated,
    review: {
      verdict,
      comment: comment ?? null,
      reviewerId: req.user.id,
      at: new Date().toISOString(),
      // La sortie d'origine et sa version restent attachées à l'analyse
      model: analysis.model,
      promptVersion: analysis.promptVersion,
    },
    note: 'Revue experte enregistrée : la sortie IA n\'est pas modifiée, seule une annotation humaine est ajoutée.',
  };
};

/* ─────────────────────── AI-10 : copilote adossé aux données réelles ─────────────────────── */

const COPILOT_VERSION = 'agrikon-copilot-1.0';

/**
 * AI-10 — copilote : répond uniquement à partir de données présentes dans la
 * plateforme, cite ses sources et refuse explicitement de répondre quand la
 * donnée manque. Aucun contenu n'est inventé.
 */
export const copilot = async ({ question, plotId, cropId }, req) => {
  await assertAiQuota(req);

  const citations = [];
  const facts = [];

  if (plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
    facts.push(`Parcelle ${plot.name} (${plot.areaHa ?? plot.area ?? '?'} ha)`);
    citations.push({ type: 'plot', id: plot.id, field: 'name' });
  }

  if (cropId) {
    const crop = await prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop) throw ApiError.notFound('Culture introuvable');
    facts.push(`Culture ${crop.name}`);
    citations.push({ type: 'crop', id: crop.id, field: 'name' });

    const prices = await prisma.marketPrice.findMany({
      where: { cropId: crop.id },
      orderBy: { observedAt: 'desc' },
      take: 3,
    });
    for (const price of prices) {
      facts.push(
        `Prix ${price.market} : ${price.price} ${price.currency}/${price.unit} (${price.source}, ${new Date(price.observedAt).toISOString().slice(0, 10)})`,
      );
      citations.push({ type: 'market_price', id: price.id, field: 'price' });
    }
  }

  if (plotId) {
    const lastSoil = await prisma.soilAssessment.findFirst({
      where: { plotId, organizationId: req.tenant.organizationId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      include: { parameters: true },
    });
    for (const parameter of lastSoil?.parameters ?? []) {
      facts.push(`${parameter.key} = ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ''} (${parameter.source})`);
      citations.push({ type: 'soil_parameter', id: parameter.id, field: parameter.key });
    }

    const weather = await prisma.weatherData.findFirst({
      where: { plotId },
      orderBy: { observedAt: 'desc' },
    });
    if (weather) {
      facts.push(`Météo : ${JSON.stringify(weather.payload ?? {})}`);
      citations.push({ type: 'weather', id: weather.id, field: 'payload' });
    }
  }

  const grounded = facts.length > 0;
  const answer = grounded
    ? `D'après les données disponibles : ${facts.slice(0, 8).join(' ; ')}.`
    : "Aucune donnée de plateforme ne permet de répondre à cette question. Enregistrez une parcelle, une culture ou une analyse de sol pour obtenir une réponse documentée.";

  const analysis = await prisma.aiAnalysis.create({
    data: {
      id: resolveId(),
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      type: 'CHAT',
      status: 'COMPLETED',
      prompt: question,
      promptVersion: COPILOT_VERSION,
      model: MODEL,
      output: { answer, facts, citations, question },
      confidence: grounded ? 'medium' : 'low',
      disclaimer: DISCLAIMER,
      consentGiven: false,
    },
  });

  return {
    id: analysis.id,
    answer,
    facts,
    citations,
    grounded,
    confidence: analysis.confidence,
    promptVersion: COPILOT_VERSION,
    model: MODEL,
    disclaimer: DISCLAIMER,
    limits: {
      scope: 'données de votre organisation uniquement',
      noAdvice: 'Aucune prescription phytosanitaire, aucun conseil réglementé',
    },
  };
};

/* ─────────────────────── AI-03 : génération de documents assistée ─────────────────────── */

const DOCUMENT_KINDS = {
  FICHE_TECHNIQUE: 'Fiche technique de parcelle',
  SYNTHESE_EXPLOITATION: "Synthèse d'exploitation",
  PLAN_CAMPAGNE: 'Plan de campagne',
};

/**
 * AI-03 — un document généré est un BROUILLON : il porte la mention explicite
 * « à relire », sa version de prompt et les données qui l'ont alimenté.
 */
export const generateDocument = async ({ kind, plotId, cropId, language }, req) => {
  await assertAiQuota(req);

  const template = DOCUMENT_KINDS[kind];
  if (!template) throw ApiError.badRequest(`Type de document inconnu : ${kind}`);

  const sections = [];
  const sources = [];

  if (plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
    sections.push({
      title: 'Identification',
      lines: [`Parcelle : ${plot.name}`, `Superficie : ${plot.areaHa ?? plot.area ?? 'non renseignée'} ha`],
    });
    sources.push({ type: 'plot', id: plot.id });

    const soil = await prisma.soilAssessment.findFirst({
      where: { plotId, organizationId: req.tenant.organizationId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      include: { parameters: true },
    });
    if (soil) {
      sections.push({
        title: 'Sol (dernière analyse)',
        lines: soil.parameters.map(
          (p) => `${p.key} : ${p.value}${p.unit ? ` ${p.unit}` : ''} — source ${p.source}`,
        ),
      });
      sources.push({ type: 'soil_assessment', id: soil.id });
    } else {
      sections.push({ title: 'Sol', lines: ['Aucune analyse de sol enregistrée.'] });
    }

    const productions = await prisma.production.findMany({
      where: { plotId, organizationId: req.tenant.organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    sections.push({
      title: 'Historique récent',
      lines: productions.map((p) => `${p.season ?? p.createdAt?.toISOString().slice(0, 10)} : ${p.quantity} ${p.unit ?? ''}`),
    });
  }

  if (cropId) {
    const crop = await prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop) throw ApiError.notFound('Culture introuvable');
    sections.push({ title: 'Culture', lines: [crop.name] });
    sources.push({ type: 'crop', id: crop.id });
  }

  if (!sections.length) {
    throw ApiError.badRequest('Aucune donnée source (parcelle ou culture) : aucun document n’est généré');
  }

  const lines = [
    template,
    '',
    'BROUILLON GÉNÉRÉ — À RELIRE ET VALIDER AVANT DIFFUSION',
    '',
    ...sections.flatMap((section) => [`## ${section.title}`, ...section.lines.map((l) => `- ${l}`), '']),
    `Langue : ${language ?? 'fr'}`,
  ];

  const analysis = await prisma.aiAnalysis.create({
    data: {
      id: resolveId(),
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      type: 'DOCUMENT',
      status: 'COMPLETED',
      prompt: `${template} (${language ?? 'fr'})`,
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      output: { kind, template, content: lines.join('\n'), sections, sources },
      confidence: 'medium',
      disclaimer:
        'Document généré automatiquement à partir des données saisies. Il doit être relu et validé par un responsable avant tout usage officiel.',
      consentGiven: true,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'ai.document.generate',
    resource: 'ai_analyses',
    resourceId: analysis.id,
    req,
    newValue: { kind, plotId: plotId ?? null, cropId: cropId ?? null },
  });

  return {
    id: analysis.id,
    kind,
    title: template,
    content: lines.join('\n'),
    sections,
    sources,
    status: 'DRAFT',
    requiresReview: true,
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    disclaimer: analysis.disclaimer,
  };
};
