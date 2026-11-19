/**
 * ACADEMIA — règles d'autorisation et de cycle de vie (fonctions PURES).
 *
 * Aucune dépendance à la base : chaque règle est testée isolément
 * (tests/academia.test.mjs). Le service applique ces règles puis écrit.
 *
 * Référence : CDC-ACADEMIA-01 §2.3, §2.4, §11.4, annexe A.
 */
import { ACADEMIC_AFFILIATION_ROLES } from '../../shared/permissions.js';

/** Rôles qui administrent le domaine ACADEMIA (jamais les droits SUPER_ADMIN). */
export const ACADEMIA_GOVERNANCE_ROLES = ['ACADEMIA_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Cycle de vie d'une affiliation (§2.4).
 *  - PENDING   → VERIFIED | REJECTED (établissement), ENDED (retrait du demandeur)
 *  - VERIFIED  → SUSPENDED | ENDED
 *  - SUSPENDED → VERIFIED | ENDED
 *  - REJECTED, ENDED : états finaux (une nouvelle demande reste possible)
 */
export const AFFILIATION_TRANSITIONS = Object.freeze({
  PENDING: ['VERIFIED', 'REJECTED', 'ENDED'],
  VERIFIED: ['SUSPENDED', 'ENDED'],
  SUSPENDED: ['VERIFIED', 'ENDED'],
  REJECTED: [],
  ENDED: [],
});

/** Statuts qui bloquent une nouvelle demande pour le même établissement et le même rôle. */
export const OPEN_AFFILIATION_STATUSES = ['PENDING', 'VERIFIED', 'SUSPENDED'];

export const peutTransitionner = (from, to) =>
  Boolean(AFFILIATION_TRANSITIONS[from]?.includes(to));

export const estRoleAffiliable = (role) => ACADEMIC_AFFILIATION_ROLES.includes(role);

/** Rôles détenus par l'utilisateur DANS une organisation donnée (Membership ACTIVE). */
export const rolesDans = (user, organizationId) =>
  (user?.memberships ?? [])
    .filter((m) => m.organizationId === organizationId && (m.status ?? 'ACTIVE') === 'ACTIVE')
    .flatMap((m) => m.roles ?? []);

export const estGouvernanceAcademia = (user) =>
  (user?.roles ?? []).some((role) => ACADEMIA_GOVERNANCE_ROLES.includes(role));

/**
 * Administrer un établissement : gouvernance ACADEMIA, ou UNIVERSITY_ADMIN
 * de CET établissement. Le rôle UNIVERSITY_ADMIN d'un autre établissement ne
 * compte pas (annexe A : droits évalués dans le contexte de l'action).
 */
export const peutAdministrerEtablissement = (user, organizationId) =>
  estGouvernanceAcademia(user) || rolesDans(user, organizationId).includes('UNIVERSITY_ADMIN');

/**
 * Peut-on décider de cette affiliation ?
 *  - administrateur de l'établissement concerné ;
 *  - jamais sur sa propre demande (pas d'auto-validation, même gouvernance).
 */
export const peutDeciderAffiliation = (user, affiliation) => {
  if (!user || !affiliation) return false;
  if (affiliation.userId === user.id) return false;
  return peutAdministrerEtablissement(user, affiliation.organizationId);
};

/**
 * Effet d'une décision sur le Membership de l'établissement.
 *
 * @param {object} p
 * @param {string[]} p.rolesActuels   rôles du Membership existant ([] si aucun)
 * @param {string}   p.statutActuel   statut du Membership existant (null si aucun)
 * @param {string}   p.role           rôle porté par l'affiliation
 * @param {string}   p.nouveauStatut  statut cible de l'affiliation
 * @param {string[]} p.rolesCouvertsAilleurs rôles portés par D'AUTRES affiliations
 *        VERIFIED du même utilisateur dans le même établissement
 * @returns {{ roles: string[], status: 'ACTIVE'|'REMOVED' } | null}
 *          null = aucune écriture nécessaire
 */
export const membershipApresDecision = ({
  rolesActuels = [],
  statutActuel = null,
  role,
  nouveauStatut,
  rolesCouvertsAilleurs = [],
}) => {
  const actuels = statutActuel === 'ACTIVE' ? rolesActuels : [];

  if (nouveauStatut === 'VERIFIED') {
    const roles = [...new Set([...actuels, role])];
    return { roles, status: 'ACTIVE' };
  }

  if (nouveauStatut === 'SUSPENDED' || nouveauStatut === 'ENDED') {
    if (!statutActuel) return null;
    // Le rôle reste acquis s'il est aussi porté par une autre affiliation vérifiée.
    const roles = rolesCouvertsAilleurs.includes(role)
      ? actuels
      : actuels.filter((r) => r !== role);
    return { roles, status: roles.length > 0 ? 'ACTIVE' : 'REMOVED' };
  }

  return null; // PENDING, REJECTED : aucun droit accordé ni retiré
};

/** Type d'organisation correspondant au type d'établissement. */
export const orgTypePourEtablissement = (kind) =>
  (kind === 'RESEARCH_CENTER' ? 'RESEARCH_CENTER' : 'UNIVERSITY');
