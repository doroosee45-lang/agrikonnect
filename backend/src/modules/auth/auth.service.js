/**
 * Exigences CDC couvertes : AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, NFR-01.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { generateOtp, generateToken, sha256 } from '../../shared/crypto.js';
import { sendSms, otpMessage } from '../../integrations/sms.js';
import { validateE164 } from '../../integrations/twilio.js';
import { sendOtpSms } from '../smsDelivery/smsDelivery.service.js';
// Liens web centralisés : voir `src/shared/links.js` pour le tableau des
// chemins et le test qui les confronte aux routes réelles du client.
import { lienMotDePasseOublie, lienVerificationEmail } from '../../shared/links.js';
import { audit } from '../../shared/audit.js';
import { logger } from '../../shared/http/logger.js';

const isEmail = (value) => String(value).includes('@');

/**
 * AUTH-01 — correspondance type de compte → type d'organisation (tenant).
 * Une coopérative a son propre tenant ; les autres acteurs commerciaux et les
 * investisseurs opèrent dans une organisation de type COMPANY.
 */
export const ORGANIZATION_TYPE_BY_ACCOUNT = {
  FARMER: 'INDIVIDUAL',
  COOPERATIVE_ADMIN: 'COOPERATIVE',
  AGRICULTURAL_COMPANY: 'COMPANY',
  SUPPORT_AGENT: 'INDIVIDUAL',
  BUYER: 'COMPANY',
  SUPPLIER: 'COMPANY',
  TRANSPORTER: 'COMPANY',
  AGRONOMIST: 'INDIVIDUAL',
  INVESTOR: 'COMPANY',
};

/** Sérialise un utilisateur pour l'API (jamais de hash ni de donnée interne). */
export const publicUser = (profile, memberships = []) => ({
  id: profile.id,
  email: profile.email,
  phone: profile.phone,
  firstName: profile.firstName,
  lastName: profile.lastName,
  whatsapp: profile.whatsapp,
  locale: profile.locale,
  countryCode: profile.countryCode,
  status: profile.status,
  avatarUrl: profile.avatarUrl,
  emailVerified: Boolean(profile.emailVerifiedAt),
  phoneVerified: Boolean(profile.phoneVerifiedAt),
  organizations: memberships.map((m) => ({
    id: m.organization.id,
    type: m.organization.type,
    name: m.organization.name,
    slug: m.organization.slug,
    roles: m.roles,
  })),
});

/**
 * AUTH-01 / AUTH-06 — Inscription.
 * Crée : utilisateur Supabase Auth → profil applicatif → organisation
 * individuelle (tenant, CDC D2) → appartenance avec rôle.
 * En cas d'échec après création Supabase, on compense pour ne pas laisser
 * de compte orphelin.
 */
