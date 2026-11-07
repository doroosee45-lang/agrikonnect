/**
 * Envoi d'alertes par SMS : consentement, garde-fous de coût, suivi de remise.
 *
 * Ce module existe parce que le SMS est à la fois le canal **primaire** du
 * déploiement (RDC : les données mobiles sont rares, le SMS passe) et le canal
 * **payant**. Ces deux propriétés imposent des règles que le reste du code ne
 * doit pas avoir à connaître :
 *
 *  - **un envoi exige un consentement explicite et non retiré.** L'identifiant
 *    alphanumérique est à sens unique en RDC — la documentation Twilio indique
 *    « Two-way SMS supported : No » — donc aucun « STOP » par SMS n'est
 *    possible. Le consentement et sa révocation vivent dans l'application, et
 *    sont horodatés ici ;
 *  - **un plafond quotidien** par agriculteur et par organisation. Un lot
 *    d'alertes mal réglé se traduit directement en facture, et un canal qui
 *    envoie trop cesse d'être lu ;
 *  - **la remise est prouvée, pas supposée.** Une soumission acceptée n'est pas
 *    une remise : seul l'accusé du réseau, reçu plus tard par webhook, le dit.
 *    Les deux états sont distingués dans `sms_messages`.
 *
 * Le **délai de renotification** existant (`ALERT_RENOTIFY_HOURS`, géré par
 * `alerts.service.shouldRenotify`) n'est pas réimplémenté ici : ce module refuse
 * un doublon, il ne décide pas du calendrier des alertes.
 */
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/http/logger.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { sendSms } from '../../integrations/sms.js';
import { analyseMessage } from '../../integrations/twilio.js';
import { dansFenetreSilence } from '../../shared/quietHours.js';

/** Raisons de non-envoi. Les mêmes que l'enum Prisma `SmsSkipReason`. */
export const SKIP_REASONS = Object.freeze({
  NO_CONSENT: 'NO_CONSENT',
  CONSENT_WITHDRAWN: 'CONSENT_WITHDRAWN',
  DAILY_LIMIT: 'DAILY_LIMIT',
  PREFERENCE_DISABLED: 'PREFERENCE_DISABLED',
  NO_PHONE: 'NO_PHONE',
  PHONE_UNVERIFIED: 'PHONE_UNVERIFIED',
  QUIET_HOURS: 'QUIET_HOURS',
});

/**
 * Statuts Twilio ramenés aux nôtres.
 *
 * Une valeur non reconnue devient `UNKNOWN` **avec sa valeur brute conservée** :
 * Twilio peut ajouter un état sans préavis, et le deviner — le traiter comme
 * « remis » ou comme « échoué » — serait une affirmation sans preuve.
 */
const STATUS_MAP = Object.freeze({
  queued: 'QUEUED',
  accepted: 'QUEUED',
  sending: 'SENT',
  sent: 'SENT',
  delivered: 'DELIVERED',
  undelivered: 'UNDELIVERED',
  failed: 'FAILED',
  canceled: 'FAILED',
  receiving_prefix: 'UNKNOWN',
});

export const mapProviderStatus = (rawStatus) => {
  const key = String(rawStatus ?? '').toLowerCase();
  return { status: STATUS_MAP[key] ?? 'UNKNOWN', rawStatus: rawStatus ?? null };
};

const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/* ───────────────────────────── Consentement ───────────────────────────── */

/**
 * Consentement valable pour un usage.
 *
 * `null` quand il n'existe pas : « jamais demandé » et « retiré » sont deux
 * situations différentes, et seule la seconde porte une date de retrait.
 */
export const getSmsConsent = async ({ organizationId, userId, purpose = env.SMS_ALERT_PURPOSE }) => {
  if (!organizationId || !userId) return null;
  return prisma.smsConsent.findUnique({
    where: {
      organizationId_userId_purpose: { organizationId, userId, purpose },
    },
  });
};

/** Le destinataire a-t-il accepté, et n'a-t-il pas retiré son accord ? */
export const hasSmsConsent = async ({ organizationId, userId, purpose = env.SMS_ALERT_PURPOSE }) => {
  const consent = await getSmsConsent({ organizationId, userId, purpose });
  return Boolean(consent && consent.status === 'GRANTED' && !consent.withdrawnAt);
};

