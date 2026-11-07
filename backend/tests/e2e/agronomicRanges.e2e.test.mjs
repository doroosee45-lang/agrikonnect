import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Le moteur lit le lot de référentiel porté par `AGRONOMIC_DATASET`.
 *
 * Cette suite tourne volontairement sur le lot `test` : les plages qu'elle
 * écrit ne peuvent donc pas être lues par une instance de production, et ne
 * figurent pas dans `prisma/seed.js`. La variable doit être posée **avant**
 * `startHarness()`, qui importe l'application — `env` est figé à l'import.
 */
process.env.AGRONOMIC_DATASET = 'test';

const { startHarness } = await import('./support/harness.mjs');

/**
 * Recette de bout en bout — **base réelle** — gouvernance du référentiel
 * agronomique et classement cultural.
 *
 * Ce que cette suite prouve, et que les doubles en mémoire ne peuvent pas prouver :
 *   - les plages vivent en base (`crop_agronomic_ranges`), écrites par l'API
 *     d'administration, et non codées en dur dans le moteur ;
 *   - une plage sans provenance, ou hors bornes physiques, est refusée à
 *     l'écriture — la contrainte vaut pour tout appelant, pas seulement l'écran ;
 *   - la validation exige un validateur nommé, et une plage validée puis
 *     modifiée redevient provisoire ;
 *   - le moteur **classe réellement** quand le référentiel le permet, avec des
 *     seuils dérivés des plages et une explication dont chaque chiffre provient
 *     des données ;
 *   - le lot `test` est invisible pour le lot `production`, et réciproquement :
 *     un jeu d'essai ne peut pas influencer la production ;
 *   - l'écriture d'une plage est réservée à l'agronome, et auditée.
 */

let h;
let farmerToken;
let plotId;

