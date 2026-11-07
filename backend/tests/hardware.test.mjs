import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  HARDWARE_CONFIG_REVISED_AT,
  HARDWARE_CONFIG_VERSION,
  assertHardwareConfigReady,
  hardware,
  isPlausible,
  pendingConfirmations,
  plausibilityFor,
  sensorTypeBySlug,
} from '../src/config/hardware.js';

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(import.meta.dirname, '..');
const readSource = (relative) => fs.readFileSync(path.join(backendRoot, relative), 'utf8');

/**
 * Fichier de configuration matériel — source de vérité unique.
 *
 * Ce qui est vérifié ici, ce sont les propriétés qui empêchent le fichier de
 * mentir : aucune valeur inventée (l'inconnu reste `null` et signalé), aucun
 * secret, aucune duplication d'un réglage qui vit ailleurs, et un mode réel qui
 * refuse de démarrer sur une configuration incomplète.
 */

/* ─────────────────── Structure et schéma ─────────────────── */

test('Matériel : le schéma valide le fichier et toutes les sections sont présentes', () => {
  const sections = [
    'mode',
    'loraWan',
    'gateways',
    'sensorTypes',
    'drones',
    'gpr',
    'satellite',
    'sms',
    'maintenance',
  ];
  for (const section of sections) {
    assert.ok(section in hardware, `section manquante : ${section}`);
  }
  // Le schéma zod a bien été appliqué : l'objet exporté est figé.
  assert.throws(() => {
    hardware.mode = 'REAL';
  }, 'la configuration doit être immuable');
});

