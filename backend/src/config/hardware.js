/**
 * Configuration du matériel — **source de vérité unique**.
 *
 * Ce fichier contient toute la configuration des équipements : réseau LoRaWAN,
 * passerelles, catalogue des types de capteurs, drones, GPR, satellite, canal
 * SMS et maintenance. **Aucun paramètre matériel ne doit être défini ailleurs
 * dans le code** : les autres modules importent ce fichier, ils ne réécrivent
 * pas ses valeurs.
 *
 * Il n'est modifié qu'en cas de changement de matériel. Chaque modification
 * doit incrémenter `version` et mettre à jour `revisedAt`.
 *
 * ── Ce qui est ici, et ce qui n'y est pas ─────────────────────────────
 *
 *  • ICI   — le **catalogue des types** de matériel : ce qu'un modèle de sonde
 *            mesure, dans quelles unités, avec quel décodeur, quelles bornes
 *            plausibles, quelle confiance et quelle `source` écrire en base.
 *  • BASE  — les **appareils réels** : DevEUI (dans `IotDevice.serialNumber`),
 *            parcelle rattachée (`IotDevice.plotId`), profondeur et position
 *            GPS de chaque mesure (`SensorReading.depthCm`, `.position`).
 *            Un appareil se déclare par l'API, pas en éditant ce fichier.
 *  • .env  — les **secrets** : mots de passe MQTT, clés d'API SMS. Ce fichier
 *            ne contient jamais de secret, seulement le **nom** de la variable
 *            d'environnement qui le porte.
 *
 * ── Aucune valeur inventée ───────────────────────────────────────────
 *
 * Le matériel du déploiement RDC n'est pas encore arrêté. Toute valeur
 * inconnue est donc `null`, accompagnée de `source: 'à confirmer'` et, quand
 * c'est utile, de l'indication de qui doit confirmer (fiche technique du
 * fabricant, régulateur, agronome).
 *
 * Renseigner une valeur plausible « pour que ça tourne » produirait l'effet
 * inverse de celui recherché : un décodeur, un intervalle d'envoi ou une plage
 * de mesure inventés donnent au système l'apparence d'être configuré alors
 * qu'il ne correspond à aucun équipement réel.
 *
 * Seules sont renseignées les valeurs **définitionnelles** (une échelle de pH
 * va de 0 à 14, une conductivité ne peut pas être négative, une humidité
 * volumique est une fraction de 0 à 100 %) et les **réglages déjà en place**
 * dans le système, repris tels quels avec leur provenance.
 */
import { z } from 'zod';

/** Version du fichier. À incrémenter à chaque changement de matériel. */
export const HARDWARE_CONFIG_VERSION = '1.0.0';

/** Date de dernière révision (AAAA-MM-JJ). */
export const HARDWARE_CONFIG_REVISED_AT = '2026-10-22';

/** Mention portée par toute valeur non confirmée. */
const TO_CONFIRM = 'à confirmer';
/**
 * Marqueur de valeur **provisoire mais opérationnelle**.
 *
 * Distinct de `TO_CONFIRM` : une valeur `null` bloque le passage en mode réel,
 * alors qu'une valeur provisoire fonctionne et doit être **recalée sur les
 * données du pilote**. `provisionalThresholds()` les recense — elles ne peuvent
 * pas vivre dans `pendingConfirmations()`, qui ne collecte que les valeurs vides.
 */
const PROVISIONAL = 'PROVISOIRE';

/* ─────────────────────────── Schéma zod ─────────────────────────── */

/** Valeur numérique documentée : la valeur, son unité, sa provenance. */
const sourcedNumber = (unit) =>
  z.object({
    value: z.number().nullable(),
    unit: z.string().nullable().default(unit ?? null),
    /** Fiche technique du fabricant, norme, ou « à confirmer ». */
    source: z.string().min(1),
  });

const plausibilitySchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  unit: z.string(),
  /** D'où vient cette borne. Une borne sans provenance n'a pas de valeur. */
  source: z.string().min(1),
});

/** Une grandeur mesurée par un type de capteur. */
const metricSchema = z.object({
  /**
   * Clé de la grandeur. Doit appartenir au vocabulaire des analyses de sol
   * (`SOIL_PARAMETER_KEYS`) ou être une métrique de sonde explicite : c'est
   * cette clé qui est appariée aux plages agronomiques par le moteur.
   */
  key: z.string().min(1),
  unit: z.string().nullable(),
  /** Bornes au-delà desquelles la mesure est un dysfonctionnement, pas une donnée. */
  plausibility: plausibilitySchema,
  /** Profondeur de mesure, quand la grandeur en a une (sonde enterrée). */
  depthCm: z.number().nullable().default(null),
});

const sensorTypeSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  /** Modèle commercial exact. `null` tant que le matériel n'est pas arrêté. */
  model: z.string().nullable(),
  manufacturer: z.string().nullable(),
  /** Référence de la fiche technique consultée. Obligatoire en mode réel. */
  datasheet: z.string().nullable(),
  /** Nom du décodeur de charge utile côté ChirpStack. */
  decoder: z.string().nullable(),
  /** Intervalle d'envoi annoncé par le fabricant. */
  sendInterval: sourcedNumber('minutes'),
  metrics: z.array(metricSchema).min(1),
  /** Confiance écrite sur la mesure (CDC §4 : capteur = élevée). */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Valeur de `SensorReading.source` écrite en base. */
  source: z.enum(['measured_sensor', 'measured_lab', 'measured_gpr', 'satellite', 'photo_interpreted']),
});

const gatewaySchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  model: z.string().nullable(),
  manufacturer: z.string().nullable(),
  datasheet: z.string().nullable(),
  /** Rôle sur le terrain : couverture, relais, backhaul. */
  role: z.string().min(1),
  /** Au-delà de cette durée sans trafic, la passerelle est signalée muette. */
  silenceBeforeAlert: sourcedNumber('heures'),
});

const hardwareSchema = z.object({
  /**
   * Mode de la flotte d'équipements.
   *
   * `SIMULATION` : aucun matériel physique n'est connecté ; les valeurs sont
   * générées et **toujours marquées `SIMULATED` en base**. Réservé au
   * développement et aux tests : refusé au démarrage en production.
   *
   * `REAL` : du matériel physique est connecté. Le démarrage exige alors que
   * les champs obligatoires soient renseignés (voir `assertHardwareConfigReady`).
   */
  mode: z.enum(['SIMULATION', 'REAL']),

  loraWan: z.object({
    /** Serveur réseau : ChirpStack dans ce déploiement. */
    networkServer: z.string().min(1),
    networkServerVersion: z.string().nullable(),
    /**
     * Le broker et ses identifiants sont des **secrets** : ce fichier ne porte
     * que le nom des variables d'environnement qui les contiennent.
     */
    mqtt: z.object({
      urlEnvVar: z.string().min(1),
      usernameEnvVar: z.string().min(1),
      passwordEnvVar: z.string().min(1),
      port: z.number().int().positive().nullable(),
      /** Qualité de service MQTT des uplinks. */
      qos: z.number().int().min(0).max(2),
    }),
    /**
     * Structure des topics d'application.
     *
     * Les gabarits suivent la convention ChirpStack v4. Ils doivent être
     * revérifiés contre la version réellement déployée : la v3 nomme les
     * événements différemment (`/rx` au lieu de `/event/up`).
     */
    topics: z.object({
      uplink: z.string().min(1),
      downlink: z.string().min(1),
      status: z.string().min(1),
      conventionSource: z.string().min(1),
    }),
    /**
     * Plan de fréquence. **Aucune valeur par défaut** : il dépend de
     * l'attribution du régulateur national et ne peut pas être deviné.
     */
    frequencyPlan: z.string().nullable(),
    frequencyPlanSource: z.string().min(1),
    /** Classe LoRaWAN des capteurs (A, B ou C). */
    deviceClass: z.enum(['A', 'B', 'C']).nullable(),
    deviceClassSource: z.string().min(1),
  }),

  gateways: z.array(gatewaySchema),

  sensorTypes: z.array(sensorTypeSchema).min(1),

  drones: z.object({
    model: z.string().nullable(),
    manufacturer: z.string().nullable(),
    datasheet: z.string().nullable(),
    /** Capteurs embarqués et bandes spectrales. */
    sensors: z.array(
      z.object({
        slug: z.string().min(1),
        label: z.string().min(1),
        /** Bandes spectrales, en nm. `null` tant que le capteur n'est pas choisi. */
        bandsNm: z
          .array(z.object({ name: z.string().min(1), centerNm: z.number().nullable(), widthNm: z.number().nullable() }))
          .nullable(),
        /** Résolution spatiale au sol annoncée. */
        groundResolution: sourcedNumber('cm/pixel'),
      }),
    ),
    /** Formats d'image acceptés à l'upload. */
    acceptedImageFormats: z.array(z.string().min(1)).min(1),
    /** Taille maximale d'un fichier téléversé. */
    maxUpload: sourcedNumber('Mo'),
    /** `source` écrite en base pour une mesure issue du drone. */
    source: z.enum(['photo_interpreted', 'measured_sensor', 'derived']),
    confidence: z.enum(['low', 'medium', 'high']),
  }),

  gpr: z.object({
    model: z.string().nullable(),
    manufacturer: z.string().nullable(),
    datasheet: z.string().nullable(),
    /** Format des profils : SEG-Y dans ce déploiement. */
    fileFormat: z.string().min(1),
    /** Paramètres de traitement attendus du prestataire. */
    processing: z.object({
      /** Fréquence centrale de l'antenne. */
      centerFrequency: sourcedNumber('MHz'),
      /** Profondeur maximale investiguée. */
      maxDepth: sourcedNumber('m'),
      /** Pas d'échantillonnage spatial le long du profil. */
      traceSpacing: sourcedNumber('cm'),
      /** Vitesse de propagation supposée, si le prestataire la fournit. */
      assumedVelocity: sourcedNumber('m/ns'),
    }),
    maxFileSize: sourcedNumber('Mo'),
    /** `source` écrite en base pour un profil GPR. */
    source: z.enum(['measured_gpr', 'derived']),
    confidence: z.enum(['low', 'medium', 'high']),
  }),

  /**
   * Satellite.
   *
   * Le **seuil de couverture nuageuse** n'est pas répété ici : il est déjà
   * validé par le schéma d'environnement (`SATELLITE_CLOUD_REJECT_PCT`). Le
   * dupliquer créerait deux réglages susceptibles de diverger.
   */
  satellite: z
    .object({
    /**
     * Sources disponibles, dans l'ordre de priorité pour l'humidité du sol.
     *
     * La description du matériel (mission, capteur, sensibilité aux nuages,
     * confiance) vit ici ; `src/config/satellite.js` n'en garde que la logique
     * de choix.
     */
    sources: z
      .array(
        z.object({
          id: z.string().min(1),
          mission: z.string().min(1),
          sensor: z.string().min(1),
          /** Le capteur traverse-t-il la couverture nuageuse ? */
          cloudInsensitive: z.boolean(),
          /**
           * Toujours `false` : un satellite mesure la surface. Cette field est
           * explicite pour qu'aucune source ne puisse prétendre au sous-sol.
           */
          measuresSubsurface: z.literal(false),
          confidence: z.enum(['low', 'medium', 'high']),
          role: z.enum(['principal', 'complément']),
          note: z.string().min(1),
        }),
      )
      .min(1),
    /** Source principale d'humidité du sol : le radar traverse les nuages. */
    primaryMoistureSource: z.string().min(1),
    /** Index admis comme mesure d'humidité (un NDVI n'en est pas une). */
    moistureIndexes: z.array(z.string().min(1)).min(1),
    /** Périodicité de rafraîchissement des scènes. */
    refreshInterval: sourcedNumber('heures'),
    /** Renvoie vers le schéma d'environnement pour le seuil de nuages. */
    cloudRejectThresholdEnvVar: z.string().min(1),

    /**
     * Fournisseurs d'acquisition disponibles, et les variables qui les pilotent.
     *
     * Le fournisseur actif et les secrets sont des choix de déploiement : ce
     * fichier ne fait que **nommer** les variables d'environnement, exactement
     * comme pour le SMS. C'est ce partage qui permet de passer du simulé au réel
     * sans réécrire le backend.
     */
    providers: z.array(z.string().min(1)).min(1),
    providerEnvVar: z.string().min(1),
    apiUrlEnvVar: z.string().min(1),
    apiKeyEnvVar: z.string().min(1),
    enabledEnvVar: z.string().min(1),
    refreshIntervalEnvVar: z.string().min(1),
    /** Fenêtre de recherche d'une scène, en jours. */
    sceneLookbackDays: sourcedNumber('jours'),
    requestTimeout: sourcedNumber('ms'),
    /** Nombre de tentatives par acquisition. */
    maxAttempts: z.number().int().min(1).max(10),
    retryDelay: sourcedNumber('ms'),
  })
    .refine((satellite) => satellite.sources[0].id === satellite.primaryMoistureSource, {
      message:
        'satellite.primaryMoistureSource doit être la première source de satellite.sources : '
        + "l'ordre du tableau EST la priorité.",
      path: ['primaryMoistureSource'],
    })
    .refine((satellite) => satellite.sources.some((source) => source.cloudInsensitive), {
      message:
        'Aucune source insensible aux nuages : sous couverture équatoriale, '
        + "l'humidité du sol ne serait presque jamais mesurable.",
      path: ['sources'],
    })
    .refine((satellite) => satellite.providers.some((provider) => provider !== 'simulated'), {
      message:
        'Aucun fournisseur réel déclaré : le mode simulé est réservé aux tests et '
        + 'ne peut pas être la seule façon d’acquérir une scène.',
      path: ['providers'],
    }),

  /**
   * Canal SMS — alertes aux agriculteurs.
   *
   * Le **fournisseur actif** et les **clés d'API** restent dans `.env` : ce
   * sont des choix de déploiement et des secrets. Ce fichier décrit
   * l'interface et les limites de fonctionnement.
   */
  sms: z.object({
    /** Fournisseurs derrière l'interface (`src/integrations/sms.js`). */
    providers: z.array(z.string().min(1)).min(1),
    /** Variable d'environnement portant le fournisseur actif. */
    providerEnvVar: z.string().min(1),
    /** Variables portant les secrets. Jamais de valeur ici. */
    secretEnvVars: z.array(z.string().min(1)).min(1),
    /** Délai maximal d'attente d'une réponse de la passerelle. */
    requestTimeout: sourcedNumber('ms'),
    /** Nombre de tentatives avant abandon. */
    maxAttempts: z.number().int().positive(),
    /** Délai entre deux tentatives. */
    retryDelay: sourcedNumber('ms'),
    /** Un SMS d'alerte reste pertinent pendant cette durée au-delà. */
    alertFreshness: sourcedNumber('minutes'),
  }),

  /**
   * Détection d'anomalies sur les mesures de sonde.
   *
   * Ces seuils pilotent le moteur Python (`geoai/sensors.py`) : ils lui sont
   * transmis à chaque appel, et les valeurs de `geoai/config.py` ne servent que
   * de repli. Ce fichier en reste la seule source de vérité déclarée.
   *
   * **Tous sont provisoires** : ajustés sur des séries synthétiques, ils doivent
   * être recalés sur les données réelles du pilote avant toute conclusion sur les
   * taux de fausse alerte.
   */
  anomalies: z.object({
    /** Variable qui active le job de détection. */
    enabledEnvVar: z.string().min(1),
    /** Écart absolu médian au-delà duquel une valeur est aberrante. */
    madZLimit: sourcedNumber(null),
    /** Nombre de points consécutifs identiques qualifiant un capteur de bloqué. */
    stuckMinPoints: sourcedNumber('points'),
    /** Tolérance numérique entre deux points pour les dire identiques. */
    stuckEpsilon: sourcedNumber(null),
    /** Un trou = intervalle supérieur à ce multiple de l'intervalle médian. */
    gapFactor: sourcedNumber('×'),
    /** Fenêtre d'analyse remontée pour chaque sonde. */
    lookbackDays: sourcedNumber('jours'),
    /**
     * Nombre minimal de mesures pour oser une détection statistique.
     *
     * En dessous, le MAD n'a pas de sens : mieux vaut ne rien signaler que
     * signaler au hasard.
     */
    minReadings: sourcedNumber('mesures'),
  }),

  maintenance: z.object({
    /** Intervalle d'étalonnage des sondes pH. */
    phCalibrationInterval: sourcedNumber('jours'),
    /** Au-delà de cette durée sans remontée, un capteur est signalé silencieux. */
    silentSensorThreshold: sourcedNumber('heures'),
    /** Niveau de batterie déclenchant une alerte. */
    batteryAlertLevel: sourcedNumber('%'),
  }),
});