const PASSWORD = 'MotDePasse!2026';

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila' }) => {
  const response = await h.request('POST', '/auth/register', {
    body: { accountType, firstName, lastName, email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

before(async () => {
  h = await startHarness();
  await register({ email: 'fermier-ref@agrikonnect.test', firstName: 'Josué', lastName: 'Bomoi' });
  await register({
    email: 'agro-ref@agrikonnect.test',
    accountType: 'AGRONOMIST',
    firstName: 'Alice',
    lastName: 'Muteba',
  });

  farmerToken = await connect('fermier-ref@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme Mbandaka',
      countryCode: 'CD',
      province: 'Équateur',
      latitude: 0.0481,
      longitude: 18.2557,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle référentiel',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;

  // pH et salinité mesurés en laboratoire sur la parcelle.
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [
        { key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
        // `ec` et non « salinityDsm » : c'est le vocabulaire réel des analyses
        // de sol (SOIL_PARAMETER_KEYS). Une clé inventée ici ne serait jamais
        // appariée par le moteur.
        { key: 'ec', value: '1.2', numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  /**
   * Température de l'air : station météo de l'exploitation.
   *
   * Créée en base plutôt que via l'ingestion IoT, déjà couverte par ailleurs.
   * Ce qui compte ici, c'est que la valeur existe avec sa provenance et son
   * mode réel — et qu'elle porte bien sur l'air, comme toute fourchette issue
   * d'un référentiel générique.
   */
  const plotRecord = await h.prisma.plot.findUnique({ where: { id: plotId } });
  await h.prisma.iotDevice.create({
    data: {
      id: 'device_ref_station',
      organizationId: plotRecord.organizationId,
      plotId,
      label: 'Station météo référentiel',
      keyHash: 'hash-e2e',
    },
  });
  await h.prisma.sensorReading.create({
    data: {
      id: 'reading_ref_temp',
      organizationId: plotRecord.organizationId,
      plotId,
      deviceId: 'device_ref_station',
      metric: 'airTemperatureC',
      value: 25,
      unit: '°C',
      source: 'measured_sensor',
      confidence: 'high',
      at: new Date(),
      mode: 'REAL',
    },
  });
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

test('E2E référentiel : sans plage en base, le moteur ne classe rien et le dit', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const recommendation = response.body.data.recommendation;

  assert.equal(recommendation.status, 'INSUFFICIENT_DATA');
  assert.equal(recommendation.scores.length, 0);
  assert.match(recommendation.insufficiencyReason, /critères agronomiques évaluables/);
  // Le lot de référentiel consulté est tracé dans la recommandation.
  assert.equal(recommendation.explanation.reference.datasetLabel, 'test');
  assert.equal(recommendation.explanation.reference.calendarStatus, 'PROVISIONAL');
  // Les mesures de la parcelle sont conservées : ce n'est pas elles qui manquent.
  assert.equal(recommendation.referenceMeasurements.ph.value, 6.4);
});

test('E2E référentiel : l’écriture d’une plage est refusée au producteur (403)', async () => {
  const response = await h.request('POST', '/agronomic-ranges', {
    token: farmerToken,
    body: {
      cropSlug: 'mais',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      unit: 'pH',
      sourceReference: 'Référentiel agronomique de test — Zea mays',
      datasetLabel: 'test',
    },
  });
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E référentiel : une plage sans provenance est refusée (422)', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const response = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: { cropSlug: 'mais', parameterKey: 'ph', minValue: 5.5, maxValue: 7, unit: 'pH', datasetLabel: 'test' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /provenance/);
});

test('E2E référentiel : une borne hors limites physiques est refusée (422)', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const response = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'mais',
      parameterKey: 'ph',
      minValue: 5.5,
      // pH à 42 : import corrompu, refusé à l'écriture plutôt qu'au calcul.
      maxValue: 42,
      unit: 'pH',
      sourceReference: 'import corrompu',
      datasetLabel: 'test',
    },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /physiquement plausible/);
});

test('E2E référentiel : l’agronome crée les plages, le moteur classe réellement', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const ranges = [
    { parameterKey: 'ph', minValue: 5.5, maxValue: 7, unit: 'pH', sourceReference: 'Référentiel agronomique de test — Zea mays' },
    {
      parameterKey: 'airTemperatureC',
      minValue: 21,
      maxValue: 30,
      unit: '°C',
      sourceReference: 'Référentiel agronomique de test — Zea mays',
      sourceNote: 'Température de l’AIR (référentiel générique), et non température du sol.',
    },
  ];
  for (const range of ranges) {
    const response = await h.request('POST', '/agronomic-ranges', {
      token: agroToken,
      body: { cropSlug: 'mais', datasetLabel: 'test', ...range },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.status, 'PROVISIONAL', 'une saisie n’est jamais une validation');
    assert.equal(response.body.data.validatedBy, null);
  }

  // Les plages sont bien persistées, avec leur source.
  const stored = await h.prisma.cropAgronomicRange.findMany({
    where: { cropSlug: 'mais', datasetLabel: 'test' },
    orderBy: { parameterKey: 'asc' },
  });
  assert.equal(stored.length, 2);
  for (const row of stored) {
    assert.ok(row.sourceReference, 'une plage sans source citable ne doit pas être enregistrée');
  }

  // ── Le moteur classe ────────────────────────────────────────────────
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const recommendation = response.body.data.recommendation;

  assert.equal(recommendation.status, 'ACTIVE', String(recommendation.insufficiencyReason));
  assert.ok(recommendation.scores.length >= 1, 'au moins une culture doit être classée');
  assert.equal(recommendation.insufficiencyReason, null);

  const best = recommendation.scores[0];
  assert.equal(best.cropSlug, 'mais');
  assert.equal(best.coverage, 1, 'les deux critères évaluables ont été évalués');
  assert.equal(best.criteria.length, 2);
  assert.ok(best.score > 0);
  assert.ok(best.plantingWindow, 'la fenêtre de semis doit être nommée');

  // Calendrier provisoire + plages provisoires ⇒ sortie indicative.
  assert.equal(response.body.data.indicative, true);
  assert.ok(
    response.body.data.indicativeReasons.some((reason) => /calendrier/i.test(reason)),
    JSON.stringify(response.body.data.indicativeReasons),
  );
  assert.ok(
    response.body.data.indicativeReasons.some((reason) => /plages agronomiques/i.test(reason)),
    JSON.stringify(response.body.data.indicativeReasons),
  );

  // Les seuils de surveillance sont dérivés des plages réelles, pas inventés.
  assert.equal(recommendation.thresholds.ph.min, 5.5);
  assert.equal(recommendation.thresholds.ph.max, 7);
  assert.equal(recommendation.thresholds.ph.rangeStatus, 'PROVISIONAL');
  assert.equal(recommendation.thresholds.airTemperatureC.max, 30);

  // ── Explication : chaque chiffre vient des données ──────────────────
  const explanation = await h.request('GET', `/recommendations/${recommendation.id}/explanation`, {
    token: farmerToken,
  });
  assert.equal(explanation.status, 200, JSON.stringify(explanation.body));
  const text = explanation.body.data.text;
  assert.equal(explanation.body.data.language, 'fr');
  assert.ok(text.length > 0);

  const allowed = new Set();
  allowed.add(String(recommendation.requestedDays));
  allowed.add(String(recommendation.scores.length));
  for (const entry of recommendation.scores) {
    allowed.add(String(Math.round((entry.score ?? 0) * 100)));
    allowed.add(String(Math.round((entry.coverage ?? 0) * 100)));
  }
  for (const measurement of Object.values(recommendation.referenceMeasurements)) {
    if (Number.isFinite(measurement.value)) allowed.add(String(measurement.value));
  }
  // La version du moteur est une **donnée** (celle qui a servi au calcul), pas
  // un chiffre inventé : le texte la cite pour rester interprétable.
  for (const token of String(recommendation.ruleSetVersion ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []) {
    allowed.add(token.replace(',', '.'));
  }
  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(',', '.'));
  assert.ok(numbers.length > 0, 'l’explication devrait citer au moins un chiffre');
  for (const token of numbers) {
    assert.ok(allowed.has(token), `le nombre « ${token} » du texte ne vient pas des données du moteur`);
  }
});

test('E2E référentiel : une plage du lot production est invisible pour le lot actif', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  // Même culture, même paramètre, mais lot « production » : le moteur tourne
  // sur « test », il ne doit donc pas la lire.
  const response = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'manioc',
      parameterKey: 'ph',
      minValue: 4.5,
      maxValue: 7.5,
      unit: 'pH',
      sourceReference: 'Référentiel agronomique de test — Manihot esculenta',
      datasetLabel: 'production',
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const listed = await h.request('GET', '/agronomic-ranges?cropSlug=manioc', { token: agroToken });
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.ok(listed.body.data.items.length >= 1, 'la plage production doit être listable par l’admin');

  // Le moteur, lui, ne lit que le lot actif.
  const { rangesForCrops } = await import('../../src/modules/recommendation/agronomicRanges.service.js');
  const active = await rangesForCrops(['manioc']);
  assert.equal(active.datasetLabel, 'test');
  assert.deepEqual(active.byCrop, {}, 'aucune plage « production » ne doit être lue par le lot « test »');

  const explicit = await rangesForCrops(['manioc'], { datasetLabel: 'production' });
  assert.ok(explicit.byCrop.manioc?.ph, 'la plage production existe, elle est seulement hors lot actif');
});

test('E2E référentiel : la validation exige un validateur, puis ne survit pas à une modification', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const listed = await h.request('GET', '/agronomic-ranges?cropSlug=mais', { token: agroToken });
  const phRange = listed.body.data.items.find((row) => row.parameterKey === 'ph');
  assert.ok(phRange, 'plage pH introuvable');

  // Sans nom de validateur : refusé.
  const anonymous = await h.request('POST', `/agronomic-ranges/${phRange.id}/validate`, {
    token: agroToken,
    body: {},
  });
  assert.equal(anonymous.status, 422, JSON.stringify(anonymous.body));

  // Validation nominative.
  const validated = await h.request('POST', `/agronomic-ranges/${phRange.id}/validate`, {
    token: agroToken,
    body: { validatedBy: 'Dr. Alice Muteba' },
  });
  assert.equal(validated.status, 200, JSON.stringify(validated.body));
  assert.equal(validated.body.data.status, 'VALIDATED');
  assert.equal(validated.body.data.validatedBy, 'Dr. Alice Muteba');
  assert.ok(validated.body.data.validatedAt, 'la validation doit être horodatée');

  // Modifier les bornes annule la validation : elle portait sur les anciennes.
  const modified = await h.request('PATCH', `/agronomic-ranges/${phRange.id}`, {
    token: agroToken,
    body: { minValue: 5.2, maxValue: 6.9 },
  });
  assert.equal(modified.status, 200, JSON.stringify(modified.body));
  assert.equal(modified.body.data.status, 'PROVISIONAL');
  assert.equal(modified.body.data.validatedBy, null);

  // Toute l'écriture est auditée.
  const audits = await h.prisma.auditLog.findMany({
    where: { resourceId: phRange.id },
    orderBy: { createdAt: 'asc' },
  });
  const actions = audits.map((row) => row.action);
  assert.ok(actions.includes('agronomicRange.create'), actions.join(', '));
  assert.ok(actions.includes('agronomicRange.validate'), actions.join(', '));
  assert.ok(actions.includes('agronomicRange.update'), actions.join(', '));
});

/* ─────────────────────── Import CSV ─────────────────────── */
test('E2E import : le modèle CSV expose les 15 colonnes du tableau', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const response = await h.request('GET', '/agronomic-ranges/import/template', { token: agroToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const { header, example, csv, parameters } = response.body.data;
  assert.deepEqual(header, [
    'Culture', 'Nom scientifique', 'Paramètre', 'Unité', 'Idéal min', 'Idéal max',
    'Toléré min', 'Toléré max', 'Type de source', 'Source précise', 'Zone concernée',
    'Statut', 'Validé par', 'Date de validation', 'Remarques',
  ]);
  assert.equal(header.length, 15);
  assert.equal(example.length, header.length, 'l’exemple doit avoir autant de cellules que l’en-tête');
  assert.ok(parameters.includes('ph') && parameters.includes('ec'));

  // L’exemple est clairement fictif : il ne doit pas ressembler à une source
  // réelle, sinon il serait recopié tel quel et finirait en base comme une
  // provenance vérifiée.
  assert.equal(example[0], 'exemple');
  assert.equal(example[9], 'Exemple de format');
  assert.match(example.join(' ').toLowerCase(), /fictiv/);

  // Le modèle fourni est directement réutilisable.
  assert.equal(csv.split('\n').length, 2);
  assert.ok(csv.startsWith('Culture;Nom scientifique;Paramètre;'));
});

test('E2E import : refusé au producteur (403)', async () => {
  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: farmerToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise',
        'manioc;pH du sol;pH;4.5;7.5;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E import : colonnes obligatoires absentes → 422', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: { csv: 'Culture;Idéal min;Idéal max\nmanioc;4.5;7.5' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /parameterKey/);
  assert.match(response.body.message, /unit/);
});

test('E2E import : les libellés français du tableau sont acceptés', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Nom scientifique;Paramètre;Unité;Idéal min;Idéal max;Type de source;Source précise',
        'arachide;Arachis hypogaea;pH du sol;pH;5.5;7;Publication;Source de test',
        'arachide;Arachis hypogaea;Humidité volumique du sol;%;18;38;Publication;Source de test',
        'arachide;Arachis hypogaea;Salinité maximale (EC);dS/m;0;1.2;Publication;Source de test',
        'arachide;Arachis hypogaea;Profondeur racinaire;cm;20;60;Publication;Source de test',
        'arachide;Arachis hypogaea;Température de l\'air;°C;20;30;Publication;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.created, 5, JSON.stringify(response.body.data.results));
  assert.equal(response.body.data.summary.errors, 0, JSON.stringify(response.body.data.results));

  const stored = await h.prisma.cropAgronomicRange.findMany({ where: { cropSlug: 'arachide' } });
  const keys = stored.map((row) => row.parameterKey).sort();
  assert.deepEqual(keys, ['airTemperatureC', 'depthCm', 'ec', 'moisture', 'ph']);
  assert.equal(stored[0].scientificName, 'Arachis hypogaea');
});

test('E2E import : dryRun calcule sans rien écrire', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  const before = await h.prisma.cropAgronomicRange.count({ where: { cropSlug: 'dryrun-crop' } });

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      dryRun: true,
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise',
        'dryrun-crop;pH du sol;pH;5.5;7;Source de test',
        'dryrun-crop;Salinité maximale (EC);dS/m;0;1.2;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.dryRun, true);
  assert.equal(response.body.data.summary.created, 2);
  assert.equal(response.body.data.summary.errors, 0);

  const after = await h.prisma.cropAgronomicRange.count({ where: { cropSlug: 'dryrun-crop' } });
  assert.equal(after, before, 'un dryRun ne doit rien écrire');
});

test('E2E import : une ligne invalide est rapportée, les autres sont traitées', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise;Remarques',
        // Ligne valide.
        'soja;pH du sol;pH;5.5;7;Source de test;',
        // Ligne sans provenance : refusée, mais sans bloquer le fichier.
        'soja;Salinité maximale (EC);dS/m;0;1.2;;',
        // Ligne hors bornes physiques (humidité à 900 %) : refusée.
        'soja;Humidité volumique du sol;%;10;900;Source de test;',
        // Ligne dont la source contient un point-virgule protégé par des guillemets.
        'soja;Profondeur racinaire;cm;20;90;"Référentiel pédologique, Équateur 2026";',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const { summary, results } = response.body.data;
  assert.equal(summary.totalLines, 4);
  assert.equal(summary.created, 2, JSON.stringify(results));
  assert.equal(summary.errors, 2, JSON.stringify(results));

  const byLine = Object.fromEntries(results.map((row) => [row.line, row]));
  assert.equal(byLine[2].outcome, 'CREATED');
  assert.equal(byLine[3].outcome, 'ERROR');
  assert.match(byLine[3].reason, /provenance/);
  assert.equal(byLine[4].outcome, 'ERROR');
  assert.match(byLine[4].reason, /physiquement plausible/);
  assert.equal(byLine[5].outcome, 'CREATED');

  // La source protégée par des guillemets a survécu intacte au découpage.
  const depth = await h.prisma.cropAgronomicRange.findFirst({
    where: { cropSlug: 'soja', parameterKey: 'depthCm' },
  });
  assert.equal(depth.sourceReference, 'Référentiel pédologique, Équateur 2026');
  // Rien n'est validé par un import.
  assert.equal(depth.status, 'PROVISIONAL');

  // L'import est audité.
  const audits = await h.prisma.auditLog.findMany({ where: { action: 'agronomicRange.import' } });
  assert.ok(audits.length >= 1, 'l’import doit être audité');
});

/* ─────────────── Règle centrale : un import ne valide jamais ─────────────── */

test('E2E import : une ligne annoncée VALIDATED est créée PROVISIONAL', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  // La base du harness persiste d'une exécution à l'autre : on part d'un état
  // connu plutôt que de supposer que la ligne n'existe pas encore.
  await h.prisma.cropAgronomicRange.deleteMany({ where: { cropSlug: 'mais' } });

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Type de source;Source précise;Statut;Validé par;Date de validation',
        'mais;pH du sol;pH;5.5;7.5;Agronome;Source de test;VALIDATED;Dr. Alice Muteba;2026-03-14',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.created, 1, JSON.stringify(response.body.data.results));

  const stored = await h.prisma.cropAgronomicRange.findFirst({
    where: { cropSlug: 'mais', parameterKey: 'ph' },
  });
  assert.ok(stored, 'la plage doit avoir été créée');

  // Le fichier annonçait VALIDATED : la ligne est malgré tout provisoire.
  assert.equal(stored.status, 'PROVISIONAL', 'un import ne peut pas produire une plage validée');
  // Ni validateur, ni date : la validation est un acte d'agronome, pas une
  // donnée de fichier.
  assert.equal(stored.validatedBy, null);
  assert.equal(stored.validatedAt, null);

  // Mais l'information n'est pas perdue : elle est conservée en note.
  assert.match(stored.sourceNote, /Alice Muteba/);
  assert.match(stored.sourceNote, /2026-03-14/);
  assert.match(stored.sourceNote, /provisoire/);
  // Le type de source annoncé est conservé.
  assert.equal(stored.sourceType, 'AGRONOMIST');
});

