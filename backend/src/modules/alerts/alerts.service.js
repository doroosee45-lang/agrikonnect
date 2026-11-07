/**
 * Surveillance des recommandations culturales — CDC §8 (suivi) et V3 IOT-03.
 *
 * Règles appliquées ici, toutes issues du cahier des charges :
 *
 *  1. **Comparaison aux seuils.** Chaque recommandation `ACTIVE` porte des
 *     seuils dérivés des plages agronomiques. Le job compare les nouvelles
 *     mesures **et les prévisions** à ces seuils.
 *  2. **Une alerte par paramètre et par épisode.** L'épisode est la période de
 *     la recommandation suivie : la clé `paramètre:recommandation` est unique
 *     par organisation. Un second franchissement met à jour l'alerte existante
 *     au lieu d'en créer une nouvelle.
 *  3. **Re-notification espacée.** Tant que l'alerte reste ouverte, elle est
 *     rappelée au plus toutes les `ALERT_RENOTIFY_HOURS` heures — le SMS coûte
 *     cher et lasse.
 * 4. **Notification.** Email obligatoire, SMS canal principal en zone rurale,
 *     notification in-app toujours créée.
 *  5. **Nouvelle proposition pour la période restante.** Un franchissement
 *     constaté déclenche un recalcul sur ce qui reste de la période. Cette
 *     proposition est `PENDING` : l'ancienne recommandation reste `ACTIVE`
 *     jusqu'à acceptation explicite de l'agriculteur.
 *  6. **Capteurs silencieux.** Un capteur muet au-delà du seuil de silence
 *     produit une alerte dans la même table : l'agriculteur a une seule boîte.
 *
 * Deux garde-fous contre les fausses alertes :
 *  - une prévision n'est exploitée que si elle **bat la persistance**
 *    (`beatsBaseline === true`) — CDC phase 7. Une prévision non prouvée ne
 *    déclenche rien ;
 *  - un seuil issu d'un critère non évaluable n'existe pas dans `thresholds`,
 *    donc aucun paramètre ne peut être comparé à une borne inventée.
 */
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';
import { truncateForSms } from '../../integrations/twilio.js';
import { logger } from '../../shared/http/logger.js';
import { hardware } from '../../config/hardware.js';
import { buildSoilState } from '../recommendation/recommendation.service.js';
import { createRecommendation } from '../recommendation/recommendation.service.js';
import { ELIMINATION_KEYS, RANGE_LABELS } from '../recommendation/agronomicRanges.js';
import { describeAlert } from './alertLabels.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const ALERT_SOURCE_TYPES = Object.freeze(['MEASUREMENT', 'FORECAST', 'SENSOR_SILENCE']);

/**
 * Pseudo-paramètre des alertes de silence.
 *
 * La table `threshold_alerts` compare toujours une valeur observée à une valeur
 * de référence. Pour un capteur muet, la référence est le seuil de silence et
 * l'observation le nombre d'heures depuis la dernière remontée : la structure
 * reste cohérente au lieu d'accueillir une ligne sans grandeur.
 */
export const SENSOR_SILENCE_PARAMETER = 'sensorSilence';

/** Rôles destinataires d'une alerte de parcelle. */
export const RECIPIENT_ROLES = Object.freeze([
  'FARMER',
  'COOPERATIVE_ADMIN',
  'COOPERATIVE_MEMBER',
  'AGRICULTURAL_COMPANY',
  'AGRONOMIST',
]);

const MS_PER_DAY = DAY_MS;

/* ───────────────────────── Fonctions pures ───────────────────────── */

/**
 * Clé d'épisode d'une alerte de seuil.
 *
 * L'épisode est la période de la recommandation suivie : tant que cette
 * recommandation est active, un même paramètre ne produit qu'une alerte.
 */
export const episodeKeyFor = (parameter, recommendationId) => `${parameter}:${recommendationId}`;

/** Clé d'épisode d'un capteur silencieux : un épisode par capteur. */
export const silenceEpisodeKeyFor = (deviceId) => `${SENSOR_SILENCE_PARAMETER}:${deviceId}`;

/**
 * Compare une valeur observée à une plage `[min ; max]`.
 *
 * Une borne `null` n'est pas testée : une plage sans maximum (par exemple la
 * conductivité dont seule la borne basse est définitionnelle) ne déclenche
 * jamais de dépassement inventé.
 *
 * @returns {{breached:boolean, direction:('ABOVE'|'BELOW'|null), deviation:(number|null), limit:(number|null)}}
 */
