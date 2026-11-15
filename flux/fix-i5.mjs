#!/usr/bin/env node
/**
 * fix-i5.mjs — coutures I5 (M5 Supervision + M6 Audit/Sécurité).
 *
 * 1 copier-coller + 1 commande (depuis la racine du projet, celle qui
 * contient `backend/`) :
 *   node fix-i5.mjs
 *
 * Chaque couture répond ✅ (appliquée) / 🆗 (déjà en place) / ❌ (échec).
 * Idempotent : relisible sans danger. Seuls les blocs exacts ci-dessous
 * sont remplacés — aucun autre fichier n'est modifié.
 *
 * Fichiers concernés : backend/src/jobs/index.js,
 * backend/src/modules/admin/admin.{routes,schema,service}.js,
 * backend/tests/jobs.integration.test.mjs.
 */
const COUTURES = [
  {
    "fichier": "backend/src/jobs/index.js",
    "libelle": "jobs : filet pause + seuil alerte",
    "avant": "const stats = new Map();\nconst running = new Set();\n",
    "apres": "const stats = new Map();\nconst running = new Set();\n/**\n * Tâches en pause (M5 U-M5-2 : pause/reprise, palier 2 côté route).\n * Une tâche en pause n'est ni planifiée ni déclençable manuellement tant\n * qu'elle n'est pas reprise — l'oubli d'une pause est visible dans\n * `listJobs()` et dans les alertes de supervision.\n */\nconst paused = new Set();\n\n/** Seuil d'alerte : après N échecs consécutifs, les administrateurs sont notifiés (U-M5-4). */\nconst JOB_ALERT_FAILURES = Number(process.env.JOB_ALERT_FAILURES ?? 3);\n",
    "avant_len": 52,
    "apres_len": 519
  },
  {
    "fichier": "backend/src/jobs/index.js",
    "libelle": "jobs : listJobs enrichi + runJob audité/verrouillé + pause/reprise",
    "avant": "export const listJobs = () =>\n  Object.entries(JOBS).map(([name, job]) => ({\n    name,\n    description: job.description,\n    intervalMs: job.intervalMs,\n    intervalHuman: `${Math.round(job.intervalMs / 60000)} min`,\n    lastRunAt: stats.get(name)?.lastRunAt ?? null,\n    lastDurationMs: stats.get(name)?.lastDurationMs ?? null,\n    lastOk: stats.get(name)?.lastOk ?? null,\n    lastError: stats.get(name)?.lastError ?? null,\n    lastResult: stats.get(name)?.lastResult ?? null,\n    running: running.has(name),\n  }));\n\n/**\n * Exécute une tâche à la demande (cron ou administration).\n * Un nom inconnu renvoie `null` : l'appelant décide du statut HTTP.\n * Un déclenchement manuel est **audité** (`job.run`) avec l'acteur.\n */\nexport const runJob = async (name, { actorId = null, req = null } = {}) => {\n  const job = JOBS[name];\n  if (!job) return null;\n  if (running.has(name)) return { skipped: true, reason: 'déjà en cours' };\n\n  running.add(name);\n  const startedAt = Date.now();\n  try {\n    const result = await job.run();\n\n    if (actorId) {\n      await audit({\n        actorId,\n        action: 'job.run',\n        resource: 'jobs',\n        resourceId: name,\n        req,\n        newValue: { manual: true, result: result ?? null },\n      });\n    }\n\n    stats.set(name, {\n      lastRunAt: new Date().toISOString(),\n      lastDurationMs: Date.now() - startedAt,\n      lastOk: true,\n      lastError: null,\n      lastResult: result ?? null,\n    });\n    logger.info(`[job] ${name} terminé en ${Date.now() - startedAt} ms`, result ?? {});\n    return { ok: true, name, durationMs: Date.now() - startedAt, result };\n  } catch (error) {\n    stats.set(name, {\n      lastRunAt: new Date().toISOString(),\n      lastDurationMs: Date.now() - startedAt,\n      lastOk: false,\n      lastError: error.message,\n      lastResult: null,\n    });\n    logger.error(`[job] ${name} en échec : ${error.message}`);\n    throw error;\n  } finally {\n    running.delete(name);\n  }\n};\n",
    "apres": "export const listJobs = () =>\n  Object.entries(JOBS).map(([name, job]) => {\n    const s = stats.get(name);\n    const estPause = paused.has(name);\n    // Prochaine échéance estimée = dernier passage + cadence (le planificateur\n    // est un intervalle, pas un cron : aucune date n'est stockée côté timer).\n    const nextRunAt =\n      !estPause && s?.lastRunAt ? new Date(new Date(s.lastRunAt).getTime() + job.intervalMs).toISOString() : null;\n    return {\n      name,\n      description: job.description,\n      intervalMs: job.intervalMs,\n      intervalHuman: `${Math.round(job.intervalMs / 60000)} min`,\n      lastRunAt: s?.lastRunAt ?? null,\n      lastDurationMs: s?.lastDurationMs ?? null,\n      lastOk: s?.lastOk ?? null,\n      lastError: s?.lastError ?? null,\n      lastResult: s?.lastResult ?? null,\n      consecutiveFailures: s?.consecutiveFailures ?? 0,\n      paused: estPause,\n      nextRunAt,\n      running: running.has(name),\n    };\n  });\n\n/**\n * Exécute une tâche à la demande (cron ou administration).\n * Un nom inconnu renvoie `null` : l'appelant décide du statut HTTP.\n * Un déclenchement manuel est **audité** (`admin.job.run`) avec l'acteur et\n * le motif (RG-M5-2). Une tâche en pause ou déjà en cours est signalée par\n * `skipped` — jamais exécutée deux fois en parallèle (verrou `running`).\n */\nexport const runJob = async (name, { actorId = null, req = null, reason = null } = {}) => {\n  const job = JOBS[name];\n  if (!job) return null;\n  if (paused.has(name)) {\n    return { skipped: true, reason: 'Tâche en pause — reprends-la avant de la déclencher' };\n  }\n  if (running.has(name)) return { skipped: true, reason: 'déjà en cours' };\n\n  running.add(name);\n  const startedAt = Date.now();\n  try {\n    const result = await job.run();\n\n    if (actorId) {\n      await audit({\n        actorId,\n        action: 'admin.job.run',\n        resource: 'jobs',\n        resourceId: name,\n        req,\n        newValue: { manual: true, reason, result: result ?? null },\n      });\n    }\n\n    stats.set(name, {\n      lastRunAt: new Date().toISOString(),\n      lastDurationMs: Date.now() - startedAt,\n      lastOk: true,\n      lastError: null,\n      lastResult: result ?? null,\n      consecutiveFailures: 0,\n    });\n    logger.info(`[job] ${name} terminé en ${Date.now() - startedAt} ms`, result ?? {});\n    return { ok: true, name, durationMs: Date.now() - startedAt, result };\n  } catch (error) {\n    // U-M5-4 : un job en erreur ×N fait l'objet d'une alerte notifiée aux\n    // administrateurs (déduction par jour et par tâche, jamais de bourrage).\n    const echecs = (stats.get(name)?.consecutiveFailures ?? 0) + 1;\n    stats.set(name, {\n      lastRunAt: new Date().toISOString(),\n      lastDurationMs: Date.now() - startedAt,\n      lastOk: false,\n      lastError: error.message,\n      lastResult: null,\n      consecutiveFailures: echecs,\n    });\n    logger.error(`[job] ${name} en échec : ${error.message}`);\n    if (echecs >= JOB_ALERT_FAILURES) {\n      const jour = new Date().toISOString().slice(0, 10);\n      await notifyModerators({\n        type: 'JOB_FAILURE',\n        title: `Tâche ${name} en échec (${echecs} de suite)`,\n        body: `La tâche planifiée « ${name} » a échoué ${echecs} fois consécutives : ${error.message}`,\n        payload: { job: name, consecutiveFailures: echecs },\n        dedupeKey: `job-failure:${name}:${jour}`,\n      }).catch(() => {});\n    }\n    throw error;\n  } finally {\n    running.delete(name);\n  }\n};\n\n/**\n * M5 U-M5-2 — pause / reprise d'une tâche (routes palier 2, auditées côté\n * module admin). Le nom inconnu renvoie `null`, comme `runJob`.\n */\nexport const pauseJob = (name) => {\n  if (!JOBS[name]) return null;\n  paused.add(name);\n  return { name, paused: true };\n};\n\nexport const resumeJob = (name) => {\n  if (!JOBS[name]) return null;\n  paused.delete(name);\n  return { name, paused: false };\n};\n",
    "avant_len": 1954,
    "apres_len": 3851
  },
  {
    "fichier": "backend/src/modules/admin/admin.routes.js",
    "libelle": "routes admin : imports (supervision + sécurité)",
    "avant": "import { Router } from 'express';\nimport { z } from 'zod';\nimport { asyncHandler } from '../../shared/http/asyncHandler.js';\nimport { success } from '../../shared/http/response.js';\nimport { authenticate } from '../../middleware/auth.js';\nimport { resolveTenant } from '../../middleware/tenant.js';\nimport { authorize, requireSuperAdmin } from '../../middleware/authorize.js';\nimport { validate } from '../../middleware/validate.js';\nimport { ApiError } from '../../shared/errors/ApiError.js';\nimport * as controller from './admin.controller.js';\nimport * as schema from './admin.schema.js';\nimport { settingsRouter, flagsRouter } from './admin.settings.routes.js';\nimport { JOBS, runJob, schedulerStatus } from '../../jobs/index.js';\n",
    "apres": "import { Router } from 'express';\nimport { asyncHandler } from '../../shared/http/asyncHandler.js';\nimport { authenticate } from '../../middleware/auth.js';\nimport { resolveTenant } from '../../middleware/tenant.js';\nimport { authorize, requireSuperAdmin } from '../../middleware/authorize.js';\nimport { validate } from '../../middleware/validate.js';\nimport * as controller from './admin.controller.js';\nimport * as schema from './admin.schema.js';\nimport { settingsRouter, flagsRouter } from './admin.settings.routes.js';\nimport { jobsRouter, monitoringRouter } from './admin.monitoring.routes.js';\nimport { auditExportRouter, securityRouter } from './admin.security.routes.js';\n",
    "avant_len": 735,
    "apres_len": 681
  },
  {
    "fichier": "backend/src/modules/admin/admin.routes.js",
    "libelle": "routes admin : bloc jobs → montages /jobs + /monitoring",
    "avant": "/**\n * Console des tâches planifiées : état, dernier passage, exécution manuelle.\n * Un administrateur peut donc rejouer une expiration ou une purge sans\n * redéployer — et l'action est auditée (`job.run`).\n */\nrouter.get('/jobs', authorize('admin.jobs'), asyncHandler(async (_req, res) =>\n  success(res, schedulerStatus())));\n\nrouter.post('/jobs/:name/run', authorize('admin.jobs'),\n  validate(z.object({ name: z.string().min(3).max(60) }), 'params'),\n  asyncHandler(async (req, res) => {\n    const outcome = await runJob(req.params.name, { actorId: req.user.id, req });\n    // Une tâche inconnue ne doit jamais répondre 200 : le nom est validé par la\n    // liste réelle du planificateur, pas par une énumération figée côté route.\n    if (outcome === null) throw ApiError.notFound(`Tâche inconnue : ${req.params.name}`);\n    return success(res, outcome, { message: `Tâche ${req.params.name} exécutée` });\n  }));\n",
    "apres": "/**\n * M5 (U-M5-2/RG-M5-2) — console des tâches planifiées : état, exécution\n * manuelle (auditée `admin.job.run`), pause/reprise (palier 2). Montée ici\n * pour conserver les chemins exacts `/admin/jobs…`.\n */\nrouter.use('/jobs', jobsRouter);\n\n/** M5 (U-M5-1/U-M5-3) — services externes et santé technique, en direct. */\nrouter.use('/monitoring', monitoringRouter);\n",
    "avant_len": 914,
    "apres_len": 366
  },
  {
    "fichier": "backend/src/modules/admin/admin.routes.js",
    "libelle": "routes admin : montages /audit/export + /security",
    "avant": "router.use('/settings', settingsRouter);\nrouter.use('/flags', flagsRouter);\n",
    "apres": "router.use('/settings', settingsRouter);\nrouter.use('/flags', flagsRouter);\n\n/**\n * M6 (U-M6-1/U-M6-2/U-M6-3) — export du journal d'audit (audité) et vue\n * sécurité (connexions, verrous, MFA, clés API, sessions) + politique\n * `security.*` (palier 2).\n */\nrouter.use('/audit', auditExportRouter);\nrouter.use('/security', securityRouter);\n",
    "avant_len": 76,
    "apres_len": 339
  },
  {
    "fichier": "backend/src/modules/admin/admin.schema.js",
    "libelle": "schéma admin : listAuditSchema → recherche M6",
    "avant": "export const listAuditSchema = paginationSchema.extend({\n  resource: z.string().trim().max(60).optional(),\n  actorId: z.string().trim().max(60).optional(),\n  action: z.string().trim().max(80).optional(),\n});\n",
    "apres": "/**\n * Recherche d'audit — M6 (U-M6-1) : acteur, action, ressource, date, gravité.\n * Définie dans `admin.security.schema.js` (une seule source) et ré-exportée\n * sous le nom historique consommé par `admin.routes.js`.\n */\nexport { auditQuerySchema as listAuditSchema } from './admin.security.schema.js';\n",
    "avant_len": 208,
    "apres_len": 305
  },
  {
    "fichier": "backend/src/modules/admin/admin.service.js",
    "libelle": "service admin : import gravité audit",
    "avant": "import { PERMISSIONS, GOVERNANCE_ROLES } from '../../shared/permissions.js';\n",
    "apres": "import { PERMISSIONS, GOVERNANCE_ROLES } from '../../shared/permissions.js';\nimport { auditSeverity, severityWhere } from './admin.security.schema.js';\n",
    "avant_len": 77,
    "apres_len": 152
  },
  {
    "fichier": "backend/src/modules/admin/admin.service.js",
    "libelle": "service admin : recherche audit élargie (acteur/dates/gravité)",
    "avant": "export const listAuditLogs = async (query) => {\n  const { page, limit, sort, order, resource, actorId, action } = query;\n\n  const where = {\n    ...(resource ? { resource } : {}),\n    ...(actorId ? { actorId } : {}),\n    ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),\n  };\n\n  const [items, total] = await Promise.all([\n    prisma.auditLog.findMany({\n      where,\n      ...paginationArgs({ page, limit }),\n      orderBy: orderBy(sort, order, ['createdAt']),\n      include: { actor: { select: { firstName: true, lastName: true, email: true } } },\n    }),\n    prisma.auditLog.count({ where }),\n  ]);\n\n  return { items, total, page, limit };\n};\n",
    "apres": "export const listAuditLogs = async (query) => {\n  const { page, limit, sort, order, resource, actorId, actor, action, from, to, severity } = query;\n\n  const filters = [];\n  if (resource) filters.push({ resource });\n  if (action) filters.push({ action: { contains: action, mode: 'insensitive' } });\n\n  // U-M6-1 — `actor` = identifiant exact **ou** fragment d'e-mail/nom, résolu\n  // ici en identifiants (une seule implémentation de la recherche d'audit).\n  const acteurIds = [];\n  if (actorId) acteurIds.push(actorId);\n  if (actor) {\n    acteurIds.push(actor);\n    const profils = await prisma.profile.findMany({\n      where: {\n        OR: [\n          { email: { contains: actor, mode: 'insensitive' } },\n          { firstName: { contains: actor, mode: 'insensitive' } },\n          { lastName: { contains: actor, mode: 'insensitive' } },\n        ],\n      },\n      select: { id: true },\n      take: 25,\n    });\n    acteurIds.push(...profils.map((p) => p.id));\n  }\n  if (acteurIds.length) filters.push({ actorId: { in: [...new Set(acteurIds)] } });\n\n  if (from || to) {\n    filters.push({\n      createdAt: {\n        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),\n        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),\n      },\n    });\n  }\n  if (severity) filters.push(severityWhere(severity));\n\n  const where = filters.length ? { AND: filters } : {};\n\n  const [items, total] = await Promise.all([\n    prisma.auditLog.findMany({\n      where,\n      ...paginationArgs({ page, limit }),\n      orderBy: orderBy(sort, order, ['createdAt']),\n      include: { actor: { select: { firstName: true, lastName: true, email: true } } },\n    }),\n    prisma.auditLog.count({ where }),\n  ]);\n\n  // Gravité dérivée de l'action (U-M6-1) — calculée, jamais stockée.\n  return {\n    items: items.map((row) => ({ ...row, severity: auditSeverity(row.action) })),\n    total,\n    page,\n    limit,\n  };\n};\n",
    "avant_len": 667,
    "apres_len": 1901
  },
  {
    "fichier": "backend/tests/jobs.integration.test.mjs",
    "libelle": "test jobs : action auditée admin.job.run",
    "avant": "assert.equal(fake._store.auditLog[0].action, 'job.run');",
    "apres": "assert.equal(fake._store.auditLog[0].action, 'admin.job.run');",
    "avant_len": 56,
    "apres_len": 62
  }
];
const MD5_APRES = {
  "backend/src/jobs/index.js": "9f37a485259c96bb2bf34c0770a3ed9c",
  "backend/src/modules/admin/admin.routes.js": "b2a83ef0e789afe1426f778c1bf93f70",
  "backend/src/modules/admin/admin.schema.js": "720705024c7111c79e19ab321c3ba8cf",
  "backend/src/modules/admin/admin.service.js": "612f6d9fc81bccfe23482060c5f01697",
  "backend/tests/jobs.integration.test.mjs": "fce8f219299b1e6bb8e26be4c19d05eb"
};
const MD5_AVANT = {
  "backend/src/jobs/index.js": "36985887d2c3e1f5d0760133f261c8f6",
  "backend/src/modules/admin/admin.routes.js": "86abdd9128e65bcd5a7ec70ff275b425",
  "backend/src/modules/admin/admin.schema.js": "3b47278f1c3532820a75921075f97502",
  "backend/src/modules/admin/admin.service.js": "af80ed879a5382947963c1d49b68391f",
  "backend/tests/jobs.integration.test.mjs": "dce31a29cb6333c3693c8b0a79680814"
};
import fs from 'node:fs';
import crypto from 'node:crypto';

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