test('E2E import : seule la route de validation peut passer une plage en VALIDATED', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  // L'import crée la plage en PROVISIONAL, malgré le statut annoncé.
  const imported = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise;Statut',
        'haricot;pH du sol;pH;6;7.5;Source de test;VALIDATED',
      ].join('\n'),
    },
  });
  assert.equal(imported.status, 201, JSON.stringify(imported.body));
  const rangeId = imported.body.data.results[0].id;

  // Un second import ne la valide pas non plus.
  const reimport = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise;Statut;Validé par',
        'haricot;pH du sol;pH;6;7.5;Source de test;VALIDATED;Dr. B',
      ].join('\n'),
    },
  });
  assert.equal(reimport.status, 201, JSON.stringify(reimport.body));
  const afterReimport = await h.prisma.cropAgronomicRange.findUnique({ where: { id: rangeId } });
  assert.equal(afterReimport.status, 'PROVISIONAL');

  // La route de validation, elle, valide — avec un validateur nommé.
  const validated = await h.request('POST', `/agronomic-ranges/${rangeId}/validate`, {
    token: agroToken,
    body: { validatedBy: 'Dr. Alice Muteba' },
  });
  assert.equal(validated.status, 200, JSON.stringify(validated.body));
  assert.equal(validated.body.data.status, 'VALIDATED');
  assert.equal(validated.body.data.validatedBy, 'Dr. Alice Muteba');

  // Et le producteur ne peut pas s'en servir pour valider.
  const asFarmer = await h.request('POST', `/agronomic-ranges/${rangeId}/validate`, {
    token: farmerToken,
    body: { validatedBy: 'Un producteur' },
  });
  assert.equal(asFarmer.status, 403, JSON.stringify(asFarmer.body));
});

