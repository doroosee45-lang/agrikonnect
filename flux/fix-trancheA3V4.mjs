#!/usr/bin/env node
/**
 * fix-trancheA3V4 - correction TS2657 : la branche authentifiee du menu
 * mobile portait deux liens freres sans parent JSX. On ferme la structure
 * avec un fragment, comme la barre desktop.
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
if (sha(texte) !== 'b271b39f7b1a86c0483cccb9cd282547') {
  console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, aucune ecriture');
  process.exit(1);
}

texte = remplacer(
  texte,
  [
    "            {isAuthenticated ? (",
    "              <Link to={dansEspace ? '/' : destinationEspace} onClick={() => setMenuOpen(false)}>",
    "                {dansEspace ? 'Visiter le site public' : 'Retour à mon espace'}",
    "              </Link>",
    "              <Link to=\"/app/profile\" onClick={() => setMenuOpen(false)}>{user?.firstName ?? 'Mon profil'}</Link>",
  ].join(NL),
  [
    "            {isAuthenticated ? (",
    "              <>",
    "                <Link to={dansEspace ? '/' : destinationEspace} onClick={() => setMenuOpen(false)}>",
    "                  {dansEspace ? 'Visiter le site public' : 'Retour à mon espace'}",
    "                </Link>",
    "                <Link to=\"/app/profile\" onClick={() => setMenuOpen(false)}>{user?.firstName ?? 'Mon profil'}</Link>",
    "              </>",
  ].join(NL),
  chemin,
);

for (const [motif, fois] of [
  ['Visiter le site public', 2],
  ['Retour à mon espace', 2],
  ['getUserInitialRoute', 2],
  ["'Mon profil'", 1],
]) {
  const trouve = texte.split(motif).length - 1;
  if (trouve !== fois) {
    console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + trouve + ' (attendu x' + fois + ') - STOP');
    process.exit(1);
  }
}

fs.writeFileSync(chemin, texte);
console.log('fix-trancheA3V4 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
