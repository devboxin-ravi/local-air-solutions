/**
 * Authenticated encryption for secrets stored in the database (AES-256-GCM).
 * Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>". The 256-bit key is derived from the
 * configured master key with SHA-256, so any 32+ char string works as SECRETS_ENCRYPTION_KEY.
 */

import crypto from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const deriveKey = (masterKey: string) => crypto.createHash('sha256').update(masterKey).digest();

export function encryptSecret(plain: string, masterKey: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(masterKey), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

/** Throws if the value was tampered with or was encrypted with a different master key. */
export function decryptSecret(sealed: string, masterKey: string): string {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unsupported secret format');
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(masterKey), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
