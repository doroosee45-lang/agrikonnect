/**
 * Exigences CDC couvertes : CROP-01, CROP-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { slugify } from '../../shared/slug.js';
import { paginationArgs, orderBy, textFilter } from '../../shared/pagination.js';
import { audit } from '../../shared/audit.js';

/**
 * CROP-03 — nom localisé.
 *
 * `Crop.names` porte les traductions (fr, sw, en…). La langue demandée est
 * servie si elle existe ; sinon on retombe sur le nom de référence (fr) puis
 * sur le slug — jamais sur une chaîne vide.
 */
export const localizedName = (crop, locale = 'fr') =>
  crop.names?.[locale] ?? crop.names?.fr ?? crop.name ?? crop.slug;

const withLocale = (crop, locale) => ({ ...crop, name: localizedName(crop, locale) });

/** CROP-01 — lecture du catalogue (ouvert à tous, y compris visiteurs). */
export const list = async (query) => {
  const { page, limit, sort, order, category, search, status, locale = 'fr' } = query;

  const where = {
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { slug: textFilter(search) },
            { category: textFilter(search) },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crop.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'slug', 'category']),
    }),
    prisma.crop.count({ where }),
  ]);

  return { items: items.map((crop) => withLocale(crop, locale)), total, page, limit, locale };
};

export const getOne = async (id, { locale = 'fr' } = {}) => {
  const crop = await prisma.crop.findFirst({
    where: { deletedAt: null, OR: [{ id }, { slug: id }] },
  });
  if (!crop) throw ApiError.notFound('Culture introuvable');
  return withLocale(crop, locale);
};

export const create = async (payload, req) => {
  const slug = payload.slug ?? slugify(payload.names?.fr ?? payload.category);

  const existing = await prisma.crop.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict(`Une culture avec le slug « ${slug} » existe déjà`);

  const crop = await prisma.crop.create({
    data: {
      id: resolveId(),
      slug,
      category: payload.category,
      names: payload.names,
      cycleDays: payload.cycleDays ?? null,
      seasons: payload.seasons ?? undefined,
      units: payload.units ?? undefined,
      agronomy: payload.agronomy ?? undefined,
      status: payload.status,
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'crop.create',
    resource: 'crops',
    resourceId: crop.id,
    req,
    newValue: { slug, category: payload.category },
  });

  return crop;
};

export const update = async (id, payload, req) => {
  const crop = await prisma.crop.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] } });
  if (!crop) throw ApiError.notFound('Culture introuvable');

  const updated = await prisma.crop.update({
    where: { id: crop.id },
    data: { ...payload, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'crop.update',
    resource: 'crops',
    resourceId: crop.id,
    req,
    oldValue: { category: crop.category, status: crop.status },
    newValue: payload,
  });

  return updated;
};
