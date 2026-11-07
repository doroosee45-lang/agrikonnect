import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const schema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const models = new Map();
const enumNames = new Set();

// modèles
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm)) {
  const [, name, body] = m;
  const fields = new Map();
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('///') || t.startsWith('//') || t.startsWith('@@')) continue;
    const f = t.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
    if (f) fields.set(f[1], { type: f[2], list: Boolean(f[3]), optional: Boolean(f[4]) });
  }
  models.set(name, fields);
}
for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) enumNames.add(m[1]);

/**
 * Clés composées générées par Prisma : `@@unique([a, b])` → `a_b`,
 * `@@id([a, b])` → `a_b`. Elles sont valides dans `where` sans être des champs.
 */
const compoundKeys = new Map();
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm)) {
  const [, name, body] = m;
  const keys = new Set();
  for (const u of body.matchAll(/@@(unique|id)\(\[([^\]]+)\]/g)) {
    const parts = u[2].split(',').map((p) => p.trim().split('(')[0].trim()).filter(Boolean);
    if (parts.length > 1) keys.add(parts.join('_'));
  }
  compoundKeys.set(name, keys);
}

const clientModelName = (model) => model[0].toLowerCase() + model.slice(1);

/**
 * Supprime les commentaires de ligne et de bloc hors chaînes, en conservant
 * la longueur : les indices restent alignés avec le source d'origine.
 *
 * Nécessaire car les commentaires français contiennent des apostrophes
 * (`l'annonce`) qui fausseraient la détection de chaînes.
 */
const stripComments = (src) => {
  const out = [...src];
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  let inString = false;
  let quote = '';

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];

    if (inString) {
      if (c === '\\') i += 1;
      else if (c === quote) inString = false;
      continue;
    }

    // Commentaire de ligne
    if (c === '/' && src[i + 1] === '/') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j += 1;
      blank(i, j);
      i = j;
      continue;
    }

    // Commentaire de bloc
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j === -1 ? src.length : j + 2;
      blank(i, end);
      i = end;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      quote = c;
    }
  }

  return out.join('');
};

/** Profondeur de parenthèses/accolades à un index donné. */
const depthAt = (str, index) => {
  let depth = 0;
  for (let i = 0; i < index; i += 1) {
    const c = str[i];
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') depth -= 1;
  }
  return depth;
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return walk(p);
  return d.name.endsWith('.js') ? [p] : [];
});

const files = walk(fileURLToPath(new URL('../src', import.meta.url)));
const problems = [];
const SOFT_SKIP = new Set(['AND','OR','NOT','contains','mode','in','gte','lte','gt','lt','not','has','hasEvery','hasSome','equals','startsWith','endsWith','some','every','none','is','isNot','increment','decrement','push','set','create','connect','update','upsert','delete','deleteMany','updateMany','createMany','skip','take','orderBy','select','include','distinct','cursor','_count','_avg','_sum','_max','_min','by','id','connectOrCreate','data','where','createManyAndReturn']);

// brace matching from index of '('
const argText = (src, startParen) => {
  let depth = 0;
  for (let i = startParen; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(startParen + 1, i); }
  }
  return null;
};

// extract top-level segments of an object literal starting at index of '{'
const topSegments = (src, startBrace) => {
  const segments = [];
  let depth = 1;
  let i = startBrace + 1;
  let current = '';
  let currentStart = startBrace + 1;
  let inString = false;
  let quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === quote && src[i - 1] !== '\\') inString = false;
      current += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; quote = c; current += c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) { segments.push({ text: current, start: currentStart }); return segments; }
    } else if (c === ',' && depth === 1) {
      segments.push({ text: current, start: currentStart });
      current = '';
      currentStart = i + 1;
      continue;
    }
    if (depth >= 1) current += c;
  }
  return segments;
};

const topKeys = (src, startBrace) => {
  const keys = [];
  let depth = 1;
  let i = startBrace + 1;
  let current = '';
  let inString = false;
  let quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === quote && src[i - 1] !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; quote = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) { keys.push(current.trim()); return keys; }
    } else if (c === ',' && depth === 1) {
      keys.push(current.trim());
      current = '';
      continue;
    }
    if (depth >= 1) current += c;
  }
  return keys;
};

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/prisma\.(\w+)\.(create|createMany|update|updateMany|upsert|findFirst|findMany|findUnique|count|groupBy|aggregate|delete|deleteMany)\(/g)) {
    const [, clientName, method] = m;
    const known = [...models.keys()].find((k) => clientModelName(k) === clientName);
    if (!known) {
      problems.push(`${file}: prisma.${clientName} — modèle inexistant`);
      continue;
    }
    const fields = models.get(known);
    const parenIndex = m.index + m[0].length - 1;
    const args = argText(src, parenIndex);
    if (!args) continue;

    // data / create blocks (premier niveau des arguments uniquement)
    for (const block of args.matchAll(/\b(data|create)\s*:\s*\{/g)) {
      if (depthAt(args, block.index) !== 1) continue;
      const braceIndex = parenIndex + 1 + block.index + block[0].length - 1;
      for (const key of topKeys(src, braceIndex)) {
        const k = key.split(':')[0].trim();
        if (!k || k.startsWith('...') || SOFT_SKIP.has(k)) continue;
        if (!fields.has(k)) problems.push(`${file}: ${known}.${method} data clé inconnue « ${k} »`);
      }
    }

    // select / include / orderBy (uniquement au premier niveau des arguments)
    for (const key of ['select', 'include', 'orderBy']) {
      for (const block of args.matchAll(new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g'))) {
        if (depthAt(args, block.index) !== 1) continue;
        const braceIndex = parenIndex + 1 + block.index + block[0].length - 1;
        for (const seg of topSegments(src, braceIndex)) {
          const k = seg.text.split(':')[0].trim();
          if (!k || k.startsWith('...') || SOFT_SKIP.has(k)) continue;
          if (!fields.has(k)) problems.push(`${file}: ${known}.${method} ${key} clé inconnue « ${k} »`);
        }
      }
    }

    // where keys (only top-level scalars)
    for (const block of args.matchAll(/\bwhere\s*:\s*\{/g)) {
      // Un `where` imbriqué (dans `include`, `some`, `every`…) porte sur un
      // autre modèle : il n'est pas vérifiable ici.
      if (depthAt(args, block.index) !== 1) continue;
      const braceIndex = parenIndex + 1 + block.index + block[0].length - 1;
      for (const key of topKeys(src, braceIndex)) {
        const k = key.split(':')[0].trim();
        if (!k || k.startsWith('...') || SOFT_SKIP.has(k)) continue;
        if (fields.has(k) || enumNames.has(k)) continue;
        if (compoundKeys.get(known)?.has(k)) continue;
        problems.push(`${file}: ${known}.${method} where clé inconnue « ${k} »`);
      }
    }
  }
}

const unique = [...new Set(problems)];
console.log(`Fichiers analysés : ${files.length}`);
console.log(`Modèles : ${models.size}`);
console.log(`Problèmes détectés : ${unique.length}`);
for (const p of unique) console.log(' -', p);
if (unique.length > 0) process.exitCode = 1;
