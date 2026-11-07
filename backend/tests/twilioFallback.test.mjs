import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

/**
 * Repli sur un numéro expéditeur — `TWILIO_FALLBACK_FROM`.
 *
 * ## Ce que cette suite prouve
 *
 * Quand l'identifiant alphanumérique est refusé (codes 30018 / 30040) :
 *
 *  - **sans** `TWILIO_FALLBACK_FROM`, l'envoi échoue et la raison est
 *    journalisée. Aucune bascule silencieuse.
 *  - **avec** `TWILIO_FALLBACK_FROM`, un second envoi part depuis ce numéro.
 *
 * Le cas « sans » est déjà couvert par `tests/e2e/twilioErrors.e2e.test.mjs`.
 * Cette suite couvre le cas « avec », qui exige que la variable soit présente au
 * démarrage : `config/env.js` est figé à l'import, on ne peut donc pas la poser
 * en cours de route. D'où une suite dédiée.
 *
 * Aucune base n'est nécessaire : seul le fournisseur est en jeu.
 *
 * ## Pourquoi le repli n'est pas le comportement par défaut
 *
 * L'agriculteur reconnaît l'expéditeur de ses alertes. En RDC, les identifiants
 * **numériques ne sont pas remis par Airtel** : un repli non demandé ferait
 * arriver le message chez certains opérateurs et pas chez d'autres, sans aucun
 * signe visible côté application.
 */

const AUTH_TOKEN = 'faux_jeton_auth_twilio_pas_un_secret';
const ACCOUNT_SID = 'ACfauxcomptedetest0001';
const NUMERO_REPLI = '+243810000777';

let fake;
let expediteurs = [];

/** Comportement courant du faux fournisseur. */
let comportement = { status: 400, body: { code: 30040, message: 'Sender ID not supported', status: 400 } };
/** Le numéro de repli est-il accepté ? Faux pour tester l'échec des deux envois. */
let repliAccepte = true;

before(async () => {
  fake = await new Promise((resolve) => {
    const serveur = createServer((req, res) => {
      let brut = '';
      req.on('data', (c) => {
        brut += c;
      });
      req.on('end', () => {
        expediteurs.push(Object.fromEntries(new URLSearchParams(brut)).From ?? null);

        /*
         * Le premier envoi (alphanumérique) est refusé ; le second (numéro de
         * repli) est accepté. C'est exactement la situation que la variable est
         * censée débloquer.
         */
        const from = Object.fromEntries(new URLSearchParams(brut)).From;
        res.setHeader('content-type', 'application/json');
        if (from === NUMERO_REPLI && repliAccepte) {
          res.statusCode = 201;
          res.end(JSON.stringify({ sid: 'SMrepli00000000000000000000000001', status: 'queued' }));
          return;
        }
        res.statusCode = comportement.status;
        res.end(JSON.stringify(comportement.body));
      });
    });
    serveur.listen(0, '127.0.0.1', () => resolve(serveur));
  });

  const { port } = fake.address();

  /*
   * Posé **avant** l'import de `sms.js` : `config/env.js` est évalué à l'import
   * et fige ses valeurs. C'est précisément pourquoi une suite séparée est
   * nécessaire — la variable ne peut pas être changée en cours de route.
   */
  process.env.SMS_PROVIDER = 'twilio';
  process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  process.env.TWILIO_SENDER_ID = 'AGRIKONNECT';
  process.env.TWILIO_FALLBACK_FROM = NUMERO_REPLI;
  process.env.TWILIO_API_BASE_URL = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => fake?.close(resolve));
});

test('Repli : TWILIO_FALLBACK_FROM est bien lu au démarrage', async () => {
  const { env } = await import('../src/config/env.js');
  assert.equal(env.TWILIO_FALLBACK_FROM, NUMERO_REPLI);
  assert.equal(env.TWILIO_SENDER_ID, 'AGRIKONNECT');
});

test('Repli : un refus de l’alphanumérique repart depuis le numéro configuré', async () => {
  const { sendSms } = await import('../src/integrations/sms.js');
  comportement = { status: 400, body: { code: 30040, message: 'Sender ID not supported', status: 400 } };
  expediteurs = [];

  const resultat = await sendSms('+243810000111', 'AGRIKONNECT : alerte de test.');

  /*
   * Deux envois : le premier depuis l'alphanumérique (refusé), le second depuis
   * le numéro de repli (accepté). L'ordre compte — c'est lui qui prouve que le
   * repli est une seconde tentative et non un remplacement.
   */
  assert.deepEqual(expediteurs, ['AGRIKONNECT', NUMERO_REPLI]);
  assert.equal(resultat.error, undefined, `l'envoi de repli a échoué : ${JSON.stringify(resultat)}`);
  assert.equal(resultat.provider, 'twilio');
  assert.equal(resultat.providerMessageId, 'SMrepli00000000000000000000000001',
    "l'identifiant renvoyé doit être celui du second envoi");
  /*
   * `delivered` reste `false` : Twilio répond `queued`, c'est une acceptation et
   * non une remise. L'affirmer ici serait mentir sur ce que l'on sait.
   */
  assert.equal(resultat.delivered, false);
  assert.equal(resultat.status, 'queued');
});

test('Repli : un code de destinataire ne déclenche pas le repli', async () => {
  /*
   * Contre-épreuve. Un 21211 (numéro invalide) ne sera pas réparé par un autre
   * expéditeur : replier coûterait un envoi pour rien et changerait l'identité
   * de l'expéditeur sans raison.
   */
  const { sendSms } = await import('../src/integrations/sms.js');
  comportement = { status: 400, body: { code: 21211, message: 'Invalid To', status: 400 } };
  expediteurs = [];

  await sendSms('+243810000222', 'AGRIKONNECT : alerte de test.');

  assert.deepEqual(expediteurs, ['AGRIKONNECT'],
    'un 21211 ne doit pas déclencher de repli sur le numéro');
});

test('Repli : si le numéro de repli échoue aussi, l’échec final est celui du repli', async () => {
  /*
   * Le repli n'est pas une garantie. Quand les deux envois échouent, c'est le
   * motif du second qui est conservé : c'est le dernier état connu, et celui que
   * l'exploitant doit lire.
   */
  const { sendSms } = await import('../src/integrations/sms.js');
  comportement = { status: 400, body: { code: 30040, message: 'Sender ID not supported', status: 400 } };
  repliAccepte = false;
  expediteurs = [];

  const resultat = await sendSms('+243810000333', 'AGRIKONNECT : alerte de test.');
  repliAccepte = true;

  assert.deepEqual(expediteurs, ['AGRIKONNECT', NUMERO_REPLI],
    'les deux envois doivent avoir été tentés');
  assert.equal(resultat.delivered, false);
  assert.ok(resultat.error, 'un échec doit porter un motif');
  assert.match(resultat.error, /\[30040\]/, `motif : ${resultat.error}`);
  assert.equal(resultat.code, '30040');
});

test('Repli : aucun secret n’apparaît dans le résultat', async () => {
  const { sendSms } = await import('../src/integrations/sms.js');
  comportement = { status: 401, body: { code: 20003, message: 'Authenticate', status: 401 } };
  expediteurs = [];

  const resultat = await sendSms('+243810000444', 'AGRIKONNECT : alerte de test.');
  const tout = JSON.stringify(resultat);

  assert.equal(tout.includes(AUTH_TOKEN), false, 'le jeton Twilio apparaît dans le résultat');
  assert.equal(tout.includes(ACCOUNT_SID), false, 'le SID complet apparaît dans le résultat');
});
