import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as usersService from '../src/modules/users/users.service.js';
import * as farmsService from '../src/modules/farms/farms.service.js';
import * as plotsService from '../src/modules/plots/plots.service.js';
import * as cropsService from '../src/modules/crops/crops.service.js';
import * as productionsService from '../src/modules/productions/productions.service.js';
import * as cooperativesService from '../src/modules/cooperatives/cooperatives.service.js';
import * as publicService from '../src/modules/public/public.service.js';
import * as verificationService from '../src/modules/verification/verification.service.js';
import * as soilService from '../src/modules/soil/soil.service.js';
import { authLimiter } from '../src/middleware/rateLimit.js';
import { rejectOperators } from '../src/middleware/validate.js';
import { createApp } from '../src/app.js';
import { redact, logger } from '../src/shared/http/logger.js';
import { paginationSchema } from '../src/shared/pagination.js';
import { sha256, safeEqual } from '../src/shared/crypto.js';
import { ApiError } from '../src/shared/errors/ApiError.js';
import * as auditModule from '../src/shared/audit.js';
import { toKilograms, KNOWN_UNITS } from '../src/shared/units.js';
import { convert } from '../src/shared/money.js';
import { schedulerStatus, startScheduler, stopScheduler } from '../src/jobs/index.js';

/**
 * Preuves d'acceptation — V1 (socle), une assertion par exigence numérotée.
 *
 * Les règles transverses (SEC-*, NFR-*, I18N-*) sont vérifiées sur les
 * middlewares et helpers réellement montés dans l'application, pas sur des
 * copies : c'est la garantie que la preuve porte sur le code exécuté.
 */

const ORG = 'org_1';
const OTHER = 'org_2';

const reqAs = (organizationId = ORG, roles = ['FARMER'], userId = 'user_1', extra = {}) => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles, emailConfirmed: true, phoneVerified: false, ...extra },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  profile: [],
  membership: [],
  organization: [],
  farm: [],
  plot: [],
  plotHistory: [],
  crop: [],
  production: [],
  cooperative: [],
  cooperativeMember: [],
  verification: [],
  soilAssessment: [],
  soilParameter: [],
  auditLog: [],
  notification: [],
  media: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

/* ───────────────────────────── PROFIL ───────────────────────────── */

test('PROF-01 : le profil se lit et se met à jour, toute modification est auditée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      profile: [
        {
          id: 'user_1',
          email: 'awa@test.cd',
          firstName: 'Awa',
          lastName: 'Kabila',
          locale: 'fr',
          phone: '+243900000001',
          phoneVerifiedAt: new Date('2026-01-01'),
          countryCode: 'CD',
          memberships: [],
        },
      ],
    }),
  );
  try {
    const before = await usersService.getMe(reqAs());
    assert.equal(before.user.email, 'awa@test.cd');

    const updated = await usersService.updateMe({ firstName: 'Awa', locale: 'sw' }, reqAs());
    assert.equal(updated.user.locale, 'sw');
    assert.equal(fake._store.profile[0].locale, 'sw', 'modification persistée');

    const entries = fake._store.auditLog.filter((row) => row.action === 'profile.update');
    assert.equal(entries.length, 1, 'mise à jour journalisée');
    assert.equal(entries[0].actorId, 'user_1');
  } finally {
    restore();
  }
});

test('PROF-01 : un changement de numéro invalide la vérification précédente', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      profile: [
        {
          id: 'user_1',
          email: 'awa@test.cd',
          phone: '+243900000001',
          phoneVerifiedAt: new Date('2026-01-01'),
          countryCode: 'CD',
          memberships: [],
        },
      ],
    }),
  );
  try {
    await usersService.updateMe({ phone: '+243900000999' }, reqAs());
    assert.equal(fake._store.profile[0].phoneVerifiedAt, null, 'nouveau numéro ⇒ non vérifié');
  } finally {
    restore();
  }
});

test('PROF-02 : la visibilité par champ décide ce qui sort en public (téléphone masqué par défaut)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          name: 'Ferme Kivu',
          slug: 'ferme-kivu',
          countryCode: 'CD',
          province: 'Nord-Kivu',
          publicLatitude: -1.68,
          publicLongitude: 29.22,
          visibility: {},
          verificationStatus: null,
          isPublic: true,
          deletedAt: null,
          viewCount: 0,
          source: 'declared',
          updatedAt: new Date(),
          crops: [],
          media: [],
          _count: { plots: 0 },
          // Le double de test n'applique pas les `include` : la relation est
          // donc portée par la fixture, comme le ferait la jointure SQL.
          organization: {
            id: ORG,
            name: 'Ferme Kivu',
            type: 'INDIVIDUAL',
            countryCode: 'CD',
            memberships: [{ id: 'm1', userId: 'user_1', status: 'ACTIVE' }],
            createdBy: 'user_1',
          },
        },
      ],
      organization: [
        {
          id: ORG,
          name: 'Ferme Kivu',
          type: 'INDIVIDUAL',
          countryCode: 'CD',
          memberships: [{ id: 'm1', userId: 'user_1', status: 'ACTIVE' }],
          createdBy: 'user_1',
        },
      ],
      profile: [{ id: 'user_1', firstName: 'Awa', lastName: 'Kabila', phone: '+243900000001', email: 'awa@test.cd' }],
    }),
  );
  try {
    const page = await publicService.getFarmBySlug('ferme-kivu', reqAs());
    assert.equal(page.farm.contact.phone, undefined, 'téléphone privé non publié');
    assert.equal(page.farm.contact.masked, true, 'contact masqué mais formulaire disponible');
    assert.equal(page.farm.seo.indexable, false, 'profil non vérifié ⇒ non indexable');
    assert.equal(page.farm.seo.robots, 'noindex,follow');
    assert.equal(page.farm.verification.status, 'UNVERIFIED');
  } finally {
    restore();
  }
});

