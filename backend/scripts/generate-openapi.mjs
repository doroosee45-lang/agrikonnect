/**
 * Générateur du contrat OpenAPI 3.0.3 (CDC §13.2).
 *
 * Le contrat est produit à partir du code, pas maintenu à la main : on lit les
 * montages de `src/routes/index.js`, puis chaque route de module pour extraire
 * la méthode, le chemin et la permission exigée. Le résultat est écrit dans
 * `src/docs/openapi.json` et servi par `GET /api/v1/docs/openapi.json`.
 *
 * Usage : node scripts/generate-openapi.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'src/routes/index.js');

const indexSource = fs.readFileSync(indexPath, 'utf8');

/**
 * Extrait les montages : router.use('/prefix', moduleRoutes).
 * Gère les imports par défaut ET les exports nommés (`import X, { alias }`),
 * pour que les alias de routes soient documentés comme les autres.
 */
const mounts = [];
for (const match of indexSource.matchAll(
  /import\s+([^;]+?)\s+from\s+'\.\.\/modules\/([^']+)';/g,
)) {
  const [, clause, file] = match;
  const [mainPart, bracedPart] = clause.split('{');
  // Export par défaut : `import fooRoutes, { adminRouter as adminRoutes }`
  const main = mainPart.replace(/,/g, '').trim();
  if (main) mounts.push({ local: main, file, exportName: 'default' });
  if (bracedPart) {
    for (const part of bracedPart.replace(/}/g, '').split(',')) {
      const [original, alias] = part.trim().split(/\s+as\s+/);
      if (!original) continue;
      mounts.push({ local: (alias ?? original).trim(), file, exportName: original.trim() });
    }
  }
}
const mountMap = new Map(mounts.map((m) => [m.local, m]));

