/**
 * Credentials for outbound integrations (SMTP email, FCM push, WhatsApp Cloud) entered from the
 * admin panel. Secrets are sealed with SECRETS_ENCRYPTION_KEY in `company_settings`; values in
 * effect are kept in memory so delivery code can ask "is email configured?" synchronously.
 * Saved values win over the server .env; with nothing saved the .env values apply as before.
 */

import { Prisma } from '@prisma/client';
import { config } from '../config';
import { ErrorMessages } from '../constants';
import { IntegrationSettingKeys, type IntegrationName } from '../constants/integrations';
import { EngagementRepository } from '../repositories/engagementRepository';
import { BusinessRuleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { decryptSecret, encryptSecret } from '../utils/secretBox';

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}
export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}
export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}
interface CredentialMap {
  smtp: SmtpCredentials;
  fcm: FcmCredentials;
  whatsappCloud: WhatsAppCredentials;
}

/** Which fields are secret (encrypted at rest, never returned). */
const SECRET_FIELDS: { [K in IntegrationName]: Array<keyof CredentialMap[K]> } = {
  smtp: ['password'],
  fcm: ['privateKey'],
  whatsappCloud: ['accessToken'],
};
/** Fields that must be present for the integration to count as configured. */
const REQUIRED_FIELDS: { [K in IntegrationName]: Array<keyof CredentialMap[K]> } = {
  smtp: ['host', 'port', 'user', 'password', 'from'],
  fcm: ['projectId', 'clientEmail', 'privateKey'],
  whatsappCloud: ['phoneNumberId', 'accessToken'],
};

type Stored = Record<string, string | number | boolean>;

/**
 * Values copied out of a JSON file often keep their quotes and trailing comma ("value",) —
 * strip those so a hand-pasted field works the same as the JSON import.
 */
const unwrap = (v: string) => v.trim().replace(/,$/, '').replace(/^"([\s\S]*)"$/, '$1').trim();
/** Private keys pasted from JSON keep "\n" escapes — turn them into real newlines. */
const normalizePrivateKey = (key: string) => unwrap(key).replace(/\\n/g, '\n').trim();
/** Cleans every text value of a credential set (on save and on read, so earlier saves are fixed too). */
const cleanValues = (values: Stored): Stored =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? (k === 'privateKey' ? normalizePrivateKey(v) : unwrap(v)) : v]));

export class IntegrationCredentialStore {
  /** Decrypted values saved from the admin panel, by integration. */
  private saved: Partial<{ [K in IntegrationName]: CredentialMap[K] }> = {};
  /** Bumped on every change so providers can rebuild cached clients/tokens. */
  version = 0;
  private loading: Promise<void> | null = null;

  constructor(private readonly repo: EngagementRepository) {}

  /** Loads saved credentials (called at startup; safe to call again). */
  load(): Promise<void> {
    this.loading ??= (async () => {
      for (const name of Object.keys(IntegrationSettingKeys) as IntegrationName[]) {
        const row = await this.repo.findSetting(IntegrationSettingKeys[name]);
        this.setSaved(name, (row?.value as Stored | null | undefined) ?? null);
      }
      this.version += 1;
    })().catch((err) => {
      this.loading = null;
      logger.error('Could not load integration credentials', { err: (err as Error).message });
    });
    return this.loading;
  }

  private setSaved(name: IntegrationName, stored: Stored | null) {
    if (!stored) {
      delete this.saved[name];
      return;
    }
    const key = config.secrets.encryptionKey;
    const out: Stored = { ...stored };
    try {
      for (const f of SECRET_FIELDS[name] as string[]) {
        if (typeof stored[f] === 'string' && stored[f]) {
          if (!key) throw new Error('no key');
          out[f] = decryptSecret(stored[f] as string, key);
        }
      }
      (this.saved as Record<string, unknown>)[name] = cleanValues(out);
    } catch {
      logger.error(ErrorMessages.SECRET_UNREADABLE, { integration: name });
      delete this.saved[name];
    }
  }

  private complete<K extends IntegrationName>(name: K, values: Partial<CredentialMap[K]> | undefined): values is CredentialMap[K] {
    return !!values && (REQUIRED_FIELDS[name] as string[]).every((f) => {
      const v = (values as Record<string, unknown>)[f];
      return v !== undefined && v !== null && v !== '';
    });
  }