/* ─────────────── Bornes tolérées ─────────────── */

test('E2E plages : les bornes tolérées sont enregistrées et exposées', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const created = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'tolerance-crop',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      toleratedMin: 4.5,
      toleratedMax: 8,
      unit: 'pH',
      sourceType: 'PUBLICATION',
      sourceReference: 'Source de test',
      scientificName: 'Exemplum fictivum',
      zone: 'Équateur',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { id } = created.body.data;

  const read = await h.request('GET', `/agronomic-ranges/${id}`, { token: agroToken });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.data.toleratedMin, 4.5);
  assert.equal(read.body.data.toleratedMax, 8);
  assert.equal(read.body.data.sourceType, 'PUBLICATION');
  // La zone saisie avec un accent est ramenée à la forme canonique, alignée sur
  // `SUPPORTED_PROVINCES` : « Équateur » et « Equateur » donnent la même valeur.
  assert.equal(read.body.data.zone, 'Equateur');
  assert.equal(read.body.data.scientificName, 'Exemplum fictivum');

  // Les quatre limites sont visibles par le moteur, via la même projection.
  const listed = await h.request('GET', '/agronomic-ranges?cropSlug=tolerance-crop', { token: agroToken });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.items[0].toleratedMin, 4.5);
  assert.equal(listed.body.data.items[0].toleratedMax, 8);
});

