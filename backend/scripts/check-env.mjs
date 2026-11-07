#!/usr/bin/env node
/**
 * Contrôle de cohérence de la configuration.
 *
 * Deux écarts sont recherchés, tous deux bloquants :
 *   1. une variable lue par `src/` mais absente de `.env.example`
 *      → l'exploitant ne peut pas savoir qu'elle existe (défaut silencieux) ;
 *   2. une variable documentée dans `.env.example` mais jamais lue
 *      → documentation mensongère.
 *
 * Usage : node scripts/check-env.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const ENV_FILE = join(ROOT, '.env.example');

/** Variables ignorées : fournies par le runtime, pas par l'exploitant. */
const RUNTIME = new Set(['NODE_ENV', 'PATH', 'PWD', 'HOME', 'TZ']);

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, acc);
    } else if (/\.(js|mjs)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const read = new Map(); // NAME → Set(fichiers)
for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const names = new Set([
    ...[...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]),
    ...[...source.matchAll(/process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]/g)].map((m) => m[1]),
  ]);
  for (const name of names) {
    if (RUNTIME.has(name)) continue;
    if (!read.has(name)) read.set(name, new Set());
    read.get(name).add(relative(ROOT, file));
  }
}

/** Clés déclarées dans le schéma Zod de `src/config/env.js`. */
const envSchema = readFileSync(join(SRC, 'config', 'env.js'), 'utf8');
const schemaKeys = new Set(
  [...envSchema.matchAll(/^\s{2}([A-Z0-9_]+)\s*:/gm)].map((m) => m[1])
);

const documented = new Set(
  [...readFileSync(ENV_FILE, 'utf8').matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1])
);

const undocumented = [...read.keys()]
  .filter((name) => !documented.has(name))
  .sort()
  .map((name) => ({ name, files: [...read.get(name)].sort() }));

const stale = [...documented]
  .filter((name) => !read.has(name) && !schemaKeys.has(name) && !RUNTIME.has(name))
  .sort();

const problems = undocumented.length + stale.length;

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        lues: read.size,
        documentees: documented.size,
        schema: schemaKeys.size,
        nonDocumentees: undocumented,
        obsoletes: stale,
        problemes: problems,
      },
      null,
      2
    )
  );
} else {
  console.log(`Variables lues par src/      : ${read.size}`);
  console.log(`Variables dans .env.example  : ${documented.size}`);
  console.log(`Clés du schéma config/env.js : ${schemaKeys.size}`);
  if (undocumented.length) {
    console.log(`\n❌ Non documentées dans .env.example :`);
    for (const { name, files } of undocumented) {
      console.log(`   ${name} → ${files.join(', ')}`);
    }
  }
  if (stale.length) {
    console.log(`\n❌ Documentées mais jamais lues : ${stale.join(', ')}`);
  }
  console.log(
    problems === 0
      ? `\nAucun écart : toute variable utilisée est documentée, toute variable documentée est utilisée.`
      : `\n${problems} écart(s) de configuration.`
  );
}

process.exit(problems === 0 ? 0 : 1);
