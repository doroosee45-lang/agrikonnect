/**
 * Appels audio — service métier (autorité unique : PostgreSQL).
 *
 * Règles d'autorisation, toutes décidées CÔTÉ SERVEUR :
 *  - identité : session Supabase vérifiée (`authenticate`) ; jamais d'identifiant
 *    d'utilisateur, de rôle, de participant ni de nom de salle pris au client ;
 *  - un appel naît dans une CONVERSATION existante, ouverte (OPEN), dont
 *    l'organisation active de l'appelant est participante ;
 *  - chaque invité doit être MEMBRE ACTIF d'une organisation participante, avec
 *    un compte actif ; l'appelant choisit qui inviter parmi eux ;
 *  - personne ne rejoint une salle sans invitation, vérification serveur et
 *    acceptation : seul un participant ACCEPTÉ obtient un jeton LiveKit ;
 *  - l'admissibilité est REVÉRIFIÉE à l'acceptation et à chaque jeton
 *    (conversation bloquée, adhésion retirée, compte suspendu entre-temps).
 *
 * Concurrence : chaque transition est une mise à jour conditionnelle sur l'état
 * de départ (voir `calls.state.js`) ; la requête perdante relit l'état et répond
 * de façon idempotente (même état visé) ou par un 409.
 */
import crypto from 'node:crypto';

import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notifyMany } from '../../shared/events.js';
import { emitToUser } from '../../realtime/bus.js';
import { logger } from '../../shared/http/logger.js';
import { creerJetonAudio, creerSalle, fermerSalle, urlLiveKit } from '../../integrations/livekit.js';
import { apnsConfigure, envoyerAuxAppareils, fcmConfigure } from '../../integrations/push.js';
import { etatAppels } from './callsConfig.js';
import {
  ETATS_EN_COURS_APPEL,
  appelTermine,
  doitSeTerminerApresDepart,
  etatsAppelVers,
  etatsParticipantVers,
  peutObtenirJeton,
  sonnerieExpiree,
  tousOntRefuse,
} from './calls.state.js';

/* ─────────────────────── outils ─────────────────────── */

const indisponible = (raisons) =>
  new ApiError(503, 'Appels audio indisponibles', { code: 'CALLS_UNAVAILABLE', details: { reasons: raisons } });

/** Garde d'activation : CALLS_ENABLED + LiveKit + réglage `modules.appels` (callsConfig.js). */
export const exigerAppelsActifs = async () => {
  const etat = await etatAppels();
  if (!etat.enabled) throw indisponible(etat.reasons);
  return etat;
};

/** Nom de salle généré par le serveur : imprévisible, jamais fourni par le client. */
export const nouveauNomDeSalle = () => `ak-call-${crypto.randomBytes(16).toString('hex')}`;

const nomAffiche = (profil) =>
  [profil?.firstName, profil?.lastName].filter(Boolean).join(' ').trim() || null;

const avecParticipants = {
  participants: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { invitedAt: 'asc' },
  },
};

/** Vue renvoyée au client : identifiants, statuts et noms — jamais de secret ni de nom de salle. */
export const vueAppel = (appel, userId) => {
  const moi = appel.participants?.find((p) => p.userId === userId) ?? null;
  return {
    id: appel.id,
    conversationId: appel.conversationId,
    kind: appel.kind,
    status: appel.status,
    ringExpiresAt: appel.ringExpiresAt,
    startedAt: appel.startedAt,
    endedAt: appel.endedAt,
    endReason: appel.endReason,
    me: moi ? { status: moi.status, isHost: moi.isHost } : null,
    participants: (appel.participants ?? []).map((p) => ({
      userId: p.userId,
      name: nomAffiche(p.user),
      organizationId: p.organizationId,
      status: p.status,
      isHost: p.isHost,
    })),
  };
};

/** Journal des transitions (source `api` ou `system`) — aucun secret, aucun jeton. */
const journaliser = (client, { callId, source = 'api', type, actorId = null, fromStatus = null, toStatus = null, details = null }) =>
  client.callEvent.create({
    data: {
      id: resolveId(),
      callId,
      source,
      type,
      externalId: null,
      actorId,
      fromStatus,
      toStatus,
      details: details ?? undefined,
    },
  });

