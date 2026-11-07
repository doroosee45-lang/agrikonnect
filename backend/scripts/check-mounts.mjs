/**
 * Audit de montage des routes.
 *
 * Trois défauts silencieux sont détectés, tous déjà rencontrés en pratique :
 *  1. **route fantôme** : un chemin déclaré dans un routeur ne correspond à aucune
 *     URL réelle (préfixe dupliqué, routeur monté au mauvais endroit) ;
 *  2. **collision** : deux handlers pour le même couple (méthode, chemin) — le
 *     second n'est jamais atteint ;
 *  3. **écart de contrat** : une opération du contrat OpenAPI n'existe pas dans
 *     l'application, ou une route de l'application n'est pas documentée.
 *
 * Usage : `npm run check:mounts`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../src/app.js';

const root = fileURLToPath(new URL('..', import.meta.url));

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

const join = (prefix, segment) => {
  const merged = `${prefix}/${segment}`.replace(/\/+/g, '/');
  return merged.length > 1 ? merged.replace(/\/$/, '') : merged;
};

/** Retrouve le chemin de montage à partir de la regexp interne d'Express. */
const decodeMount = (source = '') =>
  source
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\/\?\(\?=\/\|\$\)$/, '')
    .replace(/\/\(\?=\/\|\$\)/, '')
    .replace(/\/\?$/, '')
    .replace(/\(\?:\.\*\)/, '');

/** Parcourt la pile Express et renvoie toutes les routes réellement atteignables. */
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

    // Express conserve le chemin de montage dans une regexp : on relit le source
    // du routeur pour retrouver le préfixe exact (y compris les montages `use`).
    const mount = decodeMount(layer.regexp?.source);
    walk(layer.handle.stack, join(prefix, mount ?? ''), routes);
  }
  return routes;
};

const app = createApp();
const routes = walk(app._router.stack);
const unique = new Map();
const collisions = [];
for (const route of routes) {
  const key = `${route.method} ${route.path}`;
  if (unique.has(key)) collisions.push(key);
  else unique.set(key, route);
}

/* ─── Contrat OpenAPI ─── */
const openapiPath = path.join(root, 'src/docs/openapi.json');
const openapi = fs.existsSync(openapiPath) ? JSON.parse(fs.readFileSync(openapiPath, 'utf8')) : { paths: {} };
const documented = new Set();
for (const [routePath, operations] of Object.entries(openapi.paths)) {
  for (const method of Object.keys(operations)) {
    if (METHODS.has(method)) documented.add(`${method.toUpperCase()} ${routePath}`);
  }
}

const normalise = (routePath) => routePath.replace(/\{([^}]+)\}/g, ':$1').replace(/\/$/, '') || '/';
const documentedSet = new Set([...documented].map((entry) => {
  const [method, routePath] = entry.split(' ');
  return `${method} ${normalise(routePath)}`;
}));

// Routes d'infrastructure servies par `app.js` (accueil, santé, documentation) :
// elles ne relèvent pas d'un module métier et n'ont donc pas de contrat OpenAPI.
const INFRASTRUCTURE = new Set([
  'GET /api/v1',
  'GET /api/v1/health',
  'GET /api/v1/docs',
  'GET /api/v1/docs/openapi.json',
  'GET /',
  'GET /health',
]);

const implemented = new Set([...unique.keys()]);
const missingInApp = [...documentedSet].filter((entry) => !implemented.has(entry));
const missingInContract = [...implemented].filter((entry) => !documentedSet.has(entry) && !INFRASTRUCTURE.has(entry));

/* ─── Rapport ─── */
if (process.argv.includes('--dump')) {
  console.log(JSON.stringify({ implemented: [...implemented].sort(), documented: [...documentedSet].sort(), collisions }, null, 2));
  process.exit(0);
}

const report = [];
report.push(`Routes montées : ${implemented.size}`);
report.push(`Opérations documentées : ${documentedSet.size}`);
report.push(`Collisions (méthode + chemin) : ${collisions.length}${collisions.length ? ` → ${collisions.slice(0, 5).join(', ')}` : ''}`);
report.push(`Contrat sans implémentation : ${missingInApp.length}${missingInApp.length ? ` → ${missingInApp.slice(0, 5).join(', ')}` : ''}`);
report.push(`Implémentation sans contrat : ${missingInContract.length}${missingInContract.length ? ` → ${missingInContract.slice(0, 5).join(', ')}` : ''}`);
console.log(report.join('\n'));

const failures = collisions.length + missingInApp.length;
process.exit(failures === 0 ? 0 : 1);