/**
 * Enregistre un consentement.
 *
 * Idempotent : redonner un accord déjà donné ne crée pas une seconde ligne, il
 * remet la même à jour. Sans cela, un double clic dans l'application
 * produirait deux historiques.
 */
export const grantSmsConsent = async ({
  organizationId,
  userId,
  purpose = env.SMS_ALERT_PURPOSE,
  method = 'IN_APP',
  noticeVersion = null,
}) => {
  if (!organizationId || !userId) throw ApiError.badRequest('organisation et utilisateur requis');

  const existing = await prisma.smsConsent.findUnique({
    where: { organizationId_userId_purpose: { organizationId, userId, purpose } },
  });

  if (existing) {
    return prisma.smsConsent.update({
      where: { id: existing.id },
      data: {
        status: 'GRANTED',
        method,
        grantedAt: new Date(),
        withdrawnAt: null,
        noticeVersion,
      },
    });
  }

  return prisma.smsConsent.create({
    data: {
      id: newId('scon'),
      organizationId,
      userId,
      purpose,
      status: 'GRANTED',
      method,
      grantedAt: new Date(),
      noticeVersion,
    },
  });
};

/**
 * Retire un consentement.
 *
 * C'est **le** mécanisme de désinscription : le canal étant à sens unique, aucun
 * « STOP » par SMS ne peut jouer ce rôle. Un retrait est conservé (pas
 * supprimé) : il faut pouvoir prouver à quelle date l'envoi a cessé d'être
 * autorisé.
 */
export const withdrawSmsConsent = async ({
  organizationId,
  userId,
  purpose = env.SMS_ALERT_PURPOSE,
}) => {
  const existing = await prisma.smsConsent.findUnique({
    where: { organizationId_userId_purpose: { organizationId, userId, purpose } },
  });
  if (!existing) {
    // Rien à retirer : on le dit plutôt que de créer une ligne « retirée »
    // qui laisserait croire qu'un consentement avait existé.
    throw ApiError.notFound('aucun consentement SMS enregistré pour cet usage');
  }
  return prisma.smsConsent.update({
    where: { id: existing.id },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });
};

/** Consentements d'un utilisateur, tous usages. */
export const listSmsConsents = async ({ organizationId, userId }) => {
  const items = await prisma.smsConsent.findMany({
    where: { organizationId, userId },
    orderBy: { purpose: 'asc' },
  });
  return { items, count: items.length };
};

/* ─────────────────────────── Garde-fous de coût ─────────────────────────── */

/** Début du jour courant, dans le fuseau du serveur. */
const startOfToday = (now = new Date()) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
};

/**
 * Nombre de SMS déjà soumis aujourd'hui.
 *
 * Compté sur `sms_messages`, **y compris les échecs** : un message refusé par
 * l'opérateur a malgré tout été soumis, et un plafond qui ne compterait que les
 * remises laisserait une boucle d'erreurs envoyer sans limite.
 */
export const countSentToday = async ({ organizationId, userId = null, purpose, now = new Date() }) => {
  const since = startOfToday(now);
  return prisma.smsMessage.count({
    where: {
      organizationId,
      purpose,
      createdAt: { gte: since },
      ...(userId ? { userId } : {}),
    },
  });
};

/**
 * Le plafond quotidien est-il atteint ?
 *
 * Les deux plafonds sont vérifiés : celui par agriculteur protège la personne
 * (un canal qui bombarde cesse d'être lu), celui par organisation protège la
 * facture en cas de boucle sur un lot entier.
 */
export const dailyLimitReached = async ({
  organizationId,
  userId,
  purpose = env.SMS_ALERT_PURPOSE,
  now = new Date(),
}) => {
  const perFarmer = Number(env.SMS_DAILY_LIMIT_PER_FARMER);
  if (userId && perFarmer > 0) {
    const sent = await countSentToday({ organizationId, userId, purpose, now });
    if (sent >= perFarmer) return { reached: true, scope: 'FARMER', sent, limit: perFarmer };
  }
  const perOrg = Number(env.SMS_DAILY_LIMIT_PER_ORGANIZATION);
  if (perOrg > 0) {
    const sent = await countSentToday({ organizationId, purpose, now });
    if (sent >= perOrg) return { reached: true, scope: 'ORGANIZATION', sent, limit: perOrg };
  }
  return { reached: false, scope: null, sent: 0, limit: null };
};

/* ──────────────────────────────── Envoi ──────────────────────────────── */