/** Accepte une exécution depuis la racine du projet OU depuis backend/. */
const resoudre = (fichier) => {
  if (fs.existsSync(fichier)) return fichier;
  const sans = fichier.replace(/^backend\//, '');
  if (fs.existsSync(sans)) return sans;
  return null;
};

let ok = 0; let deja = 0; let ko = 0;

console.log('— fix-i5.mjs : coutures M5/M6 (SPEC-SUPER-ADMIN) —');

for (const c of COUTURES) {
  const cible = resoudre(c.fichier);
  if (!cible) {
    console.log(`❌ ${c.fichier} : introuvable`);
    ko += 1;
    continue;
  }
  let contenu = fs.readFileSync(cible, 'utf8');
  if (contenu.includes(c.apres)) {
    console.log(`🆗 ${c.fichier} — ${c.libelle} (déjà appliqué)`);
    deja += 1;
    continue;
  }
  const occurrences = contenu.split(c.avant).length - 1;
  if (occurrences !== 1) {
    console.log(`❌ ${c.fichier} — ${c.libelle} : couture introuvable ou ambiguë (${occurrences}×)`);
    ko += 1;
    continue;
  }
  contenu = contenu.replace(c.avant, c.apres);
  fs.writeFileSync(cible, contenu);
  console.log(`✅ ${c.fichier} — ${c.libelle}`);
  ok += 1;
}

console.log('');
for (const [f, attendu] of Object.entries(MD5_APRES)) {
  const cible = resoudre(f);
  if (!cible) continue;
  const obtenu = md5(cible);
  console.log(`${obtenu === attendu ? '✅' : '⚠ '} md5 ${f} : ${obtenu}${obtenu === attendu ? '' : ` (attendu ${attendu})`}`);
}

console.log('');
console.log(`Coutures : ${ok} appliquée(s) · ${deja} déjà en place · ${ko} en échec`);
if (ko > 0) {
  console.log('FIX_I5_KO');
  process.exit(1);
}
console.log('FIX_I5_OK');
