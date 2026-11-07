import fs from 'node:fs';
import crypto from 'node:crypto';

const BS = String.fromCharCode(92);
const CR = String.fromCharCode(13);
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

const cible = 'fix-i5.mjs';
let s = fs.readFileSync(cible, 'utf8');

// 1. Retire les éventuels retours chariot ajoutés par le collage (jamais dans l'original).
const avecCR = s.split(CR).length - 1;
s = s.split(CR).join('');

// 2. Repasse les séquences antislash+antislash+n (antislashs doublés au collage)
//    en antislash+n — la forme exacte attendue par les coutures.
const doublons = s.split(BS + BS + 'n').length - 1;
s = s.split(BS + BS + 'n').join(BS + 'n');

fs.writeFileSync(cible, s);
console.log('retours chariot retirés :', avecCR);
console.log('antislashs dédoublés :', doublons);
console.log('md5 fix-i5.mjs :', md5(cible));
if (md5(cible) === '9717a9810e058dd754640016671052c0') {
  console.log('REPAR_FIX_OK');
} else {
  console.log('REPAR_FIX_KO');
  process.exit(1);
}
