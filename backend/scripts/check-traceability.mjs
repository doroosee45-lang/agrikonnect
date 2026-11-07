import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vérificateur de traçabilité CDC → code.
 *
 * Pour chaque famille d'exigences du cahier des charges (V1 → V5), il vérifie
 * qu'il existe :
 *   1. un module serveur (service + routes) ;
 *   2. au moins une route HTTP exposée ;
 *   3. une permission RBAC associée ;
 *   4. une preuve de test (fichier de test citant la famille).
 *
 * Le script échoue (code 1) si une exigence déclarée n'a aucune surface HTTP :
 * c'est la garantie qu'aucune famille du CDC n'est « documentée mais absente ».
 *
 * Usage : `npm run check:trace` (ajouter `--json` pour la sortie machine).
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

/**
 * Catalogue des familles d'exigences, tel que découpé par le CDC (v2.0, 18/09/2026).
 *
 * - `module` : dossier de `src/modules` qui porte l'exigence ;
 * - `perm` : préfixe de permission attendu (vérifié dans `shared/permissions.js`) ;
 * - `mount` : préfixe d'URL attendu (vérifié dans `src/routes/index.js`).
 */
const REQUIREMENTS = [
  // ─── V1 — FARM ────────────────────────────────────────────────────────────
  { family: 'AUTH', version: 'V1', title: 'Inscription, connexion, OTP, jetons, réinitialisation', module: 'auth', perm: null, mount: '/auth', count: 7 },
  { family: 'PROF', version: 'V1', title: 'Profil utilisateur et préférences', module: 'users', perm: null, mount: '/me', count: 4 },
  { family: 'FARM', version: 'V1', title: 'Exploitations agricoles', module: 'farms', perm: 'farms', mount: '/farms', count: 4 },
  { family: 'PLOT', version: 'V1', title: 'Parcelles et historique cultural', module: 'plots', perm: 'plots', mount: '/plots', count: 5 },
  { family: 'CROP', version: 'V1', title: 'Référentiel des cultures', module: 'crops', perm: 'crops', mount: '/crops', count: 3 },
  { family: 'PROD', version: 'V1', title: 'Productions et rendements', module: 'productions', perm: 'productions', mount: '/productions', count: 4 },
  { family: 'COOP', version: 'V1', title: 'Coopératives et consentement des membres', module: 'cooperatives', perm: 'cooperatives', mount: '/cooperatives', count: 5 },
  { family: 'PUB', version: 'V1', title: 'Profils publics et annuaire', module: 'public', perm: null, mount: '/public', count: 6 },
  { family: 'MAP', version: 'V1', title: 'Cartographie publique (bbox, arrondi des coordonnées)', module: 'public', perm: null, mount: '/public', count: 4 },
  { family: 'VER', version: 'V1', title: 'Vérification des exploitations', module: 'verification', perm: 'verifications', mount: '/verifications', count: 5 },
  { family: 'SOIL', version: 'V1', title: 'Socle Soil S1 (relevés, sans recommandation automatique)', module: 'soil', perm: 'soil', mount: '/plots', count: 3 },

  // ─── V2 — MARKET ──────────────────────────────────────────────────────────
  { family: 'MKT', version: 'V2', title: 'Annonces marketplace et modération', module: 'market/listings', perm: 'listings', mount: '/listings', count: 6 },
  { family: 'REQ', version: 'V2', title: 'Demandes d\'achat et matching explicable', module: 'market/requests', perm: 'requests', mount: '/purchase-requests', count: 5 },
  { family: 'OFF', version: 'V2', title: 'Offres chiffrées et datées', module: 'market/offers', perm: 'offers', mount: '/market', count: 4 },
  { family: 'ORD', version: 'V2', title: 'Commandes, machine à états, journal', module: 'market/orders', perm: 'orders', mount: '/orders', count: 5 },
  { family: 'STK', version: 'V2', title: 'Stock dérivé du journal de mouvements', module: 'market/inventory', perm: 'inventory', mount: '/inventory', count: 2 },
  { family: 'TRA', version: 'V2', title: 'Transport, suivi et preuve de livraison', module: 'transport', perm: 'transport', mount: '/transport', count: 3 },
  { family: 'MSG', version: 'V2', title: 'Messagerie rattachée à un objet métier', module: 'messaging', perm: 'messages', mount: '/messaging', count: 4 },
  { family: 'NOTIF', version: 'V2', title: 'Notifications et préférences par canal', module: 'notifications', perm: 'notifications', mount: '/notifications', count: 4 },
  { family: 'BIL', version: 'V2', title: 'Facturation déclarative, numérotation, devises', module: 'billing', perm: 'invoices', mount: '/billing', count: 4 },
  { family: 'REV', version: 'V2', title: 'Avis et réputation après livraison', module: 'market/reviews', perm: 'reviews', mount: '/reviews', count: 3 },
  { family: 'DISP', version: 'V2', title: 'Litiges et décision de modération', module: 'market/orders', perm: 'disputes', mount: '/orders', count: 2 },
  { family: 'MOD', version: 'V2', title: 'Modération (annonces, avis, messages)', module: 'market/listings', perm: 'listings.moderate', mount: '/listings', count: 2 },
  { family: 'SOIL2', version: 'V2', title: 'S2 — règles agronomiques, compatibilité, rotation, plan', module: 'soil', perm: 'rules', mount: '/admin', count: 6 },
  { family: 'COOPG', version: 'V2', title: 'COOP-10 — offre groupée et répartition traçable', module: 'cooperatives', perm: 'cooperatives', mount: '/cooperatives', count: 1 },

  // ─── V3 — INTELLIGENCE ────────────────────────────────────────────────────
  { family: 'SYNC', version: 'V3', title: 'Synchronisation hors-ligne idempotente', module: 'sync', perm: 'sync', mount: '/sync', count: 5 },
  { family: 'SOIL3', version: 'V3', title: 'S3 — fusion des sources, profil de sol, rendement', module: 'soil', perm: 'soil', mount: '/plots', count: 5 },
  { family: 'USSD', version: 'V3', title: 'USSD-01 — canal vocal/texte pas à pas', module: 'channels', perm: 'channels', mount: '/channels', count: 1 },
  { family: 'WA', version: 'V3', title: 'WA-01 — webhook WhatsApp signé', module: 'channels', perm: 'channels', mount: '/channels', count: 1 },
  { family: 'AI', version: 'V3', title: 'Analyses IA encadrées (consentement, avertissement, escalade)', module: 'ai', perm: 'ai', mount: '/ai', count: 6 },
  { family: 'WEA', version: 'V3', title: 'Météo datée et sourcée', module: 'weather', perm: 'weather', mount: '/weather', count: 3 },
  { family: 'PRI', version: 'V3', title: 'Prix de marché datés et sourcés', module: 'prices', perm: 'prices', mount: '/prices', count: 3 },
  { family: 'TRACE', aliases: ['LOT'], version: 'V3', title: 'Traçabilité des lots et vue publique QR', module: 'traceability', perm: 'lots', mount: '/lots', count: 5 },
  { family: 'CERT', version: 'V3', title: 'Certifications vérifiées, avec échéance', module: 'certifications', perm: 'certifications', mount: '/certifications', count: 4 },
  { family: 'IOT', version: 'V3', title: 'Objets connectés, clés révocables, seuils', module: 'iot', perm: 'iot', mount: '/iot', count: 4 },
  { family: 'GEO', version: 'V3', title: 'Satellite, drone, laboratoire rattachés à la parcelle', module: 'geodata', perm: 'geodata', mount: '/geodata', count: 4 },

  // ─── V4 — INVEST ──────────────────────────────────────────────────────────
  { family: 'PRJ', version: 'V4', title: 'Projets avec provenance par champ', module: 'projects', perm: 'projects', mount: '/projects', count: 5 },
  { family: 'DR', version: 'V4', title: 'Data room fermée par défaut, journal d\'accès', module: 'dataroom', perm: 'dataroom', mount: '/dataroom', count: 4 },
  { family: 'DD', version: 'V4', title: 'Due diligence et professionnels', module: 'duediligence', perm: 'duediligence', mount: '/projects', count: 4 },
  { family: 'RPT', aliases: ['REP'], version: 'V4', title: 'Rapports d\'avancement et d\'impact', module: 'reporting', perm: 'reporting', mount: '/projects', count: 3 },
  { family: 'FUND', version: 'V4', title: 'Demandes de financement avec consentement', module: 'funding', perm: 'funding', mount: '/funding', count: 3 },
  { family: 'INV', version: 'V4', title: 'Profils investisseurs vérifiés et MFA', module: 'investors', perm: 'investors', mount: '/investors', count: 3 },
  { family: 'INVH', version: 'V4', title: 'INV-02/03 — exploration, suivi, matching sans score', module: 'investors', perm: 'investors', mount: '/investment', count: 2 },
  { family: 'MFA', version: 'V4', title: 'NFR-01 — MFA TOTP obligatoire', module: 'auth', perm: null, mount: '/auth', count: 1 },
  { family: 'PREC', aliases: ['PRE'], version: 'V4', title: 'Zones de gestion et rapports de précision versionnés', module: 'precision', perm: 'precision', mount: '/precision', count: 3 },

  // ─── V5 — GLOBAL ──────────────────────────────────────────────────────────
  { family: 'TND', aliases: ['TEN'], version: 'V5', title: 'Appels d\'offres et réponses', module: 'tenders', perm: 'tenders', mount: '/tenders', count: 4 },
  { family: 'EXP', version: 'V5', title: 'Ordres d\'export (Incoterms, documents, devises)', module: 'exports', perm: 'export', mount: '/exports', count: 4 },
  { family: 'API', version: 'V5', title: 'Clients API, clés hachées, quota et journal', module: 'apiclients', perm: 'apiclients', mount: '/api-clients', count: 4 },
  { family: 'DATA', version: 'V5', title: 'Produits de données, k-anonymat, contrats', module: 'dataproducts', perm: 'data', mount: '/data', count: 4 },
  { family: 'INS', version: 'V5', title: 'Observatoire pays (agrégats sourcés)', module: 'insights', perm: 'insights', mount: '/insights', count: 3 },
  { family: 'SOIL5', version: 'V5', title: 'S5 — statistiques de sol agrégées, k-anonymat ≥ 10', module: 'public', perm: 'soil', mount: '/public', count: 2 },
  { family: 'GLB', version: 'V5', title: 'Référentiels globaux (pays, devises, taux)', module: 'countries', perm: 'countries', mount: '/countries', count: 3 },
  { family: 'FX', version: 'V5', title: 'Taux de change datés et sourcés', module: 'countries', perm: 'fx', mount: '/countries', count: 2 },
];

