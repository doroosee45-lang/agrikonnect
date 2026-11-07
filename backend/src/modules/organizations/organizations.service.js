import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { uniqueSlug } from '../../shared/slug.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

const shape = (organization, roles = []) => ({
  id: organization.id,
  type: organization.type,
  name: organization.name,
  slug: organization.slug,
  description: organization.description,
  countryCode: organization.countryCode,
  roles,
  createdAt: organization.createdAt,
  cooperative: organization.cooperative ?? null,
});

export const listMine = async (req) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id, status: 'ACTIVE', organization: { deletedAt: null } },
    include: { organization: { include: { cooperative: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return memberships.map((m) => shape(m.organization, m.roles));
};

export const getOne = async (id, req) => {
  const membership = req.user.memberships.find((m) => m.organizationId === id);
  if (!membership) throw ApiError.notFound('Organisation introuvable');

  const organization = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    include: { cooperative: true },
  });

  if (!organization) throw ApiError.notFound('Organisation introuvable');
  return shape(organization, membership.roles);
};

export const create = async (payload, req) => {
  const slug = await uniqueSlug(payload.name, async (candidate) =>
    Boolean(await prisma.organization.findFirst({ where: { slug: candidate } })),
  );

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: resolveId(),
        type: payload.type,
        name: payload.name,
        slug,
        description: payload.description ?? null,
        countryCode: payload.countryCode,
        createdBy: req.user.id,
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: req.user.id,
        organizationId: organization.id,
        roles: [payload.type === 'COOPERATIVE' ? 'COOPERATIVE_ADMIN' : 'AGRICULTURAL_COMPANY'],
        status: 'ACTIVE',
        createdBy: req.user.id,
      },
    });

    let cooperative = null;
    if (payload.type === 'COOPERATIVE') {
      cooperative = await tx.cooperative.create({
        data: {
          id: resolveId(),
          organizationId: organization.id,
          legalStatus: payload.legalStatus ?? null,
          foundedYear: payload.foundedYear ?? null,
          description: payload.description ?? null,
          province: payload.province ?? null,
          territory: payload.territory ?? null,
        },
      });
    }

    return { organization, membership, cooperative };
  });

  await audit({
    actorId: req.user.id,
    action: 'organization.create',
    resource: 'organizations',
    resourceId: result.organization.id,
    req,
    newValue: { type: payload.type, name: payload.name },
  });

  return {
    ...shape({ ...result.organization, cooperative: result.cooperative }, result.membership.roles),
  };
};

export const update = async (id, payload, req) => {
  const organization = await prisma.organization.findFirst({ where: { id, deletedAt: null } });
  assertOwnership(organization, req.tenant.organizationId, 'Organisation');

  const { legalStatus, foundedYear, province, territory, ...orgFields } = payload;

  const updated = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({ where: { id }, data: orgFields });

    const cooperative =
      org.type === 'COOPERATIVE'
        ? await tx.cooperative.update({
            where: { organizationId: id },
            data: {
              ...(legalStatus !== undefined ? { legalStatus } : {}),
              ...(foundedYear !== undefined ? { foundedYear } : {}),
              ...(province !== undefined ? { province } : {}),
              ...(territory !== undefined ? { territory } : {}),
            },
          })
        : null;

    return { org, cooperative };
  });

  await audit({
    actorId: req.user.id,
    action: 'organization.update',
    resource: 'organizations',
    resourceId: id,
    req,
    newValue: payload,
  });

  return shape({ ...updated.org, cooperative: updated.cooperative }, req.tenant.roles);
};
