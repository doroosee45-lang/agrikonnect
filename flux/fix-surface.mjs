#!/usr/bin/env node
/**
 * fix-surface — mise à jour motivée de la liste PUBLIQUES (BLOC 68)
 *
 * POST /auth/resend-verification ne répond plus 2xx à un corps vide (422
 * explicite depuis fix-auth-verif) : la route sort de la liste des routes
 * observées en 2xx sans jeton. L'anti-énumération avec adresse valide est
 * inchangée (200 même pour une adresse inconnue).
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

const chemin = 'tests/e2e/surfacePublique.e2e.test.mjs';
let texte = fs.readFileSync(chemin, 'utf8');
if (sha(texte) !== 'c43c2ba10b67a194c99b994d740e0a31') {
  console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu — STOP, colle la sortie');
  process.exit(1);
}

texte = remplacer(
  texte,
  [
    ' *  - `POST /auth/resend-verification` : répond 200 même pour une adresse',
    ' *    inconnue, volontairement, pour ne pas révéler quels comptes existent.',
  ].join(NL),
  [
    ' *  - `POST /auth/resend-verification` : répond 200 même pour une adresse',
    ' *    inconnue, volontairement, pour ne pas révéler quels comptes existent',
    ' *    (anti-énumération) — mais **avec une adresse valide**. Depuis le',
    ' *    2026-11-04, un corps vide reçoit 422 (contrat explicite) : la route',
    " *    n'est plus observée en 2xx avec `{}` et sort de cette liste.",
  ].join(NL),
  chemin,
);

texte = remplacer(texte, "  'POST /auth/resend-verification'," + NL, '', chemin);

fs.writeFileSync(chemin, texte);
console.log('fix-surface : ' + chemin + ' mis a jour');
