/**
 * Compact HMAC-signed tokens for public, expiring links: "<id>.<expiresAtSeconds>.<signature>".
 * The purpose is mixed into the signature, so a token for one kind of link can't be used for another.
 */

import crypto from 'crypto';

const sign = (purpose: string, payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(`${purpose}:${payload}`).digest('base64url');

/** Creates a token for `id` that is valid until `expiresAt`. */
export const createSignedToken = (purpose: string, id: number, expiresAt: Date, secret: string): string => {
  const payload = `${id}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${sign(purpose, payload, secret)}`;
};

/** Returns the id when the token is well-formed, correctly signed and not expired; otherwise null. */
export const verifySignedToken = (purpose: string, token: string, secret: string, now: number = Date.now()): number | null => {
  const match = /^(\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{20,})$/.exec(token);
  if (!match) return null;
  const [, id, expires, signature] = match;
  const expected = sign(purpose, `${id}.${expires}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) * 1000 < now) return null;
  return Number(id);
};
