import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PERMISSIONS } from '../src/shared/permissions.js';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return walk(p);
  return d.name.endsWith('.js') ? [p] : [];
});

const used = new Map();
for (const file of walk(fileURLToPath(new URL('../src', import.meta.url)))) {
  const src = fs.readFileSync(file, 'utf8');
  // `authorize` accepte plusieurs permissions (alternatives) : on les prend toutes.
  for (const call of src.matchAll(/authorize\(([^)]*)\)/g)) {
    // casse libre : une permission en camelCase doit être détectée comme les
    // autres, sinon elle apparaîtrait « non utilisée » et masquerait un oubli.
    for (const perm of call[1].matchAll(/'([a-zA-Z]+\.[a-zA-Z]+)'/g)) {
      if (!used.has(perm[1])) used.set(perm[1], []);
      used.get(perm[1]).push(file);
    }
  }
}

const missing = [...used.keys()].filter((p) => !PERMISSIONS[p]);
const unused = Object.keys(PERMISSIONS).filter((p) => !used.has(p));

console.log(`Permissions utilisées : ${used.size} / définies : ${Object.keys(PERMISSIONS).length}`);
console.log(`Manquantes (utilisées sans définition) : ${missing.length}`);
missing.forEach((m) => console.log('  ✗', m, '→', used.get(m)[0]));
console.log(`Définies mais non utilisées : ${unused.length}`);
console.log('  ', unused.join(', ') || '—');
if (missing.length > 0) process.exitCode = 1;
