import { randomUUID } from 'node:crypto';

/**
 * Identifiant de corrélation — NFR-11 (CDC §5.7 : logs structurés avec
 * identifiant de corrélation). Il est repris dans chaque réponse d'erreur pour
 * permettre à l'utilisateur de le communiquer au support.
 */
export const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.length <= 80 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