/* ─────────────────────── Valeurs du déploiement ─────────────────────── */

/**
 * Bornes de plausibilité.
 *
 * Renseignées uniquement quand la borne est **définitionnelle** : l'échelle de
 * pH est bornée par construction, une conductivité électrique ne peut pas être
 * négative, une humidité volumique est une fraction du volume de pores.
 *
 * Les bornes hautes qui dépendent du capteur (plage de mesure d'une sonde EC,
 * température de service) restent `null` : elles figurent sur la fiche
 * technique du modèle retenu, pas dans un inventaire de bon sens.
 */
const plausibility = {
  ph: {
    min: 0,
    max: 14,
    unit: 'pH',
    source: 'Définition de l’échelle pH (activité des ions H⁺) — borne définitionnelle, indépendante du capteur.',
  },
  ec: {
    min: 0,
    max: null,
    unit: 'dS/m',
    source:
      'Minimum définitionnel : une conductivité électrique ne peut pas être négative. '
      + `Maximum ${TO_CONFIRM} — il correspond à la plage de mesure du capteur retenu (fiche technique).`,
  },
  moisture: {
    min: 0,
    max: 100,
    unit: '%',
    source:
      'Humidité volumique : fraction du volume de pores occupée par l’eau, donc bornée à 0–100 % par définition.',
  },
  airTemperatureC: {
    min: null,
    max: null,
    unit: '°C',
    source:
      `${TO_CONFIRM} — bornes de détection de panne à fixer d’après la plage de service du capteur `
      + '(fiche technique). Une plage « climatique » générale ne détecterait pas un capteur dérivé.',
  },
  depthCm: {
    min: 0,
    max: null,
    unit: 'cm',
    source:
      'Minimum définitionnel : une profondeur est positive. '
      + `Maximum ${TO_CONFIRM} — longueur de la sonde installée.`,
  },
};