const mounted = [];
for (const match of indexSource.matchAll(/router\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
  const [, prefix, local] = match;
  const entry = mountMap.get(local);
  if (entry) mounted.push({ prefix, file: entry.file, exportName: entry.exportName });
}

/*
 * Sous-routeurs locaux : un module peut monter un routeur défini dans un autre
 * fichier (`router.use('/settings', settingsRouter)` avec
 * `import { settingsRouter } from './admin.settings.routes.js'`). Sans ce
 * suivi, leurs routes échappent au contrat (M3 : paramètres et feature flags).
 * Une seule profondeur suffit : les montages sont de niveau 2 au maximum.
 */
for (let i = 0; i < mounted.length; i += 1) {
  const entry = mounted[i];
  const source = fs.readFileSync(path.join(root, 'src/modules', entry.file), 'utf8');
  for (const match of source.matchAll(/(\w+)\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const [, , subPrefix, subName] = match;
    const importMatch = source.match(
      new RegExp(`import\\s*{[^}]*\\b${subName}\\b[^}]*}\\s*from\\s*'([^']+)'`),
    );
    if (!importMatch) continue;
    const resolved = path.posix
      .join(path.posix.dirname(entry.file), importMatch[1].replace(/^\.\//, ''))
      .replace(/\\/g, '/');
    mounted.push({
      prefix: `${entry.prefix === '/' ? '' : entry.prefix}${subPrefix}`,
      file: resolved,
      exportName: subName,
    });
  }
}

/** Suffixes de chemins → tags métier. */
const TAG_RULES = [
  [/^\/auth/, 'V1 — Auth'],
  [/^\/me(\/|$)/, 'V1 — Profil'],
  [/^\/organizations/, 'V1 — Organisations'],
  [/^\/crops/, 'V1 — Référentiel cultures'],
  [/^\/countries/, 'V1 — Pays'],
  [/^\/farms/, 'V1 — Exploitations'],
  [/^\/plots/, 'V1 — Parcelles & sol'],
  [/^\/productions/, 'V1 — Productions'],
  [/^\/cooperatives/, 'V1 — Coopératives'],
  [/^\/media/, 'V1 — Médias'],
  [/^\/dashboard/, 'V1 — Tableau de bord'],
  [/^\/verifications/, 'V1 — Vérification'],
  [/^\/reports/, 'V1 — Signalements'],
  [/^\/admin/, 'V1 — Administration'],
  [/^\/public\/lots/, 'V3 — Traçabilité (public)'],
  [/^\/public/, 'V1 — Public'],
  [/^\/listings/, 'V2 — Annonces'],
  [/^\/purchase-requests/, 'V2 — Demandes d\'achat'],
  [/^\/market/, 'V2 — Offres'],
  [/^\/orders/, 'V2 — Commandes'],
  [/^\/inventory/, 'V2 — Stocks'],
  [/^\/reviews/, 'V2 — Avis'],
  [/^\/transport/, 'V2 — Transport'],
  [/^\/messaging/, 'V2 — Messagerie'],
  [/^\/notifications/, 'V2 — Notifications'],
  [/^\/billing/, 'V2 — Facturation'],
  [/^\/sync/, 'V3 — Synchronisation'],
  [/^\/ai/, 'V3 — IA assistée'],
  [/^\/weather/, 'V3 — Météo'],
  [/^\/prices/, 'V3 — Prix'],
  [/^\/lots/, 'V3 — Traçabilité'],
  [/^\/certifications/, 'V3 — Certifications'],
  [/^\/iot/, 'V3 — IoT'],
  [/^\/geodata/, 'V3 — Géodonnées'],
  [/^\/projects/, 'V4 — Projets'],
  [/^\/dataroom/, 'V4 — Data room'],
  [/^\/funding/, 'V4 — Financement'],
  [/^\/investors/, 'V4 — Investisseurs'],
  [/^\/precision/, 'V4 — Précision'],
  [/^\/invest/, 'V4 — Tableau de bord investisseur'],
  [/^\/tenders/, 'V5 — Appels d\'offres'],
  [/^\/exports/, 'V5 — Export'],
  [/^\/api-clients/, 'V5 — Clients API'],
  [/^\/data/, 'V5 — Produits de données'],
  [/^\/public-api/, 'V5 — API publique'],
];

const tagFor = (fullPath) => {
  const relative = fullPath.replace('/api/v1', '');
  for (const [rule, tag] of TAG_RULES) {
    if (rule.test(relative)) return tag;
  }
  return 'Autres';
};

const PUBLIC_PREFIXES = ['/api/v1/public', '/api/v1/countries', '/api/v1/public-api'];


/**
 * Détermine les routers d'un fichier et le nom exporté par défaut.
 * Un fichier peut exposer plusieurs routeurs (`router` + `adminRouter`) : sans
 * cette distinction, chaque montage héritait de toutes les routes du fichier et
 * le contrat annonçait des chemins qui n'existent pas.
 */
const parseRouters = (source) => {
  const names = [...source.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*Router\s*\(/g)].map((match) => match[1]);
  const defaultMatch = source.match(/export\s+default\s+(\w+)\s*;?/);
  return { names, defaultName: defaultMatch ? defaultMatch[1] : 'router' };
};

/** Extrait les routes d'un routeur donné, en appariant les parenthèses (multi-lignes). */
const extractRoutes = (src, routerName = 'router') => {
  const routes = [];
  const pattern = new RegExp(`(?:^|[^\\w])${routerName}\\.(get|post|patch|put|delete)\\(`, 'g');
  for (const match of src.matchAll(pattern)) {
    const startParen = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = startParen; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) continue;
    const args = src.slice(startParen + 1, end);
    const pathMatch = args.match(/^\s*'([^']*)'/);
    if (!pathMatch) continue;
    routes.push({ method: match[1], routePath: pathMatch[1], middle: args });
  }
  return routes;
};

const paths = {};

for (const { prefix, file, exportName = 'default' } of mounted) {
  const source = fs.readFileSync(path.join(root, 'src/modules', file), 'utf8');
  const { names, defaultName } = parseRouters(source);
  const routerName = exportName === 'default' ? defaultName : exportName;
  if (!names.includes(routerName)) continue;
  // On limite l'analyse au corps du routeur concerné : les routes d'un autre
  // routeur du même fichier ne doivent pas être attribuées à ce montage.
  const startIndex = source.search(new RegExp(`(?:export\\s+)?const\\s+${routerName}\\s*=\\s*Router\\s*\\(`));
  const nextRouterIndex = names
    .map((name) => source.search(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*Router\\s*\\(`)))
    .filter((index) => index > startIndex)
    .sort((a, b) => a - b)[0];
  const body = source.slice(startIndex, nextRouterIndex ?? source.length);

  for (const route of extractRoutes(body, routerName)) {
    const { method, routePath, middle } = route;
    const mountPrefix = prefix === '/' ? '' : prefix;
    const fullPath =
      `/api/v1${mountPrefix}${routePath === '/' ? '' : routePath}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') ||
      '/api/v1';

    // `requireSuperAdmin` sans `authorize(...)` : palier 2 (SUPER_ADMIN + MFA).
    const superAdmin = /requireSuperAdmin/.test(middle);
    const permission =
      middle.match(/authorize\(\s*'([^']+)'/)?.[1] ??
      (superAdmin ? 'SUPER_ADMIN (palier 2, MFA)' : null);
    const tenantScoped = /resolveTenant/.test(source);
    const isPublic = PUBLIC_PREFIXES.some((p) => fullPath.startsWith(p)) && !tenantScoped;

    const parameters = [];
    for (const param of fullPath.matchAll(/:(\w+)/g)) {
      parameters.push({ name: param[1], in: 'path', required: true, schema: { type: 'string' } });
    }

    if (/validate\([^)]*'query'\)/.test(middle)) {
      parameters.push({
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Pagination — voir aussi limit, sort, order',
      });
    }

/**
 * Notes sémantiques par route.
 *
 * Le générateur déduit méthode, chemin et permission du code, mais il ne peut
 * pas deviner la **sémantique d'un champ de réponse**. Ces notes complètent la
 * description générée ; elles sont vérifiées par `tests/openapiNotes.test.mjs`,
 * qui échoue si une note vise une route inexistante — sinon la documentation
 * dériverait en silence.
 */
const ROUTE_NOTES = {
  'get /api/v1/seasons/stats': [
    '**Sémantique des agrégats.** `totalYieldKg` ne couvre **que les retours qui portent une '
    + 'surface** : ce sont les seuls pour lesquels un rendement à l\'hectare existe. Les kilos '
    + 'des retours **sans** surface sont portés par `yieldKgWithoutArea`, au niveau de chaque '
    + 'groupe et au niveau racine. `yieldPerHa` vaut `totalYieldKg / totalAreaHa` et vaut `null` '
    + 'quand aucune surface n\'est connue — il n\'est jamais estimé. `withoutArea` (par groupe) '
    + 'et `withoutAreaCount` (racine) comptent les retours exclus. Additionner les kilos sans '
    + 'surface au numérateur sans rien pouvoir ajouter au dénominateur gonflerait le rendement : '
    + 'les deux totaux sont donc volontairement séparés.',
  ],

  'post /api/v1/geospatial/imports': [
    '**Réception uniquement — aucun traitement du contenu.** Le fichier est stocké tel quel '
    + 'et la ligne est créée au statut `RECEIVED`, et à aucun autre. Aucun parsing, aucune '
    + 'extraction, aucune valeur calculée : les statuts `PROCESSING`, `COMPLETED` et `ERROR` '
    + 'existent dans l\'énumération mais ne sont **jamais écrits par cette route**. `result`, '
    + '`startedAt` et `completedAt` restent vides. Le traitement est une étape à part, qui '
    + 'n\'existe pas encore.',
    '**Type vérifié sur les octets, pas sur l\'extension.** Le contenu est comparé aux '
    + 'signatures connues ; une extension mensongère ne change rien au contrôle. Un fichier '
    + 'dont les octets ne correspondent à aucun type autorisé est refusé (422). Le SEG-Y '
    + '(géoradar) n\'a pas de signature magique : son contrôle repose sur le marqueur de '
    + 'révision et la réponse le signale par `detection.controleFaible: true`.',
    '**Doublon refusé.** La somme SHA-256 est calculée à la réception. Un fichier de même '
    + 'somme déjà déposé **dans la même organisation** est refusé (409), quel que soit son '
    + 'nom. Le même fichier déposé par une autre organisation reste accepté.',
    '**Taille.** 64 Mo par type. Le corps est du base64 (~33 % de plus que le fichier) : le '
    + 'parseur de cette route est borné à 100 Mo, alors que le reste de l\'API reste à 1 Mo. '
    + 'Un téléversement en flux (multipart) serait nécessaire au-delà.',
    '**Nom de fichier.** Il est assaini et conservé pour l\'affichage. La clé de stockage est '
    + 'construite côté serveur à partir de l\'organisation, de l\'identifiant généré et de '
    + 'l\'extension **détectée** — jamais à partir du nom fourni.',
  ],

  'get /api/v1/geospatial/imports/:id': [
    '**404 pour un tiers.** Un dépôt appartenant à une autre organisation renvoie 404 et non '
    + '403 : répondre 403 révélerait que l\'identifiant existe.',
  ],
};

      paths[fullPath] = paths[fullPath] ?? {};
    paths[fullPath][method] = {
      tags: [tagFor(fullPath)],
      summary: `${method.toUpperCase()} ${fullPath}`,
      description: [
        permission ? `Permission requise : \`${permission}\`.` : 'Aucune permission spécifique (route publique).',
        tenantScoped ? "Isolation tenant : filtre sur l'organisation active." : null,
        /idempotency\(/.test(middle) ? 'Requiert l\'en-tête `Idempotency-Key`.' : null,
        ...(ROUTE_NOTES[`${method} ${fullPath}`] ?? []),
      ].filter(Boolean).join(' '),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(isPublic ? { security: [] } : { security: [{ bearerAuth: [] }] }),
      responses: {
        ...(method === 'post' ? { 201: { $ref: '#/components/responses/Success' } } : { 200: { $ref: '#/components/responses/Success' } }),
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { $ref: '#/components/responses/Conflict' },
        413: { $ref: '#/components/responses/PayloadTooLarge' },
        422: { $ref: '#/components/responses/ValidationError' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
      'x-permission': permission,
    };
  }
}

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'AGRIKONNECT AFRICA — API',
    version: '5.0.0',
    description:
      'API REST couvrant les cinq niveaux du produit : V1 FARM, V2 MARKET, V3 INTELLIGENCE, ' +
      'V4 INVEST, V5 GLOBAL. Contrat généré depuis le code (routes + permissions).\n\n' +
      'Toutes les réponses suivent l\'enveloppe du CDC A.5 : ' +
      '`{ success, message?, data, meta }` en succès, `{ success: false, message, errors[], requestId }` en erreur.',
    contact: { name: 'AGRIKONNECT AFRICA', url: 'https://agrikonnect.africa' },
  },
  servers: [{ url: 'https://api.agrikonnect.africa', description: 'Production' }, { url: 'http://localhost:4000', description: 'Développement' }],
  tags: [...new Set(Object.values(paths).flatMap((p) => Object.values(p).map((op) => op.tags[0])))].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Supabase JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
    parameters: {
      OrganizationId: {
        name: 'X-Organization-Id',
        in: 'header',
        required: false,
        description: 'Organisation active. Le serveur vérifie l\'appartenance (404 sinon).',
        schema: { type: 'string' },
      },
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        description: 'Requis sur les créations sensibles (commandes, mouvements de stock, IA). Rejoue la réponse en cas de retry.',
        schema: { type: 'string', minLength: 8 },
      },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['success', 'code', 'message', 'requestId'],
        properties: {
          success: { type: 'boolean', example: false },
          /*
           * Code machine de l'erreur. Toujours présent, `null` si l'erreur n'en
           * porte pas. Le statut HTTP seul ne distingue pas deux causes de même
           * statut — 422 couvre aussi bien un champ manquant qu'un type de
           * fichier refusé — et comparer des messages écrits pour des humains
           * n'est pas un contrat.
           */
          code: {
            type: 'string',
            nullable: true,
            description:
              'Code machine stable : VALIDATION_ERROR, NOT_FOUND, CONFLICT, '
              + 'PAYLOAD_TOO_LARGE, TOO_MANY_REQUESTS, UNAUTHORIZED, FORBIDDEN, '
              + 'INTERNAL_ERROR…',
            example: 'VALIDATION_ERROR',
          },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string', nullable: true }, code: { type: 'string' } },
            },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
    },
    responses: {
      Success: { description: 'Succès', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } } },
      PayloadTooLarge: { description: 'Charge utile trop volumineuse, ou quota de stockage dépassé (413)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      ValidationError: { description: 'Entrée invalide (400/422)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Unauthorized: { description: 'Authentification requise (401)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Forbidden: { description: 'Permission insuffisante (403)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      NotFound: { description: 'Ressource introuvable ou hors tenant (404)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Conflict: { description: 'Conflit d\'état (409)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      RateLimited: { description: 'Quota ou débit dépassé (429)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
    },
  },
  paths,
};

const outPath = path.join(root, 'src/docs/openapi.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(spec, null, 2)}\n`);

const opCount = Object.values(paths).reduce((acc, p) => acc + Object.keys(p).length, 0);
console.log(`OpenAPI généré : ${outPath}`);
console.log(`Chemins : ${Object.keys(paths).length} — Opérations : ${opCount} — Tags : ${spec.tags.length}`);
