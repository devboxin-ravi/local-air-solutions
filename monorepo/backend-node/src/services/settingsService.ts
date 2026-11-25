/**
 * Company settings (typed JSON groups), audit logging, and notification templates.
 */

import { Prisma } from '@prisma/client';
import { DEFAULT_SETTINGS, SettingKey, SettingKeys, TRACKER_REQUIRED_STEPS } from '../constants';
import { EngagementRepository } from '../repositories/engagementRepository';
import { Db } from '../repositories/db';
import type { AuthUser, RequestMeta } from '../models';
import { NotFoundError } from '../utils/errors';
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
}

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

export class SettingsService {
  constructor(private readonly repo: EngagementRepository) {}

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
    return { ...result, integrations: this.integrationStatus() };
  }

  /** Public subset safe for unauthenticated apps (branding, support contacts, payment options). */
  async getPublic() {
    const [company, payment, general, appHome, trackerSteps] = await Promise.all([this.company(), this.payment(), this.general(), this.appHome(), this.trackerSteps()]);
    return {
      company: { name: company.name, tagline: company.tagline, logoUrl: company.logoUrl, phone: company.phone, email: company.email, supportPhone: company.supportPhone, supportWhatsapp: company.supportWhatsapp, address: company.address },
      payment: {
        policy: payment.policy,
        upiEnabled: payment.upiEnabled,
        upiId: payment.upiEnabled ? payment.upiId : '',
        upiPayeeName: payment.upiPayeeName,
        razorpayEnabled: payment.razorpayEnabled && config.razorpay.enabled,
        razorpayKeyId: payment.razorpayEnabled && config.razorpay.enabled ? config.razorpay.keyId : null,
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

  integrationStatus() {
    return {
      smtp: config.smtp.enabled,
      razorpay: config.razorpay.enabled,
      whatsappCloud: config.whatsapp.cloudEnabled,
      fcm: config.fcm.enabled,
    };
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
