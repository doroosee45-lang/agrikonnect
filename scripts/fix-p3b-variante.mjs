#!/usr/bin/env node
/*
 * fix-p3b-variante.mjs -- BLOC 91. Adaptation de fix-p3-layout.mjs a la
 * VARIANTE MACHINE d AppLayout.tsx (4ab4c69e, sonde BLOC 90G).
 * cause : les sondes BLOC 88/89 tournaient dans une copie perimee (arbre de
 * l atelier) ; la reference ed4f7678 etait fausse pour la machine. La machine
 * porte une variante personnalisee : wrapper de transition
 *   <div key={location.pathname} className="page-enter">{children}</div>
 * Ce script coud 6 ancres uniques dans fix-p3-layout.mjs (RACINE --gen pour
 * les tests locaux) :
 *   1. porte PRE AppLayout -> 4ab4c69e (la variante reelle)
 *   2-3. le wrapper page-enter est PRESERVE dans les 2 branches
 *        (public + espace) du futur AppLayout genere
 *   4. commentaire trace dans le genere
 *   5. porte POST du genere -> a9feaacb (calcule atelier)
 *   6. recap
 * sortie verifiee : fix-p3-layout.mjs = d93d20986309345e47fc4a60a41aef61.
 * Aucune autre modification ; ensuite le script P3 tourne inchange.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p3btree' : RD;

const md5 = (f) => createHash('md5').update(fs.readFileSync(f)).digest('hex');
const lire = (f) => fs.readFileSync(f, 'utf8');
const ecrire = (f, contenu) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, contenu, 'utf8'); };
const verifie = (f, contenu, valeurs) => {
  for (const v of valeurs) {
    if (typeof v === 'string' && !contenu.includes(v)) throw new Error('ABSENT: ' + v + ' @ ' + f);
    if (v instanceof RegExp && !v.test(contenu)) throw new Error('ABSENT_RE: ' + String(v) + ' @ ' + f);
  }
};
function pre(m5, f) {
  const p = path.join(RACINE, f);
  if (!fs.existsSync(p)) throw new Error('MANQUANT ' + f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5 ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function post(m5, f, valeurs) {
  const p = path.join(RACINE, f);
  const v = md5(p);
  verifie(p, lire(p), valeurs);
  if (v !== m5) throw new Error('ARRET_MD5_POST ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function remplacerTout(f, avant, apres, attendu) {
  const p = path.join(RACINE, f);
  const c = lire(p);
  if (c.split(avant).length - 1 !== attendu) throw new Error('ARRET_ANCRE ' + f + ' : ' + avant.slice(0, 50));
  ecrire(p, c.split(avant).join(apres));
}

console.log('== BLOC 91 : adaptation de fix-p3-layout.mjs a la variante AppLayout ==');

/* portes PRE : etat machine exact avant couture */
pre('f82402a87ce568933e8a3ac6ab53223f', 'scripts/fix-p3-layout.mjs');
pre('4ab4c69ee7b7ce8251615d1ac92174b8', 'apps/web/src/components/layout/AppLayout.tsx');

/* les 6 coutures (ancres uniques, compte exact 1) */
remplacerTout('scripts/fix-p3-layout.mjs',
  "pre('ed4f76780807847844fe7c892f00f7da', 'apps/web/src/components/layout/AppLayout.tsx');",
  "pre('4ab4c69ee7b7ce8251615d1ac92174b8', 'apps/web/src/components/layout/AppLayout.tsx');",
  1);
remplacerTout('scripts/fix-p3-layout.mjs',
  '<main style={{ flex: 1 }}>{children}</main>',
  '<main style={{ flex: 1 }}><div key={location.pathname} className="page-enter">{children}</div></main>',
  1);
remplacerTout('scripts/fix-p3-layout.mjs',
  '<main className="flex-1">{children}</main>',
  '<main className="flex-1"><div key={location.pathname} className="page-enter">{children}</div></main>',
  1);
remplacerTout('scripts/fix-p3-layout.mjs',
  ' * public) : aucune fonctionnalite supprimee, aucun logout ajoute.\n */',
  ' * public) : aucune fonctionnalite supprimee, aucun logout ajoute.\n * Le wrapper page-enter de la variante machine est PRESERVE (2 branches).\n */',
  1);
remplacerTout('scripts/fix-p3-layout.mjs',
  "post('f7f43166872ffe15127af69f970e3a27', 'apps/web/src/components/layout/AppLayout.tsx', [",
  "post('a9feaacb73dacece73679ea6a23a1c86', 'apps/web/src/components/layout/AppLayout.tsx', [",
  1);
remplacerTout('scripts/fix-p3-layout.mjs',
  "console.log('  AppLayout.tsx : public = Header/Footer inchanges ; espace = rail 250/72 + drawer');",
  "console.log('  AppLayout.tsx : page-enter variante preserve ; public = Header/Footer inchanges ; espace = rail 250/72 + drawer');",
  1);

/* porte POST : le script transforme doit etre byte-identique a la copie atelier */
post('d93d20986309345e47fc4a60a41aef61', 'scripts/fix-p3-layout.mjs', [
  "pre('4ab4c69ee7b7ce8251615d1ac92174b8'", 'page-enter', "post('a9feaacb73dacece73679ea6a23a1c86'",
]);

/* aucune empreinte perimee ne doit survivre */
{
  const c = lire(path.join(RACINE, 'scripts/fix-p3-layout.mjs'));
  if (c.includes('ed4f76780807847844fe7c892f00f7da')) throw new Error('RESIDU ed4f7678');
  if (c.includes('f7f43166872ffe15127af69f970e3a27')) throw new Error('RESIDU f7f43166');
  console.log('  [ok] aucune empreinte perimee residuelle');
}

console.log('');
console.log('RECAP BLOC 91 :');
console.log('  porte PRE AppLayout -> variante 4ab4c69e (reference erronee remplacee)');
console.log('  wrapper page-enter machine PRESERVE (2 branches du futur AppLayout)');
console.log('  porte POST du genere -> a9feaacb73dacece73679ea6a23a1c86');
console.log('  fix-p3-layout.mjs = d93d20986309345e47fc4a60a41aef61');
console.log('');
console.log('BLOC_91_OK (si run P3 + verifications npm web + mobile sont verts)');
