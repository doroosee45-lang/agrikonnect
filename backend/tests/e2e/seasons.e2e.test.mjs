/**
 * Recette de bout en bout — retours de saison (rendement réellement obtenu).
 *
 * ## Ce que cette recette prouve, et que les tests unitaires ne peuvent pas
 *
 *  1. un rendement déclaré est enregistré contre une **base PostgreSQL réelle**,
 *     avec le rendement par hectare **calculé à la lecture** et non stocké ;
 *  2. une source **calculée** (`satellite`, `estimated`, `derived`) est refusée
 *     par la route, pas seulement par le schéma ;
 *  3. le rattachement à une recommandation d'**une autre parcelle** est refusé :
 *     sans ce contrôle, le rapprochement comparerait deux choses sans rapport ;
 *  4. l'isolation entre organisations tient : un retour d'une autre organisation
 *     est **404**, pas 403 — on ne révèle pas son existence ;
 *  5. les statistiques **n'inventent pas** de rendement à l'hectare : les retours
 *     sans surface sont comptés à part et exclus de la moyenne ;
 *  6. le rapprochement avec la recommandation ne produit **aucun verdict**.
 *
 * ## Ce que cette recette ne prouve pas
 *
 * Aucun écran n'est piloté : la saisie du rendement est testée par l'API
 * uniquement.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

const PASSWORD = 'MotDePasse!2026';

let h;
let farmerToken;
let farmerUserId;
let agronomistToken;
let organizationId;
let farmId;
let plotId;
let otherPlotId;
let outsiderToken;
let recommendationId;

const register = async ({ email, accountType = 'FARMER', firstName, lastName }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType, firstName, lastName, email, password: PASSWORD,
      countryCode: 'CD', locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

before(async () => {
  h = await startHarness();

  const farmer = await register({
    email: 'fermier-saisons@agrikonnect.test',
    firstName: 'Josué',
    lastName: 'Bomoi',
  });
  farmerUserId = farmer.user.id;
  // `register` renvoie { user, organization, session } : l'organisation créée
  // pour l'inscrit est dans `organization`, pas dans `user.organizations`.
  organizationId = farmer.organization.id;
  assert.ok(organizationId, 'une organisation individuelle est créée à l’inscription');

  // L'agronome s'inscrit à part : il obtient sa propre organisation. On le
  // rattache à celle de l'agriculteur, sinon toutes ses routes renvoient 404.
  const agronomist = await register({
    email: 'agro-saisons@agrikonnect.test',
    accountType: 'AGRONOMIST',
    firstName: 'Alice',
    lastName: 'Muteba',
  });
  await h.prisma.membership.create({
    data: {
      id: 'mbr_saisons_agro_0000000001',
      userId: agronomist.user.id,
      organizationId,
      roles: ['AGRONOMIST'],
    },
  });

  // Un tiers, dans sa propre organisation : sert à prouver l'isolation.
  await register({
    email: 'tiers-saisons@agrikonnect.test',
    firstName: 'Paul',
    lastName: 'Ekila',
  });

  farmerToken = await connect('fermier-saisons@agrikonnect.test');
  agronomistToken = await connect('agro-saisons@agrikonnect.test');
  outsiderToken = await connect('tiers-saisons@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme saisons',
      countryCode: 'CD',
      province: 'Équateur',
      latitude: 0.0481,
      longitude: 18.2557,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const makePlot = async (name) => {
    const response = await h.request('POST', '/plots', {
      token: farmerToken,
      body: {
        farmId,
        name,
        geometry: {
          type: 'Polygon',
          coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
        },
        status: 'PLANTED',
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id ?? response.body.data.plot?.id;
  };
  plotId = await makePlot('Parcelle rendement');
  otherPlotId = await makePlot('Parcelle sans rapport');

  /*
   * Une mesure de sol, sinon la recommandation est refusée en 422 et le test de
   * rattachement se saurait en silence — un test qui ne s'exécute jamais ne
   * protège rien. La recommandation peut finir `INSUFFICIENT_DATA` (aucune plage
   * en base), cela suffit : c'est la ligne qui doit exister pour que le contrôle
   * de parcelle soit atteignable.
   */
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [
        { key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
        { key: 'ec', value: '1.2', numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  const recommendation = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-03-01', periodEnd: '2026-06-30' },
  });
  assert.equal(recommendation.status, 201, `recommandation : ${JSON.stringify(recommendation.body)}`);
  recommendationId =
    recommendation.body.data.id ?? recommendation.body.data.recommendation?.id;
  assert.ok(recommendationId, 'une recommandation doit exister pour tester le rattachement');
});

