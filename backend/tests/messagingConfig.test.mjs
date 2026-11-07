import test from 'node:test';
import assert from 'node:assert/strict';

import {
  verifierConfigSms,
  verifierConfigEmail,
  verifierConfigMessagerie,
} from '../src/config/messagingConfig.js';
import {
  validateSenderId,
  validateExpediteur,
  isPlausibleAccountSid,
  isLocalUrl,
} from '../src/shared/senderId.js';

/**
 * Unité pure — validation de la configuration de messagerie.
 *
 * Aucune base, aucun réseau : ces fonctions ne lisent que l'objet qu'on leur
 * donne. C'est volontaire, pour qu'une faute de configuration soit détectable
 * sans démarrer le serveur.
 */

const SID_VALIDE = 'AC00000000000000000000000000000000';
const TWILIO_OK = {
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: SID_VALIDE,
  TWILIO_AUTH_TOKEN: 'un-jeton',
  TWILIO_SENDER_ID: 'AGRIKONNECT',
};

/* ──────────────────── shared/senderId ──────────────────── */

test('senderId : un identifiant conforme est accepté', () => {
  assert.deepEqual(validateSenderId('AGRIKONNECT'), { valid: true, reasons: [] });
  assert.equal(validateSenderId('AGRI 2026').valid, true);
  assert.equal(validateSenderId('a').valid, true, 'une seule lettre suffit');
});

test('senderId : plus de 11 caractères est refusé', () => {
  const r = validateSenderId('AGRIKONNECTAFRIQUE');
  assert.equal(r.valid, false);
  assert.match(r.reasons.join(' '), /11 au plus/);
});

test('senderId : uniquement numérique est refusé', () => {
  const r = validateSenderId('12345');
  assert.equal(r.valid, false);
  assert.match(r.reasons.join(' '), /uniquement numérique/);
});

test('senderId : un identifiant générique est signalé', () => {
  assert.match(validateSenderId('InfoSMS').reasons.join(' '), /générique/);
  assert.match(validateSenderId('VERIFY').reasons.join(' '), /générique/);
  assert.equal(validateSenderId('AGRIKONNECT').reasons.length, 0);
});

test('senderId : vide est refusé', () => {
  assert.match(validateSenderId('').reasons.join(' '), /absent/);
  assert.match(validateSenderId(undefined).reasons.join(' '), /absent/);
});

test('senderId : caractère non autorisé est refusé', () => {
  assert.match(validateSenderId('AGRI@KONN').reasons.join(' '), /caractères non autorisés/);
  assert.equal(validateSenderId('AGRI-KONN_1').valid, true, '- et _ sont autorisés');
});

test('expéditeur : un identifiant alphanumérique est accepté comme tel', () => {
  const r = validateExpediteur('AGRIKONNECT');
  assert.equal(r.valid, true);
  assert.equal(r.type, 'ALPHANUMERIQUE');
});

test('expéditeur : un numéro E.164 est accepté comme numéro, pas comme identifiant', () => {
  /*
   * C'est la correction qui rend `TWILIO_FALLBACK_FROM` utilisable : le champ
   * `From` de Twilio accepte les deux formes, et un numéro est par définition
   * purement numérique — donc `validateSenderId` le refusait systématiquement.
   */
  const r = validateExpediteur('+243810000777');
  assert.equal(r.valid, true);
  assert.equal(r.type, 'NUMERO');
  assert.deepEqual(r.reasons, []);
});

test('expéditeur : des chiffres sans « + » restent un identifiant, et sont refusés', () => {
  /*
   * La distinction porte sur le `+`, pas sur les chiffres : `12345` n'est ni un
   * E.164 ni un identifiant valable, et en RDC un identifiant numérique n'est pas
   * remis par Airtel.
   */
  const r = validateExpediteur('12345');
  assert.equal(r.valid, false);
  assert.equal(r.type, 'ALPHANUMERIQUE');
  assert.match(r.reasons.join(' '), /uniquement numérique/);
});

test('expéditeur : un « + » suivi d’un numéro malformé est refusé comme numéro', () => {
  for (const mauvais of ['+243', '+0123456', '+243abc000000']) {
    const r = validateExpediteur(mauvais);
    assert.equal(r.valid, false, `${mauvais} devrait être refusé`);
    assert.equal(r.type, 'NUMERO');
    assert.match(r.reasons.join(' '), /E.164/);
  }
});

