/**
 * Registre des appareils push de l'utilisateur connecté (`/me/push-devices`).
 *
 *  - un jeton est unique par fournisseur : réenregistré par un autre compte
 *    (téléphone cédé, changement de compte), il CHANGE de propriétaire au lieu
 *    d'être partagé — l'ancien titulaire ne reçoit plus rien ;
 *  - rotation : un nouveau jeton pour la même installation et le même
 *    fournisseur révoque l'ancien (les fournisseurs font tourner les jetons) ;
 *  - plafond d'appareils actifs par compte (les plus anciens sont révoqués) ;
 *  - le jeton n'est JAMAIS renvoyé en clair (seulement ses 6 derniers caractères).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

export const APPAREILS_ACTIFS_MAX = 10;

const vue = (appareil) => ({
  id: appareil.id,
  provider: appareil.provider,
  platform: appareil.provider === 'FCM' ? 'ANDROID' : 'IOS',
  tokenSuffix: String(appareil.token).slice(-6),
  installationId: appareil.installationId,
  appVersion: appareil.appVersion,
  lastSeenAt: appareil.lastSeenAt,
  createdAt: appareil.createdAt,
});

export const lister = async (req) => {
  const appareils = await prisma.pushDevice.findMany({
    where: { userId: req.user.id, revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
  });
  return appareils.map(vue);
};

export const enregistrer = async ({ provider, token, installationId, appVersion, locale }, req) => {
  const maintenant = new Date();
  const appareil = await prisma.$transaction(async (tx) => {
    // Rotation : même installation + même fournisseur, autre jeton → l'ancien est révoqué.
    await tx.pushDevice.updateMany({
      where: { provider, installationId, token: { not: token }, revokedAt: null },
      data: { revokedAt: maintenant, revokedReason: 'rotated' },
    });

    const resultat = await tx.pushDevice.upsert({
      where: { provider_token: { provider, token } },
      create: {
        id: resolveId(), userId: req.user.id, provider, token, installationId,
        appVersion: appVersion ?? null, locale: locale ?? null, lastSeenAt: maintenant,
      },
      update: {
        userId: req.user.id, installationId, appVersion: appVersion ?? null, locale: locale ?? null,
        lastSeenAt: maintenant, revokedAt: null, revokedReason: null,
      },
    });

    // Plafond : au-delà, les appareils les moins récemment vus sont révoqués.
    const actifs = await tx.pushDevice.findMany({
      where: { userId: req.user.id, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true },
    });
    const enTrop = actifs.slice(APPAREILS_ACTIFS_MAX).map((a) => a.id);
    if (enTrop.length > 0) {
      await tx.pushDevice.updateMany({
        where: { id: { in: enTrop } },
        data: { revokedAt: maintenant, revokedReason: 'device_limit' },
      });
    }
    return resultat;
  });

  await audit({
    actorId: req.user.id,
    action: 'push.device.register',
    resource: 'push_devices',
    resourceId: appareil.id,
    req,
    newValue: { provider, installationId, tokenSuffix: String(token).slice(-6) },
  });
  return vue(appareil);
};

export const retirer = async (id, req) => {
  const { count } = await prisma.pushDevice.updateMany({
    where: { id, userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'user_removed' },
  });
  if (count === 0) throw ApiError.notFound('Appareil introuvable');
  await audit({ actorId: req.user.id, action: 'push.device.remove', resource: 'push_devices', resourceId: id, req });
  return { removed: true };
};