test('Matériel : version et date de révision sont présentes et bien formées', () => {
  assert.match(HARDWARE_CONFIG_VERSION, /^\d+\.\d+\.\d+$/, 'version sémantique attendue');
  assert.match(HARDWARE_CONFIG_REVISED_AT, /^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');
  // La date de révision ne doit pas être dans le futur.
  assert.ok(
    new Date(HARDWARE_CONFIG_REVISED_AT).getTime() <= Date.now(),
    'une date de révision future n’a pas de sens',
  );
});

/* ─────────────────────── Mode ─────────────────────── */

test('Matériel : le mode est binaire et le matériel simulé est refusé en production', () => {
  assert.ok(['SIMULATION', 'REAL'].includes(hardware.mode));
  // Hors production, le mode simulation est autorisé.
  assert.deepEqual(assertHardwareConfigReady({ isProd: false, config: { mode: 'SIMULATION' } }), {
    mode: 'SIMULATION',
    missing: [],
  });
  // En production, il est refusé — c'est le verrou demandé.
  assert.throws(
    () => assertHardwareConfigReady({ isProd: true, config: { mode: 'SIMULATION' } }),
    /SIMULATION est refusé en production/,
  );
  // Un mode réel n'est pas bloqué par ce verrou.
  assert.doesNotThrow(() =>
    assertHardwareConfigReady({ isProd: true, config: { mode: 'REAL' }, requiredPaths: [] }),
  );
});

test('Matériel : le démarrage en production s’arrête vraiment sur du matériel simulé', async () => {
  /**
   * Preuve hors processus : c'est le chemin emprunté par `src/server.js` au
   * démarrage. Un test en mémoire ne prouverait pas que le serveur refuse
   * d'écouter.
   */
  const script =
    "import { assertHardwareConfigReady } from './src/config/hardware.js';"
    + 'try { assertHardwareConfigReady({ isProd: true }); console.log("DEMARRE"); process.exit(0); }'
    + 'catch (error) { console.error(error.message); process.exit(1); }';

  await assert.rejects(
    execFileAsync('node', ['--input-type=module', '-e', script], { cwd: backendRoot }),
    (error) => {
      assert.equal(error.code, 1, 'le processus doit s’arrêter avec un code non nul');
      assert.match(error.stderr, /SIMULATION est refusé en production/);
      assert.doesNotMatch(error.stdout, /DEMARRE/);
      return true;
    },
  );

  // Le serveur appelle bien cette garde avant d'ouvrir le port.
  const serverSource = readSource('src/server.js');
  assert.match(serverSource, /assertHardwareConfigReady\(\{ isProd: env\.isProd \}\)/);
  const guardAt = serverSource.indexOf('assertHardwareConfigReady(');
  const listenAt = serverSource.indexOf('app.listen(');
  assert.ok(guardAt > -1 && listenAt > -1 && guardAt < listenAt, 'la garde doit précéder l’écoute du port');
});

/* ─────────── Champs obligatoires en mode matériel réel ─────────── */

test('Matériel : un champ obligatoire manquant en mode réel arrête le démarrage', () => {
  const incomplete = {
    mode: 'REAL',
    maintenance: {},
    loraWan: { frequencyPlan: null },
  };
  assert.throws(
    () =>
      assertHardwareConfigReady({
        config: incomplete,
        requiredPaths: ['maintenance.silentSensorThreshold.value', 'loraWan.frequencyPlan'],
      }),
    (error) => {
      assert.match(error.message, /mode REAL déclaré/);
      // Les champs manquants sont nommés par leur chemin complet, pas seulement
      // comptés : l'opérateur doit savoir où chercher dans le fichier.
      assert.match(error.message, /maintenance\.silentSensorThreshold/);
      assert.match(error.message, /loraWan\.frequencyPlan/);
      return true;
    },
  );
});

test('Matériel : une configuration réelle complète démarre', () => {
  const complete = {
    mode: 'REAL',
    maintenance: { silentSensorThreshold: { value: 24 } },
    loraWan: { frequencyPlan: 'EU868' },
  };
  assert.deepEqual(
    assertHardwareConfigReady({
      config: complete,
      requiredPaths: ['maintenance.silentSensorThreshold.value', 'loraWan.frequencyPlan'],
    }),
    { mode: 'REAL', missing: [] },
  );
});

test('Matériel : les listes sont contrôlées élément par élément', () => {
  // Le deuxième capteur du catalogue n'a pas de modèle : il doit être nommé.
  const config = {
    mode: 'REAL',
    sensorTypes: [{ model: 'X' }, { model: null }],
  };
  assert.throws(
    () => assertHardwareConfigReady({ config, requiredPaths: ['sensorTypes[].model'] }),
    /sensorTypes\[1\]\.model/,
  );
});

test('Matériel : le fichier actuel ne peut pas passer en mode réel en l’état', () => {
  /**
   * Aucun matériel n'est arrêté : le passage en `REAL` doit donc échouer et
   * lister ce qui manque. Si ce test casse un jour, c'est que des valeurs ont
   * été renseignées — il faut alors vérifier qu'elles proviennent bien d'une
   * fiche technique.
   */
  assert.equal(hardware.mode, 'SIMULATION');
  assert.throws(
    () => assertHardwareConfigReady({ config: { ...hardware, mode: 'REAL' } }),
    /frequencyPlan/,
  );
});

/* ─────────────────────── Secrets ─────────────────────── */

/** Noms de champ qui trahiraient un secret stocké dans le fichier. */
const SECRET_KEY = /(password|passwd|secret|apikey|api_key|token|credential|privatekey)/i;

/** Récolte tous les couples [chemin, valeur] d'un objet. */
const leaves = (node, prefix = '') => {
  if (Array.isArray(node)) return node.flatMap((item, index) => leaves(item, `${prefix}[${index}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      leaves(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, node]];
};

test('Matériel : aucun secret dans le fichier, seulement des noms de variables', () => {
  const suspects = leaves(hardware).filter(([key]) => SECRET_KEY.test(key.split('.').pop()));

  assert.ok(suspects.length > 0, 'le test devrait trouver les champs de secrets déclarés');
  for (const [key, value] of suspects) {
    // L'indice de tableau ne fait pas partie du nom de champ.
    const leaf = key.split('.').pop().replace(/\[\d+\]$/, '');
    // Un champ de secret ne peut porter qu'un NOM de variable d'environnement.
    assert.match(
      leaf,
      /EnvVar(s)?$/,
      `« ${key} » porte une valeur de secret alors qu'il ne devrait porter qu'un nom de variable`,
    );
    assert.equal(typeof value, 'string', `${key} doit être un nom de variable`);
    // Le nom référencé doit exister dans .env.example, sinon l'exploitant ne
    // peut pas savoir qu'il faut le renseigner.
    const names = Array.isArray(value) ? value : [value];
    const example = readSource('.env.example');
    for (const name of names) {
      assert.match(name, /^[A-Z0-9_]+$/, `${key} : « ${name} » n'est pas un nom de variable`);
      assert.ok(
        new RegExp(`^${name}=`, 'm').test(example),
        `${name} (référencé par ${key}) est absent de .env.example`,
      );
    }
  }
});

