import './helpers/pinTestEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DATA_MODES,
  assertDataModeAllowed,
  dataModeLabel,
  isRealMeasurement,
  resolveDataMode,
} from '../src/shared/dataMode.js';

/**
 * Marquage des données géospatiales simulées.
 *
 * L'enjeu n'est pas cosmétique : l'agriculteur décide quoi semer à partir de ces
 * valeurs. Une valeur générée qui passerait pour une mesure de sonde est une
 * donnée inventée, ce que le CDC interdit explicitement.
 */

test('DataMode : les trois modes existent et seul REAL est une mesure', () => {
  assert.deepEqual([...DATA_MODES], ['REAL', 'CONFIGURATION', 'SIMULATED']);
  assert.equal(isRealMeasurement('REAL'), true);
  assert.equal(isRealMeasurement('CONFIGURATION'), false, 'un équipement non encore en service ne mesure rien');
  assert.equal(isRealMeasurement('SIMULATED'), false);
});

test('DataMode : l’absence de mode vaut REAL, une valeur inconnue est refusée', () => {
  // Le chemin nominal (une vraie sonde qui pousse une mesure) ne change pas.
  assert.equal(resolveDataMode(undefined), 'REAL');
  assert.equal(resolveDataMode(null), 'REAL');
  assert.equal(resolveDataMode(''), 'REAL');
  assert.equal(resolveDataMode('simulated'), 'SIMULATED', 'insensible à la casse');

  assert.throws(
    () => resolveDataMode('PEUT_ETRE'),
    (error) => error.status === 422 && /Mode de donnée invalide/.test(error.message),
    'un mode inconnu ne doit pas être deviné'
  );
});

test('DataMode : la simulation est refusée en production, quelle que soit la configuration', () => {
  // Cœur du verrou : même avec SIMULATION_ENABLED=true, la production refuse.
  assert.throws(
    () => assertDataModeAllowed('SIMULATED', { isProd: true, simulationAllowed: true }),
    (error) => error.status === 403 && /refusées en production/.test(error.message),
    'aucune variable ne peut autoriser une donnée simulée en production'
  );
});

test('DataMode : la simulation est acceptée hors production quand elle est activée', () => {
  assert.equal(
    assertDataModeAllowed('SIMULATED', { isProd: false, simulationAllowed: true }),
    'SIMULATED'
  );
  // Et le mode résolu est renvoyé pour être persisté tel quel.
  assert.equal(assertDataModeAllowed(undefined, { isProd: false, simulationAllowed: true }), 'REAL');
  assert.equal(
    assertDataModeAllowed('CONFIGURATION', { isProd: false, simulationAllowed: true }),
    'CONFIGURATION'
  );
});

test('DataMode : SIMULATION_ENABLED=false refuse la simulation même hors production', () => {
  assert.throws(
    () => assertDataModeAllowed('SIMULATED', { isProd: false, simulationAllowed: false }),
    (error) => error.status === 403 && /SIMULATION_ENABLED=false/.test(error.message)
  );
});

test('DataMode : REAL et CONFIGURATION ne sont jamais bloqués par le verrou', () => {
  // Une vraie mesure passe partout, y compris en production.
  assert.equal(assertDataModeAllowed('REAL', { isProd: true, simulationAllowed: false }), 'REAL');
  // Un équipement enregistré mais hors service n'est pas une donnée inventée :
  // c'est un état déclaré, il reste enregistrable.
  assert.equal(
    assertDataModeAllowed('CONFIGURATION', { isProd: true, simulationAllowed: false }),
    'CONFIGURATION'
  );
});

test('DataMode : toute valeur non réelle porte un avertissement explicite', () => {
  const simulated = dataModeLabel('SIMULATED');
  assert.equal(simulated.isReal, false);
  assert.match(simulated.warning, /générée/, 'la valeur simulée est annoncée comme générée');
  assert.match(simulated.warning, /aucune mesure/, 'il est dit qu’elle ne provient d’aucune mesure');

  const configuration = dataModeLabel('CONFIGURATION');
  assert.equal(configuration.isReal, false);
  assert.match(configuration.warning, /pas encore en service/);

  const real = dataModeLabel('REAL');
  assert.equal(real.isReal, true);
  assert.equal(real.warning, null, 'aucun avertissement pour une mesure réelle');
});

test('DataMode : le verrou de production tient aussi avec un contexte partiel', () => {
  // Défaut du contexte : isProd=false, simulationAllowed=true.
  assert.equal(assertDataModeAllowed('SIMULATED', {}), 'SIMULATED');
  // isProd seul suffit à fermer la porte.
  assert.throws(() => assertDataModeAllowed('SIMULATED', { isProd: true }), /refusées en production/);
});

/* ─── Intégration : le garde est réellement branché sur l'ingestion ─── */

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import { sha256 } from '../src/shared/crypto.js';
import * as iotService from '../src/modules/iot/iot.service.js';

