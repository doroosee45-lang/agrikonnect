/**
 * PROF-03 — complétude du profil : liste explicite des critères manquants.
 * Aucun « score » opaque : on expose des critères cochés (CDC A4 / VER-05).
 *
 * Module PUR (aucune dépendance) : testé directement, sans base ni client
 * Prisma (tests/profileSettings.test.mjs) ; utilisé par users.service.js.
 */

const ROLES_PRODUCTION = ['FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY'];

/**
 * Rôles dont le métier consiste à intervenir PERSONNELLEMENT auprès d'autres
 * acteurs (recommandation, vérification, analyse, accompagnement de terrain) :
 * leur profil professionnel (poste, domaine, biographie) fonde la confiance
 * qu'on leur accorde. Pour eux seuls, il compte dans la complétude.
 *
 * Les autres rôles n'en dépendent pas : producteurs (critères d'exploitation),
 * acheteurs, fournisseurs et transporteurs (identifiés par leur organisation),
 * investisseurs (profil investisseur dédié). Leur complétude reste inchangée.
 */
export const ROLES_PROFIL_PROFESSIONNEL = ['AGRONOMIST', 'VERIFIER', 'LAB_PARTNER', 'SUPPORT_AGENT'];

/** Critères applicables selon les rôles réellement détenus. */
export const completenessCriteria = ({ profile, farms, plots, productions, roles = [] }) => {
  const criteres = [
    { key: 'identity', label: 'Nom et prénom renseignés', done: Boolean(profile.firstName && profile.lastName) },
    { key: 'phone_verified', label: 'Téléphone vérifié', done: Boolean(profile.phoneVerifiedAt) },
    { key: 'email_verified', label: 'Email vérifié', done: Boolean(profile.emailVerifiedAt) },
    { key: 'avatar', label: 'Photo de profil', done: Boolean(profile.avatarUrl) },
    {
      key: 'professional',
      label: 'Profil professionnel renseigné',
      done: Boolean(
        profile.professionalProfile?.jobTitle &&
          profile.professionalProfile?.activityDomain &&
          profile.professionalProfile?.biography,
      ),
    },
    { key: 'farm', label: 'Au moins une exploitation créée', done: farms > 0 },
    { key: 'plot', label: 'Au moins une parcelle localisée', done: plots > 0 },
    { key: 'production', label: 'Au moins une production déclarée', done: productions > 0 },
  ];
  const horsProduction = new Set(['farm', 'plot', 'production']);
  const producteur = roles.some((r) => ROLES_PRODUCTION.includes(r));
  const intervenant = roles.some((r) => ROLES_PROFIL_PROFESSIONNEL.includes(r));
  return criteres.filter((c) => {
    if (horsProduction.has(c.key)) return producteur;
    if (c.key === 'professional') return intervenant;
    return true;
  });
};
