#!/usr/bin/env node
/**
 * Test de fumée HTTP : aucune route du contrat OpenAPI ne doit être « fantôme ».
 *
 * L'application réelle est démarrée en mémoire, puis chaque opération publiée
 * dans `src/docs/openapi.json` est appelée une fois. Aucune donnée n'est
 * attendue : sans base de données, les contrôleurs échouent (401 non
 * authentifié, 422 paramètre invalide, 500 accès base). Le seul résultat
 * bloquant est une réponse **« Route introuvable »**, qui prouverait qu'une
 * opération documentée n'est pas réellement montée.
 *
 * Usage : node scripts/smoke-http.mjs [--port 4099] [--verbose]
 */
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';

const portIndex = process.argv.indexOf('--port');
const PORT = portIndex === -1 ? 4099 : Number(process.argv[portIndex + 1] ?? 4099);
const VERBOSE = process.argv.includes('--verbose');
const PLACEHOLDER = '01JSMOKETEST000000000000AB';

const doc = JSON.parse(
  readFileSync(new URL('../src/docs/openapi.json', import.meta.url), 'utf8')
);

const server = createApp().listen(PORT, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${PORT}`;

const phantoms = [];
const byStatus = new Map();
let total = 0;

const call = async (method, path) => {
  const url = `${base}${path.replace(/\{[^}]+\}/g, PLACEHOLDER)}`;
  const hasBody = ['post', 'put', 'patch'].includes(method);
  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers: hasBody ? { 'content-type': 'application/json' } : {},
    body: hasBody ? '{}' : undefined,
    redirect: 'manual',
  });
  let message = '';
  try {
    message = (await response.json())?.message ?? '';
  } catch {
    /* réponse non-JSON : peu importe ici */
  }
  return { status: response.status, message };
};

for (const [path, operations] of Object.entries(doc.paths)) {
  for (const method of Object.keys(operations)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    total += 1;
    const { status, message } = await call(method, path);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status === 404 && /Route introuvable/.test(message)) {
      phantoms.push(`${method.toUpperCase()} ${path}`);
    }
    if (VERBOSE) console.log(`${method.toUpperCase().padEnd(6)} ${status}  ${path}`);
  }
}

server.close();

console.log(`Opérations du contrat appelées : ${total}`);
console.log(
  `Réponses par statut            : ${[...byStatus.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([status, count]) => `${status}×${count}`)
    .join(' · ')}`
);
if (phantoms.length) {
  console.log(`\n❌ ${phantoms.length} route(s) fantôme(s) :`);
  for (const phantom of phantoms) console.log(`   ${phantom}`);
  process.exit(1);
}
console.log(`\nAucune route fantôme : chaque opération documentée atteint un contrôleur.`);
process.exit(0);