/**
 * Envoie un SMS à un agriculteur, en appliquant tous les garde-fous.
 *
 * @returns {Promise<{ sent: boolean, skipReason?: string, message?: object }>}
 *   `sent: false` n'est **pas** une erreur : un refus par garde-fou est un
 *   comportement attendu, et la raison est ce qui importe.
 */
export const sendAlertSms = async ({
  organizationId,
  userId,
  phone,
  body,
  purpose = env.SMS_ALERT_PURPOSE,
  alertId = null,
  batchId = null,
  now = new Date(),
  requireVerifiedPhone = true,
  /*
   * Fuseau du destinataire, pour la fenêtre de silence. `null` ⇒ celui de la
   * configuration (`SMS_DEFAULT_TIMEZONE`).
   *
   * Simplification assumée : la RDC couvre deux fuseaux (Kinshasa UTC+1,
   * Lubumbashi UTC+2) et rien ne résout encore le fuseau par destinataire. Le
   * paramètre existe pour que ce branchement soit possible sans changer la
   * signature ; en l'état, tout le pays est traité au fuseau configuré.
   */
  timezone = null,
}) => {
  if (!organizationId) throw ApiError.badRequest('organisation requise');
  if (!body || String(body).trim().length === 0) {
    throw ApiError.badRequest('un SMS sans texte ne doit pas être envoyé');
  }

  // 1. Le destinataire doit être joignable.
  const target = String(phone ?? '').trim();
  if (!target) return { sent: false, skipReason: SKIP_REASONS.NO_PHONE };

  /*
   * 1b. Numéro confirmé par son titulaire.
   *
   * Le canal est à sens unique en RDC : aucun « STOP » par SMS n'est possible,
   * donc une alerte partie vers un numéro non confirmé ne peut pas être
   * rattrapée. C'est la raison `PHONE_UNVERIFIED`, comptée dans le journal de
   * lot comme les autres.
   *
   * `requireVerifiedPhone` vaut **true** par défaut : tout appelant est gardé
   * sauf à le dire explicitement. La seule exception est `/sms/test-send`, une
   * sonde de canal réservée aux administrateurs, qui vise par nature un numéro
   * arbitraire — voir le commentaire de cette route.
   */
  if (requireVerifiedPhone && !(await isPhoneVerified({ userId, phone: target }))) {
    return { sent: false, skipReason: SKIP_REASONS.PHONE_UNVERIFIED };
  }

  // 2. Consentement explicite et non retiré.
  const consent = await getSmsConsent({ organizationId, userId, purpose });
  if (!consent) return { sent: false, skipReason: SKIP_REASONS.NO_CONSENT };
  if (consent.status !== 'GRANTED' || consent.withdrawnAt) {
    return { sent: false, skipReason: SKIP_REASONS.CONSENT_WITHDRAWN };
  }

  // 3. Préférence de notification : l'agriculteur peut couper le canal sans
  //    retirer son consentement — les deux doivent être honorés.
  if (userId) {
    const preference = await prisma.notificationPreference.findFirst({
      where: { userId, channel: 'SMS', type: purpose },
    });
    if (preference && preference.enabled === false) {
      return { sent: false, skipReason: SKIP_REASONS.PREFERENCE_DISABLED };
    }
  }

  // 4. Garde-fous communs, puis envoi.
  return enregistrerEtEnvoyer({
    organizationId,
    userId,
    phone: target,
    body,
    purpose,
    batchId,
    alertId,
    consent,
    now,
    timezone,
  });
};

/** Usage du code de vérification de numéro, dans `sms_messages.purpose`. */
export const SMS_OTP_PURPOSE = 'OTP';

/**
 * Un numéro est vérifié si son titulaire l'a confirmé (`phoneVerifiedAt`).
 *
 * On exige aussi que le numéro visé **soit** celui du profil : sans cela, un
 * compte au numéro vérifié pourrait servir à envoyer vers n'importe quel autre
 * numéro.
 */
const isPhoneVerified = async ({ userId, phone }) => {
  if (!userId) return false;
  const profil = await prisma.profile.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
  if (!profil?.phoneVerifiedAt) return false;
  return String(profil.phone ?? '').trim() === String(phone ?? '').trim();
};

