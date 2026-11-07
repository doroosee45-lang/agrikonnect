/**
 * Parcours d authentification - destination initiale CENTRALISEE (CAA section 9).
 *
 * MIROIR DU MODULE WEB (apps/web/src/lib/redirects.ts) : meme logique, meme
 * ordre, memes priorites. SEULE LA TABLE DES DESTINATIONS change : elle cite
 * les ROUTES MOBILES REELLES (arborescence src/app), validees le 2026-11-05.
 * Aucune route n est inventee ici.
 *
 * Une seule fonction decide ou un utilisateur authentifie doit atterrir :
 *
 *   statut -> verification e-mail -> role (contexte actif) -> permission ->
 *   configuration initiale si identite manquante -> espace metier.
 *
 * Regles du cahier des charges :
 *  - jamais de redirection vers le site public apres authentification ;
 *  - le role vient de la source fiable (API : user.organizations[].roles),
 *    jamais d une valeur forgee par l application ;
 *  - MODERATOR n accede a /admin/dashboard que si la permission reelle
 *    admin.dashboard est accordee - aucune elevation de privileges ;
 *  - multi-roles / multi-organisations : le CONTEXTE ACTIF tranche
 *    (activeOrganizationId explicite ou priorite documentee) ;
 *  - un compte suspendu, sans role valide, ou de role inconnu n atterrit
 *    jamais dans un espace arbitraire : ecrans sures uniquement ;
 *  - aucune configuration facultative ne bloque l acces : seules des
 *    informations strictement obligatoires (identite) renvoient vers l ecran
 *    de configuration du role.
 *
 * NOTES DE PLATEFORME (mobile) :
 *  - TRANSPORTER : aucun espace transporteur n existe sur mobile (le web
 *    /app/transport : demandes, offres, preuves de livraison, n a pas de
 *    miroir). Atterrissage volontaire sur l ecran sur /profil, decision
 *    validee le 2026-11-05 - documentee au RAPPORT-PARCOURS-AUTHENTIFICATION.
 *  - BUYER/SUPPLIER : espace commandes = /marketplace (web : /market/app).
 *  - SUPPORT_AGENT : espace agent de terrain = /agent/consent (web :
 *    /app/agent).
 *  - PUBLIC_USER : espace membre = /notifications (web : /app).
 *  - ecrans sures = /profil (web : /app/profile et /app/verification).
 *  - le contexte actif est porte par activeOrganizationId (parametre ou
 *    stockage) ; sans stockage (React Native), le repli prioritaire s applique.
 */

export type CompletenessItem = { key: string; label?: string; done: boolean };

export type UserLike = {
  status?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
  organizations?: { id: string; roles?: string[] | null }[] | null;
};

export type RedirectInput = {
  user: UserLike | null;
  permissions?: string[] | null;
  /** Completeness optionnelle : jamais bloquante hors identite. */
  completeness?: CompletenessItem[] | null;
  /** Contexte actif explicite (organisation choisie). */
  activeOrganizationId?: string | null;
};

export type RedirectResult = { route: string; reason: string };

/** Ordre de priorite pour les comptes multi-roles (documente au rapport). */
const ROLE_PRIORITY: string[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'COOPERATIVE_ADMIN',
  'AGRICULTURAL_COMPANY',
  'FARMER',
  'BUYER',
  'SUPPLIER',
  'TRANSPORTER',
  'AGRONOMIST',
  'LAB_PARTNER',
  'INVESTOR',
  'SUPPORT_AGENT',
  'COOPERATIVE_MEMBER',
  'API_CLIENT',
  'PUBLIC_USER',
];

/** Role -> espace metier MOBILE (routes reelles de src/app, 2026-11-05). */
const ESPACE_PAR_ROLE: Record<string, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  MODERATOR: '/admin/dashboard',
  FARMER: '/farmer',
  COOPERATIVE_ADMIN: '/organization',
  COOPERATIVE_MEMBER: '/organization',
  AGRICULTURAL_COMPANY: '/organization',
  BUYER: '/marketplace',
  SUPPLIER: '/marketplace',
  TRANSPORTER: '/profil',
  AGRONOMIST: '/reviewer/missions',
  LAB_PARTNER: '/reviewer/missions',
  INVESTOR: '/investment',
  SUPPORT_AGENT: '/agent/consent',
  API_CLIENT: '/developers',
  PUBLIC_USER: '/notifications',
};

/** Ecran de configuration initiale par role (ecrans de profil EXISTANTS). */
const CONFIG_PAR_ROLE: Record<string, string> = {
  FARMER: '/farmer/profile',
  COOPERATIVE_ADMIN: '/organization/profile',
  COOPERATIVE_MEMBER: '/organization/profile',
  AGRICULTURAL_COMPANY: '/organization/profile',
  INVESTOR: '/investment/profile',
};

