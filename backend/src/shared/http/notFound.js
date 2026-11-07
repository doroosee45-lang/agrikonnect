import { ApiError } from '../errors/ApiError.js';

/** Route inconnue → 404 JSON (et non la page HTML par défaut d'Express). */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
};
