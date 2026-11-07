/**
 * Seed des référentiels (CDC §16.6 : scripts de seed pays, provinces, cultures, unités).
 *
 * Idempotent : peut être relancé sans dupliquer les données.
 *   npm run seed
 *
 * ⚠️ Aucune donnée métier fictive (pas de fausses fermes, pas de fausses
 * productions) : uniquement des référentiels publics et vérifiables.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COUNTRIES = [
  {
    code: 'CD',
    name: 'République démocratique du Congo',
    currencies: ['CDF', 'USD'],
    defaultCurrency: 'USD',
    locales: ['fr', 'ln', 'sw', 'kg', 'lu'],
    timezone: 'Africa/Kinshasa',
    status: 'PILOT',
    adminLevels: [
      { level: 1, name: 'Province' },
      { level: 2, name: 'Territoire' },
      { level: 3, name: 'Secteur' },
      { level: 4, name: 'Village' },
    ],
    units: { sac: 50, tonne: 1000, quintal: 100, regime: 15, cuvette: 20 },
    complianceProfile: {
      dataProtection: 'Loi n°20/017 sur les télécommunications et les TIC (à valider juridiquement)',
      marketplace: 'Mise en relation uniquement — aucun paiement opéré',
      taxNotes: 'TVA et fiscalité locale à confirmer avec le conseil juridique',
    },
  },
  {
    code: 'CG',
    name: 'République du Congo',
    currencies: ['XAF'],
    defaultCurrency: 'XAF',
    locales: ['fr'],
    timezone: 'Africa/Brazzaville',
    status: 'PLANNED',
    adminLevels: [
      { level: 1, name: 'Département' },
      { level: 2, name: 'District' },
    ],
    units: { sac: 50, tonne: 1000 },
  },
];

const CROPS = [
  {
    slug: 'manioc',
    category: 'tubercule',
    names: { fr: 'Manioc', en: 'Cassava', ln: 'Bisikwadi', sw: 'Muhogo' },
    cycleDays: 300,
    units: { sac: 50, tonne: 1000 },
    agronomy: {
      phMin: 5.5,
      phMax: 6.8,
      waterNeed: 'modérée à élevée',
      altitudeMax: 1800,
      preferredTexture: ['limoneux', 'sablo-limoneux'],
      previousCrops: ['jachère', 'légumineuse'],
      nextCrops: ['haricot', 'maïs'],
      note: 'Fiche structurelle (V1) — contenu agronomique détaillé à valider par agronomes (CROP-02).',
    },
  },
  {
    slug: 'mais',
    category: 'céréale',
    names: { fr: 'Maïs', en: 'Maize', ln: 'Lisángá', sw: 'Mahindi' },
    cycleDays: 110,
    units: { sac: 50, tonne: 1000 },
    agronomy: {
      phMin: 5.5,
      phMax: 7.0,
      waterNeed: 'moyenne',
      preferredTexture: ['limoneux', 'argilo-limoneux'],
      previousCrops: ['légumineuse', 'jachère'],
      nextCrops: ['manioc', 'arachide'],
    },
  },
  {
    slug: 'riz',
    category: 'céréale',
    names: { fr: 'Riz', en: 'Rice', sw: 'Mpunga' },
    cycleDays: 130,
    units: { sac: 50, tonne: 1000 },
    agronomy: { phMin: 5.5, phMax: 7.2, waterNeed: 'élevée', preferredTexture: ['argileux'] },
  },
  {
    slug: 'haricot',
    category: 'légumineuse',
    names: { fr: 'Haricot', en: 'Bean', sw: 'Maharagwe' },
    cycleDays: 90,
    units: { sac: 50, tonne: 1000 },
    agronomy: {
      phMin: 5.8,
      phMax: 7.0,
      waterNeed: 'moyenne',
      previousCrops: ['maïs', 'manioc'],
      note: 'Légumineuse : apport d\'azote, culture de rotation recommandée (S-P6).',
    },
  },
  {
    slug: 'arachide',
    category: 'oléagineux',
    names: { fr: 'Arachide', en: 'Groundnut', sw: 'Karanga' },
    cycleDays: 100,
    units: { sac: 50, tonne: 1000 },
    agronomy: { phMin: 5.5, phMax: 7.0, waterNeed: 'moyenne', preferredTexture: ['sableux', 'sablo-limoneux'] },
  },
  {
    slug: 'cacao',
    category: 'culture de rente',
    names: { fr: 'Cacao', en: 'Cocoa' },
    cycleDays: 365,
    units: { sac: 60, tonne: 1000 },
    agronomy: { phMin: 5.0, phMax: 7.0, waterNeed: 'élevée', altitudeMax: 900 },
  },
  {
    slug: 'cafe-robusta',
    category: 'culture de rente',
    names: { fr: 'Café robusta', en: 'Robusta coffee' },
    cycleDays: 365,
    units: { sac: 60, tonne: 1000 },
    agronomy: { phMin: 5.5, phMax: 6.5, waterNeed: 'élevée' },
  },
  {
    slug: 'bananier',
    category: 'fruit',
    names: { fr: 'Bananier', en: 'Banana', ln: 'Ekonde' },
    cycleDays: 300,
    units: { regime: 15, tonne: 1000 },
    agronomy: { phMin: 5.5, phMax: 7.0, waterNeed: 'élevée' },
  },
  {
    slug: 'palmier-a-huile',
    category: 'culture de rente',
    names: { fr: 'Palmier à huile', en: 'Oil palm' },
    cycleDays: 365,
    units: { tonne: 1000, litre: 1 },
    agronomy: { phMin: 4.5, phMax: 6.5, waterNeed: 'élevée' },
  },
  {
    slug: 'tomate',
    category: 'maraîchage',
    names: { fr: 'Tomate', en: 'Tomato' },
    cycleDays: 90,
    units: { cuvette: 20, kg: 1 },
    agronomy: { phMin: 5.8, phMax: 7.0, waterNeed: 'élevée' },
  },
];

/**
 * V5 — catalogue de produits de données agrégées (CDC V5 §6).
 * `fields` décrit uniquement des dimensions non identifiantes.
 */