const ORG = 'org_1';
const reqAs = () => ({
  tenant: { organizationId: ORG, effectiveRoles: ['PRODUCER'] },
  user: { id: 'user_1', roles: ['PRODUCER'] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  requestId: 'req_test',
});

const deviceStore = (key, overrides = {}) => ({
  iotDevice: [
    {
      id: 'dev_1',
      organizationId: ORG,
      plotId: 'plot_1',
      label: 'Sonde A',
      keyHash: sha256(key),
      status: 'ACTIVE',
      thresholds: null,
      ...overrides,
    },
  ],
  sensorReading: [],
  sensorAnomaly: [],
});

test('DataMode (ingestion) : une mesure réelle passe et porte son mode', async () => {
  const key = 'cle-appareil-reelle';
  const { restore } = await withFakePrisma(prisma, deviceStore(key));
  try {
    const result = await iotService.ingest(
      {
        deviceKey: key,
        readings: [
          { metric: 'humidityPct', value: 38, depthCm: 40, confidence: 'high', source: 'measured_sensor' },
        ],
      },
      reqAs(),
    );
    assert.equal(result.accepted, 1);
    assert.equal(result.dataMode, 'REAL');
    assert.equal(result.dataModeNotice, undefined, 'aucun avertissement pour une mesure réelle');
  } finally {
    restore();
  }
});

test('DataMode (ingestion) : une valeur simulée est étiquetée, jamais présentée comme réelle', async () => {
  const key = 'cle-appareil-simulee';
  const { restore } = await withFakePrisma(prisma, deviceStore(key));
  try {
    const result = await iotService.ingest(
      {
        deviceKey: key,
        readings: [{ metric: 'humidityPct', value: 41, mode: 'SIMULATED' }],
      },
      reqAs(),
    );
    assert.equal(result.dataMode, 'SIMULATED');
    assert.equal(result.dataModeNotice.isReal, false);
    assert.match(result.dataModeNotice.warning, /aucune mesure/);
  } finally {
    restore();
  }
});

test('DataMode (ingestion) : un mode invalide est refusé avant toute écriture', async () => {
  const key = 'cle-appareil-invalide';
  const { restore } = await withFakePrisma(prisma, deviceStore(key));
  try {
    await assert.rejects(
      iotService.ingest(
        { deviceKey: key, readings: [{ metric: 'humidityPct', value: 41, mode: 'PEUT_ETRE' }] },
        reqAs(),
      ),
      (error) => error.status === 422 && /Mode de donnée invalide/.test(error.message)
    );
  } finally {
    restore();
  }
});

/* ─── Le verrou de production, vérifié à sa source ─── */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * `env` est figé à l'import : on ne peut pas retourner `NODE_ENV` dans le
 * processus de test. On lance donc un sous-processus en production et on lit la
 * valeur réellement calculée. C'est le maillon entre la configuration et le
 * garde — sans lui, « bloqué en production » ne serait qu'une intention.
 */
const envDeSonde = {
  PATH: process.env.PATH ?? '',
  SystemRoot: process.env.SystemRoot ?? '',
  ComSpec: process.env.ComSpec ?? '',
  DATABASE_URL: 'postgresql://agrikon:test@127.0.0.1:54321/sonde',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'cle-anon-de-sonde',
  SMS_PROVIDER: 'console',
  EMAIL_PROVIDER: 'console',
};

const probeSimulationAllowed = async (nodeEnv, extra = {}) => {
  const args = [
    '--input-type=module',
    '-e',
    "import('./src/config/env.js').then(({env})=>console.log(env.simulationAllowed))",
  ];
  const options = {
    // Windows : URL.pathname donne « /D:/...%20... » — fileURLToPath donne le
    // vrai chemin du dossier.
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...envDeSonde, NODE_ENV: nodeEnv, ...extra },
    maxBuffer: 8 * 1024 * 1024,
  };
  /*
   * Sous Windows, une nuée de processus parallèles peut faire échouer le
   * lancement lui-même (ENOENT/EAGAIN transitoires) : une seconde tentative
   * suffit. Un échec du processus enfant, lui, n'est jamais retenté — son
   * message doit remonter tel quel.
   */
  for (let tentative = 0; tentative < 2; tentative += 1) {
    try {
      const { stdout } = await execFileAsync(process.execPath, args, options);
      const lignes = stdout.trim().split('\n');
      return lignes[lignes.length - 1].trim();
    } catch (erreur) {
      const rattrapable = ['ENOENT', 'EAGAIN', 'EMFILE'].includes(erreur.code);
      if (!rattrapable || tentative === 1) {
        const sortie = String(erreur.stdout ?? '') + ' ' + String(erreur.stderr ?? '');
        throw new Error(
          'Sonde env.js impossible (NODE_ENV=' + nodeEnv + ') : '
          + erreur.message + ' — sortie : ' + sortie.trim(),
        );
      }
    }
  }
};

test('DataMode (config) : la production ferme la porte même avec SIMULATION_ENABLED=true', async () => {
  assert.equal(await probeSimulationAllowed('production', { SIMULATION_ENABLED: 'true' }), 'false');
  assert.equal(await probeSimulationAllowed('production', { SIMULATION_ENABLED: 'false' }), 'false');
  // Hors production, le drapeau pilote réellement.
  assert.equal(await probeSimulationAllowed('development', { SIMULATION_ENABLED: 'true' }), 'true');
  assert.equal(await probeSimulationAllowed('development', { SIMULATION_ENABLED: 'false' }), 'false');
  assert.equal(await probeSimulationAllowed('test', { SIMULATION_ENABLED: 'true' }), 'true');
});
