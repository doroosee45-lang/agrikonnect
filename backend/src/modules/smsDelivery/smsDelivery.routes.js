/**
 * Routes SMS : consentement, suivi de remise, et webhook Twilio.
 *
 * Deux routeurs, pour deux publics qui n'ont rien en commun :
 *
 *  - `default` (`/sms`) : l'agriculteur et l'exploitation. Tout passe par
 *    `authenticate` + `resolveTenant`, l'`organizationId` vient du jeton et
 *    jamais du corps de requête ;
 *  - `twilioWebhookRouter` (`/webhooks/twilio`) : Twilio, qui n'a **pas** de
 *    jeton de la plateforme. L'authentification est la **signature** de la
 *    requête, calculée avec l'`AuthToken` du compte.
 *
 * ## Pourquoi la signature est obligatoire et non négociable
 *
 * Le webhook écrit l'état de remise. Sans vérification, n'importe qui peut
 * marquer un SMS « remis » — et l'alerte agronomique censée prévenir
 * l'agriculteur serait considérée comme lue alors que personne ne l'a reçue. Le
 * risque n'est pas théorique : l'URL est publique par construction.
 *
 * Une signature invalide renvoie **403 sans détail** : dire ce qui ne va pas
 * aiderait à forger.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { authorize } from '../../middleware/authorize.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/http/logger.js';
import {
  validateTwilioSignature,
  validateTwilioSignatureWithBody,
  webhookUrlFromRequest,
} from '../../integrations/twilioSignature.js';
import { smsSettings } from '../../integrations/sms.js';
import { validateSenderId } from '../../integrations/twilio.js';
import * as service from './smsDelivery.service.js';

const consentSchema = z.object({
  /** Usage couvert. Défaut : l'usage d'alerte configuré. */
  purpose: z.string().min(1).max(40).optional(),
  /** Version du texte de consentement présenté à l'écran. */
  noticeVersion: z.string().min(1).max(80).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const listSchema = z.object({
  userId: z.string().min(1).max(60).optional(),
  status: z
    .enum(['QUEUED_LOCALLY', 'QUEUED', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED', 'UNKNOWN'])
    .optional(),
  batchId: z.string().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

const testSendSchema = z.object({
  /** Destinataire de l'envoi de recette. E.164 exigé. */
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'numéro attendu au format E.164'),
  body: z.string().min(1).max(480),
  purpose: z.string().min(1).max(40).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

/* ─────────────────────────── Consentement ─────────────────────────── */

/**
 * Consentements de l'utilisateur connecté.
 *
 * Exposé à l'utilisateur lui-même : c'est le point d'entrée de la
 * désinscription dans l'application, seul mécanisme possible puisque le canal
 * est à sens unique.
 */
router.get(
  '/consent',
  authorize('sms.consent'),
  asyncHandler(async (req, res) => {
    const data = await service.listSmsConsents({
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
    });
    /**
     * Rappel porté par l'API plutôt que laissé à chaque écran : sans canal
     * entrant, l'utilisateur doit savoir **ici** comment se désinscrire.
     */
    success(res, {
      ...data,
      twoWaySupported: false,
      optOutNotice:
        'Les alertes arrivent d’un identifiant d’expéditeur à sens unique : '
        + 'répondre au SMS n’a aucun effet. La désinscription se fait ici, dans l’application.',
    });
  }),
);

/** Donne son consentement pour un usage. */
router.post(
  '/consent',
  authorize('sms.consent'),
  validate(consentSchema),
  asyncHandler(async (req, res) => {
    const consent = await service.grantSmsConsent({
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      purpose: req.body.purpose,
      noticeVersion: req.body.noticeVersion ?? null,
    });
    created(res, { consent }, { message: 'Consentement SMS enregistré' });
  }),
);

/**
 * Retire son consentement — la désinscription.
 *
 * `DELETE` plutôt qu'un `POST /withdraw` : c'est bien une suppression
 * d'autorisation, et l'historique reste en base pour la preuve.
 */
router.delete(
  '/consent',
  authorize('sms.consent'),
  validate(consentSchema),
  asyncHandler(async (req, res) => {
    const consent = await service.withdrawSmsConsent({
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      purpose: req.body.purpose,
    });
    success(res, { consent }, { message: 'Consentement SMS retiré : plus aucun envoi pour cet usage' });
  }),
);

/* ─────────────────────── Suivi de remise et coût ─────────────────────── */

/**
 * Réglages du canal, **sans aucun secret**.
 *
 * Sert à dire à l'exploitation si le fournisseur est réellement configuré et
 * quel plafond s'applique, sans jamais exposer `TWILIO_AUTH_TOKEN`.
 */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = smsSettings();
    const sender = validateSenderId(settings.senderId);
    success(res, {
      ...settings,
      senderIdValid: sender.valid,
      senderIdIssues: sender.reasons,
      /**
       * Point à vérifier **avant** tout envoi réel en RDC. La documentation
       * Twilio consultée le 2026-10-24 indique que l'alphanumérique y est pris
       * en charge dynamiquement, sans pré-inscription, et que l'identifiant est
       * préservé — mais un agrégateur tiers rapporte une pré-inscription
       * exigée par Vodacom. La contradiction n'est pas tranchée ici : elle est
       * signalée.
       */
      preRegistrationNotice:
        'RDC : Twilio documente l’alphanumérique comme disponible sans pré-inscription. '
        + 'Une source tierce indique une pré-inscription exigée par Vodacom. '
        + 'À vérifier auprès de Twilio avant tout envoi réel.',
    });
  }),
);

/** Historique des envois de l'organisation. */
router.get(
  '/messages',
  authorize('sms.read'),
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await service.listSmsMessages({
      organizationId: req.tenant.organizationId,
      userId: req.query.userId,
      status: req.query.status,
      batchId: req.query.batchId,
      limit: req.query.limit ?? 50,
      page: req.query.page ?? 1,
    });
    success(res, { items: data.items, total: data.total }, {
      meta: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages },
    });
  }),
);