const rawConfig = {
  /**
   * Aucun matériel physique n'est connecté à ce jour : le mode est
   * `SIMULATION`. Passer à `REAL` exige de renseigner les champs obligatoires
   * contrôlés par `assertHardwareConfigReady`.
   */
  mode: 'SIMULATION',

  loraWan: {
    networkServer: 'ChirpStack',
    networkServerVersion: null,
    mqtt: {
      urlEnvVar: 'LORAWAN_MQTT_URL',
      usernameEnvVar: 'LORAWAN_MQTT_USERNAME',
      passwordEnvVar: 'LORAWAN_MQTT_PASSWORD',
      port: null,
      qos: 0,
    },
    topics: {
      uplink: 'application/{applicationId}/device/{devEui}/event/up',
      downlink: 'application/{applicationId}/device/{devEui}/command/down',
      status: 'application/{applicationId}/device/{devEui}/event/status',
      conventionSource:
        'Convention ChirpStack v4 — à revérifier contre la version réellement déployée '
        + '(la v3 nomme les événements différemment).',
    },
    /**
     * Aucune valeur par défaut, volontairement : le plan de fréquence dépend de
     * l'attribution du régulateur national (ARPTC, RDC). Le renseigner sans
     * confirmation exposerait à émettre hors bande autorisée.
     */
    frequencyPlan: null,
    frequencyPlanSource: `${TO_CONFIRM} — attribution de l’ARPTC (régulateur RDC). Aucune valeur par défaut.`,
    deviceClass: null,
    deviceClassSource: `${TO_CONFIRM} — dépend du modèle de capteur retenu et du besoin de downlink.`,
  },

  gateways: [
    {
      slug: 'field-gateway',
      label: 'Passerelle de terrain',
      model: null,
      manufacturer: null,
      datasheet: null,
      role:
        'Couverture radio d’un périmètre agricole et relais des uplinks LoRaWAN '
        + 'vers le serveur réseau.',
      silenceBeforeAlert: {
        value: null,
        unit: 'heures',
        source:
          `${TO_CONFIRM} — dépend de la périodicité de heartbeat du modèle retenu `
          + '(fiche technique). Fixer un seuil plus court que le heartbeat produirait de fausses alertes.',
      },
    },
  ],

  sensorTypes: [
    {
      slug: 'soil-moisture-probe',
      label: 'Sonde d’humidité du sol',
      model: null,
      manufacturer: null,
      datasheet: null,
      decoder: null,
      sendInterval: {
        value: null,
        unit: 'minutes',
        source: `${TO_CONFIRM} — intervalle annoncé par le fabricant (fiche technique).`,
      },
      metrics: [
        { key: 'moisture', unit: '%', plausibility: plausibility.moisture, depthCm: null },
      ],
      confidence: 'high',
      source: 'measured_sensor',
    },
    {
      slug: 'soil-temperature-ec-probe',
      label: 'Sonde température et conductivité du sol',
      model: null,
      manufacturer: null,
      datasheet: null,
      decoder: null,
      sendInterval: {
        value: null,
        unit: 'minutes',
        source: `${TO_CONFIRM} — intervalle annoncé par le fabricant (fiche technique).`,
      },
      metrics: [
        { key: 'ec', unit: 'dS/m', plausibility: plausibility.ec, depthCm: null },
        { key: 'depthCm', unit: 'cm', plausibility: plausibility.depthCm, depthCm: null },
      ],
      confidence: 'high',
      source: 'measured_sensor',
    },
    {
      slug: 'soil-ph-probe',
      label: 'Sonde pH du sol',
      model: null,
      manufacturer: null,
      datasheet: null,
      decoder: null,
      sendInterval: {
        value: null,
        unit: 'minutes',
        source: `${TO_CONFIRM} — intervalle annoncé par le fabricant (fiche technique).`,
      },
      metrics: [{ key: 'ph', unit: 'pH', plausibility: plausibility.ph, depthCm: null }],
      confidence: 'high',
      source: 'measured_sensor',
    },
    {
      slug: 'weather-station',
      label: 'Station météo',
      model: null,
      manufacturer: null,
      datasheet: null,
      decoder: null,
      sendInterval: {
        value: null,
        unit: 'minutes',
        source: `${TO_CONFIRM} — intervalle annoncé par le fabricant (fiche technique).`,
      },
      metrics: [
        {
          key: 'airTemperatureC',
          unit: '°C',
          plausibility: plausibility.airTemperatureC,
          depthCm: null,
        },
      ],
      confidence: 'high',
      source: 'measured_sensor',
    },
  ],

  drones: {
    model: null,
    manufacturer: null,
    datasheet: null,
    sensors: [
      {
        slug: 'multispectral',
        label: 'Caméra multispectrale',
        bandsNm: null,
        groundResolution: {
          value: null,
          unit: 'cm/pixel',
          source: `${TO_CONFIRM} — résolution au sol annoncée par le fabricant, à altitude donnée.`,
        },
      },
      {
        slug: 'thermal',
        label: 'Caméra thermique',
        bandsNm: null,
        groundResolution: {
          value: null,
          unit: 'cm/pixel',
          source: `${TO_CONFIRM} — résolution au sol annoncée par le fabricant, à altitude donnée.`,
        },
      },
    ],
    /**
     * Formats réellement pris en charge par la chaîne de traitement
     * (`geoai/imagery.py`, via Pillow) : JPEG, PNG et TIFF.
     */
    acceptedImageFormats: ['image/jpeg', 'image/png', 'image/tiff'],
    maxUpload: {
      value: null,
      unit: 'Mo',
      source:
        `${TO_CONFIRM} — à fixer selon la taille des orthophotos produites et la bande passante `
        + 'disponible sur site.',
    },
    source: 'photo_interpreted',
    confidence: 'medium',
  },

  gpr: {
    model: null,
    manufacturer: null,
    datasheet: null,
    /** Format d'échange des profils : SEG-Y. */
    fileFormat: 'SEG-Y',
    processing: {
      centerFrequency: {
        value: null,
        unit: 'MHz',
        source: `${TO_CONFIRM} — fréquence d’antenne du prestataire (fiche technique).`,
      },
      maxDepth: {
        value: null,
        unit: 'm',
        source: `${TO_CONFIRM} — profondeur d’investigation visée pour le profil racinaire.`,
      },
      traceSpacing: {
        value: null,
        unit: 'cm',
        source: `${TO_CONFIRM} — pas de mesure le long du profil, fixé par le prestataire.`,
      },
      assumedVelocity: {
        value: null,
        unit: 'm/ns',
        source:
          `${TO_CONFIRM} — vitesse de propagation dans le sol local. Sans calibration terrain, `
          + 'les profondeurs déduites sont indicatives.',
      },
    },
    maxFileSize: {
      value: null,
      unit: 'Mo',
      source: `${TO_CONFIRM} — à fixer selon la taille des profils SEG-Y livrés.`,
    },
    source: 'measured_gpr',
    confidence: 'high',
  },

  satellite: {
    /**
     * Ordre de priorité pour l'humidité du sol : le premier disponible gagne.
     *
     * Le radar (SAR, bande C) traverse les nuages : sous couverture équatoriale
     * persistante, l'optique est rarement exploitable. Les deux sources restent
     * des mesures de **surface** — le sous-sol vient des sondes et du GPR.
     */
    sources: [
      {
        id: 'sentinel-1',
        mission: 'Sentinel-1',
        sensor: 'radar (SAR, bande C)',
        cloudInsensitive: true,
        measuresSubsurface: false,
        // Confiance plafonnée : c'est un complément de surface, pas une sonde.
        confidence: 'low',
        role: 'principal',
        note:
          'Source principale en zone à forte nébulosité. Backscatter de surface '
          + 'lié à l’humidité du premier horizon.',
      },
      {
        id: 'sentinel-2',
        mission: 'Sentinel-2',
        sensor: 'optique multispectral',
        cloudInsensitive: false,
        measuresSubsurface: false,
        confidence: 'low',
        role: 'complément',
        note:
          'Utile pour la végétation (NDVI) quand une scène sans nuage existe. '
          + 'Dégradé pour l’humidité dans cette zone : les scènes exploitables sont rares.',
      },
    ],
    primaryMoistureSource: 'sentinel-1',
    /**
     * Un NDVI n'est pas une humidité : seules ces valeurs d'index sont lues
     * comme telles (voir `MOISTURE_INDEXES` dans `src/config/satellite.js`).
     */
    moistureIndexes: ['S1_SOIL_MOISTURE', 'SOIL_MOISTURE'],
    refreshInterval: {
      value: null,
      unit: 'heures',
      source:
        `${TO_CONFIRM} — dépend de la disponibilité des produits Sentinel-1 et du quota `
        + 'Sentinel Hub / Earth Engine retenu.',
    },
    /**
     * Le seuil lui-même vit dans le schéma d'environnement : une seule source.
     */
    cloudRejectThresholdEnvVar: 'SATELLITE_CLOUD_REJECT_PCT',

    /**
     * Acquisition programmée.
     *
     * Le **fournisseur actif** et les **secrets** sont des choix de déploiement :
     * ils vivent dans l'environnement, et ce fichier ne fait que nommer les
     * variables. C'est le même partage que pour le SMS, et c'est ce qui permet de
     * passer d'un fournisseur simulé à un fournisseur réel **sans réécrire le
     * backend** : seul `SATELLITE_PROVIDER` change.
     */
    providers: ['sentinelhub', 'earthengine', 'webhook', 'simulated'],
    providerEnvVar: 'SATELLITE_PROVIDER',
    apiUrlEnvVar: 'SATELLITE_API_URL',
    apiKeyEnvVar: 'SATELLITE_API_KEY',
    enabledEnvVar: 'SATELLITE_ACQUISITION_ENABLED',
    /**
     * Cadence de **sondage** du fournisseur, distincte de la période de revisite
     * du satellite. On peut interroger l'API tous les jours alors qu'un nouveau
     * produit Sentinel-1 n'apparaît que tous les 6 à 12 jours : le sondage
     * quotidien ne produit alors aucune scène nouvelle, et c'est normal.
     *
     * La valeur reste dans l'environnement : elle dépend du quota retenu.
     */
    refreshIntervalEnvVar: 'SATELLITE_REFRESH_HOURS',
    /** Fenêtre de recherche d'une scène, en jours. */
    sceneLookbackDays: {
      value: 12,
      unit: 'jours',
      source:
        'Calé sur la période de revisite de Sentinel-1 (6 à 12 jours selon la '
        + 'latitude et le nombre de satellites). Une fenêtre plus courte laisserait '
        + 'passer des scènes ; plus longue, elle mélangerait des états du sol trop '
        + 'éloignés dans le temps.',
    },
    /**
     * Délai maximal d'un appel fournisseur, en millisecondes.
     *
     * `null` tant que la passerelle n'est pas retenue : on ne fixe pas un délai
     * inventé, et le mode matériel `REAL` refuse de démarrer sans cette valeur.
     */
    requestTimeout: {
      value: null,
      unit: 'ms',
      source: `${TO_CONFIRM} — dépend du fournisseur retenu (Sentinel Hub, Earth Engine).`,
    },
    /** Nombre de tentatives par acquisition, avant de renoncer et de tracer l'échec. */
    maxAttempts: 2,
    retryDelay: {
      value: null,
      unit: 'ms',
      source: `${TO_CONFIRM} — à caler sur les limites de débit du fournisseur retenu.`,
    },
  },

  sms: {
    /**
     * Fournisseurs derrière l'interface unique `sendSms()`. Ajouter un
     * agrégateur local se fait dans `src/integrations/sms.js`, sans toucher au
     * code métier.
     */
    providers: ['console', 'twilio', 'africastalking', 'webhook'],
    providerEnvVar: 'SMS_PROVIDER',
    secretEnvVars: [
      'SMS_API_KEY',
      'SMS_WEBHOOK_URL',
      // Twilio (étape E). `TWILIO_AUTH_TOKEN` est aussi la clé de signature des
      // webhooks : sa fuite permettrait de forger des accusés de remise.
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
    ],
    requestTimeout: {
      value: null,
      unit: 'ms',
      source: `${TO_CONFIRM} — à fixer d’après le SLA de la passerelle SMS retenue.`,
    },
    /** Repris du comportement attendu pour une alerte : deux essais, puis échec tracé. */
    maxAttempts: 3,
    retryDelay: {
      value: null,
      unit: 'ms',
      source: `${TO_CONFIRM} — à fixer d’après les limites de débit de la passerelle retenue.`,
    },
    alertFreshness: {
      value: null,
      unit: 'minutes',
      source:
        `${TO_CONFIRM} — à fixer avec l’agronome : au-delà, une alerte n’est plus actionnable `
        + 'pour l’agriculteur.',
    },
  },

  anomalies: {
    enabledEnvVar: 'ANOMALY_DETECTION_ENABLED',
    madZLimit: {
      value: 3.5,
      unit: '× MAD',
      source: `${PROVISIONAL} — réglage par défaut du moteur (écart absolu médian robuste). `
        + 'À recaler sur les séries réelles du pilote : un seuil trop bas multiplie les '
        + 'fausses alertes, un seuil trop haut laisse passer une sonde qui dérive.',
    },
    stuckMinPoints: {
      value: 5,
      unit: 'points',
      source: `${PROVISIONAL} — à recaler sur la périodicité réelle des sondes déployées. `
        + 'Cinq points à 6 h d’intervalle couvrent plus d’un jour ; à 1 h, cinq heures seulement.',
    },
    stuckEpsilon: {
      value: 0.000001,
      unit: 'unité du paramètre',
      source: `${PROVISIONAL} — tolérance numérique. À relever à la résolution réelle du capteur : `
        + 'une sonde qui arrondit à 0,1 % peut sembler figée sans l’être.',
    },
    gapFactor: {
      value: 2.5,
      unit: '×',
      source: `${PROVISIONAL} — à recaler sur la régularité de transmission constatée en conditions `
        + 'réelles (couverture réseau, duty cycle LoRaWAN).',
    },
    lookbackDays: {
      value: 14,
      unit: 'jours',
      source: `${PROVISIONAL} — compromis entre fenêtre statistique suffisante et réactivité. `
        + 'À ajuster selon la fréquence de remontée.',
    },
    minReadings: {
      value: 8,
      unit: 'mesures',
      source: `${PROVISIONAL} — plancher en dessous duquel un MAD n’a pas de sens statistique. `
        + 'À confirmer sur les premières séries du pilote.',
    },
  },

  maintenance: {
    phCalibrationInterval: {
      value: null,
      unit: 'jours',
      source:
        `${TO_CONFIRM} — intervalle recommandé par le fabricant de la sonde pH retenue `
        + '(fiche technique). Une sonde pH non étalonnée dérive rapidement.',
    },
    /**
     * Réglage déjà en vigueur dans le système (variable `IOT_SILENCE_HOURS`,
     * valeur 24). Repris tel quel : ce fichier en devient la seule source.
     */
    silentSensorThreshold: {
      value: 24,
      unit: 'heures',
      source: 'Réglage existant du système (IOT_SILENCE_HOURS = 24 h), repris sans modification.',
    },
    batteryAlertLevel: {
      value: null,
      unit: '%',
      source: `${TO_CONFIRM} — seuil à fixer d’après la courbe de décharge du matériel retenu.`,
    },
  },
};

