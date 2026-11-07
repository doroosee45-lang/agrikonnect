/**
 * SPEC-SUPER-ADMIN M4 — parcours de modération unifiée (e2e).
 *
 * AC-M4 : modération d'un élément réel créé en test de bout en bout :
 *   action → statut changé → notification de l'acteur → audit.
 *   - annonce créée **par l'API métier** (POST /listings) puis approuvée
 *     via POST /admin/operations/listing/:id/moderate ;
 *   - demande de vérification (statut PENDING) approuvée puis suspendue (refus
 *     explicite) via la même console.
 * Négatifs : entité inconnue, motif absent, élément absent.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

const PASSWORD = 'MotDePasse-M4!2026';
const ADMIN_EMAIL = 'admin-m4-ops@agrikonnect.test';
const PRODUCTEUR_EMAIL = 'producteur-m4-ops@agrikonnect.test';

let h;
const comptes = { admin: { id: null, token: null }, producteur: { id: null, token: null } };

const registerUser = async (email) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'M4',
      lastName: 'Recette',
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const seedRoles = async (userId, roles) => {
  const membership = await h.prisma.membership.findFirst({ where: { userId } });
  assert.ok(membership, `adhésion existante pour ${userId}`);
  await h.prisma.membership.update({ where: { id: membership.id }, data: { roles } });
};

before(async () => {
  h = await startHarness();
  const adminData = await registerUser(ADMIN_EMAIL);
  comptes.admin.id = adminData.user.id;
  await seedRoles(comptes.admin.id, ['ADMIN']);
  comptes.admin.token = (await h.request('POST', '/auth/login', {
    body: { identifier: ADMIN_EMAIL, password: PASSWORD },
  })).body.data.session.accessToken;

  const prodData = await registerUser(PRODUCTEUR_EMAIL);
  comptes.producteur.id = prodData.user.id;
  comptes.producteur.token = prodData.session.accessToken;
});

after(async () => {
  await h?.stop();
});

test('AC-M4 — annonce créée par l API marché, approuvée : statut + notification + audit', async () => {
  // 1. Élément réel créé en test : l'annonce passe par l'API métier (POST /listings).
  const creation = await h.request('POST', '/listings', {
    token: comptes.producteur.token,
    body: {
      type: 'PRODUCE',
      title: 'Maïs jaune — lot de recette M4',
      quantity: 120,
      unit: 'kg',
      countryCode: 'CD',
    },
  });
  assert.equal(creation.status, 201, `création annonce : ${JSON.stringify(creation.body)}`);
  const annonceId = creation.body.data.id;

  // 2. Action de modération via la console unifiée (motif obligatoire).
  const moderation = await h.request('POST', `/admin/operations/listing/${annonceId}/moderate`, {
    token: comptes.admin.token,
    body: { decision: 'approve', reason: 'Dossier produit vérifié et conforme' },
  });
  assert.equal(moderation.status, 200, `modération : ${JSON.stringify(moderation.body)}`);
  assert.equal(moderation.body.data.after.status, 'PUBLISHED', 'statut changé via le service métier');

  // 3. Notification de l'acteur concerné (RG-M4-2).
  const boite = await h.request('GET', '/notifications?limit=50', { token: comptes.producteur.token });
  assert.equal(boite.status, 200);
  const recues = boite.body.data.items ?? [];
  const decision = recues.find((n) => n.type === 'moderation.listing');
  assert.ok(decision, `le producteur reçoit la décision : ${JSON.stringify(recues.map((n) => n.type))}`);
  assert.match(decision.body ?? '', /Dossier produit vérifié/, 'le motif est porté par la notification');

  // 4. Audit complet (service métier + console).
  const journal = await h.request('GET', '/admin/audit?action=listing.moderate&limit=20', { token: comptes.admin.token });
  assert.equal(journal.status, 200);
  const lignes = journal.body.data ?? [];
  const trace = lignes.find((l) => l.resourceId === annonceId);
  assert.ok(trace, 'action `listing.moderate` tracée dans le journal');
  assert.equal(trace.newValue.status, 'PUBLISHED');
  assert.match(trace.newValue.reason, /Dossier produit/);
});

test('AC-M4 — vérification approuvée puis suspension refusée ; refus et négatifs', async () => {
  // Demande de vérification réelle (statut PENDING) créée pour le parcours.
  const demande = await h.prisma.verification.create({
    data: {
      id: 'ver_m4_e2e_0000000000000000001',
      subjectType: 'USER',
      subjectId: comptes.producteur.id,
      organizationId: (await h.prisma.membership.findFirst({ where: { userId: comptes.producteur.id } })).organizationId,
      level: 'PROFILE_VERIFIED',
      status: 'PENDING',
    },
  });

  const approbation = await h.request('POST', `/admin/operations/verification/${demande.id}/moderate`, {
    token: comptes.admin.token,
    body: { decision: 'approve', reason: 'Justificatifs d identité conformes' },
  });
  assert.equal(approbation.status, 200, `approbation : ${JSON.stringify(approbation.body)}`);
  assert.equal(approbation.body.data.after.status, 'APPROVED');

  // La suspension n'existe pas pour les vérifications → refus explicite.
  const suspension = await h.request('POST', `/admin/operations/verification/${demande.id}/moderate`, {
    token: comptes.admin.token,
    body: { decision: 'suspend', reason: 'Trop long à traiter' },
  });
  assert.ok(suspension.status === 400 || suspension.status === 422, `statut obtenu : ${suspension.status}`);
  assert.match(JSON.stringify(suspension.body), /suspension ne s applique pas/);

  // Refus motivé : décision sans motif.
  const sansMotif = await h.request('POST', `/admin/operations/listing/ver_m4_e2e_0000000000000000001/moderate`, {
    token: comptes.admin.token,
    body: { decision: 'reject' },
  });
  assert.ok(sansMotif.status === 400 || sansMotif.status === 422, `motif absent refusé (${sansMotif.status})`);

  // Entité inconnue.
  const entiteInconnue = await h.request('POST', '/admin/operations/dispute/d1/moderate', {
    token: comptes.admin.token,
    body: { decision: 'approve', reason: 'Motif suffisant' },
  });
  assert.ok(entiteInconnue.status === 400 || entiteInconnue.status === 422, `entité inconnue refusée (${entiteInconnue.status})`);

  // Élément absent.
  const absent = await h.request('POST', '/admin/operations/listing/lst_absente_000000000000/moderate', {
    token: comptes.admin.token,
    body: { decision: 'approve', reason: 'Motif suffisant' },
  });
  assert.equal(absent.status, 404, `élément absent → 404 (${absent.status})`);

  // La file de modération liste les éléments réels.
  const file = await h.request('GET', '/admin/operations/listing?limit=20', { token: comptes.admin.token });
  assert.equal(file.status, 200);
  assert.ok(Array.isArray(file.body.data) && file.body.data.length >= 1, 'la file contient l annonce créée');
  assert.ok(file.body.data.some((i) => i.entity === 'listing'));
});