test('expéditeur : vide est refusé', () => {
  for (const vide of ['', '   ', null, undefined]) {
    const r = validateExpediteur(vide);
    assert.equal(r.valid, false);
    assert.equal(r.type, 'VIDE');
  }
});

test('accountSid : le préfixe AC et 32 hexadécimaux sont attendus', () => {
  assert.equal(isPlausibleAccountSid(SID_VALIDE), true);
  assert.equal(isPlausibleAccountSid('XX00000000000000000000000000000000'), false);
  assert.equal(isPlausibleAccountSid('ACcourt'), false);
  assert.equal(isPlausibleAccountSid(''), false);
  assert.equal(isPlausibleAccountSid(null), false);
});

test('isLocalUrl : localhost, boucle locale et réseaux privés sont détectés', () => {
  for (const u of [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://[::1]:4000',
    'https://api.localhost',
    'http://192.168.1.10',
    'http://10.0.0.5',
    'http://172.16.0.1',
  ]) {
    assert.equal(isLocalUrl(u), true, u);
  }
});

test('isLocalUrl : une URL publique n’est pas locale', () => {
  for (const u of [
    'https://mon-tunnel.ngrok.app',
    'https://api.agrikonnect.africa',
    'https://172.100.0.1',
    'https://11.0.0.1',
  ]) {
    assert.equal(isLocalUrl(u), false, u);
  }
});

test('isLocalUrl : une URL invalide ne lève pas et n’est pas déclarée locale', () => {
  assert.equal(isLocalUrl('pas-une-url'), false);
  assert.equal(isLocalUrl(''), false);
  assert.equal(isLocalUrl(undefined), false);
});

/* ──────────────────── SMS ──────────────────── */

test('SMS : une configuration Twilio complète ne produit aucune erreur', () => {
  const r = verifierConfigSms(TWILIO_OK);
  assert.deepEqual(r.erreurs, []);
});

test('SMS : provider console n’exige rien', () => {
  assert.deepEqual(verifierConfigSms({ SMS_PROVIDER: 'console' }).erreurs, []);
});

test('SMS : SID manquant bloque le démarrage', () => {
  const r = verifierConfigSms({ ...TWILIO_OK, TWILIO_ACCOUNT_SID: undefined });
  assert.equal(r.erreurs.length, 1);
  assert.match(r.erreurs[0], /TWILIO_ACCOUNT_SID est requis/);
});

test('SMS : un SID qui ne commence pas par AC bloque, en nommant la cause probable', () => {
 const r = verifierConfigSms({ ...TWILIO_OK, TWILIO_ACCOUNT_SID: 'XX00000000000000000000000000000000' });
  assert.equal(r.erreurs.length, 1);
  assert.match(r.erreurs[0], /doit commencer par « AC »/);
  assert.match(r.erreurs[0], /Auth Token collé par erreur/);
});

test('SMS : jeton manquant bloque le démarrage', () => {
  const r = verifierConfigSms({ ...TWILIO_OK, TWILIO_AUTH_TOKEN: undefined });
  assert.equal(r.erreurs.length, 1);
  assert.match(r.erreurs[0], /TWILIO_AUTH_TOKEN est requis/);
});

test('SMS : expéditeur manquant ou non conforme bloque', () => {
  assert.match(
    verifierConfigSms({ ...TWILIO_OK, TWILIO_SENDER_ID: '' }).erreurs[0],
    /TWILIO_SENDER_ID est requis/,
  );
  const tropLong = verifierConfigSms({ ...TWILIO_OK, TWILIO_SENDER_ID: 'AGRIKONNECTAFRIQUE' });
  assert.match(tropLong.erreurs[0], /TWILIO_SENDER_ID est refusé/);
  assert.match(tropLong.erreurs[0], /11 au plus/);
});

test('SMS : URL de rappel en localhost avertit sans bloquer', () => {
  const r = verifierConfigSms({
    ...TWILIO_OK,
    TWILIO_WEBHOOK_BASE_URL: 'http://localhost:4000',
    TWILIO_STATUS_CALLBACK_URL: 'http://127.0.0.1:4000/cb',
  });
  assert.deepEqual(r.erreurs, [], 'une URL locale ne doit pas empêcher de démarrer');
  assert.equal(r.avertissements.length, 2);
  assert.match(r.avertissements.join(' '), /ngrok|cloudflared/);
});

