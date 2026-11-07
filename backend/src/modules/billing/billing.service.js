/**
 * Exigences CDC couvertes : BIL-01, BIL-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { round, convert } from '../../shared/money.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';
import { buildPdf } from '../../shared/pdf.js';

/**
 * BIL-01 → BIL-04 — Facturation légère.
 *
 * Précisions de périmètre (CDC V2 §7) :
 * - AGRIKONNECT n'encaisse pas : les factures sont des documents commerciaux.
 * - Numérotation séquentielle PAR ORGANISATION, sans trou (transaction).
 * - Conversion de devise uniquement avec un taux daté et sourcé (BIL-02).
 */

/**
 * BIL-03 — numérotation séquentielle **par organisation et par type**, sans
 * trou : la séquence est lue dans la transaction qui crée le document, jamais
 * dans un compteur applicatif partagé (deux organisations ne se bloquent pas,
 * et une création annulée ne consomme pas de numéro).
 */
const nextSequence = async (tx, organizationId, type) => {
  const last = await tx.invoice.findFirst({
    where: { organizationId, type },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });
  return (last?.sequence ?? 0) + 1;
};

export const create = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  if (payload.orderId) {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId } });
    if (!order) throw ApiError.notFound('Commande introuvable');
    if (order.buyerOrgId !== organizationId && order.sellerOrgId !== organizationId) {
      throw ApiError.notFound('Commande introuvable');
    }
  }

  const lines = payload.lines.map((line) => ({
    ...line,
    lineTotal: round(Number(line.quantity) * Number(line.unitPrice)),
  }));
  const totalAmount = round(lines.reduce((acc, l) => acc + l.lineTotal, 0));

  let fxRate = null;
  let converted = null;
  if (payload.currency !== 'USD' && payload.fxRate) {
    // BIL-02 : refus explicite si le taux n'est pas daté et sourcé
    const result = convert(totalAmount, 'USD', payload.currency, payload.fxRate);
    // BIL-02 : refus explicite si le taux n'est pas daté et sourcé
    if (result.amount === null) throw ApiError.badRequest(result.error);
    converted = result.amount;
    fxRate = payload.fxRate;
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const sequence = await nextSequence(tx, organizationId, payload.type);
    const year = new Date().getUTCFullYear();

    return tx.invoice.create({
      data: {
        id: resolveId(payload.id),
        organizationId,
        number: `${payload.type === 'INVOICE' ? 'FAC' : 'DOC'}-${year}-${String(sequence).padStart(5, '0')}`,
        sequence,
        type: payload.type,
        orderId: payload.orderId ?? null,
        lines,
        currency: payload.currency ?? 'USD',
        fxRate: fxRate ?? undefined,
        totalAmount,
        issuerOrgId: organizationId,
        recipientOrgId: payload.recipientOrgId ?? null,
      },
    });
  });

  if (payload.recipientOrgId) {
    const members = await prisma.membership.findMany({
      where: { organizationId: payload.recipientOrgId, status: 'ACTIVE' },
      select: { userId: true },
    });
    for (const member of members) {
      // eslint-disable-next-line no-await-in-loop
      await notify({
        userId: member.userId,
        type: 'invoice.issued',
        title: `Document ${invoice.type} ${invoice.number}`,
        body: `${invoice.totalAmount} ${invoice.currency}`,
        payload: { invoiceId: invoice.id },
        dedupeKey: `invoice:${invoice.id}:${member.userId}`,
      });
    }
  }

  await audit({
    actorId: req.user.id,
    action: 'invoice.create',
    resource: 'invoices',
    resourceId: invoice.id,
    req,
    newValue: { number: invoice.number, totalAmount, currency: invoice.currency },
  });

  return {
    invoice,
    converted,
    disclaimer: 'Document commercial — AGRIKONNECT n\'opère aucun encaissement.',
  };
};

export const list = async (query, req) => {
  const { page, limit } = query;
  const where = {
    organizationId: req.tenant.organizationId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!invoice) throw ApiError.notFound('Document introuvable');

  // Contrôle de cohérence : le total stocké doit être recalculable
  const recomputed = round(invoice.lines.reduce((acc, l) => acc + Number(l.lineTotal ?? 0), 0));

  return {
    invoice,
    consistency: {
      recomputedTotal: recomputed,
      storedTotal: invoice.totalAmount,
      matches: Math.abs(recomputed - invoice.totalAmount) < 0.01,
    },
  };
};

/** BIL-04 — enregistrement d'un règlement déclaratif (hors plateforme). */
export const declareSettlement = async (id, { note }, req) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!invoice) throw ApiError.notFound('Document introuvable');

  await audit({
    actorId: req.user.id,
    action: 'invoice.settlement.declared',
    resource: 'invoices',
    resourceId: id,
    req,
    newValue: { note: note ?? null },
  });

  return {
    invoiceId: id,
    declared: true,
    disclaimer:
      'Règlement déclaré hors plateforme. AGRIKONNECT ne détient, ne transfère ni ne conserve de fonds.',
  };
};

/**
 * BIL-01 — document commercial au format PDF.
 * Le PDF ne remplace pas la facture électronique légale et rappelle explicitement
 * qu'AGRIKONNECT n'encaisse aucun fonds.
 */
export const invoicePdf = async (id, req) => {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw ApiError.notFound('Facture introuvable');

  const organizationId = req.tenant.organizationId;
  if (invoice.issuerOrgId !== organizationId && invoice.recipientOrgId !== organizationId) {
    throw ApiError.notFound('Facture introuvable');
  }

  const [issuer, recipient] = await Promise.all([
    prisma.organization.findUnique({ where: { id: invoice.issuerOrgId } }),
    invoice.recipientOrgId
      ? prisma.organization.findUnique({ where: { id: invoice.recipientOrgId } })
      : Promise.resolve(null),
  ]);

  const lines = Array.isArray(invoice.lines) ? invoice.lines : [];

  const buffer = await buildPdf({
    title: `Facture ${invoice.number}`,
    subtitle: 'Document commercial — AGRIKONNECT AFRICA n’encaisse aucun paiement',
    reference: invoice.number,
    sections: [
      {
        heading: 'Parties',
        rows: [
          ['Émetteur', issuer?.name ?? invoice.issuerOrgId],
          ['Destinataire', recipient?.name ?? '—'],
          ['Date d’émission', new Date(invoice.issuedAt).toISOString().slice(0, 10)],
          ['Devise', invoice.currency],
          ...(invoice.fxRate ? [['Taux de change', JSON.stringify(invoice.fxRate)]] : []),
        ],
      },
    ],
    table: [
      ['Désignation', 'Quantité', 'Prix unitaire', 'Total'],
      ...lines.map((line) => [
        line.description ?? line.label ?? '—',
        String(line.quantity ?? ''),
        `${line.unitPrice ?? ''} ${invoice.currency}`,
        `${line.lineTotal ?? ''} ${invoice.currency}`,
      ]),
    ],
    total: `Total : ${invoice.totalAmount} ${invoice.currency}`,
    footer:
      `AGRIKONNECT AFRICA — facture ${invoice.number} — ` +
      'document commercial, ne vaut pas titre de paiement. AGRIKONNECT n’encaisse aucun fonds.',
  });

  await audit({
    actorId: req.user.id,
    action: 'invoice.pdf',
    resource: 'invoices',
    resourceId: invoice.id,
    req,
    newValue: { number: invoice.number },
  });

  return { buffer, filename: `${invoice.number}.pdf` };
};
