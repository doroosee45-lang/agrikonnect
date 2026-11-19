import { emettrePreuveMfa } from '../../src/modules/auth/mfaProof.js';

/**
 * Audit H-05 / C-03 — investisseur « prêt » pour la data room, dans les tests
 * de service (Prisma simulé) :
 *   - profil investisseur vérifié par l'administration ;
 *   - double authentification RÉELLE active sur le compte ;
 *   - requête portée par une session qui a franchi le second facteur
 *     (jeton avec `session_id` + preuve `X-MFA-Proof` signée par l'API).
 */
export const jetonDeSession = (userId, sessionId) =>
  `entete.${Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId })).toString('base64url')}.signature`;

export const investisseurPret = (userId) => {
  const sessionId = `sess_${userId}`;
  return {
    investorProfile: { id: `ip_${userId}`, userId, verifiedAt: new Date(), mfaEnabled: true, preferences: {} },
    profile: { id: userId, mfaEnabled: true },
    requete: (req) => ({
      ...req,
      token: jetonDeSession(userId, sessionId),
      headers: { ...(req.headers ?? {}), 'x-mfa-proof': emettrePreuveMfa({ userId, sessionId }) },
    }),
  };
};
