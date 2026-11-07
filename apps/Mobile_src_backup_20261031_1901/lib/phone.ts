/**
 * Numéro au format E.164.
 *
 * **Même règle que le backend** (`validateE164` dans
 * `backend/src/integrations/twilio.js`) : `+`, puis un premier chiffre de 1 à 9,
 * puis 6 à 14 chiffres. Les deux doivent rester alignés : si l'écran acceptait
 * un numéro que l'envoi refuse, l'agriculteur donnerait son consentement pour
 * un message qui ne partirait jamais — et il verrait un bouton actif sur un
 * canal mort.
 */
const E164 = /^\+[1-9]\d{6,14}$/;

export const isValidE164 = (value: string | null | undefined): boolean =>
  E164.test(String(value ?? '').trim());

/**
 * Numéro prêt à recevoir un SMS d'alerte ?
 *
 * Distinct de `isValidE164` : la forme peut être correcte sans que le numéro
 * soit utilisable. Un numéro non vérifié peut être celui de quelqu'un
 * d'autre — voir `backend/docs/SMS-TWILIO.md` §4.2. On l'accepte quand même
 * (la vérification par code n'est pas implémentée), mais l'écran le dit.
 */
export interface PhoneReadiness {
  /** Un numéro est enregistré. */
  present: boolean;
  /** Le numéro est au format E.164. */
  valid: boolean;
  /** Le bouton « Donner mon accord » peut être actif. */
  canGrant: boolean;
  /** Message court expliquant pourquoi le bouton est désactivé, sinon null. */
  blocker: string | null;
}

export const phoneReadiness = (phone: string | null | undefined): PhoneReadiness => {
  const value = String(phone ?? '').trim();
  const present = value.length > 0;
  const valid = isValidE164(value);
  return {
    present,
    valid,
    canGrant: valid,
    blocker: valid
      ? null
      : present
        ? 'Le numéro enregistré n’est pas au format international (+243…).'
        : 'Aucun numéro de téléphone enregistré : les alertes SMS ne peuvent pas partir.',
  };
};

/**
 * Numéro affiché à l'utilisateur.
 *
 * On montre le numéro, parce que c'est précisément ce que la personne doit
 * vérifier : le consentement porte sur un numéro précis, pas sur « mon
 * téléphone ». Un numéro non reconnu doit sauter aux yeux.
 */
export const maskForDisplay = (phone: string | null | undefined): string =>
  String(phone ?? '').trim();