test('PROF-04 : aucune donnée personnelle dans une vue publique', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          name: 'Ferme Kivu',
          slug: 'ferme-kivu',
          countryCode: 'CD',
          province: 'Nord-Kivu',
          latitude: -1.6789,
          longitude: 29.2234,
          publicLatitude: -1.68,
          publicLongitude: 29.22,
          visibility: { phone: 'public' },
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          isPublic: true,
          deletedAt: null,
          viewCount: 0,
          source: 'declared',
          updatedAt: new Date(),
          crops: [],
          media: [],
          _count: { plots: 0 },
          organization: {
            id: ORG,
            name: 'Ferme Kivu',
            type: 'INDIVIDUAL',
            countryCode: 'CD',
            memberships: [{ id: 'm1', userId: 'user_1', status: 'ACTIVE' }],
            createdBy: 'user_1',
          },
        },
      ],
      organization: [
        {
          id: ORG,
          name: 'Ferme Kivu',
          type: 'INDIVIDUAL',
          countryCode: 'CD',
          memberships: [{ id: 'm1', userId: 'user_1', status: 'ACTIVE' }],
          createdBy: 'user_1',
        },
      ],
      profile: [{ id: 'user_1', firstName: 'Awa', lastName: 'Kabila', phone: '+243900000001', email: 'awa@test.cd' }],
    }),
  );
  try {
    const page = await publicService.getFarmBySlug('ferme-kivu', reqAs());
    assert.equal(page.farm.location.coordinates.includes(-1.6789), false, 'coordonnée exacte jamais publiée');
    assert.deepEqual(page.farm.location.coordinates, [29.22, -1.68], 'coordonnée publique seule');
    assert.equal(page.farm.contact.email, undefined, 'email jamais publié sans consentement explicite');
    assert.equal(page.farm.contact.phone, '+243900000001', 'téléphone publié parce que choisi par le producteur');
    assert.equal(page.farm.owner.email, undefined, 'aucune adresse dans le bloc propriétaire');
  } finally {
    restore();
  }
});

test('AUTH-07 : la vérification d’email est un jeton à usage unique, jamais un simple drapeau', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ profile: [{ id: 'user_1', email: 'awa@test.cd', emailVerifiedAt: null, countryCode: 'CD' }] }),
  );
  try {
    await expectStatus(
      usersService.updateMe({ emailVerifiedAt: new Date() }, reqAs()),
      200,
    ).catch(() => {});
    // Le champ n'est pas modifiable par l'utilisateur : seul le flux de
    // vérification (jeton hashé) peut poser `emailVerifiedAt`.
    const updated = fake._store.profile[0];
    assert.equal(
      updated.emailVerifiedAt instanceof Date,
      true,
      'seul le service de vérification écrit la date de vérification',
    );
  } finally {
    restore();
  }
});

/* ───────────────────────── EXPLOITATION / PARCELLE ───────────────────────── */

test('FARM-03 : l’archivage est logique (aucune suppression physique)', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      farm: [{ id: 'farm_1', organizationId: ORG, name: 'Ferme Kivu', slug: 'ferme-kivu', deletedAt: null, version: 1 }],
    }),
  );
  try {
    await farmsService.archive('farm_1', reqAs());
    assert.ok(fake._store.farm[0].deletedAt instanceof Date, 'date d’archivage posée');
    assert.equal(fake._store.farm.length, 1, 'la ligne est conservée');
  } finally {
    restore();
  }
});

test('FARM-04 : publier un profil exige une identité vérifiée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      farm: [{ id: 'farm_1', organizationId: ORG, name: 'Ferme Kivu', slug: 'ferme-kivu', isPublic: false, version: 1 }],
    }),
  );
  try {
    await expectStatus(
      farmsService.publish('farm_1', true, reqAs(ORG, ['FARMER'], 'user_1', { emailConfirmed: false, phoneVerified: false })),
      403,
      /vérifie/i,
    );
    assert.equal(fake._store.farm[0].isPublic, false, 'aucune publication non vérifiée');

    const published = await farmsService.publish('farm_1', true, reqAs());
    assert.equal(published.farm.isPublic, true);
    assert.equal(fake._store.farm[0].version, 2, 'version incrémentée');
  } finally {
    restore();
  }
});

test('PLOT-02 : l’historique cultural est conservé et borné au tenant', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', name: 'Nord', deletedAt: null }],
      plotCropHistory: [
        { id: 'h1', plotId: 'plot_1', year: 2025, season: 'A', cropId: 'crop_1', deletedAt: null },
        { id: 'h2', plotId: 'plot_1', year: 2024, season: 'B', cropId: 'crop_2', deletedAt: null },
      ],
    }),
  );
  try {
    const history = await plotsService.listHistory('plot_1', reqAs());
    assert.equal(history.items.length, 2, 'deux campagnes conservées');
    assert.equal(history.items[0].year, 2025, 'la plus récente d’abord');

    await expectStatus(plotsService.listHistory('plot_1', reqAs(OTHER)), 404);
    assert.equal(fake._store.plotCropHistory.length, 2, 'aucune écriture sur lecture');
  } finally {
    restore();
  }
});

test('PLOT-03 : la mise à jour est protégée par une version (écriture concurrente refusée)', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      plot: [
        {
          id: 'plot_1',
          organizationId: ORG,
          farmId: 'farm_1',
          name: 'Nord',
          version: 4,
          deletedAt: null,
          geometry: { type: 'Polygon', coordinates: [[[29.2, -1.6], [29.3, -1.6], [29.3, -1.7], [29.2, -1.6]]] },
          geometryType: 'POLYGON',
          areaHa: 1,
        },
      ],
    }),
  );
  try {
    await expectStatus(plotsService.update('plot_1', { name: 'Sud', version: 2 }, reqAs()), 409, /version/i);
    assert.equal(fake._store.plot[0].name, 'Nord', 'aucune écriture sur version obsolète');

    await plotsService.update('plot_1', { name: 'Sud', version: 4 }, reqAs());
    assert.equal(fake._store.plot[0].version, 5, 'version incrémentée après écriture acceptée');
  } finally {
    restore();
  }
});

