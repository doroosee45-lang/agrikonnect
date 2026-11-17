import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ONGLETS_PRODUCTEUR, ongletDeRoute, ongletsVisibles } from '../src/components/farmer/farmerTabs.ts';

/**
 * Relevé du 2026-11-16 : les 47 routes que recevait la barre quand tout l'espace
 * producteur était un seul navigateur à onglets. Depuis, les onglets sont isolés
 * dans farmer/(tabs) ; ce relevé vérifie que le filtre défensif tient toujours.
 */
const ROUTES_REELLES = [
  'index', 'farms', 'plots', 'productions', 'soil', 'plots/[id]',
  'alerts', 'certifications', 'devices', 'export/[id]', 'export/[id]/documents', 'export/index',
  'farms/[id]', 'farms/create', 'gallery', 'inventory', 'lots/[id]', 'lots/index', 'notifications',
  'orders/[id]', 'orders/index', 'orders/invoices', 'plots/[id]/plan', 'plots/[id]/precision-report',
  'plots/[id]/recommendations', 'plots/[id]/rotation', 'plots/[id]/satellite', 'plots/[id]/sensors',
  'plots/[id]/soil', 'plots/[id]/zones', 'plots/create', 'profile', 'projects/[id]',
  'projects/[id]/access-log', 'projects/[id]/dataroom', 'projects/[id]/reports', 'projects/index',
  'projects/new', 'public-profile', 'reviews', 'season-feedback', 'settings', 'surveys', 'sync',
  'sync/conflicts', 'transport', 'verification',
].map((name, i) => ({ name, key: `${name}-${i}` }));

const indexDe = (nom: string) => ROUTES_REELLES.findIndex((r) => r.name === nom);

describe('barre d’onglets producteur — filtrage des routes', () => {
  it('relevé réel : 47 routes reçues, 5 onglets affichés dans l’ordre de travail', () => {
    assert.equal(ROUTES_REELLES.length, 47);
    const { onglets } = ongletsVisibles(ROUTES_REELLES, 0);
    assert.deepEqual(onglets.map((r) => r.name), [...ONGLETS_PRODUCTEUR]);
  });

  it('aucun écran de détail, de création ou de réglage n’apparaît comme onglet', () => {
    const noms = ongletsVisibles(ROUTES_REELLES, 0).onglets.map((r) => r.name);
    for (const cache of ['farms/[id]', 'farms/create', 'plots/[id]', 'alerts', 'settings', 'sync/conflicts']) {
      assert.ok(!noms.includes(cache), `${cache} ne doit pas être un onglet`);
    }
  });

  it('« Exploitations » est actif sur la liste et sur le détail d’une exploitation', () => {
    assert.equal(ongletsVisibles(ROUTES_REELLES, indexDe('farms')).actif, 1);
    assert.equal(ongletsVisibles(ROUTES_REELLES, indexDe('farms/[id]')).actif, 1);
    assert.equal(ongletsVisibles(ROUTES_REELLES, indexDe('plots/[id]/zones')).actif, 2);
  });

  it('écran hors onglets → aucun onglet actif (pas d’indicateur sur un mauvais onglet)', () => {
    assert.equal(ongletsVisibles(ROUTES_REELLES, indexDe('alerts')).actif, -1);
    assert.equal(ongletsVisibles(ROUTES_REELLES, 999).actif, -1);
    assert.equal(ongletDeRoute('settings'), null);
  });

  it('une route d’onglet absente n’est pas inventée', () => {
    const { onglets } = ongletsVisibles(ROUTES_REELLES.filter((r) => r.name !== 'soil'), 0);
    assert.deepEqual(onglets.map((r) => r.name), ['index', 'farms', 'plots', 'productions']);
  });
});

import { appuyerOnglet } from '../src/components/farmer/farmerTabs.ts';

describe('barre d’onglets producteur — appui (props réelles d’Expo Router 58)', () => {
  const route = { name: 'farms', key: 'farms-k1' };
  const emetteur = (annule = false) => {
    const recus: string[] = [];
    return { recus, emit: (e: { target: string }) => { recus.push(e.target); return { defaultPrevented: annule }; } };
  };

  it('non-régression : sans objet `navigation`, l’appui navigue via navigateToTab au lieu de planter', () => {
    const cibles: string[] = [];
    const emitter = emetteur();
    const action = appuyerOnglet(route, false, { emitter, navigateToTab: (cle) => cibles.push(cle) });
    assert.equal(action, 'navigate');
    assert.deepEqual(cibles, ['farms-k1']);
    assert.deepEqual(emitter.recus, ['farms-k1']); // tabPress émis comme la barre par défaut
  });

  it('onglet déjà actif → aucune navigation', () => {
    const cibles: string[] = [];
    assert.equal(appuyerOnglet(route, true, { emitter: emetteur(), navigateToTab: (c) => cibles.push(c) }), 'ignore');
    assert.deepEqual(cibles, []);
  });

  it('tabPress annulé par un écran → aucune navigation', () => {
    const cibles: string[] = [];
    assert.equal(appuyerOnglet(route, false, { emitter: emetteur(true), navigateToTab: (c) => cibles.push(c) }), 'ignore');
    assert.deepEqual(cibles, []);
  });

  it('repli sur navigation.navigate si une version le fournit encore ; jamais d’exception sinon', () => {
    const noms: string[] = [];
    assert.equal(appuyerOnglet(route, false, { navigation: { navigate: (n) => noms.push(n) } }), 'navigate');
    assert.deepEqual(noms, ['farms']);
    assert.equal(appuyerOnglet(route, false, {}), 'indisponible');
  });
});