export const register = async (payload, req) => {
  const {
    accountType, firstName, lastName, email, phone, password,
    locale, countryCode, whatsapp, cooperativeName, consentReference,
  } = payload;

  // 1. Création de l'utilisateur côté Supabase (source de vérité pour l'auth)
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    phone,
    password,
    email_confirm: false,
    phone_confirm: false,
    user_metadata: { firstName, lastName, locale, countryCode },
  });

  if (created.error || !created.data?.user) {
    const message = created.error?.message ?? 'Création du compte impossible';
    if (/already|exists|registered/i.test(message)) {
      throw ApiError.conflict('Un compte existe déjà avec cet email ou ce téléphone');
    }
    throw ApiError.badRequest(message);
  }

  const authUser = created.data.user;

  try {
    // 2. Profil + organisation + appartenance (transaction atomique)
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          id: authUser.id,
          email: email ?? `${String(phone).replace(/\+/g, '')}@phone.agrikonnect.local`,
          phone: phone ?? null,
          firstName,
          lastName,
          whatsapp: whatsapp ?? null,
          locale,
          countryCode,
        },
      });

      const organization = await tx.organization.create({
        data: {
          id: resolveId(),
          type: ORGANIZATION_TYPE_BY_ACCOUNT[accountType] ?? 'INDIVIDUAL',
          name:
            accountType === 'COOPERATIVE_ADMIN' && cooperativeName
              ? cooperativeName
              : `${firstName} ${lastName}`,
          countryCode,
          createdBy: profile.id,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: profile.id,
          organizationId: organization.id,
          roles: [accountType],
          status: 'ACTIVE',
          createdBy: profile.id,
        },
      });

      // COOP-01 : la coopérative est créée en même temps que son organisation
      if (accountType === 'COOPERATIVE_ADMIN') {
        await tx.cooperative.create({
          data: {
            id: resolveId(),
            organizationId: organization.id,
            description: null,
          },
        });
      }

      return { profile, organization, membership };
    });

    // 3. Traçabilité du consentement pour l'inscription assistée (AUTH-07)
    if (consentReference) {
      await prisma.token.create({
        data: {
          userId: authUser.id,
          identifier: consentReference,
          tokenHash: sha256(generateToken()),
          purpose: 'AGENT_CONSENT',
          expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          metadata: { agentId: req?.user?.id ?? null },
        },
      });
    }

    await audit({
      actorId: authUser.id,
      action: 'auth.register',
      resource: 'profiles',
      resourceId: authUser.id,
      req,
      newValue: { accountType, countryCode, organizationId: result.organization.id },
    });

    // 4. Session immédiate si l'email est fourni (sinon vérification requise)
    let session = null;
    if (email) {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      session = signIn.data?.session ?? null;
    }

    return {
      user: publicUser(result.profile, [{ ...result.membership, organization: result.organization }]),
      organization: {
        id: result.organization.id,
        type: result.organization.type,
        name: result.organization.name,
      },
      session: session
        ? {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresIn: session.expires_in,
          }
        : null,
      nextSteps: email ? ['verify-email', 'verify-phone'] : ['verify-phone'],
    };
  } catch (error) {
    // Compensation : on ne laisse pas un utilisateur Supabase sans profil.
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
    if (error instanceof ApiError) throw error;
    logger.error('Échec de création du profil après inscription :', error);
    throw ApiError.internal('Inscription impossible, réessaie dans un instant');
  }
};

/** AUTH-02 — Connexion par email ou téléphone + mot de passe. */
export const login = async ({ identifier, password, mfaCode }, req) => {
  const credentials = isEmail(identifier) ? { email: identifier } : { phone: identifier };

  // Anti brute force (CDC AUTH-02 : 5 échecs → blocage temporaire)
  const existing = await prisma.profile.findFirst({
    where: isEmail(identifier) ? { email: identifier } : { phone: identifier },
    select: { id: true, lockedUntil: true, failedLoginAttempts: true, status: true },
  });

  if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
    const minutes = Math.ceil((existing.lockedUntil.getTime() - Date.now()) / 60000);
    throw ApiError.tooManyRequests(
      `Trop de tentatives. Réessaie dans ${minutes} minute(s) ou réinitialise ton mot de passe.`,
    );
  }

  if (existing?.status && existing.status !== 'ACTIVE') {
    throw ApiError.forbidden('Compte suspendu. Contacte le support.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ ...credentials, password });

  if (error || !data?.session) {
    if (existing) {
      const attempts = existing.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.LOGIN_MAX_ATTEMPTS;
      await prisma.profile.update({
        where: { id: existing.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60000) : null,
        },
      });
      await audit({
        actorId: existing.id,
        action: shouldLock ? 'auth.login.locked' : 'auth.login.failed',
        resource: 'profiles',
        resourceId: existing.id,
        req,
      });
    }
    throw ApiError.unauthorized('Identifiants incorrects');
  }

  const userId = data.user.id;

  // NFR-01 — la MFA n'est pas décorative : sans second facteur valide, aucune
  // session n'est délivrée (le mot de passe seul ne suffit plus).
  const enrolled = await prisma.mfaSecret.findUnique({ where: { userId } });
  if (enrolled?.confirmedAt) {
    if (!mfaCode) {
      throw ApiError.unauthorized('Code de double authentification requis', {
        mfaRequired: true,
        method: enrolled.method ?? 'TOTP',
      });
    }
    const { assertMfa } = await import('./mfa.service.js');
    try {
      await assertMfa(userId, mfaCode);
    } catch (mfaError) {
      // Un code faux est comptabilisé comme un échec de connexion (anti-force brute).
      const attempts = (existing?.failedLoginAttempts ?? 0) + 1;
      const shouldLock = attempts >= env.LOGIN_MAX_ATTEMPTS;
      await prisma.profile.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60000) : null,
        },
      });
      await audit({
        actorId: userId,
        action: 'auth.login.mfa_failed',
        resource: 'profiles',
        resourceId: userId,
        req,
      });
      throw mfaError;
    }
  }

  const profile = await prisma.profile.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { organization: { select: { id: true, type: true, name: true, slug: true } } },
      },
    },
  });

  await audit({
    actorId: userId,
    action: 'auth.login',
    resource: 'profiles',
    resourceId: userId,
    req,
  });

  return {
    user: publicUser(profile, profile.memberships),
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      tokenType: data.session.token_type,
    },
  };
};

