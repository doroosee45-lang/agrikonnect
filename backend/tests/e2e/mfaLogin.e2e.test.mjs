/**
 * Recette de bout en bout — connexion avec double authentification.
 *
 * ## Le verrouillage couvert
 *
 * Quand la MFA est active, `login` refuse le mot de passe seul et renvoie 401
 * en signalant « code requis ». Le client doit alors afficher un champ, et
 * **rejouer** la connexion avec le code.
 *
 * Les deux clients implémentent bien cette reprise (`pendingMfa` dans le store,
 * `RequestError.mfaRequired` dérivé de `details`). Mais le signal **n'arrivait
 * jamais** : `ApiError.unauthorized(message)` n'accepte qu'un paramètre, et
 * l'appel `ApiError.unauthorized('…', { mfaRequired: true })` voyait son second
 * argument **silencieusement ignoré**. `details` restait vide, donc
 * `mfaRequired` valait `false`, donc `pendingMfa` n'était jamais posé, donc le
 * champ MFA n'apparaissait jamais.
 *
 * Résultat : **un compte ayant activé la MFA ne pouvait plus se connecter
 * depuis le web ni depuis le mobile.** Ce test échouait avant correction.
 *
 * ## Ce que cette recette ne prouve pas
 *
 * Aucun écran n'est piloté : la reprise côté client est vérifiée par compilation
 * et par lecture, pas par un navigateur.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

/*
 * `currentCode` est importé **en différé**, dans `before()`.
 *
 * Un import statique évaluerait `config/env.js` et le client Supabase au
 * chargement du fichier, donc **avant** que le harnais pose `SUPABASE_URL` sur
 * le faux GoTrue. Les appels d'authentification partiraient alors vers une
 * autre adresse et échoueraient en « fetch failed ». C'est exactement pourquoi
 * le harnais importe l'application paresseusement.
 *
 * Réutiliser `currentCode` plutôt que de réimplémenter le TOTP ici : un test
 * qui recalcule le code à sa façon prouverait sa propre implémentation, pas
 * celle du serveur.
 */
let currentCode;

const PASSWORD = 'MotDePasse!2026';
const EMAIL = 'mfa-connexion@agrikonnect.test';

let h;
let secret;

before(async () => {
  h = await startHarness();
  ({ currentCode } = await import('../../src/modules/auth/mfa.service.js'));

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
  const token = inscrit.body.data.session.accessToken;

  // Enrôlement MFA complet : setup puis confirm avec un code TOTP valide.
  const setup = await h.request('POST', '/auth/mfa/setup', { token, body: {} });
  assert.equal(setup.status, 200, `setup : ${JSON.stringify(setup.body)}`);
  secret = setup.body.data.secret;
  assert.ok(secret, 'le secret est nécessaire au test pour produire un code valide');

  const confirme = await h.request('POST', '/auth/mfa/confirm', {
    token,
    body: { code: currentCode(secret) },
  });
  assert.equal(confirme.status, 200, `confirm : ${JSON.stringify(confirme.body)}`);
  assert.equal(confirme.body.data.mfaEnabled, true);
});

after(async () => {
  await h?.stop?.();
});

/* ═══════════════ le signal « code requis » ═══════════════ */

test('connexion — sans code, 401 et `details.mfaRequired` à true', async () => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: EMAIL, password: PASSWORD },
  });

  assert.equal(reponse.status, 401, JSON.stringify(reponse.body));
  assert.match(reponse.body.message, /double authentification/i);

  /*
   * LE point critique. Sans ce champ, `RequestError.mfaRequired` vaut false,
   * `pendingMfa` n'est jamais posé, et le champ MFA n'apparaît pas : le compte
   * est verrouillé hors de l'application.
   */
  assert.ok(reponse.body.details, 'le corps doit porter `details`');
  assert.equal(
    reponse.body.details.mfaRequired,
    true,
    `details.mfaRequired doit être true, reçu ${JSON.stringify(reponse.body.details)}`,
  );
  assert.equal(reponse.body.details.method, 'TOTP', 'la méthode doit être indiquée');

  // Aucune session ne doit être délivrée.
  assert.ok(!reponse.body.data?.session, 'aucune session sans second facteur');
});

