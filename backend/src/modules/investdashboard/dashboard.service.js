import { prisma } from '../../config/prisma.js';
import { assertInvestorReady } from '../investors/investors.service.js';

/**
 * DASH-INV — Tableau de bord investisseur.
 * Toutes les valeurs sont calculées sur des données réelles et horodatées ;
 * aucun chiffre d'attractivité n'est inventé.
 */
export const overview = async (req) => {
  const profile = await assertInvestorReady(req.user.id);

  const [published, grants, followUps, reports] = await Promise.all([
    prisma.project.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, slug: true, sector: true, countryCode: true,
        fundingNeed: true, durationMonths: true, impact: true, fieldStatus: true, updatedAt: true,
      },
    }),
    prisma.dataRoomAccessRequest.findMany({
      where: { granteeUserId: req.user.id, status: { in: ['PENDING', 'GRANTED'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fundingRequest.findMany({
      where: { project: { organizationId: profile.organizationId ?? '__none__' } },
      select: { status: true },
      take: 100,
    }),
    prisma.impactReport.findMany({
      where: { project: { status: 'PUBLISHED' } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      include: { project: { select: { title: true, countryCode: true } } },
    }),
  ]);

  const verifiedProjects = published.filter((p) =>
    Object.values(p.fieldStatus ?? {}).some((v) => ['platform_verified', 'third_party_verified', 'measured_lab'].includes(v.source)),
  ).length;

  return {
    investor: {
      displayName: profile.displayName,
      verified: Boolean(profile.verifiedAt),
      mfaEnabled: profile.mfaEnabled,
      sectors: profile.sectors,
      countries: profile.countries,
    },
    kpis: {
      publishedProjects: await prisma.project.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      withVerifiedData: verifiedProjects,
      accessGranted: grants.filter((g) => g.status === 'GRANTED').length,
      accessPending: grants.filter((g) => g.status === 'PENDING').length,
      fundingFollowUps: followUps.length,
    },
    highlightedProjects: published.map((p) => ({
      ...p,
      // Provenance résumée : l'investisseur voit ce qui est vérifié
      verifiedFields: Object.entries(p.fieldStatus ?? {})
        .filter(([, v]) => ['platform_verified', 'third_party_verified', 'measured_lab'].includes(v.source))
        .map(([k]) => k),
    })),
    recentImpact: reports.map((r) => ({
      project: r.project.title,
      countryCode: r.project.countryCode,
      period: r.period,
      source: r.source,
      publishedAt: r.publishedAt,
    })),
    notices: [
      'Les données affichées sont datées et sourcées ; aucune projection n\'est garantie.',
      'AGRIKONNECT ne collecte aucun fonds et ne propose aucun produit financier.',
    ],
    generatedAt: new Date().toISOString(),
  };
};