/**
 * Envoie le code de vérification de numéro **par le même chemin que les
 * alertes**.
 *
 * ## Pourquoi ce changement
 *
 * L'OTP partait par `sendSms()` directement : aucune ligne dans `sms_messages`,
 * donc ni plafond quotidien, ni segments facturés, ni statut de remise, ni
 * place dans le journal. Un canal dont une partie des envois échappe au journal
 * ne peut pas être audité — et l'OTP est précisément le message le plus
 * sensible, puisqu'il ouvre un compte.
 *
 * ## Ce qui ne change **pas**
 *
 * La durée de vie du code, le nombre de tentatives et le plafond horaire
 * d'envoi restent ceux de `auth.service.js` (`OTP_TTL_MINUTES`,
 * `OTP_MAX_SENDS_PER_HOUR`) : cette fonction n'y touche pas, elle ajoute
 * seulement l'enregistrement et le plafond **quotidien** partagé avec les
 * alertes.
 *
 * ## Ce qui ne s'applique **pas** à un OTP
 *
 * Ni consentement, ni préférence de notification, ni numéro vérifié. Exiger un
 * consentement pour un code demandé par l'utilisateur, ou exiger que le numéro
 * soit déjà vérifié pour envoyer le code qui sert à le vérifier, serait
 * circulaire.
 */
/**
 * Réglages de la fenêtre de silence, lus **à l'appel**.
 *
 * `env` est validé et figé à l'import du module : sans cette indirection, un
 * test ne pourrait pas déplacer la fenêtre sans recharger toute l'application.
 * C'est le même motif que `src/integrations/satellite.js` pour
 * `SATELLITE_PROVIDER` et que `src/integrations/geospatial.js` pour `GEOAI_URL`.
 */
const reglagesSilence = () => ({
  enabled: (process.env.SMS_QUIET_HOURS_ENABLED ?? env.SMS_QUIET_HOURS_ENABLED) === 'true',
  start: process.env.SMS_QUIET_START || env.SMS_QUIET_START,
  end: process.env.SMS_QUIET_END || env.SMS_QUIET_END,
  timezone: process.env.SMS_DEFAULT_TIMEZONE || env.SMS_DEFAULT_TIMEZONE,
});

export const sendOtpSms = async ({ organizationId, userId = null, phone, body, now = new Date() }) => {
  if (!organizationId) throw ApiError.badRequest('organisation requise');
  if (!body || String(body).trim().length === 0) {
    throw ApiError.badRequest('un SMS sans texte ne doit pas être envoyé');
  }
  const target = String(phone ?? '').trim();
  if (!target) return { sent: false, skipReason: SKIP_REASONS.NO_PHONE };

  return enregistrerEtEnvoyer({
    organizationId,
    userId,
    phone: target,
    body,
    purpose: SMS_OTP_PURPOSE,
    consent: null,
    now,
  });
};

/**
 * Cœur commun à tous les SMS : plafond quotidien, enregistrement, envoi, suivi
 * de remise.
 *
 * Extrait de `sendAlertSms` pour que l'OTP emprunte **exactement** le même
 * chemin. Les garde-fous qui dépendent de l'usage (consentement, préférence,
 * numéro vérifié) restent chez les appelants.
 */
