import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUserProfileRoute, getUserSettingsRoute } from '../src/lib/redirects.ts';

/**
 * Chaque chemin STATIQUE passé à router.push / replace / navigate, `href` ou
 * `pathname` doit correspondre à un écran d'Expo Router (groupes `( )` et
 * `index` ignorés, `[param]` = segment variable). Trouvé à l'audit :
 * `/demandes` (place de marché) n'existait pas → `/requests`.
 */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const APP = join(SRC, 'app');

const fichiers = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(d, e.name)) : /\.tsx?$/.test(e.name) ? [join(d, e.name)] : [],
  );

const routes = fichiers(APP)
  .filter((f) => !/_layout\.tsx$/.test(f) && !/\+not-found/.test(f))
  .map((f) => relative(APP, f).split(sep).join('/').replace(/\.tsx?$/, ''))
  .map((r) => r.split('/').filter((s) => !/^\(.*\)$/.test(s)))
  .map((s) => (s[s.length - 1] === 'index' ? s.slice(0, -1) : s));

const existe = (url: string) => {
  const segs = url.replace(/[?#].*$/, '').split('/').filter(Boolean);
  return routes.some((r) => r.length === segs.length && r.every((s, i) => /^\[.*\]$/.test(s) || s === segs[i]));
};

describe('navigation — liens statiques', () => {
  it('sépare le profil personnel du profil et des paramètres de l’organisation', () => {
    const roles = ['COOPERATIVE_ADMIN'];
    assert.equal(getUserProfileRoute(roles), '/professional/profile');
    assert.equal(getUserSettingsRoute(roles), '/settings');
  });

  it('oriente les profils et paramètres individuels selon le métier', () => {
    assert.equal(getUserProfileRoute(['FARMER']), '/farmer/profile');
    assert.equal(getUserSettingsRoute(['FARMER']), '/farmer/settings');
    assert.equal(getUserProfileRoute(['AGRONOMIST']), '/professional/profile');
    assert.equal(getUserSettingsRoute(['AGRONOMIST']), '/professional/settings');
  });

  it('n’ouvre les paramètres plateforme qu’avec la permission admin dédiée', () => {
    assert.equal(getUserSettingsRoute(['ADMIN']), '/settings');
    assert.equal(getUserSettingsRoute(['ADMIN'], ['admin.settings']), '/admin/settings');
  });

  it('chaque lien statique mène à un écran existant', () => {
    const casses: string[] = [];
    const motif = /(?:router\.(?:push|replace|navigate)\(\s*|href[:=]\s*\{?\s*|pathname:\s*)(['"`])(\/[^'"`$]*)\1/g;
    for (const f of fichiers(SRC)) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(motif)) {
        if (!existe(m[2])) casses.push(`${m[2]} (${relative(SRC, f).split(sep).join('/')})`);
      }
    }
    assert.ok(routes.length > 100, `relevé des écrans incomplet : ${routes.length}`);
    assert.deepEqual(casses, []);
  });

  it('les boutons « Nouvelle parcelle » de l’accueil ouvrent le formulaire, pas la liste', () => {
    const accueil = readFileSync(join(APP, 'farmer', '(tabs)', 'index.tsx'), 'utf8');
    const appels = [...accueil.matchAll(/t\('farmer\.newPlot'\)[^\n]*router\.push\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(appels.length >= 2, 'boutons « Nouvelle parcelle » introuvables');
    for (const cible of appels) assert.equal(cible, '/farmer/plots/create');
  });
});
