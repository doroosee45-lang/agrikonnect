#!/usr/bin/env node
/**
 * Vérifie que chaque numéro de ligne cité dans
 * docs/GEOSPATIAL_BACKEND_CONFIGURATION.md pointe bien sur le paramètre annoncé
 * dans src/config/hardware.js.
 *
 * Le cahier des charges impose des numéros de ligne exacts, jamais approximatifs.
 * Ce contrôle rend cette exigence vérifiable plutôt qu'affirmée : si un paramètre
 * est déplacé dans hardware.js, la documentation échoue ici au lieu de dériver.
 *
 * Deux formes de citation sont contrôlées :
 *   - un tableau dont l'en-tête contient une colonne « Ligne » ;
 *   - une mention « ligne NNN » en prose, rattachée au dernier identifiant
 *     entre backticks qui la précède sur la même ligne.
 *
 * Usage : node scripts/check-hardware-doc.mjs [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const DOC = path.join(root, 'docs', 'GEOSPATIAL_BACKEND_CONFIGURATION.md');
const CODE = path.join(root, 'src', 'config', 'hardware.js');

const docLines = fs.readFileSync(DOC, 'utf8').split('\n');
const codeLines = fs.readFileSync(CODE, 'utf8').split('\n');

/** Le symbole apparaît-il à la ligne citée, ou dans les deux lignes qui suivent ? */
function foundAt(leaf, line) {
  if (!leaf || line < 1 || line > codeLines.length) return false;
  const window = codeLines.slice(line - 1, line + 2);
  const pattern = new RegExp(`\\b${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return window.some((l) => pattern.test(l));
}

/** Premier jeton technique entre backticks d'une cellule de tableau. */
function firstSymbol(cell) {
  const m = /`([A-Za-z0-9_.[\]]+)`/.exec(cell);
  if (!m) return null;
  return m[1].split('.').at(-1).split('[')[0].replace(/\]$/, '');
}

const rows = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const problems = [];
let checked = 0;

// 1) tableaux avec une colonne « Ligne »
let lineCol = null;
for (let i = 0; i < docLines.length; i += 1) {
  const line = docLines[i];
  if (!line.startsWith('|')) { lineCol = null; continue; }
  if (lineCol === null) {
    if (!line.includes('Ligne')) continue;
    const cells = rows(line);
    lineCol = cells.includes('Ligne') ? cells.indexOf('Ligne') : null;
    continue;
  }
  if (/^\s*[\s|:-]+$/.test(line)) continue; // ligne de séparation
  const cells = rows(line);
  const raw = cells[lineCol];
  if (!raw || !/^\d{2,4}$/.test(raw)) continue;
  const target = Number(raw);
  const leaf = firstSymbol(cells[0]);
  if (!leaf) continue;
  checked += 1;
  if (!foundAt(leaf, target)) {
    problems.push({ docLine: i + 1, symbol: cells[0], cited: target, actual: codeLines[target - 1]?.trim() });
  }
}

// 2) mentions « ligne NNN » en prose
for (let i = 0; i < docLines.length; i += 1) {
  const line = docLines[i];
  for (const m of line.matchAll(/\bligne (\d{2,4})\b/g)) {
    const target = Number(m[1]);
    const symbols = [...line.slice(0, m.index).matchAll(/`([A-Za-z0-9_]+)`/g)].map((x) => x[1]);
    const leaf = symbols.at(-1);
    if (!leaf) continue;
    checked += 1;
    if (!foundAt(leaf, target)) {
      problems.push({ docLine: i + 1, symbol: leaf, cited: target, actual: codeLines[target - 1]?.trim() });
    }
  }
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ checked, invalid: problems.length, problems }, null, 2)}\n`);
} else if (problems.length > 0) {
  process.stdout.write(
    `${problems.length} référence(s) de ligne invalide(s) dans ${path.relative(root, DOC)} :\n`,
  );
  for (const p of problems) {
    process.stdout.write(`  ligne ${p.docLine} : ${p.symbol} -> ${p.cited} | fichier : ${p.actual ?? '(hors fichier)'}\n`);
  }
} else {
  process.stdout.write(
    `Documentation matériel : ${checked} référence(s) de ligne vérifiée(s), aucune erreur.\n`,
  );
}

process.exit(problems.length > 0 ? 1 : 0);
