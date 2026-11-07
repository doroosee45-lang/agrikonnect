/**
 * Audit de conformité frontends ⇄ backend.
 *
 * Le backend peut être « vert » sur ses propres gates et rester incohérent avec
 * ses clients : il suffit qu'une page appelle un chemin que personne ne sert.
 * Ce script ferme cet angle mort.
 *
 * Méthode :
 *  1. relire la pile Express réelle (même parcours que check-mounts) ;
 *  2. extraire chaque appel `api.<verbe>('<chemin>')` des deux clients ;
 *  3. normaliser les template literals `${…}` en `:param` ;
 *  4. signaler tout appel sans route correspondante, et toute route non appelée.
 *
 * Usage : `npm run check:contract`  (ou `--verbose` pour la liste complète)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../src/app.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(root, '..');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/* ─── 1. Routes réellement montées ─── */
const join = (prefix, segment) => {
  const merged = `${prefix}/${segment}`.replace(/\/+/g, '/');
  return merged.length > 1 ? merged.replace(/\/$/, '') : merged;
};

const decodeMount = (source = '') =>
  source
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\/\?\(\?=\/\|\$\)$/, '')
    .replace(/\/\(\?=\/\|\$\)/, '')
    .replace(/\/\?$/, '')
    .replace(/\(\?:\.\*\)/, '');

const walk = (stack, prefix = '', routes = []) => {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = join(prefix, layer.route.path);
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled && METHODS.has(method)) routes.push({ method: method.toUpperCase(), path: routePath });
      }
      continue;
    }
    if (!layer.name || layer.name !== 'router' || !layer.handle?.stack) continue;
    walk(layer.handle.stack, join(prefix, decodeMount(layer.regexp?.source) ?? ''), routes);
  }
  return routes;
};

const app = createApp();
const BASE = '/api/v1';
const backend = new Set(
  walk(app._router.stack)
    .map((r) => `${r.method} ${r.path}`)
    // Les clients parlent en chemins relatifs à la base : on compare sans préfixe.
    .map((entry) => entry.replace(`${BASE}`, '') || entry),
);

/* ─── 2. Appels des clients ─── */
const CLIENTS = [
  { name: 'web', file: 'apps/web/src/services/endpoints.ts' },
  { name: 'mobile', file: 'apps/Mobile/src/services/api/endpoints.ts' },
];

/**
 * Extrait tous les appels `api.<verbe><Générique>('<chemin>')`.
 *
 * Un regex échoue ici : les génériques s'imbriquent sur deux niveaux
 * (`Array<Record<string, unknown>>`), donc on scanne `<` et `>` en comptant la
 * profondeur plutôt que de deviner leur forme.
 */
const extractCalls = (source) => {
  const out = [];
  const head = /api\.(get|post|put|patch|delete)\s*(<)?/g;
  let match;
  while ((match = head.exec(source)) !== null) {
    let cursor = head.lastIndex;
    if (match[2] === '<') {
      // Saute le générique en suivant l'imbrication réelle des chevrons.
      let depth = 1;
      while (cursor < source.length && depth > 0) {
        const char = source[cursor];
        if (char === '<') depth += 1;
        else if (char === '>') depth -= 1;
        cursor += 1;
      }
    }
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source[cursor] !== '(') continue;
    cursor += 1;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    const quote = source[cursor];
    if (quote !== "'" && quote !== '`') continue;
    const end = source.indexOf(quote, cursor + 1);
    if (end === -1) continue;
    out.push({ method: match[1].toUpperCase(), raw: source.slice(cursor + 1, end) });
    head.lastIndex = end;
  }
  return out;
};

/** `/orders/${id}/items` → `/orders/:param/items` (comparable à la route Express). */
const normalise = (raw) => raw.replace(/\$\{[^}]*\}/g, ':param').replace(/\/$/, '') || '/';

const calls = new Map(); // "VERBE /chemin" → Set(clients)
const unparsed = [];

for (const client of CLIENTS) {
  const file = path.join(repoRoot, client.file);
  if (!fs.existsSync(file)) {
    unparsed.push(`${client.name}: fichier absent (${client.file})`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  const found = extractCalls(source).filter((call) => call.raw.startsWith('/'));
  for (const call of found) {
    const key = `${call.method} ${normalise(call.raw)}`;
    if (!calls.has(key)) calls.set(key, new Set());
    calls.get(key).add(client.name);
  }
  const declared = (source.match(/api\.(get|post|put|patch|delete)\s*</g) || []).length;
  if (found.length < declared) unparsed.push(`${client.name}: ${declared - found.length} appel(s) non extraits`);
}

/* ─── 3. Diff ─── */
// Une route backend peut porter plusieurs segments dynamiques consécutifs ;
// on accepte aussi la correspondance « même nombre de segments » quand le
// client n'interpole qu'une partie des paramètres.
const segmentKey = (entry) => {
  const [method, routePath] = entry.split(' ');
  const segments = routePath.split('/').map((seg) => (seg.startsWith(':') ? ':p' : seg));
  return `${method} ${segments.join('/')}`;
};

const backendLoose = new Map();
for (const entry of backend) {
  const key = segmentKey(entry);
  if (!backendLoose.has(key)) backendLoose.set(key, entry);
}

const missing = [];
for (const [key, clients] of calls) {
  if (backend.has(key)) continue;
  if (backendLoose.has(segmentKey(key))) continue;
  missing.push({ key, clients: [...clients].sort().join('+') });
}

const called = new Set([...calls.keys()]);
const calledLoose = new Set([...calls.keys()].map(segmentKey));
const uncalled = [...backend].filter(
  (entry) => !called.has(entry) && !calledLoose.has(segmentKey(entry)),
);

/* ─── 4. Rapport ─── */
const verbose = process.argv.includes('--verbose');
const lines = [];
lines.push(`Routes backend            : ${backend.size}`);
lines.push(`Appels clients distincts  : ${calls.size}`);
lines.push(`Appels sans route         : ${missing.length}`);
lines.push(`Routes sans appel client  : ${uncalled.length}`);
if (unparsed.length) lines.push(`Extraction incomplète     : ${unparsed.join(' ; ')}`);

if (missing.length) {
  lines.push('');
  lines.push('❌ Appels clients sans route backend :');
  for (const item of missing) lines.push(`   ${item.key}  [${item.clients}]`);
}
if (verbose && uncalled.length) {
  lines.push('');
  lines.push('ℹ️  Routes backend jamais appelées par les clients :');
  for (const entry of uncalled.sort()) lines.push(`   ${entry}`);
}

console.log(lines.join('\n'));
process.exit(missing.length === 0 ? 0 : 1);