test('SMS : URL de rappel absente avertit', () => {
  const r = verifierConfigSms(TWILIO_OK);
  assert.deepEqual(r.erreurs, []);
  assert.match(r.avertissements.join(' '), /TWILIO_WEBHOOK_BASE_URL est vide/);
});

test('SMS : une URL publique ne produit aucun avertissement de rappel', () => {
  const r = verifierConfigSms({
    ...TWILIO_OK,
    TWILIO_WEBHOOK_BASE_URL: 'https://mon-tunnel.ngrok.app',
    TWILIO_STATUS_CALLBACK_URL: 'https://mon-tunnel.ngrok.app/cb',
  });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
});

test('SMS : le repli numérique exige un E.164 valide', () => {
  const mauvais = verifierConfigSms({ ...TWILIO_OK, TWILIO_FALLBACK_FROM: '0810000000' });
  assert.match(mauvais.erreurs[0], /TWILIO_FALLBACK_FROM doit être un numéro E.164/);

  const bon = verifierConfigSms({ ...TWILIO_OK, TWILIO_FALLBACK_FROM: '+243810000000' });
  assert.deepEqual(bon.erreurs, [], 'un E.164 valide ne doit pas bloquer');
  const texte = bon.avertissements.join(' ');
  assert.match(texte, /TWILIO_FALLBACK_FROM est renseigné/);
  assert.match(texte, /Airtel/, 'l’avertissement doit rappeler la limite Airtel');
});

test('SMS : sans TWILIO_FALLBACK_FROM, aucun repli n’est annoncé', () => {
  const r = verifierConfigSms({
    ...TWILIO_OK,
    TWILIO_WEBHOOK_BASE_URL: 'https://x.test',
    TWILIO_STATUS_CALLBACK_URL: 'https://x.test/cb',
  });
  assert.equal(r.avertissements.filter((a) => /repli/.test(a)).length, 0);
});

test('SMS : provider webhook sans URL bloque', () => {
  assert.match(
    verifierConfigSms({ SMS_PROVIDER: 'webhook' }).erreurs[0],
    /SMS_WEBHOOK_URL est requis/,
  );
  assert.deepEqual(
    verifierConfigSms({ SMS_PROVIDER: 'webhook', SMS_WEBHOOK_URL: 'https://x.test' }).erreurs,
    [],
  );
});

/* ──────────────────── e-mail ──────────────────── */

test('e-mail : provider console n’exige rien', () => {
  assert.deepEqual(verifierConfigEmail({ EMAIL_PROVIDER: 'console' }).erreurs, []);
});

test('e-mail : resend sans clé bloque, en expliquant la conséquence', () => {
  const r = verifierConfigEmail({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'n@agrikonnect.africa' });
  assert.equal(r.erreurs.length, 1);
  assert.match(r.erreurs[0], /EMAIL_API_KEY est requis/);
  assert.match(r.erreurs[0], /inscription/);
});

test('e-mail : sendgrid sans clé bloque aussi', () => {
  assert.match(
    verifierConfigEmail({ EMAIL_PROVIDER: 'sendgrid', EMAIL_FROM: 'n@agrikonnect.africa' }).erreurs[0],
    /EMAIL_API_KEY est requis quand EMAIL_PROVIDER=sendgrid/,
  );
});

