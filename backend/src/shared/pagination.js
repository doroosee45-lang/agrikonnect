/**
 * Exigences CDC couvertes : NFR-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { z } from 'zod';

/**
 * Pagination commune à toutes les listes (CDC §5.3 : pagination obligatoire).
 * Par défaut : page 1, 20 éléments, 100 maximum.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const paginationArgs = ({ page, limit }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

/** Construit l'objet `orderBy` Prisma à partir de `sort`/`order`. */
export const orderBy = (sort, order, allowed) => {
  const field = allowed.includes(sort) ? sort : allowed[0];
  return { [field]: order };
};

/** Curseur opaque base64 pour les flux volumineux. */
export const encodeCursor = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

export const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

/** Filtre de recherche textuelle insensible à la casse (contains). */
export const textFilter = (value) =>
  value ? { contains: String(value).trim(), mode: 'insensitive' } : undefined;