export const evaluateAgainstThreshold = ({ min, max, observed }) => {
  /**
   * `null` et `undefined` sont écartés **avant** la conversion numérique :
   * `Number(null)` vaut `0`, donc une mesure absente serait comparée à zéro et
   * déclencherait une fausse alerte « en dessous du minimum ». C'est précisément
   * l'alerte inventée que le cahier des charges interdit.
   */
  if (observed === null || observed === undefined || observed === '') {
    return { breached: false, direction: null, deviation: null, limit: null };
  }
  const value = Number(observed);
  if (!Number.isFinite(value)) {
    return { breached: false, direction: null, deviation: null, limit: null };
  }
  if (max !== null && max !== undefined && Number.isFinite(max) && value > max) {
    return { breached: true, direction: 'ABOVE', deviation: round(value - max), limit: max };
  }
  if (min !== null && min !== undefined && Number.isFinite(min) && value < min) {
    return { breached: true, direction: 'BELOW', deviation: round(min - value), limit: min };
  }
  return { breached: false, direction: null, deviation: null, limit: null };
};

/**
 * Sévérité d'un franchissement.
 *
 * Fondée sur une règle déjà déclarée ailleurs, pas sur un seuil inventé : un
 * paramètre éliminatoire (la salinité) rend la culture impossible, donc
 * `CRITICAL` ; les autres pénalisent sans interdire, donc `WARNING`.
 */
export const severityFor = (parameter, { breached }) => {
  if (!breached) return 'INFO';
  return ELIMINATION_KEYS.includes(parameter) ? 'CRITICAL' : 'WARNING';
};

/**
 * Première date à laquelle une prévision annonce un franchissement.
 *
 * Les points sont triés par date : ce qui intéresse l'agriculteur est le
 * **premier** franchissement à venir, pas le pire de la série.
 *
 * @param {{values: Array<{at: string|Date, value: number}>, min?: number|null, max?: number|null}} input
 * @returns {{at: Date, value: number, direction: string, deviation: number, limit: number}|null}
 */
export const findPredictedBreach = ({ values, min, max }) => {
  if (!Array.isArray(values) || values.length === 0) return null;

  const sorted = [...values].sort(
    (a, b) => new Date(a?.at ?? 0).getTime() - new Date(b?.at ?? 0).getTime(),
  );

  for (const point of sorted) {
    const evaluation = evaluateAgainstThreshold({ min, max, observed: point?.value });
    if (evaluation.breached) {
      return {
        at: new Date(point.at),
        value: Number(point.value),
        direction: evaluation.direction,
        deviation: evaluation.deviation,
        limit: evaluation.limit,
      };
    }
  }
  return null;
};

/**
 * Une prévision est-elle exploitable ?
 *
 * CDC phase 7 : une prévision n'a de valeur que si elle fait mieux que la
 * persistance de la dernière valeur. `beatsBaseline` doit être **explicitement
 * vrai** — `null` (non évalué) et `false` (battue) interdisent tous deux de
 * s'appuyer dessus. Alerting sur une prévision non prouvée produirait de
 * fausses alertes préventives, les plus difficiles à justifier.
 */
export const isForecastUsable = (prediction) => prediction?.beatsBaseline === true;

/**
 * Faut-il re-notifier une alerte déjà ouverte ?
 *
 * `renotifyHours <= 0` désactive la relance : l'alerte reste visible dans
 * l'application mais ne génère plus aucun envoi.
 */
export const shouldRenotify = ({ lastNotifiedAt, now = new Date(), renotifyHours }) => {
  if (!lastNotifiedAt) return true;
  const hours = Number(renotifyHours);
  if (!Number.isFinite(hours) || hours <= 0) return false;
  return new Date(now).getTime() - new Date(lastNotifiedAt).getTime() >= hours * HOUR_MS;
};

/**
 * Période restante d'une recommandation, pour recalculer une proposition.
 *
 * @returns {{periodStart: Date, periodEnd: Date, days: number}|null} `null` si la période est écoulée.
 */
export const remainingPeriod = ({ periodEnd, now = new Date() }) => {
  const end = new Date(periodEnd);
  const from = new Date(now);
  if (!(end > from)) return null;
  return {
    periodStart: from,
    periodEnd: end,
    days: Math.max(1, Math.ceil((end.getTime() - from.getTime()) / MS_PER_DAY)),
  };
};

