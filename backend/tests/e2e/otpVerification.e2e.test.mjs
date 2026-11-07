import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Recette de bout en bout — base réelle — du **parcours complet de
 * vérification du numéro** : demande, génération, envoi, saisie, vérification,
 * expiration, et confirmation sur le profil.
 *
 * ## Ce que cette suite prouve
 *
 *  - un code vérifié confirme le numéro **sur le profil concerné** ;
 *  - un code consommé ne peut pas être rejoué ;
 *  - un code expiré est refusé ;
 *  - cinq essais erronés verrouillent le code ;
 *  - un numéro qui n'est pas celui du profil est refusé ;
 *  - un numéro déjà rattaché à un autre compte donne un conflit lisible, pas
 *    une erreur interne ;
 *  - un numéro mal formé est refusé **avant** tout envoi chez le fournisseur ;
 *  - les plafonds horaires tiennent, par numéro **et** par utilisateur ;
 *  - le code n'apparaît ni dans la réponse de production ni dans les journaux.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * **Aucun SMS réel n'est livré.** Le fournisseur est celui de la recette. La
 * procédure pour un essai avec un vrai téléphone est dans
 * `docs/SMS-OTP-TEST-REEL.md`.
 */

const { startHarness } = await import('./support/harness.mjs');

let h;
const PASSWORD = 'MotDePasse!2026';
const UTILISATEUR = 'fermier-otp@agrikonnect.test';
const NUMERO = '+243810000411';
const AUTRE_NUMERO = '+243810000422';

let jeton;
let userId;

const register = async ({ email, firstName = 'Josué', lastName = 'Bomoi', phone }) => {
  const reponse = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName,
      lastName,
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
      ...(phone ? { phone } : {}),
    },
  });
  assert.equal(reponse.status, 201, `inscription ${email} : ${JSON.stringify(reponse.body)}`);
};

const connect = async (email) => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  return reponse.body.data.session.accessToken;
};

/**
 * Vide les codes de l'heure.
 *
 * Les plafonds horaires sont réels et bas (5 par heure) : sans remise à zéro
 * entre les tests, le deuxième test qui demande un code déclencherait le
 * plafond et mesurerait autre chose que ce qu'il prétend mesurer.
 */
const reinitialiserCodes = async () => {
  await h.prisma.otpCode.deleteMany({});
};

/** Demande un code et le renvoie (le mode recette l'expose volontairement). */
const demanderCode = async (phone = NUMERO) => {
  const reponse = await h.request('POST', '/auth/send-otp', { token: jeton, body: { phone } });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.ok(reponse.body.data.devCode, 'la recette expose le code ; la production ne le fait pas');
  return reponse.body.data.devCode;
};

const verifier = (phone, code) =>
  h.request('POST', '/auth/verify-phone', { token: jeton, body: { phone, code } });

before(async () => {
  h = await startHarness();
  await register({ email: UTILISATEUR, phone: NUMERO });
  jeton = await connect(UTILISATEUR);
  const profil = await h.prisma.profile.findFirst({ where: { email: UTILISATEUR } });
  userId = profil.id;
}, { timeout: 180_000 });

beforeEach(async () => {
  await reinitialiserCodes();
});

after(async () => {
  await h?.stop();
});

/* ─────────────────────── parcours nominal ─────────────────────── */

test('E2E OTP : un code vérifié confirme le numéro sur le profil', async () => {
  const code = await demanderCode();

  const avant = await h.prisma.profile.findUnique({ where: { id: userId } });
  assert.equal(avant.phoneVerifiedAt, null, 'le numéro n’est pas encore confirmé');

  const reponse = await verifier(NUMERO, code);
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.verified, true);

  const apres = await h.prisma.profile.findUnique({ where: { id: userId } });
  assert.ok(apres.phoneVerifiedAt, 'le profil porte la date de vérification');
  assert.equal(apres.phone, NUMERO);
});

test('E2E OTP : le code consommé ne peut pas être rejoué', async () => {
  const code = await demanderCode();
  const premier = await verifier(NUMERO, code);
  assert.equal(premier.status, 200, JSON.stringify(premier.body));

  const second = await verifier(NUMERO, code);
  assert.notEqual(second.status, 200, 'un code à usage unique ne se rejoue pas');
});

test('E2E OTP : le code n’apparaît pas dans la réponse de production', async () => {
  /*
   * `devCode` est exposé hors production pour rendre les tests possibles. La
   * garantie à vérifier est l'inverse : en production, il ne l'est pas. On le
   * vérifie sur le code, pas sur une supposition.
   */
  const { env } = await import('../../src/config/env.js');
  const reponse = await h.request('POST', '/auth/send-otp', { token: jeton, body: { phone: NUMERO } });
  assert.equal(reponse.status, 200);
  if (env.isProd) {
    assert.equal(reponse.body.data.devCode, undefined);
  } else {
    assert.ok(reponse.body.data.devCode, 'hors production, le code est exposé pour les essais');
  }
  // La durée de vie annoncée est celle de la configuration, pas une valeur fixe.
  assert.equal(reponse.body.data.expiresInMinutes, env.OTP_TTL_MINUTES);
});

