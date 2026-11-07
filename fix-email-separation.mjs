#!/usr/bin/env node
/**
 * fix-email-separation — audit e-mails : Supabase Auth / Resend
 *
 * Séparation des responsabilités (validation du 2026-11-04) :
 *  - Supabase Auth : TOUS les e-mails d'authentification (confirmation,
 *    vérification, réinitialisation, magic link).
 *  - Resend (integrations/email.js) : TOUS les autres e-mails applicatifs.
 * Correctifs : (1) suppression de l'envoi Resend dupliqué dans forgotPassword,
 * (2) avertissement sur les gabarits auth du catalogue Resend, (3) preuve
 * anti-doublon ajoutée au test E2E AUTH-06.
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
  console.log('fix-email-separation : ' + chemin + ' mis a jour');
};

// ── 1. auth.service.js : plus d'e-mail Resend pour la réinitialisation ──
corriger('src/modules/auth/auth.service.js', '9862d7c3eb157a5b9079b8cdc309ab99', [
  [
    "import { sendEmail, templates } from '../../integrations/email.js';" + NL,
    '',
  ],
  [
    [
      '    const tpl = templates.passwordReset(lienMotDePasseOublie());',
      '    await sendEmail({ to: email, ...tpl });',
    ].join(NL),
    [
      "    // L'e-mail de récupération est envoyé exclusivement par Supabase Auth",
      '    // (source de vérité des e-mails d\'authentification) : aucun envoi',
      '    // Resend en double — décision audit e-mails 2026-11-04.',
    ].join(NL),
  ],
]);

// ── 2. email.js : gabarits auth réservés à Supabase ──
corriger('src/integrations/email.js', '395571dfef2c1f12d866ff60970678d4', [
  [
    '  emailVerification: (link) => ({',
    [
      '  // RESERVE SUPABASE — les e-mails d\'authentification (confirmation',
      "  // d'inscription, vérification, réinitialisation, magic link) partent",
      '  // exclusivement via Supabase Auth. Les deux gabarits ci-dessous ne',
      '  // servent que de référence de contenu : ne JAMAIS les envoyer par',
      '  // sendEmail (doublons interdits — audit e-mails 2026-11-04).',
      '  emailVerification: (link) => ({',
    ].join(NL),
  ],
]);

// ── 3. journeys.e2e.test.mjs : preuve anti-doublon sur AUTH-06 ──
corriger('tests/e2e/journeys.e2e.test.mjs', '706db5ad3c49a393a4197e3d210f0e22', [
  [
    "  assert.ok(tokenHash, 'jeton de récupération émis');",
    [
      "  assert.ok(tokenHash, 'jeton de récupération émis');",
      '',
      '  // Séparation des fournisseurs : seul Supabase Auth envoie cet e-mail —',
      '  // zéro e-mail applicatif (Resend) ne doit partir en double.',
      "  const doublons = h.sink.messages.email.filter((m) => m.to === 'reset@agrikonnect.test');",
      '  assert.equal(doublons.length, 0, `aucun e-mail applicatif en double : ${JSON.stringify(doublons)}`);',
    ].join(NL),
  ],
]);

console.log('fix-email-separation : termine');
