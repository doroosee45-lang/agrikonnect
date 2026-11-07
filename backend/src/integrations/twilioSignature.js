/**
 * Validation de la signature des webhooks Twilio.
 *
 * ## Ce que Twilio signe
 *
 * D'après la documentation Twilio (« Secure webhooks », « Security », et l'erreur
 * 57012 « Signature invalid ») :
 *
 *  1. l'**URL exacte** appelée, schéma, hôte, port, chemin et chaîne de requête
 *     compris ;
 *  2. suivie, pour chaque paramètre POST **trié par clé**, de la concaténation
 *     `clé` + `valeur`, sans séparateur ;
 *  3. le tout signé **HMAC-SHA1** avec l'`AuthToken` du compte comme clé ;
 *  4. le résultat encodé en **Base64**, envoyé dans l'en-tête
 *     `X-Twilio-Signature`.
 *
 * Pour un corps **JSON**, Twilio n'envoie pas de paramètres de formulaire : il
 * ajoute à l'URL un paramètre `bodySHA256`, égal à la représentation
 * hexadécimale du SHA-256 du corps brut. La validation doit alors vérifier que
 * le hachage du corps reçu correspond, **et** que la signature couvre cette
 * URL.
 *
 * ## Deux pièges documentés, gérés ici
 *
 * - **L'URL fait partie du matériel signé.** Derrière un mandataire qui
 *   termine le TLS, `req.protocol` vaut `http` alors que Twilio a signé
 *   `https`. Un seul octet d'écart et aucune requête ne passe. La
 *   reconstruction de l'URL est donc centralisée (`webhookUrlFromRequest`) et
 *   honore `X-Forwarded-Proto` / `X-Forwarded-Host` ; l'URL attendue peut aussi
 *   être imposée par configuration, ce qui est plus sûr encore.
 * - **Le port par défaut.** La bibliothèque officielle Twilio accepte la
 *   signature calculée avec ou sans port explicite. Les deux variantes sont
 *   essayées ici pour la même raison.
 *
 * ## Avertissement de Twilio, et ce qu'on en fait
 *
 * Twilio recommande d'utiliser son SDK plutôt que d'implémenter soi-même la
 * validation, parce que le jeu de paramètres évolue sans préavis. Ce module
 * suit cette contrainte en **ne sélectionnant aucun paramètre** : tout ce qui
 * est reçu est signé. Ajouter un champ à un webhook ne peut donc pas casser la
 * validation. Si le SDK `twilio` est installé un jour, `validateTwilioSignature`
 * doit être remplacée par `twilio.validateRequest` — les tests de
 * `tests/twilioSignature.test.mjs` doivent alors continuer à passer tels quels.
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

/**
 * Signature attendue pour une URL et un jeu de paramètres.
 *
 * @param {string} authToken `TWILIO_AUTH_TOKEN` du compte.
 * @param {string} url URL exacte appelée par Twilio.
 * @param {Record<string, unknown>} params Paramètres reçus (formulaire ou
 *   `{ bodySHA256 }` pour un JSON).
 * @returns {string} Base64.
 */
export const expectedTwilioSignature = (authToken, url, params = {}) => {
  const entries = params ?? {};
  const signed =
    String(url) +
    Object.keys(entries)
      .sort()
      .map((key) => {
        const value = entries[key];
        /**
         * Une clé répétée arrive en tableau. Twilio n'en envoie pas pour les
         * accusés de remise SMS, mais un `String()` implicite sur un tableau
         * produirait une valeur jointe par des virgules : autant le dire
         * explicitement plutôt que dépendre d'une conversion par défaut.
         */
        return `${key}${Array.isArray(value) ? value.join(',') : value ?? ''}`;
      })
      .join('');

  return createHmac('sha1', String(authToken)).update(signed, 'utf8').digest('base64');
};

/**
 * Hachage du corps brut, tel que Twilio le place dans `bodySHA256`.
 *
 * **Hexadécimal**, et calculé sur les **octets reçus** : re-sérialiser un objet
 * JSON changerait l'ordre des clés ou les espaces, et le hachage ne
 * correspondrait plus. C'est pourquoi les routes doivent conserver le corps
 * brut.
 */
