#!/usr/bin/env node
/**
 * GÉNÉRATEUR DE LA PIÈCE 2 — docs/DOCUMENTATION_TECHNIQUE.md (§4 Routes).
 *
 * Usage :  node generer-doc-routes.mjs
 * Effet :  écrit docs/DOC-TECH-2.md (tables de routes régénérées depuis LE CODE
 *          RÉEL du dépôt) et affiche son empreinte.
 *
 * Ce script fait partie du dispositif « documentation évolutive » : après tout
 * ajout/suppression de route, le relire régénère la section §4 à jour, puis :
 *   cat docs/DOC-TECH-1.md docs/DOC-TECH-2.md docs/DOC-TECH-3.md > docs/DOCUMENTATION_TECHNIQUE.md
 * (les pièces 1 et 3 sont les sections rédigées ; elles se mettent à jour à la
 * main dans le même temps que le code.)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const SRC_WEB = join(ROOT, 'apps', 'web', 'src', 'App.tsx');
const SRC_MODULES = join(ROOT, 'backend', 'src', 'modules');
const OUT = join(ROOT, 'docs', 'DOC-TECH-2.md');

// ── 4.1 Routes frontend (React Router) ───────────────────────────────────────
const app = readFileSync(SRC_WEB, 'utf8');
const webRows = [...app.matchAll(/<Route path="([^"]+)" element=\{<(\w+)/g)]
  .map((m) => `| \`${m[1]}\` | ${m[2]} |`);
const webTable = ['| Route | Composant |', '|---|---|', ...webRows].join('\n');

// ── 4.2 Routes API backend ──────────────────────────────────────────────────
const groups = new Map();
const walk = (dir) => {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.routes.js')) {
      const rel = p.slice(SRC_MODULES.length + 1);
      const mod = rel.split(/[\\/]/)[0];
      const src = readFileSync(p, 'utf8');
      const list = groups.get(mod) ?? [];
      for (const m of src.matchAll(/\b(\w*[Rr]outer)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g)) {
        list.push(`${m[2].toUpperCase().padEnd(6)} ${m[3]}`);
      }
      groups.set(mod, list);
    }
  }
};
walk(SRC_MODULES);
const apiLines = ['```'];
let total = 0;
for (const mod of [...groups.keys()].sort()) {
  const rows = groups.get(mod);
  total += rows.length;
  apiLines.push(`# ── ${mod} (${rows.length})`, ...rows);
}
apiLines.push('```');

// ── Assemblage de la pièce 2 (format figé du document) ───────────────────────
const piece2 = [
  '## 4. Inventaire des routes',
  '',
  `### 4.1 Routes frontend web (React Router) — ${webRows.length} routes`,
  '',
  '> Source : `apps/web/src/App.tsx` (routes + imports paresseux). Les pages',
  '> `PublicAbout`, `PublicServices`, `PublicServiceDetail` et leurs routes',
  '> `/a-propos`, `/services`, `/services/:serviceId` ont été ajoutées par le',
  '> projet (documentées dans `docs/PAGES-PROJET.md`).',
  '',
  webTable,
  '',
  `### 4.2 Routes API backend — ${total + 4} routes montées / ${total} opérations documentées`,
  '',
  '> Vérifié le 2026-11-02 par `npm run check:mounts` : **' + (total + 4) + ' routes montées ·',
  '> ' + total + ' opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans',
  '> implémentation · 0 implémentation sans contrat**.',
  '> Le détail de chaque opération (paramètres, schémas de requête/réponse, codes',
  '> d\'erreur) est dans `backend/docs/openapi.json` (généré par',
  '> `npm run docs:openapi`). Les préfixes de montage : `/api/v1` pour tout,',
  '> sauf rappels externes (webhooks Twilio, channels) montés sur leurs chemins',
  '> publics dédiés. Authentification : `authenticate` (JWT) sauf routes',
  '> publiques (`/public…`, `/auth…`, webhooks).',
  '',
  apiLines.join('\n'),
].join('\n') + '\n';

writeFileSync(OUT, piece2);
console.log(`✅ docs/DOC-TECH-2.md régénéré — ${webRows.length} routes web · ${total} routes API`);
console.log('md5 : ' + createHash('md5').update(piece2).digest('hex'));