test('E2E plages : des bornes tolérées incohérentes sont refusées (422)', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  // Toléré min au-dessus de l'idéal min : inverserait le sens du score.
  const inverted = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'bad-tolerance',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      toleratedMin: 6,
      unit: 'pH',
      sourceReference: 'Source de test',
    },
  });
  assert.equal(inverted.status, 422, JSON.stringify(inverted.body));
  assert.match(inverted.body.message, /tolérée minimale/);

  // Toléré max en dessous de l'idéal max.
  const tooLow = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'bad-tolerance',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      toleratedMax: 6.5,
      unit: 'pH',
      sourceReference: 'Source de test',
    },
  });
  assert.equal(tooLow.status, 422, JSON.stringify(tooLow.body));
  assert.match(tooLow.body.message, /tolérée maximale/);

  // Hors bornes physiques : un pH toléré à 20 n'existe pas.
  const impossible = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'bad-tolerance',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      toleratedMax: 20,
      unit: 'pH',
      sourceReference: 'Source de test',
    },
  });
  assert.equal(impossible.status, 422, JSON.stringify(impossible.body));
  assert.match(impossible.body.message, /physiquement plausible/);

  // Rien n'a été écrit.
  const stored = await h.prisma.cropAgronomicRange.count({ where: { cropSlug: 'bad-tolerance' } });
  assert.equal(stored, 0, 'aucune plage incohérente ne doit être enregistrée');
});