/** Extrait les routes (méthode + chemin) d'un fichier de routes, avec le préfixe de montage. */
const extractRoutes = (source, mount, prefix = '') => {
  const routes = [];
  const pattern = /router\.(get|post|patch|put|delete)\(\s*'([^']*)'/g;

  for (const match of source.matchAll(pattern)) {
    routes.push(`${match[1].toUpperCase()} ${mount}${prefix}${match[2] === '/' ? '' : match[2]}`);
  }

  // Sous-routeurs montés à l'intérieur du module (ex. public.routes.js)
  for (const match of source.matchAll(/router\.use\(\s*'([^']*)'\s*,\s*(\w+)/g)) {
    routes.push(`MOUNT ${mount}${match[1]} → ${match[2]}`);
  }

  return routes;
};

/** Parcours récursif d'un dossier de module. */
const moduleFiles = (relative) => {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return moduleFiles(child);
    return entry.name.endsWith('.js') ? [child] : [];
  });
};

/**
 * Routeurs montés à la racine (`router.use('/', x)`) et segments qu'ils servent.
 *
 * Certains modules déclarent des chemins absolus (`/orders/:id/reviews`,
 * `/projects/:id/due-diligence`…) et sont donc montés sur `/` avec une
 * authentification par préfixe. Sans cela, le détecteur les croyait non montés.
 */
