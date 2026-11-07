#!/usr/bin/env node
/**
 * fix-auth-verif — BLOC 68 : le renvoi de vérification exige l'adresse cible
 *
 * Avant : un corps vide passait jusqu'à GoTrue qui répondait en anglais
 * « Type provided requires an email address ». Après : le schéma Zod refuse
 * immédiatement (422, champ nommé), message exploitable par l'IHM.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');

const remplacer = (texte, ancre, remplacement, chemin) => {
  if (texte.split(ancre).length !== 2) {
    console.log('ARRET_ANCRE : ' + chemin + ' — motif introuvable ou double — STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(ancre).join(remplacement);
};

const corriger = (chemin, attendu, operations) => {
  let texte = fs.readFileSync(chemin, 'utf8');
  if (sha(texte) !== attendu) {
    console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu — STOP, colle la sortie');
    process.exit(1);
  }
  for (const op of operations) texte = remplacer(texte, op[0], op[1], chemin);
  fs.writeFileSync(chemin, texte);
  console.log('fix-auth-verif : ' + chemin + ' mis a jour');
};

// ── 1. auth.schema.js : schéma du renvoi ──
corriger('src/modules/auth/auth.schema.js', '025942e4fb29633f5b1cde23fec9d079', [
  [
    'export const loginSchema = z.object({',
    [
      '/** AUTH-03 — le renvoi du lien de vérification exige l\'adresse cible. */',
      'export const resendVerificationSchema = z.object({',
      "  email: z.string().trim().toLowerCase().email('Email invalide'),",
      '});',
      '',
      'export const loginSchema = z.object({',
    ].join(NL),
  ],
]);

// ── 2. auth.routes.js : validation sur la route ──
corriger('src/modules/auth/auth.routes.js', 'b9f6d04635aa74bcf7d39055a018dfc2', [
  [
    "router.post('/resend-verification', authLimiter, asyncHandler(controller.resendEmail));",
    "router.post('/resend-verification', authLimiter, validate(schema.resendVerificationSchema), asyncHandler(controller.resendEmail));",
  ],
]);

// ── 3. verifyEmail.e2e.test.mjs : preuve anti-regression ──
corriger('tests/e2e/verifyEmail.e2e.test.mjs', 'd9fd6ac37ee96e3dffd9bfd58f293e59', [
  [
    [
      "    'aucun jeton ne doit être émis pour une adresse inconnue',",
      '  );',
      '});',
    ].join(NL),
    [
      "    'aucun jeton ne doit être émis pour une adresse inconnue',",
      '  );',
      '});',
      '',
      'test("renvoi sans adresse — refus explicite (422) qui nomme le champ", async () => {',
      "  const sansEmail = await h.request('POST', '/auth/resend-verification', { body: {} });",
      '',
      '  assert.equal(sansEmail.status, 422, JSON.stringify(sansEmail.body));',
      "  assert.equal(sansEmail.body.code, 'VALIDATION_ERROR');",
      '  assert.ok(',
      "    JSON.stringify(sansEmail.body).includes('email'),",
      "    'la réponse nomme le champ email : ' + JSON.stringify(sansEmail.body),",
      '  );',
      '});',
    ].join(NL),
  ],
]);

console.log('fix-auth-verif : termine');
