#!/usr/bin/env node
/**
 * fix-trancheA3V3 - Tranche A partie 3, suite : le lien de navigation du
 * cahier des charges entre AUSSI dans le menu mobile (site-mobile-menu).
 * Meme lien contextuel que la barre desktop :
 *  - depuis l espace : "Visiter le site public" ;
 *  - depuis le site public : "Retour a mon espace" (destination centrale).
 * Session jamais perdue : simple navigation, aucun logout.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');

const remplacer = (texte, ancre, remplacement, chemin) => {
  if (texte.split(ancre).length !== 2) {
    console.log('ARRET_ANCRE : ' + chemin + ' - motif introuvable ou double - STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(ancre).join(remplacement);
};

const chemin = 'src/components/layout/Header.tsx';
let texte = fs.readFileSync(chemin, 'utf8');
if (sha(texte) !== '4aa47b6d5ba762ac483550038e5d726d') {
  console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, aucune ecriture');
  process.exit(1);
}

// Lien contextuel dans le menu mobile, avant le lien de profil.
texte = remplacer(
  texte,
  [
    "            {isAuthenticated ? (",
    "              <Link to=\"/app/profile\" onClick={() => setMenuOpen(false)}>{user?.firstName ?? 'Mon profil'}</Link>",
  ].join(NL),
  [
    "            {isAuthenticated ? (",
    "              <Link to={dansEspace ? '/' : destinationEspace} onClick={() => setMenuOpen(false)}>",
    "                {dansEspace ? 'Visiter le site public' : 'Retour à mon espace'}",
    "              </Link>",
    "              <Link to=\"/app/profile\" onClick={() => setMenuOpen(false)}>{user?.firstName ?? 'Mon profil'}</Link>",
  ].join(NL),
  chemin,
);

for (const [motif, fois] of [['Visiter le site public', 2], ['Retour à mon espace', 2], ['getUserInitialRoute', 2]]) {
  const trouve = texte.split(motif).length - 1;
  if (trouve !== fois) {
    console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + trouve + ' (attendu x' + fois + ') - STOP');
    process.exit(1);
  }
}

fs.writeFileSync(chemin, texte);
console.log('fix-trancheA3V3 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