const enregistrerEtEnvoyer = async ({
  organizationId,
  userId = null,
  phone,
  body,
  purpose,
  batchId = null,
  alertId = null,
  consent = null,
  now = new Date(),
  timezone = null,
}) => {
  /*
   * 0. Fenêtre de silence — alertes uniquement.
   *
   * Placée **avant** le plafond quotidien : un envoi retenu la nuit ne doit pas
   * consommer de quota. Un code OTP n'est jamais retenu ici, c'est une réponse
   * à une demande de l'utilisateur, pas une alerte non sollicitée.
   */
  if (purpose === env.SMS_ALERT_PURPOSE && reglagesSilence().enabled) {
    const fenetre = dansFenetreSilence(now, {
      debut: reglagesSilence().start,
      fin: reglagesSilence().end,
      fuseau: timezone ?? reglagesSilence().timezone,
    });
    if (fenetre.silencieux) {
      logger.info(
        `[SMS] envoi retenu : ${fenetre.heureLocale} (${fenetre.fuseau}) est dans la fenêtre `
        + `de silence ${fenetre.debut}–${fenetre.fin}`,
      );
      return { sent: false, skipReason: SKIP_REASONS.QUIET_HOURS, quietHours: fenetre };
    }
  }

  // 1. Plafond quotidien.
  const limit = await dailyLimitReached({ organizationId, userId, purpose, now });
  if (limit.reached) {
    logger.warn(
      `[SMS] plafond ${limit.scope} atteint (${limit.sent}/${limit.limit}) — envoi retenu`,
    );
    return { sent: false, skipReason: SKIP_REASONS.DAILY_LIMIT };
  }

  // 2. Enregistrement **avant** l'envoi : un message soumis puis perdu en cas
  //    de plantage resterait invisible, et le plafond ne le compterait pas.
  const analysis = analyseMessage(body);
  const record = await prisma.smsMessage.create({
    data: {
      id: newId('sms'),
      organizationId,
      userId: userId ?? null,
      phone,
      body,
      senderId: env.TWILIO_SENDER_ID,
      purpose,
      provider: env.SMS_PROVIDER,
      status: 'QUEUED_LOCALLY',
      segments: analysis.segments,
      encoding: analysis.encoding,
      characterCount: analysis.characterCount,
      batchId,
      alertId,
      /**
       * Le consentement est recopié au moment de l'envoi : si l'agriculteur se
       * désinscrit plus tard, il faut encore pouvoir montrer sur quel accord
       * cet envoi précis s'appuyait. `null` pour un OTP, qui ne repose sur
       * aucun consentement — c'est une information, pas un oubli.
       */
      consentSnapshot: consent
        ? {
            consentId: consent.id,
            status: consent.status,
            grantedAt: consent.grantedAt,
            method: consent.method,
            noticeVersion: consent.noticeVersion ?? null,
          }
        : null,
      mode: env.NODE_ENV === 'test' ? 'SIMULATED' : 'REAL',
      statusHistory: [
        { status: 'QUEUED_LOCALLY', rawStatus: null, at: new Date().toISOString(), source: 'local' },
      ],
    },
  });

  const result = await sendSms(phone, body);

  if (!result || result.delivered === false && result.error) {
    return prisma.smsMessage
      .update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          errorCode: result?.code ?? null,
          errorMessage: result?.error ?? 'échec d’envoi',
          lastStatusAt: new Date(),
          version: record.version + 1,
          statusHistory: [
            ...(record.statusHistory ?? []),
            { status: 'FAILED', rawStatus: null, at: new Date().toISOString(), source: 'provider' },
          ],
        },
      })
      .then((message) => ({ sent: false, message, error: result?.error ?? 'échec d’envoi' }));
  }

  const mapped = mapProviderStatus(result.status);
  const message = await prisma.smsMessage.update({
    where: { id: record.id },
    data: {
      providerMessageId: result.providerMessageId ?? null,
      status: mapped.status,
      rawStatus: mapped.rawStatus,
      segments: result.segments ?? analysis.segments,
      sentAt: new Date(),
      lastStatusAt: new Date(),
      version: record.version + 1,
      statusHistory: [
        ...(record.statusHistory ?? []),
        {
          status: mapped.status,
          rawStatus: mapped.rawStatus,
          at: new Date().toISOString(),
          source: 'provider',
        },
      ],
    },
  });

  return { sent: true, message, segments: message.segments, encoding: message.encoding };
};

/**
 * Envoie un lot d'alertes et enregistre ce qui a été retenu.
 *
 * Le journal compte **aussi les non-envois**, par raison : « aucun
 * consentement » et « plafond atteint » n'appellent pas la même correction, et
 * sans le détail les deux se confondent en un seul nombre.
 */