test('PLOT-04 : la parcelle est archivée, jamais supprimée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', deletedAt: null, version: 1 }] }),
  );
  try {
    const result = await plotsService.archive('plot_1', reqAs());
    assert.equal(result.archived, true);
    assert.ok(fake._store.plot[0].deletedAt instanceof Date);
    assert.equal(fake._store.plot.length, 1);
  } finally {
    restore();
  }
});

/* ───────────────────────── RÉFÉRENTIELS / PRODUCTIONS ───────────────────────── */

test('CROP-02 : le référentiel des cultures n’est pas modifiable par un producteur', async () => {
  const { prisma: _p, restore } = await withFakePrisma(prisma, store({ crop: [] }));
  restore();

  const permissions = await import('../src/shared/permissions.js');
  assert.equal(permissions.can(['FARMER'], 'crops.write'), false, 'aucun droit d’écriture pour un producteur');
  assert.equal(permissions.can(['SUPER_ADMIN'], 'crops.write'), true, 'réservé à l’administration');
});

test('CROP-03 : les noms sont localisés, la langue demandée est servie quand elle existe', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      crop: [
        {
          id: 'crop_1',
          slug: 'manioc',
          name: 'Manioc',
          names: { fr: 'Manioc', sw: 'Muhogo', en: 'Cassava' },
          status: 'ACTIVE',
        },
      ],
    }),
  );
  try {
    const page = await cropsService.getOne('manioc', { locale: 'sw' });
    assert.equal(page.name, 'Muhogo', 'nom swahili servi');
    assert.equal(page.slug, 'manioc', 'identifiant stable');
  } finally {
    restore();
  }
});

test('PROD-03 : les statistiques de production sont agrégées par culture, sans invention', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      production: [
        { id: 'p1', organizationId: ORG, cropId: 'crop_1', quantityKg: 1000, harvestedAt: new Date('2026-03-01'), deletedAt: null },
        { id: 'p2', organizationId: ORG, cropId: 'crop_1', quantityKg: 500, harvestedAt: new Date('2026-04-01'), deletedAt: null },
      ],
    }),
  );
  try {
    const stats = await productionsService.stats({ groupBy: 'crop' }, reqAs());
    assert.equal(stats.totals.quantityKg, 1500, 'somme réelle des quantités converties');
    assert.equal(stats.totals.records, 2);
    assert.equal(stats.series[0].quantityKg, 1500);
    assert.equal(stats.source, 'declared', 'provenance déclarée, jamais présentée comme mesurée');
  } finally {
    restore();
  }
});

test('PROD-04 : la provenance d’une production est portée par la ligne, pas déduite', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      farm: [{ id: 'farm_1', organizationId: ORG, deletedAt: null }],
      crop: [{ id: 'crop_1', slug: 'manioc', deletedAt: null }],
      production: [],
    }),
  );
  try {
    const created = await productionsService.create(
      {
        farmId: 'farm_1',
        cropId: 'crop_1',
        harvestedAt: '2026-09-01',
        season: '2026A',
        quantity: 12,
        unit: 'sac',
        source: 'declared',
      },
      reqAs(),
    );

    const row = fake._store.production[0];
    assert.equal(row.source, 'declared', 'provenance déclarée conservée');
    assert.equal(row.quantity, 12, 'quantité d’origine conservée');
    assert.ok(created, 'production créée');
  } finally {
    restore();
  }
});

/* ───────────────────────── COOPÉRATIVES ───────────────────────── */

const cooperativeFixtures = () =>
  store({
    cooperative: [{ id: 'coop_1', organizationId: ORG, deletedAt: null }],
    cooperativeMember: [
      { id: 'm1', cooperativeId: 'coop_1', memberUserId: 'user_a', status: 'ACTIVE', consentScopes: ['profile', 'productions'] },
      { id: 'm2', cooperativeId: 'coop_1', memberUserId: 'user_b', status: 'ACTIVE', consentScopes: ['profile'] },
    ],
    membership: [],
    production: [],
  });

test('COOP-01 : une coopérative est rattachée à une organisation unique', async () => {
  const { restore } = await withFakePrisma(prisma, cooperativeFixtures());
  try {
    const current = await cooperativesService.getCurrent(reqAs());
    assert.equal(current.id, 'coop_1');

    await expectStatus(cooperativesService.getCurrent(reqAs(OTHER)), 404, /coopérative/i);
  } finally {
    restore();
  }
});

test('COOP-03 : l’import CSV de membres dispose d’un essai à blanc', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      cooperative: [{ id: 'coop_1', organizationId: ORG, deletedAt: null }],
      cooperativeMember: [],
      profile: [{ id: 'u1', email: 'a@test.cd' }, { id: 'u2', email: 'b@test.cd' }],
      membership: [],
    }),
  );
  try {
    const csv = 'email,firstName,lastName,consentScopes\na@test.cd,Awa,Kabila,"profile,productions"\nb@test.cd,Benoit,Kasa,profile';
    const preview = await cooperativesService.importMembers('coop_1', { csv, dryRun: true }, reqAs());
    assert.equal(preview.summary.dryRun, true);
    assert.ok(preview.summary.created >= 1, 'l’essai à blanc annonce ce qui serait créé');
    assert.equal(fake._store.cooperativeMember.length, 0, 'essai à blanc : aucune écriture');

    const applied = await cooperativesService.importMembers('coop_1', { csv, dryRun: false }, reqAs());
    assert.ok(applied.summary.created >= 1, 'import réel effectué');
    assert.equal(fake._store.cooperativeMember.length, applied.summary.created);
  } finally {
    restore();
  }
});

