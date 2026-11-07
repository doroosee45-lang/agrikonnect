import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './support/harness.mjs';

/**
 * Recette de bout en bout — **base réelle** — intelligence agronomique (S2/S3)
 * et offre groupée coopérative (COOP-10).
 *
 * Ce que cette suite prouve, et que les doubles en mémoire ne peuvent pas prouver :
 *   - la séparation des rôles (SOIL-04) est appliquée côté serveur, y compris
 *     quand l'auteur du jeu de règles tente de le valider lui-même ;
 *   - les recommandations sont réellement désactivées par défaut (S2 §6.4) et
 *     ne s'ouvrent qu'après activation explicite, tracée et auditée ;
 *   - la fusion multi-sources (S3 §6.5) respecte la priorité
 *     laboratoire > capteur > satellite > photo > déclaré sur des lignes réelles ;
 *   - les quatre niveaux de compatibilité existent, dont « insuffisamment
 *     documenté » quand la couverture des données est trop faible ;
 *   - le rendement est une **fourchette** avec incertitude, jamais une promesse ;
 *   - l'agrégation publique applique le k-anonymat (≥ 10) ;
 *   - la répartition d'une offre groupée est figée et proportionnelle, et les
 *     membres sans consentement sont exclus.
 */

let h;
const PASSWORD = 'MotDePasse!2026';

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila', extra = {} }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType,
      firstName,
      lastName,
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
      ...extra,
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/** Crée une exploitation + une parcelle réelles pour un jeton donné. */
const createPlot = async (token, { farmName, plotName, province = 'Nord-Kivu' }) => {
  const farm = await h.request('POST', '/farms', {
    token,
    body: {
      name: farmName,
      countryCode: 'CD',
      province,
      latitude: -1.6789,
      longitude: 29.2234,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));

  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;
  assert.ok(farmId, 'identifiant d’exploitation');

  const plot = await h.request('POST', '/plots', {
    token,
    body: {
      farmId,
      name: plotName,
      geometry: {
        type: 'Polygon',
        coordinates: [[[29.22, -1.68], [29.24, -1.68], [29.24, -1.66], [29.22, -1.66], [29.22, -1.68]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  return { farmId, plotId: plot.body.data.id ?? plot.body.data.plot?.id };
};

before(async () => {
  h = await startHarness();
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

test('E2E SOIL-04 : un jeu de règles ne peut pas être validé par son auteur', async () => {
  await register({ email: 'agro1@agrikonnect.test', accountType: 'AGRONOMIST', firstName: 'Alice', lastName: 'Muteba' });
  await register({ email: 'agro2@agrikonnect.test', accountType: 'AGRONOMIST', firstName: 'Bernard', lastName: 'Kasa' });
  await register({ email: 'agro3@agrikonnect.test', accountType: 'AGRONOMIST', firstName: 'Chantal', lastName: 'Nsimba' });

  const authorToken = await connect('agro1@agrikonnect.test');
  const validatorToken = await connect('agro2@agrikonnect.test');
  const secondValidatorToken = await connect('agro3@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  const created = await h.request('POST', '/admin/rulesets', {
    token: authorToken,
    body: {
      version: '2026.1',
      zone: 'CD',
      countryCode: 'CD',
      cropSlug: crop.slug,
      notes: 'Référentiel manioc — validé sur essais Nord-Kivu',
      rules: {
        criteria: [
          { key: 'ph', type: 'range', min: 5.5, max: 7, weight: 2, label: 'pH favorable' },
          { key: 'organicMatter', type: 'min', value: 2, weight: 1, label: 'Matière organique', unit: '%' },
          { key: 'texture', type: 'in', values: ['limono-argileux'], weight: 1, label: 'Texture' },
        ],
        rotations: [
          {
            name: 'Manioc → légumineuse',
            after: [crop.slug],
            assumptions: ['Parcelle non inondable'],
            sequence: [
              { cropSlug: crop.slug, family: 'tubercules', rationale: 'Culture en place' },
              { cropSlug: 'niebe', family: 'legumineuses', rationale: 'Restitution d’azote' },
            ],
          },
        ],
        calendar: [
          { cropSlug: crop.slug, activity: 'Semi', startMonth: 10, endMonth: 11, rationale: 'Début de saison des pluies' },
          { cropSlug: crop.slug, activity: 'Désherbage', startMonth: 12, endMonth: 12 },
        ],
        yields: { lowKgPerHa: 800, highKgPerHa: 1500, unit: 'kg/ha' },
      },
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const ruleSetId = created.body.data.id;
  assert.equal(created.body.data.status, 'draft', 'un jeu de règles naît en brouillon');

  // L'auteur ne peut pas s'auto-valider (séparation des rôles).
  const selfValidation = await h.request('POST', `/admin/rulesets/${ruleSetId}/validate`, { token: authorToken });
  assert.equal(selfValidation.status, 403, JSON.stringify(selfValidation.body));

  // Un agronome distinct valide : la règle est alors opposable.
  const validated = await h.request('POST', `/admin/rulesets/${ruleSetId}/validate`, { token: validatorToken });
  assert.equal(validated.status, 200, JSON.stringify(validated.body));
  assert.equal(validated.body.data.ruleSet.status, 'validated');
  assert.equal(validated.body.data.alreadyValidated, false);
  assert.ok(validated.body.data.ruleSet.validatedAt, 'la validation est horodatée');

  const validatorProfile = await h.prisma.profile.findFirst({ where: { email: 'agro2@agrikonnect.test' } });
  assert.ok(
    validated.body.data.ruleSet.validatedBy.includes(validatorProfile.id),
    'identité du validateur conservée',
  );

  // Rejouer la validation est idempotent : le validateur d'origine n'est pas écrasé.
  const revalidation = await h.request('POST', `/admin/rulesets/${ruleSetId}/validate`, {
    token: secondValidatorToken,
  });
  assert.equal(revalidation.status, 200, JSON.stringify(revalidation.body));
  assert.equal(revalidation.body.data.alreadyValidated, true);
  assert.deepEqual(revalidation.body.data.ruleSet.validatedBy, [validatorProfile.id]);

  const row = await h.prisma.agronomicRuleSet.findUnique({ where: { id: ruleSetId } });
  assert.equal(row.status, 'validated');
  assert.ok(row.validatedBy.length >= 1, 'identité du validateur conservée en base');
});

test('E2E S2 §6.4 : recommandations désactivées par défaut, activées par zone', async () => {
  await register({ email: 'exploitant@agrikonnect.test', firstName: 'Joseph', lastName: 'Bahati' });
  const ownerToken = await connect('exploitant@agrikonnect.test');
  const { plotId } = await createPlot(ownerToken, { farmName: 'Ferme Essais', plotName: 'Parcelle Règles' });
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: ownerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [{ key: 'ph', value: '6.2', numericValue: 6.2, source: 'measured_lab', confidence: 'high' }],
    },
  });

  // Aucun flag posé : la recommandation est refusée explicitement.
  const blocked = await h.request('POST', `/plots/${plotId}/suitability`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  assert.match(blocked.body.message, /activ/i);

  // Activation par un administrateur de plateforme, tracée et auditée.
  await register({ email: 'admin-s2@agrikonnect.test', firstName: 'Admin', lastName: 'S2' });
  const admin = await h.prisma.profile.findFirst({ where: { email: 'admin-s2@agrikonnect.test' } });
  await h.prisma.membership.updateMany({ where: { userId: admin.id }, data: { roles: ['SUPER_ADMIN'] } });
  const adminToken = await connect('admin-s2@agrikonnect.test');

  const flag = await h.request('PUT', '/admin/feature-flags', {
    token: adminToken,
    body: {
      key: 'soil.recommendations',
      scope: 'country',
      scopeValue: 'CD',
      enabled: true,
      reason: 'Zone pilote Nord-Kivu validée par le comité agronomique',
    },
  });
  assert.equal(flag.status, 200, JSON.stringify(flag.body));
  assert.equal(flag.body.data.enabled, true);

  const auditRows = await h.prisma.auditLog.findMany({ where: { action: 'featureflag.set' } });
  assert.ok(auditRows.length >= 1, 'activation auditée');

  const allowed = await h.request('POST', `/plots/${plotId}/suitability`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(allowed.status, 201, JSON.stringify(allowed.body));
});

test('E2E SOIL-05/08/09 : compatibilité à quatre niveaux, expliquée et sourcée', async () => {
  const ownerToken = await connect('exploitant@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });
  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Règles' } });

  const assessed = await h.request('POST', `/plots/${plot.id}/soil-assessments`, {
    token: ownerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [
        { key: 'organicMatter', value: '2.5', numericValue: 2.5, unit: '%', source: 'measured_lab', confidence: 'high' },
        { key: 'texture', value: 'limono-argileux', source: 'declared', confidence: 'medium' },
      ],
    },
  });
  assert.equal(assessed.status, 201, JSON.stringify(assessed.body));

  const suitability = await h.request('POST', `/plots/${plot.id}/suitability`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(suitability.status, 201, JSON.stringify(suitability.body));
  const result = suitability.body.data;

  assert.ok(
    ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENTLY_DOCUMENTED'].includes(result.level),
    `niveau parmi les quatre du CDC (${result.level})`,
  );
  assert.equal(result.level, 'HIGH', 'trois critères satisfaits ⇒ favorable');
  assert.equal(result.levelLabel, 'favorable');
  assert.equal(result.reasons.length, 3, 'un motif par critère évalué');

  // SOIL-08 — chaque motif cite la règle, la valeur observée et sa source.
  for (const reason of result.reasons) {
    assert.ok(reason.label, 'libellé du critère');
    assert.ok(reason.expected, 'attendu documenté');
    assert.ok(reason.source, 'source de la donnée');
    assert.ok(typeof reason.sourceRank === 'number', 'rang de priorité de la source');
    assert.equal(reason.met, true);
  }
  assert.ok(result.explanation.summary.includes('favorable'));
  assert.equal(result.explanation.satisfied.length, 3);
  assert.ok(result.disclaimer, 'aucun niveau n’est servi sans réserve');

  // SOIL-09 — données insuffisantes : aucun niveau chiffré n'est inventé.
  const sparse = await createPlot(ownerToken, { farmName: 'Ferme Partielle', plotName: 'Parcelle Peu Documentée' });
  await h.request('POST', `/plots/${sparse.plotId}/soil-assessments`, {
    token: ownerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [{ key: 'ph', value: '6.4', numericValue: 6.4, source: 'declared', confidence: 'low' }],
    },
  });

  const insufficient = await h.request('POST', `/plots/${sparse.plotId}/suitability`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(insufficient.status, 201, JSON.stringify(insufficient.body));
  assert.equal(insufficient.body.data.level, 'INSUFFICIENTLY_DOCUMENTED');
  assert.equal(insufficient.body.data.levelLabel, 'insuffisamment documenté');
  assert.ok(insufficient.body.data.coverage < 0.6, 'couverture insuffisante explicitée');
  assert.ok(insufficient.body.data.missingData.length >= 2, 'données manquantes listées');
  assert.ok(insufficient.body.data.explanation.missing.length >= 2);

  // La lecture d'un dossier de compatibilité est bornée au tenant.
  await register({ email: 'outsider-s2@agrikonnect.test' });
  const outsiderToken = await connect('outsider-s2@agrikonnect.test');
  const forbidden = await h.request('POST', `/plots/${sparse.plotId}/suitability`, {
    token: outsiderToken,
    body: { cropId: crop.id },
  });
  assert.equal(forbidden.status, 404, 'parcelle d’un autre tenant invisible');
});

test('E2E SOIL-10→13 : fusion des sources, laboratoire prioritaire, profil exposé', async () => {
  const ownerToken = await connect('exploitant@agrikonnect.test');
  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Règles' } });

  // Mesure déclarée plus récente mais moins fiable (pH 4,0).
  const declared = await h.request('POST', `/plots/${plot.id}/soil-assessments`, {
    token: ownerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [{ key: 'ph', value: '4.0', numericValue: 4, source: 'declared', confidence: 'low' }],
    },
  });
  assert.equal(declared.status, 201, JSON.stringify(declared.body));

  // Mesure satellite encore plus récente : toujours moins prioritaire qu'un labo.
  await h.request('POST', `/plots/${plot.id}/soil-assessments`, {
    token: ownerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [{ key: 'ph', value: '5.1', numericValue: 5.1, source: 'satellite', confidence: 'medium' }],
    },
  });

  const profile = await h.request('GET', `/plots/${plot.id}/soil-profile`, { token: ownerToken });
  assert.equal(profile.status, 200, JSON.stringify(profile.body));
  const data = profile.body.data;
  const fused = data.fusedProfile;

  assert.equal(fused.ph.source, 'measured_lab', 'laboratoire prioritaire (CDC §6.5)');
  assert.equal(Number(fused.ph.numericValue), 6.2);
  const alternativeSources = fused.ph.alternatives.map((a) => a.source);
  assert.ok(alternativeSources.includes('declared'), 'valeur déclarée conservée en alternative');
  assert.ok(alternativeSources.includes('satellite'), 'valeur satellite conservée en alternative');

  // L'ordre de priorité est publié, pas implicite.
  const ranks = Object.fromEntries(data.sourcePriority.map((p) => [p.source, p.rank]));
  assert.ok(ranks.measured_lab < ranks.measured_sensor);
  assert.ok(ranks.measured_sensor < ranks.satellite);
  assert.ok(ranks.satellite < ranks.photo_interpreted);
  assert.ok(ranks.photo_interpreted < ranks.declared);
});

test('E2E SOIL-06/07 : rotation statuée une fois, plan agricole issu du calendrier', async () => {
  const ownerToken = await connect('exploitant@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });
  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Règles' } });

  const rotation = await h.request('POST', `/plots/${plot.id}/rotation-plans`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(rotation.status, 201, JSON.stringify(rotation.body));
  const plan = rotation.body.data;
  assert.equal(plan.status, 'PROPOSED');
  assert.equal(plan.steps.sequence.length, 2, 'deux années proposées');
  assert.equal(plan.steps.sequence[1].cropSlug, 'niebe');
  assert.ok(plan.ruleSetVersion, 'version du jeu de règles citée');
  assert.ok(plan.disclaimer, 'réserve affichée');

  const accepted = await h.request('PATCH', `/plots/${plot.id}/rotation-plans/${plan.id}`, {
    token: ownerToken,
    body: { decision: 'ACCEPTED', comment: 'Validé avec l’agronome de zone' },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.data.status, 'ACCEPTED');

  const again = await h.request('PATCH', `/plots/${plot.id}/rotation-plans/${plan.id}`, {
    token: ownerToken,
    body: { decision: 'REJECTED' },
  });
  assert.equal(again.status, 409, 'un plan déjà statué ne se rejoue pas');

  const farming = await h.request('POST', `/plots/${plot.id}/farming-plans`, {
    token: ownerToken,
    body: { rotationPlanId: plan.id },
  });
  assert.equal(farming.status, 201, JSON.stringify(farming.body));
  const farmingPlan = farming.body.data;
  const entries = farmingPlan.calendar.entries;
  assert.ok(entries.length >= 2, 'activités du calendrier reprises');
  assert.equal(farmingPlan.calendar.ruleSetVersion, '2026.1', 'provenance des activités');
  assert.ok(
    entries.some((entry) => entry.activity === 'Semi' && entry.window.startMonth === 10),
    'fenêtre de semi reprise telle quelle',
  );
  assert.equal(farmingPlan.horizonYears, 2, 'horizon hérité du plan de rotation');
});

test('E2E SOIL-14 : rendement en fourchette, jamais une garantie', async () => {
  const ownerToken = await connect('exploitant@agrikonnect.test');
  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });
  const plot = await h.prisma.plot.findFirst({ where: { name: 'Parcelle Règles' } });

  const estimate = await h.request('POST', `/plots/${plot.id}/yield-estimates`, {
    token: ownerToken,
    body: { cropId: crop.id },
  });
  assert.equal(estimate.status, 201, JSON.stringify(estimate.body));
  const data = estimate.body.data;

  assert.ok(Number(data.lowKg) < Number(data.pointKg), 'borne basse < point');
  assert.ok(Number(data.pointKg) < Number(data.highKg), 'point < borne haute');
  assert.ok(Number(data.uncertaintyPct) > 0, 'incertitude chiffrée');
  assert.equal(data.method, 'rules-based-range');
  assert.ok(data.ruleSetVersion, 'version de règle citée');
  assert.ok(data.sources.assessmentCount >= 1, 'sol réellement pris en compte');
  assert.match(data.disclaimer, /fourchette|garantie/i);
});

test('E2E SOIL-16 : statistiques publiques de sol sous k-anonymat', async () => {
  const response = await h.request('GET', '/public/soil-stats?countryCode=CD');
  assert.equal(response.status, 200, JSON.stringify(response.body));

  // Moins de 10 analyses : aucun agrégat n'est publié, la règle est dite.
  assert.ok(response.body.data.suppressedGroups.length >= 1, 'groupes sous le seuil supprimés');
  assert.equal(response.body.data.rows.length, 0, 'aucune moyenne publiée sous le seuil');
  assert.equal(response.body.data.suppressedGroups[0].reason, 'k < 10');
  assert.ok(response.body.data.kAnonymity >= 10, 'seuil de k-anonymat affiché');
  assert.equal(/numericValue"\s*:/.test(JSON.stringify(response.body.data)), false, 'aucune valeur individuelle');
});

test('E2E COOP-10 : offre groupée proportionnelle, consentement respecté', async () => {
  await register({
    email: 'coop@agrikonnect.test',
    accountType: 'COOPERATIVE_ADMIN',
    firstName: 'Patrice',
    lastName: 'Mwamba',
    extra: { cooperativeName: 'Coopérative Kivu Maïs' },
  });
  const coopToken = await connect('coop@agrikonnect.test');

  const current = await h.request('GET', '/cooperatives/current', { token: coopToken });
  assert.equal(current.status, 200, JSON.stringify(current.body));
  const cooperativeId = current.body.data.id;

  // Deux producteurs membres, un troisième sans consentement « productions ».
  const members = [];
  for (const [index, email] of ['membre1@agrikonnect.test', 'membre2@agrikonnect.test', 'membre3@agrikonnect.test'].entries()) {
    await register({ email, firstName: `Membre${index + 1}`, lastName: 'Kivu' });
    const token = await connect(email);
    const { farmId } = await createPlot(token, {
      farmName: `Ferme ${email}`,
      plotName: `Parcelle ${email}`,
    });
    members.push({ email, token, farmId });
  }

  const crop = await h.prisma.crop.findFirst({ where: { slug: 'manioc' } });

  // Productions déclarées : 1000 kg et 3000 kg.
  for (const [index, quantity] of [1000, 3000].entries()) {
    const production = await h.request('POST', '/productions', {
      token: members[index].token,
      body: {
        farmId: members[index].farmId,
        cropId: crop.id,
        harvestedAt: '2026-08-15',
        season: '2026A',
        quantity,
        unit: 'kg',
        quantityKg: quantity,
      },
    });
    assert.equal(production.status, 201, JSON.stringify(production.body));
  }

  // Adhésions : deux avec consentement, une sans.
  const memberIds = [];
  for (const [index, member] of members.entries()) {
    const added = await h.request('POST', `/cooperatives/${cooperativeId}/members`, {
      token: coopToken,
      body: {
        identifier: member.email,
        consentScopes: index === 2 ? ['profile', 'plots'] : ['profile', 'plots', 'productions'],
      },
    });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    memberIds.push(added.body.data.id);

    const activated = await h.request('PATCH', `/cooperatives/${cooperativeId}/members/${added.body.data.id}`, {
      token: coopToken,
      body: { status: 'ACTIVE' },
    });
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
  }

  const preview = await h.request('POST', `/cooperatives/${cooperativeId}/group-offers/preview`, {
    token: coopToken,
    body: { cropId: crop.id, season: '2026A' },
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  const pool = preview.body.data;

  assert.equal(pool.totalKg, 4000, 'somme des disponibilités déclarées');
  assert.equal(pool.memberCount, 2, 'seuls les membres consentants sont agrégés');
  assert.equal(pool.excludedMembers.length, 1, 'le refus de consentement est respecté');
  const shares = pool.split.map((s) => s.share).sort();
  assert.deepEqual(shares, [0.25, 0.75], 'répartition proportionnelle');

  const offer = await h.request('POST', `/cooperatives/${cooperativeId}/group-offers`, {
    token: coopToken,
    body: {
      cropId: crop.id,
      season: '2026A',
      title: 'Manioc groupé — saison 2026A',
      pricePerUnit: 0.4,
      currency: 'USD',
      countryCode: 'CD',
    },
  });
  assert.equal(offer.status, 201, JSON.stringify(offer.body));
  const offerId = offer.body.data.offer.id;
  assert.equal(offer.body.data.offer.status, 'PROPOSED');
  assert.equal(offer.body.data.offer.quantity, 4000, 'volume figé à la création');
  assert.equal(offer.body.data.offer.split.members.length, 2);

  const confirmed = await h.request('POST', `/cooperatives/${cooperativeId}/group-offers/${offerId}/confirm`, {
    token: coopToken,
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.offer.status, 'CONFIRMED');
  assert.ok(confirmed.body.data.listing.id, 'une annonce est préparée (brouillon)');
  assert.equal(confirmed.body.data.listing.status, 'DRAFT', 'rien n’est publié sans vérification');

  // La répartition est figée : elle ne bouge plus après confirmation.
  const frozen = await h.prisma.groupOffer.findUnique({ where: { id: offerId } });
  assert.ok(frozen.split, 'répartition persistée');
  const frozenSplit = frozen.split.members;
  assert.equal(frozenSplit.length, 2);
  assert.equal(
    Math.round(frozenSplit.reduce((sum, line) => sum + line.quantityKg, 0)),
    4000,
  );

  const recancel = await h.request('POST', `/cooperatives/${cooperativeId}/group-offers/${offerId}/cancel`, {
    token: coopToken,
    body: { reason: 'Annulation tardive' },
  });
  assert.equal(recancel.status, 409, 'une offre confirmée ne peut plus être annulée');
});