export const sendAlertBatch = async ({ organizationId, recipients, body, purpose, alertId }) => {
  if (!organizationId) throw ApiError.badRequest('organisation requise');
  const batchId = newId('batch');
  const startedAt = new Date();
  const skippedByReason = {};
  let sent = 0;
  let failed = 0;
  let totalSegments = 0;
  const results = [];

  for (const recipient of recipients ?? []) {
    // Un envoi par destinataire, séquentiel : un agrégateur SMS a des limites
    // de débit, et un envoi parallèle massif les ferait dépasser sans bénéfice.
    // eslint-disable-next-line no-await-in-loop
    const outcome = await sendAlertSms({
      organizationId,
      userId: recipient.userId ?? null,
      phone: recipient.phone,
      body: typeof body === 'function' ? body(recipient) : body,
      purpose: purpose ?? env.SMS_ALERT_PURPOSE,
      alertId: recipient.alertId ?? alertId ?? null,
      batchId,
    });
    results.push({ userId: recipient.userId ?? null, ...outcome });

    if (outcome.sent) {
      sent += 1;
      totalSegments += outcome.segments ?? 1;
    } else if (outcome.skipReason) {
      skippedByReason[outcome.skipReason] = (skippedByReason[outcome.skipReason] ?? 0) + 1;
    } else {
      failed += 1;
    }
  }

  const skipped = Object.values(skippedByReason).reduce((total, count) => total + count, 0);
  const log = await prisma.smsBatchLog.create({
    data: {
      id: newId('sbl'),
      organizationId,
      batchId,
      candidates: (recipients ?? []).length,
      sent,
      skipped,
      failed,
      skippedByReason,
      totalSegments,
      startedAt,
      finishedAt: new Date(),
      mode: env.NODE_ENV === 'test' ? 'SIMULATED' : 'REAL',
    },
  });

  return { batchId, log, results, counts: { sent, skipped, failed, totalSegments } };
};

/* ─────────────────────────── Suivi de remise ─────────────────────────── */

/**
 * Applique un accusé de remise reçu de Twilio.
 *
 * **Un statut terminal ne recule pas.** Twilio renvoie parfois plusieurs
 * callbacks pour un même message ; traiter un `sent` arrivé après un
 * `delivered` ferait régresser l'état et perdre la preuve de remise.
 */
const TERMINAL = new Set(['DELIVERED', 'UNDELIVERED', 'FAILED']);

export const recordDeliveryStatus = async ({
  providerMessageId,
  rawStatus,
  errorCode = null,
  errorMessage = null,
  source = 'webhook',
  at = new Date(),
}) => {
  if (!providerMessageId) throw ApiError.badRequest('identifiant de message fournisseur requis');

  const existing = await prisma.smsMessage.findUnique({
    where: { providerMessageId },
  });
  if (!existing) {
    /**
     * Un accusé pour un message inconnu n'est pas ignoré en silence : c'est
     * soit un message d'un autre environnement, soit une tentative de forger un
     * statut. Dans les deux cas, cela doit se voir.
     */
    logger.warn(`[SMS] accusé de remise pour un message inconnu : ${providerMessageId}`);
    throw ApiError.notFound(`aucun message connu pour ${providerMessageId}`);
  }

  const mapped = mapProviderStatus(rawStatus);
  if (TERMINAL.has(existing.status) && !TERMINAL.has(mapped.status)) {
    // Rien à appliquer : l'état définitif est déjà enregistré.
    return { message: existing, applied: false, reason: 'ALREADY_TERMINAL' };
  }

  const history = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
  const message = await prisma.smsMessage.update({
    where: { id: existing.id },
    data: {
      status: mapped.status,
      rawStatus: mapped.rawStatus,
      errorCode: errorCode ?? existing.errorCode,
      errorMessage: errorMessage ?? existing.errorMessage,
      lastStatusAt: at,
      version: existing.version + 1,
      statusHistory: [
        ...history,
        {
          status: mapped.status,
          rawStatus: mapped.rawStatus,
          at: at.toISOString(),
          source,
          ...(errorCode ? { errorCode } : {}),
        },
      ],
    },
  });

  return { message, applied: true };
};

/** Détail d'un message, avec son historique de statuts. */
export const getSmsMessage = async ({ organizationId, id }) => {
  const message = await prisma.smsMessage.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!message) throw ApiError.notFound('message SMS introuvable');
  return message;
};

/** Historique des envois, pour l'écran de suivi et le contrôle de coût. */
export const listSmsMessages = async ({
  organizationId,
  userId = null,
  status = null,
  batchId = null,
  limit = 50,
  page = 1,
}) => {
  const where = {
    organizationId,
    deletedAt: null,
    ...(userId ? { userId } : {}),
    ...(status ? { status } : {}),
    ...(batchId ? { batchId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.smsMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      skip: (Math.max(page, 1) - 1) * Math.min(Math.max(limit, 1), 200),
    }),
    prisma.smsMessage.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

/** Journaux de lots : ce qui a été envoyé, et ce qui a été retenu. */
export const listSmsBatchLogs = async ({ organizationId, limit = 20 }) => {
  const items = await prisma.smsBatchLog.findMany({
    where: { organizationId },
    orderBy: { startedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return { items, count: items.length };
};
