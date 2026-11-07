/**
 * Exigences CDC couvertes : I18N-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
/**
 * Erreur applicative typée : porte un statut HTTP, un code machine et
 * une liste d'erreurs par champ (CDC A.5).
 */
export class ApiError extends Error {
  constructor(status, message, { code = null, errors = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors; // [{ field, code }]
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Requête invalide', errors = null) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', errors });
  }

  /**
   * 401 — authentification absente ou invalide.
   *
   * `details` est **indispensable** ici, pas facultatif : c'est le seul canal
   * par lequel le serveur peut dire au client *pourquoi* l'authentification est
   * refusée. La connexion avec double authentification en dépend — elle renvoie
   * `{ mfaRequired: true, method }` pour que l'écran affiche un champ de code et
   * rejoue la connexion.
   *
   * Cette fabrique n'acceptait auparavant qu'un `message` : l'appel
   * `ApiError.unauthorized('…', { mfaRequired: true })` voyait son second
   * argument **silencieusement ignoré**. `details` restait vide, le client ne
   * voyait jamais `mfaRequired`, et un compte ayant activé la MFA ne pouvait
   * plus se connecter — ni sur le web, ni sur le mobile.
   */
  static unauthorized(message = 'Authentification requise', details = null) {
    return new ApiError(401, message, { code: 'UNAUTHORIZED', details });
  }

  /**
   * 403 — authentifié, mais sans le droit.
   *
   * Accepte `details` pour la même raison que `unauthorized` :
   * `mfa.service.js#assertMfa` s'en sert pour signaler `{ mfaRequired: true }`.
   * Une fabrique qui ignore silencieusement un argument qu'on lui passe est un
   * piège — l'appel a l'air de fonctionner, et le signal disparaît.
   */
  static forbidden(message = 'Accès refusé', details = null) {
    return new ApiError(403, message, { code: 'FORBIDDEN', details });
  }

  /** 404 volontaire pour les ressources non visibles (anti-énumération, CDC §13.1). */
  static notFound(message = 'Ressource introuvable') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Conflit de données', errors = null) {
    return new ApiError(409, message, { code: 'CONFLICT', errors });
  }

  /** 413 — corps ou fichier au-dessus de la limite acceptée. */
  static payloadTooLarge(message = 'Charge utile trop volumineuse') {
    return new ApiError(413, message, { code: 'PAYLOAD_TOO_LARGE' });
  }

  static tooManyRequests(message = 'Trop de requêtes, réessaie plus tard') {
    return new ApiError(429, message, { code: 'TOO_MANY_REQUESTS' });
  }

  static internal(message = 'Erreur interne du serveur') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR' });
  }

  static notImplemented(message = 'Fonctionnalité non disponible dans cette version') {
    return new ApiError(501, message, { code: 'NOT_IMPLEMENTED' });
  }
}
