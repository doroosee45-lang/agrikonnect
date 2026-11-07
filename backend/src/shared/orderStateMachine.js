/**
 * Machine à états des commandes (CDС V2 §8.4).
 *
 * Module **pur** : aucune dépendance base de données, donc testable
 * directement et réutilisable côté mobile pour griser les boutons avant même
 * un appel réseau. Le serveur reste seul juge : il revalide chaque transition.
 *
 * Trois notions distinctes, volontairement séparées :
 *  - `TRANSITIONS` : qui peut déclencher quoi depuis quel état
 *    (annulation possible jusqu'à l'expédition incluse, jamais après) ;
 *  - `HOLDS_STOCK` : les états pendant lesquels la quantité commandée est
 *    réservée sur l'annonce (donc à libérer en cas d'annulation) ;
 *  - `TERMINAL` : les états définitifs, sur lesquels plus aucune action n'est
 *    possible.
 */

/** États → { état cible → rôles autorisés }. `moderator` = MODERATOR/ADMIN/SUPER_ADMIN. */
export const TRANSITIONS = {
  PENDING: { ACCEPTED: ['seller'], REJECTED: ['seller'], CANCELLED: ['buyer'] },
  ACCEPTED: { PROCESSING: ['seller'], CANCELLED: ['buyer', 'seller'], DISPUTED: ['buyer', 'seller'] },
  PROCESSING: { READY: ['seller'], CANCELLED: ['buyer', 'seller'], DISPUTED: ['buyer', 'seller'] },
  READY: { IN_TRANSIT: ['seller'], CANCELLED: ['buyer', 'seller'], DISPUTED: ['buyer', 'seller'] },
  IN_TRANSIT: { DELIVERED: ['seller', 'buyer'], DISPUTED: ['buyer', 'seller'] },
  DELIVERED: { COMPLETED: ['buyer'], DISPUTED: ['buyer'] },
  DISPUTED: { COMPLETED: ['moderator'], CANCELLED: ['moderator'] },
  COMPLETED: {},
  REJECTED: {},
  CANCELLED: {},
};

/** États durant lesquels le stock de l'annonce est réservé. */
export const HOLDS_STOCK = new Set(['ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED']);

/** États définitifs. */
export const TERMINAL = new Set(['COMPLETED', 'REJECTED', 'CANCELLED']);

/** Rôle de l'organisation appelante vis-à-vis d'une commande. */
export const partyOf = (order, organizationId) => {
  if (!order || !organizationId) return null;
  if (order.buyerOrgId === organizationId) return 'buyer';
  if (order.sellerOrgId === organizationId) return 'seller';
  return null;
};

export const isModeratorRole = (roles = []) =>
  roles.some((role) => ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role));

/** États cibles atteignables par un rôle donné (pour l'UI). */
export const allowedTargets = (status, role, moderator = false) => {
  const available = TRANSITIONS[status] ?? {};
  return Object.entries(available)
    .filter(([, roles]) => (moderator && roles.includes('moderator')) || (role && roles.includes(role)))
    .map(([target]) => target);
};

/**
 * Valide une transition.
 * @returns {{ allowed: boolean, code?: 'UNKNOWN_STATUS'|'FORBIDDEN_TRANSITION'|'FORBIDDEN_ROLE',
 *             message?: string, allowedTargets: string[], releasesStock: boolean, holdsStock: boolean }}
 */
export const canTransition = ({ from, to, role = null, moderator = false }) => {
  const available = TRANSITIONS[from];

  if (!available) {
    return {
      allowed: false,
      code: 'UNKNOWN_STATUS',
      message: `Statut de commande inconnu : ${from}`,
      allowedTargets: [],
      releasesStock: false,
      holdsStock: false,
    };
  }

  const roles = available[to];
  const targets = allowedTargets(from, role, moderator);

  if (!roles) {
    return {
      allowed: false,
      code: 'FORBIDDEN_TRANSITION',
      message: `Transition interdite : ${from} → ${to}. Possibles : ${targets.join(', ') || 'aucune'}.`,
      allowedTargets: targets,
      releasesStock: false,
      holdsStock: HOLDS_STOCK.has(from),
    };
  }

  const permitted = (role && roles.includes(role)) || (moderator && roles.includes('moderator'));

  if (!permitted) {
    return {
      allowed: false,
      code: 'FORBIDDEN_ROLE',
      message: `Cette transition doit être déclenchée par : ${roles.join(' ou ')}.`,
      allowedTargets: targets,
      releasesStock: false,
      holdsStock: HOLDS_STOCK.has(from),
    };
  }

  return {
    allowed: true,
    allowedTargets: targets,
    // On ne libère le stock que s'il était réellement réservé.
    releasesStock: to === 'CANCELLED' && HOLDS_STOCK.has(from),
    holdsStock: HOLDS_STOCK.has(to),
  };
};

/** Une commande terminée/annulée n'accepte plus d'action. */
export const isTerminal = (status) => TERMINAL.has(status);

/**
 * Progression lisible pour l'interface (barre d'étapes).
 * Les branches (REJECTED/CANCELLED/DISPUTED) sont signalées à part.
 */
export const progressOf = (status) => {
  const steps = ['PENDING', 'ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
  const index = steps.indexOf(status);
  return {
    steps,
    current: index,
    offTrack: ['REJECTED', 'CANCELLED', 'DISPUTED'].includes(status),
    percent: index >= 0 ? Math.round(((index + 1) / steps.length) * 100) : 0,
  };
};
