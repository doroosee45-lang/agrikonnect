#!/usr/bin/env node
/**
 * fix-m2-web.mjs — raccorde les coutures M2 dans les fichiers web (idempotent).
 *
 * Ce script ne remplace JAMAIS le contenu de vos fichiers : il ajoute
 * uniquement les coutures M2 manquantes (imports paresseux, routes,
 * formes d'appel des clés de requête), détecte ce qui est déjà fait,
 * et refuse proprement (❌, sans écrire) si une ancre est introuvable.
 *
 * Usage (racine du projet) :  node fix-m2-web.mjs
 * Une seconde exécution dit 🆗 partout. Aucun secret n'est imprimé.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const racine = fileURLToPath(new URL('.', import.meta.url));
const web = path.join(racine, 'apps', 'web', 'src');

const md5 = (texte) => createHash('md5').update(texte).digest('hex');

let ok = 0;
let ko = 0;
let ecrits = 0;

const lire = (relatif) => {
  const absolu = path.join(web, relatif);
  if (!existsSync(absolu)) return null;
  return readFileSync(absolu, 'utf8');
};

const ecrire = (relatif, contenu) => {
  writeFileSync(path.join(web, relatif), contenu);
  ecrits += 1;
};

/** Insère `lignes` (tableau) juste après la première ligne contenant `ancre`. */
const insereApres = (relatif, ancre, lignes, libelle) => {
  const source = lire(relatif);
  if (source === null) {
    console.error('❌ ' + relatif + ' — fichier introuvable.');
    ko += 1;
    return;
  }
  const lignesSource = source.split('\n');
  const index = lignesSource.findIndex((l) => l.includes(ancre));
  if (index === -1) {
    console.error('❌ ' + relatif + ' — ancre introuvable pour « ' + libelle + ' ».');
    console.error('   (votre fichier est personnalisé au-delà du correctif — copiez cette sortie dans le chat)');
    ko += 1;
    return;
  }
  const retrait = (lignesSource[index].match(/^\s*/) ?? [''])[0];
  lignesSource.splice(index + 1, 0, ...lignes.map((l) => (l === '' ? '' : retrait + l)));
  ecrire(relatif, lignesSource.join('\n'));
  console.log('✅ ' + relatif + ' — ' + libelle + ' ajouté.');
  ok += 1;
};

