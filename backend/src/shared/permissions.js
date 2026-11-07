/**
 * Matrice RBAC — V1 → V5 (CDC §3.2 / A.2 / V1 §3.2 / V2 §3.2 / V3-V5 §3.2).
 *
 * Permissions granulaires `ressource.action`. La propriété de la ressource
 * et l'isolation tenant sont vérifiées séparément (middleware + services).
 */

const PRODUCER = [
  'FARMER',
  'COOPERATIVE_ADMIN',
  'COOPERATIVE_MEMBER',
  'AGRICULTURAL_COMPANY',
  'SUPPORT_AGENT',
];

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const MODERATION = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];
const EVERYONE = ['*'];

/** V2 — acteurs commerciaux */
const COMMERCE = [...PRODUCER, 'BUYER', 'SUPPLIER'];
const TRANSPORT = [...COMMERCE, 'TRANSPORTER'];

/** V3 — expertise et appareils */
const EXPERT = ['AGRONOMIST', 'VERIFIER', ...ADMIN_ROLES];

/** V4 — investissement */
const INVEST = ['INVESTOR', 'VERIFIER', ...ADMIN_ROLES];

/** V5 — gouvernance */
const COUNTRY_SCOPE = ['COUNTRY_ADMIN', ...ADMIN_ROLES];

