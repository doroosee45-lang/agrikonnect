import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';

/**
 * Abstraction fournisseur e-mail (CDC D9 / A.4).
 *
 * Développement : fournisseur `console`. Production : Resend ou SendGrid.
 *
 * ## Ce que ce fichier faisait avant, et pourquoi ça a changé
 *
 * `resend` et `sendgrid` étaient des **brouillons** : ils journalisaient
 * « Intégration à compléter » et renvoyaient `delivered: false` sans jamais
 * appeler l'API. Ajouter une commande qui vérifie la clé d'un fournisseur
 * incapable d'envoyer aurait été trompeur — la clé serait validée et l'e-mail de
 * vérification ne partirait toujours pas. Les deux envois sont donc réels.
 *
 * ## Ce que `delivered` signifie ici
 *
 * Pour Resend et SendGrid, une réponse 2xx signifie **accepté par le
 * fournisseur**, pas remis dans la boîte de réception. `delivered` reste donc
 * `false` : affirmer la remise serait mentir sur ce que l'on sait, exactement
 * comme pour Twilio qui répond `queued` à la soumission.
 */

/**
 * Construit l'URL d'un fournisseur en retirant le slash final.
 *
 * @param {string} base
 * @param {string} chemin
 */
const url = (base, chemin) => `${String(base).replace(/\/+$/, '')}${chemin}`;

/** Délai maximal d'un appel fournisseur. */
const signal = () => AbortSignal.timeout(env.EMAIL_REQUEST_TIMEOUT_MS);

const providers = {
  console: async ({ to, subject, text }) => {
    logger.info(`[EMAIL:console] → ${to} | ${subject}\n${text}`);
    return { provider: 'console', delivered: true };
  },

  /** Fournisseur générique par webhook (passerelle interne, recette). */
  webhook: async ({ to, subject, text, html }) => {
    if (!env.EMAIL_WEBHOOK_URL) throw new Error('EMAIL_WEBHOOK_URL manquant pour le fournisseur webhook');
    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html }),
      signal: signal(),
    });
    if (!response.ok) throw new Error(`Passerelle email : HTTP ${response.status}`);
    const receipt = await response.json().catch(() => ({}));
    return { provider: 'webhook', delivered: true, receipt };
  },

  /**
   * Resend — `POST /emails`.
   *
   * L'API attend `to` sous forme de **tableau** et renvoie `{ id }`. Un domaine
   * non vérifié est refusé en 403 : le message d'erreur le dit, parce que c'est
   * la faute de configuration la plus fréquente et que le corps brut de Resend
   * ne la nomme pas clairement.
   */
  resend: async ({ to, subject, text, html }) => {
    if (!env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY manquant pour Resend');

    const response = await fetch(url(env.RESEND_API_BASE_URL, '/emails'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.EMAIL_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
      }),
      signal: signal(),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const erreur = new Error(
        `Resend a refusé l'envoi : HTTP ${response.status} — `
        + `${payload.message ?? payload.error ?? 'raison inconnue'}`,
      );
      erreur.code = payload.code ?? payload.statusCode ?? `HTTP_${response.status}`;
      if (response.status === 403) {
        erreur.message += (
          ' Cause probable : le domaine de EMAIL_FROM n’est pas vérifié chez Resend.'
          + ' Action : ajoute et vérifie le domaine dans « Domains », puis aligne EMAIL_FROM.'
        );
      }
      throw erreur;
    }

    logger.info(`[EMAIL:resend] accepté — identifiant ${payload.id ?? '(aucun)'}`);
    return {
      provider: 'resend',
      providerMessageId: payload.id ?? null,
      /** Accepté par le fournisseur ≠ remis dans la boîte de réception. */
      delivered: false,
    };
  },

  /**
   * SendGrid — `POST /v3/mail/send`.
   *
   * SendGrid répond **202 sans corps** en cas de succès : il n'y a donc ni
   * identifiant de message ni confirmation de remise à lire, et c'est ce que ce
   * fournisseur donne. Toute autre réponse porte un tableau `errors`.
   */
  sendgrid: async ({ to, subject, text, html }) => {
    if (!env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY manquant pour SendGrid');

    const contenu = [];
    if (text) contenu.push({ type: 'text/plain', value: text });
    if (html) contenu.push({ type: 'text/html', value: html });
    if (contenu.length === 0) throw new Error('SendGrid exige au moins un corps de message');

    const response = await fetch(url(env.SENDGRID_API_BASE_URL, '/v3/mail/send'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.EMAIL_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.EMAIL_FROM },
        subject,
        content: contenu,
      }),
      signal: signal(),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = Array.isArray(payload.errors)
        ? payload.errors.map((e) => e.message).join(' ; ')
        : 'raison inconnue';
      const erreur = new Error(`SendGrid a refusé l'envoi : HTTP ${response.status} — ${detail}`);
      erreur.code = `HTTP_${response.status}`;
      if (response.status === 401 || response.status === 403) {
        erreur.message += (
          ' Cause probable : EMAIL_API_KEY invalide, ou domaine expéditeur non vérifié.'
          + ' Action : vérifie la clé et le « Sender Authentication » chez SendGrid.'
        );
      }
      throw erreur;
    }

    /*
     * 202 sans corps : aucun identifiant à conserver. On ne fabrique pas un
     * identifiant vide, et on ne prétend pas à une remise.
     */
    logger.info('[EMAIL:sendgrid] accepté (HTTP 202, aucun identifiant renvoyé)');
    return { provider: 'sendgrid', providerMessageId: null, delivered: false };
  },
};

