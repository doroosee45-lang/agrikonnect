/**
 * Vérification de l'adresse e-mail (AUTH-03), de bout en bout.
 *
 * ## Ce que cette recette prouve
 *
 * 1. l'URL que l'API demande à GoTrue de mettre dans l'e-mail correspond à une
 *    **route réelle** du client web ;
 * 2. `POST /auth/verify-email` accepte ce jeton et pose `emailVerifiedAt` ;
 * 3. le jeton est à **usage unique** ;
 * 4. un jeton invalide est refusé sans révéler l'état du compte.
 *
 * ## Ce qu'elle ne prouve pas
 *
 * Le **corps de l'e-mail** est produit par le mailer de GoTrue, qui n'est pas
 * dans ce dépôt. Ce test vérifie l'`email_redirect_to` que notre code transmet,
 * pas la chaîne exacte qui arrivera dans la boîte de réception — GoTrue y
 * ajoute son propre `token_hash` selon sa configuration (`SITE_URL`,
 * `GOTRUE_MAILER_URLPATHS_CONFIRMATION`), absente de `.env.example` et de
 * `docs/DEPLOYMENT.md`.
 *
 * Le rendu de la page web n'est pas prouvé non plus : les écrans restent
 * vérifiés par compilation uniquement.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startHarness } from './support/harness.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const PASSWORD = 'MotDePasse!2026';
const EMAIL = 'verification-email@agrikonnect.test';
const INCONNUE = 'jamais-inscrite@agrikonnect.test';

let h;

before(async () => {
  h = await startHarness();

  const inscrit = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Josué',
      lastName: 'Bomoi',
      email: EMAIL,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  assert.equal(inscrit.status, 201, JSON.stringify(inscrit.body));
});

after(async () => {
  await h.stop();
});

/* ─────────────────────── 1. l'URL envoyée ─────────────────────── */

test('e-mail — l’URL de redirection transmise à GoTrue atteint une route web réelle', async () => {
  const renvoi = await h.request('POST', '/auth/resend-verification', { body: { email: EMAIL } });
  assert.equal(renvoi.status, 200, JSON.stringify(renvoi.body));
  assert.equal(renvoi.body.data.sent, true);

  const url = h.stubEmailRedirectTo();
  assert.ok(url, 'aucun `email_redirect_to` — corps reçu par le stub : '
    + JSON.stringify(h.gotrue.lastResendBody()));

  // Le chemin, sans l'origine.
  const chemin = new URL(url).pathname;

  /*
   * C'est le cœur du point 3 : avant la correction, l'API construisait
   * `${PUBLIC_WEB_URL}/verify-email`. Le routeur web déclare
   * `/auth/verify-email` et se termine par `path="*"` → `AppNotFound`. Le lien
   * partait donc, s'ouvrait, et tombait sur « page introuvable » — sans aucune
   * erreur nulle part, et le jeton n'avait plus où être saisi.
   */
  const routeur = await fs.readFile(path.join(RACINE, 'apps/web/src/App.tsx'), 'utf8');
  const routes = [...routeur.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(
    routes.includes(chemin),
    `« ${chemin} » n'est pas une route du client web — le lien tomberait sur AppNotFound`,
  );
});

test('e-mail — l’URL ne porte pas de double barre oblique', async () => {
  const url = h.stubEmailRedirectTo();
  const apresOrigine = url.replace(/^https?:\/\/[^/]+/, '');
  assert.ok(
    !apresOrigine.startsWith('//'),
    `séparateur doublé : « ${url} » — certains clients de messagerie coupent ces URL`,
  );
});

/* ─────────────────────── 2. la vérification ─────────────────────── */

test('vérification — le jeton de l’e-mail est accepté et pose `emailVerifiedAt`', async () => {
  const jeton = await h.stubEmailToken(EMAIL);
  assert.ok(jeton, 'le stub n’a émis aucun jeton de vérification');

  const avant = await h.prisma.profile.findFirst({ where: { email: EMAIL }, select: { emailVerifiedAt: true } });
  assert.equal(avant.emailVerifiedAt, null, 'l’adresse ne doit pas être déjà vérifiée');

  const reponse = await h.request('POST', '/auth/verify-email', { body: { tokenHash: jeton } });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.verified, true);

  const apres = await h.prisma.profile.findFirst({ where: { email: EMAIL }, select: { emailVerifiedAt: true } });
  assert.ok(apres.emailVerifiedAt instanceof Date, 'emailVerifiedAt doit être posé');
});

test('vérification — le jeton est à usage unique', async () => {
  const jeton = await h.stubEmailToken(EMAIL);
  const rejeu = await h.request('POST', '/auth/verify-email', { body: { tokenHash: jeton } });

  // Le stub supprime le jeton après usage, comme le fait GoTrue.
  assert.equal(rejeu.status, 422, JSON.stringify(rejeu.body));
  assert.equal(rejeu.body.code, 'VALIDATION_ERROR');
});

test('vérification — un jeton inventé est refusé sans révéler l’état du compte', async () => {
  const reponse = await h.request('POST', '/auth/verify-email', { body: { tokenHash: 'eml_invente' } });
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));

  /*
   * Même statut et même message que pour un jeton expiré : la réponse ne doit
   * pas permettre de distinguer « jeton faux » de « compte inexistant ».
   */
  assert.match(reponse.body.message, /invalide ou expiré/);
});

/* ─────────────────────── 3. anti-énumération ─────────────────────── */

test('renvoi — une adresse inconnue renvoie la même réponse, sans jeton', async () => {
  const connue = await h.request('POST', '/auth/resend-verification', { body: { email: EMAIL } });
  const inconnue = await h.request('POST', '/auth/resend-verification', { body: { email: INCONNUE } });

  assert.equal(inconnue.status, 200, JSON.stringify(inconnue.body));
  // Corps strictement identique : rien ne trahit l'existence du compte.
  assert.deepEqual(inconnue.body.data, connue.body.data);
  assert.equal(inconnue.body.message ?? null, connue.body.message ?? null);

  assert.equal(
    await h.stubEmailToken(INCONNUE),
    null,
    'aucun jeton ne doit être émis pour une adresse inconnue',
  );
});

test("renvoi sans adresse — refus explicite (422) qui nomme le champ", async () => {
  const sansEmail = await h.request('POST', '/auth/resend-verification', { body: {} });

  assert.equal(sansEmail.status, 422, JSON.stringify(sansEmail.body));
  assert.equal(sansEmail.body.code, 'VALIDATION_ERROR');
  assert.ok(
    JSON.stringify(sansEmail.body).includes('email'),
    'la réponse nomme le champ email : ' + JSON.stringify(sansEmail.body),
  );
});