/**
 * Arrête la sonnerie sur les appareils (push APPEL_TERMINE : Android données
 * priorité haute ; iOS « background » au mieux — jamais de VoIP sans appel).
 * Au mieux : un échec n'interrompt jamais la transition déjà validée.
 */
const arreterSonnerie = async (userIds, appel, raison) => {
  for (const userId of new Set(userIds)) {
    // eslint-disable-next-line no-await-in-loop
    await envoyerAuxAppareils(userId, {
      genre: 'APPEL_TERMINE',
      type: 'call.ended',
      donnees: { callId: appel.id, conversationId: appel.conversationId, status: appel.status, reason: raison },
      ttlSecondes: 30,
      collapseId: appel.id,
    }).catch((erreur) => logger.warn(`[appels] arrêt de sonnerie : ${erreur.message}`));
  }
};

/** Diffuse l'état à chaque participant (salons `user:` du bus Socket.IO existant). */
const diffuser = (appel, evenement = 'call:updated') => {
  for (const p of appel.participants ?? []) {
    emitToUser(p.userId, evenement, {
      callId: appel.id,
      conversationId: appel.conversationId,
      status: appel.status,
      participants: (appel.participants ?? []).map((x) => ({ userId: x.userId, status: x.status })),
    });
  }
};

/**
 * Transition d'appel par compare-and-set. Renvoie true si CETTE requête l'a
 * appliquée, false si l'état avait déjà changé (concurrence).
 */
const transitionAppel = async (client, appel, vers, donnees = {}) => {
  const { count } = await client.callSession.updateMany({
    where: { id: appel.id, status: { in: etatsAppelVers(vers) }, version: appel.version },
    data: { status: vers, version: { increment: 1 }, ...donnees },
  });
  return count === 1;
};

const transitionParticipant = async (client, appelId, userId, vers, donnees = {}) => {
  const { count } = await client.callParticipant.updateMany({
    where: { callId: appelId, userId, status: { in: etatsParticipantVers(vers) } },
    data: { status: vers, ...donnees },
  });
  return count === 1;
};

const chargerAppel = (id) => prisma.callSession.findUnique({ where: { id }, include: avecParticipants });

/** Appel visible uniquement par ses participants (404 sinon : pas d'énumération). */
const chargerPourParticipant = async (id, userId) => {
  const appel = await chargerAppel(id);
  const moi = appel?.participants.find((p) => p.userId === userId);
  if (!appel || !moi) throw ApiError.notFound('Appel introuvable');
  return { appel, moi };
};

/**
 * Admissibilité d'une personne pour une conversation : membre ACTIF d'une
 * organisation participante non supprimée, compte ACTIF. Renvoie l'adhésion
 * retenue (organisation de l'appel) ou null.
 */
const adhesionAdmissible = async (userId, conversation, organisationPreferee = null) => {
  const adhesions = await prisma.membership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      organizationId: { in: conversation.participantOrgIds },
      organization: { deletedAt: null },
      user: { status: 'ACTIVE', deletedAt: null },
    },
    select: { organizationId: true },
  });
  if (adhesions.length === 0) return null;
  return adhesions.find((a) => a.organizationId === organisationPreferee) ?? adhesions[0];
};

/** La conversation permet-elle l'appel ? (ouverte uniquement — bloquée/archivée refusées). */
const conversationAppelable = (conversation) => conversation?.status === 'OPEN';

/* ─────────────────────── expiration (paresseuse + tâche) ─────────────────────── */

/**
 * Sonnerie expirée → invités sans réponse = MISSED ; appel jamais décroché =
 * MISSED. Idempotent : appliqué au plus une fois grâce au compare-and-set.
 * Appelé à chaque lecture (paresseux, fonctionne même sans tâches planifiées
 * — elles sont désactivées en production) et par la tâche `calls.expireRinging`.
 */
