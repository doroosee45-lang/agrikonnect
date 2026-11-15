#!/usr/bin/env node
/*
 * ═════════════════════════════════════════════════════════════════════════
 *  fix-m3.mjs — SPEC-SUPER-ADMIN M3 : les 4 retouches sur les fichiers que
 *  tu possèdes déjà. Rien d'autre n'est touché.
 *
 *  AVANT : tu as créé les 7 NOUVEAUX fichiers (5 code + 2 tests) reçus dans
 *  le chat, aux chemins exacts indiqués. Ce script ne fait QUE :
 *    1. admin.routes.js  → remplace le bloc /settings par les montages M3 ;
 *    2. app.js           → branche le middleware settingsEffects ;
 *    3. package.json     → inscrit les 2 fichiers de tests M3 ;
 *    4. generate-openapi.mjs → apprend les sous-routeurs + le palier 2
 *       (sinon `check:mounts` voit 6 routes « sans contrat »).
 *
 *  UTILISATION (dans Git Bash, à la racine du projet) :
 *    node fix-m3.mjs
 *
 *  Sécurités : chaque retouche est idempotente (rejouable), vérifiée par
 *  md5, et aucun fichier existant n'est remplacé en bloc — uniquement les
 *  coutures ci-dessous. Résultat attendu : 4 lignes ✅ (ou 🆗 si déjà fait),
 *  puis « SUITE : npm test ».
 * ═════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const md5 = (t) => createHash('md5').update(t).digest('hex');
const ok = (m) => console.log(`✅ ${m}`);
const deja = (m) => console.log(`🆗 ${m}`);
const ko = (m) => console.log(`❌ ${m}`);

const cheminAdmin = 'backend/src/modules/admin/admin.routes.js';
const cheminApp = 'backend/src/app.js';
const cheminPkg = 'backend/package.json';

let echecs = 0;

// ─── 1. admin.routes.js : montage M3 ──────────────────────────────────────
try {
  let src = readFileSync(cheminAdmin, 'utf8');
  const ancienBloc = `router.get('/settings', authorize('admin.settings'), asyncHandler(controller.getSettings));
router.put(
  '/settings',
  authorize('admin.settings'),
  validate(schema.settingSchema),
  asyncHandler(controller.updateSetting),
);`;
  const nouveauBloc = `router.use('/settings', settingsRouter);
router.use('/flags', flagsRouter);`;

  if (src.includes("router.use('/settings', settingsRouter)")) {
    deja('admin.routes.js — montages M3 déjà en place');
  } else if (src.includes(ancienBloc)) {
    src = src.replace(ancienBloc, nouveauBloc);
    const ancre = "import * as schema from './admin.schema.js';";
    if (!src.includes("admin.settings.routes.js")) {
      if (!src.includes(ancre)) throw new Error('ancre d\u2019import introuvable');
      src = src.replace(ancre, `${ancre}\nimport { settingsRouter, flagsRouter } from './admin.settings.routes.js';`);
    }
    writeFileSync(cheminAdmin, src);
    ok('admin.routes.js — bloc /settings remplacé par les montages M3');
  } else {
    throw new Error('bloc /settings historique introuvable (fichier déjà modifié à la main ?)');
  }
} catch (e) {
  ko(`admin.routes.js — ${e.message} → fais la retouche à la main (le chat montre les deux blocs)`);
  echecs += 1;
}

// ─── 2. app.js : middleware settingsEffects ────────────────────────────────
try {
  let src = readFileSync(cheminApp, 'utf8');
  if (src.includes('settingsEffects')) {
    deja('app.js — settingsEffects déjà branché');
  } else {
    const ancre = "import routes from './routes/index.js';";
    const montage = '  app.use(env.apiPrefix, routes);';
    if (!src.includes(ancre) || !src.includes(montage)) {
      throw new Error('coutures introuvables (import routes / app.use routes)');
    }
    src = src.replace(ancre, `${ancre}\nimport { settingsEffects } from './middleware/settingsEffects.js';`);
    src = src.replace(montage, `  app.use(env.apiPrefix, settingsEffects);\n${montage}`);
    writeFileSync(cheminApp, src);
    ok('app.js — settingsEffects branché avant les routes');
  }
} catch (e) {
  ko(`app.js — ${e.message} → fais la retouche à la main (le chat montre les deux lignes)`);
  echecs += 1;
}

// ─── 3. package.json : inscription des tests M3 ────────────────────────────
try {
  const raw = readFileSync(cheminPkg, 'utf8');
  if (raw.includes('adminSettings.test.mjs') && raw.includes('adminSettings.e2e.test.mjs')) {
    deja('package.json — tests M3 déjà inscrits');
  } else {
    let maj = raw.split('tests/adminUsers.test.mjs').join('tests/adminSettings.test.mjs tests/adminUsers.test.mjs');
    maj = maj.split('tests/e2e/adminUsers.e2e.test.mjs').join('tests/e2e/adminSettings.e2e.test.mjs tests/e2e/adminUsers.e2e.test.mjs');
    if (maj === raw) throw new Error('fichiers de tests M2 introuvables dans les scripts');
    JSON.parse(maj); // le JSON doit rester valide
    writeFileSync(cheminPkg, maj);
    ok('package.json — tests M3 inscrits dans test / test:unit / test:e2e');
  }
} catch (e) {
  ko(`package.json — ${e.message}`);
  echecs += 1;
}

// ─── 4. scripts/generate-openapi.mjs : suivi des sous-routeurs + palier 2 ──
// Sans ces deux coutures, `npm run docs:openapi` ne documente pas les 6
// routes M3 et `check:mounts` affiche « implémentation sans contrat : 6 ».
try {
  const cheminGen = 'backend/scripts/generate-openapi.mjs';
  let src = readFileSync(cheminGen, 'utf8');
  if (src.includes('Sous-routeurs locaux')) {
    deja('generate-openapi.mjs — sous-routeurs déjà suivis');
  } else {
    const ancre = `for (const match of indexSource.matchAll(/router\\.use\\(\\s*'([^']+)'\\s*,\\s*(\\w+)\\s*\\)/g)) {
  const [, prefix, local] = match;
  const entry = mountMap.get(local);
  if (entry) mounted.push({ prefix, file: entry.file, exportName: entry.exportName });
}`;
    const extension = `${ancre}

/*
 * Sous-routeurs locaux : un module peut monter un routeur défini dans un autre
 * fichier (\`router.use('/settings', settingsRouter)\` avec
 * \`import { settingsRouter } from './admin.settings.routes.js'\`). Sans ce
 * suivi, leurs routes échappent au contrat (M3 : paramètres et feature flags).
 * Une seule profondeur suffit : les montages sont de niveau 2 au maximum.
 */