export const twilioBodySha256 = (rawBody) =>
  createHash('sha256')
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8'))
    .digest('hex');

/** Comparaison à temps constant, sans exception sur longueurs différentes. */
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
};

/**
 * Variantes d'URL essayées, pour absorber les ports par défaut.
 *
 * `https://h/p` et `https://h:443/p` désignent la même ressource ; Twilio peut
 * avoir signé l'une ou l'autre selon sa configuration.
 */
const urlVariants = (url) => {
  const value = String(url ?? '');
  const variants = [value];
  try {
    const parsed = new URL(value);
    const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };
    if (parsed.port) {
      const without = value.replace(`:${parsed.port}`, '');
      if (!variants.includes(without)) variants.push(without);
    } else if (DEFAULT_PORTS[parsed.protocol]) {
      const withPort = `${value.slice(0, value.indexOf('://') + 3)}${parsed.host}:${DEFAULT_PORTS[parsed.protocol]}${value.slice(value.indexOf('://') + 3 + parsed.host.length)}`;
      if (!variants.includes(withPort)) variants.push(withPort);
    }
  } catch {
    // Une URL non analysable reste comparée telle quelle.
  }
  return variants;
};

/**
 * Vérifie l'en-tête `X-Twilio-Signature` d'une requête de formulaire.
 *
 * @param {object} args
 * @param {string} args.authToken
 * @param {string} args.signature Valeur de l'en-tête.
 * @param {string} args.url URL exacte appelée.
 * @param {Record<string, unknown>} args.params Tous les paramètres reçus.
 * @returns {boolean}
 */
export const validateTwilioSignature = ({ authToken, signature, url, params = {} }) => {
  if (!authToken || !signature) return false;
  return urlVariants(url).some((variant) =>
    safeEqual(signature, expectedTwilioSignature(authToken, variant, params)),
  );
};

/**
 * Vérifie un webhook au corps JSON : hachage du corps **et** signature.
 *
 * Les deux vérifications sont nécessaires et indépendantes : la signature seule
 * prouverait l'origine mais pas l'intégrité du corps tel que reçu, et le
 * hachage seul ne prouverait rien sans signature.
 */
export const validateTwilioSignatureWithBody = ({
  authToken,
  signature,
  url,
  rawBody,
  bodySha256,
}) => {
  const expectedHash = twilioBodySha256(rawBody);
  if (!safeEqual(String(bodySha256 ?? '').toLowerCase(), expectedHash)) return false;
  // La signature couvre l'URL, qui porte déjà `bodySHA256` en paramètre de
  // requête : aucun paramètre de formulaire n'est ajouté.
  return validateTwilioSignature({ authToken, signature, url, params: {} });
};

/**
 * Reconstruit l'URL telle que Twilio l'a appelée.
 *
 * **Point de défaillance connu** : derrière un mandataire qui termine le TLS,
 * `req.protocol` vaut `http`. Sans honorer `X-Forwarded-Proto`, toutes les
 * validations échouent alors que tout va bien — le symptôme classique décrit
 * dans la documentation Twilio.
 *
 * @param {import('express').Request} req
 * @param {{ baseUrl?: string, trustProxyHeaders?: boolean }} [options]
 */
export const webhookUrlFromRequest = (req, { baseUrl, trustProxyHeaders = true } = {}) => {
  // Une URL imposée par configuration l'emporte : c'est la plus sûre, puisque
  // c'est exactement celle déclarée dans la console Twilio.
  if (baseUrl) {
    const configured = String(baseUrl).replace(/\/+$/, '');
    return `${configured}${req.originalUrl ?? req.url ?? ''}`;
  }

  const proto =
    (trustProxyHeaders && (req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim()) ||
    req.protocol ||
    'https';
  const host =
    (trustProxyHeaders && (req.headers['x-forwarded-host'] ?? '').split(',')[0].trim()) ||
    req.headers.host ||
    '';
  return `${proto}://${host}${req.originalUrl ?? req.url ?? ''}`;
};
