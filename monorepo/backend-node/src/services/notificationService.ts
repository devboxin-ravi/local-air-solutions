/**
 * Notification orchestration: renders templates, writes in-app notifications,
 * queues external channel deliveries (processed by the background job with retries),
 * and deduplicates via dedupe keys.
 */

import { NotificationChannel, Prisma } from '@prisma/client';
import { DEFAULT_TEMPLATES, Notifications } from '../constants';
import { EngagementRepository } from '../repositories/engagementRepository';
import { Db } from '../repositories/db';
import { renderTemplate, toPageMeta, toPageParams } from '../utils/helpers';
import { logger } from '../utils/logger';
import { EmailProvider, PushProvider, WhatsAppCloudProvider } from './deliveryProviders';
import { SettingsService } from './settingsService';

export interface NotifyInput {
  userId: number | null | undefined;
  event: string;
  data: Record<string, unknown>;
  dedupeKey?: string;
}

export class NotificationService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly settings: SettingsService,
    private readonly email: EmailProvider,
    private readonly push: PushProvider,
    private readonly whatsapp: WhatsAppCloudProvider,
  ) {}

  private async render(event: string, channel: NotificationChannel, data: Record<string, unknown>, db?: Db) {
    const tpl = await this.repo.findTemplate(event, channel, db);
    const fallback = DEFAULT_TEMPLATES.find((t) => t.eventType === event);
    if (tpl && !tpl.isActive) return null;
    const title = tpl?.subject ?? fallback?.title ?? event;
    const body = tpl?.body ?? fallback?.body ?? '';
    return { title: renderTemplate(title, data), body: renderTemplate(body, data) };
  }

  /**
   * Records an in-app notification and queues external channels as configured.
   * Never throws — notification failures must not break business transactions.
   */
  async notify(input: NotifyInput, db?: Db): Promise<void> {
    if (!input.userId) return;
    try {
      const prefs = await this.settings.notification(db);
      const channels: NotificationChannel[] = [];
      if (prefs.inApp) channels.push('IN_APP');
      if (prefs.push && this.push.enabled) channels.push('PUSH');
      if (prefs.email && this.email.enabled) channels.push('EMAIL');
      if (prefs.whatsapp && this.whatsapp.enabled) channels.push('WHATSAPP');

      for (const channel of channels) {
        const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : undefined;
        if (dedupeKey && (await this.repo.findNotificationByDedupe(dedupeKey, db))) continue;
        const content = await this.render(input.event, channel, input.data, db);
        if (!content) continue;
        await this.repo.createNotification(
          {
            userId: input.userId,
            eventType: input.event,
            channel,
            title: content.title.slice(0, 200),
            body: content.body.slice(0, 2000),
            data: JSON.parse(JSON.stringify(input.data)) as Prisma.InputJsonValue,
            status: channel === 'IN_APP' ? 'SENT' : 'PENDING',
            sentAt: channel === 'IN_APP' ? new Date() : null,
            dedupeKey,
          },
          db,
        );
      }
    } catch (err) {
      logger.error('notify failed', { event: input.event, error: (err as Error).message });
    }
  }

  async notifyMany(userIds: number[], event: string, data: Record<string, unknown>, db?: Db): Promise<void> {
    for (const userId of new Set(userIds)) await this.notify({ userId, event, data }, db);
  }

  async list(userId: number, page?: number, pageSize?: number) {
    const p = toPageParams(page, pageSize);
    const { items, total, unread } = await this.repo.listNotifications(userId, 'IN_APP', p.skip, p.take);
    return { items, meta: { ...toPageMeta(p, total), unread } };
  }

  async markRead(userId: number, ids: number[] | 'all') {
    const res = await this.repo.markRead(userId, ids);
    return { updated: res.count };
  }

  /** Background delivery with retry/backoff via attempts counter. */
  async processPendingDeliveries(): Promise<{ processed: number; sent: number; failed: number }> {
    const batch = await this.repo.pendingDeliveries(Notifications.MAX_ATTEMPTS, Notifications.BATCH_SIZE);
    let sent = 0;
    let failed = 0;
    for (const n of batch) {
      try {
        if (n.channel === 'EMAIL') {
          if (!n.user.email) throw new Error('User has no email');
          await this.email.send(n.user.email, n.title, n.body);
        } else if (n.channel === 'PUSH') {
          const tokens = n.user.deviceTokens.map((t) => t.token);
          if (!tokens.length) throw new Error('No device tokens');
          await this.push.send(tokens, n.title, n.body, { event: n.eventType, ...(Object.fromEntries(Object.entries((n.data as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v)]))) });
        } else if (n.channel === 'WHATSAPP') {
          await this.whatsapp.sendText(`${n.user.countryCode}${n.user.mobile}`.replace(/\D/g, ''), `${n.title}\n${n.body}`);
        }
        await this.repo.updateNotification(n.id, { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null });
        sent += 1;
      } catch (err) {
        await this.repo.updateNotification(n.id, { status: 'FAILED', attempts: { increment: 1 }, lastError: (err as Error).message.slice(0, 1000) });
        failed += 1;
      }
    }
    return { processed: batch.length, sent, failed };
  }
}
