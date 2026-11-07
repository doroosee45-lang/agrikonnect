#!/usr/bin/env node
/**
 * fix-web-verif2 — coutures suite BLOC 66 :
 *  1. VerifyEmail.tsx accepte le paramètre `token_hash` (celui réellement
 *     appendé par Supabase en retour de vérification) en plus de `token` ;
 *  2. Register.tsx atterrit sur l'écran de vérification, adresse préremplie.
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
    console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu — STOP, aucune ecriture');
    process.exit(1);
  }
  for (const op of operations) texte = remplacer(texte, op[0], op[1], chemin);
  fs.writeFileSync(chemin, texte);
  console.log('fix-web-verif2 : ' + chemin + ' mis a jour');
};

corriger('src/pages/auth/VerifyEmail.tsx', '503affcc724de1d1ff9bdea04d688f29', [
  [
    "  const jetonUrl = params.get('token') ?? '';",
    "  const jetonUrl = params.get('token_hash') ?? params.get('token') ?? '';",
  ],
]);

corriger('src/pages/auth/Register.tsx', '48426a102214fddf7a1114ba0d5b96ad', [
  [
    "      navigate('/');",
    [
      "      // La vérification d'adresse est la prochaine étape : l'écran dédié se",
      "      // charge du renvoi du lien, l'adresse y est préremplie (?email=…).",
      "      navigate('/auth/verify-email?email=' + encodeURIComponent(email));",
    ].join(NL),
  ],
]);

console.log('fix-web-verif2 : termine');