test('e-mail : expéditeur absent ou malformé bloque', () => {
  assert.match(
    verifierConfigEmail({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k', EMAIL_FROM: '' }).erreurs[0],
    /EMAIL_FROM est requis/,
  );
  assert.match(
    verifierConfigEmail({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k', EMAIL_FROM: 'pas-une-adresse' }).erreurs[0],
    /n’est pas une adresse valable/,
  );
});

test('e-mail : un domaine d’exemple avertit', () => {
  const r = verifierConfigEmail({
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 'k',
    EMAIL_FROM: 'n@example.com',
  });
  assert.deepEqual(r.erreurs, []);
  assert.match(r.avertissements.join(' '), /domaine vérifié/);
});

test('e-mail : EMAIL_VERIFIED_DOMAINS valide le domaine', () => {
  const r = verifierConfigEmail({
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 'k',
    EMAIL_FROM: 'n@agrikonnect.africa',
    EMAIL_VERIFIED_DOMAINS: 'agrikonnect.africa, autre.cd',
  });
  assert.deepEqual(r.avertissements, [], 'un domaine déclaré vérifié ne doit pas avertir');

  const refus = verifierConfigEmail({
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 'k',
    EMAIL_FROM: 'n@inconnu.cd',
    EMAIL_VERIFIED_DOMAINS: 'agrikonnect.africa',
  });
  assert.match(refus.avertissements.join(' '), /domaine vérifié/);
});

test('e-mail : un domaine d’exemple reste refusé même s’il est déclaré vérifié', () => {
  /*
   * `EMAIL_VERIFIED_DOMAINS` ne peut pas blanchir `example.com` : personne ne
   * reçoit un e-mail de vérification crédible depuis ce domaine, et permettre de
   * le déclarer rendrait le contrôle contournable par une simple variable.
   */
  const r = verifierConfigEmail({
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 'k',
    EMAIL_FROM: 'n@example.com',
    EMAIL_VERIFIED_DOMAINS: 'example.com',
  });
  assert.match(r.avertissements.join(' '), /domaine vérifié/);
});

test('e-mail : webhook sans URL bloque, URL locale avertit', () => {
  assert.match(
    verifierConfigEmail({ EMAIL_PROVIDER: 'webhook' }).erreurs[0],
    /EMAIL_WEBHOOK_URL est requis/,
  );
  const locale = verifierConfigEmail({
    EMAIL_PROVIDER: 'webhook',
    EMAIL_WEBHOOK_URL: 'http://localhost:9000',
  });
  assert.deepEqual(locale.erreurs, []);
  assert.match(locale.avertissements.join(' '), /injoignable/);
});

/* ──────────────────── consolidation ──────────────────── */

test('messagerie : le rapport consolidé cumule SMS et e-mail', () => {
  const r = verifierConfigMessagerie({ SMS_PROVIDER: 'twilio', EMAIL_PROVIDER: 'resend' });
  // 3 erreurs SMS (SID, jeton — l'expéditeur a un défaut) + 1 erreur e-mail.
  assert.ok(r.erreurs.length >= 3, `erreurs : ${r.erreurs.join(' | ')}`);
  assert.ok(r.erreurs.some((e) => /TWILIO_ACCOUNT_SID/.test(e)));
  assert.ok(r.erreurs.some((e) => /EMAIL_API_KEY/.test(e)));
});

test('messagerie : une configuration complète ne produit aucune erreur', () => {
  const r = verifierConfigMessagerie({
    ...TWILIO_OK,
    TWILIO_WEBHOOK_BASE_URL: 'https://mon-tunnel.ngrok.app',
    TWILIO_STATUS_CALLBACK_URL: 'https://mon-tunnel.ngrok.app/cb',
    EMAIL_PROVIDER: 'console',
  });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
});

test('messagerie : aucun message ne contient une valeur de secret', () => {
  /*
   * Le jeton et la clé ne doivent jamais apparaître dans un message, même
   * tronqués : `TWILIO_AUTH_TOKEN` est la clé de signature des webhooks, et
   * `EMAIL_API_KEY` donne un accès complet au compte e-mail.
   */
  const secretSms = 'JETON_ULTRA_SECRET_9f3a';
  const secretEmail = 're_cle_ultra_secrete_7b2c';
  const r = verifierConfigMessagerie({
    SMS_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'ACmauvais',
    TWILIO_AUTH_TOKEN: secretSms,
    TWILIO_SENDER_ID: 'AGRIKONNECTTROPLO',
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: secretEmail,
    EMAIL_FROM: 'n@agrikonnect.africa',
  });
  const tout = [...r.erreurs, ...r.avertissements].join('\n');
  assert.equal(tout.includes(secretSms), false, 'le jeton Twilio apparaît dans un message');
  assert.equal(tout.includes(secretEmail), false, 'la clé e-mail apparaît dans un message');
  // Le SID tronqué est acceptable, le SID complet non.
  assert.equal(tout.includes('ACmauvais'), false, 'le SID complet apparaît dans un message');
});
