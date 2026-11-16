/**
 * Appels audio — état d'interface PUR (testé : callMachine.test.ts).
 *
 * Le serveur reste l'autorité : cet état ne fait que traduire l'appel renvoyé
 * par l'API (et les événements temps réel) en écran à afficher. Aucune
 * décision d'autorisation n'est prise ici.
 */
import type { CallStatus, CallView } from './types';

export type CallPhase =
  | 'idle'
  | 'incoming' // je suis invité, ça sonne
  | 'outgoing' // j'appelle, personne n'a encore décroché
  | 'connecting' // connexion audio en cours
  | 'in_call'
  | 'reconnecting'
  | 'ended'
  | 'error';

export type CallErrorCode = 'microphone' | 'network' | 'unavailable' | 'generic';

export interface CallUiState {
  phase: CallPhase;
  call: CallView | null;
  muted: boolean;
  error: CallErrorCode | null;
  /** Statut final affiché quelques secondes (manqué, refusé, annulé, terminé). */
  endStatus: CallStatus | null;
}

export const ETAT_INITIAL: CallUiState = { phase: 'idle', call: null, muted: false, error: null, endStatus: null };

const TERMINAUX: CallStatus[] = ['ENDED', 'CANCELLED', 'DECLINED', 'MISSED'];
export const estTermine = (status: CallStatus) => TERMINAUX.includes(status);

/** Phase à afficher pour un appel renvoyé par le serveur, selon MA situation. */
export function phaseDepuisAppel(call: CallView, connecte: boolean): CallPhase {
  if (estTermine(call.status)) return 'ended';
  const moi = call.me;
  if (!moi) return 'idle';
  if (moi.status === 'INVITED') return 'incoming';
  if (['DECLINED', 'MISSED', 'CANCELLED', 'LEFT'].includes(moi.status)) return 'ended';
  if (call.status === 'RINGING') return moi.isHost ? 'outgoing' : 'connecting';
  return connecte ? 'in_call' : 'connecting';
}

export type CallEvent =
  | { type: 'SERVER'; call: CallView; connected: boolean }
  | { type: 'CONNECTED' }
  | { type: 'RECONNECTING' }
  | { type: 'RECONNECTED' }
  | { type: 'MUTE'; muted: boolean }
  | { type: 'ERROR'; code: CallErrorCode }
  | { type: 'RESET' };

export function reduire(etat: CallUiState, evenement: CallEvent): CallUiState {
  switch (evenement.type) {
    case 'SERVER': {
      // Un autre appel ne remplace jamais un appel en cours.
      if (etat.call && etat.call.id !== evenement.call.id && !['idle', 'ended', 'error'].includes(etat.phase)) return etat;
      const phase = phaseDepuisAppel(evenement.call, evenement.connected);
      return {
        ...etat,
        call: evenement.call,
        phase,
        endStatus: phase === 'ended' ? evenement.call.status : null,
        error: phase === 'ended' ? etat.error : null,
      };
    }
    case 'CONNECTED':
      return etat.phase === 'connecting' || etat.phase === 'outgoing' || etat.phase === 'reconnecting'
        ? { ...etat, phase: etat.call?.status === 'RINGING' ? 'outgoing' : 'in_call' }
        : etat;
    case 'RECONNECTING':
      return etat.phase === 'in_call' ? { ...etat, phase: 'reconnecting' } : etat;
    case 'RECONNECTED':
      return etat.phase === 'reconnecting' ? { ...etat, phase: 'in_call' } : etat;
    case 'MUTE':
      return { ...etat, muted: evenement.muted };
    case 'ERROR':
      return { ...etat, phase: 'error', error: evenement.code };
    case 'RESET':
      return ETAT_INITIAL;
    default:
      return etat;
  }
}

/** Code d'erreur d'interface à partir d'une erreur technique (micro, réseau, service). */
export function codeErreur(erreur: unknown): CallErrorCode {
  const nom = (erreur as { name?: string })?.name ?? '';
  const statut = (erreur as { status?: number })?.status;
  if (['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(nom)) return 'microphone';
  if (statut === 503) return 'unavailable';
  if (statut === 0 || nom === 'ConnectionError' || nom === 'TypeError') return 'network';
  return 'generic';
}