for (let i = 0; i < mounted.length; i += 1) {
  const entry = mounted[i];
  const source = fs.readFileSync(path.join(root, 'src/modules', entry.file), 'utf8');
  for (const match of source.matchAll(/(\\w+)\\.use\\(\\s*'([^']+)'\\s*,\\s*(\\w+)\\s*\\)/g)) {
    const [, , subPrefix, subName] = match;
    const importMatch = source.match(
      new RegExp(\`import\\\\s*{[^}]*\\\\b\${subName}\\\\b[^}]*}\\\\s*from\\\\s*'([^']+)'\`),
    );
    if (!importMatch) continue;
    const resolved = path.posix
      .join(path.posix.dirname(entry.file), importMatch[1].replace(/^\\.\\//, ''))
      .replace(/\\\\/g, '/');
    mounted.push({
      prefix: \`\${entry.prefix === '/' ? '' : entry.prefix}\${subPrefix}\`,
      file: resolved,
      exportName: subName,
    });
  }
}`;
    if (!src.includes(ancre)) throw new Error('ancre du montage introuvable');
    src = src.replace(ancre, extension);
    const permAvant = `const permission = middle.match(/authorize\\(\\s*'([^']+)'/)?.[1] ?? null;`;
    const permApres = `// \`requireSuperAdmin\` sans \`authorize(...)\` : palier 2 (SUPER_ADMIN + MFA).
    const superAdmin = /requireSuperAdmin/.test(middle);
    const permission =
      middle.match(/authorize\\(\\s*'([^']+)'/)?.[1] ??
      (superAdmin ? 'SUPER_ADMIN (palier 2, MFA)' : null);`;
    if (!src.includes(permAvant)) throw new Error('ancre permission introuvable');
    src = src.replace(permAvant, permApres);
    writeFileSync(cheminGen, src);
    ok('generate-openapi.mjs — sous-routeurs + palier 2 documentés');
  }
} catch (e) {
  ko(`generate-openapi.mjs — ${e.message} → fais les 2 retouches à la main (le chat montre les blocs)`);
  echecs += 1;
}

// ─── Vérifications ────────────────────────────────────────────────────────
for (const f of [cheminAdmin, cheminApp, 'backend/src/modules/admin/admin.settings.routes.js', 'backend/src/middleware/settingsEffects.js']) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
    ok(`syntaxe — ${f}`);
  } catch {
    ko(`syntaxe — ${f}`);
    echecs += 1;
  }
}
for (const f of [cheminAdmin, cheminApp, cheminPkg]) {
  console.log(`   md5 ${md5(readFileSync(f, 'utf8'))}  ${f}`);
}

console.log('');
if (echecs) {
  console.log(`❌ ${echecs} problème(s) — corrige avant « npm test ».`);
  process.exit(1);
}
console.log('SUITE : npm install && node tests/e2e/anonyme.probe.mjs && npm test');
console.log('        puis npm run docs:openapi && npm run check:mounts  (attendu : 400/396/0/0/0)');
console.log('        attendu npm test : 1306/1306');
