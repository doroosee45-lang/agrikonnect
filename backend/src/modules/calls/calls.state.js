/**
 * Cycle de vie des appels audio — règles PURES (sans base), testées.
 *
 * Appel :
 *   RINGING ──(1er invité accepte)──────────────▶ ACTIVE ──(fin)──▶ ENDED
 *      ├────(l'hôte annule)────────────────────▶ CANCELLED
 *      ├────(tous les invités refusent)────────▶ DECLINED
 *      └────(sonnerie expirée, personne n'a accepté) ▶ MISSED
 *   États terminaux : ENDED, CANCELLED, DECLINED, MISSED.
 *
 * Participant :
 *   INVITED ─▶ ACCEPTED ─▶ JOINED ⇄ LEFT  (LEFT → JOINED : reconnexion)
 *      ├──▶ DECLINED   ├──▶ LEFT
 *      ├──▶ MISSED     (sonnerie expirée)
 *      └──▶ CANCELLED  (appel annulé / terminé avant réponse)
 *
 * Toute transition est appliquée en base par une mise à jour CONDITIONNELLE
 * (« compare-and-set » sur l'état de départ) : deux requêtes concurrentes ne
 * peuvent pas appliquer deux transitions incompatibles ; la perdante relit
 * l'état et répond de façon idempotente ou par un 409.
 */

export const ETATS_TERMINAUX_APPEL = ['ENDED', 'CANCELLED', 'DECLINED', 'MISSED'];
export const ETATS_EN_COURS_APPEL = ['RINGING', 'ACTIVE'];

const TRANSITIONS_APPEL = {
  RINGING: ['ACTIVE', 'CANCELLED', 'DECLINED', 'MISSED', 'ENDED'],
  ACTIVE: ['ENDED'],
  ENDED: [],
  CANCELLED: [],
  DECLINED: [],
  MISSED: [],
};

const TRANSITIONS_PARTICIPANT = {
  INVITED: ['ACCEPTED', 'DECLINED', 'MISSED', 'CANCELLED'],
  ACCEPTED: ['JOINED', 'LEFT'],
  JOINED: ['LEFT'],
  LEFT: ['JOINED'],
  DECLINED: [],
  MISSED: [],
  CANCELLED: [],
};

export const transitionAppelPermise = (de, vers) => (TRANSITIONS_APPEL[de] ?? []).includes(vers);
export const transitionParticipantPermise = (de, vers) => (TRANSITIONS_PARTICIPANT[de] ?? []).includes(vers);

/** États de départ autorisés pour atteindre `vers` (clause `where` du compare-and-set). */
export const etatsAppelVers = (vers) =>
  Object.entries(TRANSITIONS_APPEL).filter(([, cibles]) => cibles.includes(vers)).map(([de]) => de);
export const etatsParticipantVers = (vers) =>
  Object.entries(TRANSITIONS_PARTICIPANT).filter(([, cibles]) => cibles.includes(vers)).map(([de]) => de);

export const appelTermine = (statut) => ETATS_TERMINAUX_APPEL.includes(statut);

/** Sonnerie expirée ? (l'heure est injectée : testable sans horloge réelle). */
export const sonnerieExpiree = (appel, maintenant = new Date()) =>
  appel.status === 'RINGING' && new Date(appel.ringExpiresAt).getTime() <= maintenant.getTime();

/** Participants encore « dans » l'appel (ou en route pour le rejoindre). */
export const PRESENTS = ['ACCEPTED', 'JOINED'];

/**
 * Un utilisateur peut-il recevoir un jeton LiveKit pour cet appel ?
 *  - appel en cours (RINGING pour l'hôte qui attend, ACTIVE pour tous) ;
 *  - participant ayant ACCEPTÉ (ou déjà dans la salle, ou parti et qui revient
 *    pendant que l'appel est actif — reconnexion).
 * Un invité qui n'a pas accepté n'obtient JAMAIS de jeton.
 */
export const peutObtenirJeton = (appel, participant) => {
  if (!participant || appelTermine(appel.status)) return false;
  if (appel.status === 'RINGING') return participant.isHost === true && participant.status === 'ACCEPTED';
  if (appel.status === 'ACTIVE') return ['ACCEPTED', 'JOINED', 'LEFT'].includes(participant.status);
  return false;
};

/**
 * Après un refus : l'appel est-il refusé par tous ?
 * Vrai quand plus aucun invité n'est en attente ni n'a accepté.
 */
export const tousOntRefuse = (participants) => {
  const invites = participants.filter((p) => !p.isHost);
  return invites.length > 0 && invites.every((p) => ['DECLINED', 'CANCELLED', 'MISSED'].includes(p.status));
};

/**
 * Après un départ : l'appel doit-il se terminer ? Oui quand il reste moins de
 * deux personnes présentes (ou en route) — on ne parle pas seul.
 */
export const doitSeTerminerApresDepart = (participants, partant) =>
  participants.filter((p) => p.userId !== partant && PRESENTS.includes(p.status)).length < 2;