test('E2E plages : une borne tolérée peut être effacée, pas inventée', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const created = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'erase-crop',
      parameterKey: 'ph',
      minValue: 5.5,
      maxValue: 7,
      toleratedMin: 4.5,
      toleratedMax: 8,
      unit: 'pH',
      sourceReference: 'Source de test',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { id } = created.body.data;

  // `null` explicite : efface. Un simple `??` aurait ignoré l'intention.
  const cleared = await h.request('PATCH', `/agronomic-ranges/${id}`, {
    token: agroToken,
    body: { toleratedMin: null, toleratedMax: null },
  });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.equal(cleared.body.data.toleratedMin, null);
  assert.equal(cleared.body.data.toleratedMax, null);

  // Et un PATCH qui ne mentionne pas le champ ne le touche pas.
  await h.request('PATCH', `/agronomic-ranges/${id}`, {
    token: agroToken,
    body: { toleratedMin: 4.8 },
  });
  const untouched = await h.request('PATCH', `/agronomic-ranges/${id}`, {
    token: agroToken,
    body: { sourceNote: 'Note ajoutée' },
  });
  assert.equal(untouched.status, 200, JSON.stringify(untouched.body));
  assert.equal(untouched.body.data.toleratedMin, 4.8, 'le champ absent du PATCH doit être conservé');
  assert.equal(untouched.body.data.toleratedMax, null);
});