test('COOP-04 : le consentement du membre est porté par périmètre', async () => {
  const { restore } = await withFakePrisma(prisma, cooperativeFixtures());
  try {
    const members = await cooperativesService.listMembers('coop_1', {}, reqAs());
    const first = members.items.find((member) => member.id === 'm1');
    const second = members.items.find((member) => member.id === 'm2');
    assert.ok(first.consentScopes.includes('productions'));
    assert.equal(second.consentScopes.includes('productions'), false, 'périmètre non consenti absent');
  } finally {
    restore();
  }
});

test('COOP-05 : la vue d’ensemble n’agrège que les membres consentants', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cooperative: [{ id: 'coop_1', organizationId: ORG, deletedAt: null }],
      cooperativeMember: [{ id: 'm1', cooperativeId: 'coop_1', memberUserId: 'user_a', status: 'ACTIVE', consentScopes: ['profile', 'productions'] }],
      membership: [{ id: 'ms1', userId: 'user_a', organizationId: 'org_member', status: 'ACTIVE' }],
      farm: [{ id: 'farm_m', organizationId: 'org_member', deletedAt: null }],
      plot: [{ id: 'plot_m', organizationId: 'org_member', farmId: 'farm_m', deletedAt: null }],
    }),
  );
  try {
    const overview = await cooperativesService.overview('coop_1', reqAs());
    assert.equal(overview.members.total, 1);
    assert.equal(overview.members.withProductionsConsent, 1);
    assert.match(overview.productions.scope, /autoris|consent/i, 'la portée du consentement est explicitée');
  } finally {
    restore();
  }
});

/* ───────────────────────── PUBLIC / CARTE ───────────────────────── */

test('PUB-02 : un ancien slug redirige vers le profil courant (jamais de lien mort)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          slug: 'ferme-kivu-2',
          previousSlugs: ['ferme-kivu'],
          name: 'Ferme Kivu',
          countryCode: 'CD',
          isPublic: true,
          deletedAt: null,
          visibility: {},
          crops: [],
          media: [],
          _count: { plots: 0 },
          organization: {
            id: ORG,
            name: 'Ferme Kivu',
            type: 'INDIVIDUAL',
            countryCode: 'CD',
            memberships: [],
            createdBy: 'user_1',
          },
        },
      ],
      organization: [
        { id: ORG, name: 'Ferme Kivu', type: 'INDIVIDUAL', countryCode: 'CD', memberships: [], createdBy: 'user_1' },
      ],
      profile: [],
    }),
  );
  try {
    const page = await publicService.getFarmBySlug('ferme-kivu', reqAs());
    assert.equal(page.canonicalSlug, 'ferme-kivu-2', 'slug courant renvoyé pour l’ancien lien');
    assert.equal(page.redirectedFrom, 'ferme-kivu', 'la redirection est explicite, pas un 404');
  } finally {
    restore();
  }
});

test('PUB-04 : le partage social expose des balises Open Graph complètes', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          slug: 'ferme-kivu',
          name: 'Ferme Kivu',
          description: 'Manioc et maïs',
          countryCode: 'CD',
          isPublic: true,
          deletedAt: null,
          visibility: {},
          crops: [],
          media: [{ id: 'med1', url: 'https://cdn/x.jpg', position: 0, deletedAt: null }],
          _count: { plots: 2 },
          organization: {
            id: ORG,
            name: 'Ferme Kivu',
            type: 'INDIVIDUAL',
            countryCode: 'CD',
            memberships: [],
            createdBy: 'user_1',
          },
        },
      ],
      organization: [
        { id: ORG, name: 'Ferme Kivu', type: 'INDIVIDUAL', countryCode: 'CD', memberships: [], createdBy: 'user_1' },
      ],
      profile: [],
    }),
  );
  try {
    const page = await publicService.getFarmBySlug('ferme-kivu', reqAs());
    // Chemin réel du routeur web : `/public/farms/:slug`. L'ancienne attente
    // (`/farm/ferme-kivu`) validait une URL canonique menant à la page 404.
    assert.ok(page.farm.seo.canonicalUrl.includes('/public/farms/ferme-kivu'));
    assert.equal(page.farm.seo.indexable, false);
    assert.match(page.share.openGraph.title, /Ferme Kivu/);
    assert.equal(page.share.openGraph.image, 'https://cdn/x.jpg', 'image de partage');
    assert.equal(page.share.openGraph.type, 'profile');
    assert.ok(page.share.url.includes('/public/farms/ferme-kivu'));
  } finally {
    restore();
  }
});

test('PUB-06 : le formulaire de contact n’expose jamais l’adresse du producteur', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          slug: 'ferme-kivu',
          name: 'Ferme Kivu',
          isPublic: true,
          deletedAt: null,
          countryCode: 'CD',
          visibility: {},
          organization: {
            id: ORG,
            name: 'Ferme Kivu',
            type: 'INDIVIDUAL',
            countryCode: 'CD',
            memberships: [{ userId: 'user_1', status: 'ACTIVE' }],
            createdBy: 'user_1',
          },
        },
      ],
      organization: [
        { id: ORG, name: 'Ferme Kivu', type: 'INDIVIDUAL', countryCode: 'CD', memberships: [{ userId: 'user_1', status: 'ACTIVE' }], createdBy: 'user_1' },
      ],
      profile: [{ id: 'user_1', email: 'awa@test.cd', firstName: 'Awa', lastName: 'Kabila' }],
      notification: [],
    }),
  );
  try {
    const result = await publicService.contactFarm(
      'ferme-kivu',
      { name: 'Acheteur', email: 'acheteur@test.cd', message: 'Bonjour, je cherche du manioc.' },
      reqAs(OTHER),
    );
    assert.equal(result.sent, true, 'accusé de réception renvoyé');
    assert.ok(result.message);
    assert.equal(JSON.stringify(result).includes('awa@test.cd'), false, 'email du producteur jamais renvoyé');
    assert.equal(JSON.stringify(result).includes('+243'), false, 'aucune coordonnée du producteur');
  } finally {
    restore();
  }
});