after(async () => {
  await h?.stop();
});

const yieldPayload = (overrides = {}) => ({
  plotId,
  cropId: 'mais',
  season: 'Saison A',
  year: 2026,
  periodStart: '2026-03-01',
  periodEnd: '2026-06-30',
  actualYieldKg: 4200,
  areaHa: 1.5,
  ...overrides,
});

test('Saisons : un rendement déclaré est enregistré, avec son rendement par hectare calculé', async () => {
  const response = await h.request('POST', '/seasons', { token: farmerToken, body: yieldPayload() });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const feedback = response.body.data.seasonFeedback;
  assert.equal(feedback.actualYieldKg, 4200);
  assert.equal(feedback.source, 'declared', 'la source par défaut est la déclaration');
  assert.equal(feedback.yieldPerHa, 2800, '4200 kg sur 1,5 ha');
  assert.equal(feedback.createdBy, farmerUserId);

  // Le rendement par hectare n'est **pas** une colonne : il doit être absent de
  // la ligne en base, sinon il se désynchroniserait de ses deux entrées.
  const row = await h.prisma.seasonFeedback.findUnique({ where: { id: feedback.id } });
  assert.equal('yieldPerHa' in row, false, 'yieldPerHa ne doit pas être stocké');
});

test('Saisons : une surface absente ne donne aucun rendement par hectare', async () => {
  const { areaHa, ...withoutArea } = yieldPayload();
  const response = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: withoutArea,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(
    response.body.data.seasonFeedback.yieldPerHa,
    null,
    'null, et non 0 : on ne sait rien, on n’a pas mesuré zéro',
  );
});

test('Saisons : les sources calculées sont refusées par la route', async () => {
  for (const source of ['satellite', 'estimated', 'derived']) {
    const response = await h.request('POST', '/seasons', {
      token: farmerToken,
      body: yieldPayload({ source }),
    });
    assert.equal(response.status, 422, `source ${source} : ${response.status}`);
  }
});

test('Saisons : un rendement par hectare invraisemblable est refusé', async () => {
  const response = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ actualYieldKg: 500000, areaHa: 1 }),
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
});

test('Saisons : une culture inconnue est refusée', async () => {
  const response = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ cropId: 'culture-qui-n-existe-pas' }),
  });
  assert.equal(response.status, 404, JSON.stringify(response.body));
});

test('Saisons : une parcelle d’une autre organisation est refusée', async () => {
  const outsiderFarm = await h.request('POST', '/farms', {
    token: outsiderToken,
    body: {
      name: 'Ferme du tiers',
      countryCode: 'CD',
      province: 'Bandundu',
      latitude: -3.3,
      longitude: 17.4,
      totalAreaHa: 4,
    },
  });
  const outsiderPlot = await h.request('POST', '/plots', {
    token: outsiderToken,
    body: {
      farmId: outsiderFarm.body.data.id ?? outsiderFarm.body.data.farm?.id,
      name: 'Parcelle du tiers',
      geometry: {
        type: 'Polygon',
        coordinates: [[[17.4, -3.3], [17.41, -3.3], [17.41, -3.29], [17.4, -3.29], [17.4, -3.3]]],
      },
      status: 'PLANTED',
    },
  });
  const outsiderPlotId = outsiderPlot.body.data.id ?? outsiderPlot.body.data.plot?.id;

  const response = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ plotId: outsiderPlotId }),
  });
  // 404 et non 403 : on ne révèle pas qu'une parcelle existe ailleurs.
  assert.equal(response.status, 404, JSON.stringify(response.body));
});

