/**
 * Webhook LiveKit — `POST /api/v1/webhooks/livekit`.
 *
 * Monté HORS de l'authentification par jeton (LiveKit n'en a pas) : son
 * authentification EST la signature, vérifiée par le mécanisme officiel
 * (`WebhookReceiver.receive`) sur le corps BRUT. Le parseur brut est posé dans
 * `app.js` AVANT le parseur JSON global : LiveKit envoie
 * `application/webhook+json`, et toute re-sérialisation casserait l'empreinte.
 *
 * Idempotence DURABLE : chaque événement est inscrit dans `call_events` avec
 * l'unicité (`source`, `externalId` = identifiant d'événement LiveKit), DANS la
 * même transaction que son effet. Un rejeu viole l'unicité → transaction
 * annulée → réponse 200 « déjà traité » ; une panne pendant le traitement
 * annule aussi l'inscription → LiveKit réessaie.
 *
 * Journalisation : jamais le corps, jamais l'en-tête `Authorization`, jamais
 * de jeton — seulement le type d'événement et des identifiants.
 */
import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { resolveId } from '../../shared/ids.js';
import { logger } from '../../shared/http/logger.js';
import { liveKitConfigure, verifierWebhook } from '../../integrations/livekit.js';
import { env } from '../../config/env.js';
import { appliquerEvenementLiveKit, diffuserApresWebhook } from './calls.service.js';

const router = Router();

/** Détails conservés pour l'audit : identifiants seulement. */
const detailsSurs = (evenement, resultat) => ({
  room: evenement.room?.name ?? null,
  identity: evenement.participant?.identity ?? null,
  applied: Boolean(resultat?.applied),
  reason: resultat?.reason ?? null,
});

router.post('/', asyncHandler(async (req, res) => {
  if (env.CALLS_ENABLED !== 'true' || !liveKitConfigure()) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route introuvable' });
  }

  const corps = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : null;
  if (!corps) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Corps de webhook absent' });
  }

  let evenement;
  try {
    evenement = await verifierWebhook(corps, req.get('authorization'));
  } catch (erreur) {
    logger.warn(`[livekit] webhook refusé : signature invalide (${erreur?.name ?? 'erreur'})`);
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Signature de webhook invalide' });
  }

  if (!evenement?.id || !evenement?.event) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Événement LiveKit incomplet' });
  }

  let resultat;
  try {
    resultat = await prisma.$transaction(async (tx) => {
      const effet = await appliquerEvenementLiveKit(tx, evenement);
      await tx.callEvent.create({
        data: {
          id: resolveId(),
          callId: effet.callId ?? null,
          source: 'livekit',
          type: String(evenement.event).slice(0, 80),
          externalId: String(evenement.id).slice(0, 200),
          details: detailsSurs(evenement, effet),
        },
      });
      return effet;
    });
  } catch (erreur) {
    if (erreur?.code === 'P2002') {
      return res.status(200).json({ success: true, data: { received: true, duplicate: true } });
    }
    throw erreur;
  }

  await diffuserApresWebhook(resultat.callId);
  return res.status(200).json({ success: true, data: { received: true, applied: Boolean(resultat.applied) } });
}));

export default router;
