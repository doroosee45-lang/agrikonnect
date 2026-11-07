import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { storageKey } from '../../shared/crypto.js';
import { ALLOWED_MIME } from './media.schema.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

/**
 * Médiathèque (FARM-02).
 *
 * Stratégie d'upload : le client demande une URL signée, envoie le fichier
 * directement au stockage objet (pas de fichier binaire dans l'API), puis
 * confirme via `POST /media/:id/confirm`. Cela évite de saturer le serveur
 * sur les connexions instables de la RDC (CDC §5.4).
 */
export const createUploadUrl = async (payload, req) => {
  const { filename, mimeType, sizeBytes, kind, farmId, plotId, listingId, caption } = payload;

  const isDocument = kind === 'DOCUMENT';
  const bucket = isDocument ? env.SUPABASE_BUCKET_PRIVATE : env.SUPABASE_BUCKET_MEDIA;

  // Contrôle d'appartenance des ressources cibles
  if (farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    assertOwnership(farm, req.tenant.organizationId, 'Exploitation');
  }
  if (plotId) {
    const plot = await prisma.plot.findUnique({ where: { id: plotId } });
    assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
  }
  if (listingId) {
    // V2 — une photo d'annonce n'est déposable que par le vendeur propriétaire
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    assertOwnership(listing, req.tenant.organizationId, 'Annonce');
  }

  const extension = ALLOWED_MIME[mimeType];
  const key = storageKey(
    req.tenant.organizationId,
    isDocument ? 'documents' : 'media',
    new Date().toISOString().slice(0, 7),
    `${randomUUID()}.${extension}`,
  );

  const media = await prisma.media.create({
    data: {
      id: resolveId(),
      organizationId: req.tenant.organizationId,
      farmId: farmId ?? null,
      plotId: plotId ?? null,
      listingId: listingId ?? null,
      kind: isDocument ? 'PHOTO' : kind,
      storageKey: key,
      mimeType,
      sizeBytes,
      caption: caption ?? null,
      createdBy: req.user.id,
      url: null,
    },
  });

  if (!supabaseAdmin) {
    // Sans clé service role, on renvoie un mode "différé" explicite plutôt
    // que d'échouer silencieusement.
    return {
      mediaId: media.id,
      bucket,
      storageKey: key,
      uploadUrl: null,
      message:
        'SUPABASE_SERVICE_ROLE_KEY absente : configure-la pour obtenir une URL d\'upload signée.',
      maxSizeBytes: 5 * 1024 * 1024,
      filename,
    };
  }

  const signed = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(key);
  if (signed.error) throw ApiError.internal('Impossible de générer l\'URL d\'upload');

  return {
    mediaId: media.id,
    bucket,
    storageKey: key,
    uploadUrl: signed.data.signedUrl,
    token: signed.data.token,
    expiresInSeconds: env.SIGNED_URL_TTL_SECONDS,
  };
};

/** Confirmation après envoi effectif du fichier au stockage. */
export const confirm = async (id, req) => {
  const media = assertOwnership(
    await prisma.media.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Média',
  );

  let url = null;
  if (supabaseAdmin) {
    const bucket = media.mimeType === 'application/pdf' ? env.SUPABASE_BUCKET_PRIVATE : env.SUPABASE_BUCKET_MEDIA;
    // SEC-07 / V4:NFR-02 — URL signée de courte durée : la TTL vient de la
    // configuration (`SIGNED_URL_TTL_SECONDS`, 300 s par défaut), jamais en dur.
    const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(
      media.storageKey,
      env.SIGNED_URL_TTL_SECONDS,
    );
    url = signed.data?.signedUrl ?? null;
  }

  const updated = await prisma.media.update({ where: { id }, data: { url } });

  await audit({
    actorId: req.user.id,
    action: 'media.confirm',
    resource: 'media',
    resourceId: media.id,
    req,
  });

  return updated;
};

export const list = async (query, req) => {
  const { farmId, plotId, listingId } = query;

  return prisma.media.findMany({
    where: {
      organizationId: req.tenant.organizationId,
      deletedAt: null,
      ...(farmId ? { farmId } : {}),
      ...(plotId ? { plotId } : {}),
      ...(listingId ? { listingId } : {}),
    },
    orderBy: { position: 'asc' },
  });
};

export const remove = async (id, req) => {
  assertOwnership(
    await prisma.media.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Média',
  );

  await prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ actorId: req.user.id, action: 'media.delete', resource: 'media', resourceId: id, req });
  return { deleted: true };
};