/** AUTH-05 — Rafraîchissement du jeton d'accès (refresh rotatif géré par Supabase). */
export const refresh = async ({ refreshToken }) => {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) throw ApiError.unauthorized('Session expirée, reconnecte-toi');

  return {
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    },
  };
};

/** AUTH-05 — Déconnexion et révocation de la session. */
export const logout = async (accessToken) => {
  const { error } = await supabase.auth.admin.signOut(accessToken);
  if (error) logger.warn('Déconnexion Supabase :', error.message);
  return { success: true };
};

// ─────────────────────────────────────────────────────────────
// AUTH-03 — Vérification du téléphone par OTP
// ─────────────────────────────────────────────────────────────

export const sendPhoneOtp = async (req) => {
  const brut = req.body.phone ?? req.user?.phone;
  if (!brut) throw ApiError.badRequest('Numéro de téléphone requis');

  /*
   * Format E.164 vérifié **avant** tout envoi.
   *
   * Sans ce contrôle, un numéro mal formé part chez le fournisseur, qui le
   * refuse et **facture** la tentative. Vérifier côté serveur coûte rien ;
   * `validateE164` existe déjà dans `integrations/twilio.js`, il n'était
   * simplement pas appelé sur ce chemin.
   */
  const phone = String(brut).trim();
  if (!validateE164(phone)) {
    throw ApiError.badRequest(
      'Numéro de téléphone invalide : le format E.164 est attendu '
      + '(« + » suivi de l’indicatif pays puis du numéro, par exemple +243810000000).',
    );
  }

  /*
   * Double plafond : par numéro **et** par utilisateur.
   *
   * Le plafond par numéro seul ne borne rien contre un compte qui demande des
   * codes vers des numéros différents : cinq envois par heure et par numéro,
   * multipliés par autant de numéros que voulu. Le plafond par utilisateur
   * borne ce que **son propre compte** peut coûter.
   */
  const depuis = new Date(Date.now() - 3600 * 1000);
  const sent = await prisma.otpCode.count({
    where: { identifier: phone, purpose: 'PHONE_VERIFICATION', createdAt: { gte: depuis } },
  });
  if (sent >= env.OTP_MAX_SENDS_PER_HOUR) {
    throw ApiError.tooManyRequests('Trop de codes envoyés. Réessaie dans une heure.');
  }
  if (req.user?.id) {
    const parUtilisateur = await prisma.otpCode.count({
      where: { userId: req.user.id, purpose: 'PHONE_VERIFICATION', createdAt: { gte: depuis } },
    });
    if (parUtilisateur >= env.OTP_MAX_SENDS_PER_HOUR) {
      throw ApiError.tooManyRequests('Trop de codes envoyés depuis ce compte. Réessaie dans une heure.');
    }
  }

  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      identifier: phone,
      userId: req.user?.id ?? null,
      codeHash: sha256(code),
      purpose: 'PHONE_VERIFICATION',
      expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60000),
    },
  });

  /*
   * Le code passe par le même chemin que les alertes : enregistrement dans
   * `sms_messages`, plafond quotidien, suivi de remise. Avant, il partait par
   * `sendSms()` directement et échappait au journal — pour le message le plus
   * sensible de l'application, celui qui ouvre un compte.
   *
   * Ce qui **ne change pas** : la durée de vie (`OTP_TTL_MINUTES`), le nombre
   * de tentatives et le plafond horaire vérifié plus haut
   * (`OTP_MAX_SENDS_PER_HOUR`). Rien ici n'y touche.
   */
  const membership = await prisma.membership.findFirst({
    where: { userId: req.user?.id ?? null },
    select: { organizationId: true },
  });
  const corps = otpMessage(code, env.OTP_TTL_MINUTES);
  // `envoi` et non `sent` : ce nom est déjà pris plus haut par le compteur
  // horaire, dans cette même fonction.
  let envoi;
  if (membership?.organizationId) {
    envoi = await sendOtpSms({
      organizationId: membership.organizationId,
      userId: req.user?.id ?? null,
      phone,
      body: corps,
    });
  } else {
    /*
     * Sans organisation, la ligne de journal n'a pas de locataire à porter.
     * On envoie quand même — refuser un code de vérification bloquerait
     * l'accès au compte — mais on le dit au lieu de le taire. Limitation
     * écrite dans `docs/PERIMETRE-BACKEND.md`.
     */
    logger.warn('[OTP] aucun locataire résolu : envoi hors journal');
    envoi = await sendSms(phone, corps);
  }

  return {
    sent: envoi?.sent === true,
    ...(envoi?.skipReason ? { skipReason: envoi.skipReason } : {}),
    expiresInMinutes: env.OTP_TTL_MINUTES,
    // En développement uniquement : facilite les tests sans agrégateur SMS.
    devCode: env.isProd ? undefined : code,
  };
};

