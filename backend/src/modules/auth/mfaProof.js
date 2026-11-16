/**
 * Audit C-03 — preuve de second facteur LIÉE À LA SESSION.
 *
 * Problème corrigé : la MFA n'était contrôlée qu'à `POST /auth/login`. Un jeton
 * Supabase obtenu directement auprès de Supabase Auth (clé publique + mot de
 * passe, sans passer par l'API) était accepté partout, y compris sur les routes
 * de gouvernance : `requireMfa` ne regardait que le drapeau `mfaEnabled` du
 * profil, pas la session.
 *
 * Correction : après un code TOTP (ou de secours) valide, l'API délivre une
 * preuve signée par elle seule (HMAC-SHA256), liée à :
 *   - l'utilisateur (`sub`) ;
 *   - la session Supabase (`session_id` du JWT, stable au rafraîchissement) ;
 *   - une échéance.
 * Le client la renvoie dans l'en-tête `X-MFA-Proof`. Une session ouverte
 * ailleurs a un autre `session_id` : sa preuve n'existe pas, l'accès est refusé.
 *
 * Aucune donnée stockée, aucune migration ; la clé dérive de
 * `MFA_ENCRYPTION_KEY` (obligatoire en production).
 */
import crypto from 'node:crypto';

import { env } from '../../config/env.js';
import { resolveEncryptionMaterial } from './mfa.service.js';

/** Durée de validité d'une preuve : une journée de travail (la session Supabase est plus courte au rafraîchissement près). */
export const DUREE_PREUVE_S = 12 * 3600;

const cleDePreuve = () =>
  crypto
    .createHash('sha256')
    .update('agrikonnect:mfa-proof:v1:')
    .update(
      String(
        resolveEncryptionMaterial({
          isProd: env.isProd,
          dedicatedKey: process.env.MFA_ENCRYPTION_KEY,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        }),
      ),
    )
    .digest();

const signer = (contenu) => crypto.createHmac('sha256', cleDePreuve()).update(contenu).digest('base64url');

/**
 * `session_id` du JWT d'accès Supabase. Le jeton a déjà été validé par
 * `supabase.auth.getUser` dans `authenticate` : on ne fait ici que lire la charge.
 */
export const sessionIdDuJeton = (jeton) => {
  try {
    const charge = JSON.parse(Buffer.from(String(jeton).split('.')[1], 'base64url').toString('utf8'));
    return typeof charge.session_id === 'string' && charge.session_id ? charge.session_id : null;
  } catch {
    return null;
  }
};

/** Délivre une preuve pour (utilisateur, session). `null` si la session est inconnue. */
export const emettrePreuveMfa = ({ userId, sessionId, maintenant = Date.now() }) => {
  if (!userId || !sessionId) return null;
  const echeance = Math.floor(maintenant / 1000) + DUREE_PREUVE_S;
  const contenu = `${userId}|${sessionId}|${echeance}`;
  return `${Buffer.from(contenu, 'utf8').toString('base64url')}.${signer(contenu)}`;
};

/** Vrai si la preuve est authentique, non expirée, et liée à CET utilisateur et CETTE session. */
export const verifierPreuveMfa = ({ preuve, userId, sessionId, maintenant = Date.now() }) => {
  if (!preuve || !userId || !sessionId) return false;
  const [contenuB64, signature] = String(preuve).split('.');
  if (!contenuB64 || !signature) return false;

  let contenu;
  try {
    contenu = Buffer.from(contenuB64, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const attendue = Buffer.from(signer(contenu));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return false;

  const [uid, sid, echeance] = contenu.split('|');
  if (uid !== userId || sid !== sessionId) return false;
  return Number(echeance) * 1000 > maintenant;
};

/** Preuve pour la session de la requête courante (après un code vérifié). */
export const preuvePourRequete = (req) =>
  emettrePreuveMfa({ userId: req.user?.id, sessionId: sessionIdDuJeton(req.token) });
