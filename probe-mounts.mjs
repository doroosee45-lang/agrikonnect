import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('openapi-sonde.json', 'utf8'));
if (d.paths === undefined) { console.log('PAS_DE_PATHS', JSON.stringify(d).slice(0, 120)); process.exit(1); }
const m = Object.values(d.paths).flatMap((x) => Object.keys(x));
const rep = {};
for (const k of m) rep[k] = (rep[k] || 0) + 1;
console.log('mounts', m.length, '| methodes', JSON.stringify(rep));
console.log('chemins', Object.keys(d.paths).length);