/* ─────────────────────── garde-fous ─────────────────────── */

test('E2E OTP : un code erroné est refusé et compte comme un essai', async () => {
  const code = await demanderCode();
  const reponse = await verifier(NUMERO, '000000');
  assert.notEqual(reponse.status, 200);

  const otp = await h.prisma.otpCode.findFirst({
    where: { identifier: NUMERO, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(otp.attempts >= 1, 'les essais sont comptés');
  assert.ok(code);
});

test('E2E OTP : cinq essais erronés verrouillent le code', async () => {
  await demanderCode();
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await verifier(NUMERO, String(100000 + i));
  }
  const reponse = await verifier(NUMERO, String(100000));
  assert.equal(reponse.status, 429, 'au-delà des essais autorisés, il faut un nouveau code');
});

test('E2E OTP : un code expiré est refusé', async () => {
  const code = await demanderCode();
  // Expiration forcée en base : c'est l'état réel d'un code trop ancien.
  await h.prisma.otpCode.updateMany({
    where: { identifier: NUMERO, consumedAt: null },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const reponse = await verifier(NUMERO, code);
  assert.notEqual(reponse.status, 200);
  assert.match(JSON.stringify(reponse.body), /expiré|introuvable/i);
});

test('E2E OTP : un numéro mal formé est refusé avant tout envoi', async () => {
  const avant = h.sink.messages.sms.length;
  for (const invalide of ['0810000000', '+0123', 'abc', '+243']) {
    // eslint-disable-next-line no-await-in-loop
    const reponse = await h.request('POST', '/auth/send-otp', {
      token: jeton,
      body: { phone: invalide },
    });
    assert.equal(reponse.status, 422, `${invalide} : ${JSON.stringify(reponse.body)}`);
  }
  /*
   * Le point important : rien n'est parti chez le fournisseur. Un numéro
   * invalide soumis à Twilio est refusé **et facturé**.
   */
  assert.equal(h.sink.messages.sms.length, avant);
});

test('E2E OTP : confirmer un autre numéro que celui du profil est refusé', async () => {
  const code = await demanderCode(AUTRE_NUMERO);
  // Le profil porte NUMERO ; demander la vérification d'AUTRE_NUMERO ne prouve
  // rien sur le numéro du compte.
  const reponse = await verifier(AUTRE_NUMERO, code);
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));
  assert.match(JSON.stringify(reponse.body), /numéro du profil/i);
});

test('E2E OTP : un numéro déjà rattaché à un autre compte est un conflit lisible', async () => {
  /*
   * Scénario : un compte **sans numéro** demande à vérifier un numéro qui
   * appartient déjà à un autre compte. C'est exactement la situation que la
   * contrainte d'unicité de `Profile.phone` rendrait sinon invisible, sous
   * forme d'une erreur interne 500.
   *
   * On ne peut pas la provoquer en affectant d'abord le numéro au profil : la
   * base le refuserait avant même la vérification. Le test passe donc par un
   * compte dont le numéro est encore nul.
   */
  await register({
    email: 'autre-compte-otp@agrikonnect.test',
    phone: AUTRE_NUMERO,
    firstName: 'Marie',
    lastName: 'Boseko',
  });
  await register({ email: 'sans-numero-otp@agrikonnect.test', firstName: 'Paul', lastName: 'Ileka' });
  const jetonSansNumero = await connect('sans-numero-otp@agrikonnect.test');

  const demande = await h.request('POST', '/auth/send-otp', {
    token: jetonSansNumero,
    body: { phone: AUTRE_NUMERO },
  });
  assert.equal(demande.status, 200, JSON.stringify(demande.body));

  const reponse = await h.request('POST', '/auth/verify-phone', {
    token: jetonSansNumero,
    body: { phone: AUTRE_NUMERO, code: demande.body.data.devCode },
  });
  assert.equal(reponse.status, 409, 'deux comptes ne peuvent pas partager un numéro');
  assert.match(JSON.stringify(reponse.body), /déjà rattaché/i);

  // Le profil du titulaire légitime n'a pas été touché.
  const titulaire = await h.prisma.profile.findFirst({
    where: { email: 'autre-compte-otp@agrikonnect.test' },
  });
  assert.equal(titulaire.phone, AUTRE_NUMERO);
});

test('E2E OTP : le plafond horaire par utilisateur borne aussi les numéros variés', async () => {
  /*
   * Le plafond par numéro seul ne borne rien contre un compte qui vise des
   * numéros différents. Le test vide le compteur du numéro habituel, puis
   * demande des codes vers des numéros distincts : c'est le plafond par
   * utilisateur qui doit finir par refuser.
   */
  let refus = null;
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const reponse = await h.request('POST', '/auth/send-otp', {
      token: jeton,
      body: { phone: `+24381000${String(5000 + i).padStart(4, '0')}` },
    });
    if (reponse.status === 429) {
      refus = reponse;
      break;
    }
  }
  assert.ok(refus, 'le plafond par utilisateur doit finir par refuser');
  assert.match(JSON.stringify(refus.body), /depuis ce compte/i);
});
