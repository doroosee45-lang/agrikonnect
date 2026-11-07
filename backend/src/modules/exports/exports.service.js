/**
 * Exigences CDC couvertes : EXP-01, EXP-02, EXP-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { convert, validFxRate } from '../../shared/money.js';
import { audit } from '../../shared/audit.js';

/**
 * EXP-01 → EXP-03 — Export (V5).
 *
 * Un dossier d'export n'est `CERTIFIED` que si les documents obligatoires
 * sont présents (facture, certificat d'origine, certificat phytosanitaire,
 * connaissement). L'Incoterm et le taux de change doivent être explicites :
 * aucun taux n'est supposé.
 */

const REQUIRED_DOCUMENTS = {
  INVOICE: 'Facture commerciale',
  CERTIFICATE_OF_ORIGIN: 'Certificat d\'origine',
  PHYTOSANITARY: 'Certificat phytosanitaire',
  BILL_OF_LADING: 'Connaissement / LTA',
};

const INCOTERMS = [
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
];

const TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_CONTROL', 'CANCELLED'],
  IN_CONTROL: ['CERTIFIED', 'CONFIRMED', 'CANCELLED'],
  CERTIFIED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

const reference = () =>
  `EXP-${new Date().getUTCFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const create = async (payload, req) => {
  if (!INCOTERMS.includes(payload.incoterm)) {
    throw ApiError.badRequest(`Incoterm invalide. Valeurs acceptées : ${INCOTERMS.join(', ')}`);
  }

  let fxRate = null;
  if (payload.currency !== 'USD') {
    if (!validFxRate(payload.fxRate)) {
      throw ApiError.badRequest(
        'Taux de change daté et sourcé requis pour une devise autre que USD (EXP-02). ' +
          'Aucun taux n\'est supposé par la plateforme.',
      );
    }
    fxRate = payload.fxRate;
  }

  const order = await prisma.exportOrder.create({
    data: {
      id: resolveId(payload.id),
      reference: reference(),
      sellerOrgId: req.tenant.organizationId,
      buyerOrgId: payload.buyerOrgId ?? null,
      tenderId: payload.tenderId ?? null,
      status: 'DRAFT',
      incoterm: payload.incoterm,
      destinationCountry: payload.destinationCountry,
      logisticsPartnerOrgId: payload.logisticsPartnerOrgId ?? null,
      steps: {
        planned: payload.steps ?? [],
        documentsRequired: Object.keys(REQUIRED_DOCUMENTS),
        createdBy: req.user.id,
      },
      totalAmount: payload.totalAmount ?? null,
      currency: payload.currency,
      fxRate: fxRate ?? undefined,
    },
  });

  await audit({ actorId: req.user.id, action: 'export.create', resource: 'export_orders', resourceId: order.id, req, newValue: { reference: order.reference, incoterm: order.incoterm, currency: order.currency } });
  return order;
};

export const addDocument = async (exportOrderId, payload, req) => {
  const order = await prisma.exportOrder.findUnique({ where: { id: exportOrderId } });
  if (!order) throw ApiError.notFound('Dossier d\'export introuvable');
  if (order.sellerOrgId !== req.tenant.organizationId && order.buyerOrgId !== req.tenant.organizationId) {
    throw ApiError.notFound('Dossier d\'export introuvable');
  }

  const document = await prisma.exportDocument.create({
    data: {
      id: resolveId(),
      exportOrderId,
      type: payload.type,
      name: payload.name,
      storageKey: payload.storageKey ?? null,
    },
  });

  await audit({ actorId: req.user.id, action: 'export.document.add', resource: 'export_documents', resourceId: document.id, req, newValue: { exportOrderId, type: payload.type } });
  return document;
};

export const getOne = async (id, req) => {
  const order = await prisma.exportOrder.findUnique({
    where: { id },
    include: { documents: { orderBy: { issuedAt: 'desc' } } },
  });
  if (!order) throw ApiError.notFound('Dossier d\'export introuvable');

  const isParty = [order.sellerOrgId, order.buyerOrgId].includes(req.tenant.organizationId)
    || (req.user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r));
  if (!isParty) throw ApiError.notFound('Dossier d\'export introuvable');

  const present = new Set(order.documents.map((d) => d.type));
  const missing = Object.keys(REQUIRED_DOCUMENTS).filter((type) => !present.has(type));

  return {
    exportOrder: order,
    compliance: {
      required: Object.entries(REQUIRED_DOCUMENTS).map(([type, label]) => ({ type, label, present: present.has(type) })),
      missing,
      canBeCertified: missing.length === 0,
    },
    finance: {
      totalAmount: order.totalAmount,
      currency: order.currency,
      fxRate: order.fxRate,
      // Conversion uniquement si un taux daté et sourcé existe
      conversion: order.fxRate
        ? convert(Number(order.totalAmount ?? 0), 'USD', order.currency, order.fxRate)
        : { amount: null, error: 'Aucun taux de change enregistré : montant conservé en devise d\'origine.' },
    },
  };
};

export const list = async (query, req) => {
  const where = {
    sellerOrgId: req.tenant.organizationId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.exportOrder.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.exportOrder.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
};

export const transition = async (id, { status: target, note }, req) => {
  const order = await prisma.exportOrder.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!order) throw ApiError.notFound('Dossier d\'export introuvable');
  if (order.sellerOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seul le vendeur fait avancer le dossier d\'export');
  }

  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(target)) {
    throw ApiError.conflict(
      `Transition interdite : ${order.status} → ${target}. Possibles : ${allowed.join(', ') || 'aucune'}.`,
    );
  }

  // EXP-03 — certification conditionnée par les documents obligatoires
  if (target === 'CERTIFIED') {
    const present = new Set(order.documents.map((d) => d.type));
    const missing = Object.keys(REQUIRED_DOCUMENTS).filter((type) => !present.has(type));
    if (missing.length > 0) {
      throw ApiError.conflict(
        `Certification impossible : documents manquants (${missing.join(', ')}).`,
      );
    }
  }

  const updated = await prisma.exportOrder.update({
    where: { id },
    data: {
      status: target,
      steps: {
        ...(order.steps ?? {}),
        history: [...((order.steps?.history) ?? []), { from: order.status, to: target, at: new Date().toISOString(), by: req.user.id, note: note ?? null }],
      },
    },
  });

  await audit({ actorId: req.user.id, action: 'export.transition', resource: 'export_orders', resourceId: id, req, oldValue: { status: order.status }, newValue: { status: target } });
  return updated;
};