/* ─────────────── Lignes vides et zone ─────────────── */

test('E2E import : une ligne sans valeurs idéales est ignorée, pas en erreur', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise',
        // Ligne valide.
        'vide-crop;pH du sol;pH;5.5;7;Source de test',
        // Ligne de séparation : que des séparateurs.
        ';;;;;',
        // Culture annoncée mais fourchette pas encore établie.
        'vide-crop;Salinité maximale (EC);dS/m;;;Source de test',
        // Ligne valide.
        'vide-crop;Profondeur racinaire;cm;20;60;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const { summary, results } = response.body.data;
  assert.equal(summary.totalLines, 4);
  assert.equal(summary.created, 2, JSON.stringify(results));
  // Les deux lignes sans bornes idéales sont ignorées et comptées à part.
  assert.equal(summary.skippedEmpty, 2, JSON.stringify(results));
  // Elles ne sont **pas** des erreurs : le rapport ne mélange pas les deux.
  assert.equal(summary.errors, 0, JSON.stringify(results));

  const byLine = Object.fromEntries(results.map((row) => [row.line, row]));
  assert.equal(byLine[2].outcome, 'CREATED');
  assert.equal(byLine[3].outcome, 'SKIPPED_EMPTY');
  assert.equal(byLine[4].outcome, 'SKIPPED_EMPTY');
  assert.match(byLine[4].reason, /ignorée/);
  assert.equal(byLine[5].outcome, 'CREATED');
});

test('E2E import : une seule des deux bornes idéales reste une erreur', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise',
        // Un seul côté renseigné : ce n'est pas une ligne vide mais une
        // fourchette incomplète, et la compléter serait une invention.
        'demi-crop;pH du sol;pH;5.5;;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.skippedEmpty, 0);
  assert.equal(response.body.data.summary.errors, 1);
  assert.match(response.body.data.results[0].reason, /Une seule des deux bornes/);

  const stored = await h.prisma.cropAgronomicRange.count({ where: { cropSlug: 'demi-crop' } });
  assert.equal(stored, 0, 'aucune demi-fourchette ne doit être enregistrée');
});

test('E2E import : la zone est enregistrée sous sa forme canonique', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');
  await h.prisma.cropAgronomicRange.deleteMany({ where: { cropSlug: 'zone-crop' } });

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Zone concernée;Source précise',
        'zone-crop;pH du sol;pH;5.5;7;Équateur;Source de test',
        'zone-crop;Salinité maximale (EC);dS/m;0;1.2;bandundu;Source de test',
        'zone-crop;Profondeur racinaire;cm;20;60;LES DEUX;Source de test',
        'zone-crop;Humidité volumique du sol;%;18;38;;Source de test',
        'zone-crop;Température de l\'air;°C;20;30;Bassin de la Ruki;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.created, 5, JSON.stringify(response.body.data.results));

  const stored = await h.prisma.cropAgronomicRange.findMany({ where: { cropSlug: 'zone-crop' } });
  const byKey = Object.fromEntries(stored.map((row) => [row.parameterKey, row.zone]));

  // Accent et casse ignorés : les trois formes donnent la même valeur.
  assert.equal(byKey.ph, 'Equateur', '« Équateur » doit donner la forme canonique');
  assert.equal(byKey.ec, 'Bandundu', '« bandundu » doit donner la forme canonique');
  assert.equal(byKey.depthCm, 'Les deux', '« LES DEUX » doit donner la forme canonique');
  // Case vide : rien n'est inventé.
  assert.equal(byKey.moisture, null);
  // Zone non reconnue : conservée telle quelle, pas rejetée.
  assert.equal(byKey.airTemperatureC, 'Bassin de la Ruki');
});

