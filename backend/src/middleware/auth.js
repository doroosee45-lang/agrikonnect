/**
 * Exigences CDC couvertes : SEC-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { supabase } from '../config/supabase.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../shared/errors/ApiError.js';

const extractToken = (req) => {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
};

/**
 * Charge l'utilisateur depuis un token Supabase, puis complète avec
 * son profil applicatif et ses appartenances (rôles par organisation).
 */
const resolveUser = async (token) => {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw ApiError.unauthorized('Token invalide ou expiré');

  const authUser = data.user;

  const profile = await prisma.profile.findUnique({
    where: { id: authUser.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE', organization: { deletedAt: null } },
        include: { organization: { select: { id: true, type: true, name: true, slug: true, countryCode: true } } },
      },
    },
  });

  if (!profile) {
    // L'utilisateur existe côté Supabase mais pas côté application : le
    // premier appel à /auth/sync-profile le créera.
    return {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
      roles: [],
      memberships: [],
      profile: null,
      needsSync: true,
    };
  }

  if (profile.status !== 'ACTIVE') {
    throw ApiError.forbidden('Compte suspendu. Contacte le support.');
  }

  const roles = [...new Set(profile.memberships.flatMap((m) => m.roles))];

  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    emailConfirmed: Boolean(profile.emailVerifiedAt),
    phoneVerified: Boolean(profile.phoneVerifiedAt),
    roles,
    memberships: profile.memberships,
    profile,
    needsSync: false,
  };
};

/** Middleware obligatoire : 401 si aucun token valide. */
export const authenticate = async (req, _res, next) => {
  /*
   * Déjà authentifié en amont : on ne résout pas l'utilisateur deux fois.
   * C'est le cas du dépôt géospatial, où l'authentification est avancée avant
   * le parseur de corps pour qu'une requête sans jeton soit refusée sans que
   * ses (potentiellement 100) Mo soient lus. Seul un middleware
   * d'authentification pose `req.user`, donc ce raccourci ne peut pas être
   * déclenché par le client.
   */
  if (req.user) return next();
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Token d\'authentification manquant');

    req.token = token;
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    next(error);
  }
};

/** Middleware facultatif : attache req.user si un token est fourni, sinon continue. */
export const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      req.token = token;
      req.user = await resolveUser(token);
    }
    next();
  } catch {
    // Un token invalide sur une route publique n'est pas bloquant (CDC P6).
    next();
  }
};

/** Exige un compte dont l'email ou le téléphone est vérifié. */
export const requireVerified = (req, _res, next) => {
  if (!req.user?.emailConfirmed && !req.user?.phoneVerified) {
    return next(ApiError.forbidden('Vérifie ton téléphone ou ton email avant cette action'));
  }
  next();
};
