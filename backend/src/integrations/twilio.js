/**
 * Client Twilio — envoi de SMS et analyse de segmentation.
 *
 * ## Pourquoi un client maison plutôt que le SDK `twilio`
 *
 * Le SDK n'est pas installé, et l'ajouter pour un seul appel `POST` ferait
 * entrer une dépendance lourde (et ses dépendances) dans un projet qui n'en
 * compte que douze. L'appel utilisé ici est un formulaire `POST` authentifié en
 * Basic : rien que `fetch` ne fasse.
 *
 * **Une exception assumée** : Twilio recommande d'utiliser son SDK pour valider
 * la signature des webhooks plutôt que de réimplémenter le calcul. C'est fait
 * ici quand même (`twilioSignature.js`), parce que l'algorithme est court,
 * publié, et surtout **testé** dans `tests/twilioSignature.test.mjs` contre des
 * vecteurs construits indépendamment. Si le SDK est ajouté un jour, la fonction
 * de validation doit être remplacée par la sienne — c'est signalé dans le
 * fichier concerné.
 *
 * ## Secrets
 *
 * `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` ne viennent que de
 * l'environnement. Ils ne sont **jamais** journalisés, ni en clair, ni
 * partiellement : ce module ne passe l'en-tête `Authorization` à aucun logger,
 * et les erreurs sont reformulées sans le corps de requête.
 */
import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';

/** Version d'API REST Twilio utilisée pour l'envoi de messages. */
export const TWILIO_API_VERSION = '2010-04-01';

/**
 * Jeu de caractères GSM 03.38 (alphabet de base).
 *
 * Tout caractère **hors** de cet ensemble — et hors du jeu étendu — force
 * l'encodage UCS-2, qui divise par plus de deux le nombre de caractères par
 * segment. C'est le piège le plus coûteux du SMS : un seul caractère accenté
 * mal choisi fait passer un message d'un segment à deux, et double la facture.
 */
const GSM7_BASIC = new Set(
  [
    '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r',
    'Å', 'å', 'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', '\u001b',
    'Æ', 'æ', 'ß', 'É', ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*',
    '+', ',', '-', '.', '/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ':', ';', '<', '=', '>', '?', '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
    'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u',
    'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à',
  ],
);

/**
 * Jeu étendu GSM : préfixé par `ESC` (0x1B), donc **deux** unités par caractère.
 *
 * Le français en a besoin pour `à` (présent en base aussi), mais surtout pour
 * les guillemets typographiques et le `€`, fréquents dans un texte rédigé.
 */
const GSM7_EXTENDED = new Set([
  '^', '{', '}', '\\', '[', ']', '~', '|', '€', '\f',
]);

/**
 * Capacités de segmentation, en unités de l'encodage retenu.
 *
 * Les valeurs « multi-segments » sont plus basses : chaque morceau porte un
 * en-tête de concaténation (UDH), qui occupe de la place. Ce ne sont pas des
 * approximations mais les valeurs normalisées — et la page Twilio pour la RDC
 * précise que la concaténation est prise en charge, tout en avertissant que le
 * point de coupure **varie selon l'encodage**.
 */
export const SEGMENT_LIMITS = {
  GSM7: { single: 160, multi: 153 },
  UCS2: { single: 70, multi: 67 },
};

/**
 * Analyse un texte : encodage, unités, segments.
 *
 * @param {string} body
 * @returns {{ encoding: 'GSM7'|'UCS2', units: number, segments: number,
 *             characterCount: number, nonGsm7: string[] }}
 */
export const analyseMessage = (body) => {
  const text = String(body ?? '');
  const characterCount = [...text].length;

  /** Caractères hors GSM, pour diagnostics. On ne les devine pas, on les nomme. */
  const nonGsm7 = [];
  let units = 0;
  for (const char of text) {
    if (GSM7_BASIC.has(char)) units += 1;
    else if (GSM7_EXTENDED.has(char)) units += 2;
    else {
      units += 1; // compté en UCS-2 de toute façon
      if (!nonGsm7.includes(char)) nonGsm7.push(char);
    }
  }

  const encoding = nonGsm7.length === 0 ? 'GSM7' : 'UCS2';
  const limits = SEGMENT_LIMITS[encoding];
  const segments =
    units === 0 ? 1 : units <= limits.single ? 1 : Math.ceil(units / limits.multi);

  return { encoding, units, segments, characterCount, nonGsm7 };
};

