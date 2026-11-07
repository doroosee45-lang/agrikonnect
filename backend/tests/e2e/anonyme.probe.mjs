import fs from 'node:fs';
import { startHarness } from './support/harness.mjs';

/**
 * Sonde — **pas un test** : elle interroge toutes les routes du serveur sans
 * jeton et publie la carte des statuts obtenus. Sert de base factuelle à
 * `tests/e2e/surfacePublique.e2e.test.mjs`.
 *
 * L'inventaire vient du **routeur Express réel**, pas d'une liste recopiée :
 * c'est la seule source qui ne puisse pas diverger du serveur.
 */

/** Antislash, construit sans antislash dans ce fichier (livraison sans piège). */
const BS = String.fromCharCode(92);

/**
 * Traduit le regexp d'un montage Express en chemin.
 *
 * Express 4 compile `router.use('/sms', …)` en un motif `^`+antislash-slash+
 * `sms`+antislash-slash+`?(?=antislash/|$)`. On traite la **chaîne** plutôt
 * qu'avec des regex : un littéral regex contenant un antislash-slash se
 * referme sur le slash et produit une erreur de syntaxe facile à manquer.
 */
const prefixeDepuis = (regexp) => {
  let s = regexp.source;
  if (s === '^' + BS + '/?(?=' + BS + '/|$)' || s === '^(?:' + BS + '/)?$') return '';
  if (s.startsWith('^')) s = s.slice(1);
  for (const suffixe of [BS + '/?(?=' + BS + '/|$)', BS + '/?$', '$']) {
    if (s.endsWith(suffixe)) {
      s = s.slice(0, -suffixe.length);
      break;
    }
  }
  // Paramètre de montage : `(?:([^/]+?))` → `:param`.
  s = s.split(BS + '/').join('/');
  s = s.split('(?:').join('').split(')').join('');
  s = s.split('[^/]+?').join(':param');
  s = s.split('?').join('');
  return s.endsWith('/') ? s.slice(0, -1) : s;
};

const routes = [];
const parcourir = (pile, prefixe) => {
  for (const couche of pile) {
    if (couche.route) {
      const chemin = (prefixe + couche.route.path).replace(/[/]+$/, '') || '/';
      for (const methode of Object.keys(couche.route.methods)) {
        routes.push({ method: methode.toUpperCase(), path: chemin });
      }
    } else if (couche.name === 'router' && couche.handle?.stack) {
      parcourir(couche.handle.stack, prefixe + prefixeDepuis(couche.regexp));
    }
  }
};
const h = await startHarness();

/*
 * Le routeur est importé **après** `startHarness()`. Un import statique en tête
 * de fichier évaluerait `config/env.js` — et donc `DATABASE_URL` — avant que la
 * base embarquée n'existe, et le client Prisma viserait le port 6543 : toutes
 * les routes qui touchent la base répondraient 500. Ce n'est pas un défaut de
 * l'application, c'est l'ordre d'import qui le fabrique.
 */
const router = (await import('../../src/routes/index.js')).default;

parcourir(router.stack, '');


/*
 * Trois routes sont déclarées directement sur `app` dans `src/app.js`, hors du
 * routeur `/api/v1` : la racine et la documentation OpenAPI. Sans elles, la
 * sonde couvre 382 routes alors que le contrat en compte 385.
 */
routes.push(
  // `/docs` et `/docs/openapi.json` portent déjà le préfixe dans `app.js`, et le
  // harnais l'ajoute aussi : il ne faut donc pas le remettre.
  { method: 'GET', path: '/docs' },
  { method: 'GET', path: '/docs/openapi.json' },
  // La racine est **hors** préfixe : elle n'est atteignable qu'en visant
  // l'origine, pas `/api/v1`.
  { method: 'GET', path: '/', racine: true },
);
const resultat = [];
for (const r of routes) {
  const chemin = r.path.replace(/:([A-Za-z0-9_]+)/g, (_m, p) =>
    (/id$/i.test(p) ? '00000000-0000-0000-0000-000000000000' : 'x'));
  try {
    const res = r.racine
      // La racine est hors `/api/v1` : le harnais préfixe tout, donc on vise
      // l'origine directement.
      ? await (async () => {
          const origine = h.urls.baseUrl.replace(/[/]api[/]v1$/, '');
          const rep = await fetch(origine + '/', { method: r.method });
          return { status: rep.status };
        })()
      : await h.request(r.method, chemin, {
          body: ['POST', 'PUT', 'PATCH'].includes(r.method) ? {} : undefined,
        });
    resultat.push({ route: `${r.method} ${r.path}`, status: res.status });
  } catch (e) {
    resultat.push({ route: `${r.method} ${r.path}`, status: `ERR ${e.message.slice(0, 40)}` });
  }
}
fs.writeFileSync('tmp/anonyme.json', JSON.stringify(resultat, null, 2));

// Carte figée : « METHODE /chemin » → statut, triée pour un diff stable.
const carte = {};
for (const r of resultat) carte[r.route] = r.status;
const triee = Object.fromEntries(Object.keys(carte).sort().map((k) => [k, carte[k]]));
fs.writeFileSync('tests/e2e/fixtures/surface-anonyme.json', JSON.stringify(triee, null, 2) + String.fromCharCode(10));

const parStatut = {};
for (const r of resultat) parStatut[r.status] = (parStatut[r.status] ?? 0) + 1;
console.log('routes interrogées :', resultat.length);
console.log('statuts :', JSON.stringify(parStatut));
console.log('──── réponses 2xx obtenues SANS jeton ────');
for (const r of resultat) {
  if (typeof r.status === 'number' && r.status < 300) console.log(`  ${r.status}  ${r.route}`);
}
console.log('──── erreurs ────');
for (const r of resultat) if (typeof r.status === 'string') console.log(`  ${r.route}`);
await h.stop();
