import { prisma } from '../../config/prisma.js';

/**
 * Tableau de bord producteur (CDC V1 §5.11 / §7.4).
 *
 * Règle P3 : chaque tuile est traçable jusqu'à son agrégation. On documente
 * donc explicitement la source de chaque chiffre (`trace`), pour que le front
 * et les tests de cohérence puissent la vérifier.
 */
export const producerDashboard = async (req) => {
  const organizationId = req.tenant.organizationId;

  const [farms, plots, activeCrops, productionAgg, profile] = await Promise.all([
    prisma.farm.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, slug: true, totalAreaHa: true, isPublic: true, viewCount: true },
    }),
    prisma.plot.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, areaHa: true, status: true, currentCropId: true },
    }),
    prisma.plot.findMany({
      where: { organizationId, deletedAt: null, currentCropId: { not: null } },
      select: { currentCropId: true },
      distinct: ['currentCropId'],
    }),
    prisma.production.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { quantityKg: true },
      _count: { _all: true },
    }),
    prisma.profile.findUnique({
      where: { id: req.user.id },
      select: {
        firstName: true,
        lastName: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        avatarUrl: true,
      },
    }),
  ]);

  const cropIds = activeCrops.map((c) => c.currentCropId).filter(Boolean);
  const crops = cropIds.length
    ? await prisma.crop.findMany({
        where: { id: { in: cropIds } },
        select: { id: true, slug: true, names: true },
      })
    : [];

  // Complétude du profil : critères cochés, pas de score opaque (PROF-03)
  const criteria = [
    { key: 'identity', label: 'Nom et prénom', done: Boolean(profile?.firstName && profile?.lastName) },
    { key: 'phone_verified', label: 'Téléphone vérifié', done: Boolean(profile?.phoneVerifiedAt) },
    { key: 'email_verified', label: 'Email vérifié', done: Boolean(profile?.emailVerifiedAt) },
    { key: 'avatar', label: 'Photo de profil', done: Boolean(profile?.avatarUrl) },
    { key: 'farm', label: 'Exploitation créée', done: farms.length > 0 },
    { key: 'plot', label: 'Parcelle localisée', done: plots.length > 0 },
    { key: 'production', label: 'Production déclarée', done: productionAgg._count._all > 0 },
  ];

  const totalAreaHa =
    Math.round(plots.reduce((acc, p) => acc + (p.areaHa ?? 0), 0) * 100) / 100;

  const profileViews = farms.reduce((acc, f) => acc + f.viewCount, 0);

  return {
    tiles: {
      totalAreaHa: {
        value: totalAreaHa,
        unit: 'ha',
        source: 'sum(plots.area_ha)',
        note: 'Somme des superficies des parcelles non archivées',
      },
      plots: {
        value: plots.length,
        source: 'count(plots)',
      },
      activeCrops: {
        value: crops.length,
        items: crops.map((c) => ({ id: c.id, slug: c.slug, name: c.names?.fr ?? c.slug })),
        source: 'distinct(plots.current_crop_id)',
      },
      productionKg: {
        value: productionAgg._sum.quantityKg ?? 0,
        records: productionAgg._count._all,
        source: 'sum(productions.quantity_kg)',
        note: 'Uniquement les productions dont l\'unité est convertible en kg',
      },
      profileViews: {
        value: profileViews,
        source: 'sum(farms.view_count)',
        note: 'Vues agrégées, sans donnée personnelle des visiteurs',
      },
      profileCompleteness: {
        done: criteria.filter((c) => c.done).length,
        total: criteria.length,
        criteria,
        missing: criteria.filter((c) => !c.done).map((c) => c.label),
      },
    },
    farms: farms.map((f) => ({ id: f.id, name: f.name, slug: f.slug, isPublic: f.isPublic })),
    /** États vides pédagogiques (CDC §5.11, §7.3) */
    onboarding: {
      hasFarm: farms.length > 0,
      hasPlot: plots.length > 0,
      hasProduction: productionAgg._count._all > 0,
      nextAction: farms.length === 0
        ? 'Crée ta première exploitation pour commencer.'
        : plots.length === 0
          ? 'Ajoute ta première parcelle pour la localiser sur la carte.'
          : productionAgg._count._all === 0
            ? 'Enregistre ta première production déclarée.'
            : 'Publie ton profil public pour partager ton exploitation.',
    },
  };
};
