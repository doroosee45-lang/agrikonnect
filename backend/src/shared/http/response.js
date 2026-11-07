/**
 * Réponses HTTP normalisées (CDC §13.1 / A.5).
 *
 * Succès :
 * { "success": true, "message": "…", "data": {}, "meta": { "page": 1, "limit": 20, "total": 134 } }
 *
 * Erreur :
 * { "success": false, "message": "Validation error",
 *   "errors": [ { "field": "email", "code": "invalid" } ], "requestId": "…" }
 */

export const success = (res, data = null, { status = 200, message = null, meta = null } = {}) => {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data ?? null;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

export const created = (res, data = null, options = {}) =>
  success(res, data, { ...options, status: 201, message: options.message ?? 'Ressource créée' });

export const noContent = (res) => res.status(204).end();

/** Pagination par page/limit (listes courantes). */
export const paginated = (res, data, { page, limit, total, message = null }) =>
  success(res, data, {
    message,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  });

/** Pagination par curseur (flux volumineux — CDC §13.2). */
export const cursorPage = (res, data, { nextCursor, hasMore, message = null }) =>
  success(res, data, { message, meta: { nextCursor, hasMore: Boolean(hasMore) } });