/* ───────────────── Validation et export ───────────────── */

const parsed = hardwareSchema.safeParse(rawConfig);

if (!parsed.success) {
  console.error('\n❌ Configuration matériel invalide (src/config/hardware.js) :\n');
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')} — ${issue.message}`);
  }
  console.error('\n👉 Corrige le fichier de configuration matériel.\n');
  process.exit(1);
}

export const hardware = Object.freeze(parsed.data);

/** Le fichier est-il en mode matériel réel ? */
export const isRealHardware = hardware.mode === 'REAL';

/* ─────────── Champs obligatoires en mode matériel réel ─────────── */

/**
 * Chemins obligatoires dès lors que du matériel physique est connecté.
 *
 * En mode `SIMULATION` ces champs peuvent rester `null` : rien n'est branché.
 * En mode `REAL`, démarrer avec un plan de fréquence ou un décodeur inconnu
 * reviendrait à faire tourner le système sur du matériel qu'il ne sait pas
 * lire — d'où l'arrêt explicite au démarrage.
 */
const REQUIRED_IN_REAL_MODE = [
  'loraWan.networkServerVersion',
  'loraWan.mqtt.port',
  'loraWan.frequencyPlan',
  'loraWan.deviceClass',
  'gateways[].model',
  'gateways[].datasheet',
  'gateways[].silenceBeforeAlert.value',
  'sensorTypes[].model',
  'sensorTypes[].datasheet',
  'sensorTypes[].decoder',
  'sensorTypes[].sendInterval.value',
  'drones.model',
  'drones.datasheet',
  'drones.maxUpload.value',
  'gpr.model',
  'gpr.datasheet',
  'gpr.processing.centerFrequency.value',
  'gpr.processing.maxDepth.value',
  'gpr.maxFileSize.value',
  'satellite.refreshInterval.value',
  'sms.requestTimeout.value',
  'sms.retryDelay.value',
  'sms.alertFreshness.value',
  'maintenance.phCalibrationInterval.value',
  'maintenance.batteryAlertLevel.value',
];