/** Normalise queryKeys.admin.dashboard → queryKeys.admin.dashboard({}) (hors déjà appelé). */
const normaliseCleDashboard = (relatif) => {
  const source = lire(relatif);
  if (source === null) {
    console.error('❌ ' + relatif + ' — fichier introuvable.');
    ko += 1;
    return;
  }
  const avant = (source.match(/queryKeys\.admin\.dashboard(?![\w(])/g) ?? []).length;
  if (avant === 0) {
    console.log('🆗 ' + relatif + ' — clé dashboard déjà conforme (ou non utilisée).');
    ok += 1;
    return;
  }
  const apres = source.replace(/queryKeys\.admin\.dashboard(?![\w(])/g, 'queryKeys.admin.dashboard({})');
  ecrire(relatif, apres);
  console.log('✅ ' + relatif + ' — ' + avant + ' usage(s) de la clé dashboard normalisé(s).');
  ok += 1;
};

console.log('── 1/5 Pages M2 (contrôle d’empreinte) ─────────────────────');
const pages = {
  'pages/admin/Users.tsx': 'ff9b4c03620a5a2718be0a46750daa38',
  'pages/admin/UserDetail.tsx': 'c8658478813d81fb40300d069e33674d',
  'pages/admin/Roles.tsx': '056c1015cce345671a178c3e117f7d33',
};
for (const [relatif, empreinte] of Object.entries(pages)) {
  const source = lire(relatif);
  if (source === null) {
    console.error('❌ ' + relatif + ' — absent (livraison message 3/4 manquante).');
    ko += 1;
  } else if (md5(source) === empreinte) {
    console.log('🆗 ' + relatif + ' — conforme.');
    ok += 1;
  } else {
    console.error('❌ ' + relatif + ' — empreinte ' + md5(source) + ' ≠ attendue ' + empreinte + '.');
    ko += 1;
  }
}

console.log('── 2/5 Fichiers déjà à jour (contrôle d’empreinte) ─────────');
const dejaJour = {
  'services/endpoints.ts': '6a90796ee0a15efd40d38384bf590219',
  'services/query.ts': 'c488ef6e1e1b55346e66cf462cc9ab00',
  'pages/admin/Admin.tsx': '21b8f498bb7e4189688fc1a9760614ce',
};
for (const [relatif, empreinte] of Object.entries(dejaJour)) {
  const source = lire(relatif);
  if (source === null) {
    console.error('❌ ' + relatif + ' — absent.');
    ko += 1;
  } else if (md5(source) === empreinte) {
    console.log('🆗 ' + relatif + ' — déjà à jour.');
    ok += 1;
  } else {
    console.error('⚠️ ' + relatif + ' — empreinte ' + md5(source) + ' ≠ cible ' + empreinte + ' (fichier personnalisé ?).');
    console.error('   Le M2 n’y touche pas ; si le typage échoue, copiez cette ligne dans le chat.');
    ok += 1;
  }
}

console.log('── 3/5 App.tsx (imports paresseux + routes M2) ─────────────');
const app = 'App.tsx';
const sourceApp = lire(app);
if (sourceApp === null) {
  console.error('❌ App.tsx — introuvable.');
  ko += 1;
} else {
  if (sourceApp.includes('pages/admin/UserDetail') && sourceApp.includes('pages/admin/Roles')) {
    console.log('🆗 App.tsx — imports paresseux M2 déjà présents.');
    ok += 1;
  } else if (sourceApp.includes('pages/admin/Users')) {
    const manquantes = [];
    if (!sourceApp.includes('pages/admin/UserDetail')) {
      manquantes.push("const AdminUserDetail = lazy(() => import('@/pages/admin/UserDetail'));");
    }
    if (!sourceApp.includes('pages/admin/Roles')) {
      manquantes.push("const AdminRoles = lazy(() => import('@/pages/admin/Roles'));");
    }
    if (manquantes.length === 0) {
      console.log('🆗 App.tsx — imports paresseux M2 déjà présents.');
      ok += 1;
    } else {
      insereApres(app, 'pages/admin/Users', manquantes, 'imports paresseux M2 (' + manquantes.length + ')');
    }
  } else {
    console.error('❌ App.tsx — ancre « pages/admin/Users » introuvable.');
    console.error('   (votre App.tsx est personnalisé au-delà du correctif — copiez cette sortie dans le chat)');
    ko += 1;
  }

  if (sourceApp.includes('path="/admin/users/:id"') && sourceApp.includes('path="/admin/roles"')) {
    console.log('🆗 App.tsx — routes M2 déjà présentes.');
    ok += 1;
  } else if (sourceApp.includes('path="/admin/users"')) {
    const manquantes = [];
    if (!sourceApp.includes('path="/admin/users/:id"')) {
      manquantes.push('<Route path="/admin/users/:id" element={<AdminUserDetail />} />');
    }
    if (!sourceApp.includes('path="/admin/roles"')) {
      manquantes.push('<Route path="/admin/roles" element={<AdminRoles />} />');
    }
    if (manquantes.length === 0) {
      console.log('🆗 App.tsx — routes M2 déjà présentes.');
      ok += 1;
    } else {
      insereApres(app, 'path="/admin/users"', manquantes, 'routes M2 (' + manquantes.length + ')');
    }
  } else {
    console.error('❌ App.tsx — ancre « path="/admin/users" » introuvable.');
    console.error('   (votre App.tsx est personnalisé au-delà du correctif — copiez cette sortie dans le chat)');
    ko += 1;
  }
}

console.log('── 4/5 Clés de requête (queryKeys.admin.dashboard) ─────────');
for (const relatif of ['pages/admin/Dashboard.tsx', 'pages/admin/Reports.tsx', 'pages/admin/Settings.tsx']) {
  normaliseCleDashboard(relatif);
}

console.log('── 5/5 Résumé ──────────────────────────────────────────────');
console.log('');
if (ko > 0) {
  console.error('❌ ' + ko + ' problème(s), ' + ecrits + ' fichier(s) modifié(s) — copiez cette sortie dans le chat.');
  process.exit(1);
}
console.log('✅ Terminé — ' + ok + ' contrôle(s) OK, ' + ecrits + ' fichier(s) modifié(s).');
console.log('Suivant : cd apps/web && npx tsc --noEmit  puis  npm run build');
process.exit(0);
