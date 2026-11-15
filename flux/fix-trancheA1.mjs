#!/usr/bin/env node
/**
 * fix-trancheA1 - Login.tsx atterrit sur la destination centralisee
 * (getUserInitialRoute) au lieu du site public.
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

const chemin = 'src/pages/auth/Login.tsx';
let texte = fs.readFileSync(chemin, 'utf8');
if (sha(texte) !== '1b413b16fa61602cb2eb8dbec5ab6c24') {
  console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, colle la sortie');
  process.exit(1);
}

texte = remplacer(
  texte,
  "import { COLORS, DURATION, EASE } from '@/theme';",
  [
    "import { COLORS, DURATION, EASE } from '@/theme';",
    "import { getUserInitialRoute } from '@/lib/redirects';",
  ].join(NL),
  chemin,
);

texte = remplacer(
  texte,
  "      navigate('/');",
  [
    '      const etat = useAuthStore.getState();',
    '      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);',
  ].join(NL),
  chemin,
);

fs.writeFileSync(chemin, texte);
console.log('fix-trancheA1 : ' + chemin + ' mis a jour');