/** Détail d'un envoi, avec l'historique complet des statuts reçus. */
router.get(
  '/messages/:id',
  authorize('sms.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const message = await service.getSmsMessage({ organizationId: req.tenant.organizationId, id: req.params.id });
    success(res, { message });
  }),
);

/** Journaux de lots : envoyé, retenu (et pourquoi), échoué, segments. */
router.get(
  '/batches',
  authorize('sms.read'),
  asyncHandler(async (req, res) => {
    const data = await service.listSmsBatchLogs({ organizationId: req.tenant.organizationId });
    success(res, data);
  }),
);

/**
 * Envoi de recette vers un numéro réel.
 *
 * Réservé à la vérification du canal : **c'est le seul moyen de prouver qu'un
 * SMS part et arrive**, et tant qu'aucun message réel n'a été reçu, l'envoi
 * réel n'est pas vérifié. Le consentement et le plafond s'appliquent comme
 * partout ailleurs — un test ne contourne pas les garde-fous.
 */
router.post(
  '/test-send',
  // Réservé aux administrateurs : un envoi de recette coûte de l'argent réel et
  // peut viser n'importe quel numéro. Le plafond quotidien ne suffit pas à en
  // faire une route ouverte à tout compte.
  authorize('sms.send'),
  validate(testSendSchema),
  asyncHandler(async (req, res) => {
    const outcome = await service.sendAlertSms({
      organizationId: req.tenant.organizationId,
      userId: req.user.id,
      phone: req.body.phone,
      body: req.body.body,
      purpose: req.body.purpose,
      /*
       * Seule exception assumée à la règle « numéro vérifié ».
       *
       * Cette route est une **sonde de canal** : son but est de savoir si un
       * message atteint un opérateur congolais donné, ce qui suppose de viser
       * un numéro arbitraire choisi pour le test. Exiger ici un numéro
       * vérifié rendrait la sonde inutilisable — et la sonde est ce qui
       * prouve le canal avant de l'utiliser pour de vrai.
       *
       * La garde reste donc active partout ailleurs, y compris pour chaque
       * alerte réelle, qui passe par `sendAlertBatch` sans cette option.
       */
      requireVerifiedPhone: false,
    });
    if (!outcome.sent) {
      /**
       * 422 et non 500 : l'envoi a été **retenu par un garde-fou**, ce qui est
       * un comportement attendu, pas une panne. La raison est ce que
       * l'appelant doit lire.
       */
      return success(
        res,
        { sent: false, skipReason: outcome.skipReason, error: outcome.error ?? null },
        { status: 422, message: 'SMS non envoyé : garde-fou appliqué' },
      );
    }
    created(res, {
      sent: true,
      message: outcome.message,
      /**
       * Rappel explicite : `QUEUED` n'est pas `DELIVERED`. L'écran ne doit pas
       * laisser croire que la remise est acquise.
       */
      deliveryConfirmed: outcome.message.status === 'DELIVERED',
    });
  }),
);

