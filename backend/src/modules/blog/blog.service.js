import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';

const publicListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  authorName: true,
  publishedAt: true,
};

const publicDetailSelect = {
  ...publicListSelect,
  content: true,
  createdAt: true,
  updatedAt: true,
};

const adminSelect = {
  ...publicDetailSelect,
  status: true,
};

const publishedWhere = (now) => ({
  status: 'PUBLISHED',
  publishedAt: { lte: now },
});

/** Liste uniquement les articles publiés et déjà en ligne. */
export const listPublished = async ({ page = 1, limit = 6, includeContent = false } = {}) => {
  const now = new Date();
  const where = publishedWhere(now);
  const select = includeContent ? { ...publicListSelect, content: true } : publicListSelect;
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      select,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { items, total, page, limit };
};

/** Lecture publique par slug : brouillons et articles futurs restent invisibles. */
export const getPublishedBySlug = async (slug) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere(new Date()) },
    select: publicDetailSelect,
  });
  if (!post) throw ApiError.notFound('Article introuvable');
  return post;
};

/** Liste complète réservée aux administrateurs autorisés. */
export const listAdmin = async ({ page = 1, limit = 20, status } = {}) => {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      select: adminSelect,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { items, total, page, limit };
};

const auditSummary = (post) => ({
  slug: post.slug,
  title: post.title,
  status: post.status,
  publishedAt: post.publishedAt,
});

const handleUniqueSlug = (error) => {
  if (error?.code === 'P2002') throw ApiError.badRequest('Ce slug est déjà utilisé');
  throw error;
};

/** Création d’un article, brouillon par défaut; publication explicitement demandée. */
export const createPost = async (input, req) => {
  const status = input.status ?? 'DRAFT';
  const now = new Date();
  let post;
  try {
    post = await prisma.blogPost.create({
      data: {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        imageUrl: input.imageUrl,
        authorName: input.authorName,
        content: input.content,
        status,
        publishedAt: status === 'PUBLISHED' ? now : null,
      },
      select: adminSelect,
    });
  } catch (error) {
    handleUniqueSlug(error);
  }
  await auditAs(req, {
    action: 'admin.blog_post.create',
    resource: 'blog_posts',
    resourceId: post.id,
    newValue: auditSummary(post),
  });
  return post;
};

/** Modification et publication/dépublication avec journalisation homogène. */
export const updatePost = async (id, input, req) => {
  const before = await prisma.blogPost.findUnique({ where: { id }, select: adminSelect });
  if (!before) throw ApiError.notFound('Article introuvable');

  const status = input.status ?? before.status;
  const publishedAt = status === 'DRAFT'
    ? null
    : before.status === 'PUBLISHED' && before.publishedAt
      ? before.publishedAt
      : new Date();

  let after;
  try {
    after = await prisma.blogPost.update({
      where: { id },
      data: { ...input, status, publishedAt },
      select: adminSelect,
    });
  } catch (error) {
    handleUniqueSlug(error);
  }
  await auditAs(req, {
    action: 'admin.blog_post.update',
    resource: 'blog_posts',
    resourceId: after.id,
    oldValue: auditSummary(before),
    newValue: auditSummary(after),
  });
  return after;
};

/** Suppression d'un article avec journalisation de son dernier etat. */
export const deletePost = async (id, req) => {
  const post = await prisma.blogPost.findUnique({ where: { id }, select: adminSelect });
  if (!post) throw ApiError.notFound('Article introuvable');

  const deleted = await prisma.blogPost.delete({ where: { id }, select: adminSelect });
  await auditAs(req, {
    action: 'admin.blog_post.delete',
    resource: 'blog_posts',
    resourceId: deleted.id,
    oldValue: auditSummary(deleted),
  });
  return { id: deleted.id };
};
