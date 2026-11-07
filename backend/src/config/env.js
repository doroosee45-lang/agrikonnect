/**
 * Exigences CDC couvertes : I18N-01.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import 'dotenv/config';
import { z } from 'zod';

import { verifierConfigMessagerie } from './messagingConfig.js';

/**
 * Validation stricte des variables d'environnement.
 * Refus de démarrer si une variable critique manque (SEC-08 : pas de secret par défaut).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Base de données Supabase (Postgres)
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL est requis')
    .refine((v) => v.startsWith('postgres'), 'DATABASE_URL doit être une URL PostgreSQL'),
  DIRECT_URL: z.string().min(1).optional(),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL doit être une URL valide'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY est requis'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /** Bucket de stockage objet pour les médias publics (photos d'exploitation) */
  SUPABASE_BUCKET_MEDIA: z.string().default('media'),
  /** Bucket privé pour les documents de vérification (SEC-07) */
  SUPABASE_BUCKET_PRIVATE: z.string().default('private-documents'),

  /*
   * Stockage des fichiers géospatiaux déposés (géoradar, imagerie drone).
   *
   * `GEOSPATIAL_STORAGE_DRIVER` : `local` (tests et développement — écrit sur
   * disque) ou `object` (production — stockage objet). Un pilote inconnu est une
   * erreur de configuration, pas un repli silencieux sur `local` : en production,
   * écrire sur le disque d'un conteneur éphémère ferait perdre les fichiers au
   * redémarrage.
   *
   * `GEOSPATIAL_STORAGE_DIR` doit pointer **hors de tout dossier public**. Un
   * fichier déposé par un utilisateur n'est pas une ressource web ; le pilote
   * local refuse de démarrer sous `public/`, `dist/`, `build/`, `static/`, `www/`.
   */
  GEOSPATIAL_STORAGE_DRIVER: z.enum(['local', 'object', 's3']).default('local'),
  GEOSPATIAL_STORAGE_DIR: z.string().default('./storage/geospatial'),
  GEOSPATIAL_BUCKET: z.string().default('geospatial-imports'),
  /*
   * Stockage compatible S3 (`GEOSPATIAL_STORAGE_DRIVER=s3`).
   *
   * `s3` et `object` sont deux pilotes distincts, pas deux noms du même :
   * `object` parle à Supabase Storage avec son client JS, `s3` parle l'API S3
   * signée en SigV4 et fonctionne avec AWS, MinIO, R2, Scaleway ou Wasabi.
   *
   * Les cinq variables sont **obligatoires ensemble** dès que le pilote est
   * `s3` : un pilote mal configuré doit refuser de démarrer plutôt que d'écrire
   * dans un endroit inattendu. Le contrôle est fait par le pilote, pas ici,
   * parce que `local` et `object` n'ont pas besoin de ces valeurs.
   */
  S3_ENDPOINT: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  S3_REGION: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  S3_BUCKET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  S3_ACCESS_KEY_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  /**
   * `path-style` (`https://hote/panier/cle`) pour MinIO et les serveurs
   * auto-hébergés ; `virtual-host` (`https://panier.hote/cle`) pour AWS.
   * Le mauvais style ne produit pas d'erreur explicite : il signe un autre hôte,
   * donc un refus de signature. C'est pourquoi il est configurable.
   */
  S3_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  /*
   * Téléversement `multipart/form-data`. Plafond **par fichier** : la limite est
   * appliquée pendant la lecture du flux, pas après, donc un fichier trop gros
   * est refusé avant d'être entièrement reçu.
   */
  GEOSPATIAL_MULTIPART_MAX_BYTES: z.coerce.number().int().positive().default(64 * 1024 * 1024),
  /** Plafond du corps JSON (base64) du dépôt historique. */
  GEOSPATIAL_JSON_MAX_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  /*
   * Plafond **cumulé** de stockage par organisation, en octets. `0` désactive le
   * contrôle. Défaut 5 Go : le refus de doublon ne borne rien à lui seul,
   * puisqu'il suffit de changer un octet pour déposer un fichier « nouveau ».
   */
  GEOSPATIAL_ORG_QUOTA_BYTES: z.coerce.number().int().min(0).default(5 * 1024 * 1024 * 1024),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Temps réel Socket.IO (V2 §8.7) — désactivable pour les tests et scripts */
  REALTIME_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Tâches planifiées internes — désactivables pour les scripts et les tests */
  JOBS_ENABLED: z.enum(['true', 'false']).default('true'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),

  // Intégrations (non bloquantes en dev : providers "console" par défaut)
  SMS_PROVIDER: z.enum(['console', 'twilio', 'africastalking', 'webhook']).default('console'),
  /** Fournisseur générique (passerelle locale, agrégateur multi-pays, test) */
  /*
     * Une variable optionnelle laissée vide n'est pas une erreur : « non
     * configuré » et « mal configuré » sont deux états différents, seul le second
     * doit empêcher le démarrage. Même convention que SATELLITE_API_URL plus bas —
     * sans elle, copier `.env.example` tel quel casse le démarrage, ce qui pousse
     * l'exploitant à inventer une URL factice.
     */
  SMS_WEBHOOK_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER: z.string().default('AGRIKONNECT'),

  /**
   * Twilio (étape E). **Secrets uniquement ici, jamais dans le code ni les
   * journaux** : `TWILIO_AUTH_TOKEN` est aussi la clé de signature des
   * webhooks, sa fuite permettrait de forger des accusés de remise.
   */
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  /**
   * Identifiant d'expéditeur **alphanumérique**.
   *
   * En RDC, l'alphanumérique est pris en charge dynamiquement et l'identifiant
   * est préservé ; l'identifiant **numérique n'est pas remis par le réseau
   * Airtel**. 11 caractères au plus, au moins une lettre, identifiant générique
   * déconseillé. Vérifié par `validateSenderId()`.
   */
  TWILIO_SENDER_ID: z.string().default('AGRIKONNECT'),

  /**
   * Numéro expéditeur de **repli**, volontairement optionnel.
   *
   * S'il est vide — le défaut —, un refus de l'identifiant alphanumérique reste
   * un refus, et la raison est journalisée. Aucune bascule silencieuse :
   * l'agriculteur reconnaît l'expéditeur, et en RDC les identifiants
   * **numériques ne sont pas remis par Airtel**. Renseigner cette variable est
   * donc une décision explicite, pas un réglage par défaut.
   */
  TWILIO_FALLBACK_FROM: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
  /**
   * URL de base de l'API. Séparée pour que les tests visent un faux serveur
   * HTTP : c'est la seule façon d'exercer l'envoi sans compte réel.
   */
  TWILIO_API_BASE_URL: z.string().url().default('https://api.twilio.com'),
  /** URL d'accusé de remise, déclarée dans la console Twilio. */
  /*
     * Une variable optionnelle laissée vide n'est pas une erreur : « non
     * configuré » et « mal configuré » sont deux états différents, seul le second
     * doit empêcher le démarrage. Même convention que SATELLITE_API_URL plus bas —
     * sans elle, copier `.env.example` tel quel casse le démarrage, ce qui pousse
     * l'exploitant à inventer une URL factice.
     */
  TWILIO_STATUS_CALLBACK_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  /**
   * URL publique du webhook, **telle que déclarée chez Twilio**.
   *
   * L'URL fait partie du matériel signé : derrière un mandataire qui termine le
   * TLS, la reconstruire depuis la requête peut échouer. La fixer ici lève
   * l'ambiguïté. Vide = reconstruction depuis les en-têtes `X-Forwarded-*`.
   */
  /*
     * Une variable optionnelle laissée vide n'est pas une erreur : « non
     * configuré » et « mal configuré » sont deux états différents, seul le second
     * doit empêcher le démarrage. Même convention que SATELLITE_API_URL plus bas —
     * sans elle, copier `.env.example` tel quel casse le démarrage, ce qui pousse
     * l'exploitant à inventer une URL factice.
     */
  TWILIO_WEBHOOK_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  TWILIO_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  /**
   * Garde-fous de coût. Le SMS est payant et c'est le canal primaire : un lot
   * d'alertes mal réglé se traduit directement en facture.
   */
  SMS_DAILY_LIMIT_PER_FARMER: z.coerce.number().int().min(0).default(5),
  /** Plafond par organisation et par jour. `0` = illimité. */
  SMS_DAILY_LIMIT_PER_ORGANIZATION: z.coerce.number().int().min(0).default(500),
  /** Usage couvert par le consentement et le plafond. */
  SMS_ALERT_PURPOSE: z.string().default('ALERT'),
  /*
   * Fenêtre de silence : pas d'alerte SMS la nuit.
   *
   * La recommandation de conformité Twilio pour la RDC impose des envois en
   * heures diurnes. Une alerte agronomique à 3 h du matin réveille sans
   * informer : rien dans le cycle d'une culture ne se joue à cette heure, et un
   * canal qui réveille inutilement finit par être ignoré — ou bloqué.
   *
   * Le fuseau est celui du destinataire, pas celui du serveur : un backend
   * hébergé en Europe qui appliquerait son heure locale enverrait en pleine
   * nuit à Kinshasa.
   */
  SMS_QUIET_HOURS_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Début de la fenêtre de silence, `HH:MM` en heure locale du destinataire. */
  SMS_QUIET_START: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'SMS_QUIET_START attend HH:MM').default('21:00'),
  /** Fin de la fenêtre de silence. Une fin antérieure au début traverse minuit. */
  SMS_QUIET_END: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'SMS_QUIET_END attend HH:MM').default('06:00'),
  /** Fuseau appliqué quand le destinataire n'en déclare pas. */
  SMS_DEFAULT_TIMEZONE: z.string().default('Africa/Kinshasa'),
  /*
   * Escalade des alertes à deux niveaux.
   *
   * Niveau 1 : l'exploitant de la parcelle. Niveau 2, après le délai, si
   * l'alerte n'est toujours pas traitée : le rôle d'encadrement. Sans délai,
   * l'escalade doublerait chaque envoi ; sans condition de traitement, elle
   * notifierait pour une alerte déjà réglée.
   */
  ALERT_ESCALATION_ENABLED: z.enum(['true', 'false']).default('true'),
  ALERT_ESCALATION_DELAY_MINUTES: z.coerce.number().int().positive().default(120),
  ALERT_ESCALATION_ROLES: z.string().default('AGRONOMIST,SUPER_ADMIN'),
  EMAIL_PROVIDER: z.enum(['console', 'resend', 'sendgrid', 'webhook']).default('console'),
  /*
     * Une variable optionnelle laissée vide n'est pas une erreur : « non
     * configuré » et « mal configuré » sont deux états différents, seul le second
     * doit empêcher le démarrage. Même convention que SATELLITE_API_URL plus bas —
     * sans elle, copier `.env.example` tel quel casse le démarrage, ce qui pousse
     * l'exploitant à inventer une URL factice.
     */
  EMAIL_WEBHOOK_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@agrikonnect.africa'),
  /**
   * Domaines vérifiés chez le fournisseur, séparés par des virgules.
   *
   * Vide = aucun contrôle : on ne peut pas deviner la liste, et refuser de
   * démarrer sur un domaine inconnu bloquerait un déploiement légitime. Un
   * domaine d'exemple (`example.com`, `localhost`) est toujours refusé.
   */
  /**
   * URL de base des API e-mail.
   *
   * Séparées pour la même raison que `TWILIO_API_BASE_URL` : c'est le seul moyen
   * d'exercer l'envoi contre un faux serveur HTTP, donc de le tester sans compte
   * réel ni envoi véritable.
   */
  RESEND_API_BASE_URL: z.string().url().default('https://api.resend.com'),
  SENDGRID_API_BASE_URL: z.string().url().default('https://api.sendgrid.com'),
  /** Délai maximal d'un appel fournisseur e-mail. */
  EMAIL_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  EMAIL_VERIFIED_DOMAINS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),

  // Règles métier paramétrables (aucune valeur en dur dans le code)
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_SENDS_PER_HOUR: z.coerce.number().int().positive().default(5),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  /** Précision de la position publique par défaut (MAP-04 / SEC-12) */
  PUBLIC_COORD_DECIMALS: z.coerce.number().int().min(0).max(6).default(2),

  // Délais et rétentions portés par les tâches planifiées
  ORDER_RESPONSE_DAYS: z.coerce.number().int().positive().default(7),
  DISPUTE_SLA_DAYS: z.coerce.number().int().positive().default(5),
  /**
   * Moteur géospatial et pédologique (Python) — calcul des indices spectraux,
   * de la texture, des horizons de sous-sol et de la fusion multi-sources.
   * Le service est interne : jamais exposé directement au navigateur.
   */
  GEOAI_URL: z.string().url().default('http://127.0.0.1:8100'),
  GEOAI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  /** Jeton partagé optionnel entre l'API Node et le moteur Python */
  GEOAI_TOKEN: z.string().optional(),
  /** Nombre de tentatives sur erreur réseau (le moteur est idempotent) */
  GEOAI_RETRIES: z.coerce.number().int().min(0).max(3).default(1),

  /**
   * Lot de référentiel agronomique lu par le moteur de recommandation.
   *
   * `production` en exploitation. Les tests utilisent une autre étiquette
   * (`test`) : leurs plages sont stockées dans la même table mais ne peuvent
   * jamais être lues par le moteur de production, et ne figurent pas dans
   * `prisma/seed.js`.
   */
  AGRONOMIC_DATASET: z.string().trim().min(1).max(40).default('production'),
  /**
   * Version du moteur de recommandation utilisée par défaut.
   *
   * Déclarée ici pour être documentée et validée au démarrage, mais lue
   * directement depuis `process.env` par
   * `src/modules/recommendation/engineVersions.js` — qui reste ainsi sans
   * dépendance et testable isolément. Une valeur hors registre est refusée à
   * l'usage (422), jamais remplacée par la plus récente.
   */
  RECOMMENDATION_ENGINE_VERSION: z.string().trim().min(1).max(16).default('2.0'),
  /**
   * Couverture nuageuse (en %) au-delà de laquelle une scène satellite
   * **optique** est refusée pour l'humidité du sol. Sans effet sur le radar
   * Sentinel-1, qui traverse les nuages.
   */
  SATELLITE_CLOUD_REJECT_PCT: z.coerce.number().min(0).max(100).default(40),

  /**
   * Acquisition satellite programmée.
   *
   * Le fournisseur par défaut est `simulated` : sans identifiants, aucun
   * fournisseur réel ne peut répondre, et il vaut mieux produire des scènes
   * explicitement marquées simulées que de laisser croire à une mesure. Le mode
   * simulé est **refusé en production** par le service d'acquisition.
   *
   * `SATELLITE_API_URL` et `SATELLITE_API_KEY` sont les secrets : ils ne figurent
   * jamais dans le fichier de configuration matériel, qui ne fait que nommer les
   * variables (`src/config/hardware.js`, `satellite.apiUrlEnvVar`).
   */
  SATELLITE_PROVIDER: z.enum(['sentinelhub', 'earthengine', 'webhook', 'simulated']).default('simulated'),
  /**
   * Secrets du fournisseur satellite.
   *
   * Une valeur **vide** est traitée comme une absence, et non comme une URL
   * invalide : `.env.example` porte des lignes de rappel vides, et les copier
   * telles quelles ne doit pas empêcher le démarrage. « Non configuré » et
   * « mal configuré » sont deux états différents — seul le second est une erreur.
   */
  SATELLITE_API_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  SATELLITE_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  SATELLITE_ACQUISITION_ENABLED: z.enum(['true', 'false']).default('false'),
  /**
   * Cadence de **sondage** du fournisseur, en heures. Distincte de la période de
   * revisite du satellite : interroger l'API tous les jours est normal quand un
   * nouveau produit Sentinel-1 n'apparaît que tous les 6 à 12 jours.
   */
  SATELLITE_REFRESH_HOURS: z.coerce.number().positive().max(168).default(24),

  /**
   * Détection d'anomalies sur les mesures de sonde.
   *
   * Les seuils ne sont **pas** ici : ils vivent dans `src/config/hardware.js`
   * (section `anomalies`), marqués provisoires et à recaler sur les données du
   * pilote. Cette variable n'active que le job.
   */
  ANOMALY_DETECTION_ENABLED: z.enum(['true', 'false']).default('false'),
  /**
   * Données simulées — matériel géospatial pas encore installé.
   *
   * Ce drapeau n'autorise la simulation qu'hors production : en production le
   * refus est dur (voir `simulationAllowed` ci-dessous), il ne dépend d'aucune
   * variable. Une valeur simulée qui atteindrait une base de production
   * deviendrait indiscernable d'une mesure réelle pour l'agriculteur.
   */
  SIMULATION_ENABLED: z.enum(['true', 'false']).default('true'),

  /**
   * Secrets du réseau LoRaWAN (broker MQTT de ChirpStack).
   *
   * La **structure** du réseau (topics, plan de fréquence, qualité de service,
   * catalogue des capteurs) est dans le fichier de configuration matériel
   * (`src/config/hardware.js`), qui ne porte que le **nom** de ces variables.
   * Ici ne figurent que les valeurs sensibles, optionnelles tant qu'aucun
   * matériel n'est connecté.
   */
  LORAWAN_MQTT_URL: z.string().optional(),
  LORAWAN_MQTT_USERNAME: z.string().optional(),
  LORAWAN_MQTT_PASSWORD: z.string().optional(),

  /**
   * Seuil minimal de k-anonymat pour les agrégats publics (DATA-02).
   *
   * Ajouté au schéma : `insights.service.js` le lisait via `env.` alors qu'il
   * n'y figurait pas, donc la valeur configurée était ignorée et le seuil
   * retombait silencieusement sur 10.
   */
  AGGREGATE_MIN_GROUP_SIZE: z.coerce.number().int().positive().default(10),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  /**
   * Délai minimal entre deux notifications d'une même alerte encore ouverte,
   * en heures (CDC §8 : une alerte par paramètre et par épisode, avec rappel).
   *
   * Réglage d'exploitation, pas une caractéristique matérielle : il dépend du
   * coût du SMS et de la tolérance de l'agriculteur, pas d'une fiche technique.
   * `0` désactive la relance — l'alerte reste visible dans l'application.
   *
   * **Provisoire** : 24 h par défaut, à ajuster avec les coopératives pilotes.
   */
  ALERT_RENOTIFY_HOURS: z.coerce.number().min(0).default(24),
  /** Durée de validité par défaut d'un accès data room, en jours (DR-02) — plafond 90 */
  DATAROOM_ACCESS_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Variables d\'environnement invalides :\n');
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')} — ${issue.message}`);
  }
  console.error('\n👉 Copie .env.example vers .env et complète les valeurs.\n');
  process.exit(1);
}