/** Ecrans sures (aucun espace metier arbitraire) - mobile : /profil. */
export const ECRAN_ATTENTE = '/profil';
export const ECRAN_SUR = '/profil';
export const ECRAN_CONNEXION = '/auth/login';

const CLE_CONTEXTE = 'agrikonnect.activeOrganizationId';

/** Lecture du contexte actif memorise (organisations multiples). */
export function getActiveOrganizationId(): string | null {
  try {
    return globalThis.localStorage?.getItem(CLE_CONTEXTE) ?? null;
  } catch {
    return null;
  }
}

/** Memorisation du contexte actif (appelee par les espaces multi-organisations). */
export function setActiveOrganizationId(id: string | null): void {
  try {
    if (id === null) globalThis.localStorage?.removeItem(CLE_CONTEXTE);
    else globalThis.localStorage?.setItem(CLE_CONTEXTE, id);
  } catch {
    /* stockage indisponible : le contexte reste explicite a l appel */
  }
}

/** Tous les roles de l utilisateur, toutes organisations confondues. */
export function getRoles(user: UserLike | null): string[] {
  const liste = new Set<string>();
  for (const org of user?.organizations ?? []) {
    for (const role of org.roles ?? []) liste.add(role);
  }
  return [...liste];
}

/**
 * Contexte actif : organisation retenue + ses roles.
 *
 * 1. activeOrganizationId explicite (parametre ou memorise) s il est valide ;
 * 2. sinon la premiere organisation selon la priorite de ses roles.
 */
export function resolveActiveContext(
  user: UserLike | null,
  activeOrganizationId?: string | null,
): { organizationId: string | null; roles: string[] } {
  const organisations = user?.organizations ?? [];
  if (organisations.length === 0) return { organizationId: null, roles: [] };

  const souhaite = activeOrganizationId ?? getActiveOrganizationId();
  const explicite = organisations.find((o) => o.id === souhaite);
  if (explicite) {
    return { organizationId: explicite.id, roles: [...(explicite.roles ?? [])] };
  }

  const rang = (roles: string[] | null | undefined): number => {
    let meilleur = Number.POSITIVE_INFINITY;
    for (const role of roles ?? []) {
      const i = ROLE_PRIORITY.indexOf(role);
      if (i !== -1 && i < meilleur) meilleur = i;
    }
    return meilleur;
  };

  const meilleure = [...organisations].sort((a, b) => rang(a.roles) - rang(b.roles))[0];
  return { organizationId: meilleure.id, roles: [...(meilleure.roles ?? [])] };
}

/**
 * Decision unique de destination initiale.
 *
 * Ordre (CAA section 9) :
 * statut -> verification e-mail -> role du contexte actif -> permission ->
 * configuration initiale si identite manquante -> espace metier.
 */
export function getUserInitialRoute(input: RedirectInput): RedirectResult {
  const user = input.user;
  if (!user) return { route: ECRAN_CONNEXION, reason: 'aucun utilisateur' };

  if (user.status && user.status !== 'ACTIVE') {
    return { route: ECRAN_ATTENTE, reason: `compte ${user.status} - espace d attente` };
  }

  if (user.email && user.emailVerified === false) {
    return {
      route: '/auth/verify-email?email=' + encodeURIComponent(user.email),
      reason: 'adresse e-mail non verifiee - parcours de verification',
    };
  }

  const contexte = resolveActiveContext(user, input.activeOrganizationId);
  const roles = contexte.roles.length > 0 ? contexte.roles : getRoles(user);
  if (roles.length === 0) {
    return { route: ECRAN_SUR, reason: 'aucun role valide - ecran sur' };
  }

  const rangs = roles
    .map((r) => ROLE_PRIORITY.indexOf(r))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b);
  if (rangs.length === 0) {
    return { route: ECRAN_SUR, reason: 'role(s) inconnu(s) - ecran sur' };
  }
  const role = ROLE_PRIORITY[rangs[0]];
  const destination = ESPACE_PAR_ROLE[role];
  if (!destination) return { route: ECRAN_SUR, reason: `role ${role} sans espace - ecran sur` };

  if (destination === '/admin/dashboard') {
    const permissions = input.permissions ?? [];
    if (!permissions.includes('admin.dashboard')) {
      return {
        route: ECRAN_SUR,
        reason: `role ${role} sans permission admin.dashboard - aucun acces admin`,
      };
    }
  }

  const identiteComplete = Boolean(user.firstName && user.lastName);
  if (!identiteComplete) {
    return {
      route: CONFIG_PAR_ROLE[role] ?? ECRAN_SUR,
      reason: 'identite obligatoire manquante - configuration initiale',
    };
  }

  return { route: destination, reason: `espace ${role}` };
}