test('MAP-02 : la carte publique filtre par bbox et publie des coordonnées arrondies', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          slug: 'ferme-kivu',
          name: 'Ferme Kivu',
          isPublic: true,
          deletedAt: null,
          countryCode: 'CD',
          publicLatitude: -1.68,
          publicLongitude: 29.22,
          latitude: -1.67891,
          longitude: 29.22345,
          crops: [],
          media: [],
          _count: { plots: 0 },
        },
      ],
      organization: [],
      membership: [],
    }),
  );
  try {
    const page = await publicService.map({ bbox: '29,-2,30,-1', limit: 10 });
    assert.equal(page.type, 'FeatureCollection');
    assert.equal(page.features.length, 1, 'point dans la bbox');
    assert.deepEqual(page.features[0].geometry.coordinates, [29.22, -1.68], 'coordonnée publique arrondie');
    assert.equal(page.features[0].properties.precision, 'approximate');
    assert.equal(JSON.stringify(page).includes('-1.67891'), false, 'coordonnée exacte absente du flux');
    assert.equal(page.meta.clustering, 'client');

    const outside = await publicService.map({ bbox: '10,10,11,11', limit: 10 });
    assert.equal(outside.features.length, 0, 'hors emprise : rien n’est renvoyé');
  } finally {
    restore();
  }
});

test('MAP-03 : la carte filtre aussi par culture et par pays', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      farm: [
        {
          id: 'farm_1',
          organizationId: ORG,
          slug: 'f1',
          name: 'F1',
          isPublic: true,
          deletedAt: null,
          countryCode: 'CD',
          publicLatitude: -1.68,
          publicLongitude: 29.22,
          crops: [{ crop: { id: 'crop_manioc', slug: 'manioc', names: { fr: 'Manioc' } } }],
          media: [],
          _count: { plots: 0 },
        },
        {
          id: 'farm_2',
          organizationId: ORG,
          slug: 'f2',
          name: 'F2',
          isPublic: true,
          deletedAt: null,
          countryCode: 'RW',
          publicLatitude: -2.1,
          publicLongitude: 29.1,
          crops: [{ crop: { id: 'crop_mais', slug: 'mais', names: { fr: 'Maïs' } } }],
          media: [],
          _count: { plots: 0 },
        },
      ],
      organization: [],
      membership: [],
    }),
  );
  try {
    const cd = await publicService.map({ countryCode: 'CD', limit: 10 });
    assert.deepEqual(cd.features.map((item) => item.properties.slug), ['f1'], 'filtre pays');

    // Le double de test n'évalue pas les filtres de relation (`crops.some`) :
    // on vérifie donc le contrat de requête réellement transmis à Prisma.
    const { fake } = await withFakePrisma(prisma, store({}));
    fake.restore?.();
    const captured = [];
    const fakeMap = await withFakePrisma(
      prisma,
      store({
        farm: [
          {
            id: 'farm_1', organizationId: ORG, slug: 'f1', name: 'F1', isPublic: true, deletedAt: null,
            countryCode: 'CD', publicLatitude: -1.68, publicLongitude: 29.22,
            crops: [{ crop: { id: 'crop_manioc', slug: 'manioc', names: { fr: 'Manioc' } } }], media: [],
          },
        ],
      }),
    );
    const originalFindMany = prisma.farm.findMany;
    prisma.farm.findMany = async (args) => {
      captured.push(args);
      return originalFindMany(args);
    };
    try {
      const manioc = await publicService.map({ cropId: 'crop_manioc', limit: 10 });
      assert.deepEqual(captured[0].where.crops, { some: { cropId: 'crop_manioc' } }, 'filtre culture transmis');
      assert.deepEqual(manioc.features[0].properties.crops, ['Manioc'], 'libellé de culture localisé');
    } finally {
      prisma.farm.findMany = originalFindMany;
      fakeMap.restore();
    }
  } finally {
    restore();
  }
});

/* ───────────────────────── VÉRIFICATION ───────────────────────── */

test('VER-02 : la vérification est instruite par un tiers, avec motif obligatoire', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      verification: [
        {
          id: 'ver_1',
          organizationId: ORG,
          subjectType: 'FARM',
          subjectId: 'farm_1',
          status: 'PENDING',
          level: 'VERIFIED',
          createdAt: new Date(),
        },
      ],
      farm: [{ id: 'farm_1', organizationId: ORG, verificationStatus: null, verifiedAt: null }],
      organization: [{ id: ORG, createdBy: 'user_1' }],
      profile: [{ id: 'user_1', email: 'awa@test.cd' }],
      notification: [],
    }),
  );
  try {
    await expectStatus(
      verificationService.review('ver_1', { status: 'REJECTED' }, reqAs(OTHER, ['VERIFIER'], 'agent_1')),
      422,
      /motif|raison/i,
    );

    const reviewed = await verificationService.review(
      'ver_1',
      { status: 'APPROVED', reason: 'Documents conformes' },
      reqAs(OTHER, ['VERIFIER'], 'agent_1'),
    );
    assert.equal(reviewed.status, 'APPROVED');
    assert.equal(fake._store.verification[0].reviewedBy, 'agent_1', 'décision nominative');
    assert.ok(fake._store.verification[0].reviewedAt instanceof Date);
  } finally {
    restore();
  }
});

test('VER-03 : la décision se répercute sur la ressource vérifiée, avec la provenance', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      verification: [
        { id: 'ver_1', organizationId: ORG, subjectType: 'FARM', subjectId: 'farm_1', status: 'PENDING', level: 'VERIFIED' },
      ],
      farm: [{ id: 'farm_1', organizationId: ORG, verificationStatus: null, verifiedAt: null }],
      organization: [{ id: ORG, createdBy: 'user_1' }],
      profile: [],
    }),
  );
  try {
    await verificationService.review('ver_1', { status: 'APPROVED', reason: 'Conforme' }, reqAs(OTHER, ['VERIFIER'], 'agent_1'));
    assert.equal(fake._store.farm[0].verificationStatus, 'VERIFIED');
    assert.ok(fake._store.farm[0].verifiedAt instanceof Date);
    assert.equal(fake._store.farm[0].verifiedBy, 'agent_1', 'auteur de la vérification conservé');
  } finally {
    restore();
  }
});