export const verifyPhone = async ({ phone, code }, req) => {
  const brut = phone ?? req.user?.phone;
  if (!brut) throw ApiError.badRequest('Numéro de téléphone requis');
  const target = String(brut).trim();

  /*
   * Le numéro confirmé doit être **celui du profil concerné**.
   *
   * Sans ce contrôle, un compte déjà pourvu d'un numéro pouvait en faire
   * confirmer un autre : la vérification perd son sens, puisqu'elle ne prouve
   * plus que le numéro **du profil** appartient à son titulaire. Un changement
   * de numéro passe par la mise à jour du profil d'abord, puis par une nouvelle
   * vérification — dans cet ordre.
   */
  if (req.user?.id) {
    const profil = await prisma.profile.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });
    if (profil?.phone && profil.phone !== target) {
      throw ApiError.badRequest(
        'Le code ne correspond pas au numéro du profil. Mets à jour ton numéro '
        + 'avant de le vérifier.',
      );
    }
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      identifier: target,
      purpose: 'PHONE_VERIFICATION',
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) throw ApiError.badRequest('Code expiré ou introuvable. Demande un nouveau code.');
  if (otp.attempts >= 5) throw ApiError.tooManyRequests('Trop d\'essais. Demande un nouveau code.');
  if (otp.codeHash !== sha256(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw ApiError.badRequest('Code invalide');
  }

  /*
   * `phone` est unique en base : si le numéro appartient déjà à un autre
   * profil, `profile.update` lèverait une contrainte d'unicité, qui remonterait
   * en 500. C'est une situation attendue — deux comptes ne peuvent pas
   * partager un numéro — et elle mérite une réponse lisible.
   */
  if (req.user) {
    const dejaPris = await prisma.profile.findFirst({
      where: { phone: target, id: { not: req.user.id } },
      select: { id: true },
    });
    if (dejaPris) {
      throw ApiError.conflict('Ce numéro est déjà rattaché à un autre compte.');
    }
  }

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    req.user
      ? prisma.profile.update({
          where: { id: req.user.id },
          data: { phone: target, phoneVerifiedAt: new Date() },
        })
      : prisma.profile.updateMany({ where: { phone: target }, data: { phoneVerifiedAt: new Date() } }),
  ]);

  await audit({
    actorId: req.user?.id ?? null,
    action: 'auth.phone.verified',
    resource: 'profiles',
    resourceId: req.user?.id ?? null,
    req,
  });

  return { verified: true };
};