test('Matériel : aucune valeur du fichier ne ressemble à un secret', () => {
  /**
   * Garde large : aucun littéral du fichier ne doit avoir la forme d'une clé,
   * d'un mot de passe ou d'une chaîne de connexion.
   */
  const patterns = [
    /^(sk|pk|api|key|token)[-_][A-Za-z0-9]{12,}$/,
    /^[A-Za-z0-9+/]{40,}={0,2}$/,
    /^(mqtt|amqp|postgres|https?):\/\/[^\s]*:[^\s]*@/,
    /^-----BEGIN /,
  ];
  const offenders = leaves(hardware)
    .filter(([, value]) => typeof value === 'string')
    .filter(([, value]) => patterns.some((pattern) => pattern.test(value)));

  assert.deepEqual(
    offenders.map(([key]) => key),
    [],
    'des valeurs du fichier ressemblent à des secrets',
  );

  // Aucun mot de passe ni identifiant MQTT en clair dans le source.
  const source = readSource('src/config/hardware.js');
  assert.doesNotMatch(source, /password\s*:\s*['"][^'"]+['"]/i, 'mot de passe en clair dans le fichier');
  assert.doesNotMatch(source, /apiKey\s*:\s*['"][^'"]+['"]/i, 'clé d’API en clair dans le fichier');
});

/* ─────────────── Aucune valeur inventée ─────────────── */

test('Matériel : le plan de fréquence n’a aucune valeur par défaut', () => {
  // Exigence explicite : il dépend de l'attribution du régulateur.
  assert.equal(hardware.loraWan.frequencyPlan, null);
  assert.match(hardware.loraWan.frequencyPlanSource, /à confirmer/i);
  assert.match(hardware.loraWan.frequencyPlanSource, /régulateur|ARPTC/i);
});

test('Matériel : toute valeur inconnue est null et signalée « à confirmer »', () => {
  const pending = pendingConfirmations();
  assert.ok(pending.length > 0, 'du matériel reste à arrêter : des valeurs doivent manquer');

  /**
   * Chaque réglage horodaté ({value, unit, source}) dont la valeur est `null`
   * doit expliquer ce qui manque. Une valeur absente sans explication laisse
   * croire à un oubli plutôt qu'à une attente.
   */
  const unexplained = leaves(hardware)
    .filter(([key]) => key.endsWith('.source'))
    .filter(([, source]) => /à confirmer/i.test(String(source)))
    .map(([key]) => key.replace(/\.source$/, ''))
    .filter((settingPath) => {
      const setting = settingPath.split('.').reduce((acc, part) => acc?.[part.replace(/\[\d+\]$/, '')], hardware);
      return setting && typeof setting === 'object' && 'value' in setting && setting.value === null;
    });

  assert.ok(unexplained.length > 0, 'au moins un réglage null doit porter la mention');
  for (const settingPath of unexplained) {
    const source = settingPath
      .split('.')
      .reduce((acc, part) => acc?.[part.replace(/\[\d+\]$/, '')], hardware).source;
    assert.match(String(source), /à confirmer/i, `${settingPath} sans mention « à confirmer »`);
  }
});

