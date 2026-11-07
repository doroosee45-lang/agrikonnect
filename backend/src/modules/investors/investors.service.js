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

/**
 * INV-01 → INV-03 — Profils investisseurs.
 *
 * Un profil investisseur n'accède aux projets qu'après vérification
 * administrative ET activation de la MFA. L'absence de MFA bloque l'accès
 * à la data room au niveau du service.
 */

export const upsertProfile = async (payload, req) => {
  const existing = await prisma.investorProfile.findUnique({ where: { userId: req.user.id } });

  const profile = existing
    ? await prisma.investorProfile.update({
        where: { userId: req.user.id },
        data: { ...payload, mfaEnabled: payload.mfaEnabled ?? existing.mfaEnabled },
      })
    : await prisma.investorProfile.create({
        data: {
          ...payload,
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
export const assertInvestorReady = async (userId) => {
  const profile = await prisma.investorProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.forbidden('Profil investisseur requis');

  if (!profile.verifiedAt) {
    throw ApiError.forbidden('Profil investisseur non vérifié : accès aux data rooms impossible');
  }
  if (!profile.mfaEnabled) {
    throw ApiError.forbidden('Authentification multifacteur requise pour accéder aux données d\'investissement');
  }
  return profile;
};