export const expirerSiNecessaire = async (appel, maintenant = new Date()) => {
  if (!appel || appelTermine(appel.status)) return appel;
  const echeance = new Date(appel.ringExpiresAt).getTime() <= maintenant.getTime();
  if (!echeance) return appel;

  const invitesEnAttente = appel.participants.filter((p) => p.status === 'INVITED');
  if (appel.status === 'ACTIVE' && invitesEnAttente.length === 0) return appel;

  const resultat = await prisma.$transaction(async (tx) => {
    const { count: manques } = await tx.callParticipant.updateMany({
      where: { callId: appel.id, status: 'INVITED' },
      data: { status: 'MISSED', respondedAt: maintenant },
    });
    let appelManque = false;
    if (sonnerieExpiree(appel, maintenant)) {
      appelManque = await transitionAppel(tx, appel, 'MISSED', { endedAt: maintenant, endReason: 'ring_timeout' });
      if (appelManque) {
        await tx.callParticipant.updateMany({
          where: { callId: appel.id, isHost: true, status: { in: ['ACCEPTED', 'JOINED'] } },
          data: { status: 'LEFT', leftAt: maintenant },
        });
        await journaliser(tx, { callId: appel.id, source: 'system', type: 'call.missed', fromStatus: 'RINGING', toStatus: 'MISSED' });
      }
    }
    return { manques, appelManque };
  });

  if (resultat.manques > 0 || resultat.appelManque) {
    const apres = await chargerAppel(appel.id);
    const destinataires = invitesEnAttente.map((p) => p.userId);
    if (resultat.appelManque) destinataires.push(apres.createdBy);
    await notifyMany(destinataires, {
      type: 'call.missed',
      title: 'Appel audio manqué',
      body: 'Un appel audio n’a pas abouti.',
      channels: ['IN_APP', 'PUSH'],
      push: { genre: 'NOTIFICATION', collapseId: appel.id },
      payload: { callId: appel.id, conversationId: appel.conversationId },
      dedupeKey: `call:${appel.id}:missed`,
    }).catch((erreur) => logger.warn(`[appels] notification d'appel manqué : ${erreur.message}`));
    await arreterSonnerie(invitesEnAttente.map((p) => p.userId), apres, 'missed');
    if (resultat.appelManque) await fermerSalle(appel.roomName);
    diffuser(apres);
    return apres;
  }
  return chargerAppel(appel.id);
};

/** Tâche planifiée : expire les sonneries échues (complément du mode paresseux). */
export const expirerSonneries = async (maintenant = new Date()) => {
  const echus = await prisma.callSession.findMany({
    where: {
      ringExpiresAt: { lte: maintenant },
      OR: [{ status: 'RINGING' }, { status: 'ACTIVE', participants: { some: { status: 'INVITED' } } }],
    },
    include: avecParticipants,
    take: 200,
  });
  let traites = 0;
  for (const appel of echus) {
    // eslint-disable-next-line no-await-in-loop
    await expirerSiNecessaire(appel, maintenant);
    traites += 1;
  }
  return { examined: echus.length, processed: traites };
};

/* ─────────────────────── jeton LiveKit ─────────────────────── */

const delivrerJeton = async (appel, moi, req) => {
  if (!peutObtenirJeton(appel, moi)) {
    throw ApiError.forbidden('Jeton d’appel refusé : appel terminé ou invitation non acceptée');
  }
  // Revérification : la conversation et l'adhésion peuvent avoir changé depuis l'invitation.
  const conversation = await prisma.conversation.findUnique({ where: { id: appel.conversationId } });
  if (!conversationAppelable(conversation)) throw ApiError.conflict('Conversation fermée ou bloquée : appel impossible');
  if (!(await adhesionAdmissible(req.user.id, conversation))) {
    throw ApiError.forbidden('Tu n’es plus membre actif d’une organisation de cette conversation');
  }

  const jeton = await creerJetonAudio({
    salle: appel.roomName,
    identite: req.user.id,
    nom: nomAffiche(req.user.profile),
  });
  return {
    url: urlLiveKit(),
    token: jeton,
    expiresInSeconds: env.CALL_TOKEN_TTL_SECONDS,
    audioOnly: true,
  };
};

/* ─────────────────────── cas d'usage ─────────────────────── */

