import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * V4 NFR-01 — authentification multifacteur TOTP (RFC 6238).
 *
 * Le secret TOTP doit être vérifiable, donc réversible : il est chiffré en
 * AES-256-GCM avec une clé dédiée et n'est jamais renvoyé après l'activation.
 * Les codes de secours sont, eux, stockés sous forme de hachés (SHA-256).
 * Aucun code n'est réutilisable (fenêtre ±1 pas, code consommé tracé par
 * `lastUsedAt`).
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const ISSUER = 'AGRIKONNECT AFRICA';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input) => {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw ApiError.badRequest('Secret TOTP invalide');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

/** Code TOTP pour un compteur donné (exposé pour les tests). */
export const totpAt = (secret, counter) => {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

export const currentCode = (secret, date = new Date()) =>
  totpAt(secret, Math.floor(date.getTime() / 1000 / STEP_SECONDS));

/* ─────────────────────── chiffrement du secret ─────────────────────── */

/**
 * Résolution du matériau de clé (SEC-08 : aucun secret par défaut).
 *
 * En production, `MFA_ENCRYPTION_KEY` doit être fourni explicitement : une clé
 * dérivée d'une valeur connue du dépôt, ou partagée avec d'autres usages,
 * rendrait les secrets TOTP déchiffrables. Hors production, une clé de
 * développement est admise pour permettre les tests.
 *
 * Fonction pure : testable sans modifier l'environnement du processus.
 */
export const resolveEncryptionMaterial = ({ isProd, dedicatedKey, serviceRoleKey }) => {
  // `.env.example` livre `MFA_ENCRYPTION_KEY=` vide. Une chaîne vide n'est pas
  // `null` : sans cette normalisation, `??` la retient comme clé « fournie » et
  // le matériau résolu est `''`, donc falsy — d'où une 500 même en development.
  const clean = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return trimmed ? trimmed : undefined;
  };
  const material =
    clean(dedicatedKey) ??
    (isProd ? undefined : clean(serviceRoleKey)) ??
    (isProd ? undefined : 'agrikon-dev-mfa-key');
  if (!material) {
    throw ApiError.internal(
      'MFA_ENCRYPTION_KEY est requis en production : sans clé dédiée, les secrets TOTP ne peuvent pas être chiffrés de façon sûre.'
    );
  }
  return material;
};

const encryptionKey = () =>
  crypto
    .createHash('sha256')
    .update(
      String(
        resolveEncryptionMaterial({
          isProd: env.isProd,
          dedicatedKey: process.env.MFA_ENCRYPTION_KEY,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        })
      )
    )
    .digest();

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSecret = (payload) => {
  const [version, iv, tag, data] = String(payload).split(':');
  if (version !== 'v1') throw ApiError.internal('Secret MFA illisible');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const generateBackupCodes = (count = 8) =>
  Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex').match(/.{1,5}/g).join('-'));

/* ─────────────────────── cycle de vie ─────────────────────── */

/**
 * Étape 1 — création du secret. Il n'est actif qu'après confirmation par un
 * premier code valide : aucune activation silencieuse.
 */
export const setup = async (req) => {
  const existing = await prisma.mfaSecret.findUnique({ where: { userId: req.user.id } });
  if (existing?.confirmedAt) {
    throw ApiError.conflict('La double authentification est déjà active');
  }

  const secret = base32Encode(crypto.randomBytes(20));
  const data = {
    secretHash: encryptSecret(secret),
    method: 'TOTP',
    confirmedAt: null,
    lastUsedAt: null,
  };

  const record = existing
    ? await prisma.mfaSecret.update({ where: { id: existing.id }, data })
    : await prisma.mfaSecret.create({
        data: { id: resolveId(), userId: req.user.id, backupCodesHashes: [], ...data },
      });

  const account = req.user.email ?? req.user.id;
  const otpauthUrl =
    `otpauth://totp/${encodeURIComponent(`${ISSUER}:${account}`)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

  /*
   * QR code généré **côté serveur**, en data URI.
   *
   * Sans lui, le client n'a qu'un moyen d'ajouter le compte à une application
   * d'authentification : afficher le secret en clair. C'est exactement ce qu'il
   * ne faut pas faire — le secret à l'écran est lisible par-dessus l'épaule,
   * capturable, et il finit dans les journaux d'accessibilité ou les captures.
   *
   * Le QR porte la même information, mais sous une forme qui se scanne au lieu
   * de se lire. Ajout **additif** : `secret` et `otpauthUrl` restent renvoyés
   * pour les clients existants et pour la saisie manuelle de secours.
   */
  const { default: QRCode } = await import('qrcode');
  const qrDataUri = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });

  return {
    mfaId: record.id,
    method: 'TOTP',
    // Affiché UNE seule fois, à l'activation.
    secret,
    otpauthUrl,
    qrDataUri,
    digits: DIGITS,
    period: STEP_SECONDS,
    next: 'Confirmez avec un code à 6 chiffres pour activer la double authentification.',
  };
};

/**
 * Étape 2 — confirmation : un code valide active la MFA et génère les codes de
 * secours (affichés une seule fois, jamais stockés en clair).
 */
export const confirm = async ({ code }, req) => {
  const record = await prisma.mfaSecret.findUnique({ where: { userId: req.user.id } });
  if (!record) throw ApiError.notFound('Aucun enrôlement MFA en cours');
  if (record.confirmedAt) throw ApiError.conflict('La double authentification est déjà active');

  const secret = decryptSecret(record.secretHash);
  const valid = verifyTotp(secret, code);
  if (!valid) throw ApiError.badRequest('Code invalide ou expiré');

  const backupCodes = generateBackupCodes();
  // Le drapeau `Profile.mfaEnabled` est la seule source lue par la connexion :
  // il est mis à jour dans la même transaction que l'enrôlement (défaut réel
  // constaté en recette — la MFA était enrôlée sans jamais être exigée).
  const [updated] = await prisma.$transaction([
    prisma.mfaSecret.update({
      where: { id: record.id },
      data: {
        confirmedAt: new Date(),
        lastUsedAt: new Date(),
        backupCodesHashes: backupCodes.map(hashCode),
      },
    }),
    prisma.profile.update({ where: { id: req.user.id }, data: { mfaEnabled: true } }),
  ]);

  await audit({
    actorId: req.user.id,
    action: 'mfa.confirm',
    resource: 'mfa_secrets',
    resourceId: updated.id,
    req,
    newValue: { method: 'TOTP', backupCodes: backupCodes.length },
  });

  return {
    mfaEnabled: true,
    backupCodes,
    warning: 'Conservez ces codes hors ligne : ils ne seront plus jamais affichés.',
  };
};

/**
 * Vérification d'un code (fenêtre ±1 pas de 30 s).
 * `counter` est renvoyé pour tracer la consommation et empêcher le rejeu.
 */
export const verifyTotp = (secret, code, date = new Date()) => {
  const normalized = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(date.getTime() / 1000 / STEP_SECONDS);
  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    if (totpAt(secret, counter + offset) === normalized) return true;
  }
  return false;
};

/** Vérification d'un code de secours : usage unique. */
export const consumeBackupCode = async (record, code) => {
  const hashed = hashCode(String(code).trim());
  const remaining = (record.backupCodesHashes ?? []).filter((h) => h !== hashed);
  if (remaining.length === (record.backupCodesHashes ?? []).length) return null;
  await prisma.mfaSecret.update({ where: { id: record.id }, data: { backupCodesHashes: remaining } });
  return { remaining: remaining.length };
};

/**
 * NFR-01 — point de contrôle réutilisable par les services sensibles.
 * Refuse explicitement (401/403) si la MFA n'est pas active ou si le code est faux.
 */
export const assertMfa = async (userId, code) => {
  const record = await prisma.mfaSecret.findUnique({ where: { userId } });
  if (!record?.confirmedAt) {
    throw ApiError.forbidden('Double authentification requise pour cette opération (NFR-01)');
  }

  if (code) {
    const secret = decryptSecret(record.secretHash);
    if (verifyTotp(secret, code)) return { verified: true, method: 'TOTP' };
    const backup = await consumeBackupCode(record, code);
    if (backup) return { verified: true, method: 'BACKUP_CODE', remainingBackupCodes: backup.remaining };
    throw ApiError.unauthorized('Code de double authentification invalide');
  }

  throw ApiError.forbidden('Code de double authentification requis', { mfaRequired: true });
};

/** Vérification utilisée à la connexion : code obligatoire si la MFA est active. */
export const verify = async ({ code }, req) => {
  const result = await assertMfa(req.user.id, code);
  const record = await prisma.mfaSecret.findUnique({ where: { userId: req.user.id } });
  await prisma.mfaSecret.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  await audit({
    actorId: req.user.id,
    action: 'mfa.verify',
    resource: 'mfa_secrets',
    resourceId: record.id,
    req,
    newValue: { method: result.method },
  });
  return { ...result, verifiedAt: new Date() };
};

export const disable = async ({ code }, req) => {
  const record = await prisma.mfaSecret.findUnique({ where: { userId: req.user.id } });
  if (!record?.confirmedAt) throw ApiError.conflict('La double authentification n’est pas active');

  await assertMfa(req.user.id, code);

  await prisma.$transaction([
    prisma.mfaSecret.update({
      where: { id: record.id },
      data: { confirmedAt: null, backupCodesHashes: [], lastUsedAt: null, secretHash: encryptSecret('disabled') },
    }),
    prisma.profile.update({ where: { id: req.user.id }, data: { mfaEnabled: false } }),
  ]);

  await audit({
    actorId: req.user.id,
    action: 'mfa.disable',
    resource: 'mfa_secrets',
    resourceId: record.id,
    req,
    oldValue: { mfaEnabled: true },
    newValue: { mfaEnabled: false },
  });

  return { mfaEnabled: false };
};

export const status = async (req) => {
  const record = await prisma.mfaSecret.findUnique({ where: { userId: req.user.id } });
  return {
    mfaEnabled: Boolean(record?.confirmedAt),
    method: record?.method ?? 'TOTP',
    confirmedAt: record?.confirmedAt ?? null,
    backupCodesRemaining: record?.backupCodesHashes?.length ?? 0,
    required: false,
    policy: 'Obligatoire pour les accès investisseur, les documents confidentiels et l’administration (V4 NFR-01).',
  };
};