// ─────────────────────────────────────────────────────────────
// AUTH-03 — Vérification de l'email
// ─────────────────────────────────────────────────────────────

export const resendEmailVerification = async (email) => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: lienVerificationEmail() },
  });
  if (error) throw ApiError.badRequest(error.message);
  return { sent: true };
};

export const verifyEmail = async ({ tokenHash }, req) => {
  const { data, error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  if (error || !data?.user) throw ApiError.badRequest('Lien de vérification invalide ou expiré');

  await prisma.profile.updateMany({
    where: { id: data.user.id },
    data: { emailVerifiedAt: new Date() },
  });

  await audit({
    actorId: data.user.id,
    action: 'auth.email.verified',
    resource: 'profiles',
    resourceId: data.user.id,
    req,
  });

  return { verified: true };
};

// ─────────────────────────────────────────────────────────────
// AUTH-04 — Mot de passe oublié / réinitialisation
// ─────────────────────────────────────────────────────────────

export const forgotPassword = async (email) => {
  const profile = await prisma.profile.findUnique({ where: { email } });

  // Réponse identique dans tous les cas : pas d'énumération de comptes (§13.1)
  if (profile) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: lienMotDePasseOublie(),
    });
    if (error) logger.warn('Envoi du lien de réinitialisation :', error.message);

    // L'e-mail de récupération est envoyé exclusivement par Supabase Auth
    // (source de vérité des e-mails d'authentification) : aucun envoi
    // Resend en double — décision audit e-mails 2026-11-04.
  }

  return { sent: true };
};

export const resetPassword = async ({ tokenHash, password }, req) => {
  const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error || !data?.user) throw ApiError.badRequest('Lien de réinitialisation invalide ou expiré');

  const updated = await supabaseAdmin.auth.admin.updateUserById(data.user.id, { password });
  if (updated.error) throw ApiError.badRequest(updated.error.message);

  await prisma.profile.update({
    where: { id: data.user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await audit({
    actorId: data.user.id,
    action: 'auth.password.reset',
    resource: 'profiles',
    resourceId: data.user.id,
    req,
  });

  return { reset: true };
};

/**
 * Crée le profil applicatif d'un utilisateur Supabase existant mais inconnu
 * de la base (ex. inscription faite directement depuis le client Supabase).
 */
export const syncProfile = async (req) => {
  const authUser = req.user;
  if (!authUser?.needsSync) throw ApiError.conflict('Profil déjà synchronisé');

  const { data } = await supabase.auth.getUser(req.token);
  const metadata = data?.user?.user_metadata ?? {};

  const countryCode = String(metadata.countryCode ?? 'CD').toUpperCase().slice(0, 2);

  const created = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.create({
      data: {
        id: authUser.id,
        email: authUser.email ?? `${authUser.id}@phone.agrikonnect.local`,
        phone: authUser.phone ?? null,
        firstName: metadata.firstName ?? null,
        lastName: metadata.lastName ?? null,
        locale: metadata.locale ?? 'fr',
        countryCode,
      },
    });

    const organization = await tx.organization.create({
      data: {
        id: resolveId(),
        type: 'INDIVIDUAL',
        name: [metadata.firstName, metadata.lastName].filter(Boolean).join(' ') || 'Mon exploitation',
        countryCode,
        createdBy: profile.id,
      },
    });

    await tx.membership.create({
      data: {
        userId: profile.id,
        organizationId: organization.id,
        roles: ['FARMER'],
        status: 'ACTIVE',
        createdBy: profile.id,
      },
    });

    return { profile, organization };
  });

  return {
    user: publicUser(created.profile, []),
    organization: { id: created.organization.id, type: created.organization.type, name: created.organization.name },
  };
};