test('Saisons : rattachement à une recommandation d’une autre parcelle refusé', async () => {
  const response = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ plotId: otherPlotId, recommendationId }),
  });
  // `ApiError.badRequest` vaut 422 dans ce dépôt, pas 400.
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(JSON.stringify(response.body), /autre parcelle/);
});

test('Saisons : la liste est filtrable et paginée', async () => {
  const response = await h.request('GET', '/seasons?limit=50&season=Saison%20A', {
    token: farmerToken,
  });
  assert.equal(response.status, 200);
  // `paginated()` place le tableau dans `data` et les compteurs dans `meta` —
  // même convention que `/productions`, donc pas de `data.items` ici.
  assert.ok(Array.isArray(response.body.data), 'data est le tableau');
  assert.ok(response.body.data.length >= 1);
  assert.ok(response.body.data.every((item) => item.season === 'Saison A'));
  assert.equal(typeof response.body.meta.total, 'number');
});

test('Saisons : les statistiques n’inventent pas de rendement à l’hectare', async () => {
  const response = await h.request('GET', '/seasons/stats?groupBy=crop', { token: farmerToken });
  assert.equal(response.status, 200);
  const stats = response.body.data;

  assert.equal(stats.groupBy, 'crop');
  assert.ok(stats.withoutAreaCount >= 1, 'le retour sans surface doit être compté à part');

  const mais = stats.groups.find((group) => group.label === 'mais');
  assert.ok(mais, 'groupe maïs présent');
  assert.ok(mais.withoutArea >= 1, 'les retours sans surface sont signalés dans le groupe');
  // La moyenne existe parce qu'au moins un retour porte une surface.
  assert.equal(typeof mais.yieldPerHa, 'number');
});

test('Saisons : le regroupement par parcelle fonctionne', async () => {
  const response = await h.request('GET', '/seasons/stats?groupBy=plot', { token: farmerToken });
  assert.equal(response.status, 200);
  assert.ok(response.body.data.groups.length >= 1);
  assert.ok(response.body.data.groups.every((group) => typeof group.feedbackCount === 'number'));
});

/*
 * ## Cas chiffré exact — les kilos sans surface ne gonflent pas le rendement
 *
 * Le défaut corrigé : `totalYieldKg` additionnait **tous** les kilos, y compris
 * ceux des retours sans surface, alors que `totalAreaHa` n'additionnait que les
 * surfaces connues. Le numérateur contenait donc des kilos auxquels aucun
 * dénominateur ne correspondait, et le rendement à l'hectare était gonflé.
 *
 * Trois retours sur une parcelle dédiée (aucun autre test n'y écrit, le groupe
 * est donc déterministe) :
 *
 *   1. 3 000 kg sur 2,0 ha   → avec surface
 *   2. 1 500 kg sur 0,5 ha   → avec surface
 *   3. 9 000 kg, sans surface → exclu du rendement, compté à part
 *
 * Attendu, calculé à la main :
 *
 *   totalYieldKg        = 3 000 + 1 500          = 4 500
 *   totalAreaHa         = 2,0 + 0,5              = 2,5
 *   yieldPerHa          = 4 500 / 2,5            = 1 800,00
 *   withoutArea         = 1
 *   yieldKgWithoutArea  = 9 000
 *
 * Avec l'ancien code, le même jeu de données donnait
 * `13 500 / 2,5 = 5 400,00` — soit le triple. L'écart est volontairement assez
 * grand pour qu'une régression saute aux yeux au lieu de passer inaperçue dans
 * un arrondi.
 */