const rootMountedSegments = () => {
  const segments = new Set();
  const mounts = [...routerIndexSource.matchAll(/router\.use\(\s*'(\/?)'\s*,\s*(\w+)\s*\)/g)];

  for (const [, prefix, variable] of mounts) {
    if (prefix !== '/') continue;
    const file = [...routerIndexSource.matchAll(new RegExp(`import\\s+${variable}\\s+from\\s+'([^']+)'`, 'g'))];
    if (file.length === 0) continue;
    const source = read(path.posix.join('src/routes', file[0][1]));
    for (const match of source.matchAll(/router\.(?:get|post|patch|put|delete)\(\s*'\/([\w-]+)/g)) {
      segments.add(match[1]);
    }
  }
  return segments;
};

const permissionsSource = read('src/shared/permissions.js');
const routerIndex = read('src/routes/index.js');
const routerIndexSource = routerIndex;

const testFiles = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((file) => file.endsWith('.mjs'))
  .map((file) => ({ file, source: read(`tests/${file}`) }));

const results = REQUIREMENTS.map((requirement) => {
  const files = moduleFiles(`src/modules/${requirement.module}`);
  const routeFiles = files.filter((file) => file.endsWith('.routes.js'));

  const routes = routeFiles.flatMap((file) => extractRoutes(read(file), requirement.mount));
  const permPatterns = (Array.isArray(requirement.perm) ? requirement.perm : [requirement.perm ?? '__none__']).map(
    (prefix) => (prefix.includes('.') ? `'${prefix}'` : `'${prefix}\\.[a-z]+'`),
  );
  const permissions = permPatterns
    .flatMap((pattern) => [...permissionsSource.matchAll(new RegExp(pattern, 'g'))])
    .map((match) => match[0].replace(/'/g, ''));

  const rootSegments = rootMountedSegments();
  const mounted = requirement.mount
    .split('/')
    .filter(Boolean)
    .every(
      (segment) =>
        routerIndex.includes(`'/${segment}`) ||
        routerIndex.includes(`/${segment}'`) ||
        rootSegments.has(segment),
    );

  const labels = [requirement.family, ...(requirement.aliases ?? [])];
  const tests = testFiles
    .filter(({ source }) => labels.some((label) => source.includes(`${label}-0`)))
    .map(({ file }) => file);

  const gaps = [];
  if (files.length === 0) gaps.push('module absent');
  if (routeFiles.length === 0) gaps.push('aucun fichier de routes');
  if (routes.length === 0) gaps.push('aucune route HTTP');
  if (!mounted) gaps.push(`non monté sur ${requirement.mount}`);
  if (requirement.perm && permissions.length === 0) gaps.push(`permission ${requirement.perm}.* absente`);
  if (tests.length === 0) gaps.push('aucune preuve de test');

  return { ...requirement, files: files.length, routes, permissions: permissions.length, tests, gaps };
});

const json = process.argv.includes('--json');
const markdown = process.argv.includes('--md');

if (json) {
  console.log(JSON.stringify({ requirements: results }, null, 2));
  process.exit(results.some((r) => r.gaps.length > 0) ? 1 : 0);
}

/**
 * Sortie Markdown : écrit `docs/TRACEABILITY.md` (matrice lisible par un tiers,
 * y compris un auditeur qui ne lit pas le code).
 */
if (markdown) {
  const lines = [
    '# Matrice de traçabilité — CDC v2.0 → code',
    '',
    '> Généré par `npm run docs:traceability` à partir de `scripts/check-traceability.mjs`.',
    '> Le script échoue si une famille d’exigences n’a **ni** module, **ni** route, **ni** permission, **ni** test.',
    '',
  ];

  let total = 0;
  let covered = 0;

  for (const [version, entries] of Object.entries(
    results.reduce((acc, result) => {
      (acc[result.version] = acc[result.version] ?? []).push(result);
      return acc;
    }, {}),
  )) {
    lines.push(`## ${version}`, '', '| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |', '|---|---|---|---|---|---|---|');

    for (const entry of entries) {
      const first = `${entry.family}-01`;
      const last = `${entry.family}-${String(entry.count).padStart(2, '0')}`;
      total += entry.count;
      if (entry.gaps.length === 0) covered += entry.count;
      lines.push(
        `| **${entry.family}** | ${entry.count > 1 ? `${first} → ${last}` : first} | ${entry.title} | ${entry.routes.filter((r) => !r.startsWith('MOUNT')).length} | ${entry.permissions} | ${entry.tests.length} | ${entry.gaps.length === 0 ? '✅' : `⚠️ ${entry.gaps.join(', ')}`} |`,
      );
    }
    lines.push('');
  }

  lines.push('---', '', `**Couverture : ${covered}/${total} exigences** (familles complètes).`, '');
  lines.push('## Détail des routes par famille', '');

  for (const entry of results) {
    lines.push(`### ${entry.family} — ${entry.title}`, '');
    const routes = entry.routes.filter((route) => !route.startsWith('MOUNT'));
    if (routes.length === 0) lines.push('_Aucune route._');
    else routes.forEach((route) => lines.push(`- \`${route}\``));
    if (entry.tests.length > 0) lines.push('', `Tests : ${entry.tests.map((file) => `\`tests/${file}\``).join(', ')}`);
    lines.push('');
  }

  fs.writeFileSync(path.join(root, 'docs/TRACEABILITY.md'), lines.join('\n'));
  console.log(`Matrice écrite : docs/TRACEABILITY.md (${covered}/${total} exigences)`);
  process.exit(results.some((result) => result.gaps.length > 0) ? 1 : 0);
}

const byVersion = results.reduce((acc, result) => {
  acc[result.version] = acc[result.version] ?? [];
  acc[result.version].push(result);
  return acc;
}, {});

const badge = (gaps) => (gaps.length === 0 ? '✅' : '⚠️');

console.log('Traçabilité CDC → code\n');

let totalIds = 0;
let coveredIds = 0;

for (const [version, entries] of Object.entries(byVersion)) {
  console.log(`## ${version}`);
  console.log('| Famille | Exigences | Intitulé | Routes | Permissions | Tests | État |');
  console.log('|---|---|---|---|---|---|---|');

  for (const entry of entries) {
    const ids = Array.from({ length: entry.count }, (_, index) => `${entry.family}-${String(index + 1).padStart(2, '0')}`);
    totalIds += entry.count;
    if (entry.gaps.length === 0) coveredIds += entry.count;

    console.log(
      `| **${entry.family}** | ${ids[0]} → ${ids.at(-1)} | ${entry.title} | ${entry.routes.filter((r) => !r.startsWith('MOUNT')).length} | ${entry.permissions} | ${entry.tests.length} | ${badge(entry.gaps)} ${entry.gaps.join(', ') || 'complet'} |`,
    );
  }

  console.log('');
}

const failures = results.filter((entry) => entry.gaps.length > 0);

console.log(`Familles : ${results.length} · Exigences couvertes : ${coveredIds}/${totalIds}`);
if (failures.length > 0) {
  console.log('\nÉcarts détectés :');
  for (const failure of failures) {
    console.log(`  ✗ ${failure.family} (${failure.module}) : ${failure.gaps.join(', ')}`);
  }
  process.exitCode = 1;
} else {
  console.log('Aucun écart : chaque famille du CDC a un module, des routes, une permission et une preuve de test.');
}