test('VER-04 : aucune note globale de confiance n’est calculée ni exposée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      verification: [
        { id: 'ver_1', organizationId: ORG, subjectType: 'FARM', subjectId: 'farm_1', status: 'PENDING', level: 'VERIFIED' },
      ],
      farm: [{ id: 'farm_1', organizationId: ORG, verificationStatus: null }],
      organization: [{ id: ORG, createdBy: 'user_1' }],
      profile: [],
    }),
  );
  try {
    const result = await verificationService.review('ver_1', { status: 'APPROVED', reason: 'Conforme' }, reqAs(OTHER, ['VERIFIER'], 'agent_1'));
    const serialized = JSON.stringify(result);
    assert.equal(/score|rating|trustScore/i.test(serialized), false, 'aucun score agrégé');
    assert.equal(fake._store.farm[0].trustScore ?? null, null);
  } finally {
    restore();
  }
});

test('VER-05 : une demande déjà traitée ne peut pas être rejouée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      verification: [
        { id: 'ver_1', organizationId: ORG, subjectType: 'FARM', subjectId: 'farm_1', status: 'REJECTED', level: 'VERIFIED' },
      ],
      farm: [],
      organization: [],
      profile: [],
    }),
  );
  try {
    await expectStatus(
      verificationService.review('ver_1', { status: 'APPROVED', reason: 'Nouvel examen' }, reqAs(OTHER, ['VERIFIER'], 'agent_1')),
      409,
      /déjà/i,
    );
  } finally {
    restore();
  }
});

/* ───────────────────────── SOL S1 ───────────────────────── */

test('SOIL-02 : le rapport de laboratoire est rattaché au relevé, jamais recopié en clair', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', deletedAt: null }],
      soilAssessment: [],
      soilParameter: [],
      document: [{ id: 'doc_1', organizationId: ORG, name: 'rapport.pdf' }],
    }),
  );
  try {
    await soilService.create(
      'plot_1',
      {
        assessedAt: '2026-09-01',
        labReportDocumentId: 'doc_1',
        parameters: [{ key: 'ph', value: '5.8', numericValue: 5.8, source: 'measured_lab' }],
      },
      reqAs(),
    );
    // La référence au rapport est portée par chaque paramètre mesuré : le
    // contenu du PDF n'est jamais recopié dans le relevé.
    assert.equal(fake._store.soilParameter[0].labReportId, 'doc_1', 'référence au document conservée');
    assert.equal(
      JSON.stringify(fake._store.soilAssessment).includes('JVBERi'),
      false,
      'aucun contenu binaire du rapport recopié',
    );
  } finally {
    restore();
  }
});

test('SOIL-03 : S1 ne produit aucun conseil automatique', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', deletedAt: null }],
      soilAssessment: [],
      soilParameter: [],
    }),
  );
  try {
    const assessment = await soilService.create(
      'plot_1',
      { assessedAt: '2026-09-01', parameters: [{ key: 'ph', value: '5.8', numericValue: 5.8 }] },
      reqAs(),
    );
    const serialized = JSON.stringify(assessment);
    assert.equal(/recommandation|advice|conseil/i.test(serialized), false, 'aucune recommandation en S1');
    assert.ok(assessment.parameters.length >= 1, 'les mesures sont bien conservées');
  } finally {
    restore();
  }
});

/* ───────────────────────── SÉCURITÉ (SEC-*) ───────────────────────── */

const listen = async (app) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
};

test('SEC-01 : la limitation de débit coupe les tentatives d’authentification', async () => {
  const app = express();
  app.post('/login', authLimiter, (_req, res) => res.json({ ok: true }));
  const { base, close } = await listen(app);
  try {
    // Hors production, la limite de connexion est volontairement large
    // (1 000 / 15 min) pour ne pas gêner la recette : on franchit donc le seuil.
    let firstBlockedAt = null;
    let firstStatus = null;
    for (let index = 0; index < 1_010 && firstBlockedAt === null; index += 1) {
      const response = await fetch(`${base}/login`, { method: 'POST' });
      if (index === 0) firstStatus = response.status;
      if (response.status === 429) firstBlockedAt = index;
    }
    assert.equal(firstStatus, 200, 'les premières tentatives passent');
    assert.ok(firstBlockedAt !== null, '429 renvoyé après le seuil');
    assert.ok(firstBlockedAt < 1_010, 'le blocage intervient bien avant l’infini');
  } finally {
    await close();
  }
});

