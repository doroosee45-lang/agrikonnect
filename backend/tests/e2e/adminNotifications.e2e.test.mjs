/**
 * SPEC-SUPER-ADMIN M7 — annonces internes ciblées (e2e).
 *
 * AC-M7 : annonce ciblée reçue par le compte de test concerné.
 *   - diffusion par rôle (BUYER) : l'acheteur reçoit l'annonce dans sa boîte
 *     (GET /notifications), le producteur non ciblé ne la reçoit pas ;
 *   - diffusion par pays + rôle (intersection) vérifiée par les compteurs ;
 *   - historique des envois consultable (GET /admin/notifications/history) ;
 *   - l'effet d'un feature flag sur l'écran ciblé est couvert par les tests M3
 *     (adminSettings.e2e — `zone_feature_flags`).
 * Négatifs : annonce sans cible refusée.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

const PASSWORD = 'MotDePasse-M7!2026';
const ADMIN_EMAIL = 'admin-m7-notif@agrikonnect.test';
const ACHETEUR_EMAIL = 'acheteur-m7-notif@agrikonnect.test';
const PRODUCTEUR_EMAIL = 'producteur-m7-notif@agrikonnect.test';

let h;
const comptes = { admin: { id: null, token: null }, acheteur: { id: null, token: null }, producteur: { id: null, token: null } };

const registerUser = async (email) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'M7',
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

  const acheteurData = await registerUser(ACHETEUR_EMAIL);
  comptes.acheteur.id = acheteurData.user.id;
  await seedRoles(comptes.acheteur.id, ['BUYER']);
  comptes.acheteur.token = (await h.request('POST', '/auth/login', {
    body: { identifier: ACHETEUR_EMAIL, password: PASSWORD },
  })).body.data.session.accessToken;

  const prodData = await registerUser(PRODUCTEUR_EMAIL);
  comptes.producteur.id = prodData.user.id;
  comptes.producteur.token = prodData.session.accessToken;
});

after(async () => {
  await h?.stop();
});

test('AC-M7 — annonce ciblée par rôle : reçue par l acheteur, pas par le producteur', async () => {
  const diffusion = await h.request('POST', '/admin/notifications/broadcast', {
    token: comptes.admin.token,
    body: {
      title: 'Nouvelle grille de qualité des céréales',
      body: 'La grille de qualité des céréales est mise à jour pour tous les acheteurs.',
      role: 'BUYER',
      channels: ['IN_APP'],
    },
  });
  assert.equal(diffusion.status, 200, `diffusion : ${JSON.stringify(diffusion.body)}`);
  assert.equal(diffusion.body.data.targeted, 1, 'un seul acheteur ciblé');
  assert.equal(diffusion.body.data.delivered, 1);

  // Compte de test concerné : la boîte de l acheteur contient l annonce.
  const boiteAcheteur = await h.request('GET', '/notifications?limit=50', { token: comptes.acheteur.token });
  assert.equal(boiteAcheteur.status, 200);
  const recues = boiteAcheteur.body.data.items ?? [];
  const annonce = recues.find((n) => n.type === 'admin.announcement');
  assert.ok(annonce, `annonce reçue : ${JSON.stringify(recues.map((n) => n.type))}`);
  assert.equal(annonce.title, 'Nouvelle grille de qualité des céréales');

  // Hors cible : la boîte du producteur reste vide de cette annonce.
  const boiteProducteur = await h.request('GET', '/notifications?limit=50', { token: comptes.producteur.token });
  const horsCible = (boiteProducteur.body.data.items ?? []).find((n) => n.type === 'admin.announcement');
  assert.equal(horsCible, undefined, 'le compte non ciblé ne reçoit rien');
});

test('AC-M7 — ciblage combiné rôle + pays, historique et taux de délivrance', async () => {
  const diffusion = await h.request('POST', '/admin/notifications/broadcast', {
    token: comptes.admin.token,
    body: {
      title: 'Information acheteurs en République démocratique du Congo',
      body: 'Message réservé aux acheteurs établis en République démocratique du Congo.',
      role: 'BUYER',
      country: 'CD',
      channels: ['IN_APP'],
    },
  });
  assert.equal(diffusion.status, 200, `diffusion : ${JSON.stringify(diffusion.body)}`);
  assert.equal(diffusion.body.data.targeted, 1, 'intersection rôle ∩ pays');
  assert.equal(diffusion.body.data.country, 'CD');

  const historique = await h.request('GET', '/admin/notifications/history?limit=10', { token: comptes.admin.token });
  assert.equal(historique.status, 200, `historique : ${JSON.stringify(historique.body)}`);
  const { annonces, sms } = historique.body.data;
  assert.ok(annonces.length >= 2, 'les deux diffusions figurent à l historique');
  assert.equal(annonces[0].title, 'Information acheteurs en République démocratique du Congo');
  assert.ok(sms, 'bloc SMS présent');
  assert.ok(typeof sms.messages.deliveryRate === 'number' || sms.messages.deliveryRate === null, 'taux de délivrance explicite');
  assert.ok(Array.isArray(sms.batches), 'lots `sms_batch_logs` exposés');
});

test('négatifs — annonce sans cible refusée', async () => {
  const sansCible = await h.request('POST', '/admin/notifications/broadcast', {
    token: comptes.admin.token,
    body: { title: 'Annonce générale', body: 'Message sans aucune cible déclarée.' },
  });
  assert.ok(sansCible.status === 400 || sansCible.status === 422, `statut obtenu : ${sansCible.status}`);

  // Droits : un utilisateur sans rôle administrateur ne diffuse pas.
  const sansDroit = await h.request('POST', '/admin/notifications/broadcast', {
    token: comptes.producteur.token,
    body: { title: 'Tentative', body: 'Diffusion non autorisée depuis un compte producteur.', role: 'BUYER' },
  });
  assert.equal(sansDroit.status, 403, `compte non admin → 403 (${sansDroit.status})`);
});