export const configuration = async () => {
  const etat = await etatAppels();
  return {
    enabled: etat.enabled,
    reasons: etat.reasons,
    audioOnly: true,
    maxParticipants: env.CALL_MAX_PARTICIPANTS,
    ringTimeoutSeconds: env.CALL_RING_TIMEOUT_SECONDS,
    recording: false,
    endToEndEncryption: false,
    // Sonnerie hors application : quels canaux push sont opérationnels (aucun secret exposé).
    push: { android: fcmConfigure(), iosVoip: apnsConfigure() },
  };
};

/**
 * Personnes invitables dans une conversation (choix de l'appelant) : membres
 * ACTIFS des organisations participantes, comptes actifs, hors soi-même. Même
 * règle que la vérification à la création — l'interface ne propose que ce que
 * le serveur acceptera.
 */
export const invitables = async (conversationId, req) => {
  await exigerAppelsActifs();
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || !conversation.participantOrgIds.includes(req.tenant.organizationId)) {
    throw ApiError.notFound('Conversation introuvable');
  }
  const adhesions = await prisma.membership.findMany({
    where: {
      organizationId: { in: conversation.participantOrgIds },
      status: 'ACTIVE',
      userId: { not: req.user.id },
      organization: { deletedAt: null },
      user: { status: 'ACTIVE', deletedAt: null },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
    },
    take: 200,
  });
  const vus = new Set();
  const personnes = [];
  for (const a of adhesions) {
    if (vus.has(a.userId)) continue;
    vus.add(a.userId);
    personnes.push({
      userId: a.userId,
      name: nomAffiche(a.user),
      organizationId: a.organization.id,
      organizationName: a.organization.name,
    });
  }
  return {
    conversationId,
    callable: conversationAppelable(conversation),
    maxInvitees: env.CALL_MAX_PARTICIPANTS - 1,
    people: personnes,
  };
};