/* ─────────────────────────── Webhook Twilio ─────────────────────────── */

export const twilioWebhookRouter = Router();

/**
 * Accusé de remise.
 *
 * Twilio envoie `application/x-www-form-urlencoded` : la validation porte sur
 * l'URL plus les paramètres triés. Un corps `application/json` est aussi
 * accepté, en validant alors le corps brut via `bodySHA256`.
 */
twilioWebhookRouter.post(
  '/status',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
      logger.warn('[SMS:webhook] requête sans en-tête X-Twilio-Signature — rejetée');
      return res.status(403).json({
        success: false,
        code: 'SIGNATURE_MISSING',
        message: 'Signature absente',
      });
    }

    const authToken = env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      /**
       * 503 et non 403 : sans `AuthToken` configuré, aucune signature ne peut
       * être vérifiée. Dire « invalide » laisserait croire que la requête était
       * frauduleuse alors que c'est la configuration qui manque.
       */
      logger.error('[SMS:webhook] TWILIO_AUTH_TOKEN absent : signature invérifiable');
      return res.status(503).json({
        success: false,
        code: 'SIGNATURE_UNVERIFIABLE',
        message: 'Validation de signature impossible : configuration incomplète',
      });
    }

    const url = webhookUrlFromRequest(req, { baseUrl: env.TWILIO_WEBHOOK_BASE_URL });
    const isJson = String(req.headers['content-type'] ?? '').includes('application/json');

    const valid = isJson
      ? validateTwilioSignatureWithBody({
          authToken,
          signature,
          url,
          rawBody: req.rawBody ?? '',
          bodySha256: req.query.bodySHA256,
        })
      : validateTwilioSignature({
          authToken,
          signature,
          url,
          // **Tous** les paramètres, sans sélection : Twilio peut en ajouter
          // sans préavis, et en ignorer un casserait la validation.
          params: req.body ?? {},
        });

    if (!valid) {
      // Aucun détail : dire pourquoi aiderait à forger une signature valide.
      logger.warn('[SMS:webhook] signature invalide — requête rejetée');
      return res.status(403).json({
        success: false,
        code: 'SIGNATURE_INVALID',
        message: 'Signature invalide',
      });
    }

    const payload = isJson ? (req.body ?? {}) : (req.body ?? {});
    const providerMessageId = payload.MessageSid ?? payload.messageSid ?? null;
    const rawStatus = payload.MessageStatus ?? payload.messageStatus ?? null;

    if (!providerMessageId || !rawStatus) {
      // Une charge signée mais incomplète : on la refuse plutôt que d'écrire un
      // statut partiel.
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'MessageSid et MessageStatus sont requis',
      });
    }

    try {
      const outcome = await service.recordDeliveryStatus({
        providerMessageId,
        rawStatus,
        errorCode: payload.ErrorCode ? String(payload.ErrorCode) : null,
        errorMessage: payload.ErrorMessage ?? null,
      });
      return success(res, {
        applied: outcome.applied,
        status: outcome.message.status,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      });
    } catch (error) {
      /**
       * Un accusé pour un message inconnu renvoie 404. Twilio réessaie sur
       * erreur serveur ; sur 404 il ne réessaie pas indéfiniment pour un
       * message qui n'existera jamais dans cette base.
       */
      if (error?.status === 404) {
        return res.status(404).json({
          success: false,
          code: error.code ?? 'NOT_FOUND',
          message: error.message,
        });
      }
      throw error;
    }
  }),
);

export default router;