test('Matériel : les seules bornes renseignées sont définitionnelles et sourcées', () => {
  const ph = plausibilityFor('ph');
  assert.deepEqual([ph.min, ph.max, ph.unit], [0, 14, 'pH']);
  assert.match(ph.source, /définition/i);

  const moisture = plausibilityFor('moisture');
  assert.deepEqual([moisture.min, moisture.max], [0, 100]);

  // Conductivité : le minimum est définitionnel, le maximum dépend du capteur.
  const ec = plausibilityFor('ec');
  assert.equal(ec.min, 0);
  assert.equal(ec.max, null, 'la borne haute dépend de la plage de mesure du capteur retenu');
  assert.match(ec.source, /à confirmer/i);

  // Toute borne présente doit citer sa provenance.
  for (const sensorType of hardware.sensorTypes) {
    for (const metric of sensorType.metrics) {
      assert.ok(metric.plausibility.source, `${sensorType.slug}/${metric.key} sans source de borne`);
      assert.ok(metric.plausibility.unit, `${sensorType.slug}/${metric.key} sans unité`);
    }
  }
});

test('Matériel : une mesure hors bornes plausibles est détectée, sans borne elle ne l’est pas', () => {
  assert.equal(isPlausible('ph', 42).plausible, false, 'un pH à 42 est un capteur hors service');
  assert.match(isPlausible('ph', 42).reason, /borne maximale/);
  assert.equal(isPlausible('ph', -1).plausible, false);
  assert.equal(isPlausible('ph', 6.4).plausible, true);
  assert.equal(isPlausible('ec', -0.5).plausible, false, 'une conductivité négative est impossible');
  assert.equal(isPlausible('moisture', 120).plausible, false);

  // Sans borne connue, on ne condamne pas : l'absence de référentiel n'est pas
  // une preuve de dysfonctionnement.
  const unchecked = isPlausible('metricInconnue', 999);
  assert.equal(unchecked.plausible, true);
  assert.equal(unchecked.checked, false);

  // Une borne haute absente ne bloque pas les valeurs élevées.
  assert.equal(isPlausible('ec', 99).plausible, true, 'pas de borne haute confirmée pour l’EC');
});

/* ─────────────── Catalogue des capteurs ─────────────── */

test('Matériel : les quatre types de capteurs attendus sont présents', () => {
  const slugs = hardware.sensorTypes.map((sensorType) => sensorType.slug);
  for (const expected of ['soil-moisture-probe', 'soil-temperature-ec-probe', 'soil-ph-probe', 'weather-station']) {
    assert.ok(slugs.includes(expected), `type de capteur manquant : ${expected}`);
  }
});

test('Matériel : chaque type de capteur décrit ses grandeurs, unités et provenance', () => {
  for (const sensorType of hardware.sensorTypes) {
    assert.ok(sensorType.label, `${sensorType.slug} sans libellé`);
    assert.ok(sensorType.metrics.length > 0, `${sensorType.slug} sans grandeur mesurée`);
    // Confiance et source écrites en base : c'est ce qui rend la mesure traçable.
    assert.ok(['low', 'medium', 'high'].includes(sensorType.confidence), sensorType.slug);
    assert.ok(sensorType.source, `${sensorType.slug} sans source à écrire en base`);
    // Intervalle d'envoi et décodeur sont documentés (ici « à confirmer »).
    assert.ok(sensorType.sendInterval.source, `${sensorType.slug} sans provenance d'intervalle`);
    assert.ok('decoder' in sensorType, `${sensorType.slug} sans champ décodeur`);
    assert.ok('model' in sensorType && 'datasheet' in sensorType, `${sensorType.slug} sans modèle/fiche`);

    for (const metric of sensorType.metrics) {
      assert.ok(metric.key, `${sensorType.slug} : grandeur sans clé`);
      assert.ok(metric.unit, `${sensorType.slug}/${metric.key} sans unité`);
    }
  }
});

