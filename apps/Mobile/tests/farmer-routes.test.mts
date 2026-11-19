import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ONGLETS_PRODUCTEUR } from '../src/components/farmer/farmerTabs.ts';

/**
 * Non-régression : « Nouvelle exploitation » / « Nouvelle parcelle » n'ouvraient
 * aucun formulaire. Dans Expo Router 58, un navigateur à onglets redirige vers
 * le premier onglet tout écran non déclaré (ou `href: null`) : ces écrans, et
 * une quarantaine d'autres, étaient inaccessibles. Les onglets sont désormais
 * isolés dans `farmer/(tabs)`, le reste vit dans la pile `farmer/_layout.tsx`.
 */
const FARMER = fileURLToPath(new URL('../src/app/farmer/', import.meta.url));
const TABS = join(FARMER, '(tabs)');

const ecransDuGroupe = readdirSync(TABS, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.tsx') && e.name !== '_layout.tsx')
  .map((e) => e.name.replace(/\.tsx$/, ''));
const layoutTabs = readFileSync(join(TABS, '_layout.tsx'), 'utf8');
const declares = [...layoutTabs.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);

describe('espace producteur — routes', () => {
  it('le groupe (tabs) contient exactement les cinq onglets, tous déclarés et sans href: null', () => {
    assert.deepEqual([...ecransDuGroupe].sort(), [...ONGLETS_PRODUCTEUR].sort());
    assert.deepEqual(declares, [...ONGLETS_PRODUCTEUR]);
    // Option réelle `href: null` (le commentaire du layout la cite entre accents graves).
    assert.ok(!/href:\s*null\s*[,}]/.test(layoutTabs), 'un écran masqué dans des onglets est redirigé : interdit');
    assert.equal(readdirSync(TABS, { withFileTypes: true }).filter((e) => e.isDirectory()).length, 0, 'aucun sous-dossier (détails) dans les onglets');
  });

  it('l’espace producteur est une pile (Stack), pas des onglets', () => {
    const layout = readFileSync(join(FARMER, '_layout.tsx'), 'utf8');
    assert.match(layout, /<Stack\b/);
    assert.doesNotMatch(layout, /<Tabs\b/);
  });

  it('les formulaires de création existent hors des onglets (accessibles par la pile)', () => {
    for (const ecran of ['farms/create.tsx', 'plots/create.tsx', 'farms/[id].tsx', 'plots/[id].tsx', 'alerts.tsx']) {
      assert.ok(existsSync(join(FARMER, ecran)), `${ecran} manquant`);
      assert.ok(!existsSync(join(TABS, ecran)), `${ecran} ne doit pas être dans (tabs)`);
    }
  });
});