const isEmpty = (value) => value === null || value === undefined || value === '';

/**
 * Résout un chemin du type `gateways[].model` vers les valeurs manquantes.
 *
 * Les chemins sont renvoyés **complets** (`maintenance.silentSensorThreshold.value`,
 * `gateways[0].model`) : un opérateur qui lit « frequencyPlan » sans son parent
 * ne sait pas où chercher dans le fichier.
 */
const collectMissing = (node, remaining, prefix = '') => {
  if (remaining.length === 0) return isEmpty(node) ? [prefix] : [];

  const [head, ...rest] = remaining;
  const childPrefix = prefix ? `${prefix}.${head}` : head;

  if (head.endsWith('[]')) {
    const key = head.slice(0, -2);
    const items = node?.[key];
    const listPrefix = prefix ? `${prefix}.${key}` : key;
    if (!Array.isArray(items)) return [`${listPrefix}[]`];
    return items.flatMap((item, index) =>
      collectMissing(item, rest, `${listPrefix}[${index}]`),
    );
  }

  if (node?.[head] === undefined || node?.[head] === null) return [childPrefix];
  return collectMissing(node[head], rest, childPrefix);
};

/**
 * Garde de démarrage.
 *
 * Fonction pure : le contexte — environnement **et** configuration — est passé
 * explicitement plutôt que lu dans les constantes du module, pour être testable
 * sans modifier l'environnement du processus ni le fichier (même approche que
 * `assertDataModeAllowed` dans `src/shared/dataMode.js`).
 *
 * @param {object}  options
 * @param {boolean} options.isProd   environnement de production
 * @param {object}  options.config   configuration à contrôler (défaut : celle du fichier)
 * @param {string[]} options.requiredPaths chemins obligatoires en mode réel
 * @returns {{ mode: string, missing: string[] }} le diagnostic.
 * @throws {Error} en production avec du matériel simulé, ou en mode `REAL`
 *                 avec des champs obligatoires manquants.
 */
