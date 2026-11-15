#!/usr/bin/env node
/**
 * fix-web-verif — coutures : le renvoi de vérification porte l'adresse e-mail
 *
 * BUG validé navigateur (2026-11-04) : `resendVerification()` envoyait un
 * corps vide ; l'API et Supabase exigent l'adresse cible, sinon aucun e-mail
 * de vérification ne part. Coutures : endpoints.ts (paramètre email) et
 * Register.tsx (atterrissage sur l'écran de vérification, adresse préremplie).
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
  console.log('fix-web-verif : ' + chemin + ' mis a jour');
};

// ── 1. endpoints.ts : resendVerification prend l'adresse ──
corriger('src/services/endpoints.ts', 'd80ab3802af266a4a11e2301da4eee88', [
  [
    [
      '  resendVerification: () =>',
      "    api.post<{ sent: boolean }>('/auth/resend-verification', {}, { skipAuthRefresh: true }),",
    ].join(NL),
    [
      '  resendVerification: (email: string) =>',
      "    api.post<{ sent: boolean }>('/auth/resend-verification', { email }, { skipAuthRefresh: true }),",
    ].join(NL),
  ],
]);

// ── 2. Register.tsx : atterrissage sur la vérification, adresse préremplie ──
corriger('src/pages/auth/Register.tsx', '6118a2eba300d06f1b8131711cf646b8', [
  [
    "      navigate('/');",
    [
      "      // La vérification d'adresse est la prochaine étape : l'écran dédié se",
      "      // charge du renvoi du lien, l'adresse y est préremplie (?email=…).",
      "      navigate('/auth/verify-email?email=' + encodeURIComponent(email));",
    ].join(NL),
  ],
]);

console.log('fix-web-verif : termine');