/** Libellé français d'une grandeur surveillée. */
export const parameterLabel = (parameter) => {
  if (parameter === SENSOR_SILENCE_PARAMETER) return 'capteur silencieux';
  return RANGE_LABELS[parameter] ?? parameter;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatNumber = (value) =>
  Number.isFinite(value) ? String(round(value)).replace('.', ',') : '—';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Valeur dynamique insérée dans un SMS : assainie au jeu GSM-7, puis tronquée.
 *
 * Ces textes ne sont pas rédigés ici : ils viennent d'un nom de parcelle saisi
 * par l'agriculteur, d'un libellé d'appareil, ou de la table `RANGE_LABELS` —
 * qui contient « température de l’air » avec une **apostrophe typographique**,
 * et dont le libellé le plus long fait 41 caractères. Un seul `’` ferait
 * basculer tout le message en UCS-2 ; un libellé long le ferait déborder sur un
 * second segment. Les deux coûtent de l'argent.
 *
 * @param {string} value
 * @param {number} max budget de caractères
 */
const smsText = (value, max) => truncateForSms(value ?? '', max);

/**
 * Texte de l'alerte, en français.
 *
 * Le SMS est le canal principal du déploiement : le message doit tenir seul,
 * citer la valeur observée, la plage attendue et la source. Aucun nombre n'est
 * arrondi au point de devenir faux.
 *
 * ## Contrainte SMS : un segment, en GSM-7
 *
 * Un SMS GSM-7 porte **160 caractères** ; en UCS-2, **70**. Un seul caractère
 * hors du jeu fait basculer tout le message : la facture double et la coupure
 * change. Deux règles en découlent, vérifiées par
 * `tests/alertMessageGsm.test.mjs` :
 *
 *  - **le texte rédigé ici ne contient aucun caractère hors GSM-7** — pas de
 *    tiret cadratin `—`, pas d'apostrophe typographique `’`, pas de `ô`, `î`,
 *    `ï`, `ç` minuscule, pas de `°`. Les versions précédentes de ces gabarits
 *    utilisaient `—` partout : **chacun de ces messages partait en UCS-2, sur 3
 *    ou 4 segments** ;
 *  - **les valeurs dynamiques passent par `smsText()`** : nom de parcelle,
 *    libellé d'appareil, libellé de paramètre et unité viennent de
 *    l'utilisateur ou d'une table, et ne sont pas sous le contrôle de ce texte.
 *
 * Le **titre** n'est pas soumis à cette contrainte : il sert à l'in-app et à
 * l'email, pas au SMS. Il conserve donc son `—`.
 *
 * @returns {{title: string, body: string}}
 */
export const buildAlertMessage = ({
  sourceType,
  parameter,
  plotName,
  observed,
  unit,
  min,
  max,
  predictedBreachAt,
  threshold,
  deviceLabel,
  silenceHours,
  silenceThresholdHours,
  simulated = false,
}) => {
  const prefix = simulated ? '[SIMULÉ] ' : '';

  if (sourceType === 'SENSOR_SILENCE') {
    return {
      title: `${prefix}Capteur silencieux`,
      body:
        `${prefix}AGRIKONNECT : capteur silencieux. `
        + `${smsText(deviceLabel ?? 'Capteur', 24)} sans mesure depuis ${formatNumber(silenceHours)} h `
        + `(seuil ${formatNumber(silenceThresholdHours)} h). Vérifiez pile et réseau. `
        + 'Aucune mesure inventée.',
    };
  }

  const label = smsText(parameterLabel(parameter), 26);
  const observedText = `${formatNumber(observed)}${unit ? ` ${smsText(unit, 8)}` : ''}`;
  const place = smsText(plotName ?? 'Parcelle', 18);
  // Crochets évités : `[` et `]` sont au jeu **étendu** GSM, donc comptés double.
  const rangeText = `${formatNumber(min)} à ${formatNumber(max)}${unit ? ` ${smsText(unit, 8)}` : ''}`;

  if (sourceType === 'FORECAST') {
    return {
      title: `${prefix}Prévision défavorable — ${parameterLabel(parameter)}`,
      body:
        `${prefix}AGRIKONNECT : prévision défavorable. ${place} - ${label} `
        + `sortira de ${rangeText} le ${formatDate(predictedBreachAt)} (${observedText}). `
        + 'Batt la persistance.',
    };
  }

  return {
    title: `${prefix}Seuil dépassé — ${parameterLabel(parameter)}`,
    body:
      `${prefix}AGRIKONNECT : seuil dépassé. ${place} - ${label} à ${observedText}, `
      + `attendu ${rangeText}`
      + `${threshold?.derivedFrom ? ` (${smsText(threshold.derivedFrom, 12)})` : ''}. `
      + 'Proposition disponible.',
  };
};

/* ───────────────────────── Destinataires ───────────────────────── */

/**
 * Membres de l'organisation à prévenir, avec leurs coordonnées.
 *
 * L'email est obligatoire (CDC) ; le SMS n'est ajouté que si un numéro existe.
 * Un destinataire sans email reçoit malgré tout la notification in-app : on ne
 * perd pas l'alerte sous prétexte qu'un canal manque.
 */
export const resolveRecipients = async (organizationId, { limit = 20 } = {}) => {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      roles: { hasSome: [...RECIPIENT_ROLES] },
    },
    include: { user: { select: { id: true, email: true, phone: true, firstName: true } } },
    take: limit,
  });

  return memberships
    .map((membership) => membership.user)
    .filter(Boolean)
    .filter((user, index, all) => all.findIndex((u) => u.id === user.id) === index);
};