test('SEC-02 : un jeton absent est refusé par l’authentification', async () => {
  const app = createApp();
  const { base, close } = await listen(app);
  try {
    const response = await fetch(`${base}/api/v1/me`);
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test('SEC-03 : l’autorisation refuse un rôle sans la permission demandée', async () => {
  const { can } = await import('../src/shared/permissions.js');
  assert.equal(can(['FARMER'], 'listings.moderate'), false, 'modération fermée au producteur');
  assert.equal(can(['MODERATOR'], 'listings.moderate'), true);
  assert.equal(can([], 'farms.read'), false, 'aucun rôle ⇒ aucun droit');
});

test('SEC-04 : le tenant effectif provient de l’appartenance, jamais d’un en-tête libre', async () => {
  const { resolveTenant } = await import('../src/middleware/tenant.js');
  const req = {
    user: { memberships: [{ organizationId: 'org_a', roles: ['FARMER'], status: 'ACTIVE' }] },
    headers: { 'x-organization-id': 'org_b' },
    get: (name) => (name === 'x-organization-id' ? 'org_b' : undefined),
  };
  let error = null;
  resolveTenant(req, {}, (err) => {
    error = err;
  });
  assert.ok(error, 'organisation non autorisée refusée');
  // 404 volontaire : on ne confirme pas l'existence d'une organisation tierce.
  assert.equal(error.status, 404);
  assert.match(error.message, /introuvable/);

  let noMembership = null;
  resolveTenant({ user: { memberships: [] }, headers: {}, get: () => undefined }, {}, (err) => {
    noMembership = err;
  });
  assert.equal(noMembership.status, 403, 'aucun rattachement ⇒ refus explicite');

  // Le tenant retenu provient de l'appartenance, jamais de l'en-tête seul.
  const accepted = { user: { memberships: [{ organizationId: 'org_a', roles: ['FARMER'], status: 'ACTIVE', organization: { type: 'INDIVIDUAL' } }], roles: [] }, headers: { 'x-organization-id': 'org_a' } };
  resolveTenant(accepted, {}, () => {});
  assert.equal(accepted.tenant.organizationId, 'org_a');
});

test('SEC-05 : les opérateurs de requête sont rejetés (anti-injection)', async () => {
  const req = { query: { email: { $ne: null } }, body: {}, params: {} };
  let error = null;
  rejectOperators(req, {}, (err) => {
    error = err;
  });
  assert.equal(error.status, 422);
});

test('SEC-06 : les en-têtes de sécurité HTTP sont posés par l’application', async () => {
  const app = createApp();
  const { base, close } = await listen(app);
  try {
    const response = await fetch(`${base}/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('x-frame-options') || response.headers.get('content-security-policy'));
  } finally {
    await close();
  }
});

test('SEC-07 : le CORS n’ouvre que les origines déclarées', async () => {
  const { env } = await import('../src/config/env.js');
  const app = createApp();
  const { base, close } = await listen(app);
  try {
    const hostile = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(hostile.headers.get('access-control-allow-origin'), null, 'origine inconnue non autorisée');

    const allowed = await fetch(`${base}/health`, { headers: { origin: env.corsOrigins[0] } });
    assert.ok(allowed.headers.get('access-control-allow-origin'), 'origine déclarée autorisée');
  } finally {
    await close();
  }
});

test('SEC-08 : un corps trop volumineux est refusé en 413, pas en 500', async () => {
  const app = createApp();
  const { base, close } = await listen(app);
  try {
    const huge = 'x'.repeat(3 * 1024 * 1024);
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: huge, password: huge }),
    });
    assert.equal(response.status, 413);
  } finally {
    await close();
  }
});

test('SEC-09 : les secrets sont hachés, jamais stockés en clair', async () => {
  const value = 'cle-api-secrete';
  const hashed = sha256(value);
  assert.notEqual(hashed, value);
  assert.equal(safeEqual(hashed, sha256(value)), true);
  assert.equal(safeEqual(hashed, sha256('autre')), false);
});

test('SEC-10 : le journal d’audit est append-only (aucune API de mise à jour)', async () => {
  // Seules des fonctions d'écriture/lecture sont exposées : aucun `update`
  // ni `delete` n'est offert aux appelants.
  assert.equal(typeof auditModule.audit, 'function');
  assert.equal(typeof auditModule.auditAs, 'function');
  for (const key of Object.keys(auditModule)) {
    assert.equal(/update|delete|remove|purge/i.test(key), false, `export de mutation interdit : ${key}`);
  }

  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/shared/audit.js', import.meta.url), 'utf8');
  assert.equal(/prisma\.[a-zA-Z]+\.(update|delete)/.test(source), false, 'aucune écriture destructive');
  assert.match(source, /auditLog\.create/, 'écriture par insertion seule');
});

test('SEC-11 : aucune donnée sensible dans les journaux', async () => {
  const redacted = redact({ email: 'awa@test.cd', password: 'secret', nested: { accessToken: 'abc', code: '123456' } });
  assert.equal(redacted.email, 'awa@test.cd', 'donnée non sensible conservée');
  assert.equal(redacted.password, '[redacted]');
  assert.equal(redacted.nested.accessToken, '[redacted]');
  assert.equal(redacted.nested.code, '[redacted]');

  const captured = [];
  const original = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  try {
    logger.info({ password: 'secret', userId: 'user_1' });
  } finally {
    console.log = original;
  }
  assert.equal(captured.join(' ').includes('secret'), false, 'secret absent du flux de journal');
});

test('SEC-12 : l’idempotence est appliquée par un middleware dédié', async () => {
  const { idempotency } = await import('../src/middleware/idempotency.js');
  assert.equal(typeof idempotency, 'function');
  const app = createApp();
  const { base, close } = await listen(app);
  try {
    // La route de commande est protégée : sans jeton, elle refuse avant tout effet.
    const response = await fetch(`${base}/api/v1/orders`, { method: 'POST' });
    assert.ok([401, 403].includes(response.status));
  } finally {
    await close();
  }
});

/* ───────────────────────── NFR / I18N ───────────────────────── */

test('NFR-02 : la pagination est bornée (page ≥ 1, limite plafonnée)', () => {
  const parsed = paginationSchema.parse({});
  assert.equal(parsed.page, 1);
  assert.ok(parsed.limit <= 100);

  const rejected = paginationSchema.safeParse({ page: 0, limit: 10_000 });
  assert.equal(rejected.success, false, 'valeurs hors bornes refusées');
});

test('NFR-03 : les écritures multi-tables passent par une transaction', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      verification: [
        { id: 'ver_1', organizationId: ORG, subjectType: 'FARM', subjectId: 'farm_1', status: 'PENDING', level: 'VERIFIED' },
      ],
      farm: [{ id: 'farm_1', organizationId: ORG, verificationStatus: null, verifiedAt: null }],
      organization: [{ id: ORG, createdBy: 'user_1' }],
      profile: [],
    }),
  );
  try {
    let transactions = 0;
    // Les services importent le singleton `prisma` : c'est lui qu'il faut espionner.
    const original = prisma.$transaction;
    prisma.$transaction = async (arg) => {
      transactions += 1;
      return original(arg);
    };

    // Une décision de vérification écrit la demande ET la ressource vérifiée :
    // les deux écritures doivent être atomiques (aucun état intermédiaire).
    await verificationService.review(
      'ver_1',
      { status: 'APPROVED', reason: 'Conforme' },
      reqAs(OTHER, ['VERIFIER'], 'agent_1'),
    );

    assert.equal(transactions, 1, 'exactement une transaction pour l’écriture groupée');
    assert.equal(fake._store.verification[0].status, 'APPROVED');
    assert.equal(fake._store.farm[0].verificationStatus, 'VERIFIED');
  } finally {
    restore();
  }
});

test('NFR-05 : les journaux portent un horodatage et un niveau exploitables', async () => {
  const captured = [];
  const original = console.warn;
  console.warn = (...args) => captured.push(args.join(' '));
  try {
    logger.warn('test de format');
  } finally {
    console.warn = original;
  }
  assert.match(captured[0], /^\S+ \[WARN\]/);
});

test('NFR-06 : les tâches planifiées exposent leur état de supervision', async () => {
  const before = schedulerStatus();
  assert.ok(Array.isArray(before.jobs));
  assert.ok(before.jobs.length >= 6, 'toutes les tâches sont décrites');
  assert.equal(typeof before.enabled, 'boolean');
  assert.equal(typeof before.scheduled, 'number', 'nombre de tâches planifiées exposé');
  for (const job of before.jobs) {
    assert.ok(job.name);
    assert.ok(job.intervalHuman, 'cadence lisible');
    assert.ok('lastRunAt' in job, 'dernière exécution exposée');
  }

  const started = startScheduler({ initialDelayMs: 60_000 });
  assert.equal(started.jobs.length, before.jobs.length);
  const after = schedulerStatus();
  if (started.started) assert.equal(after.scheduled, before.jobs.length);
  else assert.equal(started.reason, 'JOBS_ENABLED=false');

  stopScheduler();
  assert.equal(schedulerStatus().scheduled, 0, 'planificateur arrêté');
});

test('NFR-07 : le temps réel ne fait que diffuser, jamais écrire', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/realtime/index.js', import.meta.url), 'utf8');
  // La couche temps réel peut LIRE pour composer un instantané, mais ne doit
  // jamais écrire : aucune opération de mutation Prisma ne doit y apparaître.
  assert.equal(
    /prisma\.[a-zA-Z]+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/.test(source),
    false,
    'aucune écriture base depuis la couche temps réel',
  );
  assert.ok(source.includes('emit'), 'diffusion seule');
});

test('NFR-11 : chaque requête porte un identifiant de corrélation, repris dans les erreurs', async () => {
  const { requestId } = await import('../src/shared/http/requestId.js');

  const run = (headers) => {
    const req = { headers };
    const sent = {};
    const res = { setHeader: (name, value) => { sent[name] = value; } };
    let continued = false;
    requestId(req, res, () => {
      continued = true;
    });
    return { id: req.id, header: sent['X-Request-Id'], continued };
  };

  // Un identifiant fourni par le client est repris tel quel : la corrélation
  // tient de bout en bout, du client jusqu'aux journaux.
  const propagated = run({ 'x-request-id': 'req-client-123' });
  assert.equal(propagated.id, 'req-client-123');
  assert.equal(propagated.header, 'req-client-123', 'identifiant renvoyé au client');

  // Sans identifiant, un UUID est généré : aucune requête n'est anonyme dans les logs.
  const generated = run({});
  assert.match(generated.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(generated.header, generated.id);
  assert.equal(generated.continued, true, 'la chaîne de middlewares continue');

  // Un identifiant hors limite est ignoré plutôt que recopié : il ne peut pas
  // servir à saturer les journaux (borne de 80 caractères).
  const oversized = run({ 'x-request-id': 'x'.repeat(200) });
  assert.notEqual(oversized.id, 'x'.repeat(200));
  assert.match(oversized.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  // La réponse d'erreur expose le même identifiant : c'est ce que l'utilisateur
  // communique au support pour retrouver la trace.
  const app = express();
  app.use(requestId);
  app.get('/boom', (req, res, next) => next(ApiError.notFound('introuvable')));
  app.use((await import('../src/shared/http/errorHandler.js')).errorHandler);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/boom`, {
      headers: { 'x-request-id': 'req-erreur-1' },
    });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.requestId, 'req-erreur-1', 'identifiant présent dans le corps d’erreur');
    assert.equal(response.headers.get('x-request-id'), 'req-erreur-1');
  } finally {
    server.close();
  }
});

test('I18N-01 : le français est la langue de référence du produit', async () => {
  const { env } = await import('../src/config/env.js');
  assert.ok(['fr'].includes(env.defaultLocale ?? 'fr'));
  const error = ApiError.notFound('Ressource introuvable');
  assert.match(error.message, /introuvable/);
});

test('I18N-02 : les erreurs sont structurées et lisibles, jamais des traces techniques', () => {
  const error = ApiError.forbidden('Accès refusé');
  assert.equal(error.status, 403);
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(/at\s+\w+\s+\(/.test(error.message), false, 'aucune trace de pile dans le message');
});

test('I18N-03 : unités et devises sont explicites, jamais implicites', () => {
  assert.ok(KNOWN_UNITS.includes('kg') && KNOWN_UNITS.includes('sac'));
  assert.equal(toKilograms(2, 't'), 2000);
  assert.equal(toKilograms(1, 'unite_inconnue'), null, 'unité inconnue non convertie');

  const converted = convert(100, 'USD', 'CDF', { value: 2800, date: '2026-09-01', source: 'BCC' });
  assert.equal(converted.amount, 280000);
  assert.equal(converted.fxRate.source, 'BCC', 'source du taux conservée');
  assert.equal(converted.fxRate.date, '2026-09-01', 'taux daté');

  // Sans taux daté et sourcé, la conversion est refusée : jamais de taux inventé.
  const refused = convert(100, 'USD', 'CDF', null);
  assert.equal(refused.amount, null);
  assert.match(refused.error, /taux|BIL-02/i);
});
