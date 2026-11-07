import crypto from 'node:crypto';

/**
 * WA-01 — signature `X-Hub-Signature-256` de Meta (HMAC-SHA256 sur le corps brut).
 * Comparaison à temps constant : aucune fuite par mesure de temps.
 */
export const verifySignature = (rawBody, header, secret) => {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = header.slice('sha256='.length);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