/**
 * Sans cette contre-épreuve, le test précédent pourrait passer parce que la
 * route refuserait toute connexion. Ici les mêmes identifiants **avec** un code
 * valide aboutissent : c'est bien l'absence de code qui produisait le 401.
 */
test('connexion — avec un code valide, la session est délivrée', async () => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: EMAIL, password: PASSWORD, mfaCode: currentCode(secret) },
  });

  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.ok(reponse.body.data.session.accessToken, 'un jeton doit être délivré');
});

test('connexion — un code faux est refusé, sans session', async () => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: EMAIL, password: PASSWORD, mfaCode: '000000' },
  });
  assert.equal(reponse.status, 401, JSON.stringify(reponse.body));
  assert.ok(!reponse.body.data?.session);
});

test('connexion — un mauvais mot de passe ne révèle pas que la MFA est active', async () => {
  /*
   * Anti-énumération : dire « code MFA requis » à quelqu'un qui n'a pas le bon
   * mot de passe révélerait que le compte existe **et** que la MFA y est active.
   */
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: EMAIL, password: 'MauvaisMotDePasse!1' },
  });
  assert.equal(reponse.status, 401);
  assert.ok(
    !reponse.body.details?.mfaRequired,
    'un mot de passe faux ne doit pas révéler l’état MFA du compte',
  );
});

/* ═══════════════ codes de secours ═══════════════ */

test('codes de secours — renvoyés une seule fois, à l’activation', async () => {
  /*
   * Vérifié sur un second compte : les codes ne sont produits qu'à
   * l'activation, et l'écran doit les montrer **une seule fois**.
   */
  const second = 'mfa-secours@agrikonnect.test';
  const inscrit = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Alice',
      lastName: 'Muteba',
      email: second,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  const token = inscrit.body.data.session.accessToken;

  const setup = await h.request('POST', '/auth/mfa/setup', { token, body: {} });
  const confirme = await h.request('POST', '/auth/mfa/confirm', {
    token,
    body: { code: currentCode(setup.body.data.secret) },
  });
  assert.equal(confirme.status, 200, JSON.stringify(confirme.body));

  const { backupCodes, warning } = confirme.body.data;
  assert.ok(Array.isArray(backupCodes), 'des codes de secours doivent être renvoyés');
  assert.ok(backupCodes.length > 0, 'au moins un code');
  assert.match(warning, /plus jamais affichés/, 'l’avertissement doit être porté par l’API');

  // Chaque code est distinct.
  assert.equal(new Set(backupCodes).size, backupCodes.length, 'les codes doivent être distincts');

  // Et ils ne sont **pas** renvoyés une seconde fois.
  const statut = await h.request('GET', '/auth/mfa/status', { token });
  assert.equal(statut.status, 200);
  assert.ok(
    !JSON.stringify(statut.body).includes(backupCodes[0]),
    'les codes ne doivent plus être exposés après l’activation',
  );
});

test('codes de secours — un code de secours ouvre une session', async () => {
  const second = 'mfa-secours-2@agrikonnect.test';
  const inscrit = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Paul',
      lastName: 'Ekila',
      email: second,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
    },
  });
  const token = inscrit.body.data.session.accessToken;

  const setup = await h.request('POST', '/auth/mfa/setup', { token, body: {} });
  const confirme = await h.request('POST', '/auth/mfa/confirm', {
    token,
    body: { code: currentCode(setup.body.data.secret) },
  });
  const [premierCode] = confirme.body.data.backupCodes;

  const connexion = await h.request('POST', '/auth/login', {
    body: { identifier: second, password: PASSWORD, mfaCode: premierCode },
  });
  assert.equal(connexion.status, 200, JSON.stringify(connexion.body));
  assert.ok(connexion.body.data.session.accessToken);
});
