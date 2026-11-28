/**
 * Company settings (typed JSON groups), audit logging, and notification templates.
 */

import { Prisma } from '@prisma/client';
import { DEFAULT_SETTINGS, SettingKey, SettingKeys, TRACKER_REQUIRED_STEPS } from '../constants';
import { EngagementRepository } from '../repositories/engagementRepository';
import { Db } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { BusinessRuleError, NotFoundError } from '../utils/errors';
import { decryptSecret, encryptSecret } from '../utils/secretBox';
import { ErrorMessages } from '../constants';
import { Razorpay as RazorpayConst } from '../constants/integrations';
import { logger } from '../utils/logger';
import type { IntegrationName } from '../constants/integrations';
import type { IntegrationCredentialStore } from './integrationCredentials';
import { EmailProvider, PushProvider, WhatsAppCloudProvider } from './deliveryProviders';
import { toPageMeta, toPageParams } from '../utils/helpers';
import { config } from '../config';

export interface CompanySettings {
  name: string;
  tagline: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  gstin: string;
  stateCode: string;
  logoUrl: string;
  supportPhone: string;
  supportWhatsapp: string;
}

export interface GstSettings {
  enabled: boolean;
  defaultRate: number;
  pricesIncludeGst: boolean;
  sacCode: string;
}

export interface PaymentSettings {
  policy: string;
  upiEnabled: boolean;
  upiId: string;
  upiPayeeName: string;
  razorpayEnabled: boolean;
  cashEnabled: boolean;
  upiAccountName: string;
  upiId2: string;
  upiPayeeName2: string;
  upiAccountName2: string;
  defaultUpiAccount: number;
  upiChargePercent: number;
  razorpayChargePercent: number;
}

export interface UpiAccount {
  key: number;
  label: string;
  upiId: string;
  payeeName: string;
}

/** The configured UPI accounts, and which one is offered by default. */
export const upiAccounts = (p: PaymentSettings): { accounts: UpiAccount[]; defaultAccount: UpiAccount | null } => {
  const accounts = [
    { key: 1, name: p.upiAccountName, upiId: p.upiId, payeeName: p.upiPayeeName },
    { key: 2, name: p.upiAccountName2, upiId: p.upiId2, payeeName: p.upiPayeeName2 || p.upiPayeeName },
  ]
    .filter((a) => !!a.upiId)
    .map((a) => ({ key: a.key, label: a.name || `UPI account ${a.key}`, upiId: a.upiId, payeeName: a.payeeName }));
  return { accounts, defaultAccount: accounts.find((a) => a.key === Number(p.defaultUpiAccount)) ?? accounts[0] ?? null };
};

export interface ReminderSettings {
  enabled: boolean;
  defaultIntervalMonths: number;
  daysBeforeDue: number;
  amcExpiryNoticeDays: number;
}

export interface GeneralSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  allowCustomerCancellationHours: number;
  requireCompletionOtp: boolean;
  technicianCanReject: boolean;
  showTechnicianPhoneToCustomer: boolean;
}

export interface WorkingHoursSettings {
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxJobsPerSlot: number;
}

export interface NotificationSettings {
  inApp: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
}

/** Customer-app home screen content, edited from Admin → Settings → Customer App Home. */
export interface PromoSlide {
  enabled: boolean;
  tag: string;
  title: string;
  subtitle: string;
  buttonText: string;
  action: string;
  style: string;
}
/** Customer-app content managed from Admin → Settings → Customer App. */
export interface AppHomeSettings {
  announcement: string;
  slides: PromoSlide[];
  trustPoints: string[];
  todayCard: { enabled: boolean; title: string; subtitle: string; buttonText: string };
  showCategories: boolean;
  showPopular: boolean;
  showTrustPoints: boolean;
  onboarding: Array<{ title: string; text: string }>;
  /** Pre-slides format (single banner); folded into slide 1 when no slides were saved yet. */
  bannerEnabled?: boolean;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerButtonText?: string;
}

export interface TrackerStep {
  status: string;
  visible: boolean;
  label: string;
  title: string;
  hint: string;
}
export interface BookingTrackerSettings {
  steps: TrackerStep[];
}

