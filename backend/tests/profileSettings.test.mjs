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