export const assertHardwareConfigReady = ({
  isProd = false,
  config = hardware,
  requiredPaths = REQUIRED_IN_REAL_MODE,
} = {}) => {
  /**
   * Le mode simulation est réservé au développement et aux tests. En
   * production, aucune valeur générée ne doit pouvoir entrer en base : le
   * serveur s'arrête au lieu de démarrer sur une flotte fictive.
   */
  if (isProd && config.mode === 'SIMULATION') {
    throw new Error(
      'Configuration matériel : le mode SIMULATION est refusé en production. '
      + 'Aucune donnée générée ne peut être enregistrée comme mesure. '
      + 'Renseigne le matériel réel dans src/config/hardware.js (mode: "REAL") '
      + 'et complète les champs obligatoires.',
    );
  }

  if (config.mode !== 'REAL') return { mode: config.mode, missing: [] };

  const missing = requiredPaths.flatMap((path) => collectMissing(config, path.split('.')));
  if (missing.length > 0) {
    throw new Error(
      'Configuration matériel : mode REAL déclaré, mais des champs obligatoires sont manquants.\n'
      + `   • ${missing.join('\n   • ')}\n\n`
      + 'Ces valeurs figurent sur les fiches techniques du matériel retenu '
      + '(et, pour le plan de fréquence, auprès du régulateur). '
      + 'Aucune valeur par défaut n’est fournie : une configuration inventée ferait tourner '
      + 'le système sur un matériel qu’il ne sait pas lire.\n'
      + 'Pour un environnement sans matériel, laisse mode: "SIMULATION" (hors production).',
    );
  }

  return { mode: config.mode, missing: [] };
};