/**
 * Envoie une alerte à chaque destinataire, sur ses propres coordonnées.
 *
 * `notifyMany` ne convient pas : il propage un seul `email` à tous les
 * destinataires. Ici chaque membre reçoit son adresse et son numéro.
 *
 * ## Le SMS ne passe plus par `notify()`
 *
 * Le SMS est le canal **primaire** et le canal **payant**. Le laisser partir
 * par le chemin générique des notifications le ferait échapper à trois règles
 * qu'il est seul à devoir respecter : le **consentement explicite** (le canal
 * est à sens unique en RDC, aucun « STOP » par SMS n'est possible), le
 * **plafond quotidien**, et le **journal de lot** qui compte le coût.
 *
 * `notify()` ne reçoit donc plus le canal `SMS` : les destinataires dotés d'un
 * numéro sont remis à `sendAlertBatch()`, qui applique ces règles et écrit le
 * journal. L'in-app et l'email restent sur leur chemin — gratuits, sans
 * consentement à prouver, et déjà dédupliqués.
 *
 * @returns {Promise<string[]>} les canaux réellement employés. `SMS` n'y figure
 *   que si au moins un message a **effectivement** été soumis : un envoi retenu
 *   par un garde-fou n'est pas un canal employé.
 */
export const dispatchAlert = async ({
  recipients,
  type,
  title,
  body,
  payload,
  dedupeKey,
  organizationId = null,
  alertId = null,
}) => {
  const channelsUsed = new Set();
  /** Destinataires joignables par SMS : le lot applique consentement et plafond. */
  const smsRecipients = [];

  for (const user of recipients) {
    const channels = ['IN_APP'];
    // Email obligatoire : même sans numéro de téléphone, l'alerte part.
    if (user.email) channels.push('EMAIL');
    // Le SMS est traité en lot, plus bas — jamais par `notify()`.
    if (user.phone) smsRecipients.push({ userId: user.id, phone: user.phone, alertId });

    try {
      // eslint-disable-next-line no-await-in-loop
      const created = await notify({
        userId: user.id,
        type,
        title,
        body,
        channels,
        payload: { ...payload, phone: user.phone ?? null },
        dedupeKey,
        email: user.email ?? null,
      });
      for (const notification of created) channelsUsed.add(notification.channel);
    } catch (error) {
      // Un échec d'envoi ne doit pas empêcher les autres destinataires.
      logger.error(`[alertes] envoi impossible vers ${user.id} : ${error.message}`);
    }
  }

  if (organizationId && smsRecipients.length > 0) {
    try {
      const { sendAlertBatch } = await import('../smsDelivery/smsDelivery.service.js');
      const batch = await sendAlertBatch({
        organizationId,
        recipients: smsRecipients,
        body,
        alertId,
      });
      if (batch.counts.sent > 0) channelsUsed.add('SMS');
      /**
       * Les retenus sont journalisés, pas perdus : « aucun consentement » et
       * « plafond atteint » n'appellent pas la même correction.
       */
      if (batch.counts.skipped > 0 || batch.counts.failed > 0) {
        logger.info(
          `[alertes] lot ${batch.batchId} : ${batch.counts.sent} SMS envoyé(s), `
          + `${batch.counts.skipped} retenu(s) ${JSON.stringify(batch.log.skippedByReason ?? {})}, `
          + `${batch.counts.failed} échec(s).`,
        );
      }
    } catch (error) {
      /**
       * Un échec du canal SMS ne doit pas faire échouer l'alerte : l'in-app et
       * l'email sont déjà partis, et l'alerte reste visible dans l'application.
       */
      logger.error(`[alertes] lot SMS impossible : ${error.message}`);
    }
  }

  return [...channelsUsed];
};

/* ───────────────────────── Écriture d'une alerte ───────────────────────── */

/**
 * Crée ou met à jour l'alerte d'un épisode, puis notifie si le délai est écoulé.
 *
 * L'upsert porte la règle « une alerte par paramètre et par épisode » : la
 * contrainte d'unicité `(organizationId, episodeKey)` garantit qu'un second
 * franchissement enrichit la ligne existante au lieu d'en ajouter une.
 */
