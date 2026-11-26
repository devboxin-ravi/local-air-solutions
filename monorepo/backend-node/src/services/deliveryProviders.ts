/**
 * Outbound delivery adapters: SMTP email, FCM push (HTTP v1), WhatsApp Cloud API.
 * Credentials come from the IntegrationCredentialStore (admin panel, else server .env).
 * Each adapter reports `enabled` and never pretends to succeed when disabled.
 */

import nodemailer, { Transporter } from 'nodemailer';
import jwt from 'jsonwebtoken';
import { ErrorMessages } from '../constants';
import { IntegrationUrls, TokenTtl } from '../constants/integrations';
import { IntegrationDisabledError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { FcmCredentials, IntegrationCredentialStore, SmtpCredentials, WhatsAppCredentials } from './integrationCredentials';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

const smtpTransport = (c: SmtpCredentials): Transporter =>
  nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.password } });

export class EmailProvider {
  private transporter: { version: number; client: Transporter } | null = null;

  constructor(private readonly credentials: IntegrationCredentialStore) {}

  get enabled(): boolean {
    return this.credentials.smtp() !== null;
  }

  /** Throws with the server's reason if the SMTP login fails. */
  static async test(c: SmtpCredentials): Promise<void> {
    await smtpTransport(c).verify();
  }

  private getTransporter(c: SmtpCredentials): Transporter {
    if (!this.transporter || this.transporter.version !== this.credentials.version) {
      this.transporter = { version: this.credentials.version, client: smtpTransport(c) };
    }
    return this.transporter.client;
  }

  async send(to: string, subject: string, text: string, attachments: EmailAttachment[] = []): Promise<void> {
    const c = this.credentials.smtp();
    if (!c) throw new IntegrationDisabledError(ErrorMessages.EMAIL_DISABLED);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1f3d;line-height:1.6">${text
      .split('\n')
      .map((l) => l.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch] as string))
      .join('<br/>')}</div>`;
    await this.getTransporter(c).sendMail({ from: c.from, to, subject, text, html, attachments });
  }
}

/** Exchanges a service-account key for a Google OAuth access token. */
async function fetchGoogleToken(c: FcmCredentials): Promise<{ value: string; expiresInSeconds: number }> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: c.clientEmail, scope: IntegrationUrls.FCM_SCOPE, aud: IntegrationUrls.GOOGLE_OAUTH_TOKEN, iat: now, exp: now + TokenTtl.GOOGLE_ACCESS_SECONDS },
    c.privateKey,
    { algorithm: 'RS256' },
  );
  const res = await fetch(IntegrationUrls.GOOGLE_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { value: json.access_token, expiresInSeconds: json.expires_in };
}

export class PushProvider {
  private token: { version: number; value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: IntegrationCredentialStore) {}

  get enabled(): boolean {
    return this.credentials.fcm() !== null;
  }

  /** Throws if Google rejects the service account. */
  static async test(c: FcmCredentials): Promise<void> {
    await fetchGoogleToken(c);
  }

  private async accessToken(c: FcmCredentials): Promise<string> {
    const t = this.token;
    if (t && t.version === this.credentials.version && t.expiresAt - TokenTtl.GOOGLE_REFRESH_MARGIN_MS > Date.now()) return t.value;
    const fresh = await fetchGoogleToken(c);
    this.token = { version: this.credentials.version, value: fresh.value, expiresAt: Date.now() + fresh.expiresInSeconds * 1000 };
    return fresh.value;
  }

  /** Sends to each token; returns tokens that are no longer valid (to prune). */
  async send(tokens: string[], title: string, body: string, data: Record<string, string> = {}): Promise<string[]> {
    const c = this.credentials.fcm();
    if (!c) throw new IntegrationDisabledError(ErrorMessages.PUSH_DISABLED);
    const bearer = await this.accessToken(c);
    const invalid: string[] = [];
    let delivered = 0;
    for (const token of tokens) {
      const res = await fetch(IntegrationUrls.FCM_SEND(c.projectId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
      });
      if (res.ok) delivered += 1;
      else if (res.status === 404 || res.status === 400) invalid.push(token);
      else logger.warn('FCM send failed', { status: res.status });
    }
    if (tokens.length && delivered === 0 && invalid.length !== tokens.length) throw new Error('FCM delivery failed for all tokens');
    return invalid;
  }
}

export class WhatsAppCloudProvider {
  constructor(private readonly credentials: IntegrationCredentialStore) {}

  get enabled(): boolean {
    return this.credentials.whatsapp() !== null;
  }

  /** Reads the phone number record — fails if the token or phone number id is wrong. */
  static async test(c: WhatsAppCredentials): Promise<void> {
    const res = await fetch(IntegrationUrls.WHATSAPP_PHONE(c.phoneNumberId), { headers: { Authorization: `Bearer ${c.accessToken}` } });
    if (!res.ok) throw new Error(`WhatsApp Cloud API error ${res.status}`);
  }

  async sendText(phoneE164Digits: string, text: string): Promise<void> {
    const c = this.credentials.whatsapp();
    if (!c) throw new IntegrationDisabledError(ErrorMessages.WHATSAPP_CLOUD_DISABLED);
    const res = await fetch(IntegrationUrls.WHATSAPP_MESSAGES(c.phoneNumberId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneE164Digits, type: 'text', text: { body: text } }),
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud API error ${res.status}`);
  }
}