/** Création : appel individuel (1 invité) ou conférence (plusieurs invités choisis). */
export const creerAppel = async ({ conversationId, inviteeUserIds }, req) => {
  await exigerAppelsActifs();

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || !conversation.participantOrgIds.includes(req.tenant.organizationId)) {
    throw ApiError.notFound('Conversation introuvable');
  }
  if (!conversationAppelable(conversation)) throw ApiError.conflict('Conversation fermée ou bloquée : appel impossible');

  const invites = [...new Set(inviteeUserIds)];
  if (invites.includes(req.user.id)) throw ApiError.badRequest('Tu ne peux pas t’inviter toi-même');
  if (invites.length + 1 > env.CALL_MAX_PARTICIPANTS) {
    throw ApiError.badRequest(`Trop de participants (maximum ${env.CALL_MAX_PARTICIPANTS}, hôte compris)`);
  }

  // L'appelant lui-même doit être membre actif de l'organisation active participante.
  const adhesionAppelant = await adhesionAdmissible(req.user.id, conversation, req.tenant.organizationId);
  if (!adhesionAppelant || adhesionAppelant.organizationId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Tu n’es pas membre actif de l’organisation participante');
  }

  const adhesionsInvites = [];
  for (const userId of invites) {
    // eslint-disable-next-line no-await-in-loop
    const adhesion = await adhesionAdmissible(userId, conversation);
    if (!adhesion) {
      throw ApiError.forbidden('Un invité n’est pas membre actif d’une organisation de cette conversation', {
        code: 'INVITEE_NOT_ELIGIBLE',
      });
    }
    adhesionsInvites.push({ userId, organizationId: adhesion.organizationId });
  }

  const maintenant = new Date();

  /*
   * Création idempotente : même appelant, même conversation, mêmes invités,
   * sonnerie encore en cours → l'appel existant est renvoyé (double appui,
   * requête rejouée après une coupure réseau) au lieu d'en ouvrir un second.
   */
  const enCours = await prisma.callSession.findMany({
    where: { conversationId, createdBy: req.user.id, status: 'RINGING', ringExpiresAt: { gt: maintenant } },
    include: avecParticipants,
    take: 5,
  });
  const cleInvites = [...invites].sort().join(',');
  const identique = enCours.find(
    (a) => a.participants.filter((p) => !p.isHost).map((p) => p.userId).sort().join(',') === cleInvites,
  );
  if (identique) {
    const hote = identique.participants.find((p) => p.userId === req.user.id);
    return { call: vueAppel(identique, req.user.id), livekit: await delivrerJeton(identique, hote, req), replayed: true };
  }

  const id = resolveId();
  const nomDeSalle = nouveauNomDeSalle();

  await prisma.$transaction(async (tx) => {
    await tx.callSession.create({
      data: {
        id,
        conversationId,
        kind: invites.length === 1 ? 'DIRECT' : 'GROUP',
        status: 'RINGING',
        roomName: nomDeSalle,
        createdBy: req.user.id,
        callerOrganizationId: req.tenant.organizationId,
        ringExpiresAt: new Date(maintenant.getTime() + env.CALL_RING_TIMEOUT_SECONDS * 1000),
      },
    });
    await tx.callParticipant.createMany({
      data: [
        {
          id: resolveId(), callId: id, userId: req.user.id, organizationId: req.tenant.organizationId,
          isHost: true, status: 'ACCEPTED', respondedAt: maintenant,
        },
        ...adhesionsInvites.map((a) => ({
          id: resolveId(), callId: id, userId: a.userId, organizationId: a.organizationId,
          isHost: false, status: 'INVITED',
        })),
      ],
    });
    await journaliser(tx, {
      callId: id, type: 'call.created', actorId: req.user.id, toStatus: 'RINGING',
      details: { invitees: invites.length },
    });
  });

  await creerSalle({ salle: nomDeSalle, participantsMax: invites.length + 1 });

  await audit({
    actorId: req.user.id,
    action: 'call.create',
    resource: 'call_sessions',
    resourceId: id,
    req,
    newValue: { conversationId, invitees: invites.length },
  });

  const appel = await chargerAppel(id);
  const nomAppelant = nomAffiche(req.user.profile);

  /*
   * Sonnerie hors application : canal PUSH du service de notifications.
   * Charge minimale (identifiants, nom de l'appelant pour l'écran d'appel
   * natif), TTL = durée de sonnerie : un push arrivé trop tard n'est pas livré.
   */
  await notifyMany(invites, {
    type: 'call.incoming',
    title: 'Appel audio entrant',
    body: 'Un correspondant vous appelle.',
    channels: ['IN_APP', 'PUSH'],
    push: { genre: 'APPEL_ENTRANT', ttlSecondes: env.CALL_RING_TIMEOUT_SECONDS, collapseId: id },
    payload: {
      callId: id,
      conversationId,
      kind: appel.kind,
      callerId: req.user.id,
      callerName: nomAppelant,
      ringExpiresAt: appel.ringExpiresAt.toISOString(),
    },
    dedupeKey: `call:${id}:incoming`,
  }).catch((erreur) => logger.warn(`[appels] notification d'appel entrant : ${erreur.message}`));

  for (const userId of invites) {
    emitToUser(userId, 'call:incoming', {
      callId: id,
      conversationId,
      kind: appel.kind,
      caller: { userId: req.user.id, name: nomAppelant },
      ringExpiresAt: appel.ringExpiresAt,
    });
  }
  diffuser(appel);

  const moi = appel.participants.find((p) => p.userId === req.user.id);
  return { call: vueAppel(appel, req.user.id), livekit: await delivrerJeton(appel, moi, req) };
};

export const obtenir = async (id, req) => {
  await exigerAppelsActifs();
  const { appel } = await chargerPourParticipant(id, req.user.id);
  return vueAppel(await expirerSiNecessaire(appel), req.user.id);
};