test('Saisons : les kilos sans surface sont exclus du rendement par hectare (cas chiffré)', async () => {
  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle cas chiffré',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.30, 0.060], [18.31, 0.060], [18.31, 0.064], [18.30, 0.064], [18.30, 0.060]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  const casePlotId = plot.body.data.id ?? plot.body.data.plot?.id;

  const envoyer = async (overrides) => {
    const response = await h.request('POST', '/seasons', {
      token: farmerToken,
      body: yieldPayload({ plotId: casePlotId, ...overrides }),
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
  };

  await envoyer({ actualYieldKg: 3000, areaHa: 2.0 });
  await envoyer({ actualYieldKg: 1500, areaHa: 0.5 });
  /*
   * « Sans surface » s'exprime en **omettant** le champ, pas en passant `null` :
   * le schéma fait `z.coerce.number().positive().optional()`, donc `null` est
   * converti en `0` puis refusé en 422 (« Surface positive requise »). C'est
   * l'omission qui produit la ligne sans surface.
   */
  const sansSurface = yieldPayload({ plotId: casePlotId, actualYieldKg: 9000 });
  delete sansSurface.areaHa;
  const refus = await h.request('POST', '/seasons', { token: farmerToken, body: sansSurface });
  assert.equal(refus.status, 201, JSON.stringify(refus.body));
  assert.equal(
    refus.body.data.seasonFeedback.areaHa,
    null,
    'la ligne est bien enregistrée sans surface',
  );

  const response = await h.request('GET', '/seasons/stats?groupBy=plot', { token: farmerToken });
  assert.equal(response.status, 200);
  const groupe = response.body.data.groups.find((g) => g.key === casePlotId);
  assert.ok(groupe, `le groupe de la parcelle ${casePlotId} doit exister`);

  assert.equal(groupe.feedbackCount, 3, 'les trois retours sont comptés');
  assert.equal(groupe.totalAreaHa, 2.5, '2,0 + 0,5 = 2,5 ha');
  assert.equal(groupe.totalYieldKg, 4500, '3 000 + 1 500 = 4 500 kg — les 9 000 kg sans surface n’y sont pas');
  assert.equal(groupe.yieldPerHa, 1800, '4 500 / 2,5 = 1 800,00 kg/ha');
  assert.equal(groupe.withoutArea, 1, 'un retour sans surface');
  assert.equal(groupe.yieldKgWithoutArea, 9000, 'les 9 000 kg sont comptés à part, pas perdus');

  // Garde-fou contre la régression précise : l'ancien code donnait 5 400.
  assert.notEqual(groupe.yieldPerHa, 5400, 'le rendement ne doit pas inclure les kilos sans surface');

  // Le total racine porte les mêmes kilos, séparés.
  assert.ok(response.body.data.withoutAreaCount >= 1);
  assert.ok(
    response.body.data.yieldKgWithoutArea >= 9000,
    'le total racine des kilos sans surface inclut les 9 000 kg du cas',
  );
});

test('Saisons : une correction incrémente la version', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ actualYieldKg: 3000, areaHa: 1 }),
  });
  const id = created.body.data.seasonFeedback.id;
  assert.equal(created.body.data.seasonFeedback.version, 1);

  const patched = await h.request('PATCH', `/seasons/${id}`, {
    token: farmerToken,
    body: { actualYieldKg: 3600 },
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  assert.equal(patched.body.data.actualYieldKg, 3600);
  assert.equal(patched.body.data.version, 2, 'une correction doit rester repérable');
  assert.equal(patched.body.data.yieldPerHa, 3600);
});

test('Saisons : une correction qui rend la période incohérente est refusée', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ periodStart: '2026-03-01', periodEnd: '2026-06-30' }),
  });
  const id = created.body.data.seasonFeedback.id;

  /*
   * Le PATCH ne porte que `periodStart`, mais la cohérence est jugée avec le
   * `periodEnd` **déjà enregistré**. Un contrôle qui ne regarderait que le champ
   * fourni laisserait passer une période inversée.
   */
  const response = await h.request('PATCH', `/seasons/${id}`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(JSON.stringify(response.body), /fin de période/);
});

