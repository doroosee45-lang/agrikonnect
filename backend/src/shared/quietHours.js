/**
 * Fenêtre de silence des SMS d'alerte.
 *
 * ## Pourquoi
 *
 * La recommandation de conformité Twilio pour la RDC impose des envois en
 * heures diurnes. Au-delà de la conformité, c'est du bon sens : une alerte
 * agronomique à 3 h du matin réveille sans informer — rien dans le cycle d'une
 * culture ne se joue à cette heure — et un canal qui réveille inutilement finit
 * par être ignoré, ou bloqué par l'opérateur.
 *
 * ## Le fuseau est celui du destinataire
 *
 * Un backend hébergé en Europe qui appliquerait son heure locale enverrait en
 * pleine nuit à Kinshasa. La conversion se fait donc **vers** le fuseau du
 * destinataire, pas depuis celui du serveur.
 *
 * ## Ce qui n'est pas concerné
 *
 * Les codes OTP ne passent pas par ce contrôle. Un code demandé par
 * l'utilisateur à 23 h doit arriver : le retenir bloquerait l'accès au compte
 * au nom d'une règle pensée pour les alertes non sollicitées.
 */

/** Convertit un instant en `HH:MM` dans le fuseau demandé. */
export const heureLocale = (date, fuseau) => {
  const instant = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`heureLocale : date invalide (${String(date)})`);
  }
  let parties;
  try {
    parties = new Intl.DateTimeFormat('en-GB', {
      timeZone: fuseau,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(instant);
  } catch {
    /*
     * Un fuseau inconnu est une erreur de configuration. Remonter l'erreur
     * plutôt que retomber sur l'heure du serveur : un repli silencieux
     * appliquerait la fenêtre au mauvais fuseau, et l'alerte partirait de nuit.
     */
    throw new Error(`Fuseau horaire inconnu : « ${fuseau} ».`);
  }
  const heure = Number(parties.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parties.find((p) => p.type === 'minute')?.value ?? '0');
  return { heure, minute, minutes: heure * 60 + minute, texte: `${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
};

/** `HH:MM` en minutes depuis minuit. */
export const enMinutes = (hhmm) => {
  const [heure, minute] = String(hhmm).split(':').map(Number);
  return heure * 60 + minute;
};

/**
 * Dit si un instant tombe dans la fenêtre de silence.
 *
 * @param {Date|string|number} date L'instant de l'envoi.
 * @param {{ debut: string, fin: string, fuseau: string }} fenetre
 * @returns {{ silencieux: boolean, heureLocale: string, fuseau: string, debut: string, fin: string }}
 *
 * Une fin antérieure au début traverse minuit (`21:00` → `06:00`), ce qui est
 * le cas normal. Début égal à fin signifie **aucune** fenêtre, pas « toute la
 * journée » : une fenêtre couvrant 24 h couperait le canal sans que personne ne
 * l'ait décidé explicitement.
 */
export const dansFenetreSilence = (date, { debut, fin, fuseau }) => {
  const locale = heureLocale(date, fuseau);
  const debutMinutes = enMinutes(debut);
  const finMinutes = enMinutes(fin);

  let silencieux;
  if (debutMinutes === finMinutes) {
    silencieux = false;
  } else if (debutMinutes < finMinutes) {
    // Fenêtre dans la même journée : 09:00 → 17:00.
    silencieux = locale.minutes >= debutMinutes && locale.minutes < finMinutes;
  } else {
    // Fenêtre qui traverse minuit : 21:00 → 06:00.
    silencieux = locale.minutes >= debutMinutes || locale.minutes < finMinutes;
  }

  return {
    silencieux,
    heureLocale: locale.texte,
    fuseau,
    debut,
    fin,
  };
};
