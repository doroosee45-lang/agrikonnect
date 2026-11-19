/**
 * Version web de l'application mobile (expo export --platform web) : aucun
 * module natif d'appel. Les appels web passent par apps/web.
 */
export const APPELS_NATIFS_DEMANDES = false;
export const IOS_VOIP_PRET = false;
export type CallKeep = never;
export const appelsNatifsPossibles = (): boolean => false;
export const chargerLiveKit = (): null => null;
export const chargerCallKeep = (): null => null;
export const chargerMessaging = (): null => null;
export const chargerVoipPush = (): null => null;