/** Appels en cours de l'utilisateur (sonneries reçues comprises). */
export const lister = async (req) => {
  await exigerAppelsActifs();
  const appels = await prisma.callSession.findMany({
    where: { status: { in: ETATS_EN_COURS_APPEL }, participants: { some: { userId: req.user.id } } },
    include: avecParticipants,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const frais = [];
  for (const appel of appels) {
    // eslint-disable-next-line no-await-in-loop
    const a = await expirerSiNecessaire(appel);
    if (!appelTermine(a.status)) frais.push(vueAppel(a, req.user.id));
  }
  return frais;
};

export const accepter = async (id, req) => {
  await exigerAppelsActifs();
  let { appel, moi } = await chargerPourParticipant(id, req.user.id);
  appel = await expirerSiNecessaire(appel);
  moi = appel.participants.find((p) => p.userId === req.user.id);

  if (['ACCEPTED', 'JOINED'].includes(moi.status) && !appelTermine(appel.status)) {
    return { call: vueAppel(appel, req.user.id), livekit: await delivrerJeton(appel, moi, req) }; // idempotent
  }
  if (appelTermine(appel.status) || moi.status !== 'INVITED') {
    throw ApiError.conflict(`Appel impossible à accepter (appel ${appel.status}, invitation ${moi.status})`);
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: appel.conversationId } });
  if (!conversationAppelable(conversation)) throw ApiError.conflict('Conversation fermée ou bloquée : appel impossible');
  if (!(await adhesionAdmissible(req.user.id, conversation))) {
    throw ApiError.forbidden('Tu n’es plus membre actif d’une organisation de cette conversation');
  }

  const maintenant = new Date();
  await prisma.$transaction(async (tx) => {
    const ok = await transitionParticipant(tx, appel.id, req.user.id, 'ACCEPTED', { respondedAt: maintenant });
    if (!ok) throw ApiError.conflict('Invitation déjà traitée');
    if (appel.status === 'RINGING') {
      const ouvert = await transitionAppel(tx, appel, 'ACTIVE', { startedAt: maintenant });
      if (ouvert) await journaliser(tx, { callId: appel.id, type: 'call.active', actorId: req.user.id, fromStatus: 'RINGING', toStatus: 'ACTIVE' });
    }
    await journaliser(tx, { callId: appel.id, type: 'participant.accepted', actorId: req.user.id, fromStatus: 'INVITED', toStatus: 'ACCEPTED' });
  });

  const apres = await chargerAppel(appel.id);
  if (appelTermine(apres.status)) throw ApiError.conflict(`Appel ${apres.status}`);
  diffuser(apres);
  // Décroché sur un appareil : les AUTRES appareils de la même personne arrêtent de sonner.
  await arreterSonnerie([req.user.id], apres, 'answered');
  const moiApres = apres.participants.find((p) => p.userId === req.user.id);
  return { call: vueAppel(apres, req.user.id), livekit: await delivrerJeton(apres, moiApres, req) };
};

export const refuser = async (id, req) => {
  await exigerAppelsActifs();
  let { appel, moi } = await chargerPourParticipant(id, req.user.id);
  appel = await expirerSiNecessaire(appel);
  moi = appel.participants.find((p) => p.userId === req.user.id);
  if (moi.status === 'DECLINED') return vueAppel(appel, req.user.id); // idempotent
  if (moi.isHost || moi.status !== 'INVITED' || appelTermine(appel.status)) {
    throw ApiError.conflict(`Refus impossible (appel ${appel.status}, invitation ${moi.status})`);
  }

  const maintenant = new Date();
  await prisma.$transaction(async (tx) => {
    const ok = await transitionParticipant(tx, appel.id, req.user.id, 'DECLINED', { respondedAt: maintenant });
    if (!ok) throw ApiError.conflict('Invitation déjà traitée');
    await journaliser(tx, { callId: appel.id, type: 'participant.declined', actorId: req.user.id, fromStatus: 'INVITED', toStatus: 'DECLINED' });
    const participants = await tx.callParticipant.findMany({ where: { callId: appel.id } });
    if (appel.status === 'RINGING' && tousOntRefuse(participants)) {
      const fini = await transitionAppel(tx, appel, 'DECLINED', { endedAt: maintenant, endReason: 'declined' });
      if (fini) {
        await tx.callParticipant.updateMany({
          where: { callId: appel.id, isHost: true, status: { in: ['ACCEPTED', 'JOINED'] } },
          data: { status: 'LEFT', leftAt: maintenant },
        });
        await journaliser(tx, { callId: appel.id, type: 'call.declined', fromStatus: 'RINGING', toStatus: 'DECLINED' });
      }
    }
  });

  const apres = await chargerAppel(appel.id);
  if (apres.status === 'DECLINED') await fermerSalle(apres.roomName);
  diffuser(apres);
  await arreterSonnerie([req.user.id], apres, 'declined');
  return vueAppel(apres, req.user.id);
};