const raw = parsed.data;

/*
 * Configuration de messagerie : une configuration qui ne peut pas fonctionner
 * **empêche le démarrage**. Sans ce contrôle, `SMS_PROVIDER=twilio` avec un
 * secret manquant démarre sans bruit et l'échec n'apparaît qu'au premier envoi —
 * c'est-à-dire au moment où l'on voulait joindre un agriculteur.
 *
 * Les messages citent le nom des variables, jamais leur valeur.
 */
const rapportMessagerie = verifierConfigMessagerie(raw);
for (const avertissement of rapportMessagerie.avertissements) {
  console.warn(`⚠️  Messagerie : ${avertissement}`);
}
if (rapportMessagerie.erreurs.length > 0) {
  console.error('\n❌ Configuration de messagerie incomplète :\n');
  for (const erreur of rapportMessagerie.erreurs) console.error(`   • ${erreur}`);
  console.error(
    '\n👉 Complète .env, ou reviens à SMS_PROVIDER=console / EMAIL_PROVIDER=console '
    + 'pour un démarrage local sans fournisseur.\n',
  );
  process.exit(1);
}

export const env = Object.freeze({
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
  apiPrefix: '/api/v1',
  /**
   * Verrou **dur** : en production, la simulation est refusée quelle que soit la
   * valeur de `SIMULATION_ENABLED`. Aucune variable d'environnement ne peut
   * rouvrir cette porte — c'est voulu.
   */
  simulationAllowed: raw.NODE_ENV !== 'production' && raw.SIMULATION_ENABLED === 'true',
});