test('Saisons : un champ inconnu en mise à jour est refusé', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload(),
  });
  const id = created.body.data.seasonFeedback.id;

  const response = await h.request('PATCH', `/seasons/${id}`, {
    token: farmerToken,
    body: { predictedYieldKg: 5000 },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
});

test('Saisons : le rapprochement avec la recommandation ne produit aucun verdict', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ recommendationId }),
  });
  const id = created.body.data.seasonFeedback.id;

  const response = await h.request('GET', `/seasons/${id}/compare`, { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const compare = response.body.data;

  // Le rappel doit être présent dans **tous** les cas : c'est lui qui empêche un
  // écran de lire ce rapprochement comme une validation de la recommandation.
  assert.ok(compare.scoreNote, 'le rappel « adéquation, pas rendement » est obligatoire');
  assert.match(compare.scoreNote, /adéquation/i);

  /*
   * Aucun champ de verdict. Si l'un d'eux apparaissait un jour, un écran
   * afficherait « la recommandation s'est trompée » — une causalité que les
   * données ne portent pas.
   */
  const serialized = JSON.stringify(compare);
  for (const forbidden of ['"verdict"', '"wasRight"', '"accuracy"', '"predictionError"']) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} ne doit pas exister`);
  }

  if (compare.comparable) {
    assert.ok(compare.recommendation.id);
    assert.equal(typeof compare.recommendation.culturesClassified, 'number');
  } else {
    assert.equal(compare.recommendation, null);
    assert.ok(compare.reason, 'un rapprochement impossible dit pourquoi');
  }
});

test('Saisons : l’agronome lit mais n’écrit pas', async () => {
  const read = await h.request('GET', '/seasons', { token: agronomistToken });
  assert.equal(read.status, 200, 'l’agronome doit voir ce qui a été récolté');

  const write = await h.request('POST', '/seasons', {
    token: agronomistToken,
    body: yieldPayload(),
  });
  assert.equal(write.status, 403, `l'agronome ne déclare pas une récolte : ${write.status}`);
});

test('Saisons : l’archivage est logique, la ligne reste lisible en base', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ actualYieldKg: 1111 }),
  });
  const id = created.body.data.seasonFeedback.id;

  const removed = await h.request('DELETE', `/seasons/${id}`, { token: farmerToken });
  assert.equal(removed.status, 204);

  // Plus visible par l'API…
  const after = await h.request('GET', `/seasons/${id}`, { token: farmerToken });
  assert.equal(after.status, 404);

  // …mais toujours en base : une vérité déclarée ne se supprime pas.
  const row = await h.prisma.seasonFeedback.findUnique({ where: { id } });
  assert.ok(row, 'la ligne existe encore');
  assert.ok(row.deletedAt, 'deletedAt est posé');
});

test('Saisons : un retour d’une autre organisation est invisible', async () => {
  const created = await h.request('POST', '/seasons', {
    token: farmerToken,
    body: yieldPayload({ actualYieldKg: 2222 }),
  });
  const id = created.body.data.seasonFeedback.id;

  const direct = await h.request('GET', `/seasons/${id}`, { token: outsiderToken });
  assert.equal(direct.status, 404, 'on ne révèle pas l’existence du retour');

  const patch = await h.request('PATCH', `/seasons/${id}`, {
    token: outsiderToken,
    body: { actualYieldKg: 1 },
  });
  assert.equal(patch.status, 404);

  const remove = await h.request('DELETE', `/seasons/${id}`, { token: outsiderToken });
  assert.equal(remove.status, 404);

  // Et la ligne n'a pas bougé.
  const row = await h.prisma.seasonFeedback.findUnique({ where: { id } });
  assert.equal(row.actualYieldKg, 2222);
  assert.equal(row.deletedAt, null);
});

test('Saisons : sans jeton, rien n’est accessible', async () => {
  const list = await h.request('GET', '/seasons');
  assert.equal(list.status, 401);
  const create = await h.request('POST', '/seasons', { body: yieldPayload() });
  assert.equal(create.status, 401);
});
