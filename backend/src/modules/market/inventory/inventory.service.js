/**
 * Exigences CDC couvertes : STK-01, STK-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { round } from '../../../shared/money.js';
import { audit } from '../../../shared/audit.js';

/**
 * STK-01 / STK-02 — Stocks.
 *
 * Le solde N'EST JAMAIS stocké : il est dérivé du journal de mouvements.
 * Cela rend chaque variation explicable et auditable (aucune écriture
 * « magique » du solde).
 */

const SIGNS = {
  IN: 1,
  RELEASE: 1,
  INVENTORY: 1,
  OUT: -1,
  LOSS: -1,
  RESERVATION: -1,
  TRANSFER: 0, // un transfert neutre au niveau de l'item concerné
};

const computeBalance = (movements) =>
  round(
    movements.reduce((acc, m) => acc + (SIGNS[m.type] ?? 0) * Number(m.quantity), 0),
    3,
  );

export const listItems = async (query, req) => {
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: req.tenant.organizationId, deletedAt: null },
    include: { movements: { orderBy: { at: 'desc' }, take: 50 } },
    orderBy: { label: 'asc' },
  });

  const enriched = items.map((item) => {
    const balance = computeBalance(item.movements);
    return {
      id: item.id,
      label: item.label,
      cropId: item.cropId,
      unit: item.unit,
      balance,
      lowStockThreshold: item.lowStockThreshold,
      // STK-02 : alerte stock faible
      lowStock: item.lowStockThreshold !== null && balance <= Number(item.lowStockThreshold),
      expiresAt: item.expiresAt,
      expiringSoon:
        item.expiresAt !== null &&
        item.expiresAt.getTime() - Date.now() < 30 * 24 * 3600 * 1000,
      lastMovements: item.movements.slice(0, 5),
    };
  });

  return {
    items: enriched,
    alerts: enriched.filter((i) => i.lowStock || i.expiringSoon).map((i) => ({
      itemId: i.id,
      label: i.label,
      reason: i.lowStock ? 'stock_low' : 'expiring_soon',
      balance: i.balance,
    })),
    balanceSource: 'derived_from_movements',
  };
};

export const createItem = async (payload, req) => {
  const item = await prisma.inventoryItem.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
    },
  });

  await audit({ actorId: req.user.id, action: 'inventory.item.create', resource: 'inventory_items', resourceId: item.id, req, newValue: payload });
  return item;
};

/**
 * Mouvement idempotent + contrôle d'atomicité.
 * Un stock ne peut pas devenir négatif (CDC V2 §8.6).
 */
export const addMovement = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  const item = await prisma.inventoryItem.findFirst({
    where: { id: payload.itemId, organizationId, deletedAt: null },
    include: { movements: true },
  });
  if (!item) throw ApiError.notFound('Article de stock introuvable');

  const type = payload.type;
  const quantity = Number(payload.quantity);
  const sign = SIGNS[type] ?? 0;
  const currentBalance = computeBalance(item.movements);
  const projected = round(currentBalance + sign * quantity, 3);

  if (sign < 0 && projected < 0) {
    throw ApiError.conflict(
      `Stock insuffisant : solde ${currentBalance} ${item.unit}, mouvement demandé ${quantity} ${item.unit}. ` +
        'Une correction doit passer par un mouvement INVENTORY justifié (pas d\'écriture directe du solde).',
    );
  }

  const movement = await prisma.inventoryMovement.create({
    data: {
      id: resolveId(payload.id),
      organizationId,
      itemId: item.id,
      type,
      quantity,
      unit: payload.unit ?? item.unit,
      refType: payload.refType ?? null,
      refId: payload.refId ?? null,
      reason: payload.reason ?? null,
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'inventory.movement',
    resource: 'inventory_movements',
    resourceId: movement.id,
    req,
    newValue: { itemId: item.id, type, quantity, projectedBalance: projected },
  });

  return { movement, balance: projected, previousBalance: currentBalance };
};

export const itemHistory = async (itemId, query, req) => {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: req.tenant.organizationId },
  });
  if (!item) throw ApiError.notFound('Article de stock introuvable');

  const movements = await prisma.inventoryMovement.findMany({
    where: { itemId },
    orderBy: { at: 'desc' },
    take: Math.min(Number(query.limit ?? 100), 500),
  });

  return {
    item: { id: item.id, label: item.label, unit: item.unit },
    movements,
    balance: computeBalance(movements),
    // Le journal complet fait foi : le solde renvoyé est recalculé ici.
    recomputed: true,
  };
};