const DATA_PRODUCTS = [
  {
    slug: 'production-par-culture-pays',
    name: 'Volumes de production par culture et pays',
    description:
      'Agrégats mensuels de volumes récoltés par culture et par pays. Aucune exploitation identifiable.',
    minGroupSize: 10,
    fields: {
      dimensions: ['crop', 'countryCode', 'period'],
      measures: ['totalQuantityKg', 'meanQuantityKg'],
      composition: ['declared', 'measured', 'estimated'],
    },
  },
  {
    slug: 'prix-marches-agricoles',
    name: 'Prix de marché agricoles datés et sourcés',
    description:
      'Relevés de prix par culture, marché et pays, avec source et date d\'observation.',
    minGroupSize: 5,
    fields: {
      dimensions: ['crop', 'market', 'countryCode', 'observedAt'],
      measures: ['price', 'currency', 'unit'],
      provenance: ['source', 'sourceLabel'],
    },
  },
];

const SETTINGS = [
  { key: 'app.name', value: { fr: 'AGRIKONNECT AFRICA', en: 'AGRIKONNECT AFRICA' } },
  { key: 'app.version', value: { product: 'V1', label: 'AGRIKONNECT FARM' } },
  {
    key: 'public_profile.requires_verified_account',
    value: true,
  },
  {
    key: 'map.default_precision_decimals',
    value: 2,
  },
  {
    key: 'soil.s1.recommendations_enabled',
    value: false,
  },
];

const main = async () => {
  console.log('🌱 Seed des référentiels AGRIKONNECT…');

  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, status: country.status },
      create: country,
    });
    console.log(`   • Pays ${country.code} — ${country.name}`);
  }

  for (const crop of CROPS) {
    await prisma.crop.upsert({
      where: { slug: crop.slug },
      update: { names: crop.names, agronomy: crop.agronomy ?? undefined },
      create: {
        id: `crop_${crop.slug}`,
        slug: crop.slug,
        category: crop.category,
        names: crop.names,
        cycleDays: crop.cycleDays ?? null,
        units: crop.units ?? undefined,
        agronomy: crop.agronomy ?? undefined,
        status: 'VALIDATED',
      },
    });
    console.log(`   • Culture ${crop.slug}`);
  }

  for (const setting of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`   • ${SETTINGS.length} paramètres applicatifs`);

  /**
   * V5 — produits de données (DATA-01).
   * Créés en brouillon : la publication exige au moins un agrégat conforme au
   * seuil de k-anonymat (aucune donnée n'est exposée par le seed).
   */
  for (const product of DATA_PRODUCTS) {
    await prisma.dataProduct.upsert({
      where: { slug: product.slug },
      update: { name: product.name, description: product.description, fields: product.fields },
      create: {
        id: `dp_${product.slug}`,
        slug: product.slug,
        name: product.name,
        description: product.description,
        minGroupSize: product.minGroupSize,
        fields: product.fields,
        status: 'DRAFT',
      },
    });
    console.log(`   • Produit de données ${product.slug} (k ≥ ${product.minGroupSize})`);
  }

  console.log('\n✅ Seed terminé.');
  console.log('   Note : aucun utilisateur ni donnée métier fictive n\'est créé.');
  console.log('   Le premier SUPER_ADMIN se crée via Supabase Auth puis :');
  console.log('   1) POST /api/v1/auth/sync-profile');
  console.log('   2) UPDATE memberships SET roles = ARRAY[\'SUPER_ADMIN\']::"Role"[] WHERE user_id = ...;');
};

main()
  .catch((error) => {
    console.error('❌ Seed échoué :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
