/**
 * Exigences CDC couvertes : INV-01, INV-02, INV-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';
import { sessionIdDuJeton, verifierPreuveMfa } from '../auth/mfaProof.js';

/**
 * INV-01 → INV-03 — Profils investisseurs.
 *
 * Un profil investisseur n'accède aux projets qu'après vérification
 * administrative ET activation de la MFA. L'absence de MFA bloque l'accès
 * à la data room au niveau du service.
 */

export const upsertProfile = async (payload, req) => {
  const existing = await prisma.investorProfile.findUnique({ where: { userId: req.user.id } });

  /*
   * Audit H-05 — `mfaEnabled` n'est plus déclaré par l'investisseur : il est
   * recopié du profil réel (`Profile.mfaEnabled`, posé par l'enrôlement TOTP).
   * Le champ de la table investisseur n'est plus qu'un miroir d'affichage.
   */
  const { mfaEnabled: _ignore, ...donnees } = payload;
  const mfaReel = Boolean(req.user?.profile?.mfaEnabled);

  const profile = existing
    ? await prisma.investorProfile.update({
        where: { userId: req.user.id },
        data: { ...donnees, mfaEnabled: mfaReel },
      })
    : await prisma.investorProfile.create({
        data: {
          ...donnees,
          mfaEnabled: mfaReel,
          id: resolveId(),
          userId: req.user.id,
          organizationId: req.tenant?.organizationId ?? null,
        },
      });

  await audit({ actorId: req.user.id, action: existing ? 'investor.profile.update' : 'investor.profile.create', resource: 'investor_profiles', resourceId: profile.id, req, newValue: { sectors: profile.sectors } });

  return {
    profile,
    // INV-02 : l'accès aux données sensibles reste fermé jusqu'à vérification + MFA
    access: {
      verified: Boolean(profile.verifiedAt),
      mfaEnabled: profile.mfaEnabled,
      dataRoomAccess: Boolean(profile.verifiedAt) && profile.mfaEnabled,
      requirements: [
        'profil vérifié par l\'administration',
        'authentification multifacteur activée',
      ],
    },
    disclaimer:
      'AGRIKONNECT ne propose aucun produit financier, ne collecte aucun fonds et ne garantit aucun rendement.',
  };
};

export const getMine = async (req) => {
  const profile = await prisma.investorProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw ApiError.notFound('Profil investisseur introuvable');

  return {
    profile,
    access: {
      verified: Boolean(profile.verifiedAt),
      mfaEnabled: profile.mfaEnabled,
      dataRoomAccess: Boolean(profile.verifiedAt) && profile.mfaEnabled,
    },
  };
};

/** Vérification administrative du profil (KYC léger, hors activité régulée). */
export const verify = async (userId, { decision, comment }, req) => {
  const profile = await prisma.investorProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Profil investisseur introuvable');

  const verified = decision === 'VERIFIED';

  const updated = await prisma.investorProfile.update({
    where: { userId },
    data: {
      verifiedAt: verified ? new Date() : null,
      verifiedBy: verified ? req.user.id : null,
      preferences: {
        ...(profile.preferences ?? {}),
        verification: { decision, comment: comment ?? null, at: new Date().toISOString(), by: req.user.id },
      },
    },
  });

  await notify({
    userId,
    type: 'investor.verification',
    title: verified ? 'Profil investisseur vérifié' : 'Vérification refusée',
    body: comment ?? (verified ? 'Vous pouvez demander l\'accès aux data rooms.' : null),
    payload: { decision },
    dedupeKey: `investor:${userId}:${decision}`,
  });

  await audit({ actorId: req.user.id, action: 'investor.verify', resource: 'investor_profiles', resourceId: profile.id, req, newValue: { decision, comment: comment ?? null } });
  return updated;
};

/**
 * INV-02 — porte d'accès aux projets : un investisseur non vérifié ou sans MFA
 * est refusé au niveau du service, pas seulement de l'interface.
 */
export const assertInvestorReady = async (userId, req = null) => {
  const [profile, compte] = await Promise.all([
    prisma.investorProfile.findUnique({ where: { userId } }),
    prisma.profile.findUnique({ where: { id: userId }, select: { mfaEnabled: true } }),
  ]);
  if (!profile) throw ApiError.forbidden('Profil investisseur requis');

  if (!profile.verifiedAt) {
    throw ApiError.forbidden('Profil investisseur non vérifié : accès aux data rooms impossible');
  }
  // Audit H-05 — MFA RÉELLE du compte (enrôlement TOTP confirmé), jamais l'auto-déclaration.
  if (!compte?.mfaEnabled) {
    throw ApiError.forbidden(
      'Authentification multifacteur requise pour accéder aux données d\'investissement',
      { mfaRequired: true, method: 'totp' },
    );
  }
  // Audit C-03 — dans une requête HTTP, la SESSION doit avoir franchi le second facteur.
  if (req) {
    const sessionValidee = verifierPreuveMfa({
      preuve: req.headers?.['x-mfa-proof'],
      userId,
      sessionId: sessionIdDuJeton(req.token),
    });
    if (!sessionValidee) {
      throw ApiError.forbidden(
        'Confirme ton code de double authentification pour cette session avant d\'accéder aux données d\'investissement.',
        { mfaRequired: true, stepUp: true, method: 'totp' },
      );
    }
  }
  return profile;
};

/**
 * Audit H-05 — porte d'accès investisseur pour la data room : s'applique à un
 * demandeur qui n'est ni le porteur du projet, ni un vérificateur ou un
 * administrateur de la plateforme (qui n'ont pas de profil investisseur).
 */
const ROLES_EXEMPTES_DATA_ROOM = ['VERIFIER', 'ADMIN', 'SUPER_ADMIN'];
export const assertAccesInvestisseur = async (req) => {
  const roles = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
  if (roles.some((role) => ROLES_EXEMPTES_DATA_ROOM.includes(role))) return null;
  return assertInvestorReady(req.user.id, req);
};
