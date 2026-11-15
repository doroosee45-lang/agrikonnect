#!/usr/bin/env node
/**
 * Contrôle d'internationalisation — web, mobile et backend.
 *
 *   node scripts/i18n/check-i18n.mjs            (code de sortie 1 en cas d'écart)
 *
 * Vérifie, sans dépendance :
 *  1. parité fr/en de chaque dictionnaire (apps/web, apps/Mobile) : mêmes clés ;
 *  2. paramètres {x} identiques entre fr et en pour chaque clé ;
 *  3. cohérence web ↔ mobile : une clé `ui.*` présente des deux côtés porte le
 *     même texte français et la même traduction (stratégie de clés partagées) ;
 *  4. clés `ui.*` référencées dans le code mais absentes du dictionnaire, et
 *     clés du dictionnaire jamais référencées (avertissement) ;
 *  5. catalogue backend : pas de doublon, paramètres présents des deux côtés ;
 *  6. textes visibles restés en dur dans le JSX (heuristique, avertissement).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APPS = { web: 'apps/web/src', mobile: 'apps/Mobile/src' };
let errors = 0;
let warnings = 0;
const err = (m) => { errors++; console.log(`  ✖ ${m}`); };
const warn = (m) => { warnings++; console.log(`  ⚠ ${m}`); };

/** Évalue le premier objet littéral qui suit `marker` dans un fichier TS. */
function readObject(file, marker, scope = {}) {
  const s = fs.readFileSync(file, 'utf8');
  const at = s.indexOf(marker);
  if (at < 0) throw new Error(`${marker} introuvable dans ${file}`);
  const start = s.indexOf('{', at);
  let depth = 0;
  let i = start;
  let quote = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  const names = Object.keys(scope);
  return Function(...names, `return (${s.slice(start, i + 1)});`)(...names.map((n) => scope[n]));
}
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [[prefix + k, v]] : flatten(v, `${prefix}${k}.`)));
const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'i18n'].includes(e.name)) walk(p, out); } else if (/\.(tsx?|jsx?)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

const dicts = {};
for (const [app, rel] of Object.entries(APPS)) {
  console.log(`\n[${app}] ${rel}/i18n`);
  const dir = path.join(ROOT, rel, 'i18n');
  const uiFr = readObject(path.join(dir, 'ui.fr.ts'), 'export const uiFr');
  const uiEn = readObject(path.join(dir, 'ui.en.ts'), 'export const uiEn');
  const fr = new Map(flatten(readObject(path.join(dir, 'fr.ts'), 'export const fr', { uiFr })));
  const en = new Map(flatten(readObject(path.join(dir, 'en.ts'), 'export const en', { uiEn })));
  dicts[app] = { fr, en };

  for (const k of fr.keys()) if (!en.has(k)) err(`clé absente en anglais : ${k}`);
  for (const k of en.keys()) if (!fr.has(k)) err(`clé absente en français : ${k}`);
  for (const [k, v] of fr) if (en.has(k) && params(v) !== params(en.get(k))) err(`paramètres différents : ${k}`);
  for (const [k, v] of en) if (!v.trim()) err(`traduction vide : ${k}`);

  // clés utilisées dans le code
  const used = new Set();
  let hardcoded = 0;
  const samples = [];
  for (const file of walk(path.join(ROOT, rel))) {
    const s = fs.readFileSync(file, 'utf8');
    for (const m of s.matchAll(/\b(?:t|tr)\(\s*'([\w.]+)'/g)) used.add(m[1]);
    for (const m of s.matchAll(/'((?:ui|common|nav|home|auth|farmer|provenance|roles|errors)\.[\w]+)'/g)) used.add(m[1]);
    if (file.endsWith('.tsx')) {
      // texte JSX : entre > et < ou {, avec au moins un mot de 2 lettres
      for (const m of s.matchAll(/>\s*([A-Za-zÀ-ÿ][^<>{}\n]*[A-Za-zÀ-ÿ.!?…:])\s*(?=<|\{)/g)) {
        if (/^(?:[a-z]+(?:[A-Z]\w*)?|=>.*)$/.test(m[1].trim())) continue;
        hardcoded++;
        if (samples.length < 5) samples.push(`${path.relative(ROOT, file)} : « ${m[1].trim().slice(0, 60)} »`);
      }
    }
  }
  for (const k of used) if (k.startsWith('ui.') && !fr.has(k)) err(`clé utilisée mais absente du dictionnaire : ${k}`);
  const unused = [...fr.keys()].filter((k) => k.startsWith('ui.') && !used.has(k));
  if (unused.length) warn(`${unused.length} clé(s) ui.* jamais référencée(s) littéralement (ex. ${unused.slice(0, 3).join(', ')})`);
  if (hardcoded) { warn(`${hardcoded} texte(s) JSX en dur probable(s)`); samples.forEach((x) => console.log(`      ${x}`)); }
  console.log(`  clés : ${fr.size} (dont ui.* : ${[...fr.keys()].filter((k) => k.startsWith('ui.')).length})`);
}

console.log('\n[web ↔ mobile] clés partagées');
let shared = 0;
for (const [k, v] of dicts.web.fr) {
  if (!dicts.mobile.fr.has(k)) continue;
  shared++;
  if (dicts.mobile.fr.get(k) !== v) err(`texte français divergent pour ${k}`);
  else if (dicts.mobile.en.get(k) !== dicts.web.en.get(k)) err(`traduction anglaise divergente pour ${k}`);
}
console.log(`  ${shared} clé(s) commune(s)`);

console.log('\n[backend] src/shared/i18n/messages.en.js');
const { MESSAGES_EN } = await import(path.join(ROOT, 'backend/src/shared/i18n/messages.en.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const seen = new Set();
for (const [fr, en, ps = []] of MESSAGES_EN) {
  if (seen.has(fr)) err(`doublon : ${fr}`);
  seen.add(fr);
  if (!en || !en.trim()) err(`traduction vide : ${fr}`);
  for (const p of ps) if (!fr.includes(`{${p}}`) || !en.includes(`{${p}}`)) err(`paramètre ${p} incohérent : ${fr}`);
}
console.log(`  entrées : ${MESSAGES_EN.length}`);

console.log(`\n${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors ? 1 : 0);