/* ─────────────────────── Accesseurs ─────────────────────── */

/** Type de capteur par identifiant, ou `null`. */
export const sensorTypeBySlug = (slug) =>
  hardware.sensorTypes.find((sensorType) => sensorType.slug === slug) ?? null;

/**
 * Bornes plausibles d'une grandeur, tous types de capteurs confondus.
 *
 * Sert à écarter une mesure manifestement fausse (sonde hors service, décodage
 * erroné) avant qu'elle n'entre dans une recommandation. Une mesure hors
 * bornes est un dysfonctionnement, pas une donnée agronomique.
 */
export const plausibilityFor = (metricKey) => {
  for (const sensorType of hardware.sensorTypes) {
    const metric = sensorType.metrics.find((candidate) => candidate.key === metricKey);
    if (metric) return metric.plausibility;
  }
  return null;
};

/** Une mesure est-elle dans les bornes plausibles de sa grandeur ? */
export const isPlausible = (metricKey, value) => {
  const bounds = plausibilityFor(metricKey);
  // Sans borne connue, on ne peut pas déclarer la mesure invraisemblable :
  // l'absence de référentiel ne vaut pas condamnation.
  if (!bounds) return { plausible: true, checked: false, reason: 'Aucune borne de plausibilité définie.' };
  if (!Number.isFinite(value)) {
    return { plausible: false, checked: true, reason: 'Valeur non numérique.' };
  }
  if (bounds.min !== null && value < bounds.min) {
    return { plausible: false, checked: true, reason: `Sous la borne minimale (${bounds.min} ${bounds.unit}).` };
  }
  if (bounds.max !== null && value > bounds.max) {
    return { plausible: false, checked: true, reason: `Au-dessus de la borne maximale (${bounds.max} ${bounds.unit}).` };
  }
  return { plausible: true, checked: true, reason: null };
};

/** Valeur et provenance d'un réglage horodaté, pour affichage et audit. */
export const settingOf = (group, key) => hardware[group]?.[key] ?? null;

/**
 * Récapitulatif des valeurs non confirmées.
 *
 * Permet à l'exploitation de lister ce qui reste à arrêter avant un passage en
 * mode réel, sans lire le fichier ligne à ligne.
 */
/**
 * Recense les seuils **provisoires** : valeurs opérationnelles à recaler.
 *
 * Complément de `pendingConfirmations()`, qui ne collecte que les valeurs vides
 * et ne verrait donc jamais celles-ci. Un seuil provisoire non recalé sur données
 * réelles produit des taux de fausse alerte sans signification.
 */
export const provisionalThresholds = () => {
  const found = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      if (typeof node.source === 'string' && node.source.includes(PROVISIONAL)) {
        found.push({ path: path || '(racine)', value: node.value ?? null, unit: node.unit ?? null });
        return;
      }
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
    }
  };
  walk(hardware, '');
  return found;
};

export const pendingConfirmations = () => {
  const pending = [];

  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
      return;
    }
    if (isEmpty(node)) pending.push({ path, value: null });
  };

  walk(hardware, '');
  return pending;
};