/**
 * Substitutions vers le jeu GSM 03.38.
 *
 * **Deux catégories, traitées différemment.**
 *
 *  - Les **signes typographiques** ont un équivalent ASCII fidèle : le sens ne
 *    change pas. Ce sont ceux qu'un rédacteur introduit sans y penser, parce que
 *    son correcteur les insère automatiquement.
 *  - Les **lettres accentuées hors du jeu** (`ô`, `î`, `ï`, `ê`, `â`, `û`, `ë`,
 *    et `ç` minuscule) n'ont **pas** d'équivalent fidèle : les remplacer retire
 *    un accent, donc « contrôle » devient « controle ». C'est une **faute
 *    d'orthographe**, pas une translittération.
 *
 * D'où la règle : **rédiger les gabarits sans ces lettres**, et ne laisser cette
 * fonction intervenir que sur les valeurs qu'on ne contrôle pas — nom de
 * parcelle, libellé d'appareil, libellé de paramètre. Le test de gabarits
 * vérifie que le texte rédigé, lui, n'en contient aucune : ce filet ne doit
 * jamais servir à masquer un gabarit mal écrit.
 */
const GSM7_SUBSTITUTIONS = [
  // Signes typographiques : équivalent ASCII fidèle.
  ['\u2019', "'"], // ’ apostrophe typographique
  ['\u2018', "'"], // ‘
  ['\u201C', '"'], // “
  ['\u201D', '"'], // ”
  ['\u00AB', '"'], // «
  ['\u00BB', '"'], // »
  ['\u2014', '-'], // — tiret cadratin
  ['\u2013', '-'], // – tiret demi-cadratin
  ['\u2026', '...'], // … points de suspension
  /**
   * Le **degré** n'est pas au jeu GSM 03.38. Cela touche directement les alertes
   * de température, dont l'unité est `°C` : sans substitution, chaque alerte de
   * température basculerait en UCS-2. `degC` se lit sans ambiguïté.
   */
  ['\u00B0', 'deg'], // °
  ['\u0153', 'oe'], // œ
  ['\u0152', 'OE'], // Œ
  // Lettres accentuées hors du jeu : **l'accent est perdu**. Voir ci-dessus.
  ['\u00F4', 'o'], // ô
  ['\u00EE', 'i'], // î
  ['\u00EF', 'i'], // ï
  ['\u00EA', 'e'], // ê
  ['\u00E2', 'a'], // â
  ['\u00FB', 'u'], // û
  ['\u00EB', 'e'], // ë
  ['\u00E7', 'c'], // ç minuscule (le « Ç » majuscule, lui, est au jeu)
];

/**
 * Ramène un texte au jeu GSM 03.38.
 *
 * À appliquer aux **valeurs dynamiques** (nom de parcelle, libellé d'appareil)
 * avant de composer un SMS : ces textes viennent de l'utilisateur ou d'une table
 * de libellés, et un seul `’` y ferait basculer tout le message en UCS-2 — donc
 * doublerait son coût et changerait sa coupure.
 *
 * @param {string} text
 * @returns {string}
 */
export const toGsm7 = (text) => {
  let out = String(text ?? '');
  for (const [from, to] of GSM7_SUBSTITUTIONS) {
    out = out.split(from).join(to);
  }
  return out;
};

/**
 * Tronque à un budget de caractères, sans couper un mot si possible.
 *
 * Un SMS tient dans un segment ou n'y tient pas : il n'y a pas de « presque ».
 * Tronquer un nom de parcelle de 40 caractères est un moindre mal face à un
 * message facturé deux segments — et le point final signale la troncature au
 * lieu de laisser un mot coupé en deux.
 *
 * @param {string} text
 * @param {number} max
 */