export const raiseAlert = async ({
  organizationId,
  plotId,
  recommendationId,
  episodeKey,
  parameter,
  sourceType,
  referenceValue,
  observedValue,
  deviation,
  severity,
  observedAt,
  predictedBreachAt,
  predictive,
  confidence,
  deviceId,
  message,
  now = new Date(),
  renotifyHours,
  simulated = false,
}) => {
  const existing = await prisma.thresholdAlert.findUnique({
    where: { organizationId_episodeKey: { organizationId, episodeKey } },
  });

  /**
   * `message` est une colonne texte : le titre et le corps y sont joints ici,
   * une seule fois, pour que les deux chemins (création et mise à jour)
   * écrivent exactement la même forme.
   */
  const messageText = `${message.title}\n${message.body}`;

  /**
   * En production, une donnée simulée ne peut pas produire un envoi réel :
   * `env.simulationAllowed` est `false` par construction dans cet environnement.
   */
  const maySend = !(simulated && !env.simulationAllowed);

  if (existing) {
    const renotify = shouldRenotify({ lastNotifiedAt: existing.lastNotifiedAt, now, renotifyHours });
    // Une alerte traitée par l'agriculteur ne se rouvre pas toute seule.
    const stillOpen = existing.status !== 'HANDLED';

    const updated = await prisma.thresholdAlert.update({
      where: { id: existing.id },
      data: {
        observedValue,
        deviation,
        severity,
        observedAt,
        predictedBreachAt,
        predictive,
        confidence,
        message: messageText,
      },
    });

    if (renotify && stillOpen && maySend) {
      const channelsSent = await dispatchAlert({
        recipients: await resolveRecipients(organizationId),
        organizationId,
        alertId: updated.id,
        type: 'THRESHOLD_ALERT',
        title: message.title,
        body: message.body,
        payload: {
          alertId: updated.id,
          plotId: plotId ?? null,
          recommendationId: recommendationId ?? null,
          parameter,
          sourceType,
          simulated,
        },
        dedupeKey: `${episodeKey}:renotify:${updated.notificationCount + 1}`,
      });

      if (channelsSent.length) {
        return prisma.thresholdAlert.update({
          where: { id: updated.id },
          data: {
            channelsSent: [...new Set([...updated.channelsSent, ...channelsSent])],
            lastNotifiedAt: now,
            notificationCount: { increment: 1 },
          },
        });
      }
      return updated;
    }

    return updated;
  }

  const alert = await prisma.thresholdAlert.create({
    data: {
      id: `thr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      organizationId,
      plotId: plotId ?? null,
      recommendationId: recommendationId ?? null,
      parameter,
      sourceType,
      referenceValue,
      observedValue,
      deviation,
      severity,
      episodeKey,
      observedAt,
      predictedBreachAt,
      predictive,
      confidence,
      deviceId: deviceId ?? null,
      message: messageText,
    },
  });

  if (!maySend) {
    logger.warn(
      `[alertes] alerte ${alert.id} non envoyée : issue de données simulées, refusées en production.`,
    );
    return alert;
  }

  const channelsSent = await dispatchAlert({
    recipients: await resolveRecipients(organizationId),
    organizationId,
    alertId: alert.id,
    type: 'THRESHOLD_ALERT',
    title: message.title,
    body: message.body,
    payload: {
      alertId: alert.id,
      plotId: plotId ?? null,
      recommendationId: recommendationId ?? null,
      parameter,
      sourceType,
      simulated,
    },
    dedupeKey: `${episodeKey}:first`,
  });

  if (!channelsSent.length) return alert;

  return prisma.thresholdAlert.update({
    where: { id: alert.id },
    data: {
      channelsSent,
      notifiedAt: now,
      lastNotifiedAt: now,
      notificationCount: 1,
    },
  });
};

/* ───────────────────────── Balayage d'une recommandation ───────────────────────── */

/**
 * Compare une recommandation active aux mesures et aux prévisions.
 *
 * @returns {Promise<{alerts: object[], replacement: object|null, checked: number}>}
 */
export const scanRecommendation = async (recommendation, { now = new Date(), renotifyHours } = {}) => {
  const thresholds = recommendation.thresholds ?? {};
  const parameters = Object.keys(thresholds);
  const simulated = recommendation.mode === 'SIMULATED';

  const plot = await prisma.plot.findFirst({
    where: { id: recommendation.plotId, organizationId: recommendation.organizationId, deletedAt: null },
  });
  const plotName = plot?.name ?? recommendation.plotId;

  // Même construction d'état que celle du calcul : seuils et observations
  // proviennent alors de la même logique de fusion.
  const { state } = await buildSoilState(plot ?? null, recommendation.plotId);

  const raised = [];

  for (const parameter of parameters) {
    const threshold = thresholds[parameter];
    const measurement = state[parameter];

    if (measurement && Number.isFinite(Number(measurement.value))) {
      const evaluation = evaluateAgainstThreshold({
        min: threshold.min,
        max: threshold.max,
        observed: measurement.value,
      });

      if (evaluation.breached) {
        // eslint-disable-next-line no-await-in-loop
        const alert = await raiseAlert({
          organizationId: recommendation.organizationId,
          plotId: recommendation.plotId,
          recommendationId: recommendation.id,
          episodeKey: episodeKeyFor(parameter, recommendation.id),
          parameter,
          sourceType: 'MEASUREMENT',
          referenceValue: evaluation.direction === 'ABOVE' ? threshold.max : threshold.min,
          observedValue: Number(measurement.value),
          deviation: evaluation.deviation,
          severity: severityFor(parameter, evaluation),
          observedAt: measurement.measuredAt ?? now,
          predictive: false,
          confidence: null,
          message: buildAlertMessage({
            sourceType: 'MEASUREMENT',
            parameter,
            plotName,
            observed: Number(measurement.value),
            unit: threshold.unit ?? measurement.unit,
            min: threshold.min,
            max: threshold.max,
            threshold,
            simulated,
          }),
          now,
          renotifyHours,
          simulated,
        });
        raised.push(alert);
      }
    }
  }

  /**
   * Volet préventif : prévisions de sol, si elles existent et sont prouvées.
   *
   * Aucune prévision n'est fabriquée ici. Si la table est vide — c'est le cas
   * tant que le module IA n'a rien produit — ce volet ne déclenche rien et le
   * compte-rendu le dit.
   */
  if (parameters.length > 0) {
    const predictions = await prisma.soilPrediction.findMany({
      where: {
        plotId: recommendation.plotId,
        organizationId: recommendation.organizationId,
        parameter: { in: parameters },
      },
      orderBy: { computedAt: 'desc' },
      take: 200,
    });

    const latestByParameter = new Map();
    for (const prediction of predictions) {
      if (!latestByParameter.has(prediction.parameter)) latestByParameter.set(prediction.parameter, prediction);
    }

    for (const [parameter, prediction] of latestByParameter) {
      if (!isForecastUsable(prediction)) continue;

      const threshold = thresholds[parameter];
      if (!threshold) continue;

      const breach = findPredictedBreach({
        values: prediction.values,
        min: threshold.min,
        max: threshold.max,
      });
      // Un franchissement déjà passé relève du volet mesure, pas de la prévision.
      if (!breach || breach.at <= now) continue;

      const episodeKey = `${episodeKeyFor(parameter, recommendation.id)}:forecast`;
      const alreadyRaised = raised.some((alert) => alert.episodeKey === episodeKey);
      if (alreadyRaised) continue;

      // eslint-disable-next-line no-await-in-loop
      const alert = await raiseAlert({
        organizationId: recommendation.organizationId,
        plotId: recommendation.plotId,
        recommendationId: recommendation.id,
        episodeKey,
        parameter,
        sourceType: 'FORECAST',
        referenceValue: breach.direction === 'ABOVE' ? threshold.max : threshold.min,
        observedValue: breach.value,
        deviation: breach.deviation,
        severity: severityFor(parameter, { breached: true }),
        observedAt: prediction.computedAt ?? now,
        predictedBreachAt: breach.at,
        predictive: true,
        confidence: Number.isFinite(prediction.mae) ? prediction.mae : null,
        message: buildAlertMessage({
          sourceType: 'FORECAST',
          parameter,
          plotName,
          observed: breach.value,
          unit: threshold.unit,
          min: threshold.min,
          max: threshold.max,
          predictedBreachAt: breach.at,
          threshold,
          simulated: prediction.mode === 'SIMULATED' || simulated,
        }),
        now,
        renotifyHours,
        simulated: prediction.mode === 'SIMULATED' || simulated,
      });
      raised.push(alert);
    }
  }

  /**
   * Nouvelle proposition pour la période restante — seulement si un
   * franchissement **constaté** a eu lieu. Une prévision seule ne remplace pas
   * la recommandation en cours : elle avertit, elle ne décide pas.
   */
  let replacement = null;
  const measured = raised.filter((alert) => alert.sourceType === 'MEASUREMENT');
  /**
   * Une proposition existe déjà pour cet épisode ?
   *
   * Le lien vit sur l'alerte, pas sur la recommandation : sans ce contrôle,
   * chaque passage du job recréerait une proposition `PENDING` et l'agriculteur
   * verrait s'empiler des recommandations en attente. On interroge les alertes
   * réellement liées plutôt qu'un champ qui n'existe pas sur la recommandation.
   */
  const alreadyProposed = measured.length > 0
    ? await prisma.thresholdAlert.findFirst({
      where: {
        organizationId: recommendation.organizationId,
        plotId: recommendation.plotId,
        sourceType: 'MEASUREMENT',
        replacementRecommendationId: { not: null },
      },
      select: { replacementRecommendationId: true },
    })
    : null;

  if (measured.length > 0 && !alreadyProposed) {
    const remaining = remainingPeriod({ periodEnd: recommendation.periodEnd, now });
    if (remaining) {
      try {
        const proposal = await createRecommendation(
          recommendation.plotId,
          { periodStart: remaining.periodStart, periodEnd: remaining.periodEnd, mode: recommendation.mode },
          // Requête de service : aucun utilisateur HTTP. L'`organizationId`
          // vient de la recommandation elle-même, jamais d'un jeton.
          { tenant: { organizationId: recommendation.organizationId }, user: null },
          { pending: true },
        );
        replacement = proposal.recommendation;

        for (const alert of measured) {
          // eslint-disable-next-line no-await-in-loop
          await prisma.thresholdAlert.update({
            where: { id: alert.id },
            data: { replacementRecommendationId: replacement.id },
          });
        }
      } catch (error) {
        // Un recalcul impossible (données devenues insuffisantes) ne doit pas
        // faire perdre l'alerte : elle est déjà créée et notifiée.
        logger.error(`[alertes] recalcul impossible pour ${recommendation.id} : ${error.message}`);
      }
    }
  }

  return { alerts: raised, replacement, checked: parameters.length };
};

/* ───────────────────────── Capteurs silencieux ───────────────────────── */

/**
 * Signale les capteurs muets au-delà du seuil de silence.
 *
 * Le seuil vient du fichier de configuration matériel, seule source de vérité.
 */
export const scanSilentSensors = async ({ now = new Date(), renotifyHours } = {}) => {
  const thresholdHours = hardware.maintenance.silentSensorThreshold.value;
  if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) {
    return { thresholdHours, silent: 0, alerts: 0, reason: 'seuil de silence non configuré' };
  }

  const cutoff = new Date(new Date(now).getTime() - thresholdHours * HOUR_MS);
  const devices = await prisma.iotDevice.findMany({
    where: { status: 'ACTIVE', lastSeenAt: { lt: cutoff } },
    take: 500,
  });

  const alerts = [];
  for (const device of devices) {
    const silenceHours = device.lastSeenAt
      ? round((new Date(now).getTime() - new Date(device.lastSeenAt).getTime()) / HOUR_MS, 1)
      : null;

    // eslint-disable-next-line no-await-in-loop
    const alert = await raiseAlert({
      organizationId: device.organizationId,
      plotId: device.plotId ?? null,
      recommendationId: null,
      episodeKey: silenceEpisodeKeyFor(device.id),
      parameter: SENSOR_SILENCE_PARAMETER,
      sourceType: 'SENSOR_SILENCE',
      referenceValue: thresholdHours,
      observedValue: silenceHours,
      deviation: silenceHours === null ? null : round(silenceHours - thresholdHours, 1),
      severity: 'WARNING',
      observedAt: device.lastSeenAt ?? null,
      predictive: false,
      deviceId: device.id,
      message: buildAlertMessage({
        sourceType: 'SENSOR_SILENCE',
        parameter: SENSOR_SILENCE_PARAMETER,
        deviceLabel: device.label,
        silenceHours,
        silenceThresholdHours: thresholdHours,
      }),
      now,
      renotifyHours,
    });
    alerts.push(alert);
  }

  return { thresholdHours, silent: devices.length, alerts: alerts.length };
};

/* ───────────────────────── Point d'entrée du job ───────────────────────── */

/**
 * Exécution complète de la surveillance : recommandations actives, puis
 * capteurs silencieux.
 *
 * Chaque recommandation est traitée indépendamment : l'échec de l'une ne doit
 * pas priver les autres de surveillance.
 */
export const runMonitoring = async ({ now = new Date(), renotifyHours } = {}) => {
  const hours = Number(renotifyHours ?? env.ALERT_RENOTIFY_HOURS);

  const recommendations = await prisma.cropRecommendation.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    take: 500,
  });

  let alerts = 0;
  let replacements = 0;
  let parametersChecked = 0;
  const errors = [];

  for (const recommendation of recommendations) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await scanRecommendation(recommendation, { now, renotifyHours: hours });
      alerts += result.alerts.length;
      parametersChecked += result.checked;
      if (result.replacement) replacements += 1;
    } catch (error) {
      errors.push({ recommendationId: recommendation.id, error: error.message });
      logger.error(`[alertes] surveillance de ${recommendation.id} en échec : ${error.message}`);
    }
  }

  let silence;
  try {
    silence = await scanSilentSensors({ now, renotifyHours: hours });
  } catch (error) {
    silence = { error: error.message };
    logger.error(`[alertes] surveillance des capteurs en échec : ${error.message}`);
  }

  return {
    recommendationsScanned: recommendations.length,
    parametersChecked,
    alerts,
    replacements,
    silentSensors: silence,
    renotifyHours: hours,
    errors,
    at: new Date(now).toISOString(),
  };
};

/* ───────────────────────── Lecture et suivi ───────────────────────── */

/** Liste des alertes de l'organisation courante. */
export const list = async (query, req) => {
  const organizationId = req.tenant.organizationId;
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);

  const where = {
    organizationId,
    ...(query.plotId ? { plotId: query.plotId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.recommendationId ? { recommendationId: query.recommendationId } : {}),
    ...(query.open === 'true' ? { status: { not: 'HANDLED' } } : {}),
  };

  const [items, total, openCount] = await Promise.all([
    prisma.thresholdAlert.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.thresholdAlert.count({ where }),
    prisma.thresholdAlert.count({ where: { organizationId, status: { not: 'HANDLED' } } }),
  ]);

  return {
    /*
     * Libellés ajoutés sans requête supplémentaire : la liste n'a pas besoin de
     * la plage (elle porte déjà le seuil franchi), et aller chercher la
     * recommandation de chaque alerte ferait N+1 requêtes pour un écran de
     * liste. La plage est réservée au détail.
     */
    items: items.map((alert) => describeAlert(alert)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    openCount,
  };
};

/**
 * Plage de référence d'une alerte, lue dans les `thresholds` de la
 * recommandation liée.
 *
 * L'alerte ne stocke que le **seuil** franchi (`referenceValue`), pas la plage
 * dont il dérive. Sans la plage, un écran ne peut pas montrer « pH 6,1 pour une
 * plage 5,5 – 6,8 » — seulement « seuil 6,8 franchi ».
 *
 * Renvoie `null` quand il n'y a pas de recommandation liée ou pas de seuil pour
 * cette grandeur : c'est une information, pas un échec.
 */
const rangeOf = async (alert) => {
  if (!alert.recommendationId) return null;
  const recommendation = await prisma.cropRecommendation.findFirst({
    where: { id: alert.recommendationId, organizationId: alert.organizationId },
    select: { thresholds: true },
  });
  const seuils = recommendation?.thresholds;
  const plage = seuils && typeof seuils === 'object' ? seuils[alert.parameter] : null;
  return plage ?? null;
};

const findOwned = async (id, req) => {
  const alert = await prisma.thresholdAlert.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  // 404 et non 403 : ne pas révéler l'existence d'une alerte d'un autre tenant.
  if (!alert) throw ApiError.notFound('Alerte introuvable');
  return alert;
};

/**
 * Détail enrichi : libellés **et** plage de référence.
 *
 * La plage vient de la recommandation liée, pas d'un recalcul : afficher ici
 * une plage différente de celle qui a déclenché l'alerte serait trompeur.
 */
export const get = async (id, req) => {
  const alert = await findOwned(id, req);
  return describeAlert(alert, { range: await rangeOf(alert) });
};

export const markRead = async (id, req) => {
  const alert = await findOwned(id, req);
  // Déjà lue ou traitée : l'appel est idempotent, on renvoie l'état courant.
  if (alert.status !== 'NEW') return describeAlert(alert, { range: await rangeOf(alert) });
  const updated = await prisma.thresholdAlert.update({ where: { id }, data: { status: 'READ' } });
  return describeAlert(updated, { range: await rangeOf(updated) });
};

/**
 * Marque l'alerte comme traitée.
 *
 * Une alerte traitée ne se rouvre pas et ne re-notifie plus : c'est ce qui
 * permet à l'agriculteur de fermer un épisode sans être relancé indéfiniment.
 */
export const markHandled = async (id, req) => {
  const alert = await findOwned(id, req);
  const updated = await prisma.thresholdAlert.update({
    where: { id },
    data: { status: 'HANDLED' },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'alert.handle',
    resource: 'ThresholdAlert',
    resourceId: id,
    req,
    oldValue: { status: alert.status },
    newValue: { status: 'HANDLED' },
  });

  return describeAlert(updated, { range: await rangeOf(updated) });
};