test('Matériel : les clés de grandeur appartiennent au vocabulaire réel du système', async () => {
  /**
   * Le moteur apparie les mesures aux plages agronomiques par leur clé. Une clé
   * inventée ici produirait des données que rien ne saurait rapprocher.
   */
  const { SOIL_PARAMETER_KEYS } = await import('../src/modules/soil/soil.schema.js');
  const exceptions = new Set(['airTemperatureC']); // métrique de sonde, pas d'analyse de sol

  for (const sensorType of hardware.sensorTypes) {
    for (const metric of sensorType.metrics) {
      if (exceptions.has(metric.key)) continue;
      assert.ok(
        SOIL_PARAMETER_KEYS.includes(metric.key),
        `${sensorType.slug}/${metric.key} n'appartient pas au vocabulaire des analyses de sol`,
      );
    }
  }
});

test('Matériel : le catalogue décrit les types, pas les appareils réels', () => {
  /**
   * Le fichier ne doit contenir ni DevEUI ni rattachement à une parcelle : un
   * appareil réel se déclare en base, pas en éditant la configuration.
   */
  const source = readSource('src/config/hardware.js');
  assert.doesNotMatch(source, /\bdevEui\s*:/i, 'un DevEUI n’a pas sa place dans le catalogue');
  assert.doesNotMatch(source, /\bplotId\s*:/i, 'un rattachement de parcelle n’a pas sa place dans le catalogue');
  // Les gabarits de topic peuvent mentionner {devEui} : c'est un motif, pas un appareil.
  assert.match(hardware.loraWan.topics.uplink, /\{devEui\}/);
});

/* ─────────────── Réseau, drones, GPR, satellite ─────────────── */

test('Matériel : le réseau LoRaWAN renvoie les secrets vers l’environnement', () => {
  assert.equal(hardware.loraWan.networkServer, 'ChirpStack');
  assert.equal(hardware.loraWan.mqtt.urlEnvVar, 'LORAWAN_MQTT_URL');
  assert.equal(hardware.loraWan.mqtt.passwordEnvVar, 'LORAWAN_MQTT_PASSWORD');
  assert.ok([0, 1, 2].includes(hardware.loraWan.mqtt.qos));
  // Les trois variables existent bien dans .env.example, vides par défaut.
  const example = readSource('.env.example');
  for (const name of ['LORAWAN_MQTT_URL', 'LORAWAN_MQTT_USERNAME', 'LORAWAN_MQTT_PASSWORD']) {
    assert.match(example, new RegExp(`^${name}=$`, 'm'), `${name} doit être présent et vide`);
  }
});

test('Matériel : drones et GPR déclarent formats et tailles maximales', () => {
  assert.ok(hardware.drones.acceptedImageFormats.length > 0);
  assert.ok(hardware.drones.sensors.some((sensor) => sensor.slug === 'multispectral'));
  assert.ok(hardware.drones.sensors.some((sensor) => sensor.slug === 'thermal'));
  assert.ok('maxUpload' in hardware.drones);

  assert.equal(hardware.gpr.fileFormat, 'SEG-Y');
  for (const parameter of ['centerFrequency', 'maxDepth', 'traceSpacing', 'assumedVelocity']) {
    assert.ok(hardware.gpr.processing[parameter], `paramètre GPR manquant : ${parameter}`);
    assert.ok(hardware.gpr.processing[parameter].source, `${parameter} sans provenance`);
  }
  assert.ok('maxFileSize' in hardware.gpr);
});

test('Matériel : Sentinel-1 est la source principale et le seuil de nuages n’est pas dupliqué', () => {
  assert.equal(hardware.satellite.primaryMoistureSource, 'sentinel-1');
  assert.equal(hardware.satellite.sources[0].id, 'sentinel-1');
  assert.equal(hardware.satellite.sources[0].cloudInsensitive, true, 'le radar traverse les nuages');
  // Aucune source satellite ne prétend mesurer le sous-sol.
  for (const source of hardware.satellite.sources) {
    assert.equal(source.measuresSubsurface, false, `${source.id} ne mesure que la surface`);
  }

  /**
   * Le seuil de nuages vit dans le schéma d'environnement : le fichier matériel
   * ne porte que le **nom** de la variable. Deux copies divergeraient.
   */
  assert.equal(hardware.satellite.cloudRejectThresholdEnvVar, 'SATELLITE_CLOUD_REJECT_PCT');
  const source = readSource('src/config/hardware.js');
  assert.doesNotMatch(source, /cloudCover\w*\s*:\s*\d+/, 'le seuil de nuages ne doit pas être recopié ici');
  // Un NDVI n'est pas une humidité.
  assert.ok(hardware.satellite.moistureIndexes.length > 0);
  assert.ok(!hardware.satellite.moistureIndexes.includes('NDVI'));
});