/**
 * Envoie un e-mail.
 *
 * Un échec **ne casse pas le parcours** : il est journalisé et renvoyé sous
 * forme de résultat, comme pour les SMS. Bloquer une inscription sur une panne
 * de fournisseur e-mail serait pire que de laisser l'utilisateur redemander un
 * lien de vérification.
 */
export const sendEmail = async ({ to, subject, text, html = null }) => {
  const provider = providers[env.EMAIL_PROVIDER] ?? providers.console;
  try {
    return await provider({ to, subject, text, html });
  } catch (error) {
    logger.error(`[EMAIL] échec d'envoi vers ${to} :`, error.message);
    return {
      provider: env.EMAIL_PROVIDER,
      delivered: false,
      code: error.code != null ? String(error.code) : null,
      error: error.message,
    };
  }
};

export const templates = {
  // RESERVE SUPABASE — les e-mails d'authentification (confirmation
  // d'inscription, vérification, réinitialisation, magic link) partent
  // exclusivement via Supabase Auth. Les deux gabarits ci-dessous ne
  // servent que de référence de contenu : ne JAMAIS les envoyer par
  // sendEmail (doublons interdits — audit e-mails 2026-11-04).
  emailVerification: (link) => ({
    subject: 'AGRIKONNECT — Confirme ton adresse email',
    text: `Bienvenue sur AGRIKONNECT AFRICA.\n\nConfirme ton adresse email en ouvrant ce lien :\n${link}\n\nCe lien expire dans 24 heures.`,
  }),
  passwordReset: (link) => ({
    subject: 'AGRIKONNECT — Réinitialisation de ton mot de passe',
    text: `Tu as demandé la réinitialisation de ton mot de passe.\n\nOuvre ce lien :\n${link}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email.`,
  }),
  verificationDecision: ({ approved, reason }) => ({
    subject: approved
      ? 'AGRIKONNECT — Ton profil est vérifié'
      : 'AGRIKONNECT — Ta demande de vérification a été examinée',
    text: approved
      ? 'Ta demande de vérification a été approuvée. Le statut est désormais visible sur ton profil public.'
      : `Ta demande de vérification n'a pas pu être acceptée.\nMotif : ${reason ?? 'non précisé'}\n\nTu peux soumettre de nouveaux documents depuis ton espace.`,
  }),
};

/**
 * Paramètres du canal, pour l'observabilité.
 *
 * **Aucune clé** n'apparaît ici : `EMAIL_API_KEY` n'est jamais renvoyé, seulement
 * le fait qu'il est renseigné.
 */
export const emailSettings = () => ({
  provider: env.EMAIL_PROVIDER,
  from: env.EMAIL_FROM,
  apiKeyConfigured: Boolean(env.EMAIL_API_KEY),
  webhookConfigured: Boolean(env.EMAIL_WEBHOOK_URL),
  verifiedDomains: String(env.EMAIL_VERIFIED_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean),
});