export const truncateForSms = (text, max) => {
  const value = toGsm7(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, Math.max(max - 1, 1));
  // Revenir au dernier espace : couper « Parcelle expérimentale » en « Parcelle
  // exp » se lit mieux qu'en « Parcelle expé ».
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}.`;
};

/**
 * Un texte dépasse-t-il ce qu'un seul segment peut porter ?
 *
 * Utile en amont de l'envoi : un message d'alerte qui bascule en UCS-2 coûte
 * plus cher et peut être coupé différemment selon l'opérateur.
 */
export const fitsSingleSegment = (body) => analyseMessage(body).segments === 1;

/**
 * Identifiant d'expéditeur alphanumérique : règles Twilio.
 *
 * Contraintes vérifiées dans la documentation Twilio :
 *  - **11 caractères au plus** ;
 *  - lettres ASCII majuscules et minuscules, chiffres, espaces ;
 *  - **au moins une lettre** — un identifiant uniquement numérique est refusé ;
 *  - quelques symboles tolérés (`+ - _ &`), le point n'étant pas pris en charge
 *    partout.
 *
 * **Spécifique à la RDC** (page Twilio « Democratic Republic of the Congo: SMS
 * Guidelines », consultée le 2026-10-24) : les identifiant **génériques** —
 * `InfoSMS`, `INFO`, `Verify`, `Notify` — sont à éviter, et les identifiants
 * **numériques ne sont pas pris en charge par le réseau Airtel** : les messages
 * soumis avec un identifiant numérique vers ses abonnés ne sont pas remis.
 * Twilio y recommande explicitement l'alphanumérique.
 *
 * @param {string} senderId
 * @returns {{ valid: boolean, reasons: string[] }}
 */
/**
 * Validation de l'identifiant d'expéditeur.
 *
 * **Ré-exportée** depuis `shared/senderId.js`, où vit désormais la règle : la
 * validation de configuration au démarrage en a besoin, et importer ce fichier
 * depuis `config/env.js` aurait été circulaire (ce module importe `env`).
 * Le chemin d'import historique reste donc valable.
 */
import { validateSenderId, validateExpediteur } from '../shared/senderId.js';

export { validateSenderId, validateExpediteur };

/** Numéro E.164, tel que l'API Twilio l'exige pour `To`. */
export const validateE164 = (phone) => {
  const value = String(phone ?? '').trim();
  return /^\+[1-9]\d{6,14}$/.test(value);
};

/**
 * Construit l'URL d'envoi. Séparée pour que les tests puissent viser un faux
 * serveur sans toucher au reste.
 */
export const messagesUrl = (accountSid, baseUrl = env.TWILIO_API_BASE_URL) =>
  `${String(baseUrl).replace(/\/+$/, '')}/${TWILIO_API_VERSION}/Accounts/${accountSid}/Messages.json`;

/**
 * Envoie un SMS via l'API Twilio.
 *
 * @param {object} params
 * @param {string} params.to Numéro E.164.
 * @param {string} params.body Texte du message.
 * @param {string} [params.from] Identifiant d'expéditeur (défaut : env).
 * @param {string} [params.statusCallback] URL d'accusé de remise.
 * @returns {Promise<object>} `{ provider, providerMessageId, status, segments,
 *   encoding, characterCount, delivered }`
 */
export const sendTwilioSms = async ({ to, body, from, statusCallback } = {}) => {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;

  // Des secrets absents sont une erreur de configuration explicite, pas un
  // envoi silencieux vers nulle part.
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis pour le fournisseur twilio');
  }

  const senderId = from ?? env.TWILIO_SENDER_ID;
  /*
   * `validateExpediteur` et non `validateSenderId` : le champ `From` accepte un
   * identifiant alphanumérique **ou** un numéro E.164. Soumettre les deux au
   * même contrôle refusait systématiquement un numéro — donc rendait
   * `TWILIO_FALLBACK_FROM` inutilisable.
   */
  const senderCheck = validateExpediteur(senderId);
  if (!senderCheck.valid) {
    // On refuse avant l'appel : un expéditeur invalide serait rejeté par
    // Twilio, ou pire, accepté puis écrasé par l'opérateur.
    throw new Error(`Expéditeur refusé : ${senderCheck.reasons.join(' ; ')}`);
  }
  if (!validateE164(to)) {
    throw new Error(`Numéro invalide : attendu au format E.164 (ex. +243…)`);
  }

  const analysis = analyseMessage(body);
  const url = messagesUrl(accountSid);

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('From', senderId);
  form.set('Body', body);
  const callback = statusCallback ?? env.TWILIO_STATUS_CALLBACK_URL;
  if (callback) form.set('StatusCallback', callback);

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  /**
   * Aucun `logger.debug` de l'en-tête d'authentification, ni du corps. Le
   * numéro est tronqué dans les traces : il identifie une personne.
   */
  const maskedTo = `${to.slice(0, 4)}•••${to.slice(-2)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(env.TWILIO_REQUEST_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    /**
     * Twilio renvoie `{ code, message, status }`. Le `code` est conservé :
     * c'est lui qui distingue une configuration invalide (21211 : numéro
     * invalide), un identifiant non pré-inscrit (30018/30040) ou un destinataire
     * injoignable (21614 : fixe). Sans lui, tous ces cas se ressemblent.
     *
     * Le message Twilio est conservé mais **l'en-tête d'authentification ne
     * l'est jamais** : il ne fait pas partie du corps de réponse.
     */
    const error = new Error(
      `Twilio a refusé l'envoi vers ${maskedTo} : HTTP ${response.status} — ${payload.message ?? 'raison inconnue'}`,
    );
    error.code = payload.code != null ? String(payload.code) : `HTTP_${response.status}`;
    error.twilioStatus = payload.status ?? response.status;
    throw error;
  }

  const providerMessageId = payload.sid ?? null;
  logger.info(
    `[SMS:twilio] soumis vers ${maskedTo} — ${analysis.segments} segment(s) ${analysis.encoding}`
    + (analysis.segments > 1 ? ` (${analysis.characterCount} caractères)` : ''),
  );

  return {
    provider: 'twilio',
    providerMessageId,
    /**
     * État renvoyé par Twilio à la soumission : `queued`, `accepted`, …
     * **Ce n'est pas une remise.** Seul le webhook de statut peut dire
     * `delivered`. Renvoyer `delivered: true` ici serait affirmer une remise
     * que personne n'a constatée.
     */
    status: payload.status ?? 'queued',
    delivered: false,
    segments: analysis.segments,
    encoding: analysis.encoding,
    characterCount: analysis.characterCount,
    /** Caractères ayant forcé l'UCS-2 : à connaître avant de rédiger en masse. */
    nonGsm7: analysis.nonGsm7,
    url: payload.uri ?? null,
  };
};

