/**
 * Outbound delivery adapters: SMTP email, FCM push (HTTP v1), WhatsApp Cloud API.
 * Each adapter reports `enabled` from config and never pretends to succeed when disabled.
 */

import nodemailer, { Transporter } from 'nodemailer';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ErrorMessages } from '../constants';
import { IntegrationUrls, TokenTtl } from '../constants/integrations';
import { IntegrationDisabledError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export class EmailProvider {
  private transporter: Transporter | null = null;

  get enabled(): boolean {
    return config.smtp.enabled;
  }

  private getTransporter(): Transporter {
    if (!this.enabled) throw new IntegrationDisabledError(ErrorMessages.EMAIL_DISABLED);
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: { user: config.smtp.user, pass: config.smtp.password },
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, text: string, attachments: EmailAttachment[] = []): Promise<void> {
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1f3d;line-height:1.6">${text
      .split('\n')
      .map((l) => l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string))
      .join('<br/>')}</div>`;
    await this.getTransporter().sendMail({ from: config.smtp.from, to, subject, text, html, attachments });
  }
}

export class PushProvider {
  private token: { value: string; expiresAt: number } | null = null;

  get enabled(): boolean {
    return config.fcm.enabled;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TokenTtl.GOOGLE_REFRESH_MARGIN_MS > Date.now()) return this.token.value;
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      { iss: config.fcm.clientEmail, scope: IntegrationUrls.FCM_SCOPE, aud: IntegrationUrls.GOOGLE_OAUTH_TOKEN, iat: now, exp: now + TokenTtl.GOOGLE_ACCESS_SECONDS },
      config.fcm.privateKey as string,
      { algorithm: 'RS256' },
    );
    const res = await fetch(IntegrationUrls.GOOGLE_OAUTH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  /** Sends to each token; returns tokens that are no longer valid (to prune). */
  async send(tokens: string[], title: string, body: string, data: Record<string, string> = {}): Promise<string[]> {
    if (!this.enabled) throw new IntegrationDisabledError('Push notifications (FCM) are not configured.');
    const bearer = await this.accessToken();
    const invalid: string[] = [];
    let delivered = 0;
    for (const token of tokens) {
      const res = await fetch(IntegrationUrls.FCM_SEND(config.fcm.projectId as string), {
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
  get enabled(): boolean {
    return config.whatsapp.cloudEnabled;
  }

  async sendText(phoneE164Digits: string, text: string): Promise<void> {
    if (!this.enabled) throw new IntegrationDisabledError(ErrorMessages.WHATSAPP_CLOUD_DISABLED);
    const res = await fetch(IntegrationUrls.WHATSAPP_MESSAGES(config.whatsapp.phoneNumberId as string), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneE164Digits, type: 'text', text: { body: text } }),
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud API error ${res.status}`);
  }
}