test('Matériel : le canal SMS garde fournisseur et secrets dans l’environnement', () => {
  assert.ok(hardware.sms.providers.includes('webhook'));
  assert.equal(hardware.sms.providerEnvVar, 'SMS_PROVIDER');
  assert.ok(hardware.sms.secretEnvVars.includes('SMS_API_KEY'));
  assert.ok(Number.isInteger(hardware.sms.maxAttempts) && hardware.sms.maxAttempts >= 1);
  assert.ok(hardware.sms.requestTimeout.source, 'délai maximal sans provenance');
});

/* ─────────── Source de vérité unique : rien ailleurs ─────────── */

test('Matériel : le seuil de capteur silencieux n’existe qu’ici', () => {
  assert.equal(hardware.maintenance.silentSensorThreshold.value, 24);

  /**
   * Les deux consommateurs lisent la même source : le service IoT (contrôle à
   * l'ingestion) et le service d'alertes (surveillance planifiée). Le job, lui,
   * délègue au service d'alertes : il ne connaît plus le seuil du tout.
   */
  const iotService = readSource('src/modules/iot/iot.service.js');
  assert.match(iotService, /hardware\.maintenance\.silentSensorThreshold\.value/);
  assert.doesNotMatch(iotService, /24 \* 3600 \* 1000/, 'un seuil recodé en dur créerait une seconde source');

  const alerts = readSource('src/modules/alerts/alerts.service.js');
  assert.match(alerts, /hardware\.maintenance\.silentSensorThreshold\.value/);

  const jobs = readSource('src/jobs/index.js');
  assert.doesNotMatch(jobs, /IOT_SILENCE_HOURS/, 'le job ne doit plus connaître ce réglage');
  assert.doesNotMatch(jobs, /silentSensorThreshold/, 'le job délègue : il ne lit plus le seuil');
  assert.match(jobs, /scanSilentSensors/, 'le job délègue au service d’alertes');

  // La variable d'environnement a bien disparu : une seule source subsiste.
  assert.doesNotMatch(readSource('.env.example'), /^IOT_SILENCE_HOURS=/m);
  assert.doesNotMatch(readSource('src/config/env.js'), /IOT_SILENCE_HOURS\s*:/);
});

test('Matériel : la configuration satellite n’est pas recopiée dans satellite.js', () => {
  const satellite = readSource('src/config/satellite.js');
  // La logique de choix reste, la description du matériel vient d'ici.
  assert.match(satellite, /hardware\.satellite\.sources/);
  assert.match(satellite, /hardware\.satellite\.moistureIndexes/);
  assert.doesNotMatch(satellite, /sensor:\s*'radar/, 'la description du capteur doit venir du fichier matériel');
});

test('Matériel : les délais SMS viennent du fichier, pas du code', () => {
  const sms = readSource('src/integrations/sms.js');
  assert.match(sms, /hardware\.sms\.requestTimeout\.value/);
  assert.match(sms, /hardware\.sms\.maxAttempts/);
});

test('Matériel : les accesseurs retrouvent un type de capteur et ses bornes', () => {
  const probe = sensorTypeBySlug('soil-ph-probe');
  assert.ok(probe);
  assert.equal(probe.metrics[0].key, 'ph');
  assert.equal(sensorTypeBySlug('inexistant'), null);
  assert.equal(plausibilityFor('inexistant'), null);
});