/** Razorpay keys in effect (decrypted). */
export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  source: 'database' | 'env';
}
/** As stored in company_settings: secrets sealed with SECRETS_ENCRYPTION_KEY. */
interface StoredRazorpayKeys {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export class SettingsService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly integrations: IntegrationCredentialStore,
  ) {}

  async get<T>(key: SettingKey, db?: Db): Promise<T> {
    const row = await this.repo.findSetting(key, db);
    return { ...(DEFAULT_SETTINGS[key] as object), ...((row?.value as object) ?? {}) } as T;
  }

  company = (db?: Db) => this.get<CompanySettings>(SettingKeys.COMPANY, db);
  gst = (db?: Db) => this.get<GstSettings>(SettingKeys.GST, db);
  payment = (db?: Db) => this.get<PaymentSettings>(SettingKeys.PAYMENT, db);
  reminder = (db?: Db) => this.get<ReminderSettings>(SettingKeys.REMINDER, db);
  general = (db?: Db) => this.get<GeneralSettings>(SettingKeys.GENERAL, db);
  workingHours = (db?: Db) => this.get<WorkingHoursSettings>(SettingKeys.WORKING_HOURS, db);
  notification = (db?: Db) => this.get<NotificationSettings>(SettingKeys.NOTIFICATION, db);
  /** App content; an older single-banner save is carried into the first slide. */
  async appHome(db?: Db): Promise<AppHomeSettings> {
    const row = await this.repo.findSetting(SettingKeys.APP_HOME, db);
    const stored = (row?.value as Partial<AppHomeSettings> | null) ?? {};
    const merged = { ...(DEFAULT_SETTINGS[SettingKeys.APP_HOME] as unknown as AppHomeSettings), ...stored };
    if (!stored.slides && stored.bannerTitle !== undefined) {
      const [first, ...rest] = merged.slides;
      merged.slides = [
        { ...first, enabled: stored.bannerEnabled !== false, title: stored.bannerTitle || first.title, subtitle: stored.bannerSubtitle ?? first.subtitle, buttonText: stored.bannerButtonText || first.buttonText },
        ...rest,
      ];
    }
    return merged;
  }
  bookingTracker = (db?: Db) => this.get<BookingTrackerSettings>(SettingKeys.BOOKING_TRACKER, db);

  /** Tracker steps in booking order; each stored step is merged over its default so none go missing. */
  async trackerSteps(db?: Db): Promise<TrackerStep[]> {
    const stored = (await this.bookingTracker(db)).steps ?? [];
    const defaults = (DEFAULT_SETTINGS[SettingKeys.BOOKING_TRACKER] as unknown as BookingTrackerSettings).steps;
    return defaults.map((d) => {
      const s = stored.find((x) => x.status === d.status);
      return { ...d, ...(s ?? {}), visible: TRACKER_REQUIRED_STEPS.includes(d.status) ? true : (s?.visible ?? d.visible) };
    });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.repo.listSettings();
    const result: Record<string, unknown> = {};
    for (const key of Object.values(SettingKeys)) {
      const row = rows.find((r) => r.key === key);
      result[key] = { ...(DEFAULT_SETTINGS[key] as object), ...((row?.value as object) ?? {}) };
    }
    result[SettingKeys.APP_HOME] = await this.appHome();
    return { ...result, integrations: await this.integrationStatus() };
  }

  /** Public subset safe for unauthenticated apps (branding, support contacts, payment options). */
  async getPublic() {
    const [company, payment, general, appHome, trackerSteps, razorpay] = await Promise.all([this.company(), this.payment(), this.general(), this.appHome(), this.trackerSteps(), this.razorpayCredentials()]);
    const razorpayOn = payment.razorpayEnabled && razorpay !== null;
    const upi = upiAccounts(payment).defaultAccount;
    return {
      company: { name: company.name, tagline: company.tagline, logoUrl: company.logoUrl, phone: company.phone, email: company.email, supportPhone: company.supportPhone, supportWhatsapp: company.supportWhatsapp, address: company.address },
      payment: {
        policy: payment.policy,
        upiEnabled: payment.upiEnabled,
        upiId: payment.upiEnabled ? upi?.upiId ?? '' : '',
        upiPayeeName: upi?.payeeName ?? payment.upiPayeeName,
        razorpayEnabled: razorpayOn,
        // The Key ID is public by design (Razorpay Checkout needs it); the secret never leaves the server.
        razorpayKeyId: razorpayOn ? razorpay.keyId : null,
        cashEnabled: payment.cashEnabled,
      },
      general: { allowCustomerCancellationHours: general.allowCustomerCancellationHours },
      appHome: {
        announcement: appHome.announcement,
        slides: appHome.slides.filter((s) => s.enabled),
        trustPoints: appHome.trustPoints,
        todayCard: appHome.todayCard,
        showCategories: appHome.showCategories,
        showPopular: appHome.showPopular,
        showTrustPoints: appHome.showTrustPoints,
        onboarding: appHome.onboarding,
      },
      bookingTracker: { steps: trackerSteps },
    };
  }

  async integrationStatus() {
    return {
      smtp: this.integrations.smtp() !== null,
      razorpay: (await this.razorpayCredentials()) !== null,
      whatsappCloud: this.integrations.whatsapp() !== null,
      fcm: this.integrations.fcm() !== null,
    };
  }

  // ─── SMTP / FCM / WhatsApp Cloud credentials ───
  /** Status for the admin panel — non-secret values only. */
  async integration(name: IntegrationName) {
    await this.integrations.load();
    return this.integrations.status(name);
  }

  async saveIntegration(name: IntegrationName, input: Record<string, unknown>, actor: AuthUser, meta: RequestMeta) {
    await this.integrations.load();
    const { before, after } = await this.integrations.save(name, input);
    await this.audit(actor, 'UPDATE', 'setting', `integration.${name}`, before, after, meta);
    return this.integrations.status(name);
  }

  async clearIntegration(name: IntegrationName, actor: AuthUser, meta: RequestMeta) {
    await this.integrations.clear(name);
    await this.audit(actor, 'DELETE', 'setting', `integration.${name}`, null, null, meta);
    return this.integrations.status(name);
  }

  /** Tries the typed values (blanks filled from what is in effect) against the real service. */
  async testIntegration(name: IntegrationName, input: Record<string, unknown>) {
    await this.integrations.load();
    const candidate = this.integrations.candidate(name, input);
    if (!candidate) throw new BusinessRuleError(ErrorMessages.INTEGRATION_INCOMPLETE);
    try {
      if (name === 'smtp') await EmailProvider.test(candidate as never);
      else if (name === 'fcm') await PushProvider.test(candidate as never);
      else await WhatsAppCloudProvider.test(candidate as never);
      return { ok: true };
    } catch (err) {
      throw new BusinessRuleError(ErrorMessages.INTEGRATION_TEST_FAILED((err as Error).message));
    }
  }

  // ─── Razorpay credentials ───
  /** Decrypted keys cached in memory; cleared whenever an admin saves or removes keys. */
  private razorpayCache: { value: RazorpayCredentials | null } | null = null;

  /**
   * Keys in effect: the ones saved from the admin panel, else the server .env. Null = not configured.
   * The secret never leaves the server — callers get it only to sign/verify.
   */
  async razorpayCredentials(): Promise<RazorpayCredentials | null> {
    if (this.razorpayCache) return this.razorpayCache.value;
    let value: RazorpayCredentials | null = null;
    const row = await this.repo.findSetting(RazorpayConst.CREDENTIALS_SETTING_KEY);
    const stored = row?.value as StoredRazorpayKeys | null | undefined;
    if (stored?.keyId && stored.keySecret && config.secrets.encryptionKey) {
      try {
        value = {
          keyId: stored.keyId,
          keySecret: decryptSecret(stored.keySecret, config.secrets.encryptionKey),
          webhookSecret: stored.webhookSecret ? decryptSecret(stored.webhookSecret, config.secrets.encryptionKey) : undefined,
          source: 'database',
        };
      } catch (err) {
        logger.error(ErrorMessages.SECRET_UNREADABLE, { err: (err as Error).message });
      }
    }
    if (!value && config.razorpay.keyId && config.razorpay.keySecret) {
      value = { keyId: config.razorpay.keyId, keySecret: config.razorpay.keySecret, webhookSecret: config.razorpay.webhookSecret, source: 'env' };
    }
    this.razorpayCache = { value };
    return value;
  }

  /** What the admin panel may see: never the secrets themselves. */
  async razorpayStatus() {
    const creds = await this.razorpayCredentials();
    return {
      configured: creds !== null,
      source: creds?.source ?? null,
      keyId: creds?.keyId ?? null,
      mode: creds ? (creds.keyId.startsWith(RazorpayConst.TEST_KEY_PREFIX) ? 'test' : 'live') : null,
      hasWebhookSecret: Boolean(creds?.webhookSecret),
      canStoreSecrets: Boolean(config.secrets.encryptionKey),
    };
  }

  /** Saves keys entered in the admin panel. A blank secret keeps the one already saved. */
  async saveRazorpayCredentials(input: { keyId: string; keySecret?: string; webhookSecret?: string }, actor: AuthUser, meta: RequestMeta) {
    const masterKey = config.secrets.encryptionKey;
    if (!masterKey) throw new BusinessRuleError(ErrorMessages.SECRETS_KEY_MISSING);
    const row = await this.repo.findSetting(RazorpayConst.CREDENTIALS_SETTING_KEY);
    const before = (row?.value as StoredRazorpayKeys | null | undefined) ?? null;
    const keySecret = input.keySecret ? encryptSecret(input.keySecret, masterKey) : before?.keySecret;
    if (!keySecret) throw new BusinessRuleError(ErrorMessages.RAZORPAY_SECRET_REQUIRED);
    const webhookSecret = input.webhookSecret ? encryptSecret(input.webhookSecret, masterKey) : before?.webhookSecret;
    const next: StoredRazorpayKeys = { keyId: input.keyId, keySecret, ...(webhookSecret ? { webhookSecret } : {}) };
    await this.repo.upsertSetting(RazorpayConst.CREDENTIALS_SETTING_KEY, next as unknown as Prisma.InputJsonValue, actor.id);
    this.razorpayCache = null;
    // Audit who changed which key id — never the secrets.
    await this.audit(actor, 'UPDATE', 'setting', RazorpayConst.CREDENTIALS_SETTING_KEY, before ? { keyId: before.keyId } : null, { keyId: input.keyId, secretChanged: Boolean(input.keySecret), webhookSecretChanged: Boolean(input.webhookSecret) }, meta);
    return this.razorpayStatus();
  }

  /** Removes admin-entered keys (the server .env keys, if any, apply again). */
  async clearRazorpayCredentials(actor: AuthUser, meta: RequestMeta) {
    await this.repo.deleteSetting(RazorpayConst.CREDENTIALS_SETTING_KEY);
    this.razorpayCache = null;
    await this.audit(actor, 'DELETE', 'setting', RazorpayConst.CREDENTIALS_SETTING_KEY, null, null, meta);
    return this.razorpayStatus();
  }

  async update(key: SettingKey, value: Record<string, unknown>, actor: AuthUser, meta: RequestMeta) {
    const before = await this.get<Record<string, unknown>>(key);
    const merged = { ...before, ...value };
    await this.repo.upsertSetting(key, merged as Prisma.InputJsonValue, actor.id);
    await this.audit(actor, 'UPDATE', 'setting', key, before, merged, meta);
    return merged;
  }

  // ─── Audit log ───
  async audit(
    actor: AuthUser | null,
    action: string,
    entityType: string,
    entityId: string | number | null,
    before: unknown,
    after: unknown,
    meta?: RequestMeta,
    db?: Db,
  ): Promise<void> {
    await this.repo.createAudit(
      {
        actorUserId: actor?.id ?? null,
        action,
        entityType,
        entityId: entityId === null ? null : String(entityId),
        before: before === undefined || before === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
        after: after === undefined || after === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 500),
      },
      db,
    );
  }

  async listAudit(q: { page?: number; pageSize?: number; entityType?: string; actorUserId?: number; action?: string; from?: Date; to?: Date }) {
    const p = toPageParams(q.page, q.pageSize);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.actorUserId ? { actorUserId: q.actorUserId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const { items, total } = await this.repo.listAudit(where, p.skip, p.take);
    return { items, meta: toPageMeta(p, total) };
  }

  // ─── Templates ───
  listTemplates() {
    return this.repo.listTemplates();
  }

  async updateTemplate(id: number, data: { subject?: string | null; body?: string; isActive?: boolean }, actor: AuthUser, meta: RequestMeta) {
    const updated = await this.repo.updateTemplate(id, data).catch(() => {
      throw new NotFoundError('Template');
    });
    await this.audit(actor, 'UPDATE', 'notificationTemplate', id, null, data, meta);
    return updated;
  }
}
