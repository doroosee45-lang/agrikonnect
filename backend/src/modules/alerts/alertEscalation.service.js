import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/http/logger.js';

/**
 * Escalade des alertes à deux niveaux.
 *
 * ## La règle
 *
 * Une alerte part d'abord à l'exploitant (niveau 1), au déclenchement. Si elle
 * n'est toujours **pas traitée** après `ALERT_ESCALATION_DELAY_MINUTES`, elle
 * remonte au rôle d'encadrement (`ALERT_ESCALATION_ROLES`, par défaut
 * `AGRONOMIST,SUPER_ADMIN`).
 *
 * ## Pourquoi ce n'est pas une simple re-notification
 *
 * La re-notification existante renvoie à **la même liste**. Elle ne sert à rien
 * si le destinataire de niveau 1 est absent, injoignable, ou n'a pas le pouvoir
 * d'agir. L'escalade change de destinataire, et c'est la seule des deux qui
 * puisse débloquer une alerte ignorée.
 *
 * ## Anti-doublon
 *
 * `escalatedAt` est posé **dans la même transaction** que le passage au
 * niveau 2. Sans cela, deux passages rapprochés de la tâche — ou deux
 * instances du backend — notifieraient deux fois le niveau 2.
 *
 * ## Ce qui n'escalade pas
 *
 * Une alerte déjà `HANDLED` n'escalade pas : prévenir l'encadrement d'un
 * problème réglé est du bruit, et le bruit apprend à ignorer les alertes.
 */

/** Statuts qui justifient encore une escalade. */
const STATUTS_ESCALADABLES = ['NEW', 'READ'];

/**
 * Destinataires de niveau 2 : les rôles d'encadrement de l'organisation.
 *
 * @param {string} organizationId
 * @param {string[]} roles Rôles concernés, lus de `ALERT_ESCALATION_ROLES`.
 */
export const resolveEscalationRecipients = async (organizationId, roles, { limit = 20 } = {}) => {
  if (!roles.length) return [];
  const memberships = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE', roles: { hasSome: roles } },
    include: { user: { select: { id: true, email: true, phone: true, firstName: true } } },
    take: limit,
  });
  return memberships
    .map((membership) => membership.user)
    .filter(Boolean)
    .filter((utilisateur, index, tous) => tous.findIndex((u) => u.id === utilisateur.id) === index);
};

/** Rôles d'escalade, lus à l'appel pour qu'un test puisse les faire varier. */
export const rolesEscalade = () =>
  (process.env.ALERT_ESCALATION_ROLES ?? env.ALERT_ESCALATION_ROLES)
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);

/**
 * Escalade les alertes en attente depuis trop longtemps.
 *
 * @param {{ organizationId?: string, now?: Date, limite?: number }} options
 * @returns {Promise<{ escaladees: number, examinees: number, details: Array }>}
 */
export const escaladerAlertes = async ({ organizationId = null, now = new Date(), limite = 100 } = {}) => {
  if (env.ALERT_ESCALATION_ENABLED !== 'true') {
    return { escaladees: 0, examinees: 0, details: [], raison: 'ALERT_ESCALATION_ENABLED=false' };
  }

  const delaiMs = env.ALERT_ESCALATION_DELAY_MINUTES * 60 * 1000;
  const cutoff = new Date(now.getTime() - delaiMs);

  /*
   * Le délai court depuis la **première** notification, pas depuis la dernière.
   * Se baser sur `lastNotifiedAt` repousserait l'escalade à chaque
   * re-notification : une alerte re-notifiée toutes les 24 h n'escaladerait
   * jamais.
   */
  const candidates = await prisma.thresholdAlert.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: { in: STATUTS_ESCALADABLES },
      escalationLevel: 1,
      escalatedAt: null,
      notifiedAt: { lt: cutoff },
    },
    orderBy: { notifiedAt: 'asc' },
    take: Math.min(Number(limite) || 100, 500),
    select: {
      id: true,
      organizationId: true,
      parameter: true,
      severity: true,
      message: true,
      episodeKey: true,
      notifiedAt: true,
      plotId: true,
    },
  });

  const resultat = { escaladees: 0, examinees: candidates.length, details: [] };

  for (const alerte of candidates) {
    /*
     * Réservation **avant** l'envoi : `updateMany` avec `escalatedAt: null` en
     * condition ne réussit que pour le premier appelant. Le second obtient
     * `count === 0` et passe son tour — c'est ce qui rend deux instances du
     * backend inoffensives.
     */
    // eslint-disable-next-line no-await-in-loop
    const reserve = await prisma.thresholdAlert.updateMany({
      where: { id: alerte.id, escalatedAt: null, escalationLevel: 1 },
      data: { escalationLevel: 2, escalatedAt: new Date() },
    });
    if (reserve.count === 0) {
      resultat.details.push({ id: alerte.id, escalated: false, raison: 'déjà réservée' });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const destinataires = await resolveEscalationRecipients(alerte.organizationId, rolesEscalade());
    if (destinataires.length === 0) {
      /*
       * Aucun encadrant dans l'organisation : l'alerte reste marquée niveau 2
       * pour ne pas être re-examinée à chaque passage, mais le fait est
       * journalisé. Le taire laisserait croire que l'escalade fonctionne.
       */
      logger.warn(
        `[escalade] alerte ${alerte.id} : aucun destinataire de niveau 2 `
        + `(rôles ${rolesEscalade().join(', ')} absents de l'organisation)`,
      );
      resultat.details.push({ id: alerte.id, escalated: false, raison: 'aucun destinataire de niveau 2' });
      continue;
    }

    try {
      const { dispatchAlert } = await import('./alerts.service.js');
      // eslint-disable-next-line no-await-in-loop
      const canaux = await dispatchAlert({
        organizationId: alerte.organizationId,
        alertId: alerte.id,
        recipients: destinataires,
        type: 'ALERT_ESCALATION',
        title: `Alerte non traitée — ${alerte.parameter}`,
        body:
          `Alerte ${alerte.severity.toLowerCase()} sur « ${alerte.parameter} » non traitée depuis `
          + `${env.ALERT_ESCALATION_DELAY_MINUTES} minutes. ${alerte.message ?? ''}`.trim(),
        payload: {
          alertId: alerte.id,
          episodeKey: alerte.episodeKey,
          escalationLevel: 2,
          notifiedAt: alerte.notifiedAt,
        },
        // Clé distincte de la notification initiale : sans cela la
        // déduplication avalerait l'escalade comme un doublon.
        dedupeKey: `escalade:${alerte.episodeKey}`,
      });
      resultat.escaladees += 1;
      resultat.details.push({
        id: alerte.id,
        escalated: true,
        destinataires: destinataires.length,
        canaux,
      });
    } catch (erreur) {
      /*
       * L'échec d'envoi ne doit pas laisser l'alerte marquée « escaladée » :
       * elle ne serait plus jamais reprise. On revient au niveau 1 pour qu'un
       * passage ultérieur réessaie.
       */
      logger.error(`[escalade] envoi impossible pour ${alerte.id} : ${erreur.message}`);
      // eslint-disable-next-line no-await-in-loop
      await prisma.thresholdAlert.updateMany({
        where: { id: alerte.id },
        data: { escalationLevel: 1, escalatedAt: null },
      });
      resultat.details.push({ id: alerte.id, escalated: false, raison: erreur.message });
    }
  }

  return resultat;
};