export const PERMISSIONS = {
  // ─── V1 — référentiels & identité ───────────────────────────
  'crops.read': EVERYONE,
  'crops.write': ADMIN_ROLES,
  'countries.read': EVERYONE,
  'countries.write': ['SUPER_ADMIN'],
  'fx.read': EVERYONE,
  'fx.write': [...ADMIN_ROLES, 'SUPPORT_AGENT'],
  'farms.read': [...PRODUCER, ...MODERATION],
  'farms.write': PRODUCER,
  'farms.delete': PRODUCER,
  'plots.read': [...PRODUCER, ...MODERATION],
  'plots.write': PRODUCER,
  'plots.delete': PRODUCER,
  'history.read': [...PRODUCER, ...MODERATION],
  'history.write': PRODUCER,
  'productions.read': [...PRODUCER, ...MODERATION],
  'productions.write': PRODUCER,
  'soil.read': [...PRODUCER, ...MODERATION],
  'soil.write': PRODUCER,
  'soil.recommend': [...PRODUCER, ...EXPERT],
  /**
   * Recommandation culturale (quoi semer sur une période).
   * La lecture est ouverte à l'agronome et à l'admin pour l'appui technique ;
   * l'acceptation ou le refus reste un acte du producteur.
   */
  'recommendation.read': [...PRODUCER, ...EXPERT],
  'recommendation.write': PRODUCER,
  /**
   * Retours de saison : le rendement réellement obtenu.
   *
   * `seasons` et non `seasonFeedback` : le format imposé aux permissions est
   * `^[a-z]+\.[a-z]+$` (contrôlé par `tests/logic.test.mjs`), donc ni majuscule
   * ni underscore. L'écart de nom avec le modèle Prisma `SeasonFeedback` est
   * volontaire et documenté ici pour qu'on ne le « corrige » pas.
   *
   * Lecture aux producteurs **et** aux experts : l'agronome doit voir ce qui a
   * réellement été récolté pour juger ses plages. Écriture aux producteurs,
   * parce que c'est leur récolte qu'ils déclarent.
   */
  'seasons.read': [...PRODUCER, ...EXPERT],
  'seasons.write': PRODUCER,
  'rules.read': [...PRODUCER, ...EXPERT],
  'rules.write': ['AGRONOMIST', ...ADMIN_ROLES],
  'rules.validate': ['AGRONOMIST', ...ADMIN_ROLES],
  /**
   * Référentiel agronomique (plages pH, température, salinité…).
   * Lecture large : l'agronome et le producteur doivent pouvoir vérifier sur
   * quelle base une recommandation a été calculée. Écriture et validation
   * réservées à l'agronome et aux administrateurs.
   */
  'ranges.read': [...PRODUCER, ...EXPERT],
  'ranges.write': ['AGRONOMIST', ...ADMIN_ROLES],
  'ranges.validate': ['AGRONOMIST', ...ADMIN_ROLES],
  /**
   * SMS (étape E) — canal primaire et payant.
   *
   * `sms.consent` : chacun gère **son** consentement, producteur compris —
   * c'est le seul mécanisme de désinscription, le canal étant à sens unique.
   * `sms.read` : le suivi de remise intéresse l'exploitant et l'agronome.
   * `sms.send` : **réservé aux administrateurs**. Un envoi de recette coûte
   * de l'argent réel et peut viser n'importe quel numéro ; laisser cette route
   * ouverte à tout compte en ferait un vecteur de coût, même sous plafond.
   */
  'sms.consent': EVERYONE,
  'sms.read': [...PRODUCER, ...EXPERT],
  'sms.send': ADMIN_ROLES,
  // Surveillance des recommandations (CDC §8). Lecture : ceux qui exploitent la
  // parcelle et ceux qui la conseillent. Clôture d'une alerte : l'exploitant et
  // l'agronome — pas un rôle purement consultatif.
  'alerts.read': [...PRODUCER, ...EXPERT],
  'alerts.write': ['FARMER', 'COOPERATIVE_ADMIN', 'AGRICULTURAL_COMPANY', 'AGRONOMIST', ...ADMIN_ROLES],
  // Prévision des paramètres du sol. Déclencher un calcul sur sa parcelle est
  // un acte d'exploitation ; lire le résultat intéresse aussi l'agronome.
  'forecast.read': [...PRODUCER, ...EXPERT],
  'forecast.write': [...PRODUCER, 'AGRONOMIST', ...ADMIN_ROLES],
  // Gouvernance des modèles. La promotion est réservée à l'administration :
  // c'est l'acte qui met un modèle appris face aux agriculteurs.
  'models.read': [...EXPERT],
  'models.write': ['AGRONOMIST', ...ADMIN_ROLES],
  'models.promote': ADMIN_ROLES,
  // Acquisition satellite. Déclencher une acquisition consomme du quota
  // fournisseur : réservé à l'exploitation et à l'agronome, pas aux investisseurs.
  'satellite.read': [...PRODUCER, ...EXPERT],
  'satellite.write': ['FARMER', 'COOPERATIVE_ADMIN', 'AGRICULTURAL_COMPANY', 'AGRONOMIST', ...ADMIN_ROLES],
  // Anomalies de mesure. La **revue** est réservée à l'agronome et aux
  // administrateurs : rejeter une anomalie réhabilite la mesure, donc modifie
  // l'état du sol qui fonde les recommandations. Ce n'est pas un acte anodin.
  'anomaly.read': [...PRODUCER, ...EXPERT],
  'anomaly.write': ['FARMER', 'COOPERATIVE_ADMIN', 'AGRICULTURAL_COMPANY', 'AGRONOMIST', ...ADMIN_ROLES],
  'anomaly.review': ['AGRONOMIST', ...ADMIN_ROLES],
  'flags.write': ADMIN_ROLES,
  'cooperatives.read': [...PRODUCER, ...ADMIN_ROLES],
  'cooperatives.write': ['COOPERATIVE_ADMIN', ...ADMIN_ROLES],
  'cooperatives.members': ['COOPERATIVE_ADMIN', ...ADMIN_ROLES],
  'media.upload': PRODUCER,
  'media.delete': PRODUCER,
  'verifications.create': PRODUCER,
  'verifications.read': [...PRODUCER, ...ADMIN_ROLES],
  'verifications.review': ADMIN_ROLES,
  'reports.create': [...PRODUCER, 'BUYER', 'VISITOR'],
  'reports.review': MODERATION,
  'admin.users': ADMIN_ROLES,
  'admin.audit': ADMIN_ROLES,
  'admin.settings': ['SUPER_ADMIN', 'ADMIN'],
  'admin.dashboard': [...ADMIN_ROLES, 'MODERATOR'],
  'admin.jobs': ADMIN_ROLES,

  // ─── V2 — MARKET ────────────────────────────────────────────
  'listings.read': EVERYONE,
  'listings.write': COMMERCE,
  'listings.moderate': MODERATION,
  'listings.media': COMMERCE,
  'requests.read': [...COMMERCE, ...MODERATION],
  'requests.write': [...COMMERCE, ...MODERATION],
  'offers.read': [...COMMERCE],
  'offers.write': COMMERCE,
  'orders.read': [...COMMERCE, 'TRANSPORTER', ...MODERATION],
  'orders.write': COMMERCE,
  'orders.review': MODERATION,
  'inventory.read': [...COMMERCE, ...ADMIN_ROLES],
  'inventory.write': COMMERCE,
  'transport.read': TRANSPORT,
  'transport.write': TRANSPORT,
  'messages.read': [...PRODUCER, 'BUYER', 'SUPPLIER', 'TRANSPORTER', ...MODERATION],
  'messages.write': [...PRODUCER, 'BUYER', 'SUPPLIER', 'TRANSPORTER', ...MODERATION],
  'messages.moderate': MODERATION,
  'notifications.read': EVERYONE,
  'notifications.write': EVERYONE,
  'invoices.read': [...COMMERCE, ...ADMIN_ROLES],
  'invoices.write': COMMERCE,
  'reviews.read': EVERYONE,
  'reviews.write': COMMERCE,
  'reviews.moderate': MODERATION,
  'disputes.read': [...COMMERCE, ...MODERATION],
  'disputes.review': MODERATION,

  // ─── V3 — INTELLIGENCE ──────────────────────────────────────
  'sync.write': PRODUCER,
  'ai.read': [...PRODUCER, ...EXPERT],
  'ai.write': PRODUCER,
  'ai.review': EXPERT,
  'weather.read': EVERYONE,
  'prices.read': EVERYONE,
  'prices.write': [...ADMIN_ROLES, 'SUPPORT_AGENT'],
  'lots.read': [...PRODUCER, ...MODERATION],
  'lots.write': PRODUCER,
  'certifications.read': [...PRODUCER, 'BUYER', ...MODERATION],
  'certifications.write': PRODUCER,
  'certifications.verify': [...ADMIN_ROLES, 'VERIFIER'],
  'iot.read': [...PRODUCER, ...ADMIN_ROLES],
  'iot.write': PRODUCER,
  'geodata.read': [...PRODUCER, ...EXPERT],
  'geodata.write': PRODUCER,
  'channels.read': ADMIN_ROLES,
  'lab.read': [...PRODUCER, 'LAB_PARTNER', ...ADMIN_ROLES],
  'lab.write': ['LAB_PARTNER', ...ADMIN_ROLES],

  // ─── V4 — INVEST ────────────────────────────────────────────
  'projects.read': [...PRODUCER, ...INVEST],
  'projects.write': [...PRODUCER, 'AGRICULTURAL_COMPANY'],
  'projects.review': [...ADMIN_ROLES, 'VERIFIER'],
  'investors.read': [...INVEST, ...ADMIN_ROLES],
  'investors.write': ['INVESTOR', ...ADMIN_ROLES],
  'investors.verify': ADMIN_ROLES,
  'dataroom.read': [...PRODUCER, 'INVESTOR', 'VERIFIER', ...ADMIN_ROLES],
  'dataroom.write': PRODUCER,
  'dataroom.request': [...INVEST],
  'dataroom.decide': PRODUCER,
  'duediligence.read': [...PRODUCER, 'INVESTOR', 'VERIFIER', ...ADMIN_ROLES],
  'duediligence.write': [...PRODUCER, 'VERIFIER', ...ADMIN_ROLES],
  'reporting.read': [...PRODUCER, ...INVEST],
  'reporting.write': PRODUCER,
  'funding.read': [...PRODUCER, ...ADMIN_ROLES],
  'funding.write': PRODUCER,
  'precision.read': [...PRODUCER, ...EXPERT],
  'precision.write': PRODUCER,
  // Moteur géospatial (Python) : lecture des diagnostics pour le producteur et
  // l'expertise ; calcul réservé aux acteurs qui gèrent la parcelle.
  'geospatial.read': [...PRODUCER, ...EXPERT, 'INVESTOR'],
  'geospatial.write': [...PRODUCER, ...EXPERT],

  // ─── V5 — GLOBAL ────────────────────────────────────────────
  'tenders.read': EVERYONE,
  'tenders.write': [...COMMERCE, 'BUYER'],
  'tenders.respond': COMMERCE,
  'export.read': [...COMMERCE, ...ADMIN_ROLES],
  'export.write': [...PRODUCER, 'BUYER', 'SUPPLIER'],
  'apiclients.read': [...ADMIN_ROLES, 'COUNTRY_ADMIN'],
  'apiclients.manage': ADMIN_ROLES,
  'insights.read': [...COUNTRY_SCOPE, ...ADMIN_ROLES],
  'dataproducts.manage': [...ADMIN_ROLES, 'DATA_STEWARD'],
  'data.read': EVERYONE,

  'dataproducts.manage': [...ADMIN_ROLES, 'DATA_STEWARD'],
  'data.read': EVERYONE,

  // ─── V6 — GOUVERNANCE (SPEC-SUPER-ADMIN) — palier 2 : SUPER_ADMIN seul ──
  // Nomination/révocation des rôles de gouvernance (SEC-03).
  'admin.roles': ['SUPER_ADMIN'],
  // Politique de sécurité (MFA, verrouillage, sessions) et secrets d'intégration.
  'admin.security': ['SUPER_ADMIN'],
  // Feature flags par zone (zone_feature_flags).
  'admin.flags': ['SUPER_ADMIN'],
  // Maintenance : purges, comptes orphelins, verrous (RG-G5).
  'admin.maintenance': ['SUPER_ADMIN'],
};

/**
 * Vérifie si l'un des rôles possède la permission demandée.
 * @param {string[]} roles rôles effectifs (union organisation active + global)
 * @param {string} permission ex. "orders.write"
 */
export const can = (roles = [], permission) => {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  if (allowed.includes('*')) return true;
  return roles.some((role) => allowed.includes(role));
};

export const PRODUCER_ROLES = PRODUCER;

/**
 * Rôles de gouvernance (SEC-03) — jamais ouverts à l'inscription libre :
 * attribués uniquement par un Super Admin (`admin.roles`, garde
 * `requireSuperAdmin`). Utilisé par les schémas de validation M2 et par
 * l'écran de gestion des rôles (web + mobile).
 */
export const GOVERNANCE_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'MODERATOR',
  'COUNTRY_ADMIN',
  'DATA_STEWARD',
  'VERIFIER',
  'LAB_PARTNER',
];



