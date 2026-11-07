/**
 * Grille de tests de la destination initiale MOBILE (CAA section 10).
 *
 * Miroir logique de la grille web (apps/web/scripts/redirects.test.mjs) :
 * memes scenarios, destinations = routes mobiles reelles (2026-11-05).
 *
 * Execution : node --test apps/Mobile/scripts/redirects.test.mjs
 * (Node 23+ : import direct du module TypeScript par effacement de types.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ECRAN_ATTENTE,
  ECRAN_SUR,
  getUserInitialRoute,
  getRoles,
  resolveActiveContext,
  setActiveOrganizationId,
} from '../src/lib/redirects.ts';

/*
 * localStorage simule : Node ne le fournit pas de facon fiable (webstorage
 * optionnel selon les versions). Le shim rend le test deterministe partout.
 */
const magasin = new Map();
globalThis.localStorage = {
  getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
  setItem: (k, v) => magasin.set(k, String(v)),
  removeItem: (k) => magasin.delete(k),
};

const userDe = (roles, plus = {}) => ({
  status: 'ACTIVE',
  email: 'x@exemple.com',
  emailVerified: true,
  firstName: 'Ada',
  lastName: 'Lovelace',
  organizations: [{ id: 'org-1', roles }],
  ...plus,
});

const aller = (roles, plus = {}, input = {}) =>
  getUserInitialRoute({ user: userDe(roles, plus), permissions: ['admin.dashboard'], ...input });

describe('destination initiale - 16 roles vers leurs espaces reels (mobile)', () => {
  const attendus = [
    ['SUPER_ADMIN', '/admin/dashboard'],
    ['ADMIN', '/admin/dashboard'],
    ['MODERATOR', '/admin/dashboard'],
    ['FARMER', '/farmer'],
    ['COOPERATIVE_ADMIN', '/organization'],
    ['COOPERATIVE_MEMBER', '/organization'],
    ['AGRICULTURAL_COMPANY', '/organization'],
    ['BUYER', '/marketplace'],
    ['SUPPLIER', '/marketplace'],
    ['TRANSPORTER', '/profil'],
    ['AGRONOMIST', '/reviewer/missions'],
    ['LAB_PARTNER', '/reviewer/missions'],
    ['INVESTOR', '/investment'],
    ['SUPPORT_AGENT', '/agent/consent'],
    ['API_CLIENT', '/developers'],
    ['PUBLIC_USER', '/notifications'],
  ];
  for (const [role, destination] of attendus) {
    it(`${role} -> ${destination}`, () => {
      assert.equal(aller([role]).route, destination);
    });
  }
});

describe('securite - aucune elevation, aucun espace arbitraire', () => {
  it('MODERATOR sans permission admin.dashboard n entre pas dans /admin', () => {
    const r = getUserInitialRoute({
      user: userDe(['MODERATOR']),
      permissions: ['admin.moderation'],
    });
    assert.equal(r.route, ECRAN_SUR);
  });

  it('SUPER_ADMIN sans permission admin.dashboard non plus', () => {
    const r = getUserInitialRoute({ user: userDe(['SUPER_ADMIN']), permissions: [] });
    assert.equal(r.route, ECRAN_SUR);
  });

  it('role inconnu -> ecran sur', () => {
    assert.equal(aller(['SORCIER']).route, ECRAN_SUR);
  });

  it('aucun role -> ecran sur', () => {
    assert.equal(aller([]).route, ECRAN_SUR);
  });

  it('compte suspendu -> espace d attente, jamais l espace metier', () => {
    assert.equal(aller(['FARMER'], { status: 'SUSPENDED' }).route, ECRAN_ATTENTE);
  });
});

describe('verification e-mail - parcours dedie, jamais bloque pour du facultatif', () => {
  it('e-mail non verifie -> ecran de verification avec l adresse pre-remplie', () => {
    const r = aller(['FARMER'], { email: 'awa@exemple.com', emailVerified: false });
    assert.equal(r.route, '/auth/verify-email?email=awa%40exemple.com');
  });

  it('compte sans e-mail (telephone seul) -> espace direct, aucune verification e-mail', () => {
    const r = aller(['FARMER'], { email: null });
    assert.equal(r.route, '/farmer');
  });

  it('completeness incomplete hors identite (exploitation, parcelle...) -> acces libre', () => {
    const r = getUserInitialRoute({
      user: userDe(['FARMER']),
      completeness: [
        { key: 'identity', done: true },
        { key: 'farm', done: false },
        { key: 'plot', done: false },
        { key: 'production', done: false },
      ],
    });
    assert.equal(r.route, '/farmer');
  });

  it('identite manquante -> ecran de configuration du role, pas de blocage ailleurs', () => {
    const r = aller(['FARMER'], { firstName: '', lastName: '' });
    assert.equal(r.route, '/farmer/profile');
    assert.equal(aller(['COOPERATIVE_ADMIN'], { firstName: '' }).route, '/organization/profile');
    assert.equal(aller(['INVESTOR'], { lastName: '' }).route, '/investment/profile');
    assert.equal(aller(['BUYER'], { firstName: '' }).route, '/profil');
  });
});

describe('multi-roles et multi-organisations - contexte actif', () => {
  it('multi-roles : la priorite documentee tranche', () => {
    assert.equal(aller(['FARMER', 'BUYER']).route, '/farmer');
    assert.equal(aller(['BUYER', 'ADMIN']).route, '/admin/dashboard');
  });

  it('multi-organisations : le contexte actif explicite decide', () => {
    const user = {
      status: 'ACTIVE',
      email: 'x@exemple.com',
      emailVerified: true,
      firstName: 'Ada',
      lastName: 'Lovelace',
      organizations: [
        { id: 'org-farm', roles: ['FARMER'] },
        { id: 'org-buy', roles: ['BUYER'] },
      ],
    };
    assert.equal(
      getUserInitialRoute({ user, activeOrganizationId: 'org-buy' }).route,
      '/marketplace',
    );
    assert.equal(
      getUserInitialRoute({ user, activeOrganizationId: 'org-farm' }).route,
      '/farmer',
    );
  });

  it('contexte memorise (localStorage) pris en compte puis neutralisable', () => {
    const user = {
      status: 'ACTIVE',
      email: 'x@exemple.com',
      emailVerified: true,
      firstName: 'Ada',
      lastName: 'Lovelace',
      organizations: [
        { id: 'org-farm', roles: ['FARMER'] },
        { id: 'org-buy', roles: ['BUYER'] },
      ],
    };
    setActiveOrganizationId('org-buy');
    assert.equal(getUserInitialRoute({ user }).route, '/marketplace');
    setActiveOrganizationId(null);
    assert.equal(getUserInitialRoute({ user }).route, '/farmer');
  });

  it('sans contexte : priorite par meilleur role des organisations', () => {
    const user = {
      status: 'ACTIVE',
      email: 'x@exemple.com',
      emailVerified: true,
      firstName: 'Ada',
      lastName: 'Lovelace',
      organizations: [
        { id: 'org-a', roles: ['PUBLIC_USER'] },
        { id: 'org-b', roles: ['COOPERATIVE_ADMIN'] },
      ],
    };
    assert.equal(resolveActiveContext(user).organizationId, 'org-b');
    assert.equal(getUserInitialRoute({ user }).route, '/organization');
    assert.deepEqual(getRoles(user).sort(), ['COOPERATIVE_ADMIN', 'PUBLIC_USER']);
  });
});