/** Annulation par l'hôte d'un appel qui sonne encore. */
export const annuler = async (id, req) => {
  await exigerAppelsActifs();
  const { appel, moi } = await chargerPourParticipant(id, req.user.id);
  if (!moi.isHost) throw ApiError.forbidden('Seul l’appelant peut annuler l’appel');
  if (appel.status === 'CANCELLED') return vueAppel(appel, req.user.id); // idempotent
  if (appel.status !== 'RINGING') throw ApiError.conflict(`Annulation impossible (appel ${appel.status})`);

  const maintenant = new Date();
  await prisma.$transaction(async (tx) => {
    const ok = await transitionAppel(tx, appel, 'CANCELLED', { endedAt: maintenant, endReason: 'cancelled' });
    if (!ok) throw ApiError.conflict('L’appel a changé d’état entre-temps');
    await tx.callParticipant.updateMany({
      where: { callId: appel.id, status: 'INVITED' },
      data: { status: 'CANCELLED', respondedAt: maintenant },
    });
    await tx.callParticipant.updateMany({
      where: { callId: appel.id, status: { in: ['ACCEPTED', 'JOINED'] } },
      data: { status: 'LEFT', leftAt: maintenant },
    });
    await journaliser(tx, { callId: appel.id, type: 'call.cancelled', actorId: req.user.id, fromStatus: 'RINGING', toStatus: 'CANCELLED' });
  });

  await fermerSalle(appel.roomName);
  const apres = await chargerAppel(appel.id);
  diffuser(apres);
  await arreterSonnerie(appel.participants.filter((p) => p.status === 'INVITED').map((p) => p.userId), apres, 'cancelled');
  return vueAppel(apres, req.user.id);
};

/** Fin de l'appel pour tous (hôte) ; annule d'abord s'il sonne encore. */
export const terminer = async (id, req) => {
  await exigerAppelsActifs();
  const { appel, moi } = await chargerPourParticipant(id, req.user.id);
  if (!moi.isHost) throw ApiError.forbidden('Seul l’appelant peut terminer l’appel pour tous');
  if (appel.status === 'RINGING') return annuler(id, req);
  if (appelTermine(appel.status)) return vueAppel(appel, req.user.id); // idempotent

  await cloturer(appel, { raison: 'ended_by_host', acteur: req.user.id });
  const apres = await chargerAppel(appel.id);
  diffuser(apres);
  // Invités qui n'avaient pas encore répondu (conférence) : leur sonnerie s'arrête.
  await arreterSonnerie(appel.participants.filter((p) => p.status === 'INVITED').map((p) => p.userId), apres, 'ended');
  return vueAppel(apres, req.user.id);
};

/** Clôture d'un appel ACTIF (hôte, dernier départ ou fin de salle LiveKit). */
const cloturer = async (appel, { raison, acteur = null, source = 'api', client = null }) => {
  const maintenant = new Date();
  const executer = async (tx) => {
    const ok = await transitionAppel(tx, appel, 'ENDED', { endedAt: maintenant, endReason: raison });
    if (!ok) return false;
    await tx.callParticipant.updateMany({
      where: { callId: appel.id, status: { in: ['ACCEPTED', 'JOINED'] } },
      data: { status: 'LEFT', leftAt: maintenant },
    });
    await tx.callParticipant.updateMany({
      where: { callId: appel.id, status: 'INVITED' },
      data: { status: 'CANCELLED', respondedAt: maintenant },
    });
    await journaliser(tx, { callId: appel.id, source, type: 'call.ended', actorId: acteur, fromStatus: appel.status, toStatus: 'ENDED', details: { reason: raison } });
    return true;
  };
  const fait = client ? await executer(client) : await prisma.$transaction(executer);
  if (fait && source !== 'livekit') await fermerSalle(appel.roomName);
  return fait;
};