  // ─── Values in effect (admin panel first, else server .env) ───
  smtp(): SmtpCredentials | null {
    if (this.complete('smtp', this.saved.smtp)) return this.saved.smtp;
    const c = config.smtp;
    return c.enabled ? { host: c.host as string, port: c.port, secure: c.secure, user: c.user as string, password: c.password as string, from: c.from } : null;
  }

  fcm(): FcmCredentials | null {
    if (this.complete('fcm', this.saved.fcm)) return { ...this.saved.fcm, privateKey: normalizePrivateKey(this.saved.fcm.privateKey) };
    const c = config.fcm;
    return c.enabled ? { projectId: c.projectId as string, clientEmail: c.clientEmail as string, privateKey: c.privateKey as string } : null;
  }

  whatsapp(): WhatsAppCredentials | null {
    if (this.complete('whatsappCloud', this.saved.whatsappCloud)) return this.saved.whatsappCloud;
    const c = config.whatsapp;
    return c.cloudEnabled ? { phoneNumberId: c.phoneNumberId as string, accessToken: c.accessToken as string } : null;
  }

  private inEffect(name: IntegrationName) {
    return name === 'smtp' ? this.smtp() : name === 'fcm' ? this.fcm() : this.whatsapp();
  }

  /** What the admin panel may see: non-secret values and which secrets are set — never the secrets. */
  status(name: IntegrationName) {
    const current = this.inEffect(name) as Record<string, unknown> | null;
    const source = this.complete(name, this.saved[name] as never) ? 'database' : current ? 'env' : null;
    const secrets = SECRET_FIELDS[name] as string[];
    const values: Record<string, unknown> = {};
    const secretsSet: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(current ?? {})) {
      if (secrets.includes(k)) secretsSet[k] = Boolean(v);
      else values[k] = v;
    }
    return { configured: current !== null, source, values, secretsSet, canStoreSecrets: Boolean(config.secrets.encryptionKey) };
  }

  /**
   * Saves admin-entered values. A blank secret keeps the one already saved.
   * Returns the before/after of non-secret fields for the audit log.
   */
  async save(name: IntegrationName, input: Record<string, unknown>) {
    const masterKey = config.secrets.encryptionKey;
    if (!masterKey) throw new BusinessRuleError(ErrorMessages.SECRETS_KEY_MISSING);
    const row = await this.repo.findSetting(IntegrationSettingKeys[name]);
    const before = (row?.value as Stored | null | undefined) ?? {};
    const secrets = SECRET_FIELDS[name] as string[];
    const next: Stored = {};
    for (const [k, v] of Object.entries(cleanValues(input as Stored))) {
      if (v === undefined || v === null || v === '') continue;
      next[k] = secrets.includes(k) ? encryptSecret(k === 'privateKey' ? normalizePrivateKey(String(v)) : String(v), masterKey) : (v as string | number | boolean);
    }
    for (const s of secrets) if (next[s] === undefined && before[s]) next[s] = before[s]; // keep saved secret
    const missingSecret = secrets.find((s) => (REQUIRED_FIELDS[name] as string[]).includes(s) && !next[s]);
    if (missingSecret) throw new BusinessRuleError(ErrorMessages.INTEGRATION_SECRET_REQUIRED);
    await this.repo.upsertSetting(IntegrationSettingKeys[name], next as Prisma.InputJsonValue, null);
    this.setSaved(name, next);
    this.version += 1;
    const publicPart = (v: Stored) => Object.fromEntries(Object.entries(v).filter(([k]) => !secrets.includes(k)));
    return { before: publicPart(before), after: publicPart(next) };
  }

  /** Removes admin-entered values (server .env values, if any, apply again). */
  async clear(name: IntegrationName) {
    await this.repo.deleteSetting(IntegrationSettingKeys[name]);
    this.setSaved(name, null);
    this.version += 1;
  }

  /** Candidate values for a test: what was typed, with blanks (incl. secrets) filled from what is in effect. */
  candidate<K extends IntegrationName>(name: K, input: Record<string, unknown>): CredentialMap[K] | null {
    const merged = { ...((this.inEffect(name) as Record<string, unknown> | null) ?? {}) };
    for (const [k, v] of Object.entries(cleanValues(input as Stored))) if (v !== undefined && v !== null && v !== '') merged[k] = v;
    if (typeof merged.privateKey === 'string') merged.privateKey = normalizePrivateKey(merged.privateKey);
    return this.complete(name, merged as Partial<CredentialMap[K]>) ? (merged as unknown as CredentialMap[K]) : null;
  }
}