test('E2E plages : la forme canonique de la zone est identique par les deux écritures', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const withAccent = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'zone-api-a', parameterKey: 'ph', minValue: 5.5, maxValue: 7,
      unit: 'pH', sourceReference: 'Source de test', zone: 'Équateur',
    },
  });
  assert.equal(withAccent.status, 201, JSON.stringify(withAccent.body));
  const withoutAccent = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'zone-api-b', parameterKey: 'ph', minValue: 5.5, maxValue: 7,
      unit: 'pH', sourceReference: 'Source de test', zone: 'Equateur',
    },
  });
  assert.equal(withoutAccent.status, 201, JSON.stringify(withoutAccent.body));

  // Les deux écritures aboutissent à la même valeur stockée.
  assert.equal(withAccent.body.data.zone, withoutAccent.body.data.zone);
  assert.equal(withAccent.body.data.zone, 'Equateur');
});

/* ─────────────── Type de source ─────────────── */

test('E2E import : « A choisir » est traité comme vide, une valeur hors menu est refusée', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Type de source;Source précise',
        // Menu non renseigné : la plage reste sans type déclaré.
        'source-crop;pH du sol;pH;5.5;7;A choisir;Source de test',
        // Valeur hors menu : refusée, pas remplacée par un type par défaut.
        'source-crop;Salinité maximale (EC);dS/m;0;1.2;Wikipédia;Source de test',
      ].join('\n'),
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const { summary, results } = response.body.data;
  assert.equal(summary.created, 1, JSON.stringify(results));
  assert.equal(summary.errors, 1, JSON.stringify(results));

  const byLine = Object.fromEntries(results.map((row) => [row.line, row]));
  assert.equal(byLine[2].outcome, 'CREATED');
  assert.equal(byLine[3].outcome, 'ERROR');
  assert.match(byLine[3].reason, /hors menu/);

  const stored = await h.prisma.cropAgronomicRange.findFirst({
    where: { cropSlug: 'source-crop', parameterKey: 'ph' },
  });
  assert.equal(stored.sourceType, null, '« A choisir » ne doit pas devenir un type de source');
});

test('E2E import : une plage déjà VALIDATED n’est pas écrasée', async () => {
  const agroToken = await connect('agro-ref@agrikonnect.test');

  // Création puis validation nominative.
  const created = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'protected-crop',
      parameterKey: 'ph',
      minValue: 6,
      maxValue: 7.5,
      unit: 'pH',
      sourceReference: 'Source de test',
      datasetLabel: 'test',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const validated = await h.request('POST', `/agronomic-ranges/${created.body.data.id}/validate`, {
    token: agroToken,
    body: { validatedBy: 'Dr. Alice Muteba' },
  });
  assert.equal(validated.status, 200, JSON.stringify(validated.body));

  // Un import tente de remplacer les bornes validées.
  const response = await h.request('POST', '/agronomic-ranges/import', {
    token: agroToken,
    body: {
      csv: [
        'Culture;Paramètre;Unité;Idéal min;Idéal max;Source précise',
        'protected-crop;pH du sol;pH;4;9;import non validé',
      ].join('\n'),
      datasetLabel: 'test',
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.summary.skippedValidated, 1);
  assert.equal(response.body.data.results[0].outcome, 'SKIPPED_VALIDATED');

  // Les bornes validées sont intactes.
  const stored = await h.prisma.cropAgronomicRange.findUnique({ where: { id: created.body.data.id } });
  assert.equal(stored.minValue, 6);
  assert.equal(stored.maxValue, 7.5);
  assert.equal(stored.status, 'VALIDATED');
});