/** Départ d'un participant ; l'appel se termine s'il reste moins de deux présents. */
export const quitter = async (id, req) => {
  await exigerAppelsActifs();
  const { appel, moi } = await chargerPourParticipant(id, req.user.id);
  if (appel.status === 'RINGING' && moi.isHost) return annuler(id, req);
  if (moi.status === 'LEFT' || appelTermine(appel.status)) return vueAppel(appel, req.user.id); // idempotent
  if (!['ACCEPTED', 'JOINED'].includes(moi.status)) throw ApiError.conflict(`Départ impossible (invitation ${moi.status})`);

  await prisma.$transaction(async (tx) => {
    const ok = await transitionParticipant(tx, appel.id, req.user.id, 'LEFT', { leftAt: new Date() });
    if (!ok) return;
    await journaliser(tx, { callId: appel.id, type: 'participant.left', actorId: req.user.id, fromStatus: moi.status, toStatus: 'LEFT' });
  });

  let apres = await chargerAppel(appel.id);
  if (apres.status === 'ACTIVE' && doitSeTerminerApresDepart(apres.participants, req.user.id)) {
    await cloturer(apres, { raison: 'last_participant_left', acteur: req.user.id });
    apres = await chargerAppel(appel.id);
  }
  diffuser(apres);
  return vueAppel(apres, req.user.id);
};

/** Nouveau jeton (rejoindre, reconnexion) : jamais pour un invité qui n'a pas accepté. */
export const jeton = async (id, req) => {
  await exigerAppelsActifs();
  let { appel } = await chargerPourParticipant(id, req.user.id);
  appel = await expirerSiNecessaire(appel);
  const moi = appel.participants.find((p) => p.userId === req.user.id);
  return delivrerJeton(appel, moi, req);
};

/* ─────────────────────── webhooks LiveKit (appelé par calls.webhook.js) ─────────────────────── */

/**
 * Applique un événement LiveKit VÉRIFIÉ, dans la transaction de son
 * enregistrement de déduplication. LiveKit n'est jamais la source de vérité :
 * un événement qui ne correspond pas à un participant admis est ignoré (et
 * conservé au journal pour l'audit).
 */
export const appliquerEvenementLiveKit = async (tx, evenement) => {
  const salle = evenement.room?.name;
  if (!salle) return { applied: false, reason: 'no_room' };
  const appel = await tx.callSession.findUnique({ where: { roomName: salle }, include: { participants: true } });
  if (!appel) return { applied: false, reason: 'unknown_room' };

  const identite = evenement.participant?.identity ?? null;
  const moi = identite ? appel.participants.find((p) => p.userId === identite) : null;
  const maintenant = new Date();

  switch (evenement.event) {
    case 'participant_joined': {
      if (!moi || !['ACCEPTED', 'LEFT'].includes(moi.status) || appelTermine(appel.status)) {
        return { applied: false, reason: 'participant_not_admitted', callId: appel.id };
      }
      const ok = await transitionParticipant(tx, appel.id, moi.userId, 'JOINED', { joinedAt: maintenant });
      return { applied: ok, callId: appel.id };
    }
    case 'participant_left': {
      if (!moi || moi.status !== 'JOINED') return { applied: false, reason: 'participant_not_joined', callId: appel.id };
      const ok = await transitionParticipant(tx, appel.id, moi.userId, 'LEFT', { leftAt: maintenant });
      return { applied: ok, callId: appel.id };
    }
    case 'room_finished': {
      if (appel.status !== 'ACTIVE') return { applied: false, reason: 'call_not_active', callId: appel.id };
      const ok = await cloturer(appel, { raison: 'room_finished', source: 'livekit', client: tx });
      return { applied: ok, callId: appel.id };
    }
    default:
      return { applied: false, reason: 'event_ignored', callId: appel.id };
  }
};

/** Après validation de la transaction webhook : diffusion temps réel de l'état. */
export const diffuserApresWebhook = async (callId) => {
  if (!callId) return;
  const appel = await chargerAppel(callId);
  if (appel) diffuser(appel);
};