/**
 * Lit l'état d'un message chez Twilio.
 *
 * Sert de repli quand un accusé de remise manque : sans ce moyen, un message
 * resterait indéfiniment « accepté » et l'on ne pourrait pas dire s'il a été
 * remis.
 */
export const fetchTwilioMessageStatus = async (providerMessageId) => {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis');
  }
  const base = String(env.TWILIO_API_BASE_URL).replace(/\/+$/, '');
  const response = await fetch(
    `${base}/${TWILIO_API_VERSION}/Accounts/${accountSid}/Messages/${encodeURIComponent(providerMessageId)}.json`,
    {
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(env.TWILIO_REQUEST_TIMEOUT_MS),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Twilio : HTTP ${response.status} pour ${providerMessageId}`);
    error.code = payload.code != null ? String(payload.code) : `HTTP_${response.status}`;
    throw error;
  }
  return {
    providerMessageId: payload.sid ?? providerMessageId,
    status: payload.status ?? null,
    errorCode: payload.errorCode != null ? String(payload.errorCode) : null,
    errorMessage: payload.errorMessage ?? null,
    segments: payload.numSegments != null ? Number(payload.numSegments) : null,
    direction: payload.direction ?? null,
    dateUpdated: payload.dateUpdated ?? null,
  };
};
