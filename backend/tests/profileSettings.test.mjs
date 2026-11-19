import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountPreferencesSchema,
  professionalProfileSchema,
  updateMeSchema,
} from '../src/modules/users/users.schema.js';
import { updateOrganizationSchema } from '../src/modules/organizations/organizations.schema.js';

test('professional profile accepts optional individual career fields', () => {
  const parsed = professionalProfileSchema.parse({
    jobTitle: 'Agronome indépendant',
    activityDomain: 'Conseil agricole',
    specialties: ['Agroforesterie', 'Sol'],
    yearsExperience: 7,
    publicProfile: true,
    publicFields: ['identity', 'biography'],
  });

  assert.equal(parsed.yearsExperience, 7);
  assert.equal(parsed.publicProfile, true);
});

test('individual profile update rejects organization legal fields', () => {
  assert.throws(
    () =>
      updateMeSchema.parse({
        firstName: 'Amina',
        registrationNumber: 'RCCM-123',
      }),
    /Unrecognized key/,
  );
});

test('organization settings are distinct and validated independently', () => {
  const parsed = updateOrganizationSchema.parse({
    name: 'Coopérative Kivu',
    profileDetails: {
      officialName: 'Coopérative agricole Kivu',
      legalForm: 'Coopérative',
      activities: ['Café', 'Cacao'],
      institutionalEmail: 'contact@example.org',
    },
    settings: {
      defaultLocale: 'fr',
      publicProfile: true,
      memberInvitesAllowed: false,
    },
  });

  assert.equal(parsed.profileDetails.legalForm, 'Coopérative');
  assert.deepEqual(parsed.profileDetails.activities, ['Café', 'Cacao']);
  assert.equal(parsed.settings.publicProfile, true);
});

test('organization update does not accept person-only professional fields', () => {
  assert.throws(
    () =>
      updateOrganizationSchema.parse({
        professionalProfile: { jobTitle: 'Agronome' },
      }),
    /Unrecognized key/,
  );
});

test('account communication preferences remain separate from notification matrix', () => {
  const parsed = updateMeSchema.parse({
    accountPreferences: {
      theme: 'system',
      communicationEmail: true,
      communicationSms: false,
    },
  });

  assert.equal(accountPreferencesSchema.parse(parsed.accountPreferences).communicationSms, false);
  assert.equal('notificationPreferences' in parsed, false);
});

// ─── Complétude : critère « professional » conditionnel aux responsabilités ───

const { completenessCriteria, ROLES_PROFIL_PROFESSIONNEL } = await import('../src/modules/users/users.service.js');

const profilVide = { firstName: 'Awa', lastName: 'Kabila', professionalProfile: null };
const cles = (roles, profile = profilVide) =>
  completenessCriteria({ profile, farms: 0, plots: 0, productions: 0, roles }).map((c) => c.key);

test('completeness: professional profile required only for roles that intervene personally', () => {
  assert.deepEqual(ROLES_PROFIL_PROFESSIONNEL, ['AGRONOMIST', 'VERIFIER', 'LAB_PARTNER', 'SUPPORT_AGENT']);
  for (const role of ROLES_PROFIL_PROFESSIONNEL) {
    assert.ok(cles([role]).includes('professional'), `${role} : critère attendu`);
  }
  for (const role of ['BUYER', 'SUPPLIER', 'TRANSPORTER', 'INVESTOR', 'FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY']) {
    assert.equal(cles([role]).includes('professional'), false, `${role} : critère non applicable`);
  }
});

test('completeness: unchanged lists for historical roles (no regression)', () => {
  assert.deepEqual(cles(['FARMER']), ['identity', 'phone_verified', 'email_verified', 'avatar', 'farm', 'plot', 'production']);
  assert.deepEqual(cles(['BUYER']), ['identity', 'phone_verified', 'email_verified', 'avatar']);
  assert.deepEqual(cles(['INVESTOR']), ['identity', 'phone_verified', 'email_verified', 'avatar']);
  assert.deepEqual(cles([]), ['identity', 'phone_verified', 'email_verified', 'avatar']);
});

test('completeness: cumulative responsibilities add both criteria families', () => {
  assert.deepEqual(
    cles(['FARMER', 'AGRONOMIST']),
    ['identity', 'phone_verified', 'email_verified', 'avatar', 'professional', 'farm', 'plot', 'production'],
  );
});

test('completeness: professional criterion is done only when job, domain and biography are filled', () => {
  const critere = (professionalProfile) => completenessCriteria({
    profile: { ...profilVide, professionalProfile }, farms: 0, plots: 0, productions: 0, roles: ['AGRONOMIST'],
  }).find((c) => c.key === 'professional');
  assert.equal(critere(null).done, false);
  assert.equal(critere({ jobTitle: 'Agronome', activityDomain: 'Sols' }).done, false);
  assert.equal(critere({ jobTitle: 'Agronome', activityDomain: 'Sols', biography: 'Conseil depuis 2018' }).done, true);
});
