/**
 * Internationalisation des réponses de l'API (CDC I18N-01).
 *
 * Garanties vérifiées :
 * - le français reste la langue par défaut : sans `Accept-Language`, les
 *   messages sont strictement identiques à ceux écrits dans le code ;
 * - `Accept-Language: en` traduit messages d'erreur, de succès et de
 *   validation, sans toucher aux champs machine (`code`, `field`, `errors[].code`) ;
 * - le catalogue est cohérent : pas de doublon, paramètres identiques des deux
 *   côtés.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { MESSAGES_EN } from '../src/shared/i18n/messages.en.js';
import {
  parseAcceptLanguage,
  translateMessage,
  withLocale,
  zodIssuesToFieldErrors,
} from '../src/shared/i18n/index.js';
import { ApiError } from '../src/shared/errors/ApiError.js';
import { errorHandler } from '../src/shared/http/errorHandler.js';
import { validate } from '../src/middleware/validate.js';
import { success } from '../src/shared/http/response.js';

const capturer = (err, locale) => {
  let corps;
  let statut;
  const req = { id: 'req-i18n', method: 'GET', originalUrl: '/t', headers: {}, locale };
  const res = {
    status(s) { statut = s; return this; },
    json(c) { corps = c; return this; },
  };
  errorHandler(err, req, res, () => {});
  return { statut, corps };
};

test('Accept-Language — choix de la langue prise en charge, repli français', () => {
  assert.equal(parseAcceptLanguage('en-GB,en;q=0.9,fr;q=0.8'), 'en');
  assert.equal(parseAcceptLanguage('fr-CD,fr;q=0.9'), 'fr');
  assert.equal(parseAcceptLanguage('de-DE,en;q=0.5'), 'en');
  assert.equal(parseAcceptLanguage('de-DE'), 'fr');
  assert.equal(parseAcceptLanguage(''), 'fr');
  assert.equal(parseAcceptLanguage(undefined), 'fr');
  assert.equal(parseAcceptLanguage('en;q=0'), 'fr', 'q=0 signifie « refusé »');
});

test('catalogue — aucun doublon, paramètres identiques, traductions non vides', () => {
  const vus = new Set();
  for (const [fr, en, params = []] of MESSAGES_EN) {
    assert.ok(!vus.has(fr), `doublon : ${fr}`);
    vus.add(fr);
    assert.ok(typeof en === 'string' && en.trim(), `traduction vide : ${fr}`);
    for (const p of params) {
      assert.ok(fr.includes(`{${p}}`), `paramètre ${p} absent du français : ${fr}`);
      assert.ok(en.includes(`{${p}}`), `paramètre ${p} absent de l'anglais : ${en}`);
    }
  }
  assert.ok(MESSAGES_EN.length > 600, 'le catalogue couvre les messages extraits');
});

test('traduction — messages simples, gabarits, repli et français inchangé', () => {
  assert.equal(translateMessage('Parcelle introuvable', 'en'), 'Plot not found');
  assert.equal(translateMessage('Parcelle introuvable', 'fr'), 'Parcelle introuvable');
  assert.equal(translateMessage('Route introuvable : GET /api/v1/x', 'en'), 'Route not found: GET /api/v1/x');
  // une valeur capturée connue du catalogue est elle-même traduite
  assert.equal(translateMessage('Seuil dépassé — Capteur silencieux', 'en'), 'Threshold exceeded — Silent sensor');
  // message inconnu : renvoyé tel quel, jamais une clé technique
  assert.equal(translateMessage('Message jamais vu', 'en'), 'Message jamais vu');
  assert.equal(translateMessage('', 'en'), '');
  assert.equal(translateMessage(null, 'en'), null);
});

test('errorHandler — français par défaut identique, anglais sur demande, code machine inchangé', () => {
  const fr = capturer(ApiError.notFound('Parcelle introuvable'));
  assert.equal(fr.statut, 404);
  assert.equal(fr.corps.message, 'Parcelle introuvable');
  assert.equal(fr.corps.code, 'NOT_FOUND');

  const en = capturer(ApiError.notFound('Parcelle introuvable'), 'en');
  assert.equal(en.corps.message, 'Plot not found');
  assert.equal(en.corps.code, 'NOT_FOUND');
});

test('validation — code inchangé, message ajouté et localisé (défauts Zod compris)', () => {
  const schema = z.object({
    name: z.string().trim().min(2, 'Nom requis'),
    email: z.string().email(),
    countryCode: z.string(),
  });
  const parsed = schema.safeParse({ name: 'x', email: 'pas-un-email' });
  assert.equal(parsed.success, false);

  const fr = zodIssuesToFieldErrors(parsed.error.issues, 'body', 'fr');
  const parChampFr = Object.fromEntries(fr.map((e) => [e.field, e]));
  assert.equal(parChampFr.name.code, 'Nom requis', 'code = message du schéma, inchangé');
  assert.equal(parChampFr.name.message, 'Nom requis');
  assert.equal(parChampFr.email.message, 'Adresse e-mail invalide', 'défaut Zod rendu en français');
  assert.equal(parChampFr.countryCode.message, 'Champ obligatoire');

  const en = zodIssuesToFieldErrors(parsed.error.issues, 'body', 'en');
  const parChampEn = Object.fromEntries(en.map((e) => [e.field, e]));
  assert.equal(parChampEn.name.code, 'Nom requis');
  assert.equal(parChampEn.name.message, 'Name required');
  assert.equal(parChampEn.email.message, 'Invalid email address');
  assert.equal(parChampEn.countryCode.message, 'Required field');
});

test('middleware validate — erreurs par champ dans la langue de la requête', () => {
  const mw = validate(z.object({ title: z.string().min(3, 'Titre requis') }));
  let erreur;
  mw({ body: { title: '' }, locale: 'en' }, {}, (e) => { erreur = e; });
  assert.ok(erreur instanceof ApiError);
  assert.equal(erreur.errors[0].field, 'title');
  assert.equal(erreur.errors[0].code, 'Titre requis');
  assert.equal(erreur.errors[0].message, 'Title required');
});

test('success() — message traduit selon la langue de la requête ou du contexte', () => {
  const capture = (req) => {
    let corps;
    const res = { req, status() { return this; }, json(c) { corps = c; return this; } };
    success(res, { ok: true }, { message: 'Parcelle créée' });
    return corps;
  };
  assert.equal(capture({ locale: 'fr' }).message, 'Parcelle créée');
  assert.equal(capture({ locale: 'en' }).message, 'Plot created');
  assert.equal(withLocale('en', () => capture(undefined)).message, 'Plot created');
});
